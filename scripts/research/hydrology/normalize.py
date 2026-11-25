"""Deterministic normalization, idempotent deduplication, revision resolution, and CSV serialization."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

CSV_FIELDNAMES: tuple[str, ...] = (
    "classification",
    "provider",
    "station_id",
    "station_name",
    "variable",
    "timestamp_original",
    "timestamp_local_iso",
    "timestamp_utc_iso",
    "retrieved_at",
    "value_original",
    "unit_original",
    "value_normalized",
    "unit_normalized",
    "gauge_reference_id",
    "gauge_zero_m",
    "vertical_datum",
    "source_url",
    "quality_flags",
    "revision_status",
    "parser_version",
    "source_hash_sha256",
)

_REVISION_PRIORITY: dict[str, int] = {
    "consisted": 3,
    "raw": 2,
    "telemetric_raw": 2,
    "inea_10d_raw": 2,
    "unknown": 1,
}


def deduplicate_and_sort(
    records: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, int]]:
    """Order records deterministically, detect out-of-order inputs, and collapse/resolve duplicates."""
    valid_ts_records: list[dict[str, Any]] = []
    invalid_ts_records: list[dict[str, Any]] = []

    last_seen_ts: dict[tuple[str, str], str] = {}
    out_of_order_count = 0

    for rec in records:
        ts_utc = rec.get("timestamp_utc_iso", "")
        if not ts_utc:
            invalid_ts_records.append(rec)
            continue
        stream_key = (rec["station_id"], rec["variable"])
        prev_ts = last_seen_ts.get(stream_key)
        flags = list(rec.get("quality_flags", []))
        if prev_ts is not None and ts_utc < prev_ts:
            out_of_order_count += 1
            if "out_of_order_input" not in flags:
                flags.append("out_of_order_input")
        last_seen_ts[stream_key] = ts_utc
        rec_copy = dict(rec)
        rec_copy["quality_flags"] = sorted(set(flags))
        valid_ts_records.append(rec_copy)

    grouped: dict[tuple[str, str, str, str], list[dict[str, Any]]] = {}
    for rec in valid_ts_records:
        key = (
            rec["provider"],
            rec["station_id"],
            rec["variable"],
            rec["timestamp_utc_iso"],
        )
        grouped.setdefault(key, []).append(rec)

    resolved: list[dict[str, Any]] = []
    exact_collapsed = 0
    conflicts_or_revisions = 0

    for key in sorted(grouped.keys()):
        group = grouped[key]
        if len(group) == 1:
            resolved.append(group[0])
            continue

        # Sort candidates by (revision_priority, has_valid_value, retrieved_at) descending
        ranked = sorted(
            group,
            key=lambda r: (
                _REVISION_PRIORITY.get(r.get("revision_status", "unknown"), 0),
                1 if r.get("value_normalized") is not None else 0,
                r.get("retrieved_at", ""),
                r.get("source_hash_sha256", ""),
            ),
            reverse=True,
        )
        winner = dict(ranked[0])
        winner_flags = set(winner.get("quality_flags", []))

        distinct_vals = {r.get("value_normalized") for r in group}
        distinct_revs = {r.get("revision_status") for r in group}
        if len(distinct_vals) == 1 and len(distinct_revs) == 1:
            exact_collapsed += len(group) - 1
            winner_flags.add("duplicate_collapsed")
        else:
            conflicts_or_revisions += len(group) - 1
            if len(distinct_revs) > 1 or any(
                r.get("retrieved_at", "") != winner.get("retrieved_at", "") for r in group[1:]
            ):
                winner_flags.add("revised")
            else:
                winner_flags.add("duplicate_conflict")

        if any("out_of_order_input" in r.get("quality_flags", []) for r in group):
            winner_flags.add("out_of_order_input")

        winner["quality_flags"] = sorted(winner_flags)
        resolved.append(winner)

    resolved.sort(key=lambda r: (r["station_id"], r["variable"], r["timestamp_utc_iso"]))
    stats = {
        "input_total": len(records),
        "valid_timestamp_input": len(valid_ts_records),
        "invalid_timestamp_rejected": len(invalid_ts_records),
        "out_of_order_input_count": out_of_order_count,
        "duplicate_exact_collapsed": exact_collapsed,
        "duplicate_conflicts_or_revisions": conflicts_or_revisions,
        "output_unique_records": len(resolved),
    }
    return resolved, invalid_ts_records, stats


def write_normalized_csv(records: list[dict[str, Any]], dest_path: Path) -> None:
    """Write normalized records deterministically with LF newlines for byte-level idempotency."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with dest_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(CSV_FIELDNAMES), lineterminator="\n")
        writer.writeheader()
        for rec in records:
            row = dict(rec)
            flags = row.get("quality_flags", [])
            if isinstance(flags, (list, tuple, set)):
                row["quality_flags"] = ";".join(sorted(set(flags)))
            val = row.get("value_normalized")
            row["value_normalized"] = "" if val is None else f"{val:.4f}".rstrip("0").rstrip(".")
            if row["value_normalized"] == "-0":
                row["value_normalized"] = "0"
            writer.writerow({k: row.get(k, "") for k in CSV_FIELDNAMES})


def read_normalized_csv(path: Path) -> list[dict[str, Any]]:
    """Read a canonical normalized CSV back into record dicts."""
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            raw_val = row.get("value_normalized", "")
            row_out: dict[str, Any] = dict(row)
            row_out["value_normalized"] = None if raw_val == "" else float(raw_val)
            flags_str = row.get("quality_flags", "")
            row_out["quality_flags"] = [f for f in flags_str.split(";") if f]
            records.append(row_out)
    return records
