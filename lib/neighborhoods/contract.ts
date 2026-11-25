import type { MultiPolygon, Polygon } from "geojson";
import type { FloodAreaInput } from "../sgb/area.ts";

/**
 * Canonical identifiers for the 27 official neighborhoods of Santo Antônio de Pádua (1st District)
 * established by Lei Municipal nº 3.864/2017 (Anexos VI and XIII) and confirmed in Lei nº 4.135/2021.
 */
export type OfficialNeighborhoodId =
  | "aeroporto"
  | "alipio"
  | "arraialzinho"
  | "cafe-garoto"
  | "cehab"
  | "cidade-nova"
  | "dezessete"
  | "farol"
  | "gabri"
  | "gloria"
  | "monte-libano"
  | "parque-das-aguas"
  | "santa-afra"
  | "sao-felix"
  | "sao-luis"
  | "sardemberg"
  | "alequicis"
  | "barro-branco"
  | "carvalho"
  | "centro"
  | "divineia"
  | "ferreira"
  | "industrial"
  | "jorimpa"
  | "mirante"
  | "pereira"
  | "tavares";

export type RiverBank = "right" | "left";

export type NeighborhoodAcquisitionStatus =
  | "BLOCKED_DATA_SOURCE"
  | "PARTIAL_OFFICIAL_COVERAGE"
  | "COMPLETE_OFFICIAL_COVERAGE";

export type BoundaryQualityStatus =
  | "valid"
  | "unavailable"
  | "invalid_geometry"
  | "partial_unverified";

export type ScenarioGeometryStatus =
  | "valid"
  | "empty"
  | "unavailable"
  | "invalid";

export type ModelSpatialCoverageStatus =
  | "covered"
  | "partial_model_coverage"
  | "outside_model_extent"
  | "unknown";

export type IntersectionCalculationStatus =
  | "computed"
  | "skipped_boundary_unavailable"
  | "skipped_boundary_invalid"
  | "skipped_scenario_unavailable"
  | "skipped_scenario_invalid"
  | "skipped_outside_model_coverage"
  | "failed_intersection_topology";

/**
 * Official SGB 2024 MapServer extent in EPSG:4674 / WGS84 from data/metadata/sources.json:
 * [minLon, minLat, maxLon, maxLat].
 */
export const SGB_2024_MODEL_BBOX = [
  -42.20900097927306,
  -21.553311556725685,
  -42.14556243623249,
  -21.51245633890636,
] as const;

export type BoundingBox2D = readonly [number, number, number, number];

export type FloodModelCoverageDomain =
  | {
      readonly kind: "bbox";
      readonly bbox: BoundingBox2D;
      readonly label: string;
    }
  | {
      readonly kind: "polygon";
      readonly geometry: FloodAreaInput;
      readonly label: string;
    }
  | {
      readonly kind: "unknown";
      readonly reason: string;
    };

export const DEFAULT_SGB_MODEL_COVERAGE_DOMAIN: FloodModelCoverageDomain = {
  kind: "bbox",
  bbox: SGB_2024_MODEL_BBOX,
  label:
    "Extensão espacial publicada do MapServer SGB (2024) — EPSG:4674 / WGS84",
};

/**
 * Visual classification defined by R02-F Section 6:
 * - green (Verde): sem interseção identificada no cenário, com dados válidos e dentro da cobertura do modelo.
 * - yellow (Amarelo): sobreposição territorial baixa.
 * - orange (Laranja): sobreposição territorial elevada.
 * - red (Vermelho): sobreposição territorial muito elevada.
 * - gray (Cinza): dados indisponíveis ou insuficientes (limite ausente, falha na mancha ou fora da cobertura do modelo).
 */
export type NeighborhoodVisualClass =
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "gray";

export interface NeighborhoodVisualClassMetadata {
  readonly code: NeighborhoodVisualClass;
  readonly labelPtBr: "Verde" | "Amarelo" | "Laranja" | "Vermelho" | "Cinza";
  readonly semanticSummaryPtBr: string;
}

export const NEIGHBORHOOD_VISUAL_CLASS_META: Readonly<
  Record<NeighborhoodVisualClass, NeighborhoodVisualClassMetadata>
