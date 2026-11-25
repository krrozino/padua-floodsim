import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import {
  formatHectares,
  formatSignedHectares,
  formatSignedPercent,
} from "../../../lib/sgb/area.ts";
import {
  SGB_AREA_SNAPSHOT_BY_LEVEL,
  SGB_AREA_SNAPSHOT_ENTRIES,
  SGB_REFERENCE_STATION_LABEL,
  checkSnapshotDivergence,
} from "../../../lib/sgb/areaCatalog.ts";
import {
  SGB_COMPARISON_METHOD_ID,
  compareFloodScenarios,
} from "../../../lib/sgb/compare.ts";
import { SGB_FLOOD_LEVELS_CM } from "../../../lib/sgb/stages.ts";

function makeRect(
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number,
): Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ],
  };
}

const RECT_BASE = makeRect(-42.19, -21.54, -42.18, -21.53);
const RECT_BIGGER = makeRect(-42.195, -21.545, -42.175, -21.525);
const RECT_SHIFTED_OVERLAP = makeRect(-42.185, -21.54, -42.175, -21.53);
const RECT_DISJOINT = makeRect(-42.17, -21.54, -42.16, -21.53);

describe("SGB topological scenario comparison (compareFloodScenarios)", () => {
  it("handles equal stages (A = B) with zero delta, full overlap, and empty exclusive regions", () => {
    const res = compareFloodScenarios(RECT_BASE, 425, RECT_BASE, 425);
    assert.equal(res.status, "valid");
    assert.equal(res.classification, "derived");
    assert.equal(res.provenanceKind, "live_queried_geometry");
    assert.equal(res.method, SGB_COMPARISON_METHOD_ID);
    assert.equal(res.levelACm, 425);
    assert.equal(res.levelBCm, 425);

    assert.ok(Math.abs(res.deltaSquareMeters) < 1e-6);
    assert.ok(Math.abs(res.deltaHectares) < 1e-9);
    assert.ok(Math.abs(res.deltaPercent) < 1e-9);
    assert.ok(Math.abs(res.onlyA.areaSquareMeters) < 1e-6);
    assert.ok(Math.abs(res.onlyB.areaSquareMeters) < 1e-6);
    assert.ok(
      Math.abs(res.common.areaSquareMeters - res.scenarioA.areaSquareMeters) <
        1e-6,
    );
    assert.ok(Math.abs(res.jaccardIndex - 1) < 1e-9);
    assert.equal(res.isNestedAInB, true);
    assert.equal(res.isNestedBInA, true);
    assert.equal(res.conservation.withinTolerance, true);
    assert.equal(res.geometries.common.features.length, 1);
    assert.equal(res.geometries.onlyA.features.length, 0);
    assert.equal(res.geometries.onlyB.features.length, 0);
  });

  it("handles different nested stages (A ⊂ B and B ⊂ A) with signed delta and conservation", () => {
    const up = compareFloodScenarios(RECT_BASE, 300, RECT_BIGGER, 550);
    assert.equal(up.status, "valid");
    assert.equal(up.isNestedAInB, true);
    assert.equal(up.isNestedBInA, false);
    assert.ok(up.deltaHectares > 0);
    assert.ok(up.deltaPercent > 290 && up.deltaPercent < 310); // ~300% increase (4x area)
    assert.equal(up.onlyA.areaSquareMeters, 0);
    assert.ok(up.onlyB.areaSquareMeters > 0);
    assert.equal(up.conservation.withinTolerance, true);
    assert.ok(up.conservation.errorAM2 < 1e-3);
    assert.ok(up.conservation.errorBM2 < 1e-3);

    // Reversed order: B ⊂ A gives negative signed difference and exclusive A > 0
    const down = compareFloodScenarios(RECT_BIGGER, 550, RECT_BASE, 300);
    assert.equal(down.status, "valid");
    assert.equal(down.isNestedAInB, false);
    assert.equal(down.isNestedBInA, true);
    assert.ok(down.deltaHectares < 0);
    assert.ok(down.deltaPercent < -74 && down.deltaPercent > -76); // ~-75%
    assert.ok(down.onlyA.areaSquareMeters > 0);
    assert.equal(down.onlyB.areaSquareMeters, 0);
    assert.ok(
      Math.abs(up.common.areaSquareMeters - down.common.areaSquareMeters) < 1e-6,
    );
    assert.ok(
      Math.abs(up.onlyB.areaSquareMeters - down.onlyA.areaSquareMeters) < 1e-6,
    );
  });

  it("distinguishes A ∩ B, A \\ B, and B \\ A for partially overlapping non-nested geometries", () => {
    // RECT_BASE covers [-42.19, -42.18], RECT_SHIFTED_OVERLAP covers [-42.185, -42.175]
    // Half of each overlaps; neither is nested in the other.
    const res = compareFloodScenarios(
      RECT_BASE,
      400,
      RECT_SHIFTED_OVERLAP,
      425,
    );
    assert.equal(res.status, "valid");
    assert.equal(res.isNestedAInB, false);
    assert.equal(res.isNestedBInA, false);
    assert.equal(res.conservation.withinTolerance, true);

    const commonRatio = res.common.areaSquareMeters / res.scenarioA.areaSquareMeters;
    const onlyARatio = res.onlyA.areaSquareMeters / res.scenarioA.areaSquareMeters;
    const onlyBRatio = res.onlyB.areaSquareMeters / res.scenarioB.areaSquareMeters;

    assert.ok(Math.abs(commonRatio - 0.5) < 0.002, `commonRatio=${commonRatio}`);
    assert.ok(Math.abs(onlyARatio - 0.5) < 0.002, `onlyARatio=${onlyARatio}`);
    assert.ok(Math.abs(onlyBRatio - 0.5) < 0.002, `onlyBRatio=${onlyBRatio}`);
    assert.ok(Math.abs(res.jaccardIndex - 1 / 3) < 0.002);
    assert.equal(res.geometries.common.features.length, 1);
    assert.equal(res.geometries.onlyA.features.length, 1);
    assert.equal(res.geometries.onlyB.features.length, 1);
  });

  it("handles completely disjoint non-nested geometries cleanly", () => {
    const res = compareFloodScenarios(RECT_BASE, 300, RECT_DISJOINT, 325);
    assert.equal(res.status, "valid");
    assert.equal(res.common.areaSquareMeters, 0);
    assert.equal(res.geometries.common.features.length, 0);
    assert.equal(res.geometries.onlyA.features.length, 1);
    assert.equal(res.geometries.onlyB.features.length, 1);
    assert.equal(res.jaccardIndex, 0);
    assert.equal(res.isNestedAInB, false);
    assert.equal(res.isNestedBInA, false);
    assert.equal(res.conservation.withinTolerance, true);
  });

  it("handles holes (islands) and MultiPolygons accurately with conservation", () => {
    // Scenario A: MultiPolygon with a hole inside the first part + a disjoint second part
    const polyWithHole: Polygon["coordinates"] = [
      RECT_BASE.coordinates[0],
      [
        [-42.1875, -21.5375],
        [-42.1825, -21.5375],
        [-42.1825, -21.5325],
        [-42.1875, -21.5325],
        [-42.1875, -21.5375],
      ],
    ];
    const multiA: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [polyWithHole, RECT_DISJOINT.coordinates],
    };

    // Scenario B: covers RECT_BASE completely (filling A's hole!) plus overlaps part of RECT_SHIFTED_OVERLAP
    const multiB: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [RECT_BASE.coordinates, RECT_SHIFTED_OVERLAP.coordinates],
    };

    const res = compareFloodScenarios(multiA, 350, multiB, 450);
    assert.equal(res.status, "valid");
    assert.equal(res.conservation.withinTolerance, true);
    assert.equal(res.isNestedAInB, false); // RECT_DISJOINT is exclusive to A
    assert.equal(res.isNestedBInA, false); // hole interior + shifted half are exclusive to B
    assert.equal(res.scenarioA.holeCount, 1);
    assert.ok(res.onlyA.areaSquareMeters > 0);
    assert.ok(res.onlyB.areaSquareMeters > 0);
    assert.ok(res.common.areaSquareMeters > 0);

    // Check conservation explicitly
    assert.ok(
      Math.abs(
        res.scenarioA.areaSquareMeters -
          (res.common.areaSquareMeters + res.onlyA.areaSquareMeters),
      ) < 1e-2,
    );
    assert.ok(
      Math.abs(
        res.scenarioB.areaSquareMeters -
          (res.common.areaSquareMeters + res.onlyB.areaSquareMeters),
      ) < 1e-2,
    );
  });

  it("fails closed on invalid, empty, or partially invalid inputs for A or B", () => {
    const emptyFC: FeatureCollection<Polygon | MultiPolygon> = {
      type: "FeatureCollection",
      features: [],
    };
    const resEmptyA = compareFloodScenarios(emptyFC, 300, RECT_BASE, 425);
    assert.equal(resEmptyA.status, "empty");

    const resEmptyB = compareFloodScenarios(RECT_BASE, 300, emptyFC, 425);
    assert.equal(resEmptyB.status, "empty");

    const invalidHole: Polygon = {
      type: "Polygon",
      coordinates: [
        RECT_BASE.coordinates[0],
        [
          [-42.1875, -21.5375],
          [-42.1825, NaN],
          [-42.1825, -21.5325],
          [-42.1875, -21.5375],
        ],
      ],
    };
    const resInvalidB = compareFloodScenarios(RECT_BASE, 300, invalidHole, 425);
    assert.equal(resInvalidB.status, "invalid");

    const collinear: Polygon = {
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
    const resCollinearA = compareFloodScenarios(collinear, 300, RECT_BASE, 425);
    assert.equal(resCollinearA.status, "invalid");
  });
});

