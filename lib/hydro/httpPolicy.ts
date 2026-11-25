import type { HydroMonitoringResponse } from "./contract.ts";
import { INEA_PADUA_STATION_ID } from "./ineaParser.ts";

export const ALLOWED_HYDRO_QUERY_PARAMS = new Set(["provider", "station"]);
export const LIVE_INEA_FEATURE_FLAG = "FLOODSIM_ENABLE_LIVE_INEA";

/**
 * Server-side opt-in gate for live INEA collection (disabled by default, no secret required).
 * Prevents involuntary public activation before operational homologation and institutional
 * confirmation of automated consumption terms.
 */
export function isLiveIneaMonitoringEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[LIVE_INEA_FEATURE_FLAG]?.trim().toLowerCase() === "true";
}

export type HydroQueryValidationResult =
  | { ok: true }
  | {
      ok: false;
      status: 400;
      error:
        | "unsupported_query_parameter"
        | "unsupported_provider"
        | "unsupported_station";
      message: string;
    };

/**
 * Strictly validates `/api/hydro/observations` query parameters.
 * Rejects unknown parameters (including legacy `refresh=1` or arbitrary cache-busting keys)
 * so external callers cannot force upstream INEA requests or fragment shared CDN cache keys.
 */
export function validateHydroQueryParams(
  searchParams: URLSearchParams,
): HydroQueryValidationResult {
  for (const key of searchParams.keys()) {
    if (!ALLOWED_HYDRO_QUERY_PARAMS.has(key)) {
      return {
        ok: false,
        status: 400,
        error: "unsupported_query_parameter",
        message:
          "Parâmetro de consulta não suportado. Apenas provider e station são aceitos.",
      };
    }
  }

  const providerParam = searchParams.get("provider");
  const stationParam = searchParams.get("station");

  if (providerParam !== null && providerParam !== "inea") {
    return {
      ok: false,
      status: 400,
      error: "unsupported_provider",
      message: "Provedor hidrológico não suportado. Utilize provider=inea.",
    };
  }

  if (stationParam !== null && stationParam !== INEA_PADUA_STATION_ID) {
    return {
      ok: false,
      status: 400,
      error: "unsupported_station",
      message: `Estação hidrológica não suportada. Utilize station=${INEA_PADUA_STATION_ID}.`,
    };
  }

  return { ok: true };
}

/**
 * Computes an HTTP shared-cache (`s-maxage`) policy compatible with Vercel Edge CDN
 * without introducing external infrastructure (Redis/DB).
 *
 * Safeguards:
 * - Error states (`unavailable`, `invalid`) are strictly `no-store`.
 * - `max-age=0` ensures browsers revalidate while the edge CDN can coalesce requests across
 *   ephemeral serverless instances within the remaining source refresh window.
 * - For `fresh` observations, `s-maxage` is capped to BOTH the remaining cache TTL and the
 *   remaining freshness window (`measuredAt + staleAfterMinutes - now`), so the CDN never
 *   serves an expired reading labeled `fresh`.
 * - `stale-while-revalidate` is intentionally omitted so stale responses are never masked.
 *
 * Distributed limitation:
 * Edge CDN caching is best-effort per region/PoP and serverless memory caches are per-instance;
 * this reduces upstream load proportionally to INEA's cadence but does not constitute global
 * cross-region rate limiting or abuse protection.
 */
export function buildHydroCacheControlHeader(
  observation: HydroMonitoringResponse,
  nowMs: number = Date.now(),
): string {
  if (observation.status === "unavailable" || observation.status === "invalid") {
    return "no-store";
  }

  const cacheTtlSeconds = observation.freshnessPolicy.cacheTtlSeconds;
  const retrievedMs = Date.parse(observation.retrievedAt);
  if (!Number.isFinite(retrievedMs)) {
    return "no-store";
  }

  const secondsUntilRefresh = Math.floor(
    (retrievedMs + cacheTtlSeconds * 1000 - nowMs) / 1000,
  );
  let sharedMaxAge = Math.min(cacheTtlSeconds, secondsUntilRefresh);

  if (observation.status === "fresh") {
    const measuredMs = observation.measuredAt
      ? Date.parse(observation.measuredAt)
      : Number.NaN;
    if (!Number.isFinite(measuredMs)) {
      return "no-store";
    }
    const staleDeadlineMs =
      measuredMs + observation.freshnessPolicy.staleAfterMinutes * 60_000;
    const secondsUntilStale = Math.floor((staleDeadlineMs - nowMs) / 1000);
    sharedMaxAge = Math.min(sharedMaxAge, secondsUntilStale);
  }

  if (sharedMaxAge <= 0) {
    return "no-store";
  }

  return `public, max-age=0, s-maxage=${sharedMaxAge}`;
}
