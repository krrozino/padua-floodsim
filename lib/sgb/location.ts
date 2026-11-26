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
 * on the boundary of an SGB vector polygon (outer ring or internal hole ring).
 *
 * Chosen well below the 10 m SGB DEM resampling grid and 1 m vector export step,
 * while reliably catching IEEE-754 floating-point collinearity along edges.
 */
export const DEFAULT_BOUNDARY_TOLERANCE_METERS = 0.5;

/**
 * Published spatial extent of the SGB MapServer group `MODELAGEM`
 * (`hidrologia/mancha_santo_antonio_de_padua`, CRS EPSG:4674 / EPSG:4326).
 * Source: data/metadata/sources.json (`areaOfInterest.bbox`).
 */
export const SGB_MODEL_COVERAGE_BBOX = {
  minLon: -42.20900097927306,
  minLat: -21.553311556725685,
  maxLon: -42.14556243623249,
  maxLat: -21.51245633890636,
} as const;

// WGS84 ellipsoid constants for local metric tangent-plane projection
const WGS84_A = 6_378_137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);
const DEG_TO_RAD = Math.PI / 180;

export type GeoPoint = {
  readonly lat: number;
  readonly lon: number;
};

export type ModelCoverageStatus =
  | "within_model_coverage"
  | "outside_model_coverage";

export type SpatialPointRelation =
  | "inside"
  | "boundary"
  | "outside"
  | "unavailable";

export type EvaluatedPointRelation = Exclude<SpatialPointRelation, "unavailable">;

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
      readonly coverageStatus: ModelCoverageStatus;
      readonly relation: EvaluatedPointRelation;
      readonly isIntercepted: boolean;
      readonly boundaryToleranceMeters: number;
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
      readonly coverageStatus: ModelCoverageStatus | null;
      readonly relation: "unavailable";
      readonly isIntercepted: null;
      readonly boundaryToleranceMeters: number;
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
  readonly coverageStatus: ModelCoverageStatus | null;
  readonly relationA: SpatialPointRelation;
  readonly relationB: SpatialPointRelation;
  readonly combinedRelation: ComparisonCombinedRelation;
  readonly boundaryToleranceMeters: number;
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
  readonly coverageStatus: ModelCoverageStatus;
  readonly totalStages: number;
  readonly evaluatedCount: number;
  readonly entries: readonly CrossStageEntry[];
  readonly interceptedLevelsCm: readonly SgbFloodLevelCm[];
  readonly boundaryLevelsCm: readonly SgbFloodLevelCm[];
  readonly failedLevelsCm: readonly SgbFloodLevelCm[];
  readonly pendingLevelsCm: readonly SgbFloodLevelCm[];
  readonly isComplete: boolean;
  readonly lowestInterceptedLevelCm: SgbFloodLevelCm | null;
  readonly highestInterceptedLevelCm: SgbFloodLevelCm | null;
  readonly hasNonNestedPattern: boolean;
  readonly nonNestedTransitions: readonly NonNestedTransition[];
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

export function getModelCoverageStatus(point: GeoPoint): ModelCoverageStatus {
  const { minLon, minLat, maxLon, maxLat } = SGB_MODEL_COVERAGE_BBOX;
  if (
    point.lon >= minLon &&
    point.lon <= maxLon &&
    point.lat >= minLat &&
    point.lat <= maxLat
  ) {
    return "within_model_coverage";
  }
  return "outside_model_coverage";
}

