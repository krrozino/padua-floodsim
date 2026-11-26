import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import {
  DEFAULT_BOUNDARY_TOLERANCE_METERS,
  SGB_LOCATION_QUERY_METHOD_ID,
  assessPointSpatialCoverage,
  evaluatePointAgainstFloodScenario,
  evaluatePointInComparison,
  formatLocationTechnicalSummary,
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

  it("distinguishes auxiliary MapServer envelope, unknown hydraulic domain, validated domain, and queried-geometry relation", () => {
    // 1. Strictly interior to queried geometry, inside auxiliary MapServer bbox -> hydraulicDomainStatus MUST be "unknown"
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
    assert.equal(inside.envelopeStatus, "within_mapserver_envelope");
    assert.equal(inside.hydraulicDomainStatus, "unknown");
    assert.match(inside.safetyDisclaimer, /envelope retangular do MapServer é auxiliar/i);

    // 2. Exterior to queried geometry, inside auxiliary MapServer bbox -> unknown hydraulic domain + never declares safe
    const outsideInEnvelope = evaluatePointAgainstFloodScenario(
      { lat: -21.525, lon: -42.17 },
      baseSquare,
      425,
    );
    assert.equal(outsideInEnvelope.status, "valid");
    assert.equal(outsideInEnvelope.relation, "outside");
    assert.equal(outsideInEnvelope.isIntercepted, false);
    assert.equal(outsideInEnvelope.envelopeStatus, "within_mapserver_envelope");
    assert.equal(outsideInEnvelope.hydraulicDomainStatus, "unknown");
    assert.match(outsideInEnvelope.safetyDisclaimer, /não declara imóvel seguro/i);

    // 3. Outside auxiliary MapServer envelope -> outside_model_extent + explicit caveat
    const outsideEnvelope = evaluatePointAgainstFloodScenario(
      { lat: -21.62, lon: -42.31 },
      baseSquare,
      425,
    );
    assert.equal(outsideEnvelope.status, "valid");
    assert.equal(outsideEnvelope.relation, "outside");
    assert.equal(outsideEnvelope.isIntercepted, false);
    assert.equal(outsideEnvelope.envelopeStatus, "outside_mapserver_envelope");
    assert.equal(outsideEnvelope.hydraulicDomainStatus, "outside_model_extent");
    assert.match(
      outsideEnvelope.safetyDisclaimer,
      /fora do envelope auxiliar.*ausência de interseção.*não indica ausência de possibilidade de inundação/i,
    );

    // 4. Explicit validated hydraulic domain polygon -> "covered" inside, "outside_model_extent" outside
    const domainPoly = makePolygonFc([makeRectRing(-42.195, -21.545, -42.175, -21.525)]);
    const coveredAssessment = assessPointSpatialCoverage(
      { lat: -21.535, lon: -42.185 },
      { kind: "polygon", geometry: domainPoly, label: "Domínio validado teste" },
    );
    assert.equal(coveredAssessment.hydraulicDomainStatus, "covered");

    const outsideDomainAssessment = assessPointSpatialCoverage(
      { lat: -21.52, lon: -42.16 },
      { kind: "polygon", geometry: domainPoly, label: "Domínio validado teste" },
    );
    assert.equal(outsideDomainAssessment.envelopeStatus, "within_mapserver_envelope");
    assert.equal(outsideDomainAssessment.hydraulicDomainStatus, "outside_model_extent");
  });

  it("treats ±0.5 m boundary tolerance explicitly as a geometric proximity band rather than physical flood accuracy", () => {
    const onEdge = evaluatePointAgainstFloodScenario(
      { lat: -21.535, lon: -42.19 },
      baseSquare,
      425,
    );
    assert.equal(onEdge.status, "valid");
    assert.equal(onEdge.relation, "boundary");
    assert.equal(onEdge.isIntercepted, true);
    assert.equal(onEdge.boundaryToleranceMeters, DEFAULT_BOUNDARY_TOLERANCE_METERS);
    assert.match(
      onEdge.boundarySemanticsNote,
      /faixa de proximidade geométrica.*não representa precisão física/i,
    );

    const onVertex = evaluatePointAgainstFloodScenario(
      { lat: -21.54, lon: -42.19 },
      baseSquare,
      425,
    );
    assert.equal(onVertex.relation, "boundary");

    // Near boundary within default tolerance (~0.2 m outside west edge)
    const offsetWithinTolDeg = 0.2 / 103_600;
    const nearEdge = evaluatePointAgainstFloodScenario(
      { lat: -21.535, lon: -42.19 - offsetWithinTolDeg },
      baseSquare,
      425,
    );
    assert.equal(nearEdge.relation, "boundary");

    // Beyond boundary tolerance (~2.5 m outside west edge)
    const offsetBeyondTolDeg = 2.5 / 103_600;
    const beyondEdge = evaluatePointAgainstFloodScenario(
      { lat: -21.535, lon: -42.19 - offsetBeyondTolDeg },
      baseSquare,
      425,
    );
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

    assert.equal(
      evaluatePointAgainstFloodScenario(
        { lat: -21.539, lon: -42.189 },
        multiFc,
        450,
      ).relation,
      "inside",
    );
    assert.equal(
      evaluatePointAgainstFloodScenario(
        { lat: -21.535, lon: -42.185 },
        multiFc,
        450,
      ).relation,
      "outside",
    );
    assert.equal(
      evaluatePointAgainstFloodScenario(
        { lat: -21.535, lon: -42.187 },
        multiFc,
        450,
      ).relation,
      "boundary",
    );
    assert.equal(
      evaluatePointAgainstFloodScenario(
        { lat: -21.535, lon: -42.17 },
        multiFc,
        450,
      ).relation,
      "inside",
    );

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
    assert.equal(
      evaluatePointAgainstFloodScenario(
        { lat: -21.535, lon: -42.18 },
        overlappingFc,
        450,
      ).relation,
      "inside",
    );
  });

  it("fails closed to unavailable on missing, empty, or partially invalid geometries and invalid coordinates", () => {
    const pt: GeoPoint = { lat: -21.535, lon: -42.185 };

    assert.equal(
      evaluatePointAgainstFloodScenario(pt, null, 425).relation,
      "unavailable",
    );

    const emptyFc: FeatureCollection<Polygon> = {
      type: "FeatureCollection",
      features: [],
    };
    assert.equal(
      evaluatePointAgainstFloodScenario(pt, emptyFc, 425).relation,
      "unavailable",
    );

    const invalidHoleFc = makePolygonFc([
      makeRectRing(-42.19, -21.54, -42.18, -21.53),
      [
        [-42.186, -21.536],
        [-42.185, -21.536],
        [-42.186, -21.536],
      ],
    ]);
    assert.equal(
      evaluatePointAgainstFloodScenario(pt, invalidHoleFc, 425).status,
      "unavailable",
    );

    assert.equal(
      evaluatePointAgainstFloodScenario(
        { lat: 120, lon: -42.18 },
        baseSquare,
        425,
      ).status,
      "unavailable",
    );
  });

  it("supports A/B comparison mode with boundary proximity disclosure and fails closed if either side is unavailable", () => {
    const geomA = makePolygonFc([makeRectRing(-42.19, -21.54, -42.18, -21.53)]);
    const geomB = makePolygonFc([makeRectRing(-42.185, -21.54, -42.175, -21.53)]);

    const onlyA = evaluatePointInComparison(
      { lat: -21.535, lon: -42.188 },
      geomA,
      400,
      geomB,
      500,
    );
    assert.equal(onlyA.status, "valid");
    assert.equal(onlyA.combinedRelation, "only_a");
    assert.equal(onlyA.involvesBoundaryProximity, false);

    // Boundary on B -> explicitly flags involvesBoundaryProximity and includes proximity semantics note
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
    assert.equal(bothBoundary.involvesBoundaryProximity, true);
    assert.match(
      bothBoundary.boundarySemanticsNote,
      /faixa de proximidade geométrica.*não representa precisão física/i,
    );

    const onlyB = evaluatePointInComparison(
      { lat: -21.535, lon: -42.177 },
      geomA,
      400,
      geomB,
      500,
    );
    assert.equal(onlyB.combinedRelation, "only_b");

    const neither = evaluatePointInComparison(
      { lat: -21.52, lon: -42.16 },
      geomA,
      400,
      geomB,
      500,
    );
    assert.equal(neither.combinedRelation, "neither");
    assert.equal(neither.hydraulicDomainStatus, "unknown");

    const unavailable = evaluatePointInComparison(
      { lat: -21.535, lon: -42.188 },
      geomA,
      400,
      null,
      500,
    );
    assert.equal(unavailable.status, "unavailable");
    assert.equal(unavailable.combinedRelation, "unavailable");
  });

  it("summarizes 11 stages without interpolation or nesting assumptions and discloses boundary proximity on lowest identified stage", () => {
    const pt: GeoPoint = { lat: -21.535, lon: -42.185 };

    // Lowest intercepted stage (375 cm) is on boundary + non-nested at 400 cm
    const nonNestedBoundary = summarizeCrossStagePointQuery(pt, {
      300: { status: "evaluated", relation: "outside" },
      325: { status: "evaluated", relation: "outside" },
      350: { status: "evaluated", relation: "outside" },
      375: { status: "evaluated", relation: "boundary" },
      400: { status: "evaluated", relation: "outside" },
      425: { status: "evaluated", relation: "inside" },
      450: { status: "evaluated", relation: "inside" },
      475: { status: "evaluated", relation: "inside" },
      500: { status: "evaluated", relation: "inside" },
      525: { status: "evaluated", relation: "inside" },
      550: { status: "evaluated", relation: "inside" },
    });

    assert.equal(nonNestedBoundary.isComplete, true);
    assert.equal(nonNestedBoundary.envelopeStatus, "within_mapserver_envelope");
    assert.equal(nonNestedBoundary.hydraulicDomainStatus, "unknown");
    assert.equal(nonNestedBoundary.lowestInterceptedLevelCm, 375);
    assert.equal(nonNestedBoundary.lowestInterceptedRelation, "boundary");
    assert.deepEqual(
      nonNestedBoundary.interceptedLevelsCm,
      [375, 425, 450, 475, 500, 525, 550],
    );
    assert.equal(nonNestedBoundary.hasNonNestedPattern, true);
    assert.deepEqual(nonNestedBoundary.nonNestedTransitions, [
      { lowerInterceptedCm: 375, higherOutsideCm: 400 },
    ]);
    assert.match(
      nonNestedBoundary.lowestStageDistinctionNote,
      /faixa de proximidade geométrica.*não representa precisão física/i,
    );

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

    const partial = summarizeCrossStagePointQuery(pt, {
      300: { status: "error", relation: "unavailable", reason: "HTTP 502" },
      325: { status: "evaluated", relation: "outside" },
      350: { status: "evaluated", relation: "inside" },
    });
    assert.equal(partial.isComplete, false);
    assert.deepEqual(partial.failedLevelsCm, [300]);
    assert.match(partial.lowestStageDistinctionNote, /não verificados|falha/i);
  });

  it("parses coordinate formats cleanly and formats privacy-safe technical summary with envelope/domain & boundary proximity caveats", () => {
    const parsedDot = parseCoordinatePairText("-21.5390, -42.1800");
    assert.equal(parsedDot.ok, true);
    if (parsedDot.ok) {
      assert.equal(parsedDot.point.lat, -21.539);
      assert.equal(parsedDot.point.lon, -42.18);
      assert.equal(parsedDot.likelySwappedPadua, false);
    }

    const parsedPtBr = parseCoordinatePairText("-21,5390; -42,1800");
    assert.equal(parsedPtBr.ok, true);

    const swapped = parseLatLonFields("-42.1800", "-21.5390");
    assert.equal(swapped.ok, true);
    if (swapped.ok) {
      assert.equal(swapped.point.lat, -42.18);
      assert.equal(swapped.likelySwappedPadua, true);
    }

    assert.equal(parseLatLonFields("abc", "-42.18").ok, false);
    assert.equal(parseLatLonFields("-95", "-42.18").ok, false);
    assert.equal(parseLatLonFields("-21.53", "-190").ok, false);

    const summary = formatLocationTechnicalSummary({
      point: { lat: -21.539, lon: -42.18 },
      mode: "single",
      levelACm: 425,
      relationLabel: "Ponto na faixa de proximidade da fronteira (±0,5 m)",
      lowestInterceptedLevelCm: 375,
      lowestInterceptedRelation: "boundary",
      consultedDateIso: "2026-11-25T18:00:00Z",
    });
    assert.match(summary, /58790002/);
    assert.match(summary, /envelope auxiliar do MapServer SGB/i);
    assert.match(summary, /Domínio hidráulico desconhecido/i);
    assert.match(summary, /faixa de proximidade geométrica.*não representa precisão física/i);
    assert.match(summary, /não declara imóvel seguro/i);
    assert.match(summary, /não equivale ao início real de inundação/i);
  });
});

