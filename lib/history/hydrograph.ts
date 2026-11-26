import { getStationReferenceById } from "./catalog.ts";
import type {
  HistoricalSeriesAvailability,
  HistoricalStationId,
  StationThresholdDefinition,
} from "./contract.ts";

export type RawHydrographPoint = {
  readonly timestampUtc: string;
  readonly stageCm: number | null;
  readonly rainMm?: number | null;
  readonly qualityFlag?: "valid" | "adjusted" | "suspect" | "missing";
};

export type ValidatedHydrographPoint = {
  readonly index: number;
  readonly timestampUtc: string;
  readonly epochMs: number;
  readonly stageCm: number;
  readonly rainMm: number | null;
  readonly qualityFlag: "valid" | "adjusted" | "suspect";
};

export type HydrographGap = {
  readonly afterPointIndex: number;
  readonly startUtc: string;
  readonly endUtc: string;
  readonly durationMinutes: number;
};

export type HydrographContiguousSegment = {
  readonly segmentIndex: number;
  readonly points: readonly ValidatedHydrographPoint[];
};

export type PreparedHydrographResult =
  | {
      readonly status: "ready";
      readonly stationId: HistoricalStationId;
      readonly stationName: string;
      readonly nativeStageUnit: "cm" | "m";
      readonly nominalCadenceMinutes: number;
      readonly maxGapThresholdMinutes: number;
      readonly points: readonly ValidatedHydrographPoint[];
      readonly segments: readonly HydrographContiguousSegment[];
      readonly gaps: readonly HydrographGap[];
      readonly minPoint: ValidatedHydrographPoint;
      readonly maxPoint: ValidatedHydrographPoint;
      readonly totalRainMm: number | null;
      readonly hasCompatibleRainfall: boolean;
      readonly stationThresholds: readonly StationThresholdDefinition[];
      readonly startEpochMs: number;
      readonly endEpochMs: number;
    }
  | {
      readonly status: "unavailable";
      readonly reasonCode:
        | "blocked_local_data"
        | "blocked_authorization"
        | "unavailable_source_gap"
        | "insufficient_points_no_fabrication"
        | "invalid_timestamps_or_station";
      readonly message: string;
    };

export type ReplaySpeedMultiplier = 1 | 2 | 4 | 8;

export const ALLOWED_REPLAY_SPEEDS: readonly ReplaySpeedMultiplier[] = [
  1, 2, 4, 8,
];

export type HydrographReplayState = {
  readonly isPlaying: boolean;
  readonly speed: ReplaySpeedMultiplier;
  readonly cursorEpochMs: number;
  readonly activePoint: ValidatedHydrographPoint | null;
  readonly isInsideGap: boolean;
  readonly activeGap: HydrographGap | null;
  readonly atEnd: boolean;
};

function sanitizeRainValue(rainMm: number | null | undefined): number | null {
  if (rainMm === undefined || rainMm === null || !Number.isFinite(rainMm)) {
    return null;
  }
  return rainMm >= 0 ? Math.round(rainMm * 100) / 100 : null;
}

function isOmittableStagePoint(item: RawHydrographPoint): boolean {
  if (item.qualityFlag === "missing" || item.stageCm === null) {
    return true;
  }
  return !Number.isFinite(item.stageCm) || item.stageCm < 0;
}

function parseValidPoints(
  rawPoints: readonly RawHydrographPoint[],
): readonly ValidatedHydrographPoint[] | null {
  const parsed: Omit<ValidatedHydrographPoint, "index">[] = [];

  for (const item of rawPoints) {
    const ms = Date.parse(item.timestampUtc);
    if (!Number.isFinite(ms)) return null;
    if (isOmittableStagePoint(item)) continue;

    parsed.push({
      timestampUtc: new Date(ms).toISOString().replace(".000Z", "Z"),
      epochMs: ms,
      stageCm: Math.round((item.stageCm as number) * 100) / 100,
      rainMm: sanitizeRainValue(item.rainMm),
      qualityFlag:
        item.qualityFlag === "adjusted" || item.qualityFlag === "suspect"
          ? item.qualityFlag
          : "valid",
    });
  }

  parsed.sort((a, b) => a.epochMs - b.epochMs);

  const deduped: Omit<ValidatedHydrographPoint, "index">[] = [];
  for (const pt of parsed) {
    const lastIdx = deduped.length - 1;
    if (lastIdx >= 0 && deduped[lastIdx].epochMs === pt.epochMs) {
      deduped[lastIdx] = pt;
    } else {
      deduped.push(pt);
    }
  }

  return deduped.map((pt, index) => ({ ...pt, index }));
}

