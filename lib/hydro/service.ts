import type { HydroMonitoringResponse, HydroQualityFlag } from "./contract.ts";
import { isLiveIneaMonitoringEnabled } from "./httpPolicy.ts";
import {
  INEA_FRESHNESS_POLICY,
  INEA_INSTITUTION,
  INEA_PADUA_COORDINATES,
  INEA_PADUA_GAUGE_REFERENCE,
  INEA_PADUA_PUBLIC_PAGE_URL,
  INEA_PADUA_RIVER_NAME,
  INEA_PADUA_STATION_ID,
  INEA_PADUA_STATION_NAME,
  INEA_PADUA_XML_URL,
  INEA_SCIENTIFIC_DISCLAIMER,
  parseIneaStationXml,
} from "./ineaParser.ts";
import {
  createIneaAdapter,
  type HydroProviderAdapter,
} from "./providers/ineaAdapter.ts";

export interface HydroClock {
  now(): Date;
}

const SYSTEM_CLOCK: HydroClock = {
  now: () => new Date(),
};

export const INEA_HOMOLOGATION_DISABLED_MESSAGE =
  "Monitoramento observado INEA em homologação: coleta automática desativada por padrão até validação operacional e confirmação das condições de consumo. Nenhuma leitura fictícia é exibida.";

export interface HydroMonitoringServiceOptions {
  adapter?: HydroProviderAdapter;
  clock?: HydroClock;
  cacheTtlMs?: number;
  errorCacheTtlMs?: number;
  staleAfterMinutes?: number;
  isEnabled?: () => boolean;
}

interface CachedPayload {
  xml: string;
  etag?: string;
  lastModified?: string;
  fetchedAtMs: number;
  fetchedAtDate: Date;
}

interface CachedFailure {
  response: HydroMonitoringResponse;
  expiresAtMs: number;
}

function buildUnavailableResponse(
  retrievedAt: Date,
  staleAfterMinutes: number,
  sourceUrl: string,
  detailMessage: string,
  qualityFlags: HydroQualityFlag[] = ["upstream_error"],
): HydroMonitoringResponse {
  return {
    schemaVersion: "1.0",
    classification: "observed",
    status: "unavailable",
    provider: "inea",
    institution: INEA_INSTITUTION,
    station: {
      stationId: INEA_PADUA_STATION_ID,
      stationName: INEA_PADUA_STATION_NAME,
      riverName: INEA_PADUA_RIVER_NAME,
      coordinates: { ...INEA_PADUA_COORDINATES },
      publicPageUrl: INEA_PADUA_PUBLIC_PAGE_URL,
      sourceUrl,
      gaugeReference: { ...INEA_PADUA_GAUGE_REFERENCE },
    },
    measuredAt: null,
    retrievedAt: retrievedAt.toISOString(),
    ageMinutes: null,
    freshnessPolicy: {
      expectedCadenceMinutes: INEA_FRESHNESS_POLICY.expectedCadenceMinutes,
      staleAfterMinutes,
      cacheTtlSeconds: INEA_FRESHNESS_POLICY.cacheTtlSeconds,
    },
    latestStage: null,
    recentTrend: null,
    rainfall: [],
    qualityFlags,
    message: detailMessage,
    scientificDisclaimer: INEA_SCIENTIFIC_DISCLAIMER,
  };
}

