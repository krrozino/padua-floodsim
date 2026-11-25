import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { validateHydroMonitoringResponse } from "../../../lib/hydro/contract.ts";
import {
  buildHydroCacheControlHeader,
  validateHydroQueryParams,
} from "../../../lib/hydro/httpPolicy.ts";
import { parseIneaStationXml } from "../../../lib/hydro/ineaParser.ts";
import {
  assertAllowedIneaUrl,
  createIneaAdapter,
} from "../../../lib/hydro/providers/ineaAdapter.ts";
import {
  SECTIGO_DV_R36_METADATA,
  getVerifiedIneaCaBundle,
  verifyIneaIntermediateCertificate,
} from "../../../lib/hydro/providers/ineaTlsChain.ts";
import { createHydroMonitoringService } from "../../../lib/hydro/service.ts";

const SYNTHETIC_FIXTURE_XML = readFileSync(
  path.resolve(
    process.cwd(),
    "tests/fixtures/hydro/inea-213042120-synthetic.xml",
  ),
  "utf8",
);

describe("INEA adapter security, TLS chain, timeout, and retry bounds", () => {
  it("enforces HTTPS and strict INEA host allowlist", () => {
    assert.doesNotThrow(() =>
      assertAllowedIneaUrl(
        "https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.xml",
      ),
    );
    assert.throws(() =>
      assertAllowedIneaUrl(
        "http://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.xml",
      ),
    );
    assert.throws(() =>
      assertAllowedIneaUrl("https://evil.example.com/alertadecheias.inea.rj.gov.br"),
    );
  });

  it("rejects untrusted post-redirect URLs and oversized payloads", async () => {
    const redirectAdapter = createIneaAdapter({
      fetchImpl: async () =>
        ({
          ok: true,
          status: 200,
          url: "https://untrusted.example.org/data.xml",
          headers: new Headers(),
          text: async () => SYNTHETIC_FIXTURE_XML,
        }) as unknown as Response,
    });

    await assert.rejects(
      () => redirectAdapter.fetchRawPayload(),
      /Host não autorizado/,
    );

    const oversizedHeaderAdapter = createIneaAdapter({
      maxBytes: 512,
      fetchImpl: async () =>
        new Response(SYNTHETIC_FIXTURE_XML, {
          status: 200,
          headers: { "content-length": "4096" },
        }),
    });

    await assert.rejects(
      () => oversizedHeaderAdapter.fetchRawPayload(),
      /excede limite/,
    );
  });

  it("limits retries to at most 1 on HTTP 503 and never retries on TimeoutError or TLS error", async () => {
    let calls503 = 0;
    const retry503Adapter = createIneaAdapter({
      retryDelayMs: 1,
      timeoutMs: 5_000,
      totalTimeoutMs: 10_000,
      maxRetries: 5, // must still be capped to INEA_MAX_RETRIES (1)
      fetchImpl: async () => {
        calls503 += 1;
        return new Response("Service Unavailable", { status: 503 });
      },
    });

    await assert.rejects(() => retry503Adapter.fetchRawPayload(), /INEA HTTP 503/);
    assert.equal(calls503, 2);

    let callsTimeout = 0;
    const timeoutAdapter = createIneaAdapter({
      retryDelayMs: 1,
      fetchImpl: async () => {
        callsTimeout += 1;
        throw new DOMException("The operation timed out.", "TimeoutError");
      },
    });
    await assert.rejects(() => timeoutAdapter.fetchRawPayload());
    assert.equal(callsTimeout, 1);

    let callsTls = 0;
    const tlsErrorAdapter = createIneaAdapter({
      retryDelayMs: 1,
      fetchImpl: async () => {
        callsTls += 1;
        const err = new Error("unable to verify leaf signature") as NodeJS.ErrnoException;
        err.code = "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
        throw err;
      },
    });
    await assert.rejects(() => tlsErrorAdapter.fetchRawPayload());
    assert.equal(callsTls, 1);
  });

  it("cryptographically verifies the Sectigo DV R36 intermediate CA, fingerprint, and validity window", () => {
    const validRefDate = new Date("2026-11-25T12:00:00Z");
    const verified = verifyIneaIntermediateCertificate(validRefDate);
    assert.equal(verified.fingerprint256, SECTIGO_DV_R36_METADATA.fingerprint256);

    const bundle = getVerifiedIneaCaBundle(validRefDate);
    assert.ok(bundle.length > 10);

    // Must fail closed once the intermediate certificate expires (after 2036-03-21).
    assert.throws(
      () => verifyIneaIntermediateCertificate(new Date("2037-01-01T00:00:00Z")),
      /fora da janela de validade/,
    );
  });
});

