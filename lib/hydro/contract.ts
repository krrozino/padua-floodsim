export type HydroQualityFlag =
  | "missing"
  | "duplicate"
  | "out_of_order"
  | "suspect_range"
  | "stale"
  | "upstream_error"
  | "invalid_timestamp"
  | "invalid_unit"
  | "malformed_payload";

export type HydroObservationStatus =
  | "fresh"
  | "stale"
  | "unavailable"
  | "invalid";

export type HydroProviderId = "inea";

export type RainWindowKey = "15m" | "1h" | "4h" | "24h" | "96h" | "30d";

export interface HydroGaugeReference {
  stationCode: string;
  rhnCode: string | null;
  gaugeZeroMeters: number | null;
  verticalDatum: string | null;
  attentionStageCm: number | null;
  overflowStageCm: number | null;
  crosswalkValidated: false;
}

export interface HydroCoordinates {
  latitude: number;
  longitude: number;
  crs: string;
}

export interface StageObservationRecord {
  classification: "observed";
  provider: HydroProviderId;
  institution: string;
  stationId: string;
  stationName: string;
  riverName: string;
  coordinates: HydroCoordinates | null;
  sourceUrl: string;
  publicPageUrl: string;
  sourceRecordId: string;
  measuredAt: string;
  retrievedAt: string;
  stageCm: number | null;
  unitOriginal: "m" | "cm";
  rawValue: string;
  gaugeReference: HydroGaugeReference;
  qualityFlags: HydroQualityFlag[];
  status: HydroObservationStatus;
  sourceHashSha256: string;
  parserVersion: string;
}

export interface RainObservationRecord {
  classification: "observed";
  provider: HydroProviderId;
  stationId: string;
  sensorId: string;
  window: RainWindowKey;
  windowMinutes: number;
  label: string;
  measuredAt: string;
  retrievedAt: string;
  rainMm: number | null;
  unitOriginal: "mm";
  rawValue: string;
  qualityFlags: HydroQualityFlag[];
  parserVersion: string;
}

export interface ObservedStageTrend {
  direction: "rising" | "falling" | "stable";
  deltaCm: number;
  windowMinutes: number;
  referenceMeasuredAt: string;
}

export interface HydroMonitoringResponse {
  schemaVersion: "1.0";
  classification: "observed";
  status: HydroObservationStatus;
  provider: HydroProviderId;
  institution: string;
  station: {
    stationId: string;
    stationName: string;
    riverName: string;
    coordinates: HydroCoordinates | null;
    publicPageUrl: string;
    sourceUrl: string;
    gaugeReference: HydroGaugeReference;
  };
  measuredAt: string | null;
  retrievedAt: string;
  ageMinutes: number | null;
  freshnessPolicy: {
    expectedCadenceMinutes: number;
    staleAfterMinutes: number;
    cacheTtlSeconds: number;
  };
  latestStage: StageObservationRecord | null;
  recentTrend: ObservedStageTrend | null;
  rainfall: RainObservationRecord[];
  qualityFlags: HydroQualityFlag[];
  message: string;
  scientificDisclaimer: string;
}

const VALID_STATUSES = new Set<string>([
  "fresh",
  "stale",
  "unavailable",
  "invalid",
]);

const VALID_QUALITY_FLAGS = new Set<string>([
  "missing",
  "duplicate",
  "out_of_order",
  "suspect_range",
  "stale",
  "upstream_error",
  "invalid_timestamp",
  "invalid_unit",
  "malformed_payload",
]);

const VALID_RAIN_WINDOWS = new Set<string>([
  "15m",
  "1h",
  "4h",
  "24h",
  "96h",
  "30d",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDateString(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function isValidQualityFlagArray(value: unknown): value is HydroQualityFlag[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === "string" && VALID_QUALITY_FLAGS.has(item),
    )
  );
}

function isValidGaugeReference(value: unknown): value is HydroGaugeReference {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.stationCode) &&
    (value.rhnCode === null || isNonEmptyString(value.rhnCode)) &&
    (value.gaugeZeroMeters === null ||
      (typeof value.gaugeZeroMeters === "number" &&
        Number.isFinite(value.gaugeZeroMeters))) &&
    (value.verticalDatum === null || isNonEmptyString(value.verticalDatum)) &&
    (value.attentionStageCm === null ||
      (typeof value.attentionStageCm === "number" &&
        Number.isFinite(value.attentionStageCm))) &&
    (value.overflowStageCm === null ||
      (typeof value.overflowStageCm === "number" &&
        Number.isFinite(value.overflowStageCm))) &&
    value.crosswalkValidated === false
  );
}

function isValidRainRecord(value: unknown): value is RainObservationRecord {
  if (!isRecord(value)) return false;
  return (
    value.classification === "observed" &&
    value.provider === "inea" &&
    isNonEmptyString(value.stationId) &&
    isNonEmptyString(value.sensorId) &&
    typeof value.window === "string" &&
    VALID_RAIN_WINDOWS.has(value.window) &&
    typeof value.windowMinutes === "number" &&
    Number.isFinite(value.windowMinutes) &&
    value.windowMinutes > 0 &&
    isNonEmptyString(value.label) &&
    isIsoDateString(value.measuredAt) &&
    isIsoDateString(value.retrievedAt) &&
    (value.rainMm === null ||
      (typeof value.rainMm === "number" &&
        Number.isFinite(value.rainMm) &&
        value.rainMm >= 0)) &&
    value.unitOriginal === "mm" &&
    typeof value.rawValue === "string" &&
    isValidQualityFlagArray(value.qualityFlags) &&
    isNonEmptyString(value.parserVersion)
  );
}

