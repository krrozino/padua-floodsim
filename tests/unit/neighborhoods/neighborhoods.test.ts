import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { MultiPolygon, Polygon } from "geojson";
import {
  DEFAULT_UNKNOWN_MODEL_COVERAGE_DOMAIN,
  NEIGHBORHOOD_SAFETY_DISCLAIMERS,
  PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0,
  SGB_2024_MAPSERVER_ENVELOPE_BBOX,
  isValidThresholdScheme,
  type FloodModelCoverageDomain,
  type NeighborhoodBoundaryRecord,
  type NeighborhoodThresholdScheme,
} from "../../../lib/neighborhoods/contract.ts";
import {
  classifyNeighborhoodOverlap,
  evaluateNeighborhoodPanel,
  evaluateNeighborhoodScenarioOverlap,
  evaluateNeighborhoodWithPreparedScenario,
  prepareFloodScenario,
} from "../../../lib/neighborhoods/evaluate.ts";
import {
  MAINTAINER_PRIORITY_NEIGHBORHOOD_IDS,
  NEIGHBORHOOD_ACQUISITION_STATUS,
  OFFICIAL_NEIGHBORHOOD_COUNT,
  OFFICIAL_NEIGHBORHOOD_REGISTRY,
  getOfficialNeighborhoods,
  getPriorityNeighborhoods,
  validateUniqueNeighborhoodRecords,
} from "../../../lib/neighborhoods/registry.ts";
import { computeDerivedFloodArea } from "../../../lib/sgb/area.ts";
import { compareFloodScenarios } from "../../../lib/sgb/compare.ts";

// Validated synthetic hydraulic model domain polygon strictly inside SGB_2024_MAPSERVER_ENVELOPE_BBOX
const VALIDATED_MODEL_DOMAIN_POLYGON: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [-42.205, -21.55],
      [-42.15, -21.55],
      [-42.15, -21.515],
      [-42.205, -21.515],
      [-42.205, -21.55],
    ],
  ],
};

const VALIDATED_POLYGON_COVERAGE: FloodModelCoverageDomain = {
  kind: "polygon",
  geometry: VALIDATED_MODEL_DOMAIN_POLYGON,
  label: "Domínio espacial sintético validado do modelo hidráulico",
};

// Synthetic 0.01° x 0.01° square strictly inside VALIDATED_MODEL_DOMAIN_POLYGON
const SYNTHETIC_SQUARE_IN_MODEL: Polygon = {
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

// Synthetic square outside VALIDATED_MODEL_DOMAIN_POLYGON and outside MapServer bbox
const SYNTHETIC_SQUARE_OUTSIDE_MODEL: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [-42.26, -21.5],
      [-42.25, -21.5],
      [-42.25, -21.49],
      [-42.26, -21.49],
      [-42.26, -21.5],
    ],
  ],
};

// Synthetic square straddling the western edge (-42.205) of VALIDATED_MODEL_DOMAIN_POLYGON
const SYNTHETIC_SQUARE_STRADDLING_MODEL: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [-42.21, -21.54],
      [-42.2, -21.54],
      [-42.2, -21.53],
      [-42.21, -21.53],
      [-42.21, -21.54],
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
  it("contains all 27 unique official neighborhoods (16 right bank + 11 left bank) and 7 maintainer priorities", () => {
    const all = getOfficialNeighborhoods();
    assert.equal(all.length, OFFICIAL_NEIGHBORHOOD_COUNT);
    assert.equal(all.length, 27);
    assert.equal(NEIGHBORHOOD_ACQUISITION_STATUS, "BLOCKED_DATA_SOURCE");
    assert.doesNotThrow(() => validateUniqueNeighborhoodRecords(all));

    const numbers = all.map((n) => n.officialNumber);
    assert.deepEqual(
      numbers,
      Array.from({ length: 27 }, (_, idx) => idx + 1),
    );

    const rightBank = all.filter((n) => n.riverBank === "right");
    const leftBank = all.filter((n) => n.riverBank === "left");
    assert.equal(rightBank.length, 16);
    assert.equal(leftBank.length, 11);

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
    )!;
    assert.equal(ferreira.officialNumber, 22);
    assert.equal(ferreira.officialName, "Ferreira");
    assert.equal(ferreira.legalNomenclature.lei3864AnexoVi, "FERRERIRA");
    assert.equal(ferreira.legalNomenclature.lei3864AnexoXiii, "FERRERIRA");
    assert.equal(ferreira.legalNomenclature.lei4135TabelaI, "Ferreira");

    const pereira = OFFICIAL_NEIGHBORHOOD_REGISTRY.find(
      (n) => n.id === "pereira",
    )!;
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
    assert.ok(
      Array.isArray(raw.auditedSources) && raw.auditedSources.length >= 8,
    );
    for (const src of raw.auditedSources) {
      assert.match(src.sha256, /^[0-9a-f]{64}$/);
      assert.ok(src.sizeBytes > 0);
    }
  });

  it("rejects duplicate neighborhood identifiers or official numbers to avoid double counting", () => {
    const duplicatedId = [
      OFFICIAL_NEIGHBORHOOD_REGISTRY[0],
      { ...OFFICIAL_NEIGHBORHOOD_REGISTRY[1], id: OFFICIAL_NEIGHBORHOOD_REGISTRY[0].id },
    ];
    assert.throws(
      () =>
        evaluateNeighborhoodPanel(duplicatedId, SYNTHETIC_SQUARE_IN_MODEL, 300, {
          modelCoverage: VALIDATED_POLYGON_COVERAGE,
        }),
      /duplicado/i,
    );

    const duplicatedNumber = [
      OFFICIAL_NEIGHBORHOOD_REGISTRY[0],
      {
        ...OFFICIAL_NEIGHBORHOOD_REGISTRY[1],
        officialNumber: OFFICIAL_NEIGHBORHOOD_REGISTRY[0].officialNumber,
      },
    ];
    assert.throws(
      () =>
        evaluateNeighborhoodPanel(
          duplicatedNumber,
          SYNTHETIC_SQUARE_IN_MODEL,
          300,
          { modelCoverage: VALIDATED_POLYGON_COVERAGE },
        ),
      /duplicado/i,
    );
  });
});