export function createHydroMonitoringService(
  options: HydroMonitoringServiceOptions = {},
) {
  const adapter = options.adapter ?? createIneaAdapter();
  const clock = options.clock ?? SYSTEM_CLOCK;
  const cacheTtlMs =
    options.cacheTtlMs ?? INEA_FRESHNESS_POLICY.cacheTtlSeconds * 1000;
  const errorCacheTtlMs = options.errorCacheTtlMs ?? 30_000;
  const staleAfterMinutes =
    options.staleAfterMinutes ?? INEA_FRESHNESS_POLICY.staleAfterMinutes;
  const isEnabled = options.isEnabled ?? (() => true);

  let cachedPayload: CachedPayload | null = null;
  let cachedFailure: CachedFailure | null = null;
  let inFlight: Promise<HydroMonitoringResponse> | null = null;

  function evaluateCached(now: Date): HydroMonitoringResponse | null {
    if (!cachedPayload) return null;
    return parseIneaStationXml(cachedPayload.xml, {
      now,
      retrievedAt: cachedPayload.fetchedAtDate,
      staleAfterMinutes,
      sourceUrl: adapter.sourceUrl,
    });
  }

  async function refreshFromProvider(): Promise<HydroMonitoringResponse> {
    const requestTime = clock.now();
    const requestMs = requestTime.getTime();

    try {
      const raw = await adapter.fetchRawPayload({
        ifNoneMatch: cachedPayload?.etag,
        ifModifiedSince: cachedPayload?.lastModified,
      });

      const completionTime = clock.now();
      const completionMs = completionTime.getTime();

      if (raw.kind === "not_modified" && cachedPayload) {
        cachedPayload = {
          ...cachedPayload,
          etag: raw.etag ?? cachedPayload.etag,
          lastModified: raw.lastModified ?? cachedPayload.lastModified,
          fetchedAtMs: completionMs,
          fetchedAtDate: completionTime,
        };
        cachedFailure = null;
        return parseIneaStationXml(cachedPayload.xml, {
          now: completionTime,
          retrievedAt: completionTime,
          staleAfterMinutes,
          sourceUrl: adapter.sourceUrl,
        });
      }

      if (raw.kind === "ok") {
        const parsed = parseIneaStationXml(raw.xml, {
          now: completionTime,
          retrievedAt: completionTime,
          staleAfterMinutes,
          sourceUrl: adapter.sourceUrl,
        });

        if (parsed.status === "invalid") {
          cachedPayload = null;
          cachedFailure = {
            response: parsed,
            expiresAtMs: completionMs + errorCacheTtlMs,
          };
          return parsed;
        }

        cachedPayload = {
          xml: raw.xml,
          etag: raw.etag,
          lastModified: raw.lastModified,
          fetchedAtMs: completionMs,
          fetchedAtDate: completionTime,
        };
        cachedFailure = null;
        return parsed;
      }

      const missingCacheFallback = buildUnavailableResponse(
        completionTime,
        staleAfterMinutes,
        adapter.sourceUrl ?? INEA_PADUA_XML_URL,
        "Fonte oficial INEA retornou 304 sem cache prévio disponível.",
      );
      cachedFailure = {
        response: missingCacheFallback,
        expiresAtMs: completionMs + errorCacheTtlMs,
      };
      return missingCacheFallback;
    } catch {
      const failTime = clock.now();
      const failMs = failTime.getTime();
      // Fail closed: do not disguise an expired reading as currently available when upstream fails.
      cachedPayload = null;
      const unavailable = buildUnavailableResponse(
        failTime,
        staleAfterMinutes,
        adapter.sourceUrl ?? INEA_PADUA_XML_URL,
        "Não foi possível consultar a estação oficial do INEA neste momento. Nenhuma leitura fictícia foi exibida.",
      );
      cachedFailure = {
        response: unavailable,
        expiresAtMs: Math.max(requestMs, failMs) + errorCacheTtlMs,
      };
      return unavailable;
    }
  }

  return {
    async getLatestObservation(): Promise<HydroMonitoringResponse> {
      const now = clock.now();

      if (!isEnabled()) {
        return buildUnavailableResponse(
          now,
          staleAfterMinutes,
          adapter.sourceUrl ?? INEA_PADUA_XML_URL,
          INEA_HOMOLOGATION_DISABLED_MESSAGE,
          [],
        );
      }

      const nowMs = now.getTime();

      if (cachedPayload && nowMs - cachedPayload.fetchedAtMs < cacheTtlMs) {
        const evaluated = evaluateCached(now);
        if (evaluated) return evaluated;
      }

      if (cachedFailure && nowMs < cachedFailure.expiresAtMs) {
        return cachedFailure.response;
      }

      if (!inFlight) {
        inFlight = refreshFromProvider().finally(() => {
          inFlight = null;
        });
      }

      return inFlight;
    },
    clearCache() {
      cachedPayload = null;
      cachedFailure = null;
    },
  };
}

export const hydroMonitoringService = createHydroMonitoringService({
  isEnabled: () => isLiveIneaMonitoringEnabled(),
});
