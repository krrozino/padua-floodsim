import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import polygonClipping from "polygon-clipping";
import type { MultiPolygon as ClipMultiPolygon, Polygon as ClipPolygon, Ring as ClipRing } from "polygon-clipping";

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

/**
 * Sanitizes a GeoJSON linear ring: validates coordinates, strips consecutive duplicates,
 * closes the ring if open, and verifies at least 4 positions (3 distinct vertices + closure).
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

  if (cleaned.length < 3) return null;

  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    cleaned.push([first[0], first[1]]);
  }

  return cleaned.length >= 4 ? cleaned : null;
}

function sanitizePolygonCoordinates(rawCoords: unknown): ClipPolygon | null {
  if (!Array.isArray(rawCoords) || rawCoords.length === 0) return null;

  const outer = sanitizeRing(rawCoords[0]);
  if (!outer) return null;

  const rings: ClipPolygon = [outer];
  for (let i = 1; i < rawCoords.length; i += 1) {
    const hole = sanitizeRing(rawCoords[i]);
    if (hole) {
      rings.push(hole);
    }
  }
  return rings;
}

function extractClipPolygons(input: FloodAreaInput): {
  polygons: ClipPolygon[];
  invalidGeometryFound: boolean;
} {
  const polygons: ClipPolygon[] = [];
  let invalidGeometryFound = false;

  const collectGeometry = (geometry: Polygon | MultiPolygon | null | undefined) => {
    if (!geometry || typeof geometry !== "object") {
      invalidGeometryFound = true;
      return;
    }

    if (geometry.type === "Polygon") {
      const poly = sanitizePolygonCoordinates(geometry.coordinates);
      if (poly) {
        polygons.push(poly);
      } else {
        invalidGeometryFound = true;
      }
      return;
    }

    if (geometry.type === "MultiPolygon") {
      if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
        invalidGeometryFound = true;
        return;
      }
      for (const rawPoly of geometry.coordinates) {
        const poly = sanitizePolygonCoordinates(rawPoly);
        if (poly) {
          polygons.push(poly);
        } else {
          invalidGeometryFound = true;
        }
      }
      return;
    }

    invalidGeometryFound = true;
  };

  if (input.type === "FeatureCollection") {
    if (!Array.isArray(input.features)) {
      return { polygons: [], invalidGeometryFound: true };
    }
    for (const feature of input.features) {
      collectGeometry(feature?.geometry);
    }
  } else if (input.type === "Feature") {
    collectGeometry(input.geometry);
  } else {
    collectGeometry(input);
  }

  return { polygons, invalidGeometryFound };
}

/**
 * Computes the unsigned ellipsoidal surface area (in m²) of a closed WGS84 ring
 * using the equal-area authalic latitude integral on the WGS84 ellipsoid.
 */
export function computeGeodesicRingAreaM2(ring: readonly [number, number][]): number {
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
 * Computes the overlap-free derived geodesic area (WGS84 ellipsoid) of an official SGB
 * flood polygon/multipolygon layer.
 *
 * Overlapping parts across features or MultiPolygon members are dissolved via topological
 * union before integration so no area is double-counted. Internal rings (holes) are subtracted.
 */
export function computeDerivedFloodArea(
  input: FloodAreaInput,
  levelCm: number,
  options: { readonly maxPlausibleAreaM2?: number } = {},
): DerivedFloodAreaResult {
  const maxPlausibleAreaM2 =
    options.maxPlausibleAreaM2 ?? MAX_PLAUSIBLE_SCENARIO_AREA_M2;

  const { polygons, invalidGeometryFound } = extractClipPolygons(input);

  if (polygons.length === 0) {
    return {
      status: invalidGeometryFound ? "invalid" : "empty",
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
      reason: invalidGeometryFound
        ? "Geometria inválida ou degenerada para cálculo de área."
        : "Nenhum polígono carregado para o cenário selecionado.",
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
      status: "invalid",
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
      reason: "Falha topológica ao unificar polígonos do cenário.",
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
    if (polyAreaM2 > 0) {
      totalAreaM2 += polyAreaM2;
    }
  }

  if (
    !Number.isFinite(totalAreaM2) ||
    totalAreaM2 <= 0 ||
    totalAreaM2 > maxPlausibleAreaM2
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
      polygonPartCount: dissolved.length,
      holeCount,
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
    areaSquareMeters: totalAreaM2,
    areaHectares: totalAreaM2 / 10_000,
    areaSquareKm: totalAreaM2 / 1_000_000,
    polygonPartCount: dissolved.length,
    holeCount,
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
