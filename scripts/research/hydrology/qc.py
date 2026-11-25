"""Quantitative quality control, flatline detection, conventional cross-check, and overlap metrics."""

from __future__ import annotations

import math
import statistics
from collections import Counter
from datetime import datetime
from typing import Any

from .config import STATIONS


def _parse_utc(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _quantile(sorted_vals: list[float], q: float) -> float:
    if not sorted_vals:
        raise ValueError("Empty sequence for quantile")
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    pos = q * (len(sorted_vals) - 1)
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return sorted_vals[lo]
    frac = pos - lo
    return sorted_vals[lo] * (1.0 - frac) + sorted_vals[hi] * frac


def detect_stage_flatlines(
    stage_records: list[dict[str, Any]],
    *,
    min_duration_hours: float = 24.0,
) -> list[dict[str, Any]]:
    """Detect runs of identical valid stage values lasting >= min_duration_hours and tag records."""
    valid_recs = [r for r in stage_records if r.get("value_normalized") is not None]
    if len(valid_recs) < 2:
        return []

    intervals: list[dict[str, Any]] = []
    run_start_idx = 0

    def close_run(end_idx: int) -> None:
        if end_idx <= run_start_idx:
            return
        start_rec = valid_recs[run_start_idx]
        end_rec = valid_recs[end_idx]
        dur_h = (_parse_utc(end_rec["timestamp_utc_iso"]) - _parse_utc(start_rec["timestamp_utc_iso"])).total_seconds() / 3600.0
        if dur_h >= min_duration_hours:
            for k in range(run_start_idx, end_idx + 1):
                flags = set(valid_recs[k].get("quality_flags", []))
                flags.add("suspect_flatline")
                valid_recs[k]["quality_flags"] = sorted(flags)
            intervals.append(
                {
                    "start_utc": start_rec["timestamp_utc_iso"],
                    "end_utc": end_rec["timestamp_utc_iso"],
                    "duration_hours": round(dur_h, 2),
                    "record_count": end_idx - run_start_idx + 1,
                    "constant_value_cm": start_rec["value_normalized"],
                }
            )

    for idx in range(1, len(valid_recs)):
        prev_val = valid_recs[idx - 1]["value_normalized"]
        cur_val = valid_recs[idx]["value_normalized"]
        step_h = (_parse_utc(valid_recs[idx]["timestamp_utc_iso"]) - _parse_utc(valid_recs[idx - 1]["timestamp_utc_iso"])).total_seconds() / 3600.0
        if cur_val != prev_val or step_h > 6.0:
            close_run(idx - 1)
            run_start_idx = idx
    close_run(len(valid_recs) - 1)
    return intervals


def analyze_variable_series(
    records: list[dict[str, Any]],
    *,
    nominal_cadence_min: int,
    norm_stats: dict[str, int] | None = None,
) -> dict[str, Any]:
    """Compute quantitative QC statistics for a single sorted (station_id, variable) series."""
    if not records:
        return {"total_records": 0}

    valid = [r for r in records if r.get("value_normalized") is not None]
    missing = [r for r in records if "missing" in r.get("quality_flags", [])]
    invalid = [
        r
        for r in records
        if r.get("value_normalized") is None and "missing" not in r.get("quality_flags", [])
    ]

    valid_dts = [_parse_utc(r["timestamp_utc_iso"]) for r in valid]
    steps_min: list[float] = []
    gap_threshold_min = 2.0 * nominal_cadence_min
    gaps: list[dict[str, Any]] = []
    total_missing_hours = 0.0

    for idx in range(1, len(valid_dts)):
        diff_min = (valid_dts[idx] - valid_dts[idx - 1]).total_seconds() / 60.0
        steps_min.append(diff_min)
        if diff_min > gap_threshold_min:
            miss_h = (diff_min - nominal_cadence_min) / 60.0
            total_missing_hours += miss_h
            gaps.append(
                {
                    "start_utc": valid[idx - 1]["timestamp_utc_iso"],
                    "end_utc": valid[idx]["timestamp_utc_iso"],
                    "gap_hours": round(diff_min / 60.0, 2),
                }
            )

    gaps_sorted = sorted(gaps, key=lambda g: g["gap_hours"], reverse=True)
    vals = sorted(float(r["value_normalized"]) for r in valid)

    expected_span_slots = 0
    if len(valid_dts) >= 2:
        span_min = (valid_dts[-1] - valid_dts[0]).total_seconds() / 60.0
        expected_span_slots = int(round(span_min / nominal_cadence_min)) + 1

    # Yearly breakdown
    yearly: dict[str, dict[str, Any]] = {}
    by_year_recs: dict[str, list[dict[str, Any]]] = {}
    for r in records:
        yr = r["timestamp_utc_iso"][:4]
        by_year_recs.setdefault(yr, []).append(r)
    for yr, yr_recs in sorted(by_year_recs.items()):
        yr_valid = [float(r["value_normalized"]) for r in yr_recs if r.get("value_normalized") is not None]
        yr_flat = sum(1 for r in yr_recs if "suspect_flatline" in r.get("quality_flags", []))
        is_leap = int(yr) % 4 == 0 and (int(yr) % 100 != 0 or int(yr) % 400 == 0)
        expected_yr = (366 if is_leap else 365) * (24 * 60 // nominal_cadence_min)
        yearly[yr] = {
            "total_records": len(yr_recs),
            "valid_records": len(yr_valid),
            "expected_slots_full_year": expected_yr,
            "completeness_pct_full_year": round(100.0 * len(yr_valid) / expected_yr, 2) if expected_yr else 0.0,
            "flatline_records": yr_flat,
            "min": round(min(yr_valid), 3) if yr_valid else None,
            "max": round(max(yr_valid), 3) if yr_valid else None,
        }

    top_peaks = [
        {"timestamp_utc": r["timestamp_utc_iso"], "value": r["value_normalized"]}
        for r in sorted(valid, key=lambda x: float(x["value_normalized"]), reverse=True)[:10]
    ]

    step_counter = Counter(round(s, 1) for s in steps_min)
    cadence_sorted = sorted(steps_min)
    return {
        "station_id": records[0]["station_id"],
        "variable": records[0]["variable"],
        "unit": records[0]["unit_normalized"],
        "nominal_cadence_min": nominal_cadence_min,
        "period_start_utc": records[0]["timestamp_utc_iso"],
        "period_end_utc": records[-1]["timestamp_utc_iso"],
        "total_records": len(records),
        "valid_records": len(valid),
        "missing_records": len(missing),
        "invalid_records": len(invalid),
        "completeness_vs_span_pct": round(100.0 * len(valid) / expected_span_slots, 2)
        if expected_span_slots
        else 0.0,
        "observed_cadence_min": {
            "median": round(_quantile(cadence_sorted, 0.5), 2) if cadence_sorted else None,
            "p10": round(_quantile(cadence_sorted, 0.1), 2) if cadence_sorted else None,
            "p90": round(_quantile(cadence_sorted, 0.9), 2) if cadence_sorted else None,
            "top_steps_min": dict(step_counter.most_common(5)),
        },
        "gaps": {
            "threshold_min": gap_threshold_min,
            "gap_count": len(gaps),
            "max_gap_hours": gaps_sorted[0]["gap_hours"] if gaps_sorted else 0.0,
            "total_missing_hours_est": round(total_missing_hours, 2),
            "top_10_largest_gaps": gaps_sorted[:10],
        },
        "distribution": {
            "min": round(vals[0], 3) if vals else None,
            "p50": round(_quantile(vals, 0.5), 3) if vals else None,
            "p95": round(_quantile(vals, 0.95), 3) if vals else None,
            "p99": round(_quantile(vals, 0.99), 3) if vals else None,
            "max": round(vals[-1], 3) if vals else None,
            "extreme_high_preserved_count": sum(
                1 for r in valid if "extreme_high_preserved" in r.get("quality_flags", [])
            ),
            "top_10_peaks": top_peaks,
        },
        "normalization_stats": norm_stats or {},
        "yearly": yearly,
    }


def compare_conventional_vs_telemetric(
    conv_records: list[dict[str, Any]],
    telem_stage_records: list[dict[str, Any]],
) -> dict[str, Any]:
    """Compare conventional daily stage (07:00 BRT = 10:00Z) against telemetric stage to detect gauge shifts."""
    telem_by_ts = {
        r["timestamp_utc_iso"]: float(r["value_normalized"])
        for r in telem_stage_records
        if r.get("value_normalized") is not None
    }
    diffs_by_year: dict[str, list[float]] = {}
    all_diffs: list[float] = []
    for rec in conv_records:
        val = rec.get("value_normalized")
        ts = rec.get("timestamp_utc_iso", "")
        if val is None or ts not in telem_by_ts:
            continue
        diff = telem_by_ts[ts] - float(val)
        all_diffs.append(diff)
        diffs_by_year.setdefault(ts[:4], []).append(diff)

    yearly_summary = {}
    for yr, ds in sorted(diffs_by_year.items()):
        yearly_summary[yr] = {
            "n_days": len(ds),
            "mean_diff_cm": round(statistics.mean(ds), 2),
            "median_diff_cm": round(statistics.median(ds), 2),
            "std_diff_cm": round(statistics.pstdev(ds), 2) if len(ds) > 1 else 0.0,
            "max_abs_diff_cm": round(max(abs(d) for d in ds), 2),
        }

    return {
        "comparison": "telemetric_minus_conventional_07h_BRT",
        "paired_days": len(all_diffs),
        "overall_mean_diff_cm": round(statistics.mean(all_diffs), 2) if all_diffs else None,
        "overall_median_diff_cm": round(statistics.median(all_diffs), 2) if all_diffs else None,
        "overall_std_diff_cm": round(statistics.pstdev(all_diffs), 2) if len(all_diffs) > 1 else None,
        "yearly": yearly_summary,
    }


def compute_pairwise_overlap(
    records_a: list[dict[str, Any]],
    records_b: list[dict[str, Any]],
    *,
    hourly_truncate: bool = False,
) -> dict[str, Any]:
    """Compute exact simultaneous timestamp overlap and exploratory difference diagnostics."""
    def index_map(recs: list[dict[str, Any]]) -> dict[str, float]:
        out: dict[str, float] = {}
        for r in recs:
            v = r.get("value_normalized")
            if v is None:
                continue
            ts = r["timestamp_utc_iso"]
            if hourly_truncate and not ts.endswith(":00:00Z"):
                continue
            out[ts] = float(v)
        return out

    map_a = index_map(records_a)
    map_b = index_map(records_b)
    common = sorted(set(map_a.keys()) & set(map_b.keys()))
    if not common:
        return {"paired_count": 0}

    diffs = [map_a[t] - map_b[t] for t in common]
    xs = [map_a[t] for t in common]
    ys = [map_b[t] for t in common]
    mx = statistics.mean(xs)
    my = statistics.mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den_x = math.sqrt(sum((x - mx) ** 2 for x in xs))
    den_y = math.sqrt(sum((y - my) ** 2 for y in ys))
    r_val = num / (den_x * den_y) if den_x > 0 and den_y > 0 else None

    return {
        "paired_count": len(common),
        "overlap_start_utc": common[0],
        "overlap_end_utc": common[-1],
        "diff_a_minus_b_cm": {
            "mean": round(statistics.mean(diffs), 2),
            "std": round(statistics.pstdev(diffs), 2) if len(diffs) > 1 else 0.0,
            "min": round(min(diffs), 2),
            "max": round(max(diffs), 2),
        },
        "pearson_r_zero_lag": round(r_val, 4) if r_val is not None else None,
    }


def build_quality_report(
    station_records: dict[str, list[dict[str, Any]]],
    norm_stats_by_station: dict[str, dict[str, int]],
) -> dict[str, Any]:
    """Build complete quantitative QC report across all acquired station series."""
    series_summaries: dict[str, Any] = {}
    flatlines_by_station: dict[str, list[dict[str, Any]]] = {}

    for st_id, recs in sorted(station_records.items()):
        spec = STATIONS[st_id]
        by_var: dict[str, list[dict[str, Any]]] = {}
        for r in recs:
            by_var.setdefault(r["variable"], []).append(r)

        if "stage_cm" in by_var:
            flatlines = detect_stage_flatlines(by_var["stage_cm"], min_duration_hours=24.0)
            flatlines_by_station[st_id] = flatlines

        for var_name, var_recs in sorted(by_var.items()):
            cadence = 1440 if var_name == "daily_stage_cm" else spec.nominal_cadence_min
            summary = analyze_variable_series(
                var_recs,
                nominal_cadence_min=cadence,
                norm_stats=norm_stats_by_station.get(st_id),
            )
            if var_name == "stage_cm":
                summary["flatline_episodes_ge_24h"] = flatlines_by_station.get(st_id, [])
            series_summaries[f"{st_id}::{var_name}"] = summary

    # Cross-checks and pairwise overlaps
    padua_stage = [r for r in station_records.get("58790002", []) if r["variable"] == "stage_cm"]
    padua_conv = [r for r in station_records.get("58790002", []) if r["variable"] == "daily_stage_cm"]
    brauna_stage = [r for r in station_records.get("58788600", []) if r["variable"] == "stage_cm"]
    cataguases_stage = [r for r in station_records.get("58770000", []) if r["variable"] == "stage_cm"]
    inea_stage = [r for r in station_records.get("INEA-213042120", []) if r["variable"] == "stage_cm"]

    brauna_valid_nonflat = [
        r for r in brauna_stage if "suspect_flatline" not in r.get("quality_flags", [])
    ]

    inea_overlap = compute_pairwise_overlap(inea_stage, padua_stage, hourly_truncate=False)
    inea_overlap["scientific_note"] = (
        "Exploratory 10-day overlap diagnostic only. Non-constant offset (spread of min..max diffs) "
        "demonstrates that INEA-213042120 and RHN 58790002 are NOT on the same gauge zero. "
        "NO-GO for direct INEA -> SGB spatial mapping without multi-event calibration."
    )

    return {
        "schema_version": 1,
        "series": series_summaries,
        "conventional_vs_telemetric_58790002": compare_conventional_vs_telemetric(
            padua_conv, padua_stage
        ),
        "pairwise_overlaps": {
            "58790002_vs_58788600_hourly_all": compute_pairwise_overlap(
                padua_stage, brauna_stage, hourly_truncate=True
            ),
            "58790002_vs_58788600_hourly_nonflatline": compute_pairwise_overlap(
                padua_stage, brauna_valid_nonflat, hourly_truncate=True
            ),
            "58790002_vs_58770000_15min": compute_pairwise_overlap(
                padua_stage, cataguases_stage, hourly_truncate=False
            ),
            "INEA_213042120_vs_58790002_15min": inea_overlap,
        },
    }