> = {
  green: {
    code: "green",
    labelPtBr: "Verde",
    semanticSummaryPtBr:
      "Sem interseção identificada no cenário selecionado, com limites válidos e dentro da cobertura espacial do modelo (não significa garantia de segurança).",
  },
  yellow: {
    code: "yellow",
    labelPtBr: "Amarelo",
    semanticSummaryPtBr:
      "Sobreposição territorial baixa com a mancha do cenário selecionado.",
  },
  orange: {
    code: "orange",
    labelPtBr: "Laranja",
    semanticSummaryPtBr:
      "Sobreposição territorial elevada com a mancha do cenário selecionado.",
  },
  red: {
    code: "red",
    labelPtBr: "Vermelho",
    semanticSummaryPtBr:
      "Sobreposição territorial muito elevada com a mancha do cenário selecionado (não significa alerta oficial).",
  },
  gray: {
    code: "gray",
    labelPtBr: "Cinza",
    semanticSummaryPtBr:
      "Dados geográficos indisponíveis, falha na consulta da mancha, ou bairro fora/parcialmente fora da cobertura conhecida do modelo.",
  },
};

export const NEIGHBORHOOD_SAFETY_DISCLAIMERS = {
  greenNotSafetyGuarantee:
    "Verde indica ausência de interseção geométrica identificada no cenário selecionado com dados válidos dentro da cobertura do modelo; não significa garantia de segurança de imóveis, vias ou pessoas.",
  redNotOfficialWarning:
    "Vermelho indica sobreposição territorial muito elevada com a mancha do cenário selecionado; não constitui alerta oficial de cheia nem ordem de evacuação.",
  planarExtentLimitation:
    "O indicador expressa exclusivamente sobreposição territorial bidimensional (extensão); criticidade física real depende de profundidade, velocidade de escoamento, exposição, vulnerabilidade e validação local.",
  officialAuthorityNotice:
    "Consulte sempre a Defesa Civil Municipal, o INEA e o SGB para alertas e decisões operacionais de emergência.",
} as const;

export interface NeighborhoodLegalNomenclature {
  readonly lei3864AnexoVi: string;
  readonly lei3864AnexoXiii: string;
  readonly lei4135TabelaI: string;
  readonly orthographicNotes: string | null;
}

export interface OsmAuxiliaryNeighborhoodPoint {
  readonly classification: "auxiliary_reference_point_only";
  readonly osmNodeId: number;
  readonly osmName: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly crs: "EPSG:4326";
  readonly license: "ODbL-1.0";
  readonly usableForPolygonIntersection: false;
}

/**
 * Canonical input record for a municipal neighborhood (R02-F Section 6).
 */
export interface NeighborhoodBoundaryRecord {
  readonly id: OfficialNeighborhoodId;
  readonly officialNumber: number;
  readonly officialName: string;
  readonly riverBank: RiverBank;
  readonly maintainerPriority: boolean;
  readonly legalNomenclature: NeighborhoodLegalNomenclature;
  readonly geometry: Polygon | MultiPolygon | null;
  readonly geometryStatus: BoundaryQualityStatus;
  readonly source: string;
  readonly version: string;
  readonly osmAuxiliaryPoint: OsmAuxiliaryNeighborhoodPoint | null;
}

/**
 * Explicitly separates the three orthogonal validity dimensions:
 * 1. Municipal boundary availability/validity (`boundaryStatus`)
 * 2. Flood model spatial coverage (`modelCoverageStatus`)
 * 3. Flood scenario geometry availability + intersection calculation (`scenarioStatus` + `calculationStatus`)
 */
export interface NeighborhoodCoverageQuality {
  readonly boundaryStatus: BoundaryQualityStatus;
  readonly modelCoverageStatus: ModelSpatialCoverageStatus;
  readonly scenarioStatus: ScenarioGeometryStatus;
  readonly calculationStatus: IntersectionCalculationStatus;
  readonly isBoundaryValid: boolean;
  readonly isCoveredByModel: boolean;
  readonly isIntersectionComputed: boolean;
  readonly neighborhoodPolygonPartCount: number;
  readonly neighborhoodHoleCount: number;
  readonly scenarioPolygonPartCount: number;
  readonly reason: string | null;
}

/**
 * Global, uniform percentage-threshold methodology contract (R02-F Section 6).
 *
 * Cutpoints (5%, 20%) and numerical tolerance (0.01 m²) remain provisional
 * uncalibrated research candidates until calibrated over official municipal polygons.
 */
