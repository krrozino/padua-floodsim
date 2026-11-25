import type { MultiPolygon, Polygon, Position } from "geojson";
import polygonClipping from "polygon-clipping";
import type {
  MultiPolygon as ClipMultiPolygon,
  Polygon as ClipPolygon,
  Ring as ClipRing,
} from "polygon-clipping";
import {
  computeDerivedFloodArea,
  computeGeodesicRingAreaM2,
  type FloodAreaInput,
} from "../sgb/area.ts";
import {
  DEFAULT_SGB_MODEL_COVERAGE_DOMAIN,
  NEIGHBORHOOD_SAFETY_DISCLAIMERS,
  NEIGHBORHOOD_VISUAL_CLASS_META,
  PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0,
  isValidThresholdScheme,
  type BoundingBox2D,
  type FloodModelCoverageDomain,
  type IntersectionCalculationStatus,
  type ModelSpatialCoverageStatus,
  type NeighborhoodBoundaryRecord,
  type NeighborhoodPanelEvaluationSummary,
  type NeighborhoodScenarioEvaluation,
  type NeighborhoodThresholdScheme,
  type NeighborhoodVisualClass,
  type ScenarioGeometryStatus,
} from "./contract.ts";
import {
  OFFICIAL_NEIGHBORHOOD_COUNT,
  deriveAcquisitionStatus,
  validateUniqueNeighborhoodRecords,
} from "./registry.ts";

export const NEIGHBORHOOD_AREA_METHOD_ID =
  "wgs84-ellipsoidal-authalic-intersection-v1" as const;

// Upper plausibility bound for a single urban neighborhood in Santo Antônio de Pádua (200 km²).
const MAX_PLAUSIBLE_NEIGHBORHOOD_AREA_M2 = 200_000_000;
const MODEL_COVERAGE_BOUNDARY_TOLERANCE_M2 = 1.0;

interface PreparedGeometry {
  readonly status: "valid" | "empty" | "invalid";
  readonly dissolved: ClipMultiPolygon | null;
  readonly bbox: BoundingBox2D | null;
  readonly areaM2: number | null;
  readonly partCount: number;
  readonly holeCount: number;
  readonly reason: string | null;
}

type PreparedModelCoverage =
  | {
      readonly kind: "bbox";
      readonly bbox: BoundingBox2D;
    }
  | {
      readonly kind: "polygon";
      readonly dissolved: ClipMultiPolygon;
      readonly bbox: BoundingBox2D;
    }
  | {
      readonly kind: "unknown";
      readonly reason: string;
    };

export interface PreparedFloodScenario {
  readonly selectedStageCm: number;
  readonly status: ScenarioGeometryStatus;
  readonly dissolved: ClipMultiPolygon | null;
  readonly bbox: BoundingBox2D | null;
  readonly partCount: number;
  readonly reason: string | null;
  readonly modelCoverage: PreparedModelCoverage;
}

export interface EvaluateNeighborhoodOptions {
  readonly thresholdScheme?: NeighborhoodThresholdScheme;
  readonly modelCoverage?: FloodModelCoverageDomain;
}

function closeRing(coords: readonly Position[]): ClipRing {
  const ring: [number, number][] = coords.map((pt) => [pt[0], pt[1]]);
  const first = ring.at(0);
  const last = ring.at(-1);
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

function collectClipPolygonsFromValidatedInput(
  input: FloodAreaInput,
): ClipPolygon[] {
  const geoms: (Polygon | MultiPolygon)[] = [];
  if (input.type === "FeatureCollection") {
    for (const feature of input.features) {
      if (feature.geometry) geoms.push(feature.geometry);
    }
  } else if (input.type === "Feature") {
    if (input.geometry) geoms.push(input.geometry);
  } else {
    geoms.push(input);
  }

  const out: ClipPolygon[] = [];
  for (const geom of geoms) {
    const groups =
      geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    for (const rings of groups) {
      out.push(rings.map(closeRing));
    }
  }
  return out;
}

function computeBoundingBox(multi: ClipMultiPolygon): BoundingBox2D | null {
  const points = multi.flat(2);
  if (points.length === 0) return null;

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of points) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return Number.isFinite(minLon) ? [minLon, minLat, maxLon, maxLat] : null;
}

