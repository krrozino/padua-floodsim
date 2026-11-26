import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { FloodAreaInput } from "./area.ts";
import {
  evaluatePointAgainstFloodScenario,
  summarizeCrossStagePointQuery,
  type CrossStageEntryStatus,
  type CrossStagePointSummary,
  type GeoPoint,
  type SpatialPointRelation,
} from "./location.ts";
import { SGB_FLOOD_LEVELS_CM, type SgbFloodLevelCm } from "./stages.ts";

export const DEFAULT_CROSS_STAGE_CONCURRENCY = 3;
export const DEFAULT_STAGE_FETCH_TIMEOUT_MS = 30_000;

export type SgbStageGeometry = FeatureCollection<Polygon | MultiPolygon>;
export type SgbStageCache = Map<SgbFloodLevelCm, SgbStageGeometry>;

export type CrossStageProgress = {
  readonly completed: number;
  readonly total: number;
  readonly cachedHits: number;
  readonly fetchedCount: number;
  readonly failedCount: number;
  readonly summary: CrossStagePointSummary;
};

export type CrossStageRunResult =
  | {
      readonly status: "completed";
      readonly summary: CrossStagePointSummary;
      readonly cachedHits: number;
      readonly fetchedCount: number;
      readonly failedCount: number;
    }
  | {
      readonly status: "aborted";
    };

type StageEvaluationRecord = {
  readonly status: CrossStageEntryStatus;
  readonly relation: SpatialPointRelation;
  readonly reason?: string;
};

export function validateSgbStageApiPayload(
  payload: unknown,
  expectedLevelCm: SgbFloodLevelCm,
): SgbStageGeometry {
  if (!payload || typeof payload !== "object") {
    throw new Error("Resposta SGB vazia ou malformada.");
  }
  const p = payload as {
    classification?: unknown;
    levelCm?: unknown;
    layerName?: unknown;
    geojson?: {
      type?: unknown;
      features?: unknown;
    };
  };

  if (
    p.classification !== "official_reference" ||
    p.levelCm !== expectedLevelCm ||
    p.layerName !== `COTA_${expectedLevelCm}cm` ||
    p.geojson?.type !== "FeatureCollection" ||
    !Array.isArray(p.geojson.features)
  ) {
    throw new Error(
      `Resposta SGB inválida ou incompatível com a cota ${expectedLevelCm} cm.`,
    );
  }

  const validFeatures = p.geojson.features.every(
    (feature: {
      type?: unknown;
      geometry?: { type?: unknown; coordinates?: unknown };
    }) =>
      feature?.type === "Feature" &&
      (feature.geometry?.type === "Polygon" ||
        feature.geometry?.type === "MultiPolygon") &&
      Array.isArray(feature.geometry?.coordinates),
  );

  if (!validFeatures) {
    throw new Error(
      `Geometria inválida na resposta SGB para a cota ${expectedLevelCm} cm.`,
    );
  }

  if (p.geojson.features.length === 0) {
    throw new Error(
      `O SGB retornou camada vazia para a cota ${expectedLevelCm} cm.`,
    );
  }

  return p.geojson as SgbStageGeometry;
}

async function fetchStagePayload(
  levelCm: SgbFloodLevelCm,
  fetcher: typeof fetch,
  parentSignal?: AbortSignal,
  timeoutMs: number = DEFAULT_STAGE_FETCH_TIMEOUT_MS,
): Promise<SgbStageGeometry> {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
    }
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(`/api/sgb/flood?level=${levelCm}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Falha HTTP ${response.status} ao consultar ${levelCm} cm.`);
    }
    const payload = await response.json();
    return validateSgbStageApiPayload(payload, levelCm);
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener("abort", onParentAbort);
    }
  }
}

/**
 * Evaluates a point across all 11 official SGB flood scenarios on demand,
 * using an in-memory stage cache, bounded concurrency, live progress updates,
 * and strict AbortSignal cancellation to prevent out-of-order stale updates.
 *
 * Scientific guarantees:
 * - Never triggered automatically on page open (explicit caller invocation only).
 * - Evaluates every stage independently without interpolating or assuming nesting.
 * - Fails closed per stage: failed/invalid stages are recorded as unavailable
 *   without ever being cached or treated as "outside".
 */