export function getSafetyDisclaimer(
  coverageStatus: ModelCoverageStatus | null,
): string {
  if (coverageStatus === "outside_model_coverage") {
    return "Ponto fora da cobertura conhecida do modelo SGB (2024): ausência de interseção não indica ausência de possibilidade de inundação nem declara o local seguro.";
  }
  return "Resultado derivado sobre cenário estático SGB (2024). Ausência de interseção não declara imóvel seguro, e interseção não indica profundidade, velocidade, dano ou alerta oficial.";
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

  let t = -(ax * dx + ay * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;

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
    const [aLon, aLat] = ring[i];
    const [bLon, bLat] = ring[i + 1];
    // Fast per-segment bbox filter
    const segMinLon = aLon < bLon ? aLon : bLon;
    const segMaxLon = aLon > bLon ? aLon : bLon;
    if (lon < segMinLon - padLonDeg || lon > segMaxLon + padLonDeg) continue;
    const segMinLat = aLat < bLat ? aLat : bLat;
    const segMaxLat = aLat > bLat ? aLat : bLat;
    if (lat < segMinLat - padLatDeg || lat > segMaxLat + padLatDeg) continue;

    if (pointToSegmentDistanceMeters(lon, lat, aLon, aLat, bLon, bLat) <= epsMeters) {
      return true;
    }
  }
  return false;
}