function bboxesOverlap(a: BoundingBox2D, b: BoundingBox2D): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function bboxContains(outer: BoundingBox2D, inner: BoundingBox2D): boolean {
  return (
    inner[0] >= outer[0] &&
    inner[2] <= outer[2] &&
    inner[1] >= outer[1] &&
    inner[3] <= outer[3]
  );
}

function sumClipMultiPolygonAreaM2(multi: ClipMultiPolygon): number | null {
  let total = 0;
  for (const poly of multi) {
    if (!poly || poly.length === 0) continue;
    let net = computeGeodesicRingAreaM2(poly[0]);
    for (let i = 1; i < poly.length; i += 1) {
      net -= computeGeodesicRingAreaM2(poly[i]);
    }
    if (!Number.isFinite(net) || net < 0) return null;
    total += net;
  }
  return Number.isFinite(total) ? total : null;
}

/**
 * Delegates fail-closed GeoJSON validation, hole integrity, and plausibility checks
 * to `computeDerivedFloodArea` in `lib/sgb/area.ts` (avoiding duplicated ring sanitizers).
 *
 * NOTE: Once PR #54 (`extractAndDissolvePolygons` / `computeDissolvedAreaMetrics`) is
 * integrated into `main`, `prepareValidatedGeometry` can be collapsed into a single pass.
 */
function prepareValidatedGeometry(
  input: FloodAreaInput,
  stageCm: number,
  maxPlausibleAreaM2?: number,
): PreparedGeometry {
  const checked = computeDerivedFloodArea(
    input,
    stageCm,
    maxPlausibleAreaM2 ? { maxPlausibleAreaM2 } : {},
  );

  if (checked.status !== "valid") {
    return {
      status: checked.status,
      dissolved: null,
      bbox: null,
      areaM2: null,
      partCount: checked.polygonPartCount,
      holeCount: checked.holeCount,
      reason: checked.reason,
    };
  }

  try {
    const rawPolys = collectClipPolygonsFromValidatedInput(input);
    const dissolved =
      rawPolys.length === 1
        ? polygonClipping.union(rawPolys[0])
        : polygonClipping.union(rawPolys[0], ...rawPolys.slice(1));
    return {
      status: "valid",
      dissolved,
      bbox: computeBoundingBox(dissolved),
      areaM2: checked.areaSquareMeters,
      partCount: checked.polygonPartCount,
      holeCount: checked.holeCount,
      reason: null,
    };
  } catch {
    return {
      status: "invalid",
      dissolved: null,
      bbox: null,
      areaM2: null,
      partCount: checked.polygonPartCount,
      holeCount: checked.holeCount,
      reason: "Falha topológica ao preparar geometria para interseção.",
    };
  }
}

function prepareModelCoverageDomain(
  domain: FloodModelCoverageDomain = DEFAULT_SGB_MODEL_COVERAGE_DOMAIN,
): PreparedModelCoverage {
  if (domain.kind === "unknown") {
    return domain;
  }
  if (domain.kind === "bbox") {
    const [minLon, minLat, maxLon, maxLat] = domain.bbox;
    if (
      domain.bbox.some((v) => !Number.isFinite(v)) ||
      minLon >= maxLon ||
      minLat >= maxLat
    ) {
      return {
        kind: "unknown",
        reason: "Extensão espacial (bbox) do modelo de inundação inválida.",
      };
    }
    return { kind: "bbox", bbox: domain.bbox };
  }

  const prepared = prepareValidatedGeometry(domain.geometry, 0);
  if (prepared.status !== "valid" || !prepared.dissolved || !prepared.bbox) {
    return {
      kind: "unknown",
      reason:
        prepared.reason ??
        "Polígono de domínio espacial do modelo inválido ou indisponível.",
    };
  }
  return {
    kind: "polygon",
    dissolved: prepared.dissolved,
    bbox: prepared.bbox,
  };
}

/**
 * Prepares and dissolves the flood scenario geometry ONCE per panel evaluation,
 * avoiding redundant GeoJSON parsing and topological unions across all 27 neighborhoods.
 */