function checkAvailabilityGate(
  availability: HistoricalSeriesAvailability,
): Extract<PreparedHydrographResult, { status: "unavailable" }> | null {
  if (availability === "blocked_local_data") {
    return {
      status: "unavailable",
      reasonCode: "blocked_local_data",
      message:
        "BLOCKED_LOCAL_DATA: os arquivos processados de séries contínuas estão armazenados fora do repositório Git e não estão montados neste ambiente cloud.",
    };
  }
  if (availability === "blocked_authorization") {
    return {
      status: "unavailable",
      reasonCode: "blocked_authorization",
      message:
        "Redistribuição pública da série contínua bloqueada até confirmação formal das condições institucionais de uso (#6, #37, #46).",
    };
  }
  if (availability === "unavailable_source_gap") {
    return {
      status: "unavailable",
      reasonCode: "unavailable_source_gap",
      message:
        "Série temporal indisponível na fonte original para este evento (lacuna crítica de memória ou travamento de sensor).",
    };
  }
  return null;
}

function buildSegmentsAndGaps(
  validPoints: readonly ValidatedHydrographPoint[],
  maxGapMs: number,
): {
  readonly segments: readonly HydrographContiguousSegment[];
  readonly gaps: readonly HydrographGap[];
} {
  const segments: HydrographContiguousSegment[] = [];
  const gaps: HydrographGap[] = [];
  let currentBuffer: ValidatedHydrographPoint[] = [validPoints[0]];

  for (let i = 1; i < validPoints.length; i += 1) {
    const prev = validPoints[i - 1];
    const curr = validPoints[i];
    const dtMs = curr.epochMs - prev.epochMs;

    if (dtMs > maxGapMs) {
      segments.push({ segmentIndex: segments.length, points: currentBuffer });
      gaps.push({
        afterPointIndex: prev.index,
        startUtc: prev.timestampUtc,
        endUtc: curr.timestampUtc,
        durationMinutes: Math.round((dtMs / 60000) * 100) / 100,
      });
      currentBuffer = [curr];
    } else {
      currentBuffer.push(curr);
    }
  }
  segments.push({ segmentIndex: segments.length, points: currentBuffer });
  return { segments, gaps };
}

function summarizeExtremesAndRainfall(
  validPoints: readonly ValidatedHydrographPoint[],
): {
  readonly minPoint: ValidatedHydrographPoint;
  readonly maxPoint: ValidatedHydrographPoint;
  readonly totalRainMm: number | null;
  readonly hasCompatibleRainfall: boolean;
} {
  let minPoint = validPoints[0];
  let maxPoint = validPoints[0];
  let rainSum = 0;
  let rainCount = 0;

  for (const pt of validPoints) {
    if (pt.stageCm < minPoint.stageCm) minPoint = pt;
    if (pt.stageCm > maxPoint.stageCm) maxPoint = pt;
    if (pt.rainMm !== null) {
      rainSum += pt.rainMm;
      rainCount += 1;
    }
  }

  return {
    minPoint,
    maxPoint,
    totalRainMm: rainCount > 0 ? Math.round(rainSum * 100) / 100 : null,
    hasCompatibleRainfall: rainCount > 0,
  };
}

/**
 * Prepares a verified time series for hydrograph visualization and temporal replay
 * (Section 6 — Hidrogramas e Replay).
 */
