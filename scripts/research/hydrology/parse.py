"""Deterministic offline XML parsers for ANA SOAP and INEA Alerta de Cheias payloads."""

from __future__ import annotations

import calendar
import math
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Any

from .config import PARSER_VERSION, StationSpec, parse_local_timestamp

_MISSING_TOKENS = frozenset({"", "dado nulo", "null", "na", "n/a", "-", "--", "---", "nan"})


def parse_numeric_value(raw_val: str | None) -> tuple[float | None, list[str]]:
    """Parse a numeric string (handling comma decimals); preserve 0.0 and detect missing/invalid."""
    if raw_val is None:
        return None, ["missing"]
    cleaned = raw_val.strip()
    if cleaned.lower() in _MISSING_TOKENS:
        return None, ["missing"]
    normalized = cleaned.replace(",", ".")
    try:
        val = float(normalized)
    except ValueError:
        return None, ["invalid_number"]
    if not math.isfinite(val):
        return None, ["invalid_number"]
    return val, []


def _extract_ana_diffgram_rows(xml_bytes: bytes) -> list[dict[str, str]]:
    """Extract row dicts from an ANA .NET DataSet/DataTable diffgram XML payload."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        raise ValueError(f"Malformed ANA XML payload: {exc}") from exc

    rows: list[dict[str, str]] = []
    found_diffgram = False
    for elem in root.iter():
        if elem.tag.endswith("diffgram"):
            found_diffgram = True
            for dataset in elem:
                for row_elem in dataset:
                    row: dict[str, str] = {}
                    for col in row_elem:
                        key = col.tag.split("}")[-1]
                        row[key] = col.text.strip() if col.text else ""
                    rows.append(row)
    if not found_diffgram and not root.tag.endswith(("DataSet", "DataTable")):
        raise ValueError(f"Unexpected ANA XML root element: {root.tag}")
    return rows


def parse_ana_inventory_xml(xml_bytes: bytes) -> list[dict[str, str]]:
    """Parse ANA HidroInventario XML into normalized station metadata dictionaries."""
    return _extract_ana_diffgram_rows(xml_bytes)


def _make_record(
    *,
    classification: str,
    provider: str,
    station_id: str,
    station_name: str,
    variable: str,
    ts_original: str,
    ts_local_iso: str,
    ts_utc_iso: str,
    retrieved_at: str,
    val_original: str,
    unit_original: str,
    val_normalized: float | None,
    unit_normalized: str,
    spec: StationSpec,
    source_url: str,
    quality_flags: list[str],
    revision_status: str,
    source_hash_sha256: str,
) -> dict[str, Any]:
    return {
        "classification": classification,
        "provider": provider,
        "station_id": station_id,
        "station_name": station_name,
        "variable": variable,
        "timestamp_original": ts_original,
        "timestamp_local_iso": ts_local_iso,
        "timestamp_utc_iso": ts_utc_iso,
        "retrieved_at": retrieved_at,
        "value_original": val_original,
        "unit_original": unit_original,
        "value_normalized": val_normalized,
        "unit_normalized": unit_normalized,
        "gauge_reference_id": spec.gauge_reference_id or "",
        "gauge_zero_m": "" if spec.gauge_zero_m is None else f"{spec.gauge_zero_m:.3f}",
        "vertical_datum": spec.vertical_datum or "",
        "source_url": source_url,
        "quality_flags": sorted(set(quality_flags)),
        "revision_status": revision_status,
        "parser_version": PARSER_VERSION,
        "source_hash_sha256": source_hash_sha256,
    }


def parse_ana_telemetric_xml(
    xml_bytes: bytes,
    spec: StationSpec,
    *,
    source_url: str,
    retrieved_at: str,
    source_hash_sha256: str,
    classification: str = "observed",
) -> list[dict[str, Any]]:
    """Parse ANA DadosHidrometeorologicos XML into canonical stage, discharge, and rainfall records."""
    rows = _extract_ana_diffgram_rows(xml_bytes)
    var_map = (
        ("Nivel", "stage_cm", "cm", "cm", 1.0, False),
        ("Vazao", "discharge_m3s", "m3/s", "m3/s", 1.0, False),
        ("Chuva", "rainfall_mm", "mm", "mm", 1.0, False),
    )

    records: list[dict[str, Any]] = []
    for row in rows:
        row_station = row.get("CodEstacao", "")
        if row_station and row_station != spec.station_id:
            raise ValueError(
                f"Station mismatch in ANA XML: expected {spec.station_id}, found {row_station}"
            )
        raw_ts = row.get("DataHora", "")
        try:
            _, ts_local_iso, ts_utc_iso = parse_local_timestamp(raw_ts, "%Y-%m-%d %H:%M:%S")
            ts_flags: list[str] = []
        except ValueError:
            ts_local_iso = ""
            ts_utc_iso = ""
            ts_flags = ["invalid_timestamp"]

        for xml_col, variable, u_orig, u_norm, scale, allow_negative in var_map:
            raw_val = row.get(xml_col, "")
            val, val_flags = parse_numeric_value(raw_val)
            flags = list(ts_flags) + list(val_flags)
            if ts_flags:
                val = None
            elif val is not None:
                val = val * scale
                if not allow_negative and val < 0:
                    flags.append("suspect_negative")
                    val = None
                elif variable == "stage_cm" and val >= spec.extreme_stage_review_cm:
                    flags.append("extreme_high_preserved")

            records.append(
                _make_record(
                    classification=classification,
                    provider=spec.provider,
                    station_id=spec.station_id,
                    station_name=spec.name,
                    variable=variable,
                    ts_original=raw_ts,
                    ts_local_iso=ts_local_iso,
                    ts_utc_iso=ts_utc_iso,
                    retrieved_at=retrieved_at,
                    val_original=raw_val,
                    unit_original=u_orig,
                    val_normalized=val,
                    unit_normalized=u_norm,
                    spec=spec,
                    source_url=source_url,
                    quality_flags=flags,
                    revision_status="telemetric_raw",
                    source_hash_sha256=source_hash_sha256,
                )
            )
    return records


def parse_ana_conventional_stage_xml(
    xml_bytes: bytes,
    spec: StationSpec,
    *,
    source_url: str,
    retrieved_at: str,
    source_hash_sha256: str,
    classification: str = "observed",
) -> list[dict[str, Any]]:
    """Parse ANA HidroSerieHistorica (tipoDados=1 Cotas) monthly rows into daily records."""
    rows = _extract_ana_diffgram_rows(xml_bytes)
    records: list[dict[str, Any]] = []
    for row in rows:
        raw_month_ts = row.get("DataHora", "")
        if not raw_month_ts:
            continue
        cons_code = row.get("NivelConsistencia", "").strip()
        revision_status = {"1": "raw", "2": "consisted"}.get(cons_code, "unknown")
        try:
            base_dt = datetime.strptime(raw_month_ts, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
        days_in_month = calendar.monthrange(base_dt.year, base_dt.month)[1]

        for day in range(1, 32):
            col = f"Cota{day:02d}"
            raw_val = row.get(col, "")
            if day > days_in_month:
                if raw_val.strip():
                    flags = ["invalid_calendar_day"]
                else:
                    continue
            else:
                flags = []
            ts_orig = f"{base_dt.year:04d}-{base_dt.month:02d}-{day:02d} 07:00:00"
            if "invalid_calendar_day" in flags:
                ts_local_iso, ts_utc_iso = "", ""
                val = None
            else:
                _, ts_local_iso, ts_utc_iso = parse_local_timestamp(ts_orig, "%Y-%m-%d %H:%M:%S")
                val, val_flags = parse_numeric_value(raw_val)
                flags.extend(val_flags)
                if val is not None:
                    if val < 0:
                        flags.append("suspect_negative")
                        val = None
                    elif val >= spec.extreme_stage_review_cm:
                        flags.append("extreme_high_preserved")

            status_flag = row.get(f"Cota{day:02d}Status", "").strip()
            if status_flag and status_flag != "1":
                flags.append(f"ana_status_{status_flag}")

            records.append(
                _make_record(
                    classification=classification,
                    provider="ANA_CONV_COTAS",
                    station_id=spec.station_id,
                    station_name=spec.name,
                    variable="daily_stage_cm",
                    ts_original=ts_orig,
                    ts_local_iso=ts_local_iso,
                    ts_utc_iso=ts_utc_iso,
                    retrieved_at=retrieved_at,
                    val_original=raw_val,
                    unit_original="cm",
                    val_normalized=val,
                    unit_normalized="cm",
                    spec=spec,
                    source_url=source_url,
                    quality_flags=flags,
                    revision_status=revision_status,
                    source_hash_sha256=source_hash_sha256,
                )
            )
    return records


def parse_inea_xml(
    xml_bytes: bytes,
    spec: StationSpec,
    *,
    source_url: str,
    retrieved_at: str,
    source_hash_sha256: str,
    classification: str = "observed",
) -> list[dict[str, Any]]:
    """Parse INEA Alerta de Cheias 10-day XML into stage (m->cm) and distinct rain windows."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        raise ValueError(f"Malformed INEA XML payload: {exc}") from exc

    if root.tag != "estacao":
        raise ValueError(f"Unexpected INEA XML root tag: {root.tag!r}")

    codigo = root.attrib.get("codigo", "").strip()
    if codigo and f"INEA-{codigo}" != spec.station_id:
        raise ValueError(f"INEA station mismatch: expected {spec.station_id}, found INEA-{codigo}")

    field_map = (
        ("nivel_rio_ultimo", "stage_cm", "m", "cm", 100.0),
        ("chuva_ultimo", "rain_interval_15m_mm", "mm", "mm", 1.0),
        ("chuva_1h", "rain_acc_1h_mm", "mm", "mm", 1.0),
        ("chuva_4h", "rain_acc_4h_mm", "mm", "mm", 1.0),
        ("chuva_24h", "rain_acc_24h_mm", "mm", "mm", 1.0),
        ("chuva_96h", "rain_acc_96h_mm", "mm", "mm", 1.0),
        ("chuva_30d", "rain_acc_30d_mm", "mm", "mm", 1.0),
    )

    records: list[dict[str, Any]] = []
    for reg in root.findall(".//registro"):
        raw_ts = (reg.findtext("data_hora") or "").strip()
        st_name = (reg.findtext("nome_estacao") or spec.name).strip()
        try:
            _, ts_local_iso, ts_utc_iso = parse_local_timestamp(raw_ts, "%d/%m/%Y %H:%M")
            ts_flags: list[str] = []
        except ValueError:
            ts_local_iso, ts_utc_iso = "", ""
            ts_flags = ["invalid_timestamp"]

        for xml_tag, variable, u_orig, u_norm, scale in field_map:
            raw_val = (reg.findtext(xml_tag) or "").strip()
            val, val_flags = parse_numeric_value(raw_val)
            flags = list(ts_flags) + list(val_flags)
            if ts_flags:
                val = None
            elif val is not None:
                val = round(val * scale, 4)
                if val < 0:
                    flags.append("suspect_negative")
                    val = None
                elif variable == "stage_cm" and val >= spec.extreme_stage_review_cm:
                    flags.append("extreme_high_preserved")

            records.append(
                _make_record(
                    classification=classification,
                    provider=spec.provider,
                    station_id=spec.station_id,
                    station_name=st_name,
                    variable=variable,
                    ts_original=raw_ts,
                    ts_local_iso=ts_local_iso,
                    ts_utc_iso=ts_utc_iso,
                    retrieved_at=retrieved_at,
                    val_original=raw_val,
                    unit_original=u_orig,
                    val_normalized=val,
                    unit_normalized=u_norm,
                    spec=spec,
                    source_url=source_url,
                    quality_flags=flags,
                    revision_status="inea_10d_raw",
                    source_hash_sha256=source_hash_sha256,
                )
            )
    return records