export function prepareFloodScenario(
  scenarioInput: FloodAreaInput | null | undefined,
  selectedStageCm: number,
  modelCoverage: FloodModelCoverageDomain = DEFAULT_SGB_MODEL_COVERAGE_DOMAIN,
): PreparedFloodScenario {
  const preparedCoverage = prepareModelCoverageDomain(modelCoverage);

  if (!scenarioInput || typeof scenarioInput !== "object") {
    return {
      selectedStageCm,
      status: "unavailable",
      dissolved: null,
      bbox: null,
      partCount: 0,
      reason: "Camada de mancha do cenário ausente ou falha na consulta.",
      modelCoverage: preparedCoverage,
    };
  }

  const geom = prepareValidatedGeometry(scenarioInput, selectedStageCm);
  return {
    selectedStageCm,
    status: geom.status,
    dissolved: geom.dissolved,
    bbox: geom.bbox,
    partCount: geom.partCount,
    reason: geom.reason,
    modelCoverage: preparedCoverage,
  };
}

function assessNeighborhoodModelCoverage(
  nbDissolved: ClipMultiPolygon,
  nbBbox: BoundingBox2D | null,
  modelCoverage: PreparedModelCoverage,
): { readonly status: ModelSpatialCoverageStatus; readonly reason: string | null } {
  if (modelCoverage.kind === "unknown") {
    return { status: "unknown", reason: modelCoverage.reason };
  }

  if (!nbBbox) {
    return {
      status: "unknown",
      reason: "Caixa envolvente do bairro indisponível para aferir cobertura.",
    };
  }

  if (modelCoverage.kind === "bbox") {
    if (!bboxesOverlap(nbBbox, modelCoverage.bbox)) {
      return {
        status: "outside_model_extent",
        reason:
          "Bairro situado fora da extensão espacial coberta pelo modelo de inundação; classificação verde proibida.",
      };
    }
    if (!bboxContains(modelCoverage.bbox, nbBbox)) {
      return {
        status: "partial_model_coverage",
        reason:
          "Bairro ultrapassa parcialmente a extensão espacial conhecida do modelo de inundação; denominador integral não é coberto.",
      };
    }
    return { status: "covered", reason: null };
  }

  if (!bboxesOverlap(nbBbox, modelCoverage.bbox)) {
    return {
      status: "outside_model_extent",
      reason:
        "Bairro situado fora do polígono de cobertura espacial do modelo de inundação.",
    };
  }

  try {
    const inside = polygonClipping.intersection(
      nbDissolved,
      modelCoverage.dissolved,
    );
    const insideArea = sumClipMultiPolygonAreaM2(inside) ?? 0;
    if (insideArea <= MODEL_COVERAGE_BOUNDARY_TOLERANCE_M2) {
      return {
        status: "outside_model_extent",
        reason:
          "Bairro sem interseção com a área mapeada pelo modelo de inundação.",
      };
    }
    const outside = polygonClipping.difference(
      nbDissolved,
      modelCoverage.dissolved,
    );
    const outsideArea = sumClipMultiPolygonAreaM2(outside) ?? 0;
    if (outsideArea > MODEL_COVERAGE_BOUNDARY_TOLERANCE_M2) {
      return {
        status: "partial_model_coverage",
        reason:
          "Parte do território do bairro situa-se fora da cobertura do modelo hidráulico.",
      };
    }
    return { status: "covered", reason: null };
  } catch {
    return {
      status: "unknown",
      reason: "Falha topológica ao verificar cobertura espacial do modelo.",
    };
  }
}

