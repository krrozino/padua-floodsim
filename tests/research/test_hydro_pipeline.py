"""Deterministic unit and integration tests for the historical hydrology pipeline."""

from __future__ import annotations

import csv
import io
import json
import tempfile
import unittest
from pathlib import Path

from scripts.research.hydrology.acquire import (
    safe_download,
    sha256_file,
    validate_url,
    verify_reusable_artifact,
)
from scripts.research.hydrology.config import STATIONS, parse_local_timestamp
from scripts.research.hydrology.normalize import (
    deduplicate_and_sort,
    read_normalized_csv,
    write_normalized_csv,
)
from scripts.research.hydrology.parse import (
    parse_ana_conventional_stage_xml,
    parse_ana_telemetric_xml,
    parse_inea_xml,
)
from scripts.research.hydrology.events import extract_candidate_events
from scripts.research.hydrology.pilot import build_aligned_hourly_rows, run_exploratory_pilot
from scripts.research.hydrology.pipeline import (
    compute_code_identity,
    run_pipeline,
    verify_manifest,
)
from scripts.research.hydrology.qc import analyze_variable_series, detect_stage_flatlines

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "synthetic"
REPO_ROOT = Path(__file__).resolve().parents[2]


class _FakeHeaders(dict):
    pass


class _FakeResponse:
    def __init__(
        self,
        body: bytes,
        status: int = 200,
        content_length: str | None = None,
        location: str | None = None,
        url: str | None = None,
    ):
        self._buf = io.BytesIO(body)
        self.status = status
        self._url = url
        self.headers = _FakeHeaders()
        if content_length is not None:
            self.headers["Content-Length"] = content_length
        if location is not None:
            self.headers["Location"] = location

    def geturl(self) -> str | None:
        return self._url

    def close(self) -> None:
        return None

    def read(self, n: int = -1) -> bytes:
        return self._buf.read(n)

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *args: object) -> None:
        return None