describe("Neighborhood spatial overlap, unknown-default coverage & PR #54 core integration (R02-F)", () => {
  it("uses unknown model coverage by default and never assigns green when MapServer bbox or default unknown domain is used", () => {
    assert.equal(DEFAULT_UNKNOWN_MODEL_COVERAGE_DOMAIN.kind, "unknown");

    const centro = OFFICIAL_NEIGHBORHOOD_REGISTRY.find(
      (n) => n.id === "centro",
    )!;
    const validNb = makeSyntheticRecord(centro, SYNTHETIC_SQUARE_IN_MODEL);

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

    // 1. Default (no modelCoverage passed) -> must default to "unknown" -> gray, NEVER green!
    const defaultRes = evaluateNeighborhoodScenarioOverlap(
      validNb,
      disjointFlood,
      300,
    );
    assert.equal(defaultRes.visualClass, "gray");
    assert.equal(defaultRes.coverageAndQuality.boundaryStatus, "valid");
    assert.equal(defaultRes.coverageAndQuality.modelCoverageStatus, "unknown");
    assert.equal(
      defaultRes.coverageAndQuality.calculationStatus,
      "skipped_outside_model_coverage",
    );
    assert.ok(defaultRes.territorialAreaM2 !== null && defaultRes.territorialAreaM2 > 1_000_000);
    assert.equal(defaultRes.interceptedPercent, null);

    // 2. Passing MapServer envelope bbox still does NOT grant "covered" inside bbox -> gray (unknown)
    const insideBboxOnlyRes = evaluateNeighborhoodScenarioOverlap(
      validNb,
      disjointFlood,
      300,
      {
        modelCoverage: {
          kind: "bbox",
          bbox: SGB_2024_MAPSERVER_ENVELOPE_BBOX,
          label: "Envelope MapServer SGB",
        },
      },
    );
    assert.equal(insideBboxOnlyRes.visualClass, "gray");
    assert.equal(insideBboxOnlyRes.coverageAndQuality.modelCoverageStatus, "unknown");

    // 3. Outside MapServer envelope bbox -> outside_model_extent -> gray
    const outsideBboxRes = evaluateNeighborhoodScenarioOverlap(
      makeSyntheticRecord(centro, SYNTHETIC_SQUARE_OUTSIDE_MODEL),
      disjointFlood,
      300,
      {
        modelCoverage: {
          kind: "bbox",
          bbox: SGB_2024_MAPSERVER_ENVELOPE_BBOX,
          label: "Envelope MapServer SGB",
        },
      },
    );
    assert.equal(outsideBboxRes.visualClass, "gray");
    assert.equal(
      outsideBboxRes.coverageAndQuality.modelCoverageStatus,
      "outside_model_extent",
    );
  });

  it("classifies all 27 neighborhoods as Cinza under current BLOCKED_DATA_SOURCE while reporting scenarioStatus separately", () => {
    const panel = evaluateNeighborhoodPanel(
      OFFICIAL_NEIGHBORHOOD_REGISTRY,
      SYNTHETIC_SQUARE_IN_MODEL,
      300,
      { modelCoverage: VALIDATED_POLYGON_COVERAGE },
    );

    assert.equal(panel.acquisitionStatus, "BLOCKED_DATA_SOURCE");
    assert.equal(panel.scenarioStatus, "valid");
    assert.equal(panel.totalIdentifiedNeighborhoods, 27);
    assert.equal(panel.boundaryAvailableCount, 0);
    assert.equal(panel.boundaryUnavailableOrInvalidCount, 27);
    assert.equal(panel.evaluatedNeighborhoodCount, 0);
    assert.equal(panel.isPartialBoundaryCoverage, true);
    assert.equal(panel.interceptedNeighborhoodCount, null);
    assert.equal(panel.zeroIntersectionValidCount, 0);
    assert.match(panel.coverageDisclosurePtBr, /0\/27/);
    assert.match(panel.coverageDisclosurePtBr, /BLOCKED_DATA_SOURCE/);

    for (const item of panel.items) {
      assert.equal(item.visualClass, "gray");
      assert.equal(item.coverageAndQuality.boundaryStatus, "unavailable");
      assert.equal(item.coverageAndQuality.scenarioStatus, "valid");
      assert.equal(
        item.coverageAndQuality.calculationStatus,
        "skipped_boundary_unavailable",
      );
      assert.equal(item.territorialAreaM2, null);
      assert.equal(item.interceptedAreaM2, null);
      assert.equal(item.interceptedPercent, null);
    }
  });

  it("does NOT conflate flood scenario failure with missing municipal boundaries", () => {
    const fullSynthetic = OFFICIAL_NEIGHBORHOOD_REGISTRY.map((rec) =>
      makeSyntheticRecord(rec, SYNTHETIC_SQUARE_IN_MODEL),
    );

    const panel = evaluateNeighborhoodPanel(fullSynthetic, null, 350, {
      modelCoverage: VALIDATED_POLYGON_COVERAGE,
    });

    assert.equal(panel.acquisitionStatus, "COMPLETE_OFFICIAL_COVERAGE");
    assert.equal(panel.boundaryAvailableCount, 27);
    assert.equal(panel.boundaryUnavailableOrInvalidCount, 0);
    assert.equal(panel.isPartialBoundaryCoverage, false);
    assert.equal(panel.scenarioStatus, "unavailable");
    assert.equal(panel.evaluatedNeighborhoodCount, 0);
    assert.equal(panel.interceptedNeighborhoodCount, null);

    const sample = panel.items[0];
    assert.equal(sample.visualClass, "gray");
    assert.equal(sample.coverageAndQuality.boundaryStatus, "valid");
    assert.equal(sample.coverageAndQuality.isBoundaryValid, true);
    assert.equal(sample.coverageAndQuality.modelCoverageStatus, "covered");
    assert.equal(sample.coverageAndQuality.scenarioStatus, "unavailable");
    assert.equal(
      sample.coverageAndQuality.calculationStatus,
      "skipped_scenario_unavailable",
    );
    assert.ok(
      sample.territorialAreaM2 !== null && sample.territorialAreaM2 > 1_000_000,
    );
    assert.equal(sample.interceptedAreaM2, null);
    assert.equal(sample.interceptedPercent, null);
  });

  it("never classifies neighborhoods outside or straddling validated polygon domain as green, and fails closed on invalid domain polygons", () => {
    const centro = OFFICIAL_NEIGHBORHOOD_REGISTRY.find(
      (n) => n.id === "centro",
    )!;

    const outsideRes = evaluateNeighborhoodScenarioOverlap(
      makeSyntheticRecord(centro, SYNTHETIC_SQUARE_OUTSIDE_MODEL),
      SYNTHETIC_SQUARE_IN_MODEL,
      300,
      { modelCoverage: VALIDATED_POLYGON_COVERAGE },
    );
    assert.equal(outsideRes.visualClass, "gray");
    assert.equal(outsideRes.coverageAndQuality.boundaryStatus, "valid");
    assert.equal(
      outsideRes.coverageAndQuality.modelCoverageStatus,
      "outside_model_extent",
    );
    assert.equal(
      outsideRes.coverageAndQuality.calculationStatus,
      "skipped_outside_model_coverage",
    );

    const straddlingRes = evaluateNeighborhoodScenarioOverlap(
      makeSyntheticRecord(centro, SYNTHETIC_SQUARE_STRADDLING_MODEL),
      SYNTHETIC_SQUARE_IN_MODEL,
      300,
      { modelCoverage: VALIDATED_POLYGON_COVERAGE },
    );
    assert.equal(straddlingRes.visualClass, "gray");
    assert.equal(
      straddlingRes.coverageAndQuality.modelCoverageStatus,
      "partial_model_coverage",
    );

    // Invalid polygon domain fails closed to "unknown" -> gray
    const invalidDomainRes = evaluateNeighborhoodScenarioOverlap(
      makeSyntheticRecord(centro, SYNTHETIC_SQUARE_IN_MODEL),
      SYNTHETIC_SQUARE_IN_MODEL,
      300,
      {
        modelCoverage: {
          kind: "polygon",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-42.19, -21.54],
                [-42.18, -21.54],
              ],
            ],
          },
          label: "Domínio inválido",
        },
      },
    );
    assert.equal(invalidDomainRes.visualClass, "gray");
    assert.equal(invalidDomainRes.coverageAndQuality.modelCoverageStatus, "unknown");
  });

  it("evaluates green, yellow, orange, and red deterministically within validated polygon coverage and matches single prepared scenario", () => {
    assert.equal(PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0.lowMaxPercent, 5);
    assert.equal(PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0.highMaxPercent, 20);
    assert.equal(
      PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0.calibrationStatus,
      "provisional_uncalibrated",
    );
    assert.equal(
      PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0.appliesUniformlyToAllNeighborhoods,
      true,
    );

    const centro = OFFICIAL_NEIGHBORHOOD_REGISTRY.find(
      (n) => n.id === "centro",
    )!;
    const validNb = makeSyntheticRecord(centro, SYNTHETIC_SQUARE_IN_MODEL);

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
      { modelCoverage: VALIDATED_POLYGON_COVERAGE },
    );
    assert.equal(greenRes.visualClass, "green");
    assert.equal(greenRes.thresholdCalibrationStatus, "provisional_uncalibrated");
    assert.equal(greenRes.interceptedAreaM2, 0);
    assert.equal(greenRes.interceptedPercent, 0);

    const makeStripFlood = (eastLon: number): Polygon => ({
      type: "Polygon",
      coordinates: [
        [
          [-42.19, -21.54],
          [eastLon, -21.54],
          [eastLon, -21.53],
          [-42.19, -21.53],
          [-42.19, -21.54],
        ],
      ],
    });

    const yellowRes = evaluateNeighborhoodScenarioOverlap(
      validNb,
      makeStripFlood(-42.1898), // ~2%
      350,
      { modelCoverage: VALIDATED_POLYGON_COVERAGE },
    );
    assert.equal(yellowRes.visualClass, "yellow");

    const orangeRes = evaluateNeighborhoodScenarioOverlap(
      validNb,
      makeStripFlood(-42.1888), // ~12%
      425,
      { modelCoverage: VALIDATED_POLYGON_COVERAGE },
    );
    assert.equal(orangeRes.visualClass, "orange");

    const redRes = evaluateNeighborhoodScenarioOverlap(
      validNb,
      makeStripFlood(-42.1865), // ~35%
      550,
      { modelCoverage: VALIDATED_POLYGON_COVERAGE },
    );
    assert.equal(redRes.visualClass, "red");

    const prepared = prepareFloodScenario(
      makeStripFlood(-42.1865),
      550,
      VALIDATED_POLYGON_COVERAGE,
    );
    const singlePreparedRes = evaluateNeighborhoodWithPreparedScenario(
      validNb,
      prepared,
    );
    assert.deepEqual(singlePreparedRes, redRes);
  });

  it("integrates consistently with R02-C compareFloodScenarios and computeDerivedFloodArea over nested flood stages", () => {
    const scenario300: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-42.19, -21.54],
          [-42.189, -21.54],
          [-42.189, -21.53],
          [-42.19, -21.53],
          [-42.19, -21.54],
        ],
      ],
    };
    const scenario550: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-42.19, -21.54],
          [-42.186, -21.54],
          [-42.186, -21.53],
          [-42.19, -21.53],
          [-42.19, -21.54],
        ],
      ],
    };

    const area300 = computeDerivedFloodArea(scenario300, 300);
    const area550 = computeDerivedFloodArea(scenario550, 550);
    const cmp = compareFloodScenarios(scenario300, 300, scenario550, 550);
    assert.equal(area300.status, "valid");
    assert.equal(area550.status, "valid");
    assert.equal(cmp.status, "valid");
    assert.equal(cmp.isNestedAInB, true);
    assert.equal(cmp.conservation.withinTolerance, true);

    const centro = makeSyntheticRecord(
      OFFICIAL_NEIGHBORHOOD_REGISTRY.find((n) => n.id === "centro")!,
      SYNTHETIC_SQUARE_IN_MODEL,
    );

    const nb300 = evaluateNeighborhoodScenarioOverlap(centro, scenario300, 300, {
      modelCoverage: VALIDATED_POLYGON_COVERAGE,
    });
    const nb550 = evaluateNeighborhoodScenarioOverlap(centro, scenario550, 550, {
      modelCoverage: VALIDATED_POLYGON_COVERAGE,
    });

    assert.equal(nb300.visualClass, "orange"); // ~10%
    assert.equal(nb550.visualClass, "red"); // ~40%
    assert.ok(nb300.interceptedAreaM2 !== null && nb550.interceptedAreaM2 !== null);
    assert.ok(nb550.interceptedAreaM2 > nb300.interceptedAreaM2);
    // When neighborhood encloses both nested scenarios inside validated coverage,
    // delta in intercepted neighborhood area equals R02-C exclusive expansion B \ A.
    const deltaIntercepted = nb550.interceptedAreaM2 - nb300.interceptedAreaM2;
    assert.ok(Math.abs(deltaIntercepted - cmp.onlyB.areaSquareMeters) < 1e-3);
  });

  it("handles holes, overlapping scenario MultiPolygons, partial coverage, fail-closed rejections, and safety disclaimers", () => {
    const nbWithHole: Polygon = {
      type: "Polygon",
      coordinates: [
        SYNTHETIC_SQUARE_IN_MODEL.coordinates[0],
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
        SYNTHETIC_SQUARE_IN_MODEL.coordinates,
        SYNTHETIC_SQUARE_IN_MODEL.coordinates,
      ],
    };
    const partialRegistry = OFFICIAL_NEIGHBORHOOD_REGISTRY.map((rec) =>
      rec.maintainerPriority ? makeSyntheticRecord(rec, nbWithHole) : rec,
    );

    const panel = evaluateNeighborhoodPanel(partialRegistry, duplicatedFlood, 450, {
      modelCoverage: VALIDATED_POLYGON_COVERAGE,
    });
    assert.equal(panel.acquisitionStatus, "PARTIAL_OFFICIAL_COVERAGE");
    assert.equal(panel.boundaryAvailableCount, 7);
    assert.equal(panel.evaluatedNeighborhoodCount, 7);
    assert.equal(panel.interceptedNeighborhoodCount, 7);
    assert.equal(panel.isPartialBoundaryCoverage, true);
    assert.match(panel.coverageDisclosurePtBr, /7 de 27/);

    const centroRes = panel.items.find((i) => i.neighborhoodId === "centro")!;
    assert.equal(centroRes.visualClass, "red");
    assert.equal(centroRes.interceptedPercent, 100);
    assert.equal(centroRes.coverageAndQuality.neighborhoodHoleCount, 1);

    const saoFelix = OFFICIAL_NEIGHBORHOOD_REGISTRY.find(
      (n) => n.id === "sao-felix",
    )!;
    const corruptedHoleRes = evaluateNeighborhoodScenarioOverlap(
      makeSyntheticRecord(saoFelix, {
        type: "Polygon",
        coordinates: [
          SYNTHETIC_SQUARE_IN_MODEL.coordinates[0],
          [
            [-42.186, -21.536],
            [-42.186, -21.536],
          ],
        ],
      }),
      SYNTHETIC_SQUARE_IN_MODEL,
      400,
      { modelCoverage: VALIDATED_POLYGON_COVERAGE },
    );
    assert.equal(corruptedHoleRes.visualClass, "gray");
    assert.equal(
      corruptedHoleRes.coverageAndQuality.boundaryStatus,
      "invalid_geometry",
    );
    assert.equal(
      corruptedHoleRes.coverageAndQuality.calculationStatus,
      "skipped_boundary_invalid",
    );
    assert.deepEqual(corruptedHoleRes.disclaimers, NEIGHBORHOOD_SAFETY_DISCLAIMERS);

    const invalidScheme: NeighborhoodThresholdScheme = {
      ...PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0,
      lowMaxPercent: 25,
      highMaxPercent: 15,
    };
    assert.equal(isValidThresholdScheme(invalidScheme), false);
    assert.throws(
      () => classifyNeighborhoodOverlap(100, 1000, invalidScheme),
      RangeError,
    );
  });
});
