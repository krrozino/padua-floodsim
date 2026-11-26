import {
  SGB_AREA_SOURCE,
  extractValidatedPolygons,
  isFiniteWgs84Position,
  type ClipPolygon,
  type ClipRing,
  type FloodAreaInput,
} from "./area.ts";
import { SGB_REFERENCE_STATION_LABEL } from "./areaCatalog.ts";
import {
  SGB_FLOOD_LEVELS_CM,
  SGB_STAGE_ELEVATIONS,
  type SgbFloodLevelCm,
} from "./stages.ts";

export const SGB_LOCATION_QUERY_METHOD_ID =
  "wgs84-point-in-polygon-boundary-v1" as const;

/**
 * Default metric distance tolerance (in meters) used to classify points lying
 * in a geometric proximity band around an SGB vector polygon boundary (outer
 * ring or internal hole ring).
 *
 * Scientific caveat: ±0.5 m is purely a geometric proximity band to absorb
 * floating-point edge precision and map-click proximity; it does NOT represent
 * physical flood accuracy or the exact real-world water edge.
 */
export const DEFAULT_BOUNDARY_TOLERANCE_METERS = 0.5;

export const BOUNDARY_PROXIMITY_SEMANTIC_NOTE =
  "A tolerância de ±0,5 m representa apenas uma faixa de proximidade geométrica sobre o contorno vetorial SGB; não representa precisão física nem limite exato da inundação." as const;

/**
 * Envelope retangular auxiliar publicado pelo MapServer SGB (2024) em
 * EPSG:4674 / WGS84 (`data/metadata/sources.json`).
 *
 * ATENÇÃO (harmonizado com R02-F / PR #55): trata-se exclusivamente de um
 * envelope auxiliar do serviço GIS e NÃO comprova cobertura hidráulica
 * integral no seu interior.
 */
export const SGB_MAPSERVER_ENVELOPE_BBOX = {
  minLon: -42.20900097927306,
  minLat: -21.553311556725685,
  maxLon: -42.14556243623249,
  maxLat: -21.51245633890636,
} as const;

/** Backward-compatible alias for `SGB_MAPSERVER_ENVELOPE_BBOX`. */
export const SGB_MODEL_COVERAGE_BBOX = SGB_MAPSERVER_ENVELOPE_BBOX;

// WGS84 ellipsoid constants for local metric tangent-plane projection
const WGS84_A = 6_378_137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);
const DEG_TO_RAD = Math.PI / 180;

export type GeoPoint = {
  readonly lat: number;
  readonly lon: number;
};

/** Position strictly relative to the auxiliary MapServer rectangular envelope. */
export type MapServerEnvelopeStatus =
  | "within_mapserver_envelope"
  | "outside_mapserver_envelope";

/**
 * Hydraulic model spatial domain coverage harmonized with R02-F (PR #55):
 * - `"covered"`: point verified inside an explicitly supplied validated hydraulic domain polygon.
 * - `"outside_model_extent"`: point lies outside the auxiliary MapServer envelope or validated domain polygon.
 * - `"unknown"`: point is inside the auxiliary MapServer bbox (or no domain polygon was supplied),
 *   so complete hydraulic coverage is NOT proven.
 */
export type HydraulicDomainStatus =
  | "covered"
  | "outside_model_extent"
  | "unknown";

export type PointModelCoverageDomain =
  | {
      readonly kind: "polygon";
      readonly geometry: FloodAreaInput;
      readonly label: string;
    }
  | {
      readonly kind: "bbox";
      readonly bbox: {
        readonly minLon: number;
        readonly minLat: number;
        readonly maxLon: number;
        readonly maxLat: number;
      };
      readonly label: string;
    }
  | {
      readonly kind: "unknown";
      readonly reason: string;
    };

export const DEFAULT_AUXILIARY_MAPSERVER_DOMAIN: PointModelCoverageDomain = {
  kind: "bbox",
  bbox: SGB_MAPSERVER_ENVELOPE_BBOX,
  label:
    "Envelope retangular auxiliar do MapServer SGB (2024) — não comprova cobertura hidráulica integral no seu interior.",
};

export type SpatialPointRelation =
  | "inside"
  | "boundary"
  | "outside"
  | "unavailable";

export type EvaluatedPointRelation = Exclude<SpatialPointRelation, "unavailable">;

export type PointCoverageAssessment = {
  readonly envelopeStatus: MapServerEnvelopeStatus;
  readonly hydraulicDomainStatus: HydraulicDomainStatus;
};

export type PointScenarioQueryResult =
  | {
      readonly status: "valid";
      readonly classification: "derived";
      readonly method: typeof SGB_LOCATION_QUERY_METHOD_ID;
      readonly crs: "EPSG:4326";
      readonly source: typeof SGB_AREA_SOURCE;
      readonly stationReference: typeof SGB_REFERENCE_STATION_LABEL;
      readonly levelCm: number;
      readonly point: GeoPoint;
      readonly envelopeStatus: MapServerEnvelopeStatus;
      readonly hydraulicDomainStatus: HydraulicDomainStatus;
      readonly relation: EvaluatedPointRelation;
      readonly isIntercepted: boolean;
      readonly boundaryToleranceMeters: number;
      readonly boundarySemanticsNote: string;
      readonly safetyDisclaimer: string;
    }
  | {
      readonly status: "unavailable";
      readonly classification: "derived";
      readonly method: typeof SGB_LOCATION_QUERY_METHOD_ID;
      readonly crs: "EPSG:4326";
      readonly source: typeof SGB_AREA_SOURCE;
      readonly stationReference: typeof SGB_REFERENCE_STATION_LABEL;
      readonly levelCm: number;
      readonly point: GeoPoint | null;
      readonly envelopeStatus: MapServerEnvelopeStatus | null;
      readonly hydraulicDomainStatus: HydraulicDomainStatus | null;
      readonly relation: "unavailable";
      readonly isIntercepted: null;
      readonly boundaryToleranceMeters: number;
      readonly boundarySemanticsNote: string;
      readonly reason: string;
      readonly safetyDisclaimer: string;
    };

