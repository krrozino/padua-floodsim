import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import {
  DEFAULT_BOUNDARY_TOLERANCE_METERS,
  SGB_LOCATION_QUERY_METHOD_ID,
  evaluatePointAgainstFloodScenario,
  evaluatePointInComparison,
  formatLocationTechnicalSummary,
  getModelCoverageStatus,
  parseCoordinatePairText,
  parseLatLonFields,
  pointToSegmentDistanceMeters,
  summarizeCrossStagePointQuery,
  type GeoPoint,
} from "../../../lib/sgb/location.ts";
import {
  runCrossStagePointAnalysis,
  type SgbStageCache,
  type SgbStageGeometry,
} from "../../../lib/sgb/crossStageQuery.ts";
import { SGB_FLOOD_LEVELS_CM, type SgbFloodLevelCm } from "../../../lib/sgb/stages.ts";

function makeRectRing(
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number,
): [number, number][] {
  return [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
    [minLon, minLat],
  ];
}

function makePolygonFc(
  rings: [number, number][][],
): FeatureCollection<Polygon | MultiPolygon> {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: rings,
        },
      },
    ],
  };
}

describe("SGB geographic point query engine (lib/sgb/location.ts)", () => {
  const baseSquare = makePolygonFc([makeRectRing(-42.19, -21.54, -42.18, -21.53)]);

  it("classifies interior, exterior (in coverage & out of coverage), and boundary points accurately", () => {
    // Strictly interior
    const inside = evaluatePointAgainstFloodScenario(
      { lat: -21.535, lon: -42.185 },
      baseSquare,
      425,
    );
    assert.equal(inside.status, "valid");
    assert.equal(inside.classification, "derived");
    assert.equal(inside.method, SGB_LOCATION_QUERY_METHOD_ID);
    assert.equal(inside.relation, "inside");
    assert.equal(inside.isIntercepted, true);
    assert.equal(inside.coverageStatus, "within_model_coverage");

    // Strictly exterior but within published SGB AOI coverage
    const outsideInCov = evaluatePointAgainstFloodScenario(
      { lat: -21.525, lon: -42.17 },
      baseSquare,
      425,
    );
    assert.equal(outsideInCov.status, "valid");
    assert.equal(outsideInCov.relation, "outside");
    assert.equal(outsideInCov.isIntercepted, false);
    assert.equal(outsideInCov.coverageStatus, "within_model_coverage");
    assert.match(outsideInCov.safetyDisclaimer, /não declara imóvel seguro/i);

    // Strictly exterior AND outside known SGB model coverage
    const outsideCov = evaluatePointAgainstFloodScenario(
      { lat: -21.62, lon: -42.31 },
      baseSquare,
      425,
    );
    assert.equal(outsideCov.status, "valid");
    assert.equal(outsideCov.relation, "outside");
    assert.equal(outsideCov.isIntercepted, false);
    assert.equal(outsideCov.coverageStatus, "outside_model_coverage");
    assert.match(
      outsideCov.safetyDisclaimer,
      /fora da cobertura conhecida.*ausência de interseção não indica ausência de possibilidade de inundação/i,
    );

    // Exact edge & vertex boundary points
    const onEdge = evaluatePointAgainstFloodScenario(
      { lat: -21.535, lon: -42.19 },
      baseSquare,
      425,
    );
    assert.equal(onEdge.status, "valid");
    assert.equal(onEdge.relation, "boundary");
    assert.equal(onEdge.isIntercepted, true);

    const onVertex = evaluatePointAgainstFloodScenario(
      { lat: -21.54, lon: -42.19 },
      baseSquare,
      425,
    );
    assert.equal(onVertex.status, "valid");
    assert.equal(onVertex.relation, "boundary");

    // Near boundary within default tolerance (~0.2 m outside west edge)
    const offsetWithinTolDeg = 0.2 / 103_600;
    const nearEdge = evaluatePointAgainstFloodScenario(
      { lat: -21.535, lon: -42.19 - offsetWithinTolDeg },
      baseSquare,
      425,
    );
    assert.equal(nearEdge.status, "valid");
    assert.equal(nearEdge.relation, "boundary");
    assert.equal(nearEdge.boundaryToleranceMeters, DEFAULT_BOUNDARY_TOLERANCE_METERS);

    // Clearly outside boundary tolerance (~2.5 m outside west edge)
    const offsetBeyondTolDeg = 2.5 / 103_600;
    const beyondEdge = evaluatePointAgainstFloodScenario(
      { lat: -21.535, lon: -42.19 - offsetBeyondTolDeg },
      baseSquare,
      425,
    );
    assert.equal(beyondEdge.status, "valid");
    assert.equal(beyondEdge.relation, "outside");
  });

  it("handles diagonal boundaries accurately via WGS84 metric segment distance", () => {
    const triangle = makePolygonFc([
      [
        [-42.19, -21.54],
        [-42.18, -21.54],
        [-42.18, -21.53],
        [-42.19, -21.54],
      ],
    ]);
    // Midpoint on hypotenuse (-42.185, -21.535)
    const dist = pointToSegmentDistanceMeters(
      -42.185,
      -21.535,
      -42.19,
      -21.54,
      -42.18,
      -21.53,
    );
    assert.ok(dist < 1e-6);
    const res = evaluatePointAgainstFloodScenario(
      { lat: -21.535, lon: -42.185 },
      triangle,
      400,
    );
    assert.equal(res.relation, "boundary");
  });

  it("supports internal holes (dry islands) and MultiPolygons with union semantics", () => {
    const outer = makeRectRing(-42.19, -21.54, -42.18, -21.53);
    const hole = makeRectRing(-42.187, -21.537, -42.183, -21.533);
    const secondPart = makeRectRing(-42.175, -21.54, -42.165, -21.53);
    const multiFc: FeatureCollection<MultiPolygon> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "MultiPolygon",
            coordinates: [[outer, hole], [secondPart]],
          },
        },
      ],
    };

    // Inside flooded donut (between outer ring and hole)
    const inDonut = evaluatePointAgainstFloodScenario(
      { lat: -21.539, lon: -42.189 },
      multiFc,
      450,
    );
    assert.equal(inDonut.relation, "inside");

    // Inside dry island (hole) -> outside!
    const inHole = evaluatePointAgainstFloodScenario(
      { lat: -21.535, lon: -42.185 },
      multiFc,
      450,
    );
    assert.equal(inHole.relation, "outside");
    assert.equal(inHole.isIntercepted, false);

    // On boundary of the internal hole -> boundary!
    const onHoleEdge = evaluatePointAgainstFloodScenario(
      { lat: -21.535, lon: -42.187 },
      multiFc,
      450,
    );
    assert.equal(onHoleEdge.relation, "boundary");
    assert.equal(onHoleEdge.isIntercepted, true);

    // Inside second MultiPolygon part -> inside!
    const inSecondPart = evaluatePointAgainstFloodScenario(
      { lat: -21.535, lon: -42.17 },
      multiFc,
      450,
    );
    assert.equal(inSecondPart.relation, "inside");

    // Overlapping features: point on boundary of feature 1 AND strictly inside feature 2 -> inside (union)
    const overlappingFc: FeatureCollection<Polygon> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [makeRectRing(-42.19, -21.54, -42.18, -21.53)],
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [makeRectRing(-42.185, -21.54, -42.175, -21.53)],
          },
        },
      ],
    };
    const onSeamInside = evaluatePointAgainstFloodScenario(
      { lat: -21.535, lon: -42.18 },
      overlappingFc,
      450,
    );
    assert.equal(onSeamInside.relation, "inside");
  });

  it("fails closed to unavailable on missing, empty, or partially invalid geometries and invalid coordinates", () => {
    const pt: GeoPoint = { lat: -21.535, lon: -42.185 };

    // Missing GeoJSON
    assert.equal(
      evaluatePointAgainstFloodScenario(pt, null, 425).relation,
      "unavailable",
    );

    // Empty FeatureCollection
    const emptyFc: FeatureCollection<Polygon> = {
      type: "FeatureCollection",
      features: [],
    };
    assert.equal(
      evaluatePointAgainstFloodScenario(pt, emptyFc, 425).relation,
      "unavailable",
    );

    // Partially invalid polygon (valid outer ring + degenerate hole) -> must fail closed!
    const invalidHoleFc = makePolygonFc([
      makeRectRing(-42.19, -21.54, -42.18, -21.53),
      [
        [-42.186, -21.536],
        [-42.185, -21.536],
        [-42.186, -21.536],
      ],
    ]);
    const invalidRes = evaluatePointAgainstFloodScenario(pt, invalidHoleFc, 425);
    assert.equal(invalidRes.status, "unavailable");
    assert.equal(invalidRes.relation, "unavailable");

    // Invalid coordinates
    const badCoord = evaluatePointAgainstFloodScenario(
      { lat: 120, lon: -42.18 },
      baseSquare,
      425,
    );
    assert.equal(badCoord.status, "unavailable");
    assert.equal(badCoord.relation, "unavailable");
  });

  it("supports A/B comparison mode for non-nested scenarios and fails closed if either side is unavailable", () => {
    const geomA = makePolygonFc([makeRectRing(-42.19, -21.54, -42.18, -21.53)]);
    const geomB = makePolygonFc([makeRectRing(-42.185, -21.54, -42.175, -21.53)]);

    // Only A (A \ B)
    const onlyA = evaluatePointInComparison(
      { lat: -21.535, lon: -42.188 },
      geomA,
      400,
      geomB,
      500,
    );
    assert.equal(onlyA.status, "valid");
    assert.equal(onlyA.combinedRelation, "only_a");
    assert.equal(onlyA.relationA, "inside");
    assert.equal(onlyA.relationB, "outside");

    // Both (A ∩ B), with boundary on B
    const bothBoundary = evaluatePointInComparison(
      { lat: -21.535, lon: -42.185 },
      geomA,
      400,
      geomB,
      500,
    );
    assert.equal(bothBoundary.status, "valid");
    assert.equal(bothBoundary.combinedRelation, "both");
    assert.equal(bothBoundary.relationA, "inside");
    assert.equal(bothBoundary.relationB, "boundary");

    // Only B (B \ A)
    const onlyB = evaluatePointInComparison(
      { lat: -21.535, lon: -42.177 },
      geomA,
      400,
      geomB,
      500,
    );
    assert.equal(onlyB.combinedRelation, "only_b");

    // Neither
    const neither = evaluatePointInComparison(
      { lat: -21.52, lon: -42.16 },
      geomA,
      400,
      geomB,
      500,
    );
    assert.equal(neither.combinedRelation, "neither");

    // Unavailable B -> fail closed!
    const unavailable = evaluatePointInComparison(
      { lat: -21.535, lon: -42.188 },
      geomA,
      400,
      null,
      500,
    );
    assert.equal(unavailable.status, "unavailable");
    assert.equal(unavailable.combinedRelation, "unavailable");
    assert.equal(unavailable.relationA, "inside");
    assert.equal(unavailable.relationB, "unavailable");
  });

  it("summarizes 11 stages without interpolation or nesting assumptions and detects non-nested patterns", () => {
    const pt: GeoPoint = { lat: -21.535, lon: -42.185 };
    assert.equal(getModelCoverageStatus(pt), "within_model_coverage");

    // Non-nested: 375 inside, 400 outside, 425 boundary, 450..550 inside
    const nonNested = summarizeCrossStagePointQuery(pt, {
      300: { status: "evaluated", relation: "outside" },
      325: { status: "evaluated", relation: "outside" },
      350: { status: "evaluated", relation: "outside" },
      375: { status: "evaluated", relation: "inside" },
      400: { status: "evaluated", relation: "outside" },
      425: { status: "evaluated", relation: "boundary" },
      450: { status: "evaluated", relation: "inside" },
      475: { status: "evaluated", relation: "inside" },
      500: { status: "evaluated", relation: "inside" },
      525: { status: "evaluated", relation: "inside" },
      550: { status: "evaluated", relation: "inside" },
    });

    assert.equal(nonNested.isComplete, true);
    assert.equal(nonNested.lowestInterceptedLevelCm, 375);
    assert.deepEqual(nonNested.interceptedLevelsCm, [375, 425, 450, 475, 500, 525, 550]);
    assert.deepEqual(nonNested.boundaryLevelsCm, [425]);
    assert.equal(nonNested.hasNonNestedPattern, true);
    assert.deepEqual(nonNested.nonNestedTransitions, [
      { lowerInterceptedCm: 375, higherOutsideCm: 400 },
    ]);
    assert.match(
      nonNested.lowestStageDistinctionNote,
      /menor cota identificada.*não corresponde necessariamente ao início real/i,
    );

    // Lowest stage 300 cm -> explicit note that no scenario exists below 300 cm
    const at300 = summarizeCrossStagePointQuery(pt, {
      300: { status: "evaluated", relation: "inside" },
      325: { status: "evaluated", relation: "inside" },
      350: { status: "evaluated", relation: "inside" },
      375: { status: "evaluated", relation: "inside" },
      400: { status: "evaluated", relation: "inside" },
      425: { status: "evaluated", relation: "inside" },
      450: { status: "evaluated", relation: "inside" },
      475: { status: "evaluated", relation: "inside" },
      500: { status: "evaluated", relation: "inside" },
      525: { status: "evaluated", relation: "inside" },
      550: { status: "evaluated", relation: "inside" },
    });
    assert.equal(at300.lowestInterceptedLevelCm, 300);
    assert.match(at300.lowestStageDistinctionNote, /abaixo de 300 cm/i);

    // Partial failure warns user that lower failed stages are not ruled out
    const partial = summarizeCrossStagePointQuery(pt, {
      300: { status: "error", relation: "unavailable", reason: "HTTP 502" },
      325: { status: "evaluated", relation: "outside" },
      350: { status: "evaluated", relation: "inside" },
    });
    assert.equal(partial.isComplete, false);
    assert.deepEqual(partial.failedLevelsCm, [300]);
    assert.equal(partial.lowestInterceptedLevelCm, 350);
    assert.match(partial.lowestStageDistinctionNote, /não verificados|falha/i);
  });

  it("parses coordinate formats cleanly, detects swapped Pádua inputs without silently swapping, and formats privacy-safe technical summaries", () => {
    const parsedDot = parseCoordinatePairText("-21.5390, -42.1800");
    assert.equal(parsedDot.ok, true);
    if (parsedDot.ok) {
      assert.equal(parsedDot.point.lat, -21.539);
      assert.equal(parsedDot.point.lon, -42.18);
      assert.equal(parsedDot.likelySwappedPadua, false);
    }

    const parsedPtBr = parseCoordinatePairText("-21,5390; -42,1800");
    assert.equal(parsedPtBr.ok, true);
    if (parsedPtBr.ok) {
      assert.equal(parsedPtBr.point.lat, -21.539);
      assert.equal(parsedPtBr.point.lon, -42.18);
    }

    // Swapped Pádua coordinates -> flagged explicitly, NOT silently swapped!
    const swapped = parseLatLonFields("-42.1800", "-21.5390");
    assert.equal(swapped.ok, true);
    if (swapped.ok) {
      assert.equal(swapped.point.lat, -42.18);
      assert.equal(swapped.point.lon, -21.539);
      assert.equal(swapped.likelySwappedPadua, true);
    }

    // Invalid inputs fail closed
    assert.equal(parseLatLonFields("abc", "-42.18").ok, false);
    assert.equal(parseLatLonFields("-95", "-42.18").ok, false);
    assert.equal(parseLatLonFields("-21.53", "-190").ok, false);
    assert.equal(parseCoordinatePairText("-21,5390, -42,1800").ok, false);

    // Privacy-safe technical summary
    const summary = formatLocationTechnicalSummary({
      point: { lat: -21.539, lon: -42.18 },
      mode: "single",
      levelACm: 425,
      relationLabel: "Interceptado (interior)",
      lowestInterceptedLevelCm: 375,
      consultedDateIso: "2026-11-25T18:00:00Z",
    });
    assert.match(summary, /58790002/);
    assert.match(summary, /-21\.53900, -42\.18000/);
    assert.match(summary, /não declara imóvel seguro/i);
    assert.match(summary, /não equivale ao início real de inundação/i);
  });
});

