import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import {
  OSM_ROAD_ATTRIBUTION,
  OSM_ROAD_LICENSE,
  PROVISIONAL_PUBLIC_UI_UNNAMED_RATIO_CRITERION,
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
    assert.equal(normalizeRoadName("R. Cel. Olivier"), "rua coronel olivier");
    assert.equal(normalizeRoadName("Pça. Pereira Lima"), "praca pereira lima");
    assert.equal(normalizeRoadName("   "), null);
    assert.equal(normalizeRoadName(null), null);
  });

  it("clips road axes against Polygons with holes and does NOT assume a complete denominator from the auxiliary MapServer bbox alone", () => {
    const flood = makeFloodFc([
      [
        makeRectRing(-42.19, -21.54, -42.18, -21.53),
        makeRectRing(-42.187, -21.538, -42.183, -21.532),
      ],
    ]);

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

    // 1. Default auxiliary MapServer bbox ONLY -> denominatorStatus MUST be "unverified_bbox_only" and interceptedPercent MUST be null!
    const resBboxOnly = evaluateRoadExposure(network, flood, 425);
    assert.equal(resBboxOnly.status, "valid");
    if (resBboxOnly.status === "valid") {
      assert.equal(resBboxOnly.method, SGB_ROAD_EXPOSURE_METHOD_ID);
      assert.equal(resBboxOnly.roadSourceLicense, OSM_ROAD_LICENSE);
      assert.equal(resBboxOnly.roadAttribution, OSM_ROAD_ATTRIBUTION);
      assert.ok(
        Math.abs(resBboxOnly.totalInterceptedLengthMeters - expectedCoveredM) <
          0.05,
      );
      assert.equal(resBboxOnly.interceptedSegmentCount, 2);
      assert.equal(resBboxOnly.identifiableRoadCount, 1);
      assert.equal(
        resBboxOnly.roads[0].envelopeStatus,
        "within_mapserver_envelope",
      );
      assert.equal(resBboxOnly.roads[0].hydraulicDomainStatus, "unknown");
      assert.equal(
        resBboxOnly.roads[0].denominatorStatus,
        "unverified_bbox_only",
      );
      assert.equal(resBboxOnly.roads[0].interceptedPercent, null);
      assert.equal(
        resBboxOnly.semanticGuardrails
          .totalAxisLengthDistinctFromNominalIdentification,
        true,
      );
      assert.equal(
        resBboxOnly.semanticGuardrails.unnamedRatioCriterionIsProvisional,
        true,
      );
    }

    // 2. With BOTH validated hydraulic domain polygon AND documented complete road key -> computes exact percentage!
    const validatedDomain = makeFloodFc([
      [makeRectRing(-42.195, -21.545, -42.175, -21.525)],
    ]);
    const resDocumented = evaluateRoadExposure(network, flood, 425, {
      coverageDomain: {
        kind: "polygon",
        geometry: validatedDomain,
        label: "Domínio hidráulico validado",
      },
      documentedCompleteRoadKeys: new Set(["name:rua exemplo"]),
    });
    assert.equal(resDocumented.status, "valid");
    if (resDocumented.status === "valid") {
      assert.equal(resDocumented.roads[0].hydraulicDomainStatus, "covered");
      assert.equal(
        resDocumented.roads[0].denominatorStatus,
        "complete_documented",
      );
      const expectedPct = (expectedCoveredM / expectedTotalM) * 100;
      assert.ok(
        resDocumented.roads[0].interceptedPercent !== null &&
          Math.abs(resDocumented.roads[0].interceptedPercent - expectedPct) <
            0.05,
      );
    }
  });

  it("deduplicates multi-segment roads with localeCompare sorting, separates bridges, and enforces provisional governance & license gates", () => {
    const flood = makeFloodFc([[makeRectRing(-42.19, -21.54, -42.18, -21.53)]]);
    const validatedDomain = makeFloodFc([
      [makeRectRing(-42.205, -21.55, -42.15, -21.515)],
    ]);

    const network: RoadNetworkInput = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: 10,
          properties: { highway: "secondary", name: "Av. Getúlio Vargas" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-42.189, -21.535],
              [-42.185, -21.535],
            ],
          },
        },
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
        {
          type: "Feature",
          id: 12,
          properties: { highway: "trunk", ref: "RJ-186" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-42.22, -21.535], // outside envelope AND validated domain
              [-42.185, -21.535],
            ],
          },
        },
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

    const res = evaluateRoadExposure(network, flood, 425, {
      coverageDomain: {
        kind: "polygon",
        geometry: validatedDomain,
        label: "Domínio validado teste",
      },
      documentedCompleteRoadKeys: new Set([
        "name:avenida getulio vargas",
        "ref:rj-186",
      ]),
    });
    assert.equal(res.status, "valid");
    if (res.status === "valid") {
      assert.equal(res.identifiableRoadCount, 2);

      const gv = res.roads.find(
        (r) => r.canonicalKey === "name:avenida getulio vargas",
      );
      assert.ok(gv);
      assert.deepEqual(gv.rawNameVariants, [
        "Av. Getúlio Vargas",
        "Avenida Getulio Vargas",
      ]);
      assert.deepEqual(gv.highwayCategories, ["primary", "secondary"]);
      assert.equal(gv.denominatorStatus, "complete_documented");
      assert.ok(
        gv.interceptedPercent !== null &&
          gv.interceptedPercent > 60 &&
          gv.interceptedPercent < 70,
      );

      // Even if RJ-186 is listed in documentedCompleteRoadKeys, extending outside domain suppresses percent!
      const rj186 = res.roads.find((r) => r.canonicalKey === "ref:rj-186");
      assert.ok(rj186);
      assert.equal(rj186.denominatorStatus, "extends_outside_envelope");
      assert.equal(rj186.interceptedPercent, null);

      assert.equal(res.elevatedOrSubsurfaceStructures.length, 1);
      assert.equal(res.elevatedOrSubsurfaceStructures[0].name, "Ponte Raul Veiga");
      assert.ok(res.unnamedInterceptedRatio > PROVISIONAL_PUBLIC_UI_UNNAMED_RATIO_CRITERION);
      assert.equal(res.publicUiEligible, false);
      assert.match(res.publicUiBlockReasons.join(" "), /critério provisório/i);
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
            coordinates: [[-42.185, -21.535]],
          },
        },
      ],
    };

    assert.equal(evaluateRoadExposure(badRoad, validFlood, 300).status, "invalid");
    assert.equal(
      evaluateRoadExposure({ type: "FeatureCollection", features: [] }, validFlood, 300)
        .status,
      "empty",
    );
  });
});