describe("HTTP query protection and shared CDN cache policy", () => {
  it("rejects refresh=1 and arbitrary query parameters while allowing valid provider/station", () => {
    assert.deepEqual(validateHydroQueryParams(new URLSearchParams("")), {
      ok: true,
    });
    assert.deepEqual(
      validateHydroQueryParams(
        new URLSearchParams("provider=inea&station=213042120"),
      ),
      { ok: true },
    );

    const refreshCheck = validateHydroQueryParams(
      new URLSearchParams("refresh=1"),
    );
    assert.equal(refreshCheck.ok, false);
    if (!refreshCheck.ok) {
      assert.equal(refreshCheck.status, 400);
      assert.equal(refreshCheck.error, "unsupported_query_parameter");
    }

    const arbitraryCheck = validateHydroQueryParams(
      new URLSearchParams("provider=inea&nocache=abc"),
    );
    assert.equal(arbitraryCheck.ok, false);
    if (!arbitraryCheck.ok) {
      assert.equal(arbitraryCheck.status, 400);
      assert.equal(arbitraryCheck.error, "unsupported_query_parameter");
    }

    const badProvider = validateHydroQueryParams(
      new URLSearchParams("provider=other"),
    );
    assert.equal(badProvider.ok, false);
    if (!badProvider.ok) {
      assert.equal(badProvider.error, "unsupported_provider");
    }

    const badStation = validateHydroQueryParams(
      new URLSearchParams("station=58790002"),
    );
    assert.equal(badStation.ok, false);
    if (!badStation.ok) {
      assert.equal(badStation.error, "unsupported_station");
    }
  });

  it("caps shared CDN s-maxage to remaining freshness window and returns no-store for errors", () => {
    // Synthetic fixture latest measuredAt: 2026-06-15T14:45:00-03:00 (17:45:00Z)
    // Stale deadline (+45 min): 18:30:00Z
    const freshNow = new Date("2026-06-15T17:57:00Z"); // 12 min old, 33 min until stale
    const freshObs = parseIneaStationXml(SYNTHETIC_FIXTURE_XML, {
      now: freshNow,
      retrievedAt: freshNow,
    });
    assert.equal(
      buildHydroCacheControlHeader(freshObs, freshNow.getTime()),
      "public, max-age=0, s-maxage=300",
    );

    // Near stale boundary: 43 min old (only 120s left before stale), s-maxage must cap at 120s.
    const nearStaleNow = new Date("2026-06-15T18:28:00Z");
    const nearStaleObs = parseIneaStationXml(SYNTHETIC_FIXTURE_XML, {
      now: nearStaleNow,
      retrievedAt: nearStaleNow,
    });
    assert.equal(nearStaleObs.status, "fresh");
    assert.equal(
      buildHydroCacheControlHeader(nearStaleObs, nearStaleNow.getTime()),
      "public, max-age=0, s-maxage=120",
    );

    // Stale reading is already explicitly labeled stale -> can share within refresh TTL.
    const staleNow = new Date("2026-06-15T18:40:00Z");
    const staleObs = parseIneaStationXml(SYNTHETIC_FIXTURE_XML, {
      now: staleNow,
      retrievedAt: staleNow,
    });
    assert.equal(staleObs.status, "stale");
    assert.equal(
      buildHydroCacheControlHeader(staleObs, staleNow.getTime()),
      "public, max-age=0, s-maxage=300",
    );

    // Invalid payload -> strictly no-store
    const invalidObs = parseIneaStationXml("<html>503</html>", {
      now: freshNow,
    });
    assert.equal(invalidObs.status, "invalid");
    assert.equal(
      buildHydroCacheControlHeader(invalidObs, freshNow.getTime()),
      "no-store",
    );
  });
});

