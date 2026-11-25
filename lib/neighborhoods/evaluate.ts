import type { MultiPolygon, Polygon, Position } from "geojson";
import polygonClipping from "polygon-clipping";
import type {
  MultiPolygon as ClipMultiPolygon,
  Polygon as ClipPolygon,
  Ring as ClipRing,
} from "polygon-clipping";
import {
  computeGeodesicRingAreaM2,
  type FloodAreaInput,
} from "../sgb/area.ts";
import {
  NEIGHBORHOOD_SAFETY_DISCLAIMERS,
  NEIGHBORHOOD_VISUAL_CLASS_META,
  PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0,
  isValidThresholdScheme,
  type NeighborhoodBoundaryRecord,
  type NeighborhoodGeometryQualityStatus,
  type NeighborhoodPanelEvaluationSummary,
  type NeighborhoodScenarioEvaluation,
  type NeighborhoodThresholdScheme,
  type NeighborhoodVisualClass,
} from "./contract.ts";
import {
  OFFICIAL_NEIGHBORHOOD_COUNT,
  deriveAcquisitionStatus,
} from "./registry.ts";

export const NEIGHBORHOOD_AREA_METHOD_ID =
  "wgs84-ellipsoidal-authalic-intersection-v1" as const;

// Upper plausibility bound for a single urban neighborhood in Santo Antônio de Pádua (200 km²).
const MAX_PLAUSIBLE_NEIGHBORHOOD_AREA_M2 = 200_000_000;

