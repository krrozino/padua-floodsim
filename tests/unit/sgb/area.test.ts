import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import {
  SGB_AREA_METHOD_ID,
  SGB_AREA_SOURCE,
  computeDerivedFloodArea,
  formatFloodArea,
} from "../../../lib/sgb/area.ts";

const VALID_SQUARE: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [-42.19, -21.54],
      [-42.18, -21.54],
      [-42.18, -21.53],
      [-42.19, -21.53],
      [-42.19, -21.54],
    ],
  ],
};

describe("SGB derived geodesic flood area calculation (fail-closed)", () => {
  it("computes accurate WGS84 ellipsoidal approximation for a known 0.01° x 0.01° square near Santo Antônio de Pádua", () => {
    // At lat -21.535° on WGS84:
    // 1° lat ≈ 110,722.3 m => 0.01° ≈ 1,107.22 m
    // 1° lon ≈ 103,604.2 m => 0.01° ≈ 1,036.04 m
    // Expected area ≈ 1,147,128 m² (1.147 km², tolerance < 0.1%)
    const result = computeDerivedFloodArea(VALID_SQUARE, 425);
    assert.equal(result.status, "valid");
    assert.equal(result.classification, "derived");
    assert.equal(result.method, SGB_AREA_METHOD_ID);
    assert.equal(result.source, SGB_AREA_SOURCE);
    assert.equal(result.levelCm, 425);
    assert.equal(result.polygonPartCount, 1);
    assert.equal(result.holeCount, 0);

    const expectedM2 = 1_147_128;
    const relativeError =
      Math.abs(result.areaSquareMeters - expectedM2) / expectedM2;
    assert.ok(
      relativeError < 0.001,
      `Expected area near ${expectedM2} m², got ${result.areaSquareMeters} m² (err=${relativeError})`,
    );
    assert.ok(
      Math.abs(result.areaHectares - result.areaSquareMeters / 10_000) < 1e-9,
    );
    assert.ok(
      Math.abs(result.areaSquareKm - result.areaSquareMeters / 1_000_000) <
        1e-12,
    );
  });

  it("subtracts valid internal rings (holes) accurately", () => {
    const withHole: Polygon = {
      type: "Polygon",
      coordinates: [
        VALID_SQUARE.coordinates[0],
        [
          [-42.1875, -21.5375],
          [-42.1825, -21.5375],
          [-42.1825, -21.5325],
          [-42.1875, -21.5325],
          [-42.1875, -21.5375],
        ],
      ],
    };

    const full = computeDerivedFloodArea(VALID_SQUARE, 400);
    const holed = computeDerivedFloodArea(withHole, 400);
    assert.equal(full.status, "valid");
    assert.equal(holed.status, "valid");
    assert.equal(holed.holeCount, 1);

    const ratio = holed.areaSquareMeters / full.areaSquareMeters;
    assert.ok(
      Math.abs(ratio - 0.75) < 0.001,
      `Expected ~75% of outer area after subtracting 25% hole, got ${(ratio * 100).toFixed(3)}%`,
    );
  });

  it("avoids double-counting overlapping parts in MultiPolygon and FeatureCollection", () => {
    const squareB: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-42.185, -21.54],
          [-42.175, -21.54],
          [-42.175, -21.53],
          [-42.185, -21.53],
          [-42.185, -21.54],
        ],
      ],
    };

    const singleRes = computeDerivedFloodArea(VALID_SQUARE, 450);
    assert.equal(singleRes.status, "valid");

    const overlappingMulti: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [VALID_SQUARE.coordinates, squareB.coordinates],
    };
    const multiRes = computeDerivedFloodArea(overlappingMulti, 450);
    assert.equal(multiRes.status, "valid");
    const multiRatio = multiRes.areaSquareMeters / singleRes.areaSquareMeters;
    assert.ok(
      Math.abs(multiRatio - 1.5) < 0.002,
      `Expected union ratio ~1.5 (no double counting), got ${multiRatio}`,
    );

    const overlappingFC: FeatureCollection<Polygon | MultiPolygon> = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: VALID_SQUARE },
        { type: "Feature", properties: {}, geometry: VALID_SQUARE },
      ],
    };
    const duplicateRes = computeDerivedFloodArea(overlappingFC, 450);
    assert.equal(duplicateRes.status, "valid");
    const dupRatio = duplicateRes.areaSquareMeters / singleRes.areaSquareMeters;
    assert.ok(
      Math.abs(dupRatio - 1.0) < 0.001,
      `Duplicate polygons must not double count, got ratio ${dupRatio}`,
    );
  });

  it("fails closed when a FeatureCollection mixes a valid polygon and an invalid polygon (never returns partial area)", () => {
    const mixedFC: FeatureCollection<Polygon | MultiPolygon> = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: VALID_SQUARE },
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-42.19, NaN],
                [-42.18, -21.54],
                [-42.18, -21.53],
                [-42.19, NaN],
              ],
            ],
          },
        },
      ],
    };

    const res = computeDerivedFloodArea(mixedFC, 425);
    assert.equal(res.status, "invalid");
    assert.equal(res.areaSquareMeters, null);
    assert.equal(res.areaHectares, null);
    assert.equal(res.areaSquareKm, null);
  });

  it("fails closed when a MultiPolygon is partially invalid (valid part + invalid part)", () => {
    const partiallyInvalidMulti: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [
        VALID_SQUARE.coordinates,
        [
          [
            [-42.17, -21.54],
            [-42.16, -21.54],
            // Only 2 vertices -> invalid
          ],
        ],
      ],
    };

    const res = computeDerivedFloodArea(partiallyInvalidMulti, 475);
    assert.equal(res.status, "invalid");
    assert.equal(res.areaSquareMeters, null);
  });

  it("fails closed when an internal ring (hole) is invalid instead of silently dropping it", () => {
    const invalidHolePoly: Polygon = {
      type: "Polygon",
      coordinates: [
        VALID_SQUARE.coordinates[0],
        [
          [-42.1875, -21.5375],
          [-42.1825, NaN],
          [-42.1825, -21.5325],
          [-42.1875, -21.5375],
        ],
      ],
    };

    const res = computeDerivedFloodArea(invalidHolePoly, 500);
    assert.equal(res.status, "invalid");
    assert.equal(res.areaSquareMeters, null);

    const shortHolePoly: Polygon = {
      type: "Polygon",
      coordinates: [
        VALID_SQUARE.coordinates[0],
        [
          [-42.1875, -21.5375],
          [-42.1825, -21.5375],
          [-42.1875, -21.5375],
        ],
      ],
    };

    const resShort = computeDerivedFloodArea(shortHolePoly, 500);
    assert.equal(resShort.status, "invalid");
    assert.equal(resShort.areaSquareMeters, null);
  });

  it("fails closed on degenerate (collinear / zero-area) geometries and holes", () => {
    const collinearPoly: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-42.19, -21.54],
          [-42.185, -21.54],
          [-42.18, -21.54],
          [-42.19, -21.54],
        ],
      ],
    };
    const resCollinear = computeDerivedFloodArea(collinearPoly, 350);
    assert.equal(resCollinear.status, "invalid");
    assert.equal(resCollinear.areaSquareMeters, null);

    const degenerateHolePoly: Polygon = {
      type: "Polygon",
      coordinates: [
        VALID_SQUARE.coordinates[0],
        [
          [-42.188, -21.535],
          [-42.185, -21.535],
          [-42.182, -21.535],
          [-42.188, -21.535],
        ],
      ],
    };
    const resDegHole = computeDerivedFloodArea(degenerateHolePoly, 350);
    assert.equal(resDegHole.status, "invalid");
    assert.equal(resDegHole.areaSquareMeters, null);
  });

  it("handles empty and implausibly large geometries safely", () => {
    const emptyFC: FeatureCollection<Polygon | MultiPolygon> = {
      type: "FeatureCollection",
      features: [],
    };
    const emptyRes = computeDerivedFloodArea(emptyFC, 300);
    assert.equal(emptyRes.status, "empty");
    assert.equal(emptyRes.areaSquareMeters, null);

    const hugePoly: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-43.0, -22.0],
          [-41.0, -22.0],
          [-41.0, -20.0],
          [-43.0, -20.0],
          [-43.0, -22.0],
        ],
      ],
    };
    const implausibleRes = computeDerivedFloodArea(hugePoly, 550);
    assert.equal(implausibleRes.status, "invalid");
    assert.equal(implausibleRes.areaSquareMeters, null);
  });

  it("formats area in km², hectares, and m² using pt-BR conventions", () => {
    assert.deepEqual(formatFloodArea(1_967_300), {
      primary: "1,97 km²",
      secondary: "196,7 ha",
    });
    assert.deepEqual(formatFloodArea(450_000), {
      primary: "45,00 ha",
      secondary: "450.000 m²",
    });
    assert.deepEqual(formatFloodArea(5_200), {
      primary: "5.200 m²",
      secondary: "0,52 ha",
    });
  });
});
