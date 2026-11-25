import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import polygonClipping from "polygon-clipping";
import {
  MAX_PLAUSIBLE_FLOOD_AREA_M2,
  SGB_AREA_METHOD_ID,
  SGB_AREA_SOURCE,
  computeDissolvedAreaMetrics,
  extractAndDissolvePolygons,
  type ClipMultiPolygon,
  type FloodAreaInput,
} from "./area.ts";

export const SGB_COMPARISON_METHOD_ID =
  "wgs84-ellipsoidal-topological-overlay-v1" as const;

/**
 * Justified numerical tolerance for area conservation identities:
 *   Area(A) ≈ Area(A ∩ B) + Area(A \ B)
 *   Area(B) ≈ Area(A ∩ B) + Area(B \ A)
 *
 * When `polygon-clipping` splits edges at intersection points in IEEE-754 double
 * precision, the trapezoidal integration in WGS84 authalic latitude over the split
 * edges differs from the unsplit edges by O(1e-7..1e-6) relative error. A 0.01%
 * (1e-4) relative bound with a 1.0 m² floor matches the independent validation
 * tolerance in docs/research/SGB_AREA_VALIDATION_2026-11-25.md while reliably
 * catching any topological drop, inversion, or double-counting bug (fail-closed).
 */
export const AREA_CONSERVATION_RELATIVE_TOLERANCE = 1e-4;
export const AREA_CONSERVATION_ABSOLUTE_TOLERANCE_M2 = 1.0;

export type ComparisonRegionGeoJSON = FeatureCollection<Polygon | MultiPolygon>;

export type ComparisonRegionMetrics = {
  readonly areaSquareMeters: number;
  readonly areaHectares: number;
  readonly areaSquareKm: number;
  readonly polygonPartCount: number;
  readonly holeCount: number;
};

export type AreaConservationDiagnostics = {
  readonly errorAM2: number;
  readonly errorBM2: number;
  readonly toleranceAM2: number;
  readonly toleranceBM2: number;
  readonly maxRelativeError: number;
  readonly withinTolerance: boolean;
  /** Coordinate snap-rounding step in degrees if IEEE-754 fallback was needed, or null when exact. */
  readonly precisionSnapDeg: number | null;
};

const BOOLEAN_OP_SNAP_LADDER_DEG: readonly (number | null)[] = [
  null,
  1e-11,
  1e-10,
  1e-9,
];

function snapClipMultiPolygon(
  multi: ClipMultiPolygon,
  stepDeg: number,
): ClipMultiPolygon {
  const scale = 1 / stepDeg;
  return multi.map((poly) =>
    poly.map((ring) =>
      ring.map(([lon, lat]) => [
        Math.round(lon * scale) / scale,
        Math.round(lat * scale) / scale,
      ]),
    ),
  );
}

export type ScenarioComparisonResult =
  | {
      readonly status: "valid";
      readonly classification: "derived";
      readonly provenanceKind: "live_queried_geometry";
      readonly method: typeof SGB_COMPARISON_METHOD_ID;
      readonly areaMethod: typeof SGB_AREA_METHOD_ID;
      readonly crs: "EPSG:4326";
      readonly source: typeof SGB_AREA_SOURCE;
      readonly levelACm: number;
      readonly levelBCm: number;
      readonly scenarioA: ComparisonRegionMetrics;
      readonly scenarioB: ComparisonRegionMetrics;
      readonly common: ComparisonRegionMetrics;
      readonly onlyA: ComparisonRegionMetrics;
      readonly onlyB: ComparisonRegionMetrics;
      readonly unionAreaSquareMeters: number;
      readonly unionAreaHectares: number;
      /** Signed difference: Area(B) - Area(A) in m². */
      readonly deltaSquareMeters: number;
      /** Signed difference: Area(B) - Area(A) in hectares. */
      readonly deltaHectares: number;
      /** Signed percentage variation relative to scenario A: ((B - A) / A) * 100. */
      readonly deltaPercent: number;
      /** Overlap ratio |A ∩ B| / |A ∪ B| (Jaccard index, 0..1). */
      readonly jaccardIndex: number;
      /** True when A \ B is within conservation tolerance of 0 (A ⊆ B). */
      readonly isNestedAInB: boolean;
      /** True when B \ A is within conservation tolerance of 0 (B ⊆ A). */
      readonly isNestedBInA: boolean;
      readonly conservation: AreaConservationDiagnostics;
      readonly geometries: {
        readonly common: ComparisonRegionGeoJSON;
        readonly onlyA: ComparisonRegionGeoJSON;
        readonly onlyB: ComparisonRegionGeoJSON;
      };
    }
  | {
      readonly status: "empty" | "invalid";
      readonly classification: "derived";
      readonly provenanceKind: "live_queried_geometry";
      readonly method: typeof SGB_COMPARISON_METHOD_ID;
      readonly areaMethod: typeof SGB_AREA_METHOD_ID;
      readonly crs: "EPSG:4326";
      readonly source: typeof SGB_AREA_SOURCE;
      readonly levelACm: number;
      readonly levelBCm: number;
      readonly reason: string;
    };