export interface NeighborhoodThresholdScheme {
  readonly id: string;
  readonly version: string;
  readonly calibrationStatus:
    | "provisional_uncalibrated"
    | "empirically_calibrated";
  readonly appliesUniformlyToAllNeighborhoods: true;
  readonly lowMaxPercent: number;
  readonly highMaxPercent: number;
  readonly zeroIntersectionToleranceM2: number;
  readonly rationale: string;
}

export const PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0: NeighborhoodThresholdScheme =
  {
    id: "global-geometric-4x-provisional",
    version: "0.1.0-research",
    calibrationStatus: "provisional_uncalibrated",
    appliesUniformlyToAllNeighborhoods: true,
    lowMaxPercent: 5,
    highMaxPercent: 20,
    zeroIntersectionToleranceM2: 0.01,
    rationale:
      "Candidatos provisórios ainda não calibrados (escala geométrica global de razão 4x): separa estritamente interseção nula (<= tolerância numérica provisória de 0,01 m² -> Verde) de qualquer atingimento positivo inicial ((0%, 5%] -> Amarelo), atingimento intermediário ((5%, 20%] -> Laranja) e atingimento territorial amplo (> 20% -> Vermelho), sem limiares ad hoc por bairro. Sujeito a análise de sensibilidade e calibração empírica após obtenção dos polígonos oficiais.",
  } as const;

export function isValidThresholdScheme(
  scheme: NeighborhoodThresholdScheme,
): boolean {
  return (
    Boolean(scheme) &&
    typeof scheme.id === "string" &&
    scheme.id.trim().length > 0 &&
    scheme.appliesUniformlyToAllNeighborhoods === true &&
    Number.isFinite(scheme.lowMaxPercent) &&
    Number.isFinite(scheme.highMaxPercent) &&
    Number.isFinite(scheme.zeroIntersectionToleranceM2) &&
    scheme.zeroIntersectionToleranceM2 >= 0 &&
    scheme.zeroIntersectionToleranceM2 <= 1 &&
    scheme.lowMaxPercent > 0 &&
    scheme.lowMaxPercent < scheme.highMaxPercent &&
    scheme.highMaxPercent < 100
  );
}

/**
 * Output technical contract for future neighborhood territorial overlap panel (#20 / R02-F Section 6).
 */
export interface NeighborhoodScenarioEvaluation {
  readonly classification: "derived";
  readonly neighborhoodId: OfficialNeighborhoodId;
  readonly officialNumber: number;
  readonly officialName: string;
  readonly riverBank: RiverBank;
  readonly maintainerPriority: boolean;
  readonly source: string;
  readonly version: string;
  readonly crs: "EPSG:4326";
  readonly areaMethod: "wgs84-ellipsoidal-authalic-intersection-v1";
  readonly selectedStageCm: number;
  readonly territorialAreaM2: number | null;
  readonly territorialAreaHa: number | null;
  readonly interceptedAreaM2: number | null;
  readonly interceptedAreaHa: number | null;
  readonly interceptedPercent: number | null;
  readonly coverageAndQuality: NeighborhoodCoverageQuality;
  readonly visualClass: NeighborhoodVisualClass;
  readonly visualLabelPtBr: NeighborhoodVisualClassMetadata["labelPtBr"];
  readonly thresholdSchemeId: string;
  readonly thresholdCalibrationStatus: NeighborhoodThresholdScheme["calibrationStatus"];
  readonly disclaimers: typeof NEIGHBORHOOD_SAFETY_DISCLAIMERS;
}

export interface NeighborhoodPanelEvaluationSummary {
  readonly classification: "derived";
  readonly acquisitionStatus: NeighborhoodAcquisitionStatus;
  readonly scenarioStatus: ScenarioGeometryStatus;
  readonly scenarioReason: string | null;
  readonly selectedStageCm: number;
  readonly totalIdentifiedNeighborhoods: number;
  readonly boundaryAvailableCount: number;
  readonly boundaryUnavailableOrInvalidCount: number;
  readonly evaluatedNeighborhoodCount: number;
  readonly outsideOrUnknownModelCoverageCount: number;
  readonly isPartialBoundaryCoverage: boolean;
  readonly coverageDisclosurePtBr: string;
  readonly interceptedNeighborhoodCount: number | null;
  readonly zeroIntersectionValidCount: number;
  readonly thresholdScheme: NeighborhoodThresholdScheme;
  readonly items: readonly NeighborhoodScenarioEvaluation[];
  readonly disclaimers: typeof NEIGHBORHOOD_SAFETY_DISCLAIMERS;
}
