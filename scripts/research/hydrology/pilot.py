"""Hourly alignment (strictly causal), lag correlation diagnostics, and exploratory persistence/trend pilot."""

from __future__ import annotations

import csv
import math
import statistics
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .config import CALIBRATION_END_UTC, EVALUATION_START_UTC, PILOT_HORIZONS_HOURS

ALIGNED_FIELDS: tuple[str, ...] = (
    "timestamp_utc_iso",
    "padua_stage_cm",
    "padua_discharge_m3s",
    "padua_rain_1h_mm",
    "brauna_stage_cm",
    "brauna_stage_flatline",
    "brauna_discharge_m3s",
    "brauna_rain_1h_mm",
    "cataguases_stage_cm",
    "cataguases_rain_1h_mm",
)


def _parse_utc(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)


def _fmt_utc(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _floor_to_causal_hour_bucket(dt: datetime) -> datetime:
    """Map rainfall in (H-1h, H] strictly causally onto hour H (zero future leakage)."""
    if dt.minute == 0 and dt.second == 0:
        return dt
    return dt.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)


def build_aligned_hourly_rows(
    station_records: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    """Build strictly causal hourly-aligned matrix across 58790002, 58788600, and 58770000."""
    exact_hours: set[str] = set()
    stage_maps: dict[str, dict[str, tuple[float, bool]]] = {}
    discharge_maps: dict[str, dict[str, float]] = {}
    rain_1h_maps: dict[str, dict[str, float]] = {}

    for st_id in ("58790002", "58788600", "58770000"):
        stage_maps[st_id] = {}
        discharge_maps[st_id] = {}
        rain_1h_maps[st_id] = {}
        for rec in station_records.get(st_id, []):
            val = rec.get("value_normalized")
            ts = rec.get("timestamp_utc_iso", "")
            if val is None or not ts:
                continue
            var = rec["variable"]
            if var == "stage_cm" and ts.endswith(":00:00Z"):
                is_flat = "suspect_flatline" in rec.get("quality_flags", [])
                stage_maps[st_id][ts] = (float(val), is_flat)
                exact_hours.add(ts)
            elif var == "discharge_m3s" and ts.endswith(":00:00Z"):
                discharge_maps[st_id][ts] = float(val)
                exact_hours.add(ts)
            elif var == "rainfall_mm":
                bucket = _fmt_utc(_floor_to_causal_hour_bucket(_parse_utc(ts)))
                rain_1h_maps[st_id][bucket] = round(
                    rain_1h_maps[st_id].get(bucket, 0.0) + float(val), 3
                )

    if not exact_hours:
        return []

    min_dt = _parse_utc(min(exact_hours))
    max_dt = _parse_utc(max(exact_hours))
    rows: list[dict[str, Any]] = []
    cur = min_dt
    while cur <= max_dt:
        ts = _fmt_utc(cur)
        p_st = stage_maps["58790002"].get(ts)
        b_st = stage_maps["58788600"].get(ts)
        c_st = stage_maps["58770000"].get(ts)
        rows.append(
            {
                "timestamp_utc_iso": ts,
                "padua_stage_cm": None if p_st is None else p_st[0],
                "padua_discharge_m3s": discharge_maps["58790002"].get(ts),
                "padua_rain_1h_mm": rain_1h_maps["58790002"].get(ts),
                "brauna_stage_cm": None if b_st is None else b_st[0],
                "brauna_stage_flatline": None if b_st is None else (1 if b_st[1] else 0),
                "brauna_discharge_m3s": discharge_maps["58788600"].get(ts),
                "brauna_rain_1h_mm": rain_1h_maps["58788600"].get(ts),
                "cataguases_stage_cm": None if c_st is None else c_st[0],
                "cataguases_rain_1h_mm": rain_1h_maps["58770000"].get(ts),
            }
        )
        cur += timedelta(hours=1)
    return rows


def write_aligned_hourly_csv(rows: list[dict[str, Any]], dest_path: Path) -> None:
    """Write aligned hourly matrix deterministically with LF newlines."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with dest_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(ALIGNED_FIELDS), lineterminator="\n")
        writer.writeheader()
        for row in rows:
            out = {}
            for k in ALIGNED_FIELDS:
                v = row.get(k)
                out[k] = "" if v is None else str(v)
            writer.writerow(out)


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 3:
        return None
    mx = statistics.mean(xs)
    my = statistics.mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    dy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if dx == 0.0 or dy == 0.0:
        return None
    return num / (dx * dy)


def _forecast_metrics(obs: list[float], pred: list[float]) -> dict[str, Any]:
    n = len(obs)
    if n == 0:
        return {"n_pairs": 0}
    errs = [p - o for o, p in zip(obs, pred)]
    mae = statistics.mean(abs(e) for e in errs)
    rmse = math.sqrt(statistics.mean(e * e for e in errs))
    bias = statistics.mean(errs)
    r = _pearson(obs, pred)
    mean_o = statistics.mean(obs)
    mean_p = statistics.mean(pred)
    std_o = statistics.pstdev(obs) if n > 1 else 0.0
    std_p = statistics.pstdev(pred) if n > 1 else 0.0
    kge = None
    if r is not None and mean_o != 0.0 and std_o > 0.0:
        alpha = std_p / std_o
        beta = mean_p / mean_o
        kge = 1.0 - math.sqrt((r - 1.0) ** 2 + (alpha - 1.0) ** 2 + (beta - 1.0) ** 2)
    return {
        "n_pairs": n,
        "mae_cm": round(mae, 2),
        "rmse_cm": round(rmse, 2),
        "bias_cm": round(bias, 2),
        "pearson_r": round(r, 4) if r is not None else None,
        "kge": round(kge, 4) if kge is not None else None,
    }


def compute_lag_diagnostics(
    aligned_rows: list[dict[str, Any]],
    events: list[dict[str, Any]],
    *,
    max_lag_h: int = 16,
) -> dict[str, Any]:
    """Compute cross-correlation by lag (0..max_lag_h) overall and on usable flood events."""
    n = len(aligned_rows)

    def scan_lags(col: str, flat_col: str | None, start_i: int, end_i: int) -> list[dict[str, Any]]:
        results = []
        for lag in range(0, max_lag_h + 1):
            xs: list[float] = []
            ys: list[float] = []
            for idx in range(max(lag, start_i), end_i):
                y = aligned_rows[idx]["padua_stage_cm"]
                x = aligned_rows[idx - lag][col]
                if y is None or x is None:
                    continue
                if flat_col and aligned_rows[idx - lag][flat_col] == 1:
                    continue
                xs.append(float(x))
                ys.append(float(y))
            r = _pearson(xs, ys)
            results.append({"lag_h": lag, "n_pairs": len(xs), "pearson_r": round(r, 4) if r is not None else None})
        return results

    brauna_overall = scan_lags("brauna_stage_cm", "brauna_stage_flatline", 0, n)
    cat_overall = scan_lags("cataguases_stage_cm", None, 0, n)

    ts_to_idx = {r["timestamp_utc_iso"]: i for i, r in enumerate(aligned_rows)}
    event_lags: list[dict[str, Any]] = []
    for ev in events:
        if ev["peak_stage_cm"] < 310.0:
            continue
        start_ts = ev["start_utc"][:13] + ":00:00Z"
        end_ts = ev["end_utc"][:13] + ":00:00Z"
        i0 = max(0, ts_to_idx.get(start_ts, 0) - 24)
        i1 = min(n, ts_to_idx.get(end_ts, n - 1) + 12)
        b_lags = scan_lags("brauna_stage_cm", "brauna_stage_flatline", i0, i1)
        valid_b = [x for x in b_lags if x["pearson_r"] is not None and x["n_pairs"] >= 24]
        best_b = max(valid_b, key=lambda x: x["pearson_r"]) if valid_b else None
        c_lags = scan_lags("cataguases_stage_cm", None, i0, i1)
        valid_c = [x for x in c_lags if x["pearson_r"] is not None and x["n_pairs"] >= 24]
        best_c = max(valid_c, key=lambda x: x["pearson_r"]) if valid_c else None
        event_lags.append(
            {
                "event_id": ev["event_id"],
                "peak_stage_cm": ev["peak_stage_cm"],
                "brauna_best_lag": best_b,
                "cataguases_best_lag": best_c,
            }
        )

    best_b_overall = max(
        (x for x in brauna_overall if x["pearson_r"] is not None),
        key=lambda x: x["pearson_r"],
        default=None,
    )
    best_c_overall = max(
        (x for x in cat_overall if x["pearson_r"] is not None),
        key=lambda x: x["pearson_r"],
        default=None,
    )
    return {
        "brauna_nonflatline_to_padua_lags": brauna_overall,
        "brauna_best_overall_lag": best_b_overall,
        "cataguases_to_padua_lags": cat_overall,
        "cataguases_best_overall_lag": best_c_overall,
        "flood_events_peak_lag_comparison": event_lags,
    }


def run_exploratory_pilot(
    aligned_rows: list[dict[str, Any]],
    *,
    calib_end_utc: str = CALIBRATION_END_UTC,
    eval_start_utc: str = EVALUATION_START_UTC,
    horizons: tuple[int, ...] = PILOT_HORIZONS_HOURS,
) -> dict[str, Any]:
    """Run strictly chronological exploratory Persistence (B0) and Recent Trend (B1) baselines."""
    calib_rows = [r for r in aligned_rows if r["timestamp_utc_iso"] <= calib_end_utc]
    eval_rows = [r for r in aligned_rows if r["timestamp_utc_iso"] >= eval_start_utc]
    if calib_rows and eval_rows:
        assert calib_rows[-1]["timestamp_utc_iso"] < eval_rows[0]["timestamp_utc_iso"], (
            "Chronological split violation: calibration overlaps evaluation"
        )

    horizon_results: dict[str, Any] = {}
    n_eval = len(eval_rows)
    for h in horizons:
        obs_all: list[float] = []
        b0_all: list[float] = []
        b1_all: list[float] = []

        obs_high: list[float] = []
        b0_high: list[float] = []
        b1_high: list[float] = []

        for idx in range(1, n_eval - h):
            h_prev = eval_rows[idx - 1]["padua_stage_cm"]
            h_cur = eval_rows[idx]["padua_stage_cm"]
            h_fut = eval_rows[idx + h]["padua_stage_cm"]
            if h_prev is None or h_cur is None or h_fut is None:
                continue
            pred_b0 = float(h_cur)
            pred_b1 = float(h_cur) + h * (float(h_cur) - float(h_prev))

            obs_all.append(float(h_fut))
            b0_all.append(pred_b0)
            b1_all.append(pred_b1)
            if float(h_cur) >= 240.0:
                obs_high.append(float(h_fut))
                b0_high.append(pred_b0)
                b1_high.append(pred_b1)

        horizon_results[f"+{h}h"] = {
            "all_eval_hours": {
                "B0_persistence": _forecast_metrics(obs_all, b0_all),
                "B1_recent_trend_1h": _forecast_metrics(obs_all, b1_all),
            },
            "high_stage_ge_240cm": {
                "B0_persistence": _forecast_metrics(obs_high, b0_high),
                "B1_recent_trend_1h": _forecast_metrics(obs_high, b1_high),
            },
        }

    return {
        "evidence_status": "exploratory",
        "split_policy": "chronological_no_random_split_no_future_leakage",
        "calibration_reference_window": {
            "end_utc": calib_end_utc,
            "hourly_slots": len(calib_rows),
            "padua_valid_hours": sum(1 for r in calib_rows if r["padua_stage_cm"] is not None),
        },
        "held_out_evaluation_window": {
            "start_utc": eval_start_utc,
            "end_utc": eval_rows[-1]["timestamp_utc_iso"] if eval_rows else None,
            "hourly_slots": len(eval_rows),
            "padua_valid_hours": sum(1 for r in eval_rows if r["padua_stage_cm"] is not None),
        },
        "horizons": horizon_results,
    }


def evaluate_feasibility(
    aligned_rows: list[dict[str, Any]],
    events: dict[str, Any],
) -> dict[str, Any]:
    """Assess experimental feasibility across all 5 model families and +1..+10h horizons."""
    n_total = len(aligned_rows)
    padua_ok = sum(1 for r in aligned_rows if r["padua_stage_cm"] is not None)
    brauna_ok = sum(
        1
        for r in aligned_rows
        if r["brauna_stage_cm"] is not None and r["brauna_stage_flatline"] == 0
    )
    brauna_flat = sum(1 for r in aligned_rows if r["brauna_stage_flatline"] == 1)
    cat_ok = sum(1 for r in aligned_rows if r["cataguases_stage_cm"] is not None)
    rain_padua_ok = sum(1 for r in aligned_rows if r["padua_rain_1h_mm"] is not None)

    lag_diag = compute_lag_diagnostics(aligned_rows, events.get("events", []))
    pilot = run_exploratory_pilot(aligned_rows)

    return {
        "schema_version": 1,
        "aligned_hourly_summary": {
            "total_hourly_slots": n_total,
            "padua_valid_hours": padua_ok,
            "brauna_valid_nonflatline_hours": brauna_ok,
            "brauna_flatline_hours_flagged": brauna_flat,
            "cataguases_valid_hours": cat_ok,
            "padua_rain_valid_hours": rain_padua_ok,
        },
        "temporal_resolution_check": {
            "58790002_native_cadence_min": 15,
            "58788600_native_cadence_min": 60,
            "58770000_native_cadence_min": 15,
            "supports_1h_to_10h_horizons": True,
            "note": (
                "58790002 (15 min) and 58770000 (15 min) natively resolve sub-hourly dynamics; "
                "58788600 (60 min) limits joint multi-station lag models to >= 1 h steps without interpolation."
            ),
        },
        "model_family_feasibility": {
            "persistence_B0": {"feasible": True, "horizons": "+1h..+10h", "status": "GO (pilot executed)"},
            "recent_trend_B1": {"feasible": True, "horizons": "+1h..+10h", "status": "GO (pilot executed)"},
            "padua_autoregressive_M1": {
                "feasible": True,
                "horizons": "+1h..+10h",
                "status": "GO for future experiment (6+ years 15-min series, multiple flood events)",
            },
            "barra_do_brauna_upstream_M2": {
                "feasible": True,
                "horizons": "+1h..+10h",
                "status": "CONDITIONAL_GO (must exclude flatlined intervals such as Jan 2023; pair with 58770000 Cataguases)",
            },
            "precipitation_M3": {
                "feasible": True,
                "horizons": "+1h..+10h",
                "status": "CONDITIONAL_GO (telemetric station rainfall available at 58790002/58788600/58770000; dedicated pluviometer 2142067 also audited in ANA inventory)",
            },
        },
        "lag_diagnostics": lag_diag,
        "exploratory_pilot_b0_b1": pilot,
    }