export async function runCrossStagePointAnalysis(params: {
  readonly point: GeoPoint;
  readonly cache: SgbStageCache;
  readonly preloaded?: Readonly<Partial<Record<SgbFloodLevelCm, FloodAreaInput>>>;
  readonly levels?: readonly SgbFloodLevelCm[];
  readonly concurrency?: number;
  readonly timeoutMs?: number;
  readonly boundaryToleranceMeters?: number;
  readonly signal?: AbortSignal;
  readonly fetcher?: typeof fetch;
  readonly onProgress?: (progress: CrossStageProgress) => void;
}): Promise<CrossStageRunResult> {
  const {
    point,
    cache,
    preloaded,
    levels = SGB_FLOOD_LEVELS_CM,
    concurrency = DEFAULT_CROSS_STAGE_CONCURRENCY,
    timeoutMs = DEFAULT_STAGE_FETCH_TIMEOUT_MS,
    boundaryToleranceMeters,
    signal,
    fetcher = fetch,
    onProgress,
  } = params;

  if (signal?.aborted) {
    return { status: "aborted" };
  }

  const boundedConcurrency = Math.max(1, Math.min(Math.floor(concurrency), 6));
  const records: Partial<Record<SgbFloodLevelCm, StageEvaluationRecord>> = {};
  const queue: SgbFloodLevelCm[] = [];

  let cachedHits = 0;
  let fetchedCount = 0;
  let failedCount = 0;
  let completed = 0;

  const evaluateGeoJson = (levelCm: SgbFloodLevelCm, geojson: FloodAreaInput) => {
    const res = evaluatePointAgainstFloodScenario(point, geojson, levelCm, {
      boundaryToleranceMeters,
    });
    if (res.status === "valid") {
      records[levelCm] = {
        status: "evaluated",
        relation: res.relation,
      };
    } else {
      failedCount += 1;
      records[levelCm] = {
        status: "error",
        relation: "unavailable",
        reason: res.reason,
      };
    }
    completed += 1;
  };

  // 1. Seed from cache or currently loaded map layers (zero redundant fetches)
  for (const levelCm of levels) {
    const cached = cache.get(levelCm);
    const seed = cached ?? preloaded?.[levelCm];
    if (seed) {
      cachedHits += 1;
      evaluateGeoJson(levelCm, seed);
    } else {
      records[levelCm] = { status: "pending", relation: "unavailable" };
      queue.push(levelCm);
    }
  }

  const emitProgress = () => {
    if (signal?.aborted) return;
    onProgress?.({
      completed,
      total: levels.length,
      cachedHits,
      fetchedCount,
      failedCount,
      summary: summarizeCrossStagePointQuery(point, records),
    });
  };

  emitProgress();

  // 2. Fetch remaining stages with bounded concurrency
  const processQueuedStage = async (
    levelCm: SgbFloodLevelCm,
  ): Promise<void> => {
    try {
      const geojson = await fetchStagePayload(
        levelCm,
        fetcher,
        signal,
        timeoutMs,
      );
      if (signal?.aborted) return;
      const res = evaluatePointAgainstFloodScenario(point, geojson, levelCm, {
        boundaryToleranceMeters,
      });
      if (res.status === "valid") {
        cache.set(levelCm, geojson);
        fetchedCount += 1;
        records[levelCm] = { status: "evaluated", relation: res.relation };
      } else {
        failedCount += 1;
        records[levelCm] = {
          status: "error",
          relation: "unavailable",
          reason: res.reason,
        };
      }
      completed += 1;
      emitProgress();
    } catch (error) {
      if (signal?.aborted) return;
      failedCount += 1;
      records[levelCm] = {
        status: "error",
        relation: "unavailable",
        reason:
          error instanceof Error
            ? error.message
            : `Falha ao consultar cota ${levelCm} cm.`,
      };
      completed += 1;
      emitProgress();
    }
  };

  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length && !signal?.aborted) {
      const idx = cursor;
      cursor += 1;
      await processQueuedStage(queue[idx]);
    }
  };

  const workerCount = Math.min(boundedConcurrency, queue.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (signal?.aborted) {
    return { status: "aborted" };
  }

  return {
    status: "completed",
    summary: summarizeCrossStagePointQuery(point, records),
    cachedHits,
    fetchedCount,
    failedCount,
  };
}