/**
 * Runtime contract validator for `/api/hydro/observations` payloads.
 * Fails closed whenever required provenance, timestamps, units, or crosswalk constraints are violated.
 */
export function validateHydroMonitoringResponse(
  value: unknown,
): value is HydroMonitoringResponse {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== "1.0") return false;
  if (value.classification !== "observed") return false;
  if (typeof value.status !== "string" || !VALID_STATUSES.has(value.status)) {
    return false;
  }
  if (value.provider !== "inea" || !isNonEmptyString(value.institution)) {
    return false;
  }
  if (!isIsoDateString(value.retrievedAt)) return false;
  if (!isNonEmptyString(value.message) || !isNonEmptyString(value.scientificDisclaimer)) {
    return false;
  }
  if (!isValidQualityFlagArray(value.qualityFlags)) return false;

  if (!isRecord(value.station)) return false;
  if (
    !isNonEmptyString(value.station.stationId) ||
    !isNonEmptyString(value.station.stationName) ||
    !isNonEmptyString(value.station.riverName) ||
    !isNonEmptyString(value.station.publicPageUrl) ||
    !isNonEmptyString(value.station.sourceUrl) ||
    !isValidGaugeReference(value.station.gaugeReference)
  ) {
    return false;
  }

  if (value.station.coordinates !== null) {
    if (!isRecord(value.station.coordinates)) return false;
    if (
      typeof value.station.coordinates.latitude !== "number" ||
      !Number.isFinite(value.station.coordinates.latitude) ||
      typeof value.station.coordinates.longitude !== "number" ||
      !Number.isFinite(value.station.coordinates.longitude) ||
      !isNonEmptyString(value.station.coordinates.crs)
    ) {
      return false;
    }
  }

  if (!isRecord(value.freshnessPolicy)) return false;
  if (
    typeof value.freshnessPolicy.expectedCadenceMinutes !== "number" ||
    !Number.isFinite(value.freshnessPolicy.expectedCadenceMinutes) ||
    value.freshnessPolicy.expectedCadenceMinutes <= 0 ||
    typeof value.freshnessPolicy.staleAfterMinutes !== "number" ||
    !Number.isFinite(value.freshnessPolicy.staleAfterMinutes) ||
    value.freshnessPolicy.staleAfterMinutes <= 0 ||
    typeof value.freshnessPolicy.cacheTtlSeconds !== "number" ||
    !Number.isFinite(value.freshnessPolicy.cacheTtlSeconds) ||
    value.freshnessPolicy.cacheTtlSeconds <= 0
  ) {
    return false;
  }

  if (!Array.isArray(value.rainfall) || !value.rainfall.every(isValidRainRecord)) {
    return false;
  }

  if (value.status === "unavailable" || value.status === "invalid") {
    return (
      value.latestStage === null &&
      value.measuredAt === null &&
      value.ageMinutes === null &&
      value.recentTrend === null
    );
  }

  // fresh or stale must contain a finite, non-negative stage measurement and valid measuredAt.
  if (!isIsoDateString(value.measuredAt)) return false;
  if (
    typeof value.ageMinutes !== "number" ||
    !Number.isFinite(value.ageMinutes) ||
    value.ageMinutes < 0
  ) {
    return false;
  }

  if (!isRecord(value.latestStage)) return false;
  const stage = value.latestStage;
  if (
    stage.classification !== "observed" ||
    stage.provider !== "inea" ||
    !isNonEmptyString(stage.institution) ||
    !isNonEmptyString(stage.stationId) ||
    !isNonEmptyString(stage.stationName) ||
    !isNonEmptyString(stage.riverName) ||
    !isNonEmptyString(stage.sourceUrl) ||
    !isNonEmptyString(stage.publicPageUrl) ||
    !isNonEmptyString(stage.sourceRecordId) ||
    stage.measuredAt !== value.measuredAt ||
    !isIsoDateString(stage.retrievedAt) ||
    typeof stage.stageCm !== "number" ||
    !Number.isFinite(stage.stageCm) ||
    stage.stageCm < 0 ||
    (stage.unitOriginal !== "m" && stage.unitOriginal !== "cm") ||
    typeof stage.rawValue !== "string" ||
    !isValidGaugeReference(stage.gaugeReference) ||
    !isValidQualityFlagArray(stage.qualityFlags) ||
    stage.status !== value.status ||
    !isNonEmptyString(stage.sourceHashSha256) ||
    !isNonEmptyString(stage.parserVersion)
  ) {
    return false;
  }

  if (value.recentTrend !== null) {
    if (!isRecord(value.recentTrend)) return false;
    const trend = value.recentTrend;
    if (
      (trend.direction !== "rising" &&
        trend.direction !== "falling" &&
        trend.direction !== "stable") ||
      typeof trend.deltaCm !== "number" ||
      !Number.isFinite(trend.deltaCm) ||
      typeof trend.windowMinutes !== "number" ||
      !Number.isFinite(trend.windowMinutes) ||
      trend.windowMinutes <= 0 ||
      !isIsoDateString(trend.referenceMeasuredAt)
    ) {
      return false;
    }
  }

  return true;
}