export type ComparisonCombinedRelation =
  | "both"
  | "only_a"
  | "only_b"
  | "neither"
  | "unavailable";

export type PointComparisonQueryResult = {
  readonly status: "valid" | "unavailable";
  readonly classification: "derived";
  readonly method: typeof SGB_LOCATION_QUERY_METHOD_ID;
  readonly crs: "EPSG:4326";
  readonly source: typeof SGB_AREA_SOURCE;
  readonly stationReference: typeof SGB_REFERENCE_STATION_LABEL;
  readonly levelACm: number;
  readonly levelBCm: number;
  readonly point: GeoPoint | null;
  readonly envelopeStatus: MapServerEnvelopeStatus | null;
  readonly hydraulicDomainStatus: HydraulicDomainStatus | null;
  readonly relationA: SpatialPointRelation;
  readonly relationB: SpatialPointRelation;
  readonly combinedRelation: ComparisonCombinedRelation;
  readonly involvesBoundaryProximity: boolean;
  readonly boundaryToleranceMeters: number;
  readonly boundarySemanticsNote: string;
  readonly reason: string | null;
  readonly safetyDisclaimer: string;
};

export type CrossStageEntryStatus = "evaluated" | "error" | "pending";

export type CrossStageEntry = {
  readonly levelCm: SgbFloodLevelCm;
  readonly orthometricElevationM: number;
  readonly status: CrossStageEntryStatus;
  readonly relation: SpatialPointRelation;
  readonly isIntercepted: boolean | null;
  readonly reason?: string;
};

export type NonNestedTransition = {
  readonly lowerInterceptedCm: SgbFloodLevelCm;
  readonly higherOutsideCm: SgbFloodLevelCm;
};

export type CrossStagePointSummary = {
  readonly classification: "derived";
  readonly method: typeof SGB_LOCATION_QUERY_METHOD_ID;
  readonly crs: "EPSG:4326";
  readonly source: typeof SGB_AREA_SOURCE;
  readonly stationReference: typeof SGB_REFERENCE_STATION_LABEL;
  readonly point: GeoPoint;
  readonly envelopeStatus: MapServerEnvelopeStatus;
  readonly hydraulicDomainStatus: HydraulicDomainStatus;
  readonly totalStages: number;
  readonly evaluatedCount: number;
  readonly entries: readonly CrossStageEntry[];
  readonly interceptedLevelsCm: readonly SgbFloodLevelCm[];
  readonly boundaryLevelsCm: readonly SgbFloodLevelCm[];
  readonly failedLevelsCm: readonly SgbFloodLevelCm[];
  readonly pendingLevelsCm: readonly SgbFloodLevelCm[];
  readonly isComplete: boolean;
  readonly lowestInterceptedLevelCm: SgbFloodLevelCm | null;
  readonly lowestInterceptedRelation: EvaluatedPointRelation | null;
  readonly highestInterceptedLevelCm: SgbFloodLevelCm | null;
  readonly hasNonNestedPattern: boolean;
  readonly nonNestedTransitions: readonly NonNestedTransition[];
  readonly boundarySemanticsNote: string;
  readonly lowestStageDistinctionNote: string;
  readonly safetyDisclaimer: string;
};