export function classifyNeighborhoodOverlap(
  interceptedAreaM2: number,
  territorialAreaM2: number,
  scheme: NeighborhoodThresholdScheme = PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0,
): {
  readonly visualClass: Exclude<NeighborhoodVisualClass, "gray">;
  readonly effectiveInterceptedAreaM2: number;
  readonly effectiveInterceptedPercent: number;
} {
  if (!isValidThresholdScheme(scheme)) {
    throw new RangeError(
      "Esquema de limiares territoriais inválido: exige cutpoints globais ordenados 0 < lowMaxPercent < highMaxPercent < 100.",
    );
  }
  if (
    !Number.isFinite(territorialAreaM2) ||
    territorialAreaM2 <= 0 ||
    !Number.isFinite(interceptedAreaM2) ||
    interceptedAreaM2 < 0
  ) {
    throw new RangeError(
      "Áreas territoriais inválidas para classificação determinística.",
    );
  }

  if (interceptedAreaM2 <= scheme.zeroIntersectionToleranceM2) {
    return {
      visualClass: "green",
      effectiveInterceptedAreaM2: 0,
      effectiveInterceptedPercent: 0,
    };
  }

  const clampedAreaM2 = Math.min(interceptedAreaM2, territorialAreaM2);
  const percent = (clampedAreaM2 / territorialAreaM2) * 100;

  if (percent <= scheme.lowMaxPercent) {
    return {
      visualClass: "yellow",
      effectiveInterceptedAreaM2: clampedAreaM2,
      effectiveInterceptedPercent: percent,
    };
  }
  if (percent <= scheme.highMaxPercent) {
    return {
      visualClass: "orange",
      effectiveInterceptedAreaM2: clampedAreaM2,
      effectiveInterceptedPercent: percent,
    };
  }
  return {
    visualClass: "red",
    effectiveInterceptedAreaM2: clampedAreaM2,
    effectiveInterceptedPercent: percent,
  };
}

function buildResult(
  record: NeighborhoodBoundaryRecord,
  preparedScenario: PreparedFloodScenario,
  scheme: NeighborhoodThresholdScheme,
  params: {
    readonly territorialAreaM2: number | null;
    readonly interceptedAreaM2: number | null;
    readonly interceptedPercent: number | null;
    readonly boundaryStatus: NeighborhoodBoundaryRecord["geometryStatus"];
    readonly modelCoverageStatus: ModelSpatialCoverageStatus;
    readonly calculationStatus: IntersectionCalculationStatus;
    readonly visualClass: NeighborhoodVisualClass;
    readonly nbPartCount: number;
    readonly nbHoleCount: number;
    readonly reason: string | null;
  },
): NeighborhoodScenarioEvaluation {
  const { territorialAreaM2, interceptedAreaM2 } = params;
  return {
    classification: "derived",
    neighborhoodId: record.id,
    officialNumber: record.officialNumber,
    officialName: record.officialName,
    riverBank: record.riverBank,
    maintainerPriority: record.maintainerPriority,
    source: record.source,
    version: record.version,
    crs: "EPSG:4326",
    areaMethod: NEIGHBORHOOD_AREA_METHOD_ID,
    selectedStageCm: preparedScenario.selectedStageCm,
    territorialAreaM2,
    territorialAreaHa:
      territorialAreaM2 !== null ? territorialAreaM2 / 10_000 : null,
    interceptedAreaM2,
    interceptedAreaHa:
      interceptedAreaM2 !== null ? interceptedAreaM2 / 10_000 : null,
    interceptedPercent: params.interceptedPercent,
    coverageAndQuality: {
      boundaryStatus: params.boundaryStatus,
      modelCoverageStatus: params.modelCoverageStatus,
      scenarioStatus: preparedScenario.status,
      calculationStatus: params.calculationStatus,
      isBoundaryValid: params.boundaryStatus === "valid",
      isCoveredByModel: params.modelCoverageStatus === "covered",
      isIntersectionComputed: params.calculationStatus === "computed",
      neighborhoodPolygonPartCount: params.nbPartCount,
      neighborhoodHoleCount: params.nbHoleCount,
      scenarioPolygonPartCount: preparedScenario.partCount,
      reason: params.reason,
    },
    visualClass: params.visualClass,
    visualLabelPtBr: NEIGHBORHOOD_VISUAL_CLASS_META[params.visualClass].labelPtBr,
    thresholdSchemeId: scheme.id,
    thresholdCalibrationStatus: scheme.calibrationStatus,
    disclaimers: NEIGHBORHOOD_SAFETY_DISCLAIMERS,
  };
}