describe("Cross-stage bounded-concurrency orchestrator (lib/sgb/crossStageQuery.ts)", () => {
  function makeStageGeoJson(levelCm: SgbFloodLevelCm): SgbStageGeometry {
    // Stage >= 400 covers (-42.185, -21.535), except 450 shifted (non-nested!)
    const minLon = levelCm >= 400 && levelCm !== 450 ? -42.19 : -42.2;
    const maxLon = levelCm >= 400 && levelCm !== 450 ? -42.18 : -42.195;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { levelCm },
          geometry: {
            type: "Polygon",
            coordinates: [makeRectRing(minLon, -21.54, maxLon, -21.53)],
          },
        },
      ],
    };
  }

  it("enforces bounded concurrency, reuses preloaded and cached stages, and handles partial failures without caching errors", async () => {
    const cache: SgbStageCache = new Map();
    const fetchedLevels: number[] = [];
    let activeFetches = 0;
    let maxObservedConcurrency = 0;
    let failLevel475 = true;

    const fakeFetch: typeof fetch = async (input) => {
      const url = new URL(String(input), "http://localhost");
      const level = Number(url.searchParams.get("level")) as SgbFloodLevelCm;
      fetchedLevels.push(level);
      activeFetches += 1;
      if (activeFetches > maxObservedConcurrency) {
        maxObservedConcurrency = activeFetches;
      }
      await new Promise((r) => setTimeout(r, 8));
      activeFetches -= 1;

      if (level === 475 && failLevel475) {
        return new Response(JSON.stringify({ error: "upstream" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          classification: "official_reference",
          levelCm: level,
          layerName: `COTA_${level}cm`,
          geojson: makeStageGeoJson(level),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const progressEvents: number[] = [];
    const res1 = await runCrossStagePointAnalysis({
      point: { lat: -21.535, lon: -42.185 },
      cache,
      preloaded: { 425: makeStageGeoJson(425) },
      concurrency: 3,
      fetcher: fakeFetch,
      onProgress: (p) => progressEvents.push(p.completed),
    });

    assert.equal(res1.status, "completed");
    if (res1.status === "completed") {
      // Concurrency strictly bounded to <= 3
      assert.ok(maxObservedConcurrency <= 3, `Expected <=3, got ${maxObservedConcurrency}`);
      // Preloaded 425 was NOT fetched over the network -> 10 network fetches
      assert.equal(fetchedLevels.length, 10);
      assert.equal(fetchedLevels.includes(425), false);
      assert.equal(res1.cachedHits, 1);
      assert.equal(res1.fetchedCount, 9);
      assert.equal(res1.failedCount, 1);
      assert.equal(res1.summary.lowestInterceptedLevelCm, 400);
      assert.equal(res1.summary.hasNonNestedPattern, true); // 400/425 inside, 450 outside!
      assert.deepEqual(res1.summary.failedLevelsCm, [475]);
      // Failed 475 must NOT be in cache
      assert.equal(cache.has(475), false);
      assert.equal(progressEvents[progressEvents.length - 1], 11);
    }

    // Second run on a NEW point (after 475 recovers) should only fetch 475 and 425 (preloaded wasn't cached in map unless fetched; wait: preloaded is passed again)
    failLevel475 = false;
    fetchedLevels.length = 0;
    const res2 = await runCrossStagePointAnalysis({
      point: { lat: -21.535, lon: -42.197 },
      cache,
      preloaded: { 425: makeStageGeoJson(425) },
      concurrency: 3,
      fetcher: fakeFetch,
    });
    assert.equal(res2.status, "completed");
    if (res2.status === "completed") {
      // Only previously failed 475 had to be fetched!
      assert.deepEqual(fetchedLevels, [475]);
      assert.equal(res2.cachedHits, 10);
      assert.equal(res2.fetchedCount, 1);
      assert.equal(res2.summary.isComplete, true);
    }
  });

  it("discards stale out-of-order responses cleanly when aborted by a newer point query", async () => {
    const cache: SgbStageCache = new Map();
    const resolvers = new Map<number, () => void>();

    const slowFetch: typeof fetch = async (input, init) => {
      const url = new URL(String(input), "http://localhost");
      const level = Number(url.searchParams.get("level")) as SgbFloodLevelCm;
      await new Promise<void>((resolve, reject) => {
        if (init?.signal?.aborted) {
          reject(new Error("Aborted"));
          return;
        }
        resolvers.set(level, resolve);
        // Intentionally do NOT reject immediately on abort to simulate an
        // in-flight response resolving AFTER abort (true out-of-order arrival).
      });
      return new Response(
        JSON.stringify({
          classification: "official_reference",
          levelCm: level,
          layerName: `COTA_${level}cm`,
          geojson: makeStageGeoJson(level),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const controllerA = new AbortController();
    const staleProgressAfterAbort: number[] = [];
    let abortedAt = false;

    const runA = runCrossStagePointAnalysis({
      point: { lat: -21.535, lon: -42.185 },
      cache,
      levels: [300, 325, 350] as readonly SgbFloodLevelCm[],
      concurrency: 2,
      signal: controllerA.signal,
      fetcher: slowFetch,
      onProgress: (p) => {
        if (abortedAt) staleProgressAfterAbort.push(p.completed);
      },
    });

    // Wait a tick so initial 2 workers enter slowFetch
    await new Promise((r) => setTimeout(r, 10));
    abortedAt = true;
    controllerA.abort();

    // Now release the slow promises out of order!
    for (const resolve of resolvers.values()) {
      resolve();
    }

    const resultA = await runA;
    assert.equal(resultA.status, "aborted");
    assert.deepEqual(staleProgressAfterAbort, []);
    // Aborted run must never pollute cache or leak progress callbacks
    assert.equal(cache.size, 0);
  });

  it("evaluates all 11 official SGB stage levels in canonical order", () => {
    assert.equal(SGB_FLOOD_LEVELS_CM.length, 11);
    assert.equal(SGB_FLOOD_LEVELS_CM[0], 300);
    assert.equal(SGB_FLOOD_LEVELS_CM[10], 550);
  });
});
