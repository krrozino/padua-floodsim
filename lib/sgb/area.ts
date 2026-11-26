import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import polygonClipping from "polygon-clipping";
import type {
  MultiPolygon as ClipMultiPolygon,
  Polygon as ClipPolygon,
  Ring as ClipRing,
} from "polygon-clipping";

export const SGB_AREA_METHOD_ID = "wgs84-ellipsoidal-geodesic-union-v1" as const;
export const SGB_AREA_SOURCE = "Serviço Geológico do Brasil (SGB, 2024)" as const;

// WGS84 ellipsoid parameters
const WGS84_SEMI_MAJOR_AXIS_M = 6_378_137.0;
const WGS84_FLATTENING = 1 / 298.257223563;
const WGS84_ECCENTRICITY_SQ = WGS84_FLATTENING * (2 - WGS84_FLATTENING);
const WGS84_ECCENTRICITY = Math.sqrt(WGS84_ECCENTRICITY_SQ);
const DEG_TO_RAD = Math.PI / 180;

// Upper plausibility bound for an urban floodplain scenario in Santo Antônio de Pádua (500 km²).
const MAX_PLAUSIBLE_SCENARIO_AREA_M2 = 500_000_000;

function equalAreaQ(latRad: number): number {
  const sinLat = Math.sin(latRad);
  const eSin = WGS84_ECCENTRICITY * sinLat;
  return (
    (1 - WGS84_ECCENTRICITY_SQ) *
    (sinLat / (1 - eSin * eSin) -
      (1 / (2 * WGS84_ECCENTRICITY)) * Math.log((1 - eSin) / (1 + eSin)))
  );
}

const Q_POLE = equalAreaQ(Math.PI / 2);
const WGS84_EQUAL_AREA_RADIUS_M =
  WGS84_SEMI_MAJOR_AXIS_M * Math.sqrt(Q_POLE / 2);

export type FloodAreaInput =
  | FeatureCollection<Polygon | MultiPolygon>
  | Feature<Polygon | MultiPolygon>
  | Polygon
  | MultiPolygon;

export type DerivedFloodAreaResult =
  | {
      readonly status: "valid";
      readonly classification: "derived";
      readonly method: typeof SGB_AREA_METHOD_ID;
      readonly crs: "EPSG:4326";
      readonly source: typeof SGB_AREA_SOURCE;
      readonly levelCm: number;
      readonly areaSquareMeters: number;
      readonly areaHectares: number;
      readonly areaSquareKm: number;
      readonly polygonPartCount: number;
      readonly holeCount: number;
    }
  | {
      readonly status: "empty" | "invalid";
      readonly classification: "derived";
      readonly method: typeof SGB_AREA_METHOD_ID;
      readonly crs: "EPSG:4326";
      readonly source: typeof SGB_AREA_SOURCE;
      readonly levelCm: number;
      readonly areaSquareMeters: null;
      readonly areaHectares: null;
      readonly areaSquareKm: null;
      readonly polygonPartCount: number;
      readonly holeCount: number;
      readonly reason: string;
    };

export function isFiniteWgs84Position(pos: unknown): pos is [number, number] {
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

const isFinitePosition = isFiniteWgs84Position;

/**
 * Computes an unsigned numerical approximation of the ellipsoidal surface area (in m²)
 * of a closed WGS84 linear ring via trapezoidal integration in authalic latitude on the
 * WGS84 ellipsoid (Chamberlain & Duquette / JPL spherical-excess form generalized to
 * authalic radius).
 */
export function computeGeodesicRingAreaM2(
  ring: readonly [number, number][],
): number {
  const n = ring.length;
  if (n < 4) return 0;

  let integral = 0;
  for (let i = 0; i < n - 1; i += 1) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    const sinBeta1 = equalAreaQ(lat1 * DEG_TO_RAD) / Q_POLE;
    const sinBeta2 = equalAreaQ(lat2 * DEG_TO_RAD) / Q_POLE;
    integral += (lon2 - lon1) * DEG_TO_RAD * (2 + sinBeta1 + sinBeta2);
  }

  return Math.abs(
    (integral * WGS84_EQUAL_AREA_RADIUS_M * WGS84_EQUAL_AREA_RADIUS_M) / 2,
  );
}