function measureIntersectionArea(
  nbGeom: PreparedGeometry,
  preparedScenario: PreparedFloodScenario,
): { readonly areaM2: number | null; readonly errorReason: string | null } {
  if (
    !nbGeom.dissolved ||
    !preparedScenario.dissolved ||
    !nbGeom.bbox ||
    !preparedScenario.bbox ||
    !bboxesOverlap(nbGeom.bbox, preparedScenario.bbox)
  ) {
    return { areaM2: 0, errorReason: null };
  }

  let clipped: ClipMultiPolygon;
  try {
    clipped = polygonClipping.intersection(
      nbGeom.dissolved,
      preparedScenario.dissolved,
    );
  } catch {
    return {
      areaM2: null,
      errorReason: "Falha topológica ao calcular interseção bairro × mancha.",
    };
  }

  const measured = sumClipMultiPolygonAreaM2(clipped);
  if (measured === null || measured < 0) {
    return {
      areaM2: null,
      errorReason: "Área líquida inválida na geometria resultante da interseção.",
    };
  }

  const territorialAreaM2 = nbGeom.areaM2 ?? 0;
  const maxDriftM2 = territorialAreaM2 * 1e-6 + 0.01;
  if (measured > territorialAreaM2 + maxDriftM2) {
    return {
      areaM2: null,
      errorReason:
        "Violação de conservação de área (interseção excedeu a área territorial do bairro).",
    };
  }

  return { areaM2: Math.min(measured, territorialAreaM2), errorReason: null };
}

function buildMissingOrInvalidBoundaryEvaluation(
  record: NeighborhoodBoundaryRecord,
  preparedScenario: PreparedFloodScenario,
  scheme: NeighborhoodThresholdScheme,
  boundaryStatus: NeighborhoodBoundaryRecord["geometryStatus"],
  reason: string,
  nbPartCount = 0,
  nbHoleCount = 0,
): NeighborhoodScenarioEvaluation {
  const calculationStatus: IntersectionCalculationStatus =
    boundaryStatus === "unavailable"
      ? "skipped_boundary_unavailable"
      : "skipped_boundary_invalid";

  return buildResult(record, preparedScenario, scheme, {
    territorialAreaM2: null,
    interceptedAreaM2: null,
    interceptedPercent: null,
    boundaryStatus,
    modelCoverageStatus: "unknown",
    calculationStatus,
    visualClass: "gray",
    nbPartCount,
    nbHoleCount,
    reason,
  });
}

