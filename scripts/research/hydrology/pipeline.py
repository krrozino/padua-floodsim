"""End-to-end CLI orchestrator for historical hydrological dataset acquisition, QC, and manifest verification."""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .acquire import acquire_all, sha256_file
from .config import (
    CALIBRATION_END_UTC,
    DEFAULT_END_DATE,
    DEFAULT_START_DATE,
    EVALUATION_START_UTC,
    PARSER_VERSION,
    PIPELINE_VERSION,
    STATIONS,
)
from .events import extract_candidate_events
from .normalize import deduplicate_and_sort, write_normalized_csv
from .parse import (
    parse_ana_conventional_stage_xml,
    parse_ana_inventory_xml,
    parse_ana_telemetric_xml,
    parse_inea_xml,
)
from .pilot import build_aligned_hourly_rows, evaluate_feasibility, write_aligned_hourly_csv
from .qc import build_quality_report


def _git_commit(repo_root: Path) -> str:
    try:
        res = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=str(repo_root),
            capture_output=True,
            text=True,
            check=True,
        )
        return res.stdout.strip()
    except Exception:
        return "unknown"


def _git_is_dirty(repo_root: Path) -> bool | None:
    try:
        res = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=str(repo_root),
            capture_output=True,
            text=True,
            check=True,
        )
        return bool(res.stdout.strip())
    except Exception:
        return None


def compute_code_identity(
    repo_root: Path,
    *,
    pipeline_dir: Path | None = None,
) -> dict[str, Any]:
    """Compute verifiable, non-circular code identity for future pipeline executions.

    The pipeline fingerprint hashes only the sorted Python source files under
    `scripts/research/hydrology/`, never `run_manifest.json` or git commit metadata,
    eliminating circular dependencies between the manifest and commits.
    """
    pkg_dir = pipeline_dir or (repo_root / "scripts" / "research" / "hydrology")
    py_files = sorted(p for p in pkg_dir.rglob("*.py") if p.is_file())
    combined = hashlib.sha256()
    file_entries: list[dict[str, str]] = []
    for path in py_files:
        try:
            rel = path.relative_to(repo_root).as_posix()
        except ValueError:
            rel = path.relative_to(pkg_dir).as_posix()
        file_sha = sha256_file(path)
        file_entries.append({"relative_path": rel, "sha256": file_sha})
        combined.update(f"{rel}:{file_sha}\n".encode("utf-8"))

    return {
        "git_base_commit": _git_commit(repo_root),
        "git_working_tree_dirty": _git_is_dirty(repo_root),
        "pipeline_fingerprint_sha256": combined.hexdigest(),
        "pipeline_file_count": len(file_entries),
        "pipeline_files": file_entries,
        "pipeline_version": PIPELINE_VERSION,
        "parser_version": PARSER_VERSION,
        "python_version": platform.python_version(),
    }


def _build_station_inventory(raw_root: Path) -> dict[str, Any]:
    pomba_inv_path = raw_root / "ana" / "inventory" / "rio_pomba_telemetric.xml"
    plu_inv_path = raw_root / "ana" / "inventory" / "padua_pluviometers.xml"

    ana_by_code: dict[str, dict[str, str]] = {}
    pomba_rows: list[dict[str, str]] = []
    if pomba_inv_path.exists():
        pomba_rows = parse_ana_inventory_xml(pomba_inv_path.read_bytes())
        for r in pomba_rows:
            if r.get("Codigo"):
                ana_by_code[r["Codigo"]] = r

    plu_rows: list[dict[str, str]] = []
    if plu_inv_path.exists():
        plu_rows = parse_ana_inventory_xml(plu_inv_path.read_bytes())
        for r in plu_rows:
            if r.get("Codigo"):
                ana_by_code.setdefault(r["Codigo"], r)

    priority_and_complementary = []
    for st_id, spec in STATIONS.items():
        ana_meta = ana_by_code.get(st_id, {})
        priority_and_complementary.append(
            {
                "code": st_id,
                "name": ana_meta.get("Nome") or spec.name,
                "role": spec.role,
                "coordinates": {
                    "latitude": float(ana_meta["Latitude"]) if ana_meta.get("Latitude") else None,
                    "longitude": float(ana_meta["Longitude"]) if ana_meta.get("Longitude") else None,
                    "crs": "EPSG:4674 (SIRGAS 2000 / WGS84 geographic)"
                    if ana_meta.get("Latitude")
                    else "undocumented_on_endpoint",
                },
                "river": ana_meta.get("RioNome") or spec.river,
                "basin_position": spec.basin_position,
                "institution": spec.institution,
                "operator_sigla": ana_meta.get("OperadoraSigla") or spec.institution,
                "responsible_sigla": ana_meta.get("ResponsavelSigla") or spec.institution,
                "telemetric_period_start_metadata": ana_meta.get("PeriodoTelemetricaInicio") or None,
                "temporal_frequency_nominal_min": spec.nominal_cadence_min,
                "units": {
                    "stage": "cm (INEA raw m normalized to cm)",
                    "discharge": "m3/s" if st_id != "INEA-213042120" else None,
                    "rainfall": "mm",
                },
                "gauge_reference": spec.gauge_reference_id,
                "gauge_zero_m": spec.gauge_zero_m,
                "vertical_datum": spec.vertical_datum,
                "license": spec.license_summary,
                "consumption_and_redistribution": spec.redistribution_policy,
                "notes": spec.notes,
            }
        )

    padua_pluviometers = [
        {
            "code": r.get("Codigo"),
            "name": r.get("Nome"),
            "municipality": r.get("nmMunicipio"),
            "operator": r.get("OperadoraSigla"),
            "telemetric": r.get("TipoEstacaoTelemetrica") == "1",
            "operating": r.get("Operando") == "1",
            "latitude": float(r["Latitude"]) if r.get("Latitude") else None,
            "longitude": float(r["Longitude"]) if r.get("Longitude") else None,
            "scale_start": r.get("PeriodoEscalaInicio") or None,
            "telemetric_start": r.get("PeriodoTelemetricaInicio") or None,
        }
        for r in plu_rows
    ]

    return {
        "schema_version": 1,
        "stations": priority_and_complementary,
        "padua_pluviometers_inventory": padua_pluviometers,
        "rio_pomba_telemetric_station_count": len(pomba_rows),
    }