/**
 * Validates and minimally normalizes a GeoJSON linear ring (fail-closed).
 *
 * Permitted normalization:
 * - Removes consecutive identical vertices.
 * - Appends the closing vertex if the ring has >= 3 distinct finite vertices and is unclosed.
 *
 * Fail-closed rejections:
 * - Non-finite or out-of-range WGS84 coordinates.
 * - Fewer than 3 distinct vertices after consecutive deduplication.
 * - Degenerate (zero-area / collinear) rings.
 */
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

  // Strip trailing closing point temporarily to count distinct vertices accurately.
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

  // Reject collinear / degenerate rings with zero area.
  if (computeGeodesicRingAreaM2(cleaned) <= 0) return null;

  return cleaned;
}

/**
 * Validates a Polygon coordinate array (outer ring + all internal rings).
 * Fail-closed: if the outer ring OR ANY internal ring (hole) is invalid,
 * the entire polygon is rejected (returns null) so holes are never silently dropped.
 */
function sanitizePolygonCoordinates(rawCoords: unknown): ClipPolygon | null {
  if (!Array.isArray(rawCoords) || rawCoords.length === 0) return null;

  const outer = sanitizeRing(rawCoords[0]);
  if (!outer) return null;

  const rings: ClipPolygon = [outer];
  for (let i = 1; i < rawCoords.length; i += 1) {
    const hole = sanitizeRing(rawCoords[i]);
    if (!hole) {
      return null;
    }
    rings.push(hole);
  }
  return rings;
}