export function evaluateNeighborhoodWithPreparedScenario(
  record: NeighborhoodBoundaryRecord,
  preparedScenario: PreparedFloodScenario,
  scheme: NeighborhoodThresholdScheme = PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0,
): NeighborhoodScenarioEvaluation {
  if (!isValidThresholdScheme(scheme)) {
    throw new RangeError(
      "Esquema de limiares territoriais inválido: exige cutpoints globais ordenados 0 < lowMaxPercent < highMaxPercent < 100.",
    );
  }

  // 1. Validate municipal boundary availability & geometry quality independently from scenario state.
  if (record.geometry === null || record.geometryStatus !== "valid") {
    const boundaryStatus =
      record.geometry === null && record.geometryStatus === "valid"
        ? "unavailable"
        : record.geometryStatus;
    const reason =
      record.geometry === null
        ? "Polígono oficial do bairro indisponível (BLOCKED_DATA_SOURCE)."
        : `Geometria municipal marcada como '${record.geometryStatus}'.`;
    return buildMissingOrInvalidBoundaryEvaluation(
      record,
      preparedScenario,
      scheme,
      boundaryStatus,
      reason,
    );
  }

  const nbGeom = prepareValidatedGeometry(
    record.geometry,
    preparedScenario.selectedStageCm,
    MAX_PLAUSIBLE_NEIGHBORHOOD_AREA_M2,
  );
  if (nbGeom.status !== "valid" || !nbGeom.dissolved || nbGeom.areaM2 === null) {
    return buildMissingOrInvalidBoundaryEvaluation(
      record,
      preparedScenario,
      scheme,
      "invalid_geometry",
      nbGeom.reason ??
        "Polígono do bairro inválido ou fora dos limites de plausibilidade.",
      nbGeom.partCount,
      nbGeom.holeCount,
    );
  }

  const territorialAreaM2 = nbGeom.areaM2;

  // 2. Assess flood model spatial coverage for this valid municipal boundary.
  const coverage = assessNeighborhoodModelCoverage(
    nbGeom.dissolved,
    nbGeom.bbox,
    preparedScenario.modelCoverage,
  );

  // 3. Check scenario geometry availability WITHOUT mutating `boundaryStatus`.
  if (preparedScenario.status !== "valid" || !preparedScenario.dissolved) {
    return buildResult(record, preparedScenario, scheme, {
      territorialAreaM2,
      interceptedAreaM2: null,
      interceptedPercent: null,
      boundaryStatus: "valid",
      modelCoverageStatus: coverage.status,
      calculationStatus:
        preparedScenario.status === "invalid"
          ? "skipped_scenario_invalid"
          : "skipped_scenario_unavailable",
      visualClass: "gray",
      nbPartCount: nbGeom.partCount,
      nbHoleCount: nbGeom.holeCount,
      reason:
        preparedScenario.reason ??
        "Mancha de inundação do cenário indisponível; limites municipais permanecem válidos.",
    });
  }

  // 4. Refuse to classify as green when neighborhood lies outside or straddles model coverage.
  if (coverage.status !== "covered") {
    return buildResult(record, preparedScenario, scheme, {
      territorialAreaM2,
      interceptedAreaM2: null,
      interceptedPercent: null,
      boundaryStatus: "valid",
      modelCoverageStatus: coverage.status,
      calculationStatus: "skipped_outside_model_coverage",
      visualClass: "gray",
      nbPartCount: nbGeom.partCount,
      nbHoleCount: nbGeom.holeCount,
      reason: coverage.reason,
    });
  }

  // 5. Compute topological intersection and apply provisional uniform thresholds.
  const intersection = measureIntersectionArea(nbGeom, preparedScenario);
  if (intersection.areaM2 === null) {
    return buildResult(record, preparedScenario, scheme, {
      territorialAreaM2,
      interceptedAreaM2: null,
      interceptedPercent: null,
      boundaryStatus: "valid",
      modelCoverageStatus: "covered",
      calculationStatus: "failed_intersection_topology",
      visualClass: "gray",
      nbPartCount: nbGeom.partCount,
      nbHoleCount: nbGeom.holeCount,
      reason: intersection.errorReason,
    });
  }

  const classified = classifyNeighborhoodOverlap(
    intersection.areaM2,
    territorialAreaM2,
    scheme,
  );

  return buildResult(record, preparedScenario, scheme, {
    territorialAreaM2,
    interceptedAreaM2: classified.effectiveInterceptedAreaM2,
    interceptedPercent: classified.effectiveInterceptedPercent,
    boundaryStatus: "valid",
    modelCoverageStatus: "covered",
    calculationStatus: "computed",
    visualClass: classified.visualClass,
    nbPartCount: nbGeom.partCount,
    nbHoleCount: nbGeom.holeCount,
    reason: null,
  });
}

export function evaluateNeighborhoodScenarioOverlap(
  record: NeighborhoodBoundaryRecord,
  scenarioInput: FloodAreaInput | null | undefined,
  selectedStageCm: number,
  options: EvaluateNeighborhoodOptions = {},
): NeighborhoodScenarioEvaluation {
  const scheme =
    options.thresholdScheme ?? PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0;
  const preparedScenario = prepareFloodScenario(
    scenarioInput,
    selectedStageCm,
    options.modelCoverage,
  );
  return evaluateNeighborhoodWithPreparedScenario(
    record,
    preparedScenario,
    scheme,
  );
}

function formatCoverageDisclosure(params: {
  readonly itemCount: number;
  readonly boundaryAvailableCount: number;
  readonly boundaryUnavailableOrInvalidCount: number;
  readonly isPartialBoundaryCoverage: boolean;
  readonly scenarioStatus: ScenarioGeometryStatus;
  readonly outsideOrUnknownModelCoverageCount: number;
}): string {
  let baseCoverageText: string;
  if (params.boundaryAvailableCount === 0) {
    baseCoverageText = `Limites municipais 0/${OFFICIAL_NEIGHBORHOOD_COUNT} (BLOCKED_DATA_SOURCE): todos os ${params.itemCount} bairros permanecem em Cinza até a obtenção dos polígonos oficiais.`;
  } else if (params.isPartialBoundaryCoverage) {
    baseCoverageText = `Cobertura parcial de limites declarada: ${params.boundaryAvailableCount} de ${OFFICIAL_NEIGHBORHOOD_COUNT} bairros possuem polígono validado (${params.boundaryUnavailableOrInvalidCount} indisponíveis em Cinza).`;
  } else {
    baseCoverageText = `Limites municipais disponíveis: ${params.boundaryAvailableCount} de ${OFFICIAL_NEIGHBORHOOD_COUNT} bairros validados.`;
  }

  let scenarioSuffix = "";
  if (params.scenarioStatus !== "valid") {
    scenarioSuffix = ` Consulta da mancha do cenário falhou ou está vazia ('${params.scenarioStatus}'), mantendo os bairros em Cinza sem invalidar os limites municipais.`;
  } else if (params.outsideOrUnknownModelCoverageCount > 0) {
    scenarioSuffix = ` ${params.outsideOrUnknownModelCoverageCount} bairro(s) fora ou parcialmente fora da cobertura conhecida do modelo permanecem em Cinza.`;
  }

  return `${baseCoverageText}${scenarioSuffix}`;
}