function clipMultiPolygonToFeatureCollection(
  multi: ClipMultiPolygon,
  region: "common" | "only_a" | "only_b",
  levelACm: number,
  levelBCm: number,
): ComparisonRegionGeoJSON {
  const validPolys = multi.filter((poly) => Array.isArray(poly) && poly.length > 0);
  if (validPolys.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          region,
          levelACm,
          levelBCm,
          classification: "derived",
        },
        geometry: {
          type: "MultiPolygon",
          coordinates: validPolys as unknown as MultiPolygon["coordinates"],
        },
      },
    ],
  };
}

function toRegionMetrics(
  areaSquareMeters: number,
  polygonPartCount: number,
  holeCount: number,
): ComparisonRegionMetrics {
  return {
    areaSquareMeters,
    areaHectares: areaSquareMeters / 10_000,
    areaSquareKm: areaSquareMeters / 1_000_000,
    polygonPartCount,
    holeCount,
  };
}

function makeFailedResult(
  status: "empty" | "invalid",
  levelACm: number,
  levelBCm: number,
  reason: string,
): ScenarioComparisonResult {
  return {
    status,
    classification: "derived",
    provenanceKind: "live_queried_geometry",
    method: SGB_COMPARISON_METHOD_ID,
    areaMethod: SGB_AREA_METHOD_ID,
    crs: "EPSG:4326",
    source: SGB_AREA_SOURCE,
    levelACm,
    levelBCm,
    reason,
  };
}

/**
 * Performs exact topological set comparison between two flood scenario geometries A and B
 * using `polygon-clipping`, without assuming that one polygon is nested inside the other:
 *
 * - Common area:       A ∩ B
 * - Exclusive to A:    A \ B
 * - Exclusive to B:    B \ A
 *
 * Enforces fail-closed input validation and area conservation checks:
 *   |Area(A) - (Area(A ∩ B) + Area(A \ B))| <= tol(A)
 *   |Area(B) - (Area(A ∩ B) + Area(B \ A))| <= tol(B)
 */