describe("Cross-stage bounded-concurrency orchestrator (lib/sgb/crossStageQuery.ts)", () => {
  function makeStageGeoJson(levelCm: SgbFloodLevelCm): SgbStageGeometry {
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
      maxObservedConcurrency = Math.max(maxObservedConcurrency, activeFetches);
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
      assert.ok(maxObservedConcurrency <= 3);
      assert.equal(fetchedLevels.length, 10);
      assert.equal(fetchedLevels.includes(425), false);
      assert.equal(res1.cachedHits, 1);
      assert.equal(res1.fetchedCount, 9);
      assert.equal(res1.failedCount, 1);
      assert.equal(res1.summary.lowestInterceptedLevelCm, 400);
      assert.equal(res1.summary.hasNonNestedPattern, true);
      assert.deepEqual(res1.summary.failedLevelsCm, [475]);
      assert.equal(cache.has(475), false);
      assert.equal(progressEvents.at(-1), 11);
    }

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
      assert.deepEqual(fetchedLevels, [475]);
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

    await new Promise((r) => setTimeout(r, 10));
    abortedAt = true;
    controllerA.abort();

    for (const resolve of resolvers.values()) {
      resolve();
    }

    const resultA = await runA;
    assert.equal(resultA.status, "aborted");
    assert.deepEqual(staleProgressAfterAbort, []);
    assert.equal(cache.size, 0);
  });

  it("evaluates all 11 official SGB stage levels in canonical order", () => {
    assert.equal(SGB_FLOOD_LEVELS_CM.length, 11);
    assert.equal(SGB_FLOOD_LEVELS_CM[0], 300);
    assert.equal(SGB_FLOOD_LEVELS_CM[10], 550);
  });
});