def _build_source_access_audit() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "audit_date": "2026-11-25",
        "sources": [
            {
                "id": "ana-soap-telemetriaws1",
                "institution": "ANA (Agência Nacional de Águas e Saneamento Básico)",
                "endpoint": "https://telemetriaws1.ana.gov.br/ServiceANA.asmx",
                "methods_tested": ["HidroInventario", "DadosHidrometeorologicos", "HidroSerieHistorica"],
                "access_status": "accessible_public",
                "evidence": "HTTP 200 XML diffgram; 90-day chunks return 15-min/1-h records for 58790002, 58788600, 58770000 and daily Cotas for 58790002.",
                "limitations": "Sequential low-rate requests required; no built-in gauge-zero metadata on telemetry rows; 58788600 exhibits sensor flatline episodes.",
                "next_action": "GO for offline historical dataset pipeline; cite ANA/SGB-CPRM.",
            },
            {
                "id": "inea-alerta-cheias-xml",
                "institution": "INEA (Instituto Estadual do Ambiente - RJ)",
                "endpoint": "https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.xml",
                "access_status": "partially_accessible_rolling_10d_only",
                "evidence": "HTTP 200 XML (<estacao codigo='213042120' tipo='Plu/Flu'>) with 960 records (~10 days at 15 min).",
                "limitations": "Rolling 10-day window only; no multi-year archive exposed; uses 'Dado Nulo' sentinel; scale differs from RHN 58790002.",
                "next_action": "NO-GO for historical series or direct SGB mapping; request historical export & datum metadata from INEA.",
            },
            {
                "id": "ana-hidrowebservice-snirh-rest",
                "institution": "ANA / SNIRH",
                "endpoint": "https://www.snirh.gov.br/hidroweb/rest/api/estacao & https://www.ana.gov.br/hidrowebservice/",
                "access_status": "blocked_auth_and_503",
                "evidence": "SNIRH REST returned HTTP 401 ('Token de Autenticação da API Inexistente ou mal Formatado'); ana.gov.br/hidrowebservice returned HTTP 503 during audit.",
                "limitations": "Requires formal institutional credential registration via hidro@ana.gov.br / telemetria@ana.gov.br (60-min OAuth token).",
                "next_action": "Submit formal access request (template in docs/experiments/HIDROWEBSERVICE_ACCESS_REQUEST.md).",
            },
            {
                "id": "sgb-sace-pomba-web",
                "institution": "SGB / CPRM",
                "endpoint": "https://sace.sgb.gov.br/bacia_pomba/",
                "access_status": "blocked_connection_reset_and_no_bulk_api",
                "evidence": "TLS connection reset (WinError 10054) on redirect during probe; SGB operational monitoring uses RHN stations accessible via ANA.",
                "limitations": "No public machine-readable multi-year series API verified on SACE.",
                "next_action": "Use SGB RIGeo reports as official reference and ANA/RHN for station time series.",
            },
        ],
    }


