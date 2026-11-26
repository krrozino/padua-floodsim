import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import {
  OSM_ROAD_ATTRIBUTION,
  OSM_ROAD_LICENSE,
  SGB_ROAD_EXPOSURE_METHOD_ID,
  computeGeodesicLineLengthMeters,
  computeGeodesicSegmentLengthMeters,
  evaluateRoadExposure,
  normalizeRoadName,
  type RoadNetworkInput,
} from "../../../lib/sgb/roads.ts";

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

function makeFloodFc(
  polys: [number, number][][][],
): FeatureCollection<Polygon | MultiPolygon> {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiPolygon",
          coordinates: polys,
        },
      },
    ],
  };
}

describe("WGS84 geodesic linear length & road-exposure GIS engine (lib/sgb/roads.ts)", () => {
  it("computes WGS84 ellipsoidal geodesic lengths accurately near Santo Antônio de Pádua", () => {
    // 0.01° latitude at -21.535° on WGS84 ≈ 1,107.25 m
    const nsMeters = computeGeodesicSegmentLengthMeters(
      -42.18,
      -21.54,
      -42.18,
      -21.53,
    );
    assert.ok(
      Math.abs(nsMeters - 1107.25) < 0.5,
      `Expected ~1107.25 m, got ${nsMeters}`,
    );

    // 0.01° longitude at -21.535° on WGS84 ≈ 1,035.94 m
    const ewMeters = computeGeodesicSegmentLengthMeters(
      -42.19,
      -21.535,
      -42.18,
      -21.535,
    );
    assert.ok(
      Math.abs(ewMeters - 1035.94) < 0.5,
      `Expected ~1035.94 m, got ${ewMeters}`,
    );

    // Multi-vertex polyline equals sum of segments
    const polyLen = computeGeodesicLineLengthMeters([
      [-42.19, -21.54],
      [-42.18, -21.54],
      [-42.18, -21.53],
    ]);
    assert.ok(Math.abs(polyLen - (ewMeters + nsMeters)) < 0.5);
  });

  it("normalizes Brazilian road names deterministically for deduplication", () => {
    assert.equal(
      normalizeRoadName("Av. Dr. Temístocles de Almeida"),
      "avenida doutor temistocles de almeida",
    );
    assert.equal(
      normalizeRoadName("AVENIDA DOUTOR TEMISTOCLES DE ALMEIDA"),
      "avenida doutor temistocles de almeida",
    );
    assert.equal(
      normalizeRoadName("R. Cel. Olivier"),
      "rua coronel olivier",
    );
    assert.equal(
      normalizeRoadName("Pça. Pereira Lima"),
      "praca pereira lima",
    );
    assert.equal(normalizeRoadName("   "), null);
    assert.equal(normalizeRoadName(null), null);
  });

  it("clips road axes accurately against Polygons with holes (dry islands) and MultiPolygons", () => {
    // Outer flooded box: lon [-42.190, -42.180], lat [-21.540, -21.530]
    // Dry island (hole): lon [-42.187, -42.183], lat [-21.538, -21.532]
    const flood = makeFloodFc([
      [
        makeRectRing(-42.19, -21.54, -42.18, -21.53),
        makeRectRing(-42.187, -21.538, -42.183, -21.532),
      ],
    ]);

    // Straight road crossing horizontally at lat = -21.535 from -42.192 to -42.178:
    // Covered intervals: [-42.190, -42.187] (0.003°) AND [-42.183, -42.180] (0.003°) -> total 0.006° (2 continuous segments!)
    const expectedCoveredM =
      computeGeodesicSegmentLengthMeters(-42.19, -21.535, -42.187, -21.535) +
      computeGeodesicSegmentLengthMeters(-42.183, -21.535, -42.18, -21.535);
    const expectedTotalM = computeGeodesicSegmentLengthMeters(
      -42.192,
      -21.535,
      -42.178,
      -21.535,
    );

    const network: RoadNetworkInput = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: 1,
          properties: {
            highway: "residential",
            name: "Rua Exemplo",
          },
          geometry: {
            type: "LineString",
            coordinates: [
              [-42.192, -21.535],
              [-42.178, -21.535],
            ],
          },
        },
      ],
    };

    const res = evaluateRoadExposure(network, flood, 425);
    assert.equal(res.status, "valid");
    if (res.status === "valid") {
      assert.equal(res.method, SGB_ROAD_EXPOSURE_METHOD_ID);
      assert.equal(res.roadSourceLicense, OSM_ROAD_LICENSE);
      assert.equal(res.roadAttribution, OSM_ROAD_ATTRIBUTION);
      assert.ok(
        Math.abs(res.totalInterceptedLengthMeters - expectedCoveredM) < 0.05,
        `Expected ${expectedCoveredM.toFixed(2)} m, got ${res.totalInterceptedLengthMeters.toFixed(2)} m`,
      );
      // Crossing a hole splits 1 LineString into 2 continuous intercepted segments!
      assert.equal(res.interceptedSegmentCount, 2);
      assert.equal(res.identifiableRoadCount, 1);
      assert.equal(res.roads[0].denominatorStatus, "complete_in_coverage");
      const expectedPct = (expectedCoveredM / expectedTotalM) * 100;
      assert.ok(
        res.roads[0].interceptedPercent !== null &&
          Math.abs(res.roads[0].interceptedPercent - expectedPct) < 0.05,
      );
      // Semantic guardrails always enforced
      assert.equal(res.semanticGuardrails.doesNotIndicateBlockage, true);
      assert.equal(res.semanticGuardrails.doesNotIndicateDepth, true);
      assert.equal(res.semanticGuardrails.doesNotIndicateDamage, true);
      assert.equal(
        res.semanticGuardrails.doesNotIndicateTrafficImpossibility,
        true,
      );
    }
  });

  it("deduplicates multi-segment roads, separates bridges, suppresses percentage for truncated denominators, and enforces public-UI quality/license gates", () => {
    const flood = makeFloodFc([[makeRectRing(-42.19, -21.54, -42.18, -21.53)]]);

    const network: RoadNetworkInput = {
      type: "FeatureCollection",
      features: [
        // Segment 1 of Av. Getúlio Vargas (inside coverage, completely inside flood)
        {
          type: "Feature",
          id: 10,
          properties: { highway: "primary", name: "Av. Getúlio Vargas" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-42.189, -21.535],
              [-42.185, -21.535],
            ],
          },
        },
        // Segment 2 of same road with spelling variant (extends outside flood, still inside coverage)
        {
          type: "Feature",
          id: 11,
          properties: { highway: "primary", name: "Avenida Getulio Vargas" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-42.185, -21.535],
              [-42.175, -21.535],
            ],
          },
        },
        // Highway with ref only, extending OUTSIDE the SGB coverage bbox -> incomplete denominator (percent must be null!)
        {
          type: "Feature",
          id: 12,
          properties: { highway: "trunk", ref: "RJ-186" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-42.22, -21.535], // outside SGB AOI minLon (-42.209)
              [-42.185, -21.535],
            ],
          },
        },
        // Unnamed residential street (increases unnamed ratio -> blocks public UI!)
        {
          type: "Feature",
          id: 13,
          properties: { highway: "residential" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-42.189, -21.532],
              [-42.181, -21.532],
            ],
          },
        },
        // Bridge crossing over the flood polygon -> excluded from surface totals, reported separately!
        {
          type: "Feature",
          id: 14,
          properties: {
            highway: "residential",
            name: "Ponte Raul Veiga",
            bridge: "yes",
          },
          geometry: {
            type: "LineString",
            coordinates: [
              [-42.188, -21.539],
              [-42.182, -21.539],
            ],
          },
        },
      ],
    };

    const res = evaluateRoadExposure(network, flood, 425);
    assert.equal(res.status, "valid");
    if (res.status === "valid") {
      // 2 unique identifiable non-bridge roads: Av. Getúlio Vargas (deduplicated from 2 segments) + RJ-186 (ref)
      assert.equal(res.identifiableRoadCount, 2);

      const gv = res.roads.find(
        (r) => r.canonicalKey === "name:avenida getulio vargas",
      );
      assert.ok(gv);
      assert.equal(gv.rawNameVariants.length, 2);
      assert.equal(gv.denominatorStatus, "complete_in_coverage");
      assert.ok(gv.interceptedPercent !== null && gv.interceptedPercent > 60 && gv.interceptedPercent < 70);

      const rj186 = res.roads.find((r) => r.canonicalKey === "ref:rj-186");
      assert.ok(rj186);
      assert.equal(rj186.identificationSource, "ref");
      assert.equal(rj186.denominatorStatus, "extends_outside_coverage");
      assert.equal(rj186.interceptedPercent, null);

      // Bridge separated cleanly
      assert.equal(res.elevatedOrSubsurfaceStructures.length, 1);
      assert.equal(res.elevatedOrSubsurfaceStructures[0].name, "Ponte Raul Veiga");
      assert.equal(res.elevatedOrSubsurfaceStructures[0].structureType, "bridge");
      assert.ok(res.elevatedStructuresInterceptedLengthMeters > 500);

      // Unnamed ratio > 10% AND license not cleared -> publicUiEligible MUST be false!
      assert.ok(res.unnamedInterceptedRatio > 0.1);
      assert.equal(res.publicUiEligible, false);
      assert.ok(res.publicUiBlockReasons.length >= 2);
    }
  });

  it("fails closed on invalid road geometries or invalid flood polygons", () => {
    const validFlood = makeFloodFc([[makeRectRing(-42.19, -21.54, -42.18, -21.53)]]);
    const badRoad: RoadNetworkInput = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "residential", name: "Bad" },
          geometry: {
            type: "LineString",
            coordinates: [[-42.185, -21.535]], // < 2 vertices!
          },
        },
      ],
    };

    const resBadRoad = evaluateRoadExposure(badRoad, validFlood, 300);
    assert.equal(resBadRoad.status, "invalid");
    assert.equal(resBadRoad.publicUiEligible, false);

    const emptyNetwork: RoadNetworkInput = {
      type: "FeatureCollection",
      features: [],
    };
    const resEmpty = evaluateRoadExposure(emptyNetwork, validFlood, 300);
    assert.equal(resEmpty.status, "empty");
  });
});