describe("hydro monitoring service caching, concurrency deduplication, staleness clock, and failure isolation", () => {
  it("deduplicates concurrent upstream requests into a single INEA fetch", async () => {
    const currentTime = new Date("2026-06-15T17:57:00Z");
    let fetchCalls = 0;
    let releaseFetch: (() => void) | undefined;

    const adapter = createIneaAdapter({
      retryDelayMs: 1,
      fetchImpl: async () => {
        fetchCalls += 1;
        await new Promise<void>((resolve) => {
          releaseFetch = resolve;
        });
        return new Response(SYNTHETIC_FIXTURE_XML, {
          status: 200,
          headers: { "content-type": "text/xml", etag: '"etag-concurrent"' },
        });
      },
    });

    const service = createHydroMonitoringService({
      adapter,
      clock: { now: () => currentTime },
      cacheTtlMs: 300_000,
      staleAfterMinutes: 45,
    });

    const pending = Promise.all([
      service.getLatestObservation(),
      service.getLatestObservation(),
      service.getLatestObservation(),
    ]);

    // Wait a microtask for the single fetch to be initiated
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(fetchCalls, 1);
    releaseFetch?.();

    const results = await pending;
    assert.equal(fetchCalls, 1);
    for (const result of results) {
      assert.equal(result.status, "fresh");
      assert.equal(result.latestStage?.stageCm, 342);
    }
  });

  it("caches proportionally within TTL, transitions to stale with injectable clock, and supports 304", async () => {
    let currentTime = new Date("2026-06-15T17:57:00Z"); // 14:57 BRT
    let fetchCalls = 0;

    const adapter = createIneaAdapter({
      retryDelayMs: 1,
      fetchImpl: async (_url, init) => {
        fetchCalls += 1;
        const headers = init?.headers as Record<string, string> | undefined;
        if (headers?.["If-None-Match"] === '"etag-1"') {
          return new Response(null, {
            status: 304,
            headers: { etag: '"etag-1"' },
          });
        }
        return new Response(SYNTHETIC_FIXTURE_XML, {
          status: 200,
          headers: {
            "content-type": "text/xml",
            etag: '"etag-1"',
          },
        });
      },
    });

    const service = createHydroMonitoringService({
      adapter,
      clock: { now: () => currentTime },
      cacheTtlMs: 300_000,
      staleAfterMinutes: 45,
    });

    const first = await service.getLatestObservation();
    assert.equal(fetchCalls, 1);
    assert.equal(first.status, "fresh");
    assert.equal(first.ageMinutes, 12);
    assert.equal(first.latestStage?.stageCm, 342);

    // Advance 3 minutes (within 5-min cache TTL): must not call upstream again.
    currentTime = new Date("2026-06-15T18:00:00Z");
    const second = await service.getLatestObservation();
    assert.equal(fetchCalls, 1);
    assert.equal(second.status, "fresh");
    assert.equal(second.ageMinutes, 15);

    // Advance 40 minutes total (past 5-min cache TTL AND past 45-min stale threshold):
    // triggers conditional GET -> 304 Not Modified, retrievedAt updates, status becomes stale!
    currentTime = new Date("2026-06-15T18:37:00Z"); // 52 min after 14:45 BRT
    const third = await service.getLatestObservation();
    assert.equal(fetchCalls, 2);
    assert.equal(third.status, "stale");
    assert.equal(third.ageMinutes, 52);
    assert.equal(third.retrievedAt, "2026-06-15T18:37:00.000Z");
  });

  it("fails closed to unavailable on timeout or HTTP 503 without mock fallback", async () => {
    const currentTime = new Date("2026-06-15T17:57:00Z");
    const timeoutError = new DOMException("The operation timed out.", "TimeoutError");

    const failingAdapter = createIneaAdapter({
      retryDelayMs: 1,
      fetchImpl: async () => {
        throw timeoutError;
      },
    });

    const service = createHydroMonitoringService({
      adapter: failingAdapter,
      clock: { now: () => currentTime },
    });

    const res = await service.getLatestObservation();
    assert.equal(validateHydroMonitoringResponse(res), true);
    assert.equal(res.status, "unavailable");
    assert.equal(res.latestStage, null);
    assert.equal(res.measuredAt, null);
    assert.ok(res.qualityFlags.includes("upstream_error"));
    assert.equal(
      buildHydroCacheControlHeader(res, currentTime.getTime()),
      "no-store",
    );
  });

  it("rejects contract violations in validateHydroMonitoringResponse", () => {
    assert.equal(validateHydroMonitoringResponse(null), false);
    assert.equal(
      validateHydroMonitoringResponse({
        schemaVersion: "1.0",
        classification: "mock",
        status: "fresh",
      }),
      false,
    );
    assert.equal(
      validateHydroMonitoringResponse({
        schemaVersion: "1.0",
        classification: "observed",
        status: "unavailable",
        provider: "inea",
        institution: "INEA",
        station: {
          stationId: "213042120",
          stationName: "Santo Antônio de Pádua",
          riverName: "Rio Pomba",
          coordinates: null,
          publicPageUrl: "https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.html",
          sourceUrl: "https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.xml",
          gaugeReference: {
            stationCode: "213042120",
            rhnCode: null,
            gaugeZeroMeters: null,
            verticalDatum: null,
            attentionStageCm: 400,
            overflowStageCm: 500,
            crosswalkValidated: true,
          },
        },
        measuredAt: null,
        retrievedAt: "2026-06-15T17:57:00.000Z",
        ageMinutes: null,
        freshnessPolicy: {
          expectedCadenceMinutes: 15,
          staleAfterMinutes: 45,
          cacheTtlSeconds: 300,
        },
        latestStage: null,
        recentTrend: null,
        rainfall: [],
        qualityFlags: ["upstream_error"],
        message: "Indisponível",
        scientificDisclaimer: "Experimental",
      }),
      false,
    );
  });
});