export type CoordinateParseResult =
  | {
      readonly ok: true;
      readonly point: GeoPoint;
      readonly likelySwappedPadua: boolean;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

export function isValidGeoPoint(point: unknown): point is GeoPoint {
  if (!point || typeof point !== "object") return false;
  const candidate = point as { lat?: unknown; lon?: unknown };
  return isFiniteWgs84Position([candidate.lon, candidate.lat]);
}

export function getMapServerEnvelopeStatus(
  point: GeoPoint,
  bbox: {
    readonly minLon: number;
    readonly minLat: number;
    readonly maxLon: number;
    readonly maxLat: number;
  } = SGB_MAPSERVER_ENVELOPE_BBOX,
): MapServerEnvelopeStatus {
  if (
    point.lon >= bbox.minLon &&
    point.lon <= bbox.maxLon &&
    point.lat >= bbox.minLat &&
    point.lat <= bbox.maxLat
  ) {
    return "within_mapserver_envelope";
  }
  return "outside_mapserver_envelope";
}

/**
 * Assesses both the auxiliary MapServer rectangular envelope and the hydraulic
 * model domain coverage without falsely inferring full hydraulic coverage from
 * a rectangular bbox (harmonized with R02-F / PR #55).
 */
export function assessPointSpatialCoverage(
  point: GeoPoint,
  coverageDomain: PointModelCoverageDomain = DEFAULT_AUXILIARY_MAPSERVER_DOMAIN,
  boundaryToleranceMeters: number = DEFAULT_BOUNDARY_TOLERANCE_METERS,
): PointCoverageAssessment {
  const envelopeStatus = getMapServerEnvelopeStatus(point);

  if (coverageDomain.kind === "unknown") {
    return { envelopeStatus, hydraulicDomainStatus: "unknown" };
  }

  if (coverageDomain.kind === "bbox") {
    const insideCustomBbox =
      getMapServerEnvelopeStatus(point, coverageDomain.bbox) ===
      "within_mapserver_envelope";
    return {
      envelopeStatus,
      // Inside an auxiliary bbox does NOT prove full hydraulic coverage -> "unknown"
      hydraulicDomainStatus: insideCustomBbox
        ? "unknown"
        : "outside_model_extent",
    };
  }

  const extracted = extractValidatedPolygons(coverageDomain.geometry);
  if (extracted.status !== "valid") {
    return { envelopeStatus, hydraulicDomainStatus: "unknown" };
  }
  const rel = classifyPointInValidatedPolygons(
    point,
    extracted.polygons,
    boundaryToleranceMeters,
  );
  return {
    envelopeStatus,
    hydraulicDomainStatus:
      rel === "inside" || rel === "boundary"
        ? "covered"
        : "outside_model_extent",
  };
}

export function formatBoundaryProximityNote(
  toleranceMeters: number = DEFAULT_BOUNDARY_TOLERANCE_METERS,
): string {
  const formatted = toleranceMeters.toFixed(1).replace(".", ",");
  return `A tolerância de ±${formatted} m representa apenas uma faixa de proximidade geométrica sobre o contorno vetorial SGB; não representa precisão física nem limite exato da inundação.`;
}

export function getSafetyDisclaimer(
  envelopeStatus: MapServerEnvelopeStatus | null,
  hydraulicDomainStatus: HydraulicDomainStatus | null,
): string {
  if (
    envelopeStatus === "outside_mapserver_envelope" ||
    hydraulicDomainStatus === "outside_model_extent"
  ) {
    return "Ponto fora do envelope auxiliar do MapServer SGB (2024): ausência de interseção com a geometria consultada não indica ausência de possibilidade de inundação nem declara o local seguro.";
  }
  if (hydraulicDomainStatus === "unknown") {
    return "Relação avaliada exclusivamente sobre a geometria consultada do SGB (2024). O envelope retangular do MapServer é auxiliar e não comprova cobertura hidráulica integral no seu interior (domínio hidráulico desconhecido); ausência de interseção não declara imóvel seguro, e interseção não indica profundidade, velocidade, dano ou alerta oficial.";
  }
  return "Resultado derivado sobre cenário estático SGB (2024) em domínio hidráulico validado. Ausência de interseção não declara imóvel seguro, e interseção não indica profundidade, velocidade, dano ou alerta oficial.";
}

function metersPerDegreeAtLat(latDeg: number): {
  readonly mPerDegLon: number;
  readonly mPerDegLat: number;
} {
  const latRad = latDeg * DEG_TO_RAD;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const denom = 1 - WGS84_E2 * sinLat * sinLat;
  const sqrtDenom = Math.sqrt(denom);
  const meridionalRadius = (WGS84_A * (1 - WGS84_E2)) / (denom * sqrtDenom);
  const primeVerticalRadius = WGS84_A / sqrtDenom;
  return {
    mPerDegLat: meridionalRadius * DEG_TO_RAD,
    mPerDegLon: Math.max(primeVerticalRadius * cosLat * DEG_TO_RAD, 1e-6),
  };
}

/**
 * Computes the local WGS84 ellipsoidal distance (in meters) from a point P
 * to a line segment AB. Accurate to sub-millimeter precision for segments up
 * to several kilometers.
 */
export function pointToSegmentDistanceMeters(
  pLon: number,
  pLat: number,
  aLon: number,
  aLat: number,
  bLon: number,
  bLat: number,
): number {
  const refLat = (pLat + aLat + bLat) / 3;
  const { mPerDegLon, mPerDegLat } = metersPerDegreeAtLat(refLat);

  const ax = (aLon - pLon) * mPerDegLon;
  const ay = (aLat - pLat) * mPerDegLat;
  const bx = (bLon - pLon) * mPerDegLon;
  const by = (bLat - pLat) * mPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq <= 0) {
    return Math.hypot(ax, ay);
  }

  const rawT = -(ax * dx + ay * dy) / lenSq;
  const t = Math.max(0, Math.min(1, rawT));

  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(closestX, closestY);
}

function ringBoundingBox(ring: ClipRing): {
  readonly minLon: number;
  readonly minLat: number;
  readonly maxLon: number;
  readonly maxLat: number;
} {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, minLat, maxLon, maxLat };
}

function isPointWithinExpandedRingBbox(
  lon: number,
  lat: number,
  ring: ClipRing,
  padLonDeg: number,
  padLatDeg: number,
): boolean {
  const box = ringBoundingBox(ring);
  return (
    lon >= box.minLon - padLonDeg &&
    lon <= box.maxLon + padLonDeg &&
    lat >= box.minLat - padLatDeg &&
    lat <= box.maxLat + padLatDeg
  );
}

function isPointNearSegment(
  lon: number,
  lat: number,
  a: readonly [number, number],
  b: readonly [number, number],
  epsMeters: number,
  padLonDeg: number,
  padLatDeg: number,
): boolean {
  const [aLon, aLat] = a;
  const [bLon, bLat] = b;
  const segMinLon = Math.min(aLon, bLon);
  const segMaxLon = Math.max(aLon, bLon);
  if (lon < segMinLon - padLonDeg || lon > segMaxLon + padLonDeg) return false;

  const segMinLat = Math.min(aLat, bLat);
  const segMaxLat = Math.max(aLat, bLat);
  if (lat < segMinLat - padLatDeg || lat > segMaxLat + padLatDeg) return false;

  return pointToSegmentDistanceMeters(lon, lat, aLon, aLat, bLon, bLat) <= epsMeters;
}

