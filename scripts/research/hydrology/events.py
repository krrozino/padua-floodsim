"""Candidate hydrological flood event extraction and concurrent upstream coverage analysis."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any


def _parse_utc(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _max_rise_in_window(series: list[tuple[datetime, float]], window_hours: int) -> float | None:
    if len(series) < 2:
        return None
    max_rise: float | None = None
    j = 0
    delta = timedelta(hours=window_hours)
    for i, (t_i, v_i) in enumerate(series):
        while j < i and (t_i - series[j][0]) > delta:
            j += 1
        # Check exact or closest prior points within [t_i - window_hours, t_i)
        best_local: float | None = None
        for k in range(j, i):
            diff = v_i - series[k][1]
            if best_local is None or diff > best_local:
                best_local = diff
        if best_local is not None and (max_rise is None or best_local > max_rise):
            max_rise = best_local
    return round(max_rise, 2) if max_rise is not None else None


def _upstream_window_summary(
    stage_records: list[dict[str, Any]],
    start_dt: datetime,
    end_dt: datetime,
    nominal_cadence_min: int,
) -> dict[str, Any]:
    win_start = start_dt - timedelta(hours=24)
    in_win = [
        r
        for r in stage_records
        if r.get("value_normalized") is not None
        and win_start <= _parse_utc(r["timestamp_utc_iso"]) <= end_dt
    ]
    if not in_win:
        return {
            "available_records": 0,
            "coverage_pct": 0.0,
            "peak_stage_cm": None,
            "peak_utc": None,
            "flatline_records": 0,
            "flatline_pct": 0.0,
            "usable_for_event": False,
        }
    expected = max(1, int(((end_dt - win_start).total_seconds() / 60.0) / nominal_cadence_min) + 1)
    flat_n = sum(1 for r in in_win if "suspect_flatline" in r.get("quality_flags", []))
    peak_rec = max(in_win, key=lambda r: float(r["value_normalized"]))
    cov_pct = min(100.0, round(100.0 * len(in_win) / expected, 2))
    flat_pct = round(100.0 * flat_n / len(in_win), 2)
    return {
        "available_records": len(in_win),
        "coverage_pct": cov_pct,
        "peak_stage_cm": round(float(peak_rec["value_normalized"]), 2),
        "peak_utc": peak_rec["timestamp_utc_iso"],
        "flatline_records": flat_n,
        "flatline_pct": flat_pct,
        "usable_for_event": cov_pct >= 70.0 and flat_pct < 20.0,
    }


def extract_candidate_events(
    station_records: dict[str, list[dict[str, Any]]],
    *,
    threshold_cm: float = 240.0,
    merge_gap_hours: float = 72.0,
) -> dict[str, Any]:
    """Identify candidate flood events on 58790002 (>= attention 240 cm) and inspect upstream health."""
    padua_stage = [
        r
        for r in station_records.get("58790002", [])
        if r["variable"] == "stage_cm" and r.get("value_normalized") is not None
    ]
    padua_rain = [
        r
        for r in station_records.get("58790002", [])
        if r["variable"] == "rainfall_mm" and r.get("value_normalized") is not None
    ]
    brauna_stage = [
        r for r in station_records.get("58788600", []) if r["variable"] == "stage_cm"
    ]
    cataguases_stage = [
        r for r in station_records.get("58770000", []) if r["variable"] == "stage_cm"
    ]

    above = [
        (_parse_utc(r["timestamp_utc_iso"]), float(r["value_normalized"]), r["timestamp_utc_iso"])
        for r in padua_stage
        if float(r["value_normalized"]) >= threshold_cm
    ]
    if not above:
        return {"threshold_cm": threshold_cm, "event_count": 0, "events": []}

    episodes: list[list[tuple[datetime, float, str]]] = [[above[0]]]
    max_gap = timedelta(hours=merge_gap_hours)
    for item in above[1:]:
        if item[0] - episodes[-1][-1][0] <= max_gap:
            episodes[-1].append(item)
        else:
            episodes.append([item])

    padua_series_dt = [
        (_parse_utc(r["timestamp_utc_iso"]), float(r["value_normalized"])) for r in padua_stage
    ]
    rain_series_dt = [
        (_parse_utc(r["timestamp_utc_iso"]), float(r["value_normalized"])) for r in padua_rain
    ]

    events: list[dict[str, Any]] = []
    for idx, ep in enumerate(episodes, start=1):
        start_dt = ep[0][0]
        end_dt = ep[-1][0]
        _, peak_val, peak_iso = max(ep, key=lambda x: x[1])
        dur_h = round((end_dt - start_dt).total_seconds() / 3600.0, 2)

        if peak_val >= 310.0:
            severity = "flood_ge_310cm"
        elif peak_val >= 275.0:
            severity = "alert_ge_275cm"
        else:
            severity = "attention_ge_240cm"

        context_start = start_dt - timedelta(hours=24)
        win_series = [(t, v) for t, v in padua_series_dt if context_start <= t <= end_dt]
        pre_series = [v for t, v in padua_series_dt if context_start <= t < start_dt]
        baseline_cm = round(min(pre_series), 2) if pre_series else round(ep[0][1], 2)

        rain_sum = round(sum(v for t, v in rain_series_dt if context_start <= t <= end_dt), 2)

        brauna_cov = _upstream_window_summary(brauna_stage, start_dt, end_dt, 60)
        cat_cov = _upstream_window_summary(cataguases_stage, start_dt, end_dt, 15)
        n_above = len(ep)
        max_1h = _max_rise_in_window(win_series, 1)
        is_spike_artifact = n_above < 4 or (n_above <= 8 and (max_1h or 0.0) >= 80.0 and cat_cov["peak_stage_cm"] is not None and cat_cov["peak_stage_cm"] < 230.0)
        hydro_class = (
            "suspected_telemetry_spike_artifact"
            if is_spike_artifact
            else "sustained_hydrological_event"
        )

        events.append(
            {
                "event_id": f"EVT-{start_dt.strftime('%Y%m%d')}-{idx:02d}",
                "hydrological_classification": hydro_class,
                "severity_tier_sgb": severity,
                "start_utc": ep[0][2],
                "peak_utc": peak_iso,
                "end_utc": ep[-1][2],
                "readings_above_threshold": n_above,
                "duration_above_threshold_hours": dur_h,
                "peak_stage_cm": round(peak_val, 2),
                "pre_event_min_stage_cm": baseline_cm,
                "max_1h_rise_cm": max_1h,
                "max_6h_rise_cm": _max_rise_in_window(win_series, 6),
                "local_rain_padua_mm": rain_sum,
                "upstream_58788600_brauna": brauna_cov,
                "upstream_58770000_cataguases": cat_cov,
            }
        )

    return {
        "schema_version": 1,
        "target_station_id": "58790002",
        "threshold_cm": threshold_cm,
        "merge_gap_hours": merge_gap_hours,
        "event_count": len(events),
        "sustained_event_count": sum(
            1 for e in events if e["hydrological_classification"] == "sustained_hydrological_event"
        ),
        "suspected_spike_artifact_count": sum(
            1 for e in events if e["hydrological_classification"] == "suspected_telemetry_spike_artifact"
        ),
        "flood_tier_count_ge_310cm": sum(
            1 for e in events if e["severity_tier_sgb"] == "flood_ge_310cm"
        ),
        "events": events,
    }
