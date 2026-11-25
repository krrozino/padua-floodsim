"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  validateHydroMonitoringResponse,
  type HydroMonitoringResponse,
} from "@/lib/hydro/contract";

export type HydroViewState =
  | "loading"
  | "fresh"
  | "stale"
  | "unavailable"
  | "invalid";

export const HYDRO_POLL_INTERVAL_MS = 300_000; // 5 min, proportional to INEA cadence/cache
const HYDRO_FRESHNESS_TICK_MS = 60_000;
const HYDRO_REQUEST_TIMEOUT_MS = 20_000;

export interface HydroMonitoringState {
  viewState: HydroViewState;
  data: HydroMonitoringResponse | null;
  effectiveAgeMinutes: number | null;
  isRefreshing: boolean;
  errorMessage: string | null;
  refreshNow: () => void;
}

export function useHydroMonitoring(): HydroMonitoringState {
  const [rawState, setRawState] = useState<{
    viewState: HydroViewState;
    data: HydroMonitoringResponse | null;
    errorMessage: string | null;
  }>({
    viewState: "loading",
    data: null,
    errorMessage: null,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [refreshTick, setRefreshTick] = useState(0);

  const lastAttemptMsRef = useRef<number>(0);
  const inFlightControllerRef = useRef<AbortController | null>(null);

  const fetchObservation = useCallback(async (isInitial: boolean) => {
    inFlightControllerRef.current?.abort();
    const controller = new AbortController();
    inFlightControllerRef.current = controller;

    lastAttemptMsRef.current = Date.now();
    if (!isInitial) {
      setIsRefreshing(true);
    }

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, HYDRO_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch("/api/hydro/observations", {
        cache: "no-store",
        signal: controller.signal,
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        if (controller.signal.aborted) return;
        setRawState({
          viewState: "invalid",
          data: null,
          errorMessage: "Resposta JSON inválida do serviço de monitoramento.",
        });
        return;
      }

      if (controller.signal.aborted) return;

      if (!validateHydroMonitoringResponse(payload)) {
        setRawState({
          viewState: response.status >= 500 && response.status !== 502 ? "unavailable" : "invalid",
          data: null,
          errorMessage:
            "Payload de monitoramento hidrológico fora do contrato esperado.",
        });
        return;
      }

      setNowMs(Date.now());
      setRawState({
        viewState: payload.status,
        data: payload,
        errorMessage:
          payload.status === "unavailable" || payload.status === "invalid"
            ? payload.message
            : null,
      });
    } catch {
      if (inFlightControllerRef.current !== controller) return;
      setRawState({
        viewState: "unavailable",
        data: null,
        errorMessage:
          "Não foi possível consultar o monitoramento do INEA neste momento.",
      });
    } finally {
      clearTimeout(timeoutId);
      if (inFlightControllerRef.current === controller) {
        inFlightControllerRef.current = null;
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchObservation(refreshTick === 0);

    const pollId = setInterval(() => {
      void fetchObservation(false);
    }, HYDRO_POLL_INTERVAL_MS);

    const tickId = setInterval(() => {
      setNowMs(Date.now());
    }, HYDRO_FRESHNESS_TICK_MS);

    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastAttemptMsRef.current >= HYDRO_POLL_INTERVAL_MS
      ) {
        void fetchObservation(false);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(pollId);
      clearInterval(tickId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      inFlightControllerRef.current?.abort();
    };
  }, [fetchObservation, refreshTick]);

  const refreshNow = useCallback(() => {
    setRefreshTick((prev) => prev + 1);
  }, []);

  const derived = useMemo(() => {
    const data = rawState.data;
    if (!data || !data.measuredAt || !data.latestStage) {
      return {
        viewState: rawState.viewState,
        effectiveAgeMinutes: data?.ageMinutes ?? null,
      };
    }

    const measuredMs = Date.parse(data.measuredAt);
    if (!Number.isFinite(measuredMs)) {
      return {
        viewState: "invalid" as const,
        effectiveAgeMinutes: null,
      };
    }

    const computedAge = Math.max(0, Math.floor((nowMs - measuredMs) / 60_000));
    const effectiveAgeMinutes = Math.max(data.ageMinutes ?? 0, computedAge);
    const viewState: HydroViewState =
      rawState.viewState === "fresh" &&
      effectiveAgeMinutes > data.freshnessPolicy.staleAfterMinutes
        ? "stale"
        : rawState.viewState;

    return { viewState, effectiveAgeMinutes };
  }, [rawState, nowMs]);

  return {
    viewState: derived.viewState,
    data: rawState.data,
    effectiveAgeMinutes: derived.effectiveAgeMinutes,
    isRefreshing,
    errorMessage: rawState.errorMessage,
    refreshNow,
  };
}