/**
 * Even-odd ray-casting test for strict containment in a closed linear ring.
 * Boundary points should be checked via `isPointOnRingBoundary` beforehand.
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

  // Point is strictly inside the outer ring: verify internal holes (islands).
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
 * - Else if on `boundary` of any polygon (outer ring or hole ring) -> `"boundary"`
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
  // Add small angular safety margin for bbox pre-filtering
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
  options: { readonly boundaryToleranceMeters?: number } = {},
): PointScenarioQueryResult {
  const boundaryToleranceMeters =
    options.boundaryToleranceMeters ?? DEFAULT_BOUNDARY_TOLERANCE_METERS;

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
      coverageStatus: null,
      relation: "unavailable",
      isIntercepted: null,
      boundaryToleranceMeters,
      reason: "Coordenadas inválidas ou fora dos limites WGS84.",
      safetyDisclaimer: getSafetyDisclaimer(null),
    };
  }

  const coverageStatus = getModelCoverageStatus(point);
  const safetyDisclaimer = getSafetyDisclaimer(coverageStatus);
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
      coverageStatus,
      relation: "unavailable",
      isIntercepted: null,
      boundaryToleranceMeters,
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
    coverageStatus,
    relation,
    isIntercepted: relation === "inside" || relation === "boundary",
    boundaryToleranceMeters,
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
  options: { readonly boundaryToleranceMeters?: number } = {},
): PointComparisonQueryResult {
  const boundaryToleranceMeters =
    options.boundaryToleranceMeters ?? DEFAULT_BOUNDARY_TOLERANCE_METERS;

  const resA = evaluatePointAgainstFloodScenario(point, inputA, levelACm, {
    boundaryToleranceMeters,
  });
  const resB = evaluatePointAgainstFloodScenario(point, inputB, levelBCm, {
    boundaryToleranceMeters,
  });

  if (resA.status !== "valid" || resB.status !== "valid") {
    const reasons: string[] = [];
    if (resA.status !== "valid") {
      reasons.push(`Cenário A (${levelACm} cm): ${resA.reason}`);
    }
    if (resB.status !== "valid") {
      reasons.push(`Cenário B (${levelBCm} cm): ${resB.reason}`);
    }
    const validPoint = isValidGeoPoint(point) ? point : null;
    const coverageStatus = validPoint ? getModelCoverageStatus(validPoint) : null;
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
      coverageStatus,
      relationA: resA.relation,
      relationB: resB.relation,
      combinedRelation: "unavailable",
      boundaryToleranceMeters,
      reason: reasons.join(" | "),
      safetyDisclaimer: getSafetyDisclaimer(coverageStatus),
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
    coverageStatus: resA.coverageStatus,
    relationA: resA.relation,
    relationB: resB.relation,
    combinedRelation,
    boundaryToleranceMeters,
    reason: null,
    safetyDisclaimer: resA.safetyDisclaimer,
  };
}

/**
 * Summarizes an explicit multi-stage point analysis across all 11 official SGB
 * scenarios (300–550 cm, step 25 cm).
 *
 * Scientific rules:
 * - Never interpolates between stages.
 * - Never assumes nesting between stages (evaluates every stage independently
 *   and flags any non-nested transition where a lower stage intercepts while a
 *   higher stage does not).
 * - Explicitly distinguishes the lowest identified stage among consulted SGB
 *   scenarios from the actual onset of flooding at the location.
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
): CrossStagePointSummary {
  const coverageStatus = getModelCoverageStatus(point);
  const entries: CrossStageEntry[] = SGB_FLOOD_LEVELS_CM.map((levelCm) => {
    const raw = resultsByLevel[levelCm];
    if (!raw || raw.status === "pending") {
      return {
        levelCm,
        orthometricElevationM: SGB_STAGE_ELEVATIONS[levelCm],
        status: "pending",
        relation: "unavailable",
        isIntercepted: null,
      };
    }
    if (raw.status === "error" || raw.relation === "unavailable") {
      return {
        levelCm,
        orthometricElevationM: SGB_STAGE_ELEVATIONS[levelCm],
        status: "error",
        relation: "unavailable",
        isIntercepted: null,
        reason: raw.reason ?? "Cenário indisponível.",
      };
    }
    const isIntercepted = raw.relation === "inside" || raw.relation === "boundary";
    return {
      levelCm,
      orthometricElevationM: SGB_STAGE_ELEVATIONS[levelCm],
      status: "evaluated",
      relation: raw.relation,
      isIntercepted,
    };
  });

  const evaluatedEntries = entries.filter((e) => e.status === "evaluated");
  const interceptedLevelsCm = evaluatedEntries
    .filter((e) => e.isIntercepted === true)
    .map((e) => e.levelCm);
  const boundaryLevelsCm = evaluatedEntries
    .filter((e) => e.relation === "boundary")
    .map((e) => e.levelCm);
  const failedLevelsCm = entries
    .filter((e) => e.status === "error")
    .map((e) => e.levelCm);
  const pendingLevelsCm = entries
    .filter((e) => e.status === "pending")
    .map((e) => e.levelCm);

  const lowestInterceptedLevelCm =
    interceptedLevelsCm.length > 0 ? interceptedLevelsCm[0] : null;
  const highestInterceptedLevelCm =
    interceptedLevelsCm.length > 0
      ? interceptedLevelsCm[interceptedLevelsCm.length - 1]
      : null;

  // Detect any non-nested pattern without assuming monotonicity across stages
  const nonNestedTransitions: NonNestedTransition[] = [];
  for (let i = 0; i < evaluatedEntries.length; i += 1) {
    const lower = evaluatedEntries[i];
    if (!lower.isIntercepted) continue;
    for (let j = i + 1; j < evaluatedEntries.length; j += 1) {
      const higher = evaluatedEntries[j];
      if (higher.isIntercepted === false) {
        nonNestedTransitions.push({
          lowerInterceptedCm: lower.levelCm,
          higherOutsideCm: higher.levelCm,
        });
        break;
      }
    }
  }

  const isComplete = failedLevelsCm.length === 0 && pendingLevelsCm.length === 0;

  let lowestStageDistinctionNote: string;
  if (coverageStatus === "outside_model_coverage") {
    lowestStageDistinctionNote =
      "O ponto está fora da cobertura conhecida do modelo SGB (3,00–5,50 m). Ausência de interseção nos cenários consultados não indica ausência de possibilidade de inundação.";
  } else if (lowestInterceptedLevelCm === 300) {
    lowestStageDistinctionNote =
      "3,00 m (300 cm) é a menor cota publicada pelo SGB (2024). Essa menor cota identificada entre os cenários consultados não corresponde necessariamente ao início real de inundação, pois não há cenários oficiais abaixo de 300 cm.";
  } else if (lowestInterceptedLevelCm !== null) {
    const meters = (lowestInterceptedLevelCm / 100).toFixed(2).replace(".", ",");
    const partialCaveat = !isComplete
      ? " Há cenários não verificados/com falha; cotas inferiores indisponíveis não foram descartadas."
      : "";
    lowestStageDistinctionNote = `${meters} m (${lowestInterceptedLevelCm} cm) é a menor cota identificada entre os cenários SGB consultados (passo discreto de 25 cm, sem interpolação). Não corresponde necessariamente ao início real de inundação no local.${partialCaveat}`;
  } else if (!isComplete) {
    lowestStageDistinctionNote =
      "Nenhuma interseção identificada entre os cenários verificados até o momento; como há cotas indisponíveis ou pendentes, o resultado é incompleto.";
  } else {
    lowestStageDistinctionNote =
      "Nenhuma das 11 cotas oficiais consultadas (3,00–5,50 m) intercepta o ponto. Isso não declara o imóvel seguro nem descarta cheias acima de 5,50 m ou alagamentos de drenagem local.";
  }

  return {
    classification: "derived",
    method: SGB_LOCATION_QUERY_METHOD_ID,
    crs: "EPSG:4326",
    source: SGB_AREA_SOURCE,
    stationReference: SGB_REFERENCE_STATION_LABEL,
    point,
    coverageStatus,
    totalStages: SGB_FLOOD_LEVELS_CM.length,
    evaluatedCount: evaluatedEntries.length,
    entries,
    interceptedLevelsCm,
    boundaryLevelsCm,
    failedLevelsCm,
    pendingLevelsCm,
    isComplete,
    lowestInterceptedLevelCm,
    highestInterceptedLevelCm,
    hasNonNestedPattern: nonNestedTransitions.length > 0,
    nonNestedTransitions,
    lowestStageDistinctionNote,
    safetyDisclaimer: getSafetyDisclaimer(coverageStatus),
  };
}

function parseSingleDecimalNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s+/g, "");
  if (!cleaned) return null;
  // Allow Brazilian comma decimal only when there is no dot, e.g. "-21,539"
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
 */
