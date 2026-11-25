import type { HydroQualityFlag, ObservedStageTrend } from "./contract.ts";

export const PARSER_VERSION = "inea-xml-v1.0.0";

const MISSING_SENTINELS = new Set([
  "",
  "dado nulo",
  "-",
  "--",
  "null",
  "n/a",
  "n/d",
  "s/d",
  "sem dados",
]);

const DECIMAL_PATTERN = /^[+-]?\d+(?:[.,]\d+)?$/;
const BR_DATETIME_PATTERN =
  /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/;

const MAX_PLAUSIBLE_STAGE_CM = 2000; // 20.00 m upper bound for Rio Pomba at Pádua
const MAX_PLAUSIBLE_RAIN_MM = 1500;
const TREND_TARGET_MS = 60 * 60_000;
const TREND_MIN_MS = 30 * 60_000;
const TREND_MAX_MS = 90 * 60_000;
const TREND_STABLE_THRESHOLD_CM = 2;

export type DecimalParseResult =
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "value"; value: number };

/**
 * Parses numeric text accepting both dot and comma decimals while keeping
 * legitimate zero values (`"0"`, `"0.0"`, `"0,00"`) distinct from missing sentinels.
 */
export function parseDecimalValue(raw: string): DecimalParseResult {
  const trimmed = raw.trim();
  if (MISSING_SENTINELS.has(trimmed.toLowerCase())) {
    return { kind: "missing" };
  }

  if (!DECIMAL_PATTERN.test(trimmed)) {
    return { kind: "invalid" };
  }

  const normalized = trimmed.replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return { kind: "invalid" };
  }

  return { kind: "value", value: parsed };
}

export function convertStageToCm(
  raw: string,
  unit: string,
): { stageCm: number | null; unitValid: boolean; flag?: HydroQualityFlag } {
  if (unit !== "m" && unit !== "cm") {
    return { stageCm: null, unitValid: false, flag: "invalid_unit" };
  }

  const parsed = parseDecimalValue(raw);
  if (parsed.kind === "missing") {
    return { stageCm: null, unitValid: true, flag: "missing" };
  }
  if (parsed.kind === "invalid") {
    return { stageCm: null, unitValid: true, flag: "malformed_payload" };
  }

  const rawCm = unit === "m" ? parsed.value * 100 : parsed.value;
  const stageCm = Math.round(rawCm * 100) / 100;

  if (stageCm < 0 || stageCm > MAX_PLAUSIBLE_STAGE_CM) {
    return { stageCm: null, unitValid: true, flag: "suspect_range" };
  }

  return { stageCm, unitValid: true };
}

export function parseRainMm(
  raw: string,
  unit: string,
): { rainMm: number | null; unitValid: boolean; flag?: HydroQualityFlag } {
  if (unit !== "mm") {
    return { rainMm: null, unitValid: false, flag: "invalid_unit" };
  }

  const parsed = parseDecimalValue(raw);
  if (parsed.kind === "missing") {
    return { rainMm: null, unitValid: true, flag: "missing" };
  }
  if (parsed.kind === "invalid") {
    return { rainMm: null, unitValid: true, flag: "malformed_payload" };
  }

  const rainMm = Math.round(parsed.value * 100) / 100;
  if (rainMm < 0 || rainMm > MAX_PLAUSIBLE_RAIN_MM) {
    return { rainMm: null, unitValid: true, flag: "suspect_range" };
  }

  return { rainMm, unitValid: true };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Parses an INEA local timestamp (`DD/MM/YYYY HH:mm[:ss]`) in `America/Sao_Paulo` (`-03:00`).
 * Rejects impossible calendar dates (e.g. `31/02/2026`) and timestamps far in the future.
 */
export function parseBrazilLocalDateTime(
  raw: string,
  nowMs: number,
  maxFutureSkewMs = 10 * 60_000,
): { iso: string; epochMs: number } | null {
  const match = BR_DATETIME_PATTERN.exec(raw.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] ? Number(match[6]) : 0;

  if (
    year < 2000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  const checkUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    checkUtc.getUTCFullYear() !== year ||
    checkUtc.getUTCMonth() !== month - 1 ||
    checkUtc.getUTCDate() !== day ||
    checkUtc.getUTCHours() !== hour ||
    checkUtc.getUTCMinutes() !== minute ||
    checkUtc.getUTCSeconds() !== second
  ) {
    return null;
  }

  // America/Sao_Paulo has a fixed UTC-03:00 offset since 2019.
  const epochMs = Date.UTC(year, month - 1, day, hour + 3, minute, second);
  if (epochMs > nowMs + maxFutureSkewMs) {
    return null;
  }

  const iso = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}-03:00`;
  return { iso, epochMs };
}

export function evaluateFreshness(
  measuredAtMs: number,
  nowMs: number,
  staleAfterMinutes = 45,
  forceStale = false,
): { status: "fresh" | "stale"; ageMinutes: number } {
  const ageMinutes = Math.max(0, Math.floor((nowMs - measuredAtMs) / 60_000));
  const status = forceStale || ageMinutes > staleAfterMinutes ? "stale" : "fresh";
  return { status, ageMinutes };
}

export interface StageTrendPoint {
  measuredAt: string;
  measuredAtMs: number;
  stageCm: number;
}

/**
 * Computes recent ~1h stage trend only when an earlier valid observation exists
 * between 30 and 90 minutes before the latest observation.
 */
export function computeRecentStageTrend(
  orderedDescValidStages: ReadonlyArray<StageTrendPoint>,
): ObservedStageTrend | null {
  if (orderedDescValidStages.length < 2) return null;

  const latest = orderedDescValidStages[0];
  let bestCandidate: StageTrendPoint | null = null;
  let bestDistanceToTarget = Number.POSITIVE_INFINITY;

  for (let i = 1; i < orderedDescValidStages.length; i += 1) {
    const candidate = orderedDescValidStages[i];
    const diffMs = latest.measuredAtMs - candidate.measuredAtMs;
    if (diffMs < TREND_MIN_MS || diffMs > TREND_MAX_MS) continue;

    const distance = Math.abs(diffMs - TREND_TARGET_MS);
    if (distance < bestDistanceToTarget) {
      bestDistanceToTarget = distance;
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate) return null;

  const deltaCm = Math.round((latest.stageCm - bestCandidate.stageCm) * 100) / 100;
  const windowMinutes = Math.round(
    (latest.measuredAtMs - bestCandidate.measuredAtMs) / 60_000,
  );

  let direction: ObservedStageTrend["direction"] = "stable";
  if (deltaCm >= TREND_STABLE_THRESHOLD_CM) {
    direction = "rising";
  } else if (deltaCm <= -TREND_STABLE_THRESHOLD_CM) {
    direction = "falling";
  }

  return {
    direction,
    deltaCm,
    windowMinutes,
    referenceMeasuredAt: bestCandidate.measuredAt,
  };
}