def verify_manifest(repo_root: Path) -> bool:
    """Verify SHA-256 and byte sizes of all artifacts recorded in run_manifest.json."""
    manifest_path = repo_root / "data" / "metadata" / "hydrology" / "run_manifest.json"
    if not manifest_path.exists():
        print(f"Manifest not found: {manifest_path}", file=sys.stderr)
        return False
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    failures = 0
    checked = 0
    for section in ("raw_inputs", "processed_outputs", "metadata_outputs"):
        for item in manifest.get(section, []):
            rel = item.get("relative_path")
            if not rel:
                continue
            target = repo_root / rel
            if not target.exists():
                print(f"MISSING [{section}]: {rel}", file=sys.stderr)
                failures += 1
                continue
            actual_sha = sha256_file(target)
            actual_size = target.stat().st_size
            if actual_sha != item["sha256"] or actual_size != item["bytes"]:
                print(
                    f"MISMATCH [{section}]: {rel} expected=({item['sha256']},{item['bytes']}) "
                    f"actual=({actual_sha},{actual_size})",
                    file=sys.stderr,
                )
                failures += 1
            else:
                checked += 1
    if failures:
        print(f"Manifest verification FAILED: {failures} error(s), {checked} OK", file=sys.stderr)
        return False
    print(f"Manifest verification PASSED: {checked} artifacts verified.")
    return True