function isFinitePosition(pos: unknown): pos is [number, number] {
  if (!Array.isArray(pos) || pos.length < 2) return false;
  const lon = pos[0];
  const lat = pos[1];
  return (
    typeof lon === "number" &&
    typeof lat === "number" &&
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lon >= -180 &&
    lon <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

function sanitizeRing(rawRing: unknown): ClipRing | null {
  if (!Array.isArray(rawRing) || rawRing.length < 3) return null;

  const cleaned: [number, number][] = [];
  for (const pos of rawRing as Position[]) {
    if (!isFinitePosition(pos)) return null;
    const prev = cleaned[cleaned.length - 1];
    if (!prev || prev[0] !== pos[0] || prev[1] !== pos[1]) {
      cleaned.push([pos[0], pos[1]]);
    }
  }

  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  const distinctCount =
    cleaned.length > 1 && first[0] === last[0] && first[1] === last[1]
      ? cleaned.length - 1
      : cleaned.length;

  if (distinctCount < 3) return null;

  if (first[0] !== last[0] || first[1] !== last[1]) {
    cleaned.push([first[0], first[1]]);
  }

  if (cleaned.length < 4) return null;
  if (computeGeodesicRingAreaM2(cleaned) <= 0) return null;

  return cleaned;
}

function sanitizePolygonCoordinates(rawCoords: unknown): ClipPolygon | null {
  if (!Array.isArray(rawCoords) || rawCoords.length === 0) return null;

  const outer = sanitizeRing(rawCoords[0]);
  if (!outer) return null;

  const rings: ClipPolygon = [outer];
  for (let i = 1; i < rawCoords.length; i += 1) {
    const hole = sanitizeRing(rawCoords[i]);
    if (!hole) return null;
    rings.push(hole);
  }
  return rings;
}

function extractClipPolygons(input: FloodAreaInput | null | undefined): {
  polygons: ClipPolygon[];
  invalidReason: string | null;
} {
  if (!input || typeof input !== "object") {
    return {
      polygons: [],
      invalidReason: "Geometria GeoJSON ausente ou inválida.",
    };
  }

  const polygons: ClipPolygon[] = [];
  let invalidReason: string | null = null;

  const fail = (reason: string) => {
    if (!invalidReason) invalidReason = reason;
  };

  const collectGeometry = (
    geometry: Polygon | MultiPolygon | null | undefined,
  ) => {
    if (!geometry || typeof geometry !== "object") {
      fail("Geometria ausente ou malformada.");
      return;
    }

    if (geometry.type === "Polygon") {
      const poly = sanitizePolygonCoordinates(geometry.coordinates);
      if (poly) {
        polygons.push(poly);
      } else {
        fail("Polígono ou anel interno inválido/degenerado.");
      }
      return;
    }

    if (geometry.type === "MultiPolygon") {
      if (
        !Array.isArray(geometry.coordinates) ||
        geometry.coordinates.length === 0
      ) {
        fail("MultiPolygon vazio ou malformado.");
        return;
      }
      for (const rawPoly of geometry.coordinates) {
        const poly = sanitizePolygonCoordinates(rawPoly);
        if (poly) {
          polygons.push(poly);
        } else {
          fail("Parte ou anel interno inválido em MultiPolygon.");
          return;
        }
      }
      return;
    }

    fail("Tipo de geometria não suportado (esperado Polygon ou MultiPolygon).");
  };

  if (input.type === "FeatureCollection") {
    if (!Array.isArray(input.features)) {
      return {
        polygons: [],
        invalidReason: "FeatureCollection sem lista válida de feições.",
      };
    }
    for (const feature of input.features) {
      if (!feature || feature.type !== "Feature") {
        fail("Feição inválida na FeatureCollection.");
        break;
      }
      collectGeometry(feature.geometry);
      if (invalidReason) break;
    }
  } else if (input.type === "Feature") {
    collectGeometry(input.geometry);
  } else {
    collectGeometry(input);
  }

  return { polygons, invalidReason };
}

function dissolveAndMeasure(polygons: readonly ClipPolygon[]): {
  dissolved: ClipMultiPolygon | null;
  areaM2: number | null;
  partCount: number;
  holeCount: number;
  error: string | null;
} {
  if (polygons.length === 0) {
    return {
      dissolved: null,
      areaM2: 0,
      partCount: 0,
      holeCount: 0,
      error: null,
    };
  }

  let dissolved: ClipMultiPolygon;
  try {
    dissolved =
      polygons.length === 1
        ? polygonClipping.union(polygons[0])
        : polygonClipping.union(polygons[0], ...polygons.slice(1));
  } catch {
    return {
      dissolved: null,
      areaM2: null,
      partCount: 0,
      holeCount: 0,
      error: "Falha topológica ao unificar anéis poligonais.",
    };
  }

  let totalAreaM2 = 0;
  let holeCount = 0;

  for (const poly of dissolved) {
    if (!poly || poly.length === 0) continue;
    let polyAreaM2 = computeGeodesicRingAreaM2(poly[0]);
    for (let i = 1; i < poly.length; i += 1) {
      polyAreaM2 -= computeGeodesicRingAreaM2(poly[i]);
      holeCount += 1;
    }
    if (!Number.isFinite(polyAreaM2) || polyAreaM2 < 0) {
      return {
        dissolved: null,
        areaM2: null,
        partCount: dissolved.length,
        holeCount,
        error: "Área líquida inválida após subtração de anéis internos.",
      };
    }
    totalAreaM2 += polyAreaM2;
  }

  return {
    dissolved,
    areaM2: totalAreaM2,
    partCount: dissolved.length,
    holeCount,
    error: null,
  };
}

function measureClipMultiPolygonAreaM2(multi: ClipMultiPolygon): {
  areaM2: number | null;
  error: string | null;
} {
  let totalAreaM2 = 0;
  for (const poly of multi) {
    if (!poly || poly.length === 0) continue;
    let polyAreaM2 = computeGeodesicRingAreaM2(poly[0]);
    for (let i = 1; i < poly.length; i += 1) {
      polyAreaM2 -= computeGeodesicRingAreaM2(poly[i]);
    }
    if (!Number.isFinite(polyAreaM2) || polyAreaM2 < 0) {
      return {
        areaM2: null,
        error: "Área líquida inválida na geometria de interseção.",
      };
    }
    totalAreaM2 += polyAreaM2;
  }
  return { areaM2: totalAreaM2, error: null };
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

function buildGrayEvaluation(
  record: NeighborhoodBoundaryRecord,
  selectedStageCm: number,
  scheme: NeighborhoodThresholdScheme,
  qualityStatus: NeighborhoodGeometryQualityStatus,
  reason: string,
  partCount = 0,
  holeCount = 0,
  scenarioPartCount = 0,
): NeighborhoodScenarioEvaluation {
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
    selectedStageCm,
    territorialAreaM2: null,
    territorialAreaHa: null,
    interceptedAreaM2: null,
    interceptedAreaHa: null,
    interceptedPercent: null,
    coverageAndQuality: {
      status: qualityStatus,
      isUsableForIntersection: false,
      neighborhoodPolygonPartCount: partCount,
      neighborhoodHoleCount: holeCount,
      scenarioPolygonPartCount: scenarioPartCount,
      reason,
    },
    visualClass: "gray",
    visualLabelPtBr: NEIGHBORHOOD_VISUAL_CLASS_META.gray.labelPtBr,
    thresholdSchemeId: scheme.id,
    thresholdCalibrationStatus: scheme.calibrationStatus,
    disclaimers: NEIGHBORHOOD_SAFETY_DISCLAIMERS,
  };
}

/**
 * Evaluates the spatial intersection between a single municipal neighborhood record
 * and an official/derived flood scenario polygon layer (fail-closed).
 */
export function evaluateNeighborhoodScenarioOverlap(
  record: NeighborhoodBoundaryRecord,
  scenarioInput: FloodAreaInput | null | undefined,
  selectedStageCm: number,
  scheme: NeighborhoodThresholdScheme = PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0,
): NeighborhoodScenarioEvaluation {
  if (!isValidThresholdScheme(scheme)) {
    throw new RangeError(
      "Esquema de limiares territoriais inválido: exige cutpoints globais ordenados 0 < lowMaxPercent < highMaxPercent < 100.",
    );
  }

  if (record.geometry === null || record.geometryStatus !== "valid") {
    const status: NeighborhoodGeometryQualityStatus =
      record.geometryStatus === "valid" ? "unavailable" : record.geometryStatus;
    return buildGrayEvaluation(
      record,
      selectedStageCm,
      scheme,
      status,
      record.geometry === null
        ? "Polígono oficial do bairro indisponível (BLOCKED_DATA_SOURCE)."
        : `Geometria do bairro marcada como '${record.geometryStatus}' e não habilitada para interseção.`,
    );
  }

  const nbExtract = extractClipPolygons(record.geometry);
  if (nbExtract.invalidReason || nbExtract.polygons.length === 0) {
    return buildGrayEvaluation(
      record,
      selectedStageCm,
      scheme,
      "invalid_geometry",
      nbExtract.invalidReason ?? "Geometria vazia para o bairro.",
    );
  }

  const nbDissolved = dissolveAndMeasure(nbExtract.polygons);
  if (
    nbDissolved.error ||
    !nbDissolved.dissolved ||
    nbDissolved.areaM2 === null ||
    nbDissolved.areaM2 <= 0 ||
    nbDissolved.areaM2 > MAX_PLAUSIBLE_NEIGHBORHOOD_AREA_M2
  ) {
    return buildGrayEvaluation(
      record,
      selectedStageCm,
      scheme,
      "invalid_geometry",
      nbDissolved.error ??
        "Área territorial do bairro fora dos limites físicos plausíveis.",
      nbDissolved.partCount,
      nbDissolved.holeCount,
    );
  }

  const scExtract = extractClipPolygons(scenarioInput);
  if (scExtract.invalidReason || scExtract.polygons.length === 0) {
    return buildGrayEvaluation(
      record,
      selectedStageCm,
      scheme,
      "unavailable",
      scExtract.invalidReason ??
        "Cenário de inundação vazio ou indisponível para interseção.",
      nbDissolved.partCount,
      nbDissolved.holeCount,
    );
  }

  const scDissolved = dissolveAndMeasure(scExtract.polygons);
  if (
    scDissolved.error ||
    !scDissolved.dissolved ||
    scDissolved.areaM2 === null ||
    scDissolved.areaM2 <= 0
  ) {
    return buildGrayEvaluation(
      record,
      selectedStageCm,
      scheme,
      "unavailable",
      scDissolved.error ??
        "Falha ao validar a geometria da mancha do cenário selecionado.",
      nbDissolved.partCount,
      nbDissolved.holeCount,
      scDissolved.partCount,
    );
  }

  let clipped: ClipMultiPolygon;
  try {
    clipped = polygonClipping.intersection(
      nbDissolved.dissolved,
      scDissolved.dissolved,
    );
  } catch {
    return buildGrayEvaluation(
      record,
      selectedStageCm,
      scheme,
      "invalid_geometry",
      "Falha topológica ao calcular interseção bairro × mancha.",
      nbDissolved.partCount,
      nbDissolved.holeCount,
      scDissolved.partCount,
    );
  }

  const interArea = measureClipMultiPolygonAreaM2(clipped);
  if (interArea.error || interArea.areaM2 === null || interArea.areaM2 < 0) {
    return buildGrayEvaluation(
      record,
      selectedStageCm,
      scheme,
      "invalid_geometry",
      interArea.error ?? "Área de interseção inválida.",
      nbDissolved.partCount,
      nbDissolved.holeCount,
      scDissolved.partCount,
    );
  }

  const territorialAreaM2 = nbDissolved.areaM2;
  const maxConservationDriftM2 = territorialAreaM2 * 1e-6 + 0.01;
  if (interArea.areaM2 > territorialAreaM2 + maxConservationDriftM2) {
    return buildGrayEvaluation(
      record,
      selectedStageCm,
      scheme,
      "invalid_geometry",
      "Violação de conservação de área (interseção excedeu a área territorial do bairro).",
      nbDissolved.partCount,
      nbDissolved.holeCount,
      scDissolved.partCount,
    );
  }

  const clampedRawInterM2 = Math.min(interArea.areaM2, territorialAreaM2);
  const classified = classifyNeighborhoodOverlap(
    clampedRawInterM2,
    territorialAreaM2,
    scheme,
  );

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
    selectedStageCm,
    territorialAreaM2,
    territorialAreaHa: territorialAreaM2 / 10_000,
    interceptedAreaM2: classified.effectiveInterceptedAreaM2,
    interceptedAreaHa: classified.effectiveInterceptedAreaM2 / 10_000,
    interceptedPercent: classified.effectiveInterceptedPercent,
    coverageAndQuality: {
      status: "valid",
      isUsableForIntersection: true,
      neighborhoodPolygonPartCount: nbDissolved.partCount,
      neighborhoodHoleCount: nbDissolved.holeCount,
      scenarioPolygonPartCount: scDissolved.partCount,
      reason: null,
    },
    visualClass: classified.visualClass,
    visualLabelPtBr:
      NEIGHBORHOOD_VISUAL_CLASS_META[classified.visualClass].labelPtBr,
    thresholdSchemeId: scheme.id,
    thresholdCalibrationStatus: scheme.calibrationStatus,
    disclaimers: NEIGHBORHOOD_SAFETY_DISCLAIMERS,
  };
}

/**
 * Evaluates an entire neighborhood registry against a selected flood stage scenario,
 * enforcing explicit partial/zero coverage disclosure (never reporting `X/27` when `usable < 27`
 * without declaring partial coverage).
 */
export function evaluateNeighborhoodPanel(
  records: readonly NeighborhoodBoundaryRecord[],
  scenarioInput: FloodAreaInput | null | undefined,
  selectedStageCm: number,
  scheme: NeighborhoodThresholdScheme = PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0,
): NeighborhoodPanelEvaluationSummary {
  if (!isValidThresholdScheme(scheme)) {
    throw new RangeError(
      "Esquema de limiares territoriais inválido: exige cutpoints globais ordenados 0 < lowMaxPercent < highMaxPercent < 100.",
    );
  }

  const items = records.map((record) =>
    evaluateNeighborhoodScenarioOverlap(
      record,
      scenarioInput,
      selectedStageCm,
      scheme,
    ),
  );

  const usableItems = items.filter(
    (item) => item.coverageAndQuality.isUsableForIntersection,
  );
  const usableCount = usableItems.length;
  const unavailableOrInvalidCount = items.length - usableCount;
  const acquisitionStatus = deriveAcquisitionStatus(records);
  const isPartialCoverage = usableCount < OFFICIAL_NEIGHBORHOOD_COUNT;

  let coverageDisclosurePtBr: string;
  if (usableCount === 0) {
    coverageDisclosurePtBr = `Cobertura geométrica 0/${OFFICIAL_NEIGHBORHOOD_COUNT} bairros (BLOCKED_DATA_SOURCE): todos os ${items.length} bairros permanecem classificados como Cinza (dados indisponíveis) até a obtenção dos limites oficiais junto à Prefeitura.`;
  } else if (usableCount < OFFICIAL_NEIGHBORHOOD_COUNT) {
    coverageDisclosurePtBr = `Cobertura parcial declarada: ${usableCount} de ${OFFICIAL_NEIGHBORHOOD_COUNT} bairros oficiais possuem geometria validada nesta avaliação; ${unavailableOrInvalidCount} permanecem em Cinza (dados indisponíveis ou insuficientes).`;
  } else {
    coverageDisclosurePtBr = `Cobertura completa: ${usableCount} de ${OFFICIAL_NEIGHBORHOOD_COUNT} bairros oficiais avaliados com geometria validada.`;
  }

  const interceptedNeighborhoodCount =
    usableCount === 0
      ? null
      : usableItems.filter(
          (item) =>
            item.interceptedAreaM2 !== null && item.interceptedAreaM2 > 0,
        ).length;

  const zeroIntersectionValidCount = usableItems.filter(
    (item) => item.visualClass === "green",
  ).length;

  return {
    classification: "derived",
    acquisitionStatus,
    selectedStageCm,
    totalIdentifiedNeighborhoods: OFFICIAL_NEIGHBORHOOD_COUNT,
    usableNeighborhoodCount: usableCount,
    unavailableOrInvalidCount,
    isPartialCoverage,
    coverageDisclosurePtBr,
    interceptedNeighborhoodCount,
    zeroIntersectionValidCount,
    thresholdScheme: scheme,
    items,
    disclaimers: NEIGHBORHOOD_SAFETY_DISCLAIMERS,
  };
}