function extractClipPolygons(input: FloodAreaInput): {
  polygons: ClipPolygon[];
  invalidReason: string | null;
} {
  const polygons: ClipPolygon[] = [];
  let invalidReason: string | null = null;

  const fail = (reason: string) => {
    if (!invalidReason) invalidReason = reason;
  };

  const collectGeometry = (
    geometry: Polygon | MultiPolygon | null | undefined,
  ) => {
    if (!geometry || typeof geometry !== "object") {
      fail("Geometria ausente ou inválida na camada do cenário.");
      return;
    }

    if (geometry.type === "Polygon") {
      const poly = sanitizePolygonCoordinates(geometry.coordinates);
      if (poly) {
        polygons.push(poly);
      } else {
        fail("Polígono ou anel interno inválido/degenerado encontrado.");
      }
      return;
    }

    if (geometry.type === "MultiPolygon") {
      if (
        !Array.isArray(geometry.coordinates) ||
        geometry.coordinates.length === 0
      ) {
        fail("MultiPolygon vazio ou malformado encontrado.");
        return;
      }
      for (const rawPoly of geometry.coordinates) {
        const poly = sanitizePolygonCoordinates(rawPoly);
        if (poly) {
          polygons.push(poly);
        } else {
          fail("Parte ou anel interno inválido encontrado em MultiPolygon.");
          return;
        }
      }
      return;
    }

    fail("Tipo de geometria não suportado para cálculo de área de mancha.");
  };

  if (!input || typeof input !== "object") {
    return {
      polygons: [],
      invalidReason: "Entrada GeoJSON inválida para cálculo de área.",
    };
  }

  if (input.type === "FeatureCollection") {
    if (!Array.isArray(input.features)) {
      return {
        polygons: [],
        invalidReason: "FeatureCollection sem lista válida de feições.",
      };
    }
    for (const feature of input.features) {
      if (!feature || feature.type !== "Feature") {
        fail("Feição inválida encontrada na FeatureCollection.");
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

export type { ClipMultiPolygon, ClipPolygon, ClipRing };

export const MAX_PLAUSIBLE_FLOOD_AREA_M2 = MAX_PLAUSIBLE_SCENARIO_AREA_M2;

export type ValidatedPolygonsResult =
  | {
      readonly status: "valid";
      readonly polygons: readonly ClipPolygon[];
    }
  | {
      readonly status: "empty" | "invalid";
      readonly polygons: null;
      readonly reason: string;
    };

/**
 * Extracts and validates (fail-closed) all Polygon/MultiPolygon parts and holes
 * from a GeoJSON input without executing a topological union. Suitable for exact
 * point-in-polygon and polyline-clipping queries that operate over the union
 * semantics directly without double-counting area.
 */
export function extractValidatedPolygons(
  input: FloodAreaInput | null | undefined,
): ValidatedPolygonsResult {
  if (!input || typeof input !== "object") {
    return {
      status: "invalid",
      polygons: null,
      reason: "Entrada GeoJSON ausente ou inválida.",
    };
  }
  const { polygons, invalidReason } = extractClipPolygons(input);
  if (invalidReason) {
    return {
      status: "invalid",
      polygons: null,
      reason: invalidReason,
    };
  }
  if (polygons.length === 0) {
    return {
      status: "empty",
      polygons: null,
      reason: "Nenhum polígono carregado para o cenário selecionado.",
    };
  }
  return {
    status: "valid",
    polygons,
  };
}

export type DissolvedPolygonsResult =
  | {
      readonly status: "valid";
      readonly dissolved: ClipMultiPolygon;
    }
  | {
      readonly status: "empty" | "invalid";
      readonly dissolved: null;
      readonly reason: string;
    };

export type DissolvedAreaMetrics =
  | {
      readonly status: "valid";
      readonly areaSquareMeters: number;
      readonly polygonPartCount: number;
      readonly holeCount: number;
    }
  | {
      readonly status: "invalid";
      readonly areaSquareMeters: null;
      readonly polygonPartCount: number;
      readonly holeCount: number;
      readonly reason: string;
    };

/**
 * Extracts, validates (fail-closed), and topologically dissolves all polygons from a GeoJSON input.
 */
export function extractAndDissolvePolygons(
  input: FloodAreaInput,
): DissolvedPolygonsResult {
  const { polygons, invalidReason } = extractClipPolygons(input);

  if (invalidReason) {
    return {
      status: "invalid",
      dissolved: null,
      reason: invalidReason,
    };
  }

  if (polygons.length === 0) {
    return {
      status: "empty",
      dissolved: null,
      reason: "Nenhum polígono carregado para o cenário selecionado.",
    };
  }

  try {
    const dissolved =
      polygons.length === 1
        ? polygonClipping.union(polygons[0])
        : polygonClipping.union(polygons[0], ...polygons.slice(1));
    return {
      status: "valid",
      dissolved,
    };
  } catch {
    return {
      status: "invalid",
      dissolved: null,
      reason: "Falha topológica ao unificar polígonos do cenário.",
    };
  }
}

/**
 * Computes WGS84 authalic ellipsoidal area metrics over an already dissolved ClipMultiPolygon.
 * Allows empty arrays (area = 0 m²), which is valid for empty set-difference/intersection results.
 */
export function computeDissolvedAreaMetrics(
  dissolved: ClipMultiPolygon,
): DissolvedAreaMetrics {
  let totalAreaM2 = 0;
  let holeCount = 0;
  let polygonPartCount = 0;

  for (const poly of dissolved) {
    if (!poly || poly.length === 0) continue;
    polygonPartCount += 1;
    let polyAreaM2 = computeGeodesicRingAreaM2(poly[0]);
    for (let i = 1; i < poly.length; i += 1) {
      polyAreaM2 -= computeGeodesicRingAreaM2(poly[i]);
      holeCount += 1;
    }
    if (!Number.isFinite(polyAreaM2) || polyAreaM2 < 0) {
      return {
        status: "invalid",
        areaSquareMeters: null,
        polygonPartCount,
        holeCount,
        reason: "Área líquida inválida após subtração de anéis internos.",
      };
    }
    totalAreaM2 += polyAreaM2;
  }

  if (!Number.isFinite(totalAreaM2) || totalAreaM2 < 0) {
    return {
      status: "invalid",
      areaSquareMeters: null,
      polygonPartCount,
      holeCount,
      reason: "Área calculada não finita ou negativa.",
    };
  }

  return {
    status: "valid",
    areaSquareMeters: totalAreaM2,
    polygonPartCount,
    holeCount,
  };
}

/**
 * Computes the overlap-free derived area (numerical approximation in WGS84 authalic
 * latitude) of an official SGB flood Polygon/MultiPolygon layer.
 *
 * Fail-closed contract:
 * - Any invalid feature, invalid MultiPolygon part, invalid internal ring (hole),
 *   or degenerate/collinear ring invalidates the entire scenario calculation so
 *   partial areas are never reported as complete scenario areas.
 * - Permitted topological normalization: consecutive duplicate vertex removal,
 *   unclosed ring closure (>= 3 distinct finite vertices), and topological union via
 *   `polygon-clipping` to dissolve overlapping parts and prevent double counting.
 */
export function computeDerivedFloodArea(
  input: FloodAreaInput,
  levelCm: number,
  options: { readonly maxPlausibleAreaM2?: number } = {},
): DerivedFloodAreaResult {
  const maxPlausibleAreaM2 =
    options.maxPlausibleAreaM2 ?? MAX_PLAUSIBLE_SCENARIO_AREA_M2;

  const extracted = extractAndDissolvePolygons(input);
  if (extracted.status !== "valid") {
    return {
      status: extracted.status,
      classification: "derived",
      method: SGB_AREA_METHOD_ID,
      crs: "EPSG:4326",
      source: SGB_AREA_SOURCE,
      levelCm,
      areaSquareMeters: null,
      areaHectares: null,
      areaSquareKm: null,
      polygonPartCount: 0,
      holeCount: 0,
      reason: extracted.reason,
    };
  }

  const metrics = computeDissolvedAreaMetrics(extracted.dissolved);
  if (metrics.status !== "valid") {
    return {
      status: "invalid",
      classification: "derived",
      method: SGB_AREA_METHOD_ID,
      crs: "EPSG:4326",
      source: SGB_AREA_SOURCE,
      levelCm,
      areaSquareMeters: null,
      areaHectares: null,
      areaSquareKm: null,
      polygonPartCount: metrics.polygonPartCount,
      holeCount: metrics.holeCount,
      reason: metrics.reason,
    };
  }

  if (
    metrics.areaSquareMeters <= 0 ||
    metrics.areaSquareMeters > maxPlausibleAreaM2
  ) {
    return {
      status: "invalid",
      classification: "derived",
      method: SGB_AREA_METHOD_ID,
      crs: "EPSG:4326",
      source: SGB_AREA_SOURCE,
      levelCm,
      areaSquareMeters: null,
      areaHectares: null,
      areaSquareKm: null,
      polygonPartCount: metrics.polygonPartCount,
      holeCount: metrics.holeCount,
      reason: "Área calculada fora dos limites de plausibilidade.",
    };
  }

  return {
    status: "valid",
    classification: "derived",
    method: SGB_AREA_METHOD_ID,
    crs: "EPSG:4326",
    source: SGB_AREA_SOURCE,
    levelCm,
    areaSquareMeters: metrics.areaSquareMeters,
    areaHectares: metrics.areaSquareMeters / 10_000,
    areaSquareKm: metrics.areaSquareMeters / 1_000_000,
    polygonPartCount: metrics.polygonPartCount,
    holeCount: metrics.holeCount,
  };
}

export function formatFloodArea(areaSquareMeters: number): {
  primary: string;
  secondary: string;
} {
  const hectares = areaSquareMeters / 10_000;
  const km2 = areaSquareMeters / 1_000_000;

  if (km2 >= 1) {
    return {
      primary: `${km2.toFixed(2).replace(".", ",")} km²`,
      secondary: `${hectares.toFixed(1).replace(".", ",")} ha`,
    };
  }

  if (hectares >= 1) {
    return {
      primary: `${hectares.toFixed(2).replace(".", ",")} ha`,
      secondary: `${Math.round(areaSquareMeters).toLocaleString("pt-BR")} m²`,
    };
  }

  return {
    primary: `${Math.round(areaSquareMeters).toLocaleString("pt-BR")} m²`,
    secondary: `${hectares.toFixed(2).replace(".", ",")} ha`,
  };
}

export function formatHectares(hectares: number, decimals = 2): string {
  const normalized = Math.abs(hectares) < 1e-9 ? 0 : hectares;
  return `${normalized.toFixed(decimals).replace(".", ",")} ha`;
}

export function formatSignedHectares(deltaHectares: number, decimals = 2): string {
  if (Math.abs(deltaHectares) < 0.005) {
    return `0,${"0".repeat(decimals)} ha`;
  }
  const sign = deltaHectares > 0 ? "+" : "−";
  return `${sign}${Math.abs(deltaHectares).toFixed(decimals).replace(".", ",")} ha`;
}

export function formatSignedPercent(deltaPercent: number, decimals = 1): string {
  if (Math.abs(deltaPercent) < 0.05) {
    return `0,${"0".repeat(decimals)}%`;
  }
  const sign = deltaPercent > 0 ? "+" : "−";
  return `${sign}${Math.abs(deltaPercent).toFixed(decimals).replace(".", ",")}%`;
}