def run_pipeline(
    repo_root: Path,
    *,
    mode: str = "full",
    start_date: str = DEFAULT_START_DATE,
    end_date: str = DEFAULT_END_DATE,
    skip_existing: bool = True,
) -> dict[str, Any]:
    """Execute full (acquire + analyze) or offline (from raw/) reproducible pipeline."""
    raw_root = repo_root / "data" / "raw" / "hydrology"
    proc_root = repo_root / "data" / "processed" / "hydrology"
    meta_root = repo_root / "data" / "metadata" / "hydrology"
    proc_root.mkdir(parents=True, exist_ok=True)
    meta_root.mkdir(parents=True, exist_ok=True)

    if mode == "full":
        acq_index = acquire_all(
            repo_root,
            start_date=start_date,
            end_date=end_date,
            skip_existing=skip_existing,
        )
    else:
        index_path = raw_root / "acquisition_index.json"
        if not index_path.exists():
            raise FileNotFoundError(
                f"Offline mode requires existing {index_path}. Run --mode full first."
            )
        acq_index = json.loads(index_path.read_text(encoding="utf-8"))

    # Parse all raw artifacts deterministically
    raw_records_by_station: dict[str, list[dict[str, Any]]] = {st: [] for st in STATIONS}
    raw_inputs_manifest: list[dict[str, Any]] = []

    for item in acq_index.get("artifacts", []):
        rel_from_raw = item["relative_path"]
        raw_file = raw_root / rel_from_raw
        if not raw_file.exists():
            raise FileNotFoundError(f"Missing raw artifact referenced in index: {raw_file}")
        file_bytes = raw_file.read_bytes()
        actual_sha = sha256_file(raw_file)
        raw_inputs_manifest.append(
            {
                "relative_path": f"data/raw/hydrology/{rel_from_raw}",
                "station_id": item["station_id"],
                "dataset_kind": item["dataset_kind"],
                "source_url": item["source_url"],
                "retrieved_at": item["retrieved_at"],
                "bytes": len(file_bytes),
                "sha256": actual_sha,
            }
        )

        st_id = item["station_id"]
        kind = item["dataset_kind"]
        if kind == "telemetric_series":
            spec = STATIONS[st_id]
            raw_records_by_station[st_id].extend(
                parse_ana_telemetric_xml(
                    file_bytes,
                    spec,
                    source_url=item["source_url"],
                    retrieved_at=item["retrieved_at"],
                    source_hash_sha256=actual_sha,
                )
            )
        elif kind == "conventional_cotas":
            spec = STATIONS[st_id]
            raw_records_by_station[st_id].extend(
                parse_ana_conventional_stage_xml(
                    file_bytes,
                    spec,
                    source_url=item["source_url"],
                    retrieved_at=item["retrieved_at"],
                    source_hash_sha256=actual_sha,
                )
            )
        elif kind == "telemetric_10d_snapshot":
            spec = STATIONS[st_id]
            raw_records_by_station[st_id].extend(
                parse_inea_xml(
                    file_bytes,
                    spec,
                    source_url=item["source_url"],
                    retrieved_at=item["retrieved_at"],
                    source_hash_sha256=actual_sha,
                )
            )

    # Normalize, deduplicate, sort
    normalized_by_station: dict[str, list[dict[str, Any]]] = {}
    norm_stats_by_station: dict[str, dict[str, int]] = {}
    for st_id, recs in sorted(raw_records_by_station.items()):
        resolved, _, stats = deduplicate_and_sort(recs)
        normalized_by_station[st_id] = resolved
        norm_stats_by_station[st_id] = stats

    # Quality control (also tags flatline flags in-place on stage_cm records)
    quality_report = build_quality_report(normalized_by_station, norm_stats_by_station)

    # Persist normalized station CSVs (after QC tagging so flatlines are visible in CSV!)
    processed_manifest: list[dict[str, Any]] = []
    for st_id, recs in sorted(normalized_by_station.items()):
        out_csv = proc_root / f"{st_id}_normalized.csv"
        write_normalized_csv(recs, out_csv)
        processed_manifest.append(
            {
                "relative_path": f"data/processed/hydrology/{st_id}_normalized.csv",
                "record_count": len(recs),
                "bytes": out_csv.stat().st_size,
                "sha256": sha256_file(out_csv),
            }
        )

    # Candidate flood events
    events_report = extract_candidate_events(normalized_by_station)

    # Hourly alignment & feasibility / exploratory pilot
    aligned_rows = build_aligned_hourly_rows(normalized_by_station)
    aligned_csv = proc_root / "aligned_hourly_rio_pomba.csv"
    write_aligned_hourly_csv(aligned_rows, aligned_csv)
    processed_manifest.append(
        {
            "relative_path": "data/processed/hydrology/aligned_hourly_rio_pomba.csv",
            "record_count": len(aligned_rows),
            "bytes": aligned_csv.stat().st_size,
            "sha256": sha256_file(aligned_csv),
        }
    )

    feasibility_report = evaluate_feasibility(aligned_rows, events_report)

    # Write versioned JSON metadata reports (deterministic formatting)
    station_inventory = _build_station_inventory(raw_root)
    source_audit = _build_source_access_audit()

    meta_files = {
        "station_inventory.json": station_inventory,
        "source_access_audit.json": source_audit,
        "quality_report.json": quality_report,
        "candidate_events.json": events_report,
        "feasibility_pilot_report.json": feasibility_report,
    }
    metadata_manifest: list[dict[str, Any]] = []
    for fname, payload in meta_files.items():
        fpath = meta_root / fname
        fpath.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        metadata_manifest.append(
            {
                "relative_path": f"data/metadata/hydrology/{fname}",
                "bytes": fpath.stat().st_size,
                "sha256": sha256_file(fpath),
            }
        )

    code_identity = compute_code_identity(repo_root)
    manifest = {
        "schema_version": 2,
        "pipeline_version": PIPELINE_VERSION,
        "parser_version": PARSER_VERSION,
        "mode": mode,
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "git_commit": code_identity["git_base_commit"],
        "code_identity": code_identity,
        "environment": {
            "python_version": platform.python_version(),
            "platform": platform.platform(),
            "dependencies": "pure-python-stdlib",
        },
        "parameters": {
            "start_date": acq_index.get("start_date", start_date),
            "end_date": acq_index.get("end_date", end_date),
            "calibration_end_utc": CALIBRATION_END_UTC,
            "evaluation_start_utc": EVALUATION_START_UTC,
            "event_threshold_cm": 240.0,
            "flatline_min_hours": 24.0,
        },
        "raw_inputs": raw_inputs_manifest,
        "processed_outputs": processed_manifest,
        "metadata_outputs": metadata_manifest,
    }
    manifest_path = meta_root / "run_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Pádua FloodSim historical hydrology pipeline")
    parser.add_argument("--mode", choices=["full", "offline"], default="offline")
    parser.add_argument("--start-date", default=DEFAULT_START_DATE)
    parser.add_argument("--end-date", default=DEFAULT_END_DATE)
    parser.add_argument("--force-download", action="store_true")
    parser.add_argument("--verify-manifest", action="store_true")
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Verify SHA-256 and byte sizes in existing run_manifest.json without re-running or overwriting it",
    )
    parser.add_argument(
        "--repo-root",
        default=str(Path(__file__).resolve().parents[3]),
        help="Repository root directory",
    )
    args = parser.parse_args(argv)
    repo_root = Path(args.repo_root).resolve()

    if args.verify_only:
        return 0 if verify_manifest(repo_root) else 1

    if args.verify_manifest and args.mode == "offline":
        run_pipeline(
            repo_root,
            mode="offline",
            start_date=args.start_date,
            end_date=args.end_date,
            skip_existing=True,
        )
        ok = verify_manifest(repo_root)
        return 0 if ok else 1

    run_pipeline(
        repo_root,
        mode=args.mode,
        start_date=args.start_date,
        end_date=args.end_date,
        skip_existing=not args.force_download,
    )
    if args.verify_manifest:
        ok = verify_manifest(repo_root)
        return 0 if ok else 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