export function prepareHistoricalHydrograph(input: {
  readonly stationId: HistoricalStationId;
  readonly seriesAvailability: HistoricalSeriesAvailability;
  readonly rawPoints: readonly RawHydrographPoint[];
  readonly maxGapMultiplier?: number;
}): PreparedHydrographResult {
  const gateError = checkAvailabilityGate(input.seriesAvailability);
  if (gateError) return gateError;

  const station = getStationReferenceById(input.stationId);
  if (!station?.nominalCadenceMinutes) {
    return {
      status: "unavailable",
      reasonCode: "invalid_timestamps_or_station",
      message: "Estação sem cadência nominal configurada para hidrograma.",
    };
  }

  const validPoints = parseValidPoints(input.rawPoints);
  if (!validPoints) {
    return {
      status: "unavailable",
      reasonCode: "invalid_timestamps_or_station",
      message: "Série contém timestamps inválidos; hidrograma rejeitado.",
    };
  }

  if (validPoints.length < 2) {
    return {
      status: "unavailable",
      reasonCode: "insufficient_points_no_fabrication",
      message:
        "Série insuficiente (< 2 medições válidas). O Pádua FloodSim nunca fabrica curvas sintéticas a partir de picos isolados.",
    };
  }

  const multiplier = Math.max(input.maxGapMultiplier ?? 2, 1.5);
  const maxGapThresholdMinutes = station.nominalCadenceMinutes * multiplier;
  const { segments, gaps } = buildSegmentsAndGaps(
    validPoints,
    maxGapThresholdMinutes * 60 * 1000,
  );
  const summary = summarizeExtremesAndRainfall(validPoints);

  return {
    status: "ready",
    stationId: station.id,
    stationName: station.shortName,
    nativeStageUnit: station.nativeStageUnit,
    nominalCadenceMinutes: station.nominalCadenceMinutes,
    maxGapThresholdMinutes,
    points: validPoints,
    segments,
    gaps,
    ...summary,
    stationThresholds: station.thresholds,
    startEpochMs: validPoints[0].epochMs,
    endEpochMs: validPoints[validPoints.length - 1].epochMs,
  };
}

/**
 * Slices a prepared hydrograph to a user-selected `[startEpochMs, endEpochMs]`
 * sub-window while preserving gaps and refusing `< 2` points.
 */
export function sliceHydrographInterval(
  prepared: Extract<PreparedHydrographResult, { status: "ready" }>,
  startEpochMs: number,
  endEpochMs: number,
): PreparedHydrographResult {
  if (
    !Number.isFinite(startEpochMs) ||
    !Number.isFinite(endEpochMs) ||
    endEpochMs <= startEpochMs
  ) {
    return {
      status: "unavailable",
      reasonCode: "invalid_timestamps_or_station",
      message: "Intervalo temporal selecionado é inválido.",
    };
  }
  const subset = prepared.points
    .filter((pt) => pt.epochMs >= startEpochMs && pt.epochMs <= endEpochMs)
    .map((pt) => ({
      timestampUtc: pt.timestampUtc,
      stageCm: pt.stageCm,
      rainMm: pt.rainMm,
      qualityFlag: pt.qualityFlag,
    }));

  return prepareHistoricalHydrograph({
    stationId: prepared.stationId,
    seriesAvailability: "available_authorized",
    rawPoints: subset,
    maxGapMultiplier:
      prepared.maxGapThresholdMinutes / prepared.nominalCadenceMinutes,
  });
}

export function createInitialReplayState(
  prepared: Extract<PreparedHydrographResult, { status: "ready" }>,
): HydrographReplayState {
  return {
    isPlaying: false,
    speed: 1,
    cursorEpochMs: prepared.startEpochMs,
    activePoint: prepared.points[0],
    isInsideGap: false,
    activeGap: null,
    atEnd: false,
  };
}

export function seekHydrographReplay(
  prepared: Extract<PreparedHydrographResult, { status: "ready" }>,
  current: HydrographReplayState,
  targetEpochMs: number,
): HydrographReplayState {
  const clampedMs = Math.max(
    prepared.startEpochMs,
    Math.min(prepared.endEpochMs, targetEpochMs),
  );
  const atEnd = clampedMs >= prepared.endEpochMs;

  for (const gap of prepared.gaps) {
    if (clampedMs > Date.parse(gap.startUtc) && clampedMs < Date.parse(gap.endUtc)) {
      return {
        ...current,
        cursorEpochMs: clampedMs,
        activePoint: null,
        isInsideGap: true,
        activeGap: gap,
        atEnd: false,
      };
    }
  }

  let latestPoint = prepared.points[0];
  for (const pt of prepared.points) {
    if (pt.epochMs <= clampedMs) {
      latestPoint = pt;
    } else {
      break;
    }
  }

  return {
    ...current,
    cursorEpochMs: clampedMs,
    activePoint: latestPoint,
    isInsideGap: false,
    activeGap: null,
    atEnd,
    isPlaying: atEnd ? false : current.isPlaying,
  };
}

export function stepHydrographReplay(
  prepared: Extract<PreparedHydrographResult, { status: "ready" }>,
  current: HydrographReplayState,
): HydrographReplayState {
  if (!current.isPlaying || current.atEnd) {
    return current;
  }
  const stepMs =
    prepared.nominalCadenceMinutes * 60 * 1000 * current.speed;
  return seekHydrographReplay(prepared, current, current.cursorEpochMs + stepMs);
}