class HydrologyPipelineTests(unittest.TestCase):
    def test_01_parsing_and_malformed_xml_fails_closed(self) -> None:
        xml_bytes = (FIXTURES / "synthetic_ana_telemetric.xml").read_bytes()
        recs = parse_ana_telemetric_xml(
            xml_bytes,
            STATIONS["58790002"],
            source_url="https://telemetriaws1.ana.gov.br/synthetic",
            retrieved_at="2026-11-25T03:00:00Z",
            source_hash_sha256="deadbeef",
            classification="synthetic",
        )
        self.assertEqual(len(recs), 18)  # 6 rows * 3 variables
        with self.assertRaises(ValueError):
            parse_ana_telemetric_xml(
                b"<broken><xml",
                STATIONS["58790002"],
                source_url="https://telemetriaws1.ana.gov.br/synthetic",
                retrieved_at="2026-11-25T03:00:00Z",
                source_hash_sha256="deadbeef",
                classification="synthetic",
            )

    def test_02_units_zero_vs_missing_and_comma_decimal(self) -> None:
        inea_bytes = (FIXTURES / "synthetic_inea_observations.xml").read_bytes()
        recs = parse_inea_xml(
            inea_bytes,
            STATIONS["INEA-213042120"],
            source_url="https://alertadecheias.inea.rj.gov.br/synthetic.xml",
            retrieved_at="2026-11-25T03:10:00Z",
            source_hash_sha256="cafebabe",
            classification="synthetic",
        )
        by_key = {(r["timestamp_original"], r["variable"]): r for r in recs}

        # 4,17 m -> 417.0 cm
        stage_hi = by_key[("24/11/2026 12:15", "stage_cm")]
        self.assertEqual(stage_hi["unit_original"], "m")
        self.assertEqual(stage_hi["unit_normalized"], "cm")
        self.assertEqual(stage_hi["value_normalized"], 417.0)

        # Legitimate 0.0 stage is preserved (not confused with missing)
        stage_zero = by_key[("24/11/2026 12:00", "stage_cm")]
        self.assertEqual(stage_zero["value_normalized"], 0.0)
        self.assertNotIn("missing", stage_zero["quality_flags"])

        # "Dado Nulo" becomes None with missing flag
        rain_null = by_key[("24/11/2026 12:00", "rain_interval_15m_mm")]
        self.assertIsNone(rain_null["value_normalized"])
        self.assertIn("missing", rain_null["quality_flags"])

        # Distinct rain windows are kept separate
        self.assertEqual(by_key[("24/11/2026 12:15", "rain_acc_24h_mm")]["value_normalized"], 1.2)
        self.assertEqual(by_key[("24/11/2026 12:15", "rain_acc_96h_mm")]["value_normalized"], 4.6)

    def test_03_and_04_timestamps_timezone_and_retrieved_at(self) -> None:
        _, local_iso, utc_iso = parse_local_timestamp("2023-01-08 12:30:00", "%Y-%m-%d %H:%M:%S")
        self.assertTrue(local_iso.endswith("-03:00"))
        self.assertEqual(utc_iso, "2023-01-08T15:30:00Z")

        xml_bytes = (FIXTURES / "synthetic_ana_telemetric.xml").read_bytes()
        recs = parse_ana_telemetric_xml(
            xml_bytes,
            STATIONS["58790002"],
            source_url="https://telemetriaws1.ana.gov.br/synthetic",
            retrieved_at="2026-11-25T03:00:00Z",
            source_hash_sha256="deadbeef",
            classification="synthetic",
        )
        for r in recs:
            self.assertNotEqual(r["timestamp_utc_iso"], r["retrieved_at"])

        resolved, invalid_ts, stats = deduplicate_and_sort(recs)
        self.assertEqual(stats["invalid_timestamp_rejected"], 3)  # 1 invalid row * 3 vars
        self.assertEqual(len(invalid_ts), 3)
        self.assertTrue(all("invalid_timestamp" in r["quality_flags"] for r in invalid_ts))
        self.assertTrue(all(r["timestamp_utc_iso"] for r in resolved))

    def test_05_06_07_08_gaps_duplicates_ordering_and_idempotency(self) -> None:
        xml_bytes = (FIXTURES / "synthetic_ana_telemetric.xml").read_bytes()
        recs = parse_ana_telemetric_xml(
            xml_bytes,
            STATIONS["58790002"],
            source_url="https://telemetriaws1.ana.gov.br/synthetic",
            retrieved_at="2026-11-25T03:00:00Z",
            source_hash_sha256="deadbeef",
            classification="synthetic",
        )
        resolved1, _, stats1 = deduplicate_and_sort(recs)
        self.assertGreater(stats1["out_of_order_input_count"], 0)
        self.assertEqual(stats1["duplicate_exact_collapsed"], 3)  # 1 dup row * 3 vars

        stage_recs = [r for r in resolved1 if r["variable"] == "stage_cm"]
        ts_list = [r["timestamp_utc_iso"] for r in stage_recs]
        self.assertEqual(ts_list, sorted(ts_list))  # Ascending chronological order

        # Gap detection: 10:00 BRT to 12:30 BRT has valid gap > 30 min
        qc = analyze_variable_series(stage_recs, nominal_cadence_min=15, norm_stats=stats1)
        self.assertEqual(qc["gaps"]["gap_count"], 1)
        self.assertGreater(qc["gaps"]["max_gap_hours"], 2.0)

        # Extreme high flood peak 450.0 cm MUST be preserved (never silently filtered)
        self.assertEqual(qc["distribution"]["max"], 450.0)
        self.assertEqual(qc["distribution"]["extreme_high_preserved_count"], 1)

        # Byte-level idempotency across repeated normalization & CSV serialization
        with tempfile.TemporaryDirectory() as tmp:
            p1 = Path(tmp) / "run1.csv"
            p2 = Path(tmp) / "run2.csv"
            write_normalized_csv(resolved1, p1)
            reloaded = read_normalized_csv(p1)
            resolved2, _, _ = deduplicate_and_sort(reloaded)
            write_normalized_csv(resolved2, p2)
            self.assertEqual(sha256_file(p1), sha256_file(p2))

    def test_09_security_allowlist_byte_limit_and_negative_values(self) -> None:
        # Host allowlist must reject non-https and non-allowlisted hosts (incl. substring tricks)
        with self.assertRaises(ValueError):
            validate_url("http://telemetriaws1.ana.gov.br/ServiceANA.asmx")
        with self.assertRaises(ValueError):
            validate_url("https://telemetriaws1.ana.gov.br.evil.example/ServiceANA.asmx")
        validate_url("https://telemetriaws1.ana.gov.br/ServiceANA.asmx")

        # Byte limit enforced on both Content-Length and streamed payload
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "out.xml"
            with self.assertRaises(ValueError):
                safe_download(
                    "https://telemetriaws1.ana.gov.br/test",
                    dest,
                    max_bytes=10,
                    max_retries=1,
                    opener=lambda req, timeout=10: _FakeResponse(b"0123456789ABCDEF"),
                )
            with self.assertRaises(ValueError):
                safe_download(
                    "https://telemetriaws1.ana.gov.br/test",
                    dest,
                    max_bytes=10,
                    max_retries=1,
                    opener=lambda req, timeout=10: _FakeResponse(b"ok", content_length="999"),
                )

        # Negative stage sentinel becomes None + suspect_negative flag
        xml_bytes = (FIXTURES / "synthetic_ana_telemetric.xml").read_bytes()
        recs = parse_ana_telemetric_xml(
            xml_bytes,
            STATIONS["58790002"],
            source_url="https://telemetriaws1.ana.gov.br/synthetic",
            retrieved_at="2026-11-25T03:00:00Z",
            source_hash_sha256="deadbeef",
            classification="synthetic",
        )
        neg_stage = [
            r for r in recs if r["timestamp_original"] == "2023-01-08 12:00:00" and r["variable"] == "stage_cm"
        ][0]
        self.assertIsNone(neg_stage["value_normalized"])
        self.assertIn("suspect_negative", neg_stage["quality_flags"])

    def test_10_revised_records_prefer_consisted(self) -> None:
        conv_bytes = (FIXTURES / "synthetic_ana_conventional_revised.xml").read_bytes()
        recs = parse_ana_conventional_stage_xml(
            conv_bytes,
            STATIONS["58790002"],
            source_url="https://telemetriaws1.ana.gov.br/synthetic_conv",
            retrieved_at="2026-11-25T03:00:00Z",
            source_hash_sha256="beef1234",
            classification="synthetic",
        )
        resolved, _, stats = deduplicate_and_sort(recs)
        jan01 = [r for r in resolved if r["timestamp_utc_iso"] == "2023-01-01T10:00:00Z"][0]
        self.assertEqual(jan01["value_normalized"], 254.0)
        self.assertEqual(jan01["revision_status"], "consisted")
        self.assertIn("revised", jan01["quality_flags"])
        self.assertGreaterEqual(stats["duplicate_conflicts_or_revisions"], 1)

    def test_11_flatline_detection_and_causal_hourly_alignment(self) -> None:
        # Flatline fixture (>= 24h identical value)
        with (FIXTURES / "synthetic_flatline_series.csv").open("r", encoding="utf-8") as fh:
            flat_recs = [
                {
                    "timestamp_utc_iso": row["timestamp_utc_iso"],
                    "value_normalized": float(row["value_normalized"]),
                    "quality_flags": [],
                }
                for row in csv.DictReader(fh)
            ]
        episodes = detect_stage_flatlines(flat_recs, min_duration_hours=24.0)
        self.assertEqual(len(episodes), 1)
        self.assertEqual(episodes[0]["duration_hours"], 30.0)
        self.assertIn("suspect_flatline", flat_recs[0]["quality_flags"])
        self.assertNotIn("suspect_flatline", flat_recs[-1]["quality_flags"])

        # Causal hourly alignment: rainfall at 12:15Z maps to 13:00Z (never 12:00Z -> zero future leakage)
        synthetic_station_recs = {
            "58790002": [
                {
                    "variable": "stage_cm",
                    "timestamp_utc_iso": "2023-01-01T12:00:00Z",
                    "value_normalized": 200.0,
                    "quality_flags": [],
                },
                {
                    "variable": "stage_cm",
                    "timestamp_utc_iso": "2023-01-01T13:00:00Z",
                    "value_normalized": 210.0,
                    "quality_flags": [],
                },
                {
                    "variable": "rainfall_mm",
                    "timestamp_utc_iso": "2023-01-01T12:15:00Z",
                    "value_normalized": 5.5,
                    "quality_flags": [],
                },
            ],
            "58788600": [
                {
                    "variable": "stage_cm",
                    "timestamp_utc_iso": "2023-01-01T12:00:00Z",
                    "value_normalized": 179.0,
                    "quality_flags": ["suspect_flatline"],
                }
            ],
            "58770000": [],
        }
        aligned = build_aligned_hourly_rows(synthetic_station_recs)
        by_ts = {r["timestamp_utc_iso"]: r for r in aligned}
        self.assertIsNone(by_ts["2023-01-01T12:00:00Z"]["padua_rain_1h_mm"])
        self.assertEqual(by_ts["2023-01-01T13:00:00Z"]["padua_rain_1h_mm"], 5.5)
        self.assertEqual(by_ts["2023-01-01T12:00:00Z"]["brauna_stage_flatline"], 1)

    def test_12_and_13_provenance_chronological_split_manifest_and_sgb_isolation(self) -> None:
        # Chronological split test
        aligned = [
            {"timestamp_utc_iso": "2022-12-31T22:00:00Z", "padua_stage_cm": 150.0},
            {"timestamp_utc_iso": "2022-12-31T23:00:00Z", "padua_stage_cm": 155.0},
            {"timestamp_utc_iso": "2023-01-01T00:00:00Z", "padua_stage_cm": 160.0},
            {"timestamp_utc_iso": "2023-01-01T01:00:00Z", "padua_stage_cm": 170.0},
            {"timestamp_utc_iso": "2023-01-01T02:00:00Z", "padua_stage_cm": 180.0},
        ]
        pilot = run_exploratory_pilot(aligned, horizons=(1,))
        self.assertEqual(pilot["evidence_status"], "exploratory")
        self.assertEqual(pilot["horizons"]["+1h"]["all_eval_hours"]["B0_persistence"]["n_pairs"], 1)

        # Manifest tamper detection test
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            meta_dir = root / "data" / "metadata" / "hydrology"
            meta_dir.mkdir(parents=True)
            sample = meta_dir / "sample.json"
            sample.write_text('{"ok": true}\n', encoding="utf-8")
            manifest = {
                "raw_inputs": [],
                "processed_outputs": [],
                "metadata_outputs": [
                    {
                        "relative_path": "data/metadata/hydrology/sample.json",
                        "bytes": sample.stat().st_size,
                        "sha256": sha256_file(sample),
                    }
                ],
            }
            (meta_dir / "run_manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            self.assertTrue(verify_manifest(root))
            sample.write_text('{"ok": false}\n', encoding="utf-8")
            self.assertFalse(verify_manifest(root))

        # Negative test: hydrology research package must never reference SGB flood layers or UI adapters
        hydro_dir = REPO_ROOT / "scripts" / "research" / "hydrology"
        for py_file in hydro_dir.glob("*.py"):
            content = py_file.read_text(encoding="utf-8")
            self.assertNotIn("mancha_santo_antonio_de_padua", content)
            self.assertNotIn("MapServer", content)

    def test_14_candidate_events_distinguish_sustained_vs_spike_artifact(self) -> None:
        recs = {
            "58790002": [
                # Isolated 1-sample telemetry spike (255 cm)
                {"variable": "stage_cm", "timestamp_utc_iso": "2022-04-26T04:15:00Z", "value_normalized": 122.0, "quality_flags": []},
                {"variable": "stage_cm", "timestamp_utc_iso": "2022-04-26T04:30:00Z", "value_normalized": 255.0, "quality_flags": []},
                {"variable": "stage_cm", "timestamp_utc_iso": "2022-04-26T04:45:00Z", "value_normalized": 122.0, "quality_flags": []},
                # Sustained 4+ reading event
                {"variable": "stage_cm", "timestamp_utc_iso": "2023-01-08T10:00:00Z", "value_normalized": 315.0, "quality_flags": []},
                {"variable": "stage_cm", "timestamp_utc_iso": "2023-01-08T10:15:00Z", "value_normalized": 325.0, "quality_flags": []},
                {"variable": "stage_cm", "timestamp_utc_iso": "2023-01-08T10:30:00Z", "value_normalized": 330.0, "quality_flags": []},
                {"variable": "stage_cm", "timestamp_utc_iso": "2023-01-08T10:45:00Z", "value_normalized": 320.0, "quality_flags": []},
            ],
            "58788600": [],
            "58770000": [],
        }
        ev = extract_candidate_events(recs)
        self.assertEqual(ev["event_count"], 2)
        self.assertEqual(ev["suspected_spike_artifact_count"], 1)
        self.assertEqual(ev["sustained_event_count"], 1)
        self.assertEqual(ev["events"][0]["hydrological_classification"], "suspected_telemetry_spike_artifact")
        self.assertEqual(ev["events"][1]["hydrological_classification"], "sustained_hydrological_event")

    def test_15_redirect_validation_downgrade_allowlist_and_hop_limit(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "out.xml"

            # Valid HTTPS redirect within ALLOWED_HOSTS succeeds
            seen_urls: list[str] = []

            def valid_redirect_opener(req: object, timeout: int = 10) -> _FakeResponse:
                full_url = getattr(req, "full_url")
                seen_urls.append(full_url)
                if len(seen_urls) == 1:
                    return _FakeResponse(
                        b"",
                        status=302,
                        location="https://telemetriaws1.ana.gov.br/ServiceANA.asmx/redirected",
                    )
                return _FakeResponse(
                    b"<ok/>",
                    status=200,
                    url="https://telemetriaws1.ana.gov.br/ServiceANA.asmx/redirected",
                )

            meta = safe_download(
                "https://telemetriaws1.ana.gov.br/ServiceANA.asmx/initial",
                dest,
                max_retries=1,
                max_redirects=3,
                opener=valid_redirect_opener,
            )
            self.assertEqual(len(seen_urls), 2)
            self.assertEqual(
                meta["url"],
                "https://telemetriaws1.ana.gov.br/ServiceANA.asmx/redirected",
            )
            self.assertEqual(dest.read_bytes(), b"<ok/>")

            # HTTP downgrade redirect MUST be rejected before following
            with self.assertRaisesRegex(ValueError, "non-HTTPS"):
                safe_download(
                    "https://telemetriaws1.ana.gov.br/ServiceANA.asmx/start",
                    dest,
                    max_retries=1,
                    opener=lambda req, timeout=10: _FakeResponse(
                        b"",
                        status=301,
                        location="http://telemetriaws1.ana.gov.br/ServiceANA.asmx/downgraded",
                    ),
                )

            # Redirect to non-allowlisted host MUST be rejected before following
            with self.assertRaisesRegex(ValueError, "non-allowlisted"):
                safe_download(
                    "https://telemetriaws1.ana.gov.br/ServiceANA.asmx/start",
                    dest,
                    max_retries=1,
                    opener=lambda req, timeout=10: _FakeResponse(
                        b"",
                        status=302,
                        location="https://evil.example.org/payload.xml",
                    ),
                )

            # Redirect loop exceeding max_redirects MUST fail closed
            with self.assertRaisesRegex(ValueError, "Exceeded maximum redirects"):
                safe_download(
                    "https://telemetriaws1.ana.gov.br/ServiceANA.asmx/loop",
                    dest,
                    max_retries=1,
                    max_redirects=2,
                    opener=lambda req, timeout=10: _FakeResponse(
                        b"",
                        status=302,
                        location="https://telemetriaws1.ana.gov.br/ServiceANA.asmx/loop",
                    ),
                )

            # Bounded retry on transient OSError
            attempts = {"n": 0}

            def flaky_opener(req: object, timeout: int = 10) -> _FakeResponse:
                attempts["n"] += 1
                if attempts["n"] < 2:
                    raise TimeoutError("transient timeout")
                return _FakeResponse(b"<recovered/>", status=200)

            meta_retry = safe_download(
                "https://telemetriaws1.ana.gov.br/ServiceANA.asmx/flaky",
                dest,
                max_retries=2,
                opener=flaky_opener,
            )
            self.assertEqual(attempts["n"], 2)
            self.assertEqual(meta_retry["bytes_received"], len(b"<recovered/>"))

    def test_16_reuse_existing_artifact_verifies_recorded_checksum(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            artifact = Path(tmp) / "chunk.xml"
            artifact.write_bytes(b"<xml>original</xml>")
            good_sha = sha256_file(artifact)
            good_meta = {"sha256": good_sha, "bytes_received": artifact.stat().st_size}

            sha, size = verify_reusable_artifact(artifact, "ana/chunk.xml", good_meta)
            self.assertEqual(sha, good_sha)
            self.assertEqual(size, artifact.stat().st_size)

            # Corrupted file on disk MUST fail closed (never silently recompute checksum)
            artifact.write_bytes(b"<xml>corrupted!</xml>")
            with self.assertRaisesRegex(ValueError, "Checksum mismatch"):
                verify_reusable_artifact(artifact, "ana/chunk.xml", good_meta)

            # Existing file without prior recorded checksum MUST fail closed
            with self.assertRaisesRegex(ValueError, "without recorded SHA-256"):
                verify_reusable_artifact(artifact, "ana/chunk.xml", None)

    def test_17_code_identity_fingerprint_is_deterministic_and_non_circular(self) -> None:
        id1 = compute_code_identity(REPO_ROOT)
        id2 = compute_code_identity(REPO_ROOT)
        self.assertEqual(id1["pipeline_fingerprint_sha256"], id2["pipeline_fingerprint_sha256"])
        self.assertEqual(len(id1["pipeline_fingerprint_sha256"]), 64)
        self.assertGreaterEqual(id1["pipeline_file_count"], 8)
        self.assertIn("git_base_commit", id1)
        self.assertIn("git_working_tree_dirty", id1)

        # Synthetic offline run_pipeline produces schema v2 manifest with non-circular code_identity
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            pkg = root / "scripts" / "research" / "hydrology"
            pkg.mkdir(parents=True)
            (pkg / "dummy.py").write_text("VALUE = 1\n", encoding="utf-8")

            raw_dir = root / "data" / "raw" / "hydrology" / "ana" / "telemetric" / "58790002"
            raw_dir.mkdir(parents=True)
            raw_xml = raw_dir / "synthetic.xml"
            raw_xml.write_bytes((FIXTURES / "synthetic_ana_telemetric.xml").read_bytes())
            raw_sha = sha256_file(raw_xml)
            acq_index = {
                "schema_version": 1,
                "start_date": "2023-01-08",
                "end_date": "2023-01-08",
                "artifacts": [
                    {
                        "relative_path": "ana/telemetric/58790002/synthetic.xml",
                        "provider": "ANA_RHN_SOAP",
                        "station_id": "58790002",
                        "dataset_kind": "telemetric_series",
                        "source_url": "https://telemetriaws1.ana.gov.br/synthetic",
                        "retrieved_at": "2026-11-25T03:00:00Z",
                        "bytes_received": raw_xml.stat().st_size,
                        "sha256": raw_sha,
                    }
                ],
            }
            (root / "data" / "raw" / "hydrology" / "acquisition_index.json").write_text(
                json.dumps(acq_index), encoding="utf-8"
            )

            fp_before = compute_code_identity(root)["pipeline_fingerprint_sha256"]
            manifest = run_pipeline(root, mode="offline", start_date="2023-01-08", end_date="2023-01-08")
            fp_after = compute_code_identity(root)["pipeline_fingerprint_sha256"]

            # Writing run_manifest.json must NOT alter the pipeline fingerprint (zero circularity)
            self.assertEqual(fp_before, fp_after)
            self.assertEqual(manifest["code_identity"]["pipeline_fingerprint_sha256"], fp_before)
            self.assertEqual(manifest["schema_version"], 2)
            self.assertTrue(verify_manifest(root))

            # Modifying a pipeline .py file MUST change the fingerprint
            (pkg / "dummy.py").write_text("VALUE = 2\n", encoding="utf-8")
            self.assertNotEqual(
                compute_code_identity(root)["pipeline_fingerprint_sha256"], fp_before
            )


if __name__ == "__main__":
    unittest.main()
