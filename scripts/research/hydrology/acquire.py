"""Safe, allowlisted, sequential HTTP acquisition for official hydrological sources."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urljoin, urlparse

from .config import (
    ALLOWED_HOSTS,
    ANA_CHUNK_DAYS,
    DEFAULT_END_DATE,
    DEFAULT_START_DATE,
    MAX_REDIRECTS,
    MAX_RESPONSE_BYTES,
    MAX_RETRIES,
    POLITE_DELAY_S,
    REQUEST_TIMEOUT_S,
    RETRY_BACKOFF_BASE_S,
    USER_AGENT,
)

UTC_ISO_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
REDIRECT_STATUS_CODES = frozenset({301, 302, 303, 307, 308})
NON_RETRYABLE_HTTP_CODES = frozenset({400, 401, 403, 404})


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Disable urllib automatic redirects so every hop is validated explicitly."""

    def redirect_request(  # type: ignore[override]
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> None:
        return None


_NO_REDIRECT_OPENER = urllib.request.build_opener(_NoRedirectHandler())


def validate_url(url: str) -> str:
    """Validate URL scheme (https) and exact hostname against ALLOWED_HOSTS."""
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https":
        raise ValueError(f"Blocked non-HTTPS URL scheme: {parsed.scheme!r}")
    hostname = (parsed.hostname or "").lower()
    if not hostname or hostname not in ALLOWED_HOSTS:
        raise ValueError(f"Blocked non-allowlisted host: {hostname!r}")
    return url


def sha256_file(path: Path) -> str:
    """Compute SHA-256 hex digest of a local file deterministically."""
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _validate_declared_length(headers: Any, max_bytes: int) -> None:
    cl_header = headers.get("Content-Length") if headers else None
    if cl_header is None:
        return
    try:
        declared_len = int(cl_header)
    except ValueError as exc:
        raise ValueError(f"Invalid Content-Length header: {cl_header!r}") from exc
    if declared_len > max_bytes:
        raise ValueError(
            f"Declared Content-Length {declared_len} exceeds limit {max_bytes}"
        )


def _stream_to_temp_file(
    resp: Any,
    dest_dir: Path,
    max_bytes: int,
) -> tuple[Path, int, str]:
    fd, tmp_name = tempfile.mkstemp(dir=str(dest_dir), suffix=".part")
    tmp_path = Path(tmp_name)
    digest = hashlib.sha256()
    total_bytes = 0
    try:
        with os.fdopen(fd, "wb") as out:
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    raise ValueError(
                        f"Received payload exceeds max_bytes limit ({total_bytes} > {max_bytes})"
                    )
                digest.update(chunk)
                out.write(chunk)
    except BaseException:
        tmp_path.unlink(missing_ok=True)
        raise
    return tmp_path, total_bytes, digest.hexdigest()


def _resolve_redirect_target(current_url: str, location: str | None) -> str:
    if not location:
        raise ValueError("Redirect response missing Location header")
    next_url = urljoin(current_url, location)
    return validate_url(next_url)


def _open_with_validated_redirects(
    initial_url: str,
    *,
    timeout_s: int,
    max_redirects: int,
    open_fn: Any,
) -> tuple[Any, str]:
    """Open URL while validating scheme and allowlist before following every redirect hop."""
    current_url = validate_url(initial_url)
    for _ in range(max_redirects + 1):
        req = urllib.request.Request(current_url, headers={"User-Agent": USER_AGENT})
        try:
            resp = open_fn(req, timeout=timeout_s)
        except urllib.error.HTTPError as exc:
            if exc.code in REDIRECT_STATUS_CODES:
                location = exc.headers.get("Location") if exc.headers else None
                exc.close()
                current_url = _resolve_redirect_target(current_url, location)
                continue
            raise

        status = getattr(resp, "status", 200)
        if status in REDIRECT_STATUS_CODES:
            location = resp.headers.get("Location") if getattr(resp, "headers", None) else None
            if hasattr(resp, "close"):
                resp.close()
            current_url = _resolve_redirect_target(current_url, location)
            continue

        final_url = resp.geturl() if hasattr(resp, "geturl") else current_url
        if final_url:
            validate_url(final_url)
        return resp, final_url or current_url

    raise ValueError(f"Exceeded maximum redirects ({max_redirects}) for {initial_url}")


def _download_once(
    url: str,
    dest_path: Path,
    *,
    timeout_s: int,
    max_bytes: int,
    max_redirects: int,
    open_fn: Any,
) -> dict[str, Any]:
    resp, final_url = _open_with_validated_redirects(
        url,
        timeout_s=timeout_s,
        max_redirects=max_redirects,
        open_fn=open_fn,
    )
    with resp:
        status = getattr(resp, "status", 200)
        _validate_declared_length(getattr(resp, "headers", None), max_bytes)
        tmp_path, total_bytes, sha256_hex = _stream_to_temp_file(
            resp, dest_path.parent, max_bytes
        )
        try:
            os.replace(tmp_path, dest_path)
        except BaseException:
            tmp_path.unlink(missing_ok=True)
            raise

    retrieved_at = datetime.now(timezone.utc).strftime(UTC_ISO_FORMAT)
    return {
        "url": final_url,
        "dest_path": str(dest_path),
        "retrieved_at": retrieved_at,
        "status_code": status,
        "bytes_received": total_bytes,
        "sha256": sha256_hex,
    }


def safe_download(
    url: str,
    dest_path: Path,
    *,
    timeout_s: int = REQUEST_TIMEOUT_S,
    max_bytes: int = MAX_RESPONSE_BYTES,
    max_retries: int = MAX_RETRIES,
    max_redirects: int = MAX_REDIRECTS,
    opener: Any = None,
) -> dict[str, Any]:
    """Download an allowlisted HTTPS resource with per-hop redirect validation, byte-limit, timeout, and bounded retries."""
    validate_url(url)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    open_fn = opener or _NO_REDIRECT_OPENER.open

    last_err: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            return _download_once(
                url,
                dest_path,
                timeout_s=timeout_s,
                max_bytes=max_bytes,
                max_redirects=max_redirects,
                open_fn=open_fn,
            )
        except urllib.error.HTTPError as exc:
            last_err = exc
            if exc.code in NON_RETRYABLE_HTTP_CODES:
                raise
        except OSError as exc:
            last_err = exc

        if attempt < max_retries:
            time.sleep(RETRY_BACKOFF_BASE_S * (2 ** (attempt - 1)))

    assert last_err is not None
    raise last_err


def verify_reusable_artifact(
    dest_path: Path,
    rel_path: str,
    prior_meta: dict[str, Any] | None,
) -> tuple[str, int]:
    """Verify an existing local raw artifact against its recorded SHA-256 before reuse.

    Fails closed if no prior checksum is recorded or if the file on disk does not match
    the recorded checksum/size, preventing silent acceptance of corrupted local files.
    """
    if not prior_meta or not prior_meta.get("sha256"):
        raise ValueError(
            f"Cannot reuse existing artifact without recorded SHA-256 checksum: {rel_path}"
        )
    actual_sha = sha256_file(dest_path)
    actual_size = dest_path.stat().st_size
    expected_sha = str(prior_meta["sha256"])
    expected_size = prior_meta.get("bytes_received")
    if actual_sha != expected_sha:
        raise ValueError(
            f"Checksum mismatch for existing artifact {rel_path}: "
            f"expected={expected_sha} actual={actual_sha}"
        )
    if expected_size is not None and actual_size != int(expected_size):
        raise ValueError(
            f"Byte-size mismatch for existing artifact {rel_path}: "
            f"expected={expected_size} actual={actual_size}"
        )
    return actual_sha, actual_size


def date_chunks(start_iso: str, end_iso: str, chunk_days: int = ANA_CHUNK_DAYS) -> list[tuple[date, date]]:
    """Split an inclusive ISO date range into deterministic sequential chunks."""
    start = date.fromisoformat(start_iso)
    end = date.fromisoformat(end_iso)
    if end < start:
        raise ValueError(f"end_iso {end_iso} precedes start_iso {start_iso}")
    chunks: list[tuple[date, date]] = []
    cur = start
    while cur <= end:
        nxt = min(end, cur + timedelta(days=chunk_days - 1))
        chunks.append((cur, nxt))
        cur = nxt + timedelta(days=1)
    return chunks


def _ana_url(method: str, params: dict[str, str]) -> str:
    return f"https://telemetriaws1.ana.gov.br/ServiceANA.asmx/{method}?{urlencode(params)}"


def acquire_all(
    repo_root: Path,
    *,
    start_date: str = DEFAULT_START_DATE,
    end_date: str = DEFAULT_END_DATE,
    skip_existing: bool = True,
) -> dict[str, Any]:
    """Acquire official ANA SOAP inventories/series and INEA 10-day snapshot sequentially."""
    raw_root = repo_root / "data" / "raw" / "hydrology"
    raw_root.mkdir(parents=True, exist_ok=True)
    index_path = raw_root / "acquisition_index.json"
    existing_by_rel: dict[str, dict[str, Any]] = {}
    if index_path.exists():
        prior = json.loads(index_path.read_text(encoding="utf-8"))
        for item in prior.get("artifacts", []):
            existing_by_rel[item["relative_path"]] = item

    artifacts: list[dict[str, Any]] = []

    def fetch_item(
        rel_path: str,
        url: str,
        *,
        provider: str,
        station_id: str,
        dataset_kind: str,
        window_start: str | None = None,
        window_end: str | None = None,
    ) -> None:
        dest = raw_root / rel_path
        if skip_existing and dest.exists() and dest.stat().st_size > 0:
            prior_meta = existing_by_rel.get(rel_path)
            sha, size = verify_reusable_artifact(dest, rel_path, prior_meta)
            assert prior_meta is not None
            artifacts.append(
                {
                    "relative_path": rel_path,
                    "provider": provider,
                    "station_id": station_id,
                    "dataset_kind": dataset_kind,
                    "window_start": window_start,
                    "window_end": window_end,
                    "source_url": url,
                    "retrieved_at": prior_meta.get(
                        "retrieved_at",
                        datetime.fromtimestamp(dest.stat().st_mtime, tz=timezone.utc).strftime(
                            UTC_ISO_FORMAT
                        ),
                    ),
                    "bytes_received": size,
                    "sha256": sha,
                    "reused_existing": True,
                }
            )
            return

        meta = safe_download(url, dest)
        artifacts.append(
            {
                "relative_path": rel_path,
                "provider": provider,
                "station_id": station_id,
                "dataset_kind": dataset_kind,
                "window_start": window_start,
                "window_end": window_end,
                "source_url": url,
                "retrieved_at": meta["retrieved_at"],
                "bytes_received": meta["bytes_received"],
                "sha256": meta["sha256"],
                "reused_existing": False,
            }
        )
        time.sleep(POLITE_DELAY_S)

    # 1. ANA Station Inventories (Rio Pomba telemetric + Santo Antônio de Pádua pluviometers)
    fetch_item(
        "ana/inventory/rio_pomba_telemetric.xml",
        _ana_url(
            "HidroInventario",
            {
                "codEstDE": "",
                "codEstATE": "",
                "tpEst": "",
                "nmEst": "",
                "nmRio": "RIO POMBA",
                "codSubBacia": "58",
                "codBacia": "",
                "nmMunicipio": "",
                "nmEstado": "",
                "sgResp": "",
                "sgOper": "",
                "telemetrica": "1",
            },
        ),
        provider="ANA_RHN_SOAP",
        station_id="SUBBACIA_58_RIO_POMBA",
        dataset_kind="inventory",
    )
    fetch_item(
        "ana/inventory/padua_pluviometers.xml",
        _ana_url(
            "HidroInventario",
            {
                "codEstDE": "",
                "codEstATE": "",
                "tpEst": "2",
                "nmEst": "",
                "nmRio": "",
                "codSubBacia": "58",
                "codBacia": "",
                "nmMunicipio": "SANTO ANTÔNIO",
                "nmEstado": "",
                "sgResp": "",
                "sgOper": "",
                "telemetrica": "",
            },
        ),
        provider="ANA_RHN_SOAP",
        station_id="PADUA_PLU",
        dataset_kind="inventory",
    )

    # 2. Telemetric series in 90-day chunks for 58790002, 58788600, 58770000
    chunks = date_chunks(start_date, end_date, ANA_CHUNK_DAYS)
    for st_id in ("58790002", "58788600", "58770000"):
        for c_start, c_end in chunks:
            rel = f"ana/telemetric/{st_id}/{c_start.isoformat()}_{c_end.isoformat()}.xml"
            url = _ana_url(
                "DadosHidrometeorologicos",
                {
                    "codEstacao": st_id,
                    "dataInicio": c_start.strftime("%d/%m/%Y"),
                    "dataFim": c_end.strftime("%d/%m/%Y"),
                },
            )
            fetch_item(
                rel,
                url,
                provider="ANA_RHN_SOAP",
                station_id=st_id,
                dataset_kind="telemetric_series",
                window_start=c_start.isoformat(),
                window_end=c_end.isoformat(),
            )

    # 3. Conventional daily Cotas for 58790002 (cross-check consistency & potential datum shifts)
    fetch_item(
        "ana/conventional/58790002_cotas_2020_2025.xml",
        _ana_url(
            "HidroSerieHistorica",
            {
                "codEstacao": "58790002",
                "dataInicio": "01/01/2020",
                "dataFim": "31/12/2025",
                "tipoDados": "1",
                "nivelConsistencia": "",
            },
        ),
        provider="ANA_RHN_SOAP",
        station_id="58790002",
        dataset_kind="conventional_cotas",
        window_start="2020-01-01",
        window_end="2025-12-31",
    )

    # 4. INEA Alerta de Cheias 10-day XML snapshot for overlap audit
    fetch_item(
        "inea/21304212020_10days_snapshot.xml",
        "https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.xml",
        provider="INEA_ALERTA_CHEIAS",
        station_id="INEA-213042120",
        dataset_kind="telemetric_10d_snapshot",
    )

    index_payload = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).strftime(UTC_ISO_FORMAT),
        "start_date": start_date,
        "end_date": end_date,
        "artifact_count": len(artifacts),
        "artifacts": artifacts,
    }
    index_path.write_text(json.dumps(index_payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return index_payload
