import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { MultiPolygon, Polygon } from "geojson";
import {
  NEIGHBORHOOD_SAFETY_DISCLAIMERS,
  PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0,
  isValidThresholdScheme,
  type NeighborhoodBoundaryRecord,
  type NeighborhoodThresholdScheme,
} from "../../../lib/neighborhoods/contract.ts";
import {
  classifyNeighborhoodOverlap,
  evaluateNeighborhoodPanel,
  evaluateNeighborhoodScenarioOverlap,
} from "../../../lib/neighborhoods/evaluate.ts";
import {
  MAINTAINER_PRIORITY_NEIGHBORHOOD_IDS,
  NEIGHBORHOOD_ACQUISITION_STATUS,
  OFFICIAL_NEIGHBORHOOD_COUNT,
  OFFICIAL_NEIGHBORHOOD_REGISTRY,
  getOfficialNeighborhoods,
  getPriorityNeighborhoods,
} from "../../../lib/neighborhoods/registry.ts";

// Synthetic 0.01° x 0.01° square near Santo Antônio de Pádua (-42.19..-42.18, -21.54..-21.53)
const SYNTHETIC_NEIGHBORHOOD_SQUARE: Polygon = {
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

function makeSyntheticRecord(
  base: NeighborhoodBoundaryRecord,
  geometry: Polygon | MultiPolygon | null,
  geometryStatus: NeighborhoodBoundaryRecord["geometryStatus"] = "valid",
): NeighborhoodBoundaryRecord {
  return {
    ...base,
    geometry,
    geometryStatus,
    source: "Fixture geométrica sintética de teste unitário",
    version: "synthetic-unit-test-v1",
  };
}

describe("Municipal neighborhood registry & metadata parity (R02-F)", () => {
  it("contains all 27 official neighborhoods (16 right bank + 11 left bank) and 7 maintainer priorities", () => {
    const all = getOfficialNeighborhoods();
    assert.equal(all.length, OFFICIAL_NEIGHBORHOOD_COUNT);
    assert.equal(all.length, 27);
    assert.equal(NEIGHBORHOOD_ACQUISITION_STATUS, "BLOCKED_DATA_SOURCE");

    const numbers = all.map((n) => n.officialNumber);
    assert.deepEqual(
      numbers,
      Array.from({ length: 27 }, (_, idx) => idx + 1),
    );

    const rightBank = all.filter((n) => n.riverBank === "right");
    const leftBank = all.filter((n) => n.riverBank === "left");
    assert.equal(rightBank.length, 16);
    assert.equal(leftBank.length, 11);
    assert.ok(rightBank.every((n) => n.officialNumber >= 1 && n.officialNumber <= 16));
    assert.ok(leftBank.every((n) => n.officialNumber >= 17 && n.officialNumber <= 27));

    const priorities = getPriorityNeighborhoods();
    assert.equal(priorities.length, 7);
    assert.deepEqual(
      new Set(priorities.map((p) => p.id)),
      new Set(MAINTAINER_PRIORITY_NEIGHBORHOOD_IDS),
    );
    assert.deepEqual(
      new Set(priorities.map((p) => p.officialName)),
      new Set([
        "Centro",
        "São Félix",
        "Aeroporto",
        "Cidade Nova",
        "Divinéia",
        "Farol",
        "Mirante",
      ]),
    );
  });

  it("preserves verbatim orthography traceability across Lei 3.864/2017 and Lei 4.135/2021 and never treats OSM points as polygons", () => {
    const ferreira = OFFICIAL_NEIGHBORHOOD_REGISTRY.find(
      (n) => n.id === "ferreira",
    );
    assert.ok(ferreira);
    assert.equal(ferreira.officialNumber, 22);
    assert.equal(ferreira.officialName, "Ferreira");
    assert.equal(ferreira.legalNomenclature.lei3864AnexoVi, "FERRERIRA");
    assert.equal(ferreira.legalNomenclature.lei3864AnexoXiii, "FERRERIRA");
    assert.equal(ferreira.legalNomenclature.lei4135TabelaI, "Ferreira");

    const pereira = OFFICIAL_NEIGHBORHOOD_REGISTRY.find(
      (n) => n.id === "pereira",
    );
    assert.ok(pereira);
    assert.equal(pereira.officialNumber, 26);
    assert.equal(pereira.officialName, "Pereira");
    assert.equal(pereira.legalNomenclature.lei3864AnexoVi, "PERERIRA");
    assert.equal(pereira.legalNomenclature.lei3864AnexoXiii, "PEREIRA");
    assert.equal(pereira.legalNomenclature.lei4135TabelaI, "Pereira");

    for (const item of OFFICIAL_NEIGHBORHOOD_REGISTRY) {
      assert.equal(item.geometry, null);
      assert.equal(item.geometryStatus, "unavailable");
      if (item.osmAuxiliaryPoint !== null) {
        assert.equal(
          item.osmAuxiliaryPoint.classification,
          "auxiliary_reference_point_only",
        );
        assert.equal(item.osmAuxiliaryPoint.usableForPolygonIntersection, false);
      }
    }
  });

  it("stays 1:1 synchronized with data/metadata/neighborhoods/neighborhood_registry.json", () => {
    const jsonPath = path.resolve(
      process.cwd(),
      "data/metadata/neighborhoods/neighborhood_registry.json",
    );
    const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    assert.equal(raw.acquisitionStatus, "BLOCKED_DATA_SOURCE");
    assert.equal(raw.coverageSummary.identifiedNeighborhoodCount, 27);
    assert.equal(raw.coverageSummary.usablePolygonCount, 0);
    assert.equal(raw.neighborhoods.length, 27);
    assert.deepEqual(
      raw.maintainerPriorityIds,
      MAINTAINER_PRIORITY_NEIGHBORHOOD_IDS,
    );

    for (let i = 0; i < 27; i += 1) {
      assert.deepEqual(raw.neighborhoods[i], OFFICIAL_NEIGHBORHOOD_REGISTRY[i]);
    }
    assert.ok(Array.isArray(raw.auditedSources) && raw.auditedSources.length >= 8);
    for (const src of raw.auditedSources) {
      assert.match(src.sha256, /^[0-9a-f]{64}$/);
      assert.ok(src.sizeBytes > 0);
    }
  });
});

describe("Neighborhood spatial overlap & visual classification engine (R02-F Section 6)", () => {
  it("classifies all 27 neighborhoods as Cinza (gray) under current BLOCKED_DATA_SOURCE state without fabricating green/0%", () => {
    const panel = evaluateNeighborhoodPanel(
      OFFICIAL_NEIGHBORHOOD_REGISTRY,
      SYNTHETIC_NEIGHBORHOOD_SQUARE,
      300,
    );

    assert.equal(panel.acquisitionStatus, "BLOCKED_DATA_SOURCE");
    assert.equal(panel.totalIdentifiedNeighborhoods, 27);
    assert.equal(panel.usableNeighborhoodCount, 0);
    assert.equal(panel.unavailableOrInvalidCount, 27);
    assert.equal(panel.isPartialCoverage, true);
    assert.equal(panel.interceptedNeighborhoodCount, null);
    assert.equal(panel.zeroIntersectionValidCount, 0);
    assert.match(panel.coverageDisclosurePtBr, /0\/27/);
    assert.match(panel.coverageDisclosurePtBr, /BLOCKED_DATA_SOURCE/);

    for (const item of panel.items) {
      assert.equal(item.visualClass, "gray");
      assert.equal(item.visualLabelPtBr, "Cinza");
      assert.equal(item.territorialAreaM2, null);
      assert.equal(item.interceptedAreaM2, null);
      assert.equal(item.interceptedPercent, null);
      assert.equal(item.coverageAndQuality.isUsableForIntersection, false);
    }
  });

  it("evaluates green, yellow, orange, and red deterministically on synthetic WGS84 geometries and enforces area conservation", () => {
    const centroTemplate = OFFICIAL_NEIGHBORHOOD_REGISTRY.find(
      (n) => n.id === "centro",
    )!;
    const validNb = makeSyntheticRecord(
      centroTemplate,
      SYNTHETIC_NEIGHBORHOOD_SQUARE,
    );

    // 1. Disjoint flood polygon -> 0% -> Verde (green)
    const disjointFlood: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-42.17, -21.54],
          [-42.16, -21.54],
          [-42.16, -21.53],
          [-42.17, -21.53],
          [-42.17, -21.54],
        ],
      ],
    };
    const greenRes = evaluateNeighborhoodScenarioOverlap(
      validNb,
      disjointFlood,
      300,
    );
    assert.equal(greenRes.visualClass, "green");
    assert.equal(greenRes.visualLabelPtBr, "Verde");
    assert.equal(greenRes.interceptedAreaM2, 0);
    assert.equal(greenRes.interceptedPercent, 0);
    assert.ok(greenRes.territorialAreaM2 !== null && greenRes.territorialAreaM2 > 1_000_000);

    // 2. 2% longitudinal strip (-42.19 to -42.1898 out of 0.01° width) -> ~2% -> Amarelo (yellow)
    const lowFlood: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-42.19, -21.54],
          [-42.1898, -21.54],
          [-42.1898, -21.53],
          [-42.19, -21.53],
          [-42.19, -21.54],
        ],
      ],
    };
    const yellowRes = evaluateNeighborhoodScenarioOverlap(
      validNb,
      lowFlood,
      350,
    );
    assert.equal(yellowRes.visualClass, "yellow");
    assert.equal(yellowRes.visualLabelPtBr, "Amarelo");
    assert.ok(
      yellowRes.interceptedPercent !== null &&
        yellowRes.interceptedPercent > 1.9 &&
        yellowRes.interceptedPercent < 2.1,
    );

    // 3. 12% longitudinal strip (-42.19 to -42.1888) -> ~12% -> Laranja (orange)
    const highFlood: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-42.19, -21.54],
          [-42.1888, -21.54],
          [-42.1888, -21.53],
          [-42.19, -21.53],
          [-42.19, -21.54],
        ],
      ],
    };
    const orangeRes = evaluateNeighborhoodScenarioOverlap(
      validNb,
      highFlood,
      425,
    );
    assert.equal(orangeRes.visualClass, "orange");
    assert.equal(orangeRes.visualLabelPtBr, "Laranja");
    assert.ok(
      orangeRes.interceptedPercent !== null &&
        orangeRes.interceptedPercent > 11.9 &&
        orangeRes.interceptedPercent < 12.1,
    );

    // 4. 35% longitudinal strip (-42.19 to -42.1865) -> ~35% -> Vermelho (red)
    const veryHighFlood: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-42.19, -21.54],
          [-42.1865, -21.54],
          [-42.1865, -21.53],
          [-42.19, -21.53],
          [-42.19, -21.54],
        ],
      ],
    };
    const redRes = evaluateNeighborhoodScenarioOverlap(
      validNb,
      veryHighFlood,
      550,
    );
    assert.equal(redRes.visualClass, "red");
    assert.equal(redRes.visualLabelPtBr, "Vermelho");
    assert.ok(
      redRes.interceptedPercent !== null &&
        redRes.interceptedPercent > 34.8 &&
        redRes.interceptedPercent < 35.2,
    );

    // 5. Enclosing flood polygon -> conservation 100% (never > 100%)
    const enclosingFlood: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-42.2, -21.55],
          [-42.17, -21.55],
          [-42.17, -21.52],
          [-42.2, -21.52],
          [-42.2, -21.55],
        ],
      ],
    };
    const fullRes = evaluateNeighborhoodScenarioOverlap(
      validNb,
      enclosingFlood,
      550,
    );
    assert.equal(fullRes.visualClass, "red");
    assert.equal(fullRes.interceptedPercent, 100);
    assert.equal(fullRes.interceptedAreaM2, fullRes.territorialAreaM2);
  });

  it("handles holes and overlapping MultiPolygon scenario parts without double counting and reports partial coverage explicitly", () => {
    const nbWithHole: Polygon = {
      type: "Polygon",
      coordinates: [
        SYNTHETIC_NEIGHBORHOOD_SQUARE.coordinates[0],
        [
          [-42.1875, -21.5375],
          [-42.1825, -21.5375],
          [-42.1825, -21.5325],
          [-42.1875, -21.5325],
          [-42.1875, -21.5375],
        ],
      ],
    };

    const duplicatedFlood: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [
        SYNTHETIC_NEIGHBORHOOD_SQUARE.coordinates,
        SYNTHETIC_NEIGHBORHOOD_SQUARE.coordinates,
      ],
    };

    const modifiedRegistry = OFFICIAL_NEIGHBORHOOD_REGISTRY.map((rec) =>
      rec.maintainerPriority ? makeSyntheticRecord(rec, nbWithHole) : rec,
    );

    const panel = evaluateNeighborhoodPanel(
      modifiedRegistry,
      duplicatedFlood,
      450,
    );
    assert.equal(panel.acquisitionStatus, "PARTIAL_OFFICIAL_COVERAGE");
    assert.equal(panel.usableNeighborhoodCount, 7);
    assert.equal(panel.unavailableOrInvalidCount, 20);
    assert.equal(panel.isPartialCoverage, true);
    assert.equal(panel.interceptedNeighborhoodCount, 7);
    assert.match(panel.coverageDisclosurePtBr, /7 de 27/);

    const sampleValid = panel.items.find((i) => i.neighborhoodId === "centro")!;
    assert.equal(sampleValid.visualClass, "red");
    assert.equal(sampleValid.interceptedPercent, 100);
    assert.equal(sampleValid.coverageAndQuality.neighborhoodHoleCount, 1);

    const sampleMissing = panel.items.find(
      (i) => i.neighborhoodId === "alipio",
    )!;
    assert.equal(sampleMissing.visualClass, "gray");
    assert.equal(sampleMissing.interceptedPercent, null);
  });

  it("fails closed to gray on degenerate rings or malformed holes and enforces uniform global threshold invariants", () => {
    const saoFelix = OFFICIAL_NEIGHBORHOOD_REGISTRY.find(
      (n) => n.id === "sao-felix",
    )!;

    const corruptedHolePoly: Polygon = {
      type: "Polygon",
      coordinates: [
        SYNTHETIC_NEIGHBORHOOD_SQUARE.coordinates[0],
        [
          [-42.186, -21.536],
          [-42.186, -21.536],
        ],
      ],
    };

    const res = evaluateNeighborhoodScenarioOverlap(
      makeSyntheticRecord(saoFelix, corruptedHolePoly),
      SYNTHETIC_NEIGHBORHOOD_SQUARE,
      400,
    );
    assert.equal(res.visualClass, "gray");
    assert.equal(res.coverageAndQuality.status, "invalid_geometry");
    assert.equal(res.interceptedPercent, null);

    // Mandatory safety disclaimers are always attached
    assert.deepEqual(res.disclaimers, NEIGHBORHOOD_SAFETY_DISCLAIMERS);
    assert.match(
      res.disclaimers.greenNotSafetyGuarantee,
      /não significa garantia de segurança/i,
    );
    assert.match(
      res.disclaimers.redNotOfficialWarning,
      /não constitui alerta oficial/i,
    );

    // Invalid threshold schemes are rejected
    const badScheme: NeighborhoodThresholdScheme = {
      ...PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0,
      lowMaxPercent: 25,
      highMaxPercent: 15,
    };
    assert.equal(isValidThresholdScheme(badScheme), false);
    assert.throws(() => classifyNeighborhoodOverlap(100, 1000, badScheme), RangeError);
  });
});