describe("SGB area catalog snapshot & divergence detection", () => {
  it("contains all 11 official stages with valid SHA-256 hashes and strictly increasing areas", () => {
    assert.equal(SGB_AREA_SNAPSHOT_ENTRIES.length, 11);
    assert.equal(
      SGB_REFERENCE_STATION_LABEL,
      "Cota de referência SGB — Pádua II (58790002)",
    );

    let prevArea = 0;
    for (const cm of SGB_FLOOD_LEVELS_CM) {
      const entry = SGB_AREA_SNAPSHOT_BY_LEVEL[cm];
      assert.ok(entry, `Missing snapshot entry for ${cm} cm`);
      assert.equal(entry.levelCm, cm);
      assert.equal(entry.layerName, `COTA_${cm}cm`);
      assert.equal(entry.classification, "derived");
      assert.equal(entry.provenanceKind, "cataloged_snapshot");
      assert.match(entry.geojsonSha256, /^[0-9a-f]{64}$/);
      assert.ok(entry.areaSquareMeters > prevArea);
      prevArea = entry.areaSquareMeters;
    }
  });

  it("detects when live queried geometry matches or diverges from the cataloged snapshot", () => {
    const snap425 = SGB_AREA_SNAPSHOT_BY_LEVEL[425];
    const matching = checkSnapshotDivergence(425, snap425.areaSquareMeters + 0.5);
    assert.equal(matching.matchesSnapshot, true);

    const diverging = checkSnapshotDivergence(425, snap425.areaSquareMeters + 50_000);
    assert.equal(diverging.matchesSnapshot, false);
    assert.ok(Math.abs(diverging.diffHectares - 5) < 1e-6);
  });

  it("formats hectares and signed deltas cleanly in pt-BR", () => {
    assert.equal(formatHectares(170.6207), "170,62 ha");
    assert.equal(formatSignedHectares(101.313), "+101,31 ha");
    assert.equal(formatSignedHectares(-24.5), "−24,50 ha");
    assert.equal(formatSignedHectares(0.001), "0,00 ha");
    assert.equal(formatSignedPercent(59.379), "+59,4%");
    assert.equal(formatSignedPercent(-12.34), "−12,3%");
    assert.equal(formatSignedPercent(0.01), "0,0%");
  });
});