export function formatLocationTechnicalSummary(params: {
  readonly point: GeoPoint;
  readonly mode: "single" | "compare";
  readonly levelACm: number;
  readonly levelBCm?: number;
  readonly relationLabel: string;
  readonly lowestInterceptedLevelCm?: SgbFloodLevelCm | null;
  readonly consultedDateIso?: string;
  readonly appVersion?: string;
}): string {
  const dateStr = (params.consultedDateIso ?? new Date().toISOString()).slice(
    0,
    10,
  );
  const version = params.appVersion ?? "0.2.0-academic";
  const fmtMeters = (cm: number) => (cm / 100).toFixed(2).replace(".", ",");
  const scenarioLine =
    params.mode === "compare" && params.levelBCm !== undefined
      ? `Comparação A ${fmtMeters(params.levelACm)} m (${params.levelACm} cm) × B ${fmtMeters(params.levelBCm)} m (${params.levelBCm} cm)`
      : `Cota ${fmtMeters(params.levelACm)} m (${params.levelACm} cm)`;
  const lowestLine =
    params.lowestInterceptedLevelCm !== undefined &&
    params.lowestInterceptedLevelCm !== null
      ? `\nMenor cota identificada entre os cenários consultados: ${fmtMeters(params.lowestInterceptedLevelCm)} m (${params.lowestInterceptedLevelCm} cm) — não equivale ao início real de inundação.`
      : "";

  return [
    `Pádua FloodSim (${version}) — Consulta geográfica derivada`,
    `Coordenadas (WGS84 / EPSG:4326): ${params.point.lat.toFixed(5)}, ${params.point.lon.toFixed(5)}`,
    `Cenário SGB: ${scenarioLine}`,
    `Estação de referência: ${SGB_REFERENCE_STATION_LABEL}`,
    `Resultado espacial: ${params.relationLabel}${lowestLine}`,
    `Fonte das manchas: ${SGB_AREA_SOURCE} | Método: ${SGB_LOCATION_QUERY_METHOD_ID} | Data: ${dateStr}`,
    `Aviso: resultado acadêmico derivado sobre cenário estático; não declara imóvel seguro nem substitui alertas oficiais.`,
  ].join("\n");
}
