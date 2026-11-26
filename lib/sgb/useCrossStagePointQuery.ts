"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FloodAreaInput } from "@/lib/sgb/area";
import {
  DEFAULT_CROSS_STAGE_CONCURRENCY,
  runCrossStagePointAnalysis,
  type SgbStageCache,
} from "@/lib/sgb/crossStageQuery";
import type { CrossStagePointSummary, GeoPoint } from "@/lib/sgb/location";
import { SGB_FLOOD_LEVELS_CM, type SgbFloodLevelCm } from "@/lib/sgb/stages";

export type CrossStageQueryState = {
  readonly status: "idle" | "running" | "completed";
  readonly pointKey: string | null;
  readonly completed: number;
  readonly total: number;
  readonly cachedHits: number;
  readonly fetchedCount: number;
  readonly failedCount: number;
  readonly summary: CrossStagePointSummary | null;
};

const INITIAL_STATE: CrossStageQueryState = {
  status: "idle",
  pointKey: null,
  completed: 0,
  total: SGB_FLOOD_LEVELS_CM.length,
  cachedHits: 0,
  fetchedCount: 0,
  failedCount: 0,
  summary: null,
};

function makePointKey(point: GeoPoint | null): string | null {
  if (!point) return null;
  return `${point.lat.toFixed(7)},${point.lon.toFixed(7)}`;
}

export function useCrossStagePointQuery(
  point: GeoPoint | null,
  preloaded?: Readonly<Partial<Record<SgbFloodLevelCm, FloodAreaInput>>>,
) {
  const cacheRef = useRef<SgbStageCache>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const preloadedRef = useRef(preloaded);
  preloadedRef.current = preloaded;

  const [state, setState] = useState<CrossStageQueryState>(INITIAL_STATE);
  const activePointKey = makePointKey(point);

  // Abort any in-flight 11-stage query when the selected point changes or unmounts
  useEffect(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL_STATE);

    return () => {
      runIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [activePointKey]);

  const cancelAnalysis = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const analyzeAllStages = useCallback(() => {
    if (!point || !activePointKey) return;

    runIdRef.current += 1;
    const currentRunId = runIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      status: "running",
      pointKey: activePointKey,
      completed: 0,
      total: SGB_FLOOD_LEVELS_CM.length,
      cachedHits: 0,
      fetchedCount: 0,
      failedCount: 0,
      summary: null,
    });

    void runCrossStagePointAnalysis({
      point,
      cache: cacheRef.current,
      preloaded: preloadedRef.current,
      concurrency: DEFAULT_CROSS_STAGE_CONCURRENCY,
      signal: controller.signal,
      onProgress: (progress) => {
        if (runIdRef.current !== currentRunId || controller.signal.aborted) {
          return;
        }
        setState({
          status: "running",
          pointKey: activePointKey,
          completed: progress.completed,
          total: progress.total,
          cachedHits: progress.cachedHits,
          fetchedCount: progress.fetchedCount,
          failedCount: progress.failedCount,
          summary: progress.summary,
        });
      },
    }).then((result) => {
      if (runIdRef.current !== currentRunId || result.status === "aborted") {
        return;
      }
      setState({
        status: "completed",
        pointKey: activePointKey,
        completed: SGB_FLOOD_LEVELS_CM.length,
        total: SGB_FLOOD_LEVELS_CM.length,
        cachedHits: result.cachedHits,
        fetchedCount: result.fetchedCount,
        failedCount: result.failedCount,
        summary: result.summary,
      });
    });
  }, [point, activePointKey]);

  // Never expose stale cross-stage state for a different point
  const currentState =
    state.pointKey === activePointKey ? state : INITIAL_STATE;

  return {
    ...currentState,
    analyzeAllStages,
    cancelAnalysis,
  };
}
