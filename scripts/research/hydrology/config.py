"""Configuration, station specifications, allowlists, and timezone helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

PIPELINE_VERSION = "1.0.0"
PARSER_VERSION = "1.0.0"

# Strict host allowlist (exact hostname matching after scheme validation; never substring)
ALLOWED_HOSTS: frozenset[str] = frozenset(
    {
        "telemetriaws1.ana.gov.br",
        "alertadecheias.inea.rj.gov.br",
    }
)

# Security & HTTP transfer limits (Issue #38)
REQUEST_TIMEOUT_S = 25
MAX_RESPONSE_BYTES = 25 * 1024 * 1024  # 25 MiB per HTTP response
MAX_RETRIES = 3
MAX_REDIRECTS = 3
RETRY_BACKOFF_BASE_S = 2.0
POLITE_DELAY_S = 0.4
USER_AGENT = "PaduaFloodSim-ResearchPipeline/1.0 (+https://github.com/krrozino/padua-floodsim)"
RIVER_RIO_POMBA = "Rio Pomba"

# Default historical audit window (covers 2020-2026 including 2022 & 2023 flood events)
DEFAULT_START_DATE = "2020-01-01"
DEFAULT_END_DATE = "2026-11-24"
ANA_CHUNK_DAYS = 90

# Chronological split for exploratory persistence/trend pilot (no random split, no leakage)
CALIBRATION_END_UTC = "2022-12-31T23:59:59Z"
EVALUATION_START_UTC = "2023-01-01T00:00:00Z"
PILOT_HORIZONS_HOURS = tuple(range(1, 11))

# Brazil abolished DST on 2019-04-25; America/Sao_Paulo is fixed UTC-03:00 thereafter.
_DST_ABOLITION_CUTOFF = datetime(2019, 4, 25, 0, 0, 0)
_FIXED_BRT = timezone(timedelta(hours=-3), name="America/Sao_Paulo")
try:
    _CACHED_ZONEINFO: tzinfo | None = ZoneInfo("America/Sao_Paulo")
except ZoneInfoNotFoundError:
    _CACHED_ZONEINFO = None


def get_sao_paulo_tz(naive_dt: datetime) -> tzinfo:
    """Return America/Sao_Paulo tzinfo, falling back safely to fixed UTC-03:00 post-2019-04-25."""
    if _CACHED_ZONEINFO is not None:
        return _CACHED_ZONEINFO
    if naive_dt >= _DST_ABOLITION_CUTOFF:
        return _FIXED_BRT
    raise RuntimeError(
        "tzdata is required to resolve America/Sao_Paulo timestamps prior to 2019-04-25."
    )


def parse_local_timestamp(raw_ts: str, fmt: str) -> tuple[datetime, str, str]:
    """Parse a naive local timestamp in America/Sao_Paulo and return (utc_dt, local_iso, utc_iso)."""
    s = raw_ts.strip()
    if fmt == "%Y-%m-%d %H:%M:%S" and len(s) == 19 and s[10] == " ":
        naive = datetime.fromisoformat(s)
    else:
        naive = datetime.strptime(s, fmt)
    tz = get_sao_paulo_tz(naive)
    local_dt = naive.replace(tzinfo=tz)
    utc_dt = local_dt.astimezone(timezone.utc)
    return utc_dt, local_dt.isoformat(), utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass(frozen=True)
class StationSpec:
    """Static documented metadata and acquisition policy for a hydrological station."""

    station_id: str
    provider: str
    role: str
    name: str
    river: str
    basin_position: str
    institution: str
    nominal_cadence_min: int
    gauge_reference_id: str | None
    gauge_zero_m: float | None
    vertical_datum: str | None
    extreme_stage_review_cm: float
    sgb_thresholds_cm: dict[str, int] | None
    license_summary: str
    redistribution_policy: str
    notes: str


STATIONS: dict[str, StationSpec] = {
    "58790002": StationSpec(
        station_id="58790002",
        provider="ANA_RHN_SOAP",
        role="priority_target",
        name="Santo Antônio de Pádua II",
        river=RIVER_RIO_POMBA,
        basin_position="target_urban_section (drainage area 8,210 km2)",
        institution="ANA / SGB-CPRM",
        nominal_cadence_min=15,
        gauge_reference_id="RHN-58790002",
        gauge_zero_m=79.709,
        vertical_datum="hgeoHNOR_IMBITUBA",
        extreme_stage_review_cm=310.0,
        sgb_thresholds_cm={"attention": 240, "alert": 275, "flood": 310},
        license_summary="Public Brazilian National Hydrometeorological Network (RHN/ANA) telemetry and series; attribution to ANA and SGB-CPRM required.",
        redistribution_policy="Metadata, QC summaries, and manifest checksums versioned in Git; large raw XML/processed CSV kept out of Git per repository policy.",
        notes="Primary urban reference gauge used by SGB 2024 flood study (zero = 79.709 m hgeoHNOR_IMBITUBA).",
    ),
    "58788600": StationSpec(
        station_id="58788600",
        provider="ANA_RHN_SOAP",
        role="priority_upstream",
        name="UHE Barra do Braúna Jusante",
        river=RIVER_RIO_POMBA,
        basin_position="upstream_hydroelectric_tailrace (Recreio/MG)",
        institution="BRAÚNA (UHE Barra do Braúna) via ANA/ANEEL RHN",
        nominal_cadence_min=60,
        gauge_reference_id="RHN-58788600",
        gauge_zero_m=None,
        vertical_datum=None,
        extreme_stage_review_cm=400.0,
        sgb_thresholds_cm=None,
        license_summary="Public RHN telemetric series operated by power-sector concessionaire (BRAÚNA) under Res. ANA/ANEEL; attribution required.",
        redistribution_policy="Keep raw/bulk series out of Git; document signal-quality caveats and flatlines transparently.",
        notes="Referenced by SGB SAH-Pomba 2021/2022 studies as 8h upstream predictor; requires flatline screening.",
    ),
    "58770000": StationSpec(
        station_id="58770000",
        provider="ANA_RHN_SOAP",
        role="complementary_upstream",
        name="Cataguases",
        river=RIVER_RIO_POMBA,
        basin_position="upstream_sgb_reference (Cataguases/MG, drainage area 5,880 km2)",
        institution="ANA / SGB-CPRM",
        nominal_cadence_min=15,
        gauge_reference_id="RHN-58770000",
        gauge_zero_m=None,
        vertical_datum=None,
        extreme_stage_review_cm=500.0,
        sgb_thresholds_cm=None,
        license_summary="Public RHN telemetry operated by SGB-CPRM; attribution to ANA and SGB-CPRM required.",
        redistribution_policy="Metadata and analytical summaries versioned; bulk raw/CSV excluded from Git.",
        notes="Scientifically justified complementary upstream station (SGB-CPRM operated) to evaluate basin travel and cross-check 58788600 flatlines.",
    ),
    "INEA-213042120": StationSpec(
        station_id="INEA-213042120",
        provider="INEA_ALERTA_CHEIAS",
        role="local_audit_overlap_only",
        name="Santo Antônio de Pádua (INEA)",
        river=RIVER_RIO_POMBA,
        basin_position="urban_padua_inea_monitoring",
        institution="INEA (Instituto Estadual do Ambiente - RJ)",
        nominal_cadence_min=15,
        gauge_reference_id="INEA-213042120",
        gauge_zero_m=None,
        vertical_datum=None,
        extreme_stage_review_cm=500.0,
        sgb_thresholds_cm=None,
        license_summary="Public INEA Alerta de Cheias 10-day rolling XML feed; no bulk multi-year archive exposed on endpoint; terms/redistribution for continuous ingestion pending confirmation.",
        redistribution_policy="Do not mirror bulk feeds; store minimal audit snapshot locally in raw/ and publish only summary metrics.",
        notes="URL uses 21304212020.html/.xml while XML attribute reports codigo=213042120. Overflow reported as 5.00 m on INEA scale; NOT equivalent to RHN 58790002.",
    ),
}