export function compareFloodScenarios(
  inputA: FloodAreaInput,
  levelACm: number,
  inputB: FloodAreaInput,
  levelBCm: number,
  options: {
    readonly maxPlausibleAreaM2?: number;
    readonly conservationRelativeTolerance?: number;
    readonly conservationAbsoluteToleranceM2?: number;
  } = {},
): ScenarioComparisonResult {
  const maxPlausibleAreaM2 =
    options.maxPlausibleAreaM2 ?? MAX_PLAUSIBLE_FLOOD_AREA_M2;
  const relTol =
    options.conservationRelativeTolerance ??
    AREA_CONSERVATION_RELATIVE_TOLERANCE;
  const absTol =
    options.conservationAbsoluteToleranceM2 ??
    AREA_CONSERVATION_ABSOLUTE_TOLERANCE_M2;

  const extractedA = extractAndDissolvePolygons(inputA);
  if (extractedA.status !== "valid") {
    return makeFailedResult(
      extractedA.status,
      levelACm,
      levelBCm,
      `Cenário A (${levelACm} cm): ${extractedA.reason}`,
    );
  }

  const extractedB = extractAndDissolvePolygons(inputB);
  if (extractedB.status !== "valid") {
    return makeFailedResult(
      extractedB.status,
      levelACm,
      levelBCm,
      `Cenário B (${levelBCm} cm): ${extractedB.reason}`,
    );
  }

  const metricsA = computeDissolvedAreaMetrics(extractedA.dissolved);
  if (
    metricsA.status !== "valid" ||
    metricsA.areaSquareMeters <= 0 ||
    metricsA.areaSquareMeters > maxPlausibleAreaM2
  ) {
    return makeFailedResult(
      "invalid",
      levelACm,
      levelBCm,
      `Cenário A (${levelACm} cm): área inválida ou fora dos limites de plausibilidade.`,
    );
  }

  const metricsB = computeDissolvedAreaMetrics(extractedB.dissolved);
  if (
    metricsB.status !== "valid" ||
    metricsB.areaSquareMeters <= 0 ||
    metricsB.areaSquareMeters > maxPlausibleAreaM2
  ) {
    return makeFailedResult(
      "invalid",
      levelACm,
      levelBCm,
      `Cenário B (${levelBCm} cm): área inválida ou fora dos limites de plausibilidade.`,
    );
  }

  let commonClip: ClipMultiPolygon | null = null;
  let onlyAClip: ClipMultiPolygon | null = null;
  let onlyBClip: ClipMultiPolygon | null = null;
  let precisionSnapDeg: number | null = null;

  for (const stepDeg of BOOLEAN_OP_SNAP_LADDER_DEG) {
    const geomA =
      stepDeg === null
        ? extractedA.dissolved
        : snapClipMultiPolygon(extractedA.dissolved, stepDeg);
    const geomB =
      stepDeg === null
        ? extractedB.dissolved
        : snapClipMultiPolygon(extractedB.dissolved, stepDeg);
    try {
      commonClip = polygonClipping.intersection(geomA, geomB);
      onlyAClip = polygonClipping.difference(geomA, geomB);
      onlyBClip = polygonClipping.difference(geomB, geomA);
      precisionSnapDeg = stepDeg;
      break;
    } catch {
      commonClip = null;
      onlyAClip = null;
      onlyBClip = null;
    }
  }

  if (!commonClip || !onlyAClip || !onlyBClip) {
    return makeFailedResult(
      "invalid",
      levelACm,
      levelBCm,
      "Falha topológica ao calcular interseção e diferenças entre os cenários A e B.",
    );
  }

  const commonMetrics = computeDissolvedAreaMetrics(commonClip);
  const onlyAMetrics = computeDissolvedAreaMetrics(onlyAClip);
  const onlyBMetrics = computeDissolvedAreaMetrics(onlyBClip);

  if (
    commonMetrics.status !== "valid" ||
    onlyAMetrics.status !== "valid" ||
    onlyBMetrics.status !== "valid"
  ) {
    return makeFailedResult(
      "invalid",
      levelACm,
      levelBCm,
      "Área derivada inválida em uma das regiões topológicas da comparação.",
    );
  }

  const areaAM2 = metricsA.areaSquareMeters;
  const areaBM2 = metricsB.areaSquareMeters;
  const commonM2 = commonMetrics.areaSquareMeters;
  const onlyAM2 = onlyAMetrics.areaSquareMeters;
  const onlyBM2 = onlyBMetrics.areaSquareMeters;

  const errorAM2 = Math.abs(areaAM2 - (commonM2 + onlyAM2));
  const errorBM2 = Math.abs(areaBM2 - (commonM2 + onlyBM2));
  const toleranceAM2 = Math.max(absTol, relTol * areaAM2);
  const toleranceBM2 = Math.max(absTol, relTol * areaBM2);
  const maxRelativeError = Math.max(errorAM2 / areaAM2, errorBM2 / areaBM2);
  const withinTolerance = errorAM2 <= toleranceAM2 && errorBM2 <= toleranceBM2;

  if (!withinTolerance) {
    return makeFailedResult(
      "invalid",
      levelACm,
      levelBCm,
      `Falha na conservação de área topológica (erro A=${errorAM2.toFixed(3)} m², erro B=${errorBM2.toFixed(3)} m²).`,
    );
  }

  const unionAreaSquareMeters = commonM2 + onlyAM2 + onlyBM2;
  const deltaSquareMeters = areaBM2 - areaAM2;
  const deltaHectares = deltaSquareMeters / 10_000;
  const deltaPercent = (deltaSquareMeters / areaAM2) * 100;
  const jaccardIndex =
    unionAreaSquareMeters > 0 ? commonM2 / unionAreaSquareMeters : 0;

  return {
    status: "valid",
    classification: "derived",
    provenanceKind: "live_queried_geometry",
    method: SGB_COMPARISON_METHOD_ID,
    areaMethod: SGB_AREA_METHOD_ID,
    crs: "EPSG:4326",
    source: SGB_AREA_SOURCE,
    levelACm,
    levelBCm,
    scenarioA: toRegionMetrics(
      areaAM2,
      metricsA.polygonPartCount,
      metricsA.holeCount,
    ),
    scenarioB: toRegionMetrics(
      areaBM2,
      metricsB.polygonPartCount,
      metricsB.holeCount,
    ),
    common: toRegionMetrics(
      commonM2,
      commonMetrics.polygonPartCount,
      commonMetrics.holeCount,
    ),
    onlyA: toRegionMetrics(
      onlyAM2,
      onlyAMetrics.polygonPartCount,
      onlyAMetrics.holeCount,
    ),
    onlyB: toRegionMetrics(
      onlyBM2,
      onlyBMetrics.polygonPartCount,
      onlyBMetrics.holeCount,
    ),
    unionAreaSquareMeters,
    unionAreaHectares: unionAreaSquareMeters / 10_000,
    deltaSquareMeters,
    deltaHectares,
    deltaPercent,
    jaccardIndex,
    isNestedAInB: onlyAM2 <= toleranceAM2,
    isNestedBInA: onlyBM2 <= toleranceBM2,
    conservation: {
      errorAM2,
      errorBM2,
      toleranceAM2,
      toleranceBM2,
      maxRelativeError,
      withinTolerance,
      precisionSnapDeg,
    },
    geometries: {
      common: clipMultiPolygonToFeatureCollection(
        commonClip,
        "common",
        levelACm,
        levelBCm,
      ),
      onlyA: clipMultiPolygonToFeatureCollection(
        onlyAClip,
        "only_a",
        levelACm,
        levelBCm,
      ),
      onlyB: clipMultiPolygonToFeatureCollection(
        onlyBClip,
        "only_b",
        levelACm,
        levelBCm,
      ),
    },
  };
}