/**
 * Evaluates a neighborhood registry against a selected flood stage scenario:
 * - Validates unique neighborhood identifiers and official numbers;
 * - Prepares scenario geometry ONCE for the whole panel;
 * - Separates municipal boundary availability, model spatial coverage, and scenario query success.
 */
export function evaluateNeighborhoodPanel(
  records: readonly NeighborhoodBoundaryRecord[],
  scenarioInput: FloodAreaInput | null | undefined,
  selectedStageCm: number,
  options: EvaluateNeighborhoodOptions = {},
): NeighborhoodPanelEvaluationSummary {
  const scheme =
    options.thresholdScheme ?? PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0;
  if (!isValidThresholdScheme(scheme)) {
    throw new RangeError(
      "Esquema de limiares territoriais inválido: exige cutpoints globais ordenados 0 < lowMaxPercent < highMaxPercent < 100.",
    );
  }

  validateUniqueNeighborhoodRecords(records);

  const preparedScenario = prepareFloodScenario(
    scenarioInput,
    selectedStageCm,
    options.modelCoverage,
  );

  const items = records.map((record) =>
    evaluateNeighborhoodWithPreparedScenario(record, preparedScenario, scheme),
  );

  const boundaryAvailableCount = items.filter(
    (item) => item.coverageAndQuality.isBoundaryValid,
  ).length;
  const boundaryUnavailableOrInvalidCount =
    items.length - boundaryAvailableCount;
  const evaluatedItems = items.filter(
    (item) => item.coverageAndQuality.isIntersectionComputed,
  );
  const evaluatedNeighborhoodCount = evaluatedItems.length;
  const outsideOrUnknownModelCoverageCount = items.filter(
    (item) =>
      item.coverageAndQuality.isBoundaryValid &&
      !item.coverageAndQuality.isCoveredByModel,
  ).length;

  const acquisitionStatus = deriveAcquisitionStatus(boundaryAvailableCount);
  const isPartialBoundaryCoverage =
    boundaryAvailableCount < OFFICIAL_NEIGHBORHOOD_COUNT;

  const interceptedNeighborhoodCount =
    evaluatedNeighborhoodCount === 0
      ? null
      : evaluatedItems.filter(
          (item) =>
            item.interceptedAreaM2 !== null && item.interceptedAreaM2 > 0,
        ).length;

  const zeroIntersectionValidCount = evaluatedItems.filter(
    (item) => item.visualClass === "green",
  ).length;

  return {
    classification: "derived",
    acquisitionStatus,
    scenarioStatus: preparedScenario.status,
    scenarioReason: preparedScenario.reason,
    selectedStageCm,
    totalIdentifiedNeighborhoods: OFFICIAL_NEIGHBORHOOD_COUNT,
    boundaryAvailableCount,
    boundaryUnavailableOrInvalidCount,
    evaluatedNeighborhoodCount,
    outsideOrUnknownModelCoverageCount,
    isPartialBoundaryCoverage,
    coverageDisclosurePtBr: formatCoverageDisclosure({
      itemCount: items.length,
      boundaryAvailableCount,
      boundaryUnavailableOrInvalidCount,
      isPartialBoundaryCoverage,
      scenarioStatus: preparedScenario.status,
      outsideOrUnknownModelCoverageCount,
    }),
    interceptedNeighborhoodCount,
    zeroIntersectionValidCount,
    thresholdScheme: scheme,
    items,
    disclaimers: NEIGHBORHOOD_SAFETY_DISCLAIMERS,
  };
}