function isPointOnRingBoundary(
  lon: number,
  lat: number,
  ring: ClipRing,
  toleranceMeters: number,
  padLonDeg: number,
  padLatDeg: number,
): boolean {
  if (!isPointWithinExpandedRingBbox(lon, lat, ring, padLonDeg, padLatDeg)) {
    return false;
  }
  const epsMeters = Math.max(toleranceMeters, 1e-9);
  for (let i = 0; i < ring.length - 1; i += 1) {
    if (
      isPointNearSegment(
        lon,
        lat,
        ring[i],
        ring[i + 1],
        epsMeters,
        padLonDeg,
        padLatDeg,
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Even-odd ray-casting test for strict containment in a closed linear ring.
 * Boundary proximity should be checked via `isPointOnRingBoundary` beforehand.
 */
function isPointStrictlyInsideRing(
  lon: number,
  lat: number,
  ring: ClipRing,
): boolean {
  let inside = false;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const intersects =
      y1 > lat !== y2 > lat && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function classifyPointInSinglePolygon(
  lon: number,
  lat: number,
  polygon: ClipPolygon,
  toleranceMeters: number,
  padLonDeg: number,
  padLatDeg: number,
): EvaluatedPointRelation {
  const outer = polygon[0];
  if (!isPointWithinExpandedRingBbox(lon, lat, outer, padLonDeg, padLatDeg)) {
    return "outside";
  }

  if (
    isPointOnRingBoundary(lon, lat, outer, toleranceMeters, padLonDeg, padLatDeg)
  ) {
    return "boundary";
  }

  if (!isPointStrictlyInsideRing(lon, lat, outer)) {
    return "outside";
  }

  for (let h = 1; h < polygon.length; h += 1) {
    const hole = polygon[h];
    if (!isPointWithinExpandedRingBbox(lon, lat, hole, padLonDeg, padLatDeg)) {
      continue;
    }
    if (
      isPointOnRingBoundary(lon, lat, hole, toleranceMeters, padLonDeg, padLatDeg)
    ) {
      return "boundary";
    }
    if (isPointStrictlyInsideRing(lon, lat, hole)) {
      return "outside";
    }
  }

  return "inside";
}

/**
 * Evaluates a point against a collection of validated polygons (union semantics):
 * - If strictly `inside` any polygon -> `"inside"`
 * - Else if within the geometric proximity band of any boundary -> `"boundary"`
 * - Else -> `"outside"`
 */
export function classifyPointInValidatedPolygons(
  point: GeoPoint,
  polygons: readonly ClipPolygon[],
  toleranceMeters: number = DEFAULT_BOUNDARY_TOLERANCE_METERS,
): EvaluatedPointRelation {
  const safeTolerance =
    Number.isFinite(toleranceMeters) && toleranceMeters >= 0
      ? toleranceMeters
      : DEFAULT_BOUNDARY_TOLERANCE_METERS;
  const { mPerDegLon, mPerDegLat } = metersPerDegreeAtLat(point.lat);
  const padLatDeg = safeTolerance / mPerDegLat + 1e-7;
  const padLonDeg = safeTolerance / mPerDegLon + 1e-7;

  let touchedBoundary = false;
  for (const poly of polygons) {
    const relation = classifyPointInSinglePolygon(
      point.lon,
      point.lat,
      poly,
      safeTolerance,
      padLonDeg,
      padLatDeg,
    );
    if (relation === "inside") {
      return "inside";
    }
    if (relation === "boundary") {
      touchedBoundary = true;
    }
  }
  return touchedBoundary ? "boundary" : "outside";
}

/**
 * Evaluates a WGS84 point against an official SGB flood scenario GeoJSON
 * (supports Polygon, MultiPolygon, FeatureCollection, and internal holes).
 *
 * Fail-closed contract: invalid coordinates, missing/empty GeoJSON, or any
 * invalid polygon/hole ring returns `status: "unavailable"`, never `"outside"`.
 */
export function evaluatePointAgainstFloodScenario(
  point: GeoPoint | null | undefined,
  input: FloodAreaInput | null | undefined,
  levelCm: number,
  options: {
    readonly boundaryToleranceMeters?: number;
    readonly coverageDomain?: PointModelCoverageDomain;
  } = {},
): PointScenarioQueryResult {
  const boundaryToleranceMeters =
    options.boundaryToleranceMeters ?? DEFAULT_BOUNDARY_TOLERANCE_METERS;
  const boundarySemanticsNote = formatBoundaryProximityNote(
    boundaryToleranceMeters,
  );
  const coverageDomain =
    options.coverageDomain ?? DEFAULT_AUXILIARY_MAPSERVER_DOMAIN;

  if (!isValidGeoPoint(point)) {
    return {
      status: "unavailable",
      classification: "derived",
      method: SGB_LOCATION_QUERY_METHOD_ID,
      crs: "EPSG:4326",
      source: SGB_AREA_SOURCE,
      stationReference: SGB_REFERENCE_STATION_LABEL,
      levelCm,
      point: null,
      envelopeStatus: null,
      hydraulicDomainStatus: null,
      relation: "unavailable",
      isIntercepted: null,
      boundaryToleranceMeters,
      boundarySemanticsNote,
      reason: "Coordenadas inválidas ou fora dos limites WGS84.",
      safetyDisclaimer: getSafetyDisclaimer(null, null),
    };
  }

  const { envelopeStatus, hydraulicDomainStatus } = assessPointSpatialCoverage(
    point,
    coverageDomain,
    boundaryToleranceMeters,
  );
  const safetyDisclaimer = getSafetyDisclaimer(
    envelopeStatus,
    hydraulicDomainStatus,
  );
  const extracted = extractValidatedPolygons(input);

  if (extracted.status !== "valid") {
    return {
      status: "unavailable",
      classification: "derived",
      method: SGB_LOCATION_QUERY_METHOD_ID,
      crs: "EPSG:4326",
      source: SGB_AREA_SOURCE,
      stationReference: SGB_REFERENCE_STATION_LABEL,
      levelCm,
      point,
      envelopeStatus,
      hydraulicDomainStatus,
      relation: "unavailable",
      isIntercepted: null,
      boundaryToleranceMeters,
      boundarySemanticsNote,
      reason: extracted.reason,
      safetyDisclaimer,
    };
  }

  const relation = classifyPointInValidatedPolygons(
    point,
    extracted.polygons,
    boundaryToleranceMeters,
  );

  return {
    status: "valid",
    classification: "derived",
    method: SGB_LOCATION_QUERY_METHOD_ID,
    crs: "EPSG:4326",
    source: SGB_AREA_SOURCE,
    stationReference: SGB_REFERENCE_STATION_LABEL,
    levelCm,
    point,
    envelopeStatus,
    hydraulicDomainStatus,
    relation,
    isIntercepted: relation === "inside" || relation === "boundary",
    boundaryToleranceMeters,
    boundarySemanticsNote,
    safetyDisclaimer,
  };
}

/**
 * Evaluates a point in A/B scenario comparison mode without assuming that
 * Scenario A is nested inside Scenario B (or vice versa).
 *
 * Fail-closed: if either scenario A or B is unavailable/invalid, returns
 * `combinedRelation: "unavailable"`.
 */
export function evaluatePointInComparison(
  point: GeoPoint | null | undefined,
  inputA: FloodAreaInput | null | undefined,
  levelACm: number,
  inputB: FloodAreaInput | null | undefined,
  levelBCm: number,
  options: {
    readonly boundaryToleranceMeters?: number;
    readonly coverageDomain?: PointModelCoverageDomain;
  } = {},
): PointComparisonQueryResult {
  const boundaryToleranceMeters =
    options.boundaryToleranceMeters ?? DEFAULT_BOUNDARY_TOLERANCE_METERS;
  const boundarySemanticsNote = formatBoundaryProximityNote(
    boundaryToleranceMeters,
  );

  const resA = evaluatePointAgainstFloodScenario(point, inputA, levelACm, options);
  const resB = evaluatePointAgainstFloodScenario(point, inputB, levelBCm, options);

  if (resA.status !== "valid" || resB.status !== "valid") {
    const reasons: string[] = [];
    if (resA.status !== "valid") {
      reasons.push(`Cenário A (${levelACm} cm): ${resA.reason}`);
    }
    if (resB.status !== "valid") {
      reasons.push(`Cenário B (${levelBCm} cm): ${resB.reason}`);
    }
    const validPoint = isValidGeoPoint(point) ? point : null;
    const coverage = validPoint
      ? assessPointSpatialCoverage(
          validPoint,
          options.coverageDomain ?? DEFAULT_AUXILIARY_MAPSERVER_DOMAIN,
          boundaryToleranceMeters,
        )
      : null;
    return {
      status: "unavailable",
      classification: "derived",
      method: SGB_LOCATION_QUERY_METHOD_ID,
      crs: "EPSG:4326",
      source: SGB_AREA_SOURCE,
      stationReference: SGB_REFERENCE_STATION_LABEL,
      levelACm,
      levelBCm,
      point: validPoint,
      envelopeStatus: coverage?.envelopeStatus ?? null,
      hydraulicDomainStatus: coverage?.hydraulicDomainStatus ?? null,
      relationA: resA.relation,
      relationB: resB.relation,
      combinedRelation: "unavailable",
      involvesBoundaryProximity:
        resA.relation === "boundary" || resB.relation === "boundary",
      boundaryToleranceMeters,
      boundarySemanticsNote,
      reason: reasons.join(" | "),
      safetyDisclaimer: getSafetyDisclaimer(
        coverage?.envelopeStatus ?? null,
        coverage?.hydraulicDomainStatus ?? null,
      ),
    };
  }

  let combinedRelation: ComparisonCombinedRelation;
  if (resA.isIntercepted && resB.isIntercepted) {
    combinedRelation = "both";
  } else if (resA.isIntercepted) {
    combinedRelation = "only_a";
  } else if (resB.isIntercepted) {
    combinedRelation = "only_b";
  } else {
    combinedRelation = "neither";
  }

  return {
    status: "valid",
    classification: "derived",
    method: SGB_LOCATION_QUERY_METHOD_ID,
    crs: "EPSG:4326",
    source: SGB_AREA_SOURCE,
    stationReference: SGB_REFERENCE_STATION_LABEL,
    levelACm,
    levelBCm,
    point: resA.point,
    envelopeStatus: resA.envelopeStatus,
    hydraulicDomainStatus: resA.hydraulicDomainStatus,
    relationA: resA.relation,
    relationB: resB.relation,
    combinedRelation,
    involvesBoundaryProximity:
      resA.relation === "boundary" || resB.relation === "boundary",
    boundaryToleranceMeters,
    boundarySemanticsNote,
    reason: null,
    safetyDisclaimer: resA.safetyDisclaimer,
  };
}

function buildCrossStageEntry(
  levelCm: SgbFloodLevelCm,
  raw:
    | {
        readonly status: CrossStageEntryStatus;
        readonly relation: SpatialPointRelation;
        readonly reason?: string;
      }
    | undefined,
): CrossStageEntry {
  const orthometricElevationM = SGB_STAGE_ELEVATIONS[levelCm];
  if (!raw || raw.status === "pending") {
    return {
      levelCm,
      orthometricElevationM,
      status: "pending",
      relation: "unavailable",
      isIntercepted: null,
    };
  }
  if (raw.status === "error" || raw.relation === "unavailable") {
    return {
      levelCm,
      orthometricElevationM,
      status: "error",
      relation: "unavailable",
      isIntercepted: null,
      reason: raw.reason ?? "Cenário indisponível.",
    };
  }
  return {
    levelCm,
    orthometricElevationM,
    status: "evaluated",
    relation: raw.relation,
    isIntercepted: raw.relation === "inside" || raw.relation === "boundary",
  };
}

function detectNonNestedTransitions(
  evaluatedEntries: readonly CrossStageEntry[],
): readonly NonNestedTransition[] {
  const transitions: NonNestedTransition[] = [];
  for (let i = 0; i < evaluatedEntries.length; i += 1) {
    const lower = evaluatedEntries[i];
    if (!lower.isIntercepted) continue;
    const higherOutside = evaluatedEntries
      .slice(i + 1)
      .find((candidate) => candidate.isIntercepted === false);
    if (higherOutside) {
      transitions.push({
        lowerInterceptedCm: lower.levelCm,
        higherOutsideCm: higherOutside.levelCm,
      });
    }
  }
  return transitions;
}

function buildLowestStageDistinctionNote(params: {
  readonly envelopeStatus: MapServerEnvelopeStatus;
  readonly hydraulicDomainStatus: HydraulicDomainStatus;
  readonly lowestInterceptedLevelCm: SgbFloodLevelCm | null;
  readonly lowestInterceptedRelation: EvaluatedPointRelation | null;
  readonly boundaryLevelsCm: readonly SgbFloodLevelCm[];
  readonly isComplete: boolean;
  readonly boundaryToleranceMeters: number;
}): string {
  const tolFormatted = params.boundaryToleranceMeters
    .toFixed(1)
    .replace(".", ",");

  if (
    params.envelopeStatus === "outside_mapserver_envelope" ||
    params.hydraulicDomainStatus === "outside_model_extent"
  ) {
    return "O ponto está fora do envelope auxiliar do MapServer SGB (3,00–5,50 m). Ausência de interseção com as geometrias consultadas não indica ausência de possibilidade de inundação.";
  }

  if (params.lowestInterceptedLevelCm !== null) {
    const meters = (params.lowestInterceptedLevelCm / 100)
      .toFixed(2)
      .replace(".", ",");
    const base =
      params.lowestInterceptedLevelCm === 300
        ? "3,00 m (300 cm) é a menor cota publicada pelo SGB (2024). Essa menor cota identificada entre os cenários consultados não corresponde necessariamente ao início real de inundação, pois não há cenários oficiais abaixo de 300 cm."
        : `${meters} m (${params.lowestInterceptedLevelCm} cm) é a menor cota identificada entre os cenários SGB consultados (passo discreto de 25 cm, sem interpolação). Não corresponde necessariamente ao início real de inundação no local.`;
    let boundarySuffix = "";
    if (params.lowestInterceptedRelation === "boundary") {
      boundarySuffix = ` A identificação nessa cota ocorre na faixa de proximidade geométrica de ±${tolFormatted} m sobre o contorno vetorial, o que não representa precisão física da inundação.`;
    } else if (params.boundaryLevelsCm.length > 0) {
      boundarySuffix = ` Cenários marcados como fronteira utilizam faixa de proximidade geométrica de ±${tolFormatted} m (não precisão física da inundação).`;
    }
    const partialSuffix = params.isComplete
      ? ""
      : " Há cenários não verificados/com falha; cotas inferiores indisponíveis não foram descartadas.";
    return `${base}${boundarySuffix}${partialSuffix}`;
  }

  if (!params.isComplete) {
    return "Nenhuma interseção identificada entre os cenários verificados até o momento; como há cotas indisponíveis ou pendentes, o resultado é incompleto.";
  }

  return "Nenhuma das 11 geometrias oficiais consultadas (3,00–5,50 m) intercepta o ponto. O envelope do MapServer é auxiliar e não comprova cobertura hidráulica integral; isso não declara o imóvel seguro nem descarta cheias acima de 5,50 m ou alagamentos locais.";
}

/**
 * Summarizes an explicit multi-stage point analysis across all 11 official SGB
 * scenarios (300–550 cm, step 25 cm).
 */
export function summarizeCrossStagePointQuery(
  point: GeoPoint,
  resultsByLevel: Readonly<
    Partial<
      Record<
        SgbFloodLevelCm,
        {
          readonly status: CrossStageEntryStatus;
          readonly relation: SpatialPointRelation;
          readonly reason?: string;
        }
      >
    >
  >,
  options: {
    readonly boundaryToleranceMeters?: number;
    readonly coverageDomain?: PointModelCoverageDomain;
  } = {},
): CrossStagePointSummary {
  const boundaryToleranceMeters =
    options.boundaryToleranceMeters ?? DEFAULT_BOUNDARY_TOLERANCE_METERS;
  const boundarySemanticsNote = formatBoundaryProximityNote(
    boundaryToleranceMeters,
  );
  const { envelopeStatus, hydraulicDomainStatus } = assessPointSpatialCoverage(
    point,
    options.coverageDomain ?? DEFAULT_AUXILIARY_MAPSERVER_DOMAIN,
    boundaryToleranceMeters,
  );

  const entries: CrossStageEntry[] = SGB_FLOOD_LEVELS_CM.map((levelCm) =>
    buildCrossStageEntry(levelCm, resultsByLevel[levelCm]),
  );

  const evaluatedEntries = entries.filter((e) => e.status === "evaluated");
  const interceptedEntries = evaluatedEntries.filter(
    (e) => e.isIntercepted === true,
  );
  const interceptedLevelsCm = interceptedEntries.map((e) => e.levelCm);
  const boundaryLevelsCm = evaluatedEntries
    .filter((e) => e.relation === "boundary")
    .map((e) => e.levelCm);
  const failedLevelsCm = entries
    .filter((e) => e.status === "error")
    .map((e) => e.levelCm);
  const pendingLevelsCm = entries
    .filter((e) => e.status === "pending")
    .map((e) => e.levelCm);

  const lowestEntry = interceptedEntries.at(0) ?? null;
  const highestEntry = interceptedEntries.at(-1) ?? null;
  const lowestInterceptedLevelCm = lowestEntry?.levelCm ?? null;
  const lowestInterceptedRelation =
    lowestEntry && lowestEntry.relation !== "unavailable"
      ? lowestEntry.relation
      : null;
  const highestInterceptedLevelCm = highestEntry?.levelCm ?? null;

  const nonNestedTransitions = detectNonNestedTransitions(evaluatedEntries);
  const isComplete = failedLevelsCm.length === 0 && pendingLevelsCm.length === 0;

  const lowestStageDistinctionNote = buildLowestStageDistinctionNote({
    envelopeStatus,
    hydraulicDomainStatus,
    lowestInterceptedLevelCm,
    lowestInterceptedRelation,
    boundaryLevelsCm,
    isComplete,
    boundaryToleranceMeters,
  });

  return {
    classification: "derived",
    method: SGB_LOCATION_QUERY_METHOD_ID,
    crs: "EPSG:4326",
    source: SGB_AREA_SOURCE,
    stationReference: SGB_REFERENCE_STATION_LABEL,
    point,
    envelopeStatus,
    hydraulicDomainStatus,
    totalStages: SGB_FLOOD_LEVELS_CM.length,
    evaluatedCount: evaluatedEntries.length,
    entries,
    interceptedLevelsCm,
    boundaryLevelsCm,
    failedLevelsCm,
    pendingLevelsCm,
    isComplete,
    lowestInterceptedLevelCm,
    lowestInterceptedRelation,
    highestInterceptedLevelCm,
    hasNonNestedPattern: nonNestedTransitions.length > 0,
    nonNestedTransitions,
    boundarySemanticsNote,
    lowestStageDistinctionNote,
    safetyDisclaimer: getSafetyDisclaimer(envelopeStatus, hydraulicDomainStatus),
  };
}

function parseSingleDecimalNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s+/g, "");
  if (!cleaned) return null;
  const normalized =
    cleaned.includes(",") && !cleaned.includes(".")
      ? cleaned.replace(",", ".")
      : cleaned;
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Checks if a (lat, lon) pair looks like accidentally swapped Santo Antônio de
 * Pádua coordinates (e.g., lat ≈ -42.18, lon ≈ -21.54). Used only to display an
 * explicit user hint — coordinates are NEVER silently swapped.
 */
export function isLikelySwappedPaduaCoordinates(
  lat: number,
  lon: number,
): boolean {
  return lat <= -41.5 && lat >= -43.0 && lon <= -20.8 && lon >= -22.2;
}

/**
 * Parses separate latitude and longitude text inputs (WGS84 decimal degrees).
 * Fail-closed on empty, non-numeric, or out-of-range values.
 */
export function parseLatLonFields(
  rawLat: string,
  rawLon: string,
): CoordinateParseResult {
  const lat = parseSingleDecimalNumber(rawLat);
  const lon = parseSingleDecimalNumber(rawLon);

  if (lat === null || lon === null) {
    return {
      ok: false,
      error:
        "Informe latitude e longitude numéricas válidas em graus decimais (ex.: -21.5390 e -42.1800).",
    };
  }

  if (lat < -90 || lat > 90) {
    return {
      ok: false,
      error: "Latitude fora do intervalo válido (−90° a +90°).",
    };
  }

  if (lon < -180 || lon > 180) {
    return {
      ok: false,
      error: "Longitude fora do intervalo válido (−180° a +180°).",
    };
  }

  return {
    ok: true,
    point: { lat, lon },
    likelySwappedPadua: isLikelySwappedPaduaCoordinates(lat, lon),
  };
}

/**
 * Parses a single pasted coordinate pair string such as:
 * - "-21.5390, -42.1800"
 * - "-21,5390; -42,1800"
 * - "-21.5390 -42.1800"
 */
export function parseCoordinatePairText(raw: string): CoordinateParseResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "Informe um par de coordenadas (latitude, longitude).",
    };
  }

  let parts: string[];
  if (trimmed.includes(";")) {
    parts = trimmed.split(";").map((s) => s.trim());
  } else if (trimmed.includes(",")) {
    const commaParts = trimmed.split(",").map((s) => s.trim());
    if (commaParts.length === 2) {
      parts = commaParts;
    } else {
      return {
        ok: false,
        error:
          "Formato ambíguo. Use ponto decimal com vírgula separadora (-21.5390, -42.1800) ou ponto e vírgula (-21,5390; -42,1800).",
      };
    }
  } else {
    parts = trimmed.split(/\s+/);
  }

  if (parts.length !== 2) {
    return {
      ok: false,
      error:
        "Informe exatamente dois valores: latitude e longitude (ex.: -21.5390, -42.1800).",
    };
  }

  return parseLatLonFields(parts[0], parts[1]);
}

export function formatCoordPtBr(value: number, decimals = 5): string {
  return value.toFixed(decimals).replace(".", ",");
}

/**
 * Formats a privacy-safe technical summary for sharing a point query without
 * including any personal address or personally identifiable information.
 *
 * Explicitly documents:
 * - auxiliary MapServer envelope vs. unknown hydraulic domain coverage;
 * - ±0.5 m boundary tolerance as a geometric proximity band (not physical flood accuracy);
 * - distinction between lowest identified stage and actual flood onset.
 */
export function formatLocationTechnicalSummary(params: {
  readonly point: GeoPoint;
  readonly mode: "single" | "compare";
  readonly levelACm: number;
  readonly levelBCm?: number;
  readonly relationLabel: string;
  readonly envelopeStatus?: MapServerEnvelopeStatus | null;
  readonly hydraulicDomainStatus?: HydraulicDomainStatus | null;
  readonly lowestInterceptedLevelCm?: SgbFloodLevelCm | null;
  readonly lowestInterceptedRelation?: EvaluatedPointRelation | null;
  readonly boundaryToleranceMeters?: number;
  readonly consultedDateIso?: string;
  readonly appVersion?: string;
}): string {
  const dateStr = (params.consultedDateIso ?? new Date().toISOString()).slice(
    0,
    10,
  );
  const version = params.appVersion ?? "0.2.0-academic";
  const tolMeters =
    params.boundaryToleranceMeters ?? DEFAULT_BOUNDARY_TOLERANCE_METERS;
  const fmtMeters = (cm: number) => (cm / 100).toFixed(2).replace(".", ",");

  const coverage =
    params.envelopeStatus && params.hydraulicDomainStatus
      ? {
          envelopeStatus: params.envelopeStatus,
          hydraulicDomainStatus: params.hydraulicDomainStatus,
        }
      : assessPointSpatialCoverage(params.point);

  const envelopeLabel =
    coverage.envelopeStatus === "within_mapserver_envelope"
      ? "Dentro do envelope auxiliar do MapServer SGB"
      : "Fora do envelope auxiliar do MapServer SGB";

  let domainLabel: string;
  if (coverage.hydraulicDomainStatus === "covered") {
    domainLabel = "Domínio hidráulico validado";
  } else if (coverage.hydraulicDomainStatus === "outside_model_extent") {
    domainLabel = "Fora do domínio conhecido do modelo";
  } else {
    domainLabel = "Domínio hidráulico desconhecido (bbox não comprova cobertura integral)";
  }

  const scenarioLine =
    params.mode === "compare" && params.levelBCm !== undefined
      ? `Comparação A ${fmtMeters(params.levelACm)} m (${params.levelACm} cm) × B ${fmtMeters(params.levelBCm)} m (${params.levelBCm} cm)`
      : `Cota ${fmtMeters(params.levelACm)} m (${params.levelACm} cm)`;

  const lowestBoundarySuffix =
    params.lowestInterceptedRelation === "boundary"
      ? " (faixa de proximidade geométrica ±0,5 m)"
      : "";

  const lowestLine =
    params.lowestInterceptedLevelCm !== undefined &&
    params.lowestInterceptedLevelCm !== null
      ? `\nMenor cota identificada entre os cenários consultados: ${fmtMeters(params.lowestInterceptedLevelCm)} m (${params.lowestInterceptedLevelCm} cm)${lowestBoundarySuffix} — não equivale ao início real de inundação.`
      : "";

  return [
    `Pádua FloodSim (${version}) — Consulta geográfica derivada`,
    `Coordenadas (WGS84 / EPSG:4326): ${params.point.lat.toFixed(5)}, ${params.point.lon.toFixed(5)}`,
    `Cobertura espacial: ${envelopeLabel} | ${domainLabel}`,
    `Cenário SGB: ${scenarioLine}`,
    `Estação de referência: ${SGB_REFERENCE_STATION_LABEL}`,
    `Relação com a geometria consultada: ${params.relationLabel}${lowestLine}`,
    `Fronteira: ${formatBoundaryProximityNote(tolMeters)}`,
    `Fonte das manchas: ${SGB_AREA_SOURCE} | Método: ${SGB_LOCATION_QUERY_METHOD_ID} | Data: ${dateStr}`,
    `Aviso: resultado acadêmico derivado sobre cenário estático; não declara imóvel seguro nem substitui alertas oficiais.`,
  ].join("\n");
}
