import type { MultiPolygon, Polygon } from "geojson";

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

export type NeighborhoodGeometryQualityStatus =
  | "valid"
  | "unavailable"
  | "invalid_geometry"
  | "partial_unverified";

/**
 * Visual classification defined by R02-F Section 6:
 * - green (Verde): sem interseção identificada no cenário, com dados válidos.
 * - yellow (Amarelo): sobreposição territorial baixa.
 * - orange (Laranja): sobreposição territorial elevada.
 * - red (Vermelho): sobreposição territorial muito elevada.
 * - gray (Cinza): dados indisponíveis ou insuficientes.
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
      "Sem interseção identificada no cenário selecionado, com dados geométricos válidos (não significa garantia de segurança).",
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
      "Dados geográficos indisponíveis ou insuficientes para cálculo confiável de interseção.",
  },
};

export const NEIGHBORHOOD_SAFETY_DISCLAIMERS = {
  greenNotSafetyGuarantee:
    "Verde indica ausência de interseção geométrica identificada no cenário selecionado com dados válidos; não significa garantia de segurança de imóveis, vias ou pessoas.",
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
  readonly geometryStatus: NeighborhoodGeometryQualityStatus;
  readonly source: string;
  readonly version: string;
  readonly osmAuxiliaryPoint: OsmAuxiliaryNeighborhoodPoint | null;
}

export interface NeighborhoodCoverageQuality {
  readonly status: NeighborhoodGeometryQualityStatus;
  readonly isUsableForIntersection: boolean;
  readonly neighborhoodPolygonPartCount: number;
  readonly neighborhoodHoleCount: number;
  readonly scenarioPolygonPartCount: number;
  readonly reason: string | null;
}

/**
 * Global, uniform percentage-threshold methodology contract (R02-F Section 6).
 *
 * Rules:
 * - Must apply uniformly to all neighborhoods (`appliesUniformlyToAllNeighborhoods: true`).
 *   Per-neighborhood custom thresholds are prohibited without physical/statistical justification.
 * - `green` is strictly reserved for zero effective intersection (`<= zeroIntersectionToleranceM2`)
 *   with valid neighborhood and scenario geometries.
 * - Positive overlap (`> zeroIntersectionToleranceM2`) is partitioned by global cutpoints
 *   `0 < lowMaxPercent < highMaxPercent < 100`:
 *   - `yellow`: `(0%, lowMaxPercent]`
 *   - `orange`: `(lowMaxPercent, highMaxPercent]`
 *   - `red`: `> highMaxPercent`
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

/**
 * Provisional research candidate scheme (geometric ratio 4x: 0% | (0%, 5%] | (5%, 20%] | > 20%).
 * Marked `provisional_uncalibrated` until empirical sensitivity analysis over the official
 * municipal polygons across the 11 SGB stages (300–550 cm) is executed.
 */
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
      "Escala geométrica global de razão 4x para variáveis proporcionais assimétricas em planícies fluviais urbanas: separa estritamente interseção nula (0% -> Verde) de qualquer atingimento positivo inicial ((0%, 5%] -> Amarelo), atingimento intermediário ((5%, 20%] -> Laranja) e atingimento territorial amplo (> 20% -> Vermelho), sem limiares ad hoc por bairro. Sujeita a calibração empírica após obtenção dos polígonos oficiais.",
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
  readonly selectedStageCm: number;
  readonly totalIdentifiedNeighborhoods: number;
  readonly usableNeighborhoodCount: number;
  readonly unavailableOrInvalidCount: number;
  readonly isPartialCoverage: boolean;
  readonly coverageDisclosurePtBr: string;
  readonly interceptedNeighborhoodCount: number | null;
  readonly zeroIntersectionValidCount: number;
  readonly thresholdScheme: NeighborhoodThresholdScheme;
  readonly items: readonly NeighborhoodScenarioEvaluation[];
  readonly disclaimers: typeof NEIGHBORHOOD_SAFETY_DISCLAIMERS;
}
