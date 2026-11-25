import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { validateHydroMonitoringResponse } from "../../../lib/hydro/contract.ts";
import {
  assertAllowedIneaUrl,
  createIneaAdapter,
} from "../../../lib/hydro/providers/ineaAdapter.ts";
import { getVerifiedIneaCaBundle } from "../../../lib/hydro/providers/ineaTlsChain.ts";
import { createHydroMonitoringService } from "../../../lib/hydro/service.ts";

const REAL_FIXTURE_XML = readFileSync(
  path.resolve(
    process.cwd(),
    "tests/fixtures/hydro/inea-213042120-sample.xml",
  ),
  "utf8",
);

describe("INEA adapter security and network failure handling", () => {
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
          text: async () => REAL_FIXTURE_XML,
        }) as unknown as Response,
    });

    await assert.rejects(
      () => redirectAdapter.fetchRawPayload(),
      /Host não autorizado/,
    );

    const oversizedHeaderAdapter = createIneaAdapter({
      maxBytes: 512,
      fetchImpl: async () =>
        new Response(REAL_FIXTURE_XML, {
          status: 200,
          headers: { "content-length": "4096" },
        }),
    });

    await assert.rejects(
      () => oversizedHeaderAdapter.fetchRawPayload(),
      /excede limite/,
    );
  });

  it("cryptographically verifies the Sectigo DV R36 intermediate CA against Node built-in roots", () => {
    const bundle = getVerifiedIneaCaBundle();
    assert.ok(bundle.length > 10);
  });
});

describe("hydro monitoring service caching, staleness clock, and failure isolation", () => {
  it("caches proportionally within TTL, transitions to stale with injectable clock, and supports 304", async () => {
    let currentTime = new Date("2026-11-25T02:57:00Z"); // 23:57 BRT
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
        return new Response(REAL_FIXTURE_XML, {
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
    assert.equal(first.latestStage?.stageCm, 417);

    // Advance 3 minutes (within 5-min cache TTL): must not call upstream again.
    currentTime = new Date("2026-11-25T03:00:00Z");
    const second = await service.getLatestObservation();
    assert.equal(fetchCalls, 1);
    assert.equal(second.status, "fresh");
    assert.equal(second.ageMinutes, 15);

    // Advance 40 minutes total (past 5-min cache TTL AND past 45-min stale threshold):
    // triggers conditional GET -> 304 Not Modified, retrievedAt updates, status becomes stale!
    currentTime = new Date("2026-11-25T03:37:00Z"); // 52 min after 23:45 BRT
    const third = await service.getLatestObservation();
    assert.equal(fetchCalls, 2);
    assert.equal(third.status, "stale");
    assert.equal(third.ageMinutes, 52);
    assert.equal(third.retrievedAt, "2026-11-25T03:37:00.000Z");
  });

  it("fails closed to unavailable on timeout or HTTP 503 without mock fallback", async () => {
    let currentTime = new Date("2026-11-25T02:57:00Z");
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
        retrievedAt: "2026-11-25T02:57:00.000Z",
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
