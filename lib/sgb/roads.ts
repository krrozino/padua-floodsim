import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Position,
} from "geojson";
import {
  SGB_AREA_SOURCE,
  extractValidatedPolygons,
  isFiniteWgs84Position,
  type ClipPolygon,
  type ClipRing,
  type FloodAreaInput,
} from "./area.ts";
import {
  SGB_MODEL_COVERAGE_BBOX,
  classifyPointInValidatedPolygons,
} from "./location.ts";

export const SGB_ROAD_EXPOSURE_METHOD_ID = "wgs84-geodesic-line-clip-v1" as const;
export const OSM_ROAD_LICENSE = "ODbL-1.0" as const;
export const OSM_ROAD_ATTRIBUTION = "© OpenStreetMap contributors" as const;

/**
 * Maximum acceptable share of unnamed road length for public UI eligibility.
 * In Santo Antônio de Pádua (2026-11-25 audit), OSM unnamed length is 56.5% overall
 * (38.1%–52.6% within SGB stages), far above this threshold.
 */
export const MAX_PUBLIC_UI_UNNAMED_RATIO = 0.1;

// WGS84 ellipsoid constants for Vincenty inverse geodesic length
const WGS84_A = 6_378_137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = WGS84_A * (1 - WGS84_F);
const DEG_TO_RAD = Math.PI / 180;

export type RoadCategoryGroup =
  | "arterial"
  | "local_vehicular"
  | "service_access"
  | "pedestrian"
  | "other";

export type RoadFeatureProperties = {
  readonly id?: string | number;
  readonly osmId?: string | number;
  readonly highway?: string | null;
  readonly name?: string | null;
  readonly ref?: string | null;
  readonly bridge?: string | boolean | null;
  readonly tunnel?: string | boolean | null;
  readonly oneway?: string | boolean | null;
  readonly [key: string]: unknown;
};

export type RoadLineFeature = Feature<
  LineString | MultiLineString,
  RoadFeatureProperties
>;

export type RoadNetworkInput = FeatureCollection<
  LineString | MultiLineString,
  RoadFeatureProperties
>;

export type RoadDenominatorStatus =
  | "complete_in_coverage"
  | "extends_outside_coverage";

export type RoadExposureItem = {
  readonly canonicalKey: string;
  readonly displayName: string;
  readonly identificationSource: "name" | "ref";
  readonly rawNameVariants: readonly string[];
  readonly highwayCategories: readonly string[];
  readonly totalLengthMeters: number;
  readonly interceptedLengthMeters: number;
  readonly interceptedSegmentCount: number;
  readonly denominatorStatus: RoadDenominatorStatus;
  /**
   * Percentage of the road axis intercepted by the flood polygon.
   * Strictly `null` when the road extends outside the known model coverage
   * (incomplete denominator) or total length is 0.
   */
  readonly interceptedPercent: number | null;
};

export type ElevatedStructureIntersection = {
  readonly id: string;
  readonly name: string | null;
  readonly ref: string | null;
  readonly highway: string;
  readonly structureType: "bridge" | "tunnel";
  readonly interceptedLengthMeters: number;
};

export type RoadExposureSemanticGuardrails = {
  readonly doesNotIndicateBlockage: true;
  readonly doesNotIndicateDamage: true;
  readonly doesNotIndicateDepth: true;
  readonly doesNotIndicateTrafficImpossibility: true;
};

export type RoadExposureResult =
  | {
      readonly status: "valid";
      readonly classification: "derived";
      readonly method: typeof SGB_ROAD_EXPOSURE_METHOD_ID;
      readonly crs: "EPSG:4326";
      readonly floodSource: typeof SGB_AREA_SOURCE;
      readonly roadSourceLicense: typeof OSM_ROAD_LICENSE;
      readonly roadAttribution: typeof OSM_ROAD_ATTRIBUTION;
      readonly levelCm: number;
      readonly excludedBridgesAndTunnels: boolean;
      readonly totalNetworkLengthMeters: number;
      readonly totalInterceptedLengthMeters: number;
      readonly totalInterceptedLengthKm: number;
      readonly identifiableInterceptedLengthMeters: number;
      readonly unnamedInterceptedLengthMeters: number;
      readonly unnamedInterceptedRatio: number;
      readonly identifiableRoadCount: number;
      readonly interceptedSegmentCount: number;
      readonly interceptedFeatureCount: number;
      readonly lengthByCategoryGroupMeters: Readonly<
        Record<RoadCategoryGroup, number>
      >;
      readonly roads: readonly RoadExposureItem[];
      readonly elevatedOrSubsurfaceStructures: readonly ElevatedStructureIntersection[];
      readonly elevatedStructuresInterceptedLengthMeters: number;
      readonly publicUiEligible: boolean;
      readonly publicUiBlockReasons: readonly string[];
      readonly semanticGuardrails: RoadExposureSemanticGuardrails;
    }
  | {
      readonly status: "empty" | "invalid";
      readonly classification: "derived";
      readonly method: typeof SGB_ROAD_EXPOSURE_METHOD_ID;
      readonly crs: "EPSG:4326";
      readonly floodSource: typeof SGB_AREA_SOURCE;
      readonly roadSourceLicense: typeof OSM_ROAD_LICENSE;
      readonly roadAttribution: typeof OSM_ROAD_ATTRIBUTION;
      readonly levelCm: number;
      readonly reason: string;
      readonly publicUiEligible: false;
      readonly semanticGuardrails: RoadExposureSemanticGuardrails;
    };

const SEMANTIC_GUARDRAILS: RoadExposureSemanticGuardrails = {
  doesNotIndicateBlockage: true,
  doesNotIndicateDamage: true,
  doesNotIndicateDepth: true,
  doesNotIndicateTrafficImpossibility: true,
};

const ABBREVIATION_RULES: readonly (readonly [RegExp, string])[] = [
  [/^r\b/, "rua"],
  [/^av\b/, "avenida"],
  [/^pc\b|^pca\b/, "praca"],
  [/^tv\b|^trav\b/, "travessa"],
  [/^rod\b/, "rodovia"],
  [/^est\b|^estr\b/, "estrada"],
  [/^pte\b/, "ponte"],
  [/\bdr\b/g, "doutor"],
  [/\bdra\b/g, "doutora"],
  [/\bprof\b/g, "professor"],
  [/\bprofa\b/g, "professora"],
  [/\bpref\b/g, "prefeito"],
  [/\bcel\b/g, "coronel"],
  [/\bmal\b/g, "marechal"],
  [/\bpres\b/g, "presidente"],
  [/\bsta\b/g, "santa"],
  [/\bsto\b/g, "santo"],
  [/\bs\b(?=\s+(?:jose|joao|paulo|pedro|antonio|sebastiao|felix|luis|luiz|francisco))/g, "sao"],
];

/**
 * Normalizes a Brazilian street/road name for deterministic deduplication across
 * multi-segment OSM ways and minor typographic/abbreviation differences.
 */
export function normalizeRoadName(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  let normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;:/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  for (const [pattern, replacement] of ABBREVIATION_RULES) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

export function classifyHighwayCategory(
  highway: string | null | undefined,
): RoadCategoryGroup {
  const hw = (highway ?? "").toLowerCase().trim();
  if (
    [
      "motorway",
      "motorway_link",
      "trunk",
      "trunk_link",
      "primary",
      "primary_link",
      "secondary",
      "secondary_link",
      "tertiary",
      "tertiary_link",
    ].includes(hw)
  ) {
    return "arterial";
  }
  if (["residential", "unclassified", "living_street"].includes(hw)) {
    return "local_vehicular";
  }
  if (["service", "track"].includes(hw)) {
    return "service_access";
  }
  if (["footway", "pedestrian", "steps", "path", "cycleway"].includes(hw)) {
    return "pedestrian";
  }
  return "other";
}

function isTruthyOsmStructureTag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  const v = value.trim().toLowerCase();
  return v.length > 0 && v !== "no" && v !== "false" && v !== "0";
}

/**
 * Computes exact WGS84 ellipsoidal geodesic distance (in meters) between two
 * geographic coordinates via Vincenty's inverse formula, matching Karney /
 * `pyproj.Geod(ellps="WGS84")` to sub-millimeter precision on road segments.
 */
export function computeGeodesicSegmentLengthMeters(
  lon1Deg: number,
  lat1Deg: number,
  lon2Deg: number,
  lat2Deg: number,
): number {
  if (lon1Deg === lon2Deg && lat1Deg === lat2Deg) return 0;

  const phi1 = lat1Deg * DEG_TO_RAD;
  const phi2 = lat2Deg * DEG_TO_RAD;
  const L = (lon2Deg - lon1Deg) * DEG_TO_RAD;

  const U1 = Math.atan((1 - WGS84_F) * Math.tan(phi1));
  const U2 = Math.atan((1 - WGS84_F) * Math.tan(phi2));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);

  let lambda = L;
  let sinSigma = 0;
  let cosSigma = 0;
  let sigma = 0;
  let cosSqAlpha = 0;
  let cos2SigmaM = 0;

  let converged = false;
  for (let iter = 0; iter < 100; iter += 1) {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    const term1 = cosU2 * sinLambda;
    const term2 = cosU1 * sinU2 - sinU1 * cosU2 * cosLambda;
    sinSigma = Math.hypot(term1, term2);
    if (sinSigma === 0) return 0;

    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM =
      cosSqAlpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha : 0;
    const C =
      (WGS84_F / 16) * cosSqAlpha * (4 + WGS84_F * (4 - 3 * cosSqAlpha));
    const prevLambda = lambda;
    lambda =
      L +
      (1 - C) *
        WGS84_F *
        sinAlpha *
        (sigma +
          C *
            sinSigma *
            (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));

    if (Math.abs(lambda - prevLambda) < 1e-12) {
      converged = true;
      break;
    }
  }

  if (!converged) {
    // Fallback spherical approximation only for antipodal degenerate cases
    const dLat = phi2 - phi1;
    const dLon = L;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) ** 2;
    return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  const uSq =
    (cosSqAlpha * (WGS84_A * WGS84_A - WGS84_B * WGS84_B)) / (WGS84_B * WGS84_B);
  const A =
    1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
          (B / 6) *
            cos2SigmaM *
            (-3 + 4 * sinSigma * sinSigma) *
            (-3 + 4 * cos2SigmaM * cos2SigmaM)));

  return WGS84_B * A * (sigma - deltaSigma);
}

export function computeGeodesicLineLengthMeters(
  coords: readonly [number, number][],
): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    total += computeGeodesicSegmentLengthMeters(
      coords[i][0],
      coords[i][1],
      coords[i + 1][0],
      coords[i + 1][1],
    );
  }
  return total;
}

type BBox = {
  readonly minLon: number;
  readonly minLat: number;
  readonly maxLon: number;
  readonly maxLat: number;
};

function computeRingBbox(ring: ClipRing): BBox {
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

function bboxesOverlap(a: BBox, b: BBox, pad = 1e-10): boolean {
  return !(
    a.maxLon < b.minLon - pad ||
    a.minLon > b.maxLon + pad ||
    a.maxLat < b.minLat - pad ||
    a.minLat > b.maxLat + pad
  );
}

/**
 * Collects exact intersection parameters t ∈ [0, 1] of segment P(t) = A + t(B-A)
 * against segment CD (including crossings, touches, and collinear overlaps).
 */
function collectSegmentEdgeIntersectionParams(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  outParams: number[],
): void {
  const rx = bx - ax;
  const ry = by - ay;
  const sx = dx - cx;
  const sy = dy - cy;

  const rxs = rx * sy - ry * sx;
  const qpx = cx - ax;
  const qpy = cy - ay;
  const qpxr = qpx * ry - qpy * rx;

  const eps = 1e-15;

  if (Math.abs(rxs) <= eps) {
    // Parallel or collinear
    if (Math.abs(qpxr) <= 1e-13) {
      const rDotR = rx * rx + ry * ry;
      if (rDotR <= eps) return;
      const t0 = (qpx * rx + qpy * ry) / rDotR;
      const t1 = ((dx - ax) * rx + (dy - ay) * ry) / rDotR;
      const lo = Math.max(0, Math.min(t0, t1));
      const hi = Math.min(1, Math.max(t0, t1));
      if (hi >= lo - 1e-12) {
        outParams.push(lo, hi);
      }
    }
    return;
  }

  const t = (qpx * sy - qpy * sx) / rxs;
  const u = qpxr / rxs;
  const tol = 1e-11;
  if (t >= -tol && t <= 1 + tol && u >= -tol && u <= 1 + tol) {
    outParams.push(Math.max(0, Math.min(1, t)));
  }
}

type IndexedPolygon = {
  readonly polygon: ClipPolygon;
  readonly outerBbox: BBox;
  readonly ringBboxes: readonly BBox[];
};

function indexPolygons(polygons: readonly ClipPolygon[]): readonly IndexedPolygon[] {
  return polygons.map((polygon) => {
    const ringBboxes = polygon.map(computeRingBbox);
    return {
      polygon,
      outerBbox: ringBboxes[0],
      ringBboxes,
    };
  });
}

/**
 * Clips a single line segment AB against validated flood polygons (supporting
 * MultiPolygons and internal holes) and returns the covered intervals [t0, t1].
 */
function clipSegmentToCoveredIntervals(
  a: readonly [number, number],
  b: readonly [number, number],
  indexedPolygons: readonly IndexedPolygon[],
): readonly (readonly [number, number])[] {
  const segBbox: BBox = {
    minLon: Math.min(a[0], b[0]),
    minLat: Math.min(a[1], b[1]),
    maxLon: Math.max(a[0], b[0]),
    maxLat: Math.max(a[1], b[1]),
  };

  const candidates = indexedPolygons.filter((item) =>
    bboxesOverlap(segBbox, item.outerBbox),
  );
  if (candidates.length === 0) {
    return [];
  }

  const params: number[] = [0, 1];
  for (const item of candidates) {
    for (let r = 0; r < item.polygon.length; r += 1) {
      if (!bboxesOverlap(segBbox, item.ringBboxes[r])) continue;
      const ring = item.polygon[r];
      for (let i = 0; i < ring.length - 1; i += 1) {
        const [cx, cy] = ring[i];
        const [dx, dy] = ring[i + 1];
        if (
          Math.max(cx, dx) < segBbox.minLon - 1e-10 ||
          Math.min(cx, dx) > segBbox.maxLon + 1e-10 ||
          Math.max(cy, dy) < segBbox.minLat - 1e-10 ||
          Math.min(cy, dy) > segBbox.maxLat + 1e-10
        ) {
          continue;
        }
        collectSegmentEdgeIntersectionParams(
          a[0],
          a[1],
          b[0],
          b[1],
          cx,
          cy,
          dx,
          dy,
          params,
        );
      }
    }
  }

  params.sort((x, y) => x - y);
  const uniqueParams: number[] = [];
  for (const t of params) {
    if (
      uniqueParams.length === 0 ||
      t - uniqueParams[uniqueParams.length - 1] > 1e-10
    ) {
      uniqueParams.push(t);
    }
  }

  const candidatePolys = candidates.map((c) => c.polygon);
  const covered: [number, number][] = [];

  for (let i = 0; i < uniqueParams.length - 1; i += 1) {
    const t0 = uniqueParams[i];
    const t1 = uniqueParams[i + 1];
    if (t1 - t0 <= 1e-10) continue;
    const tm = (t0 + t1) / 2;
    const midLon = a[0] + tm * (b[0] - a[0]);
    const midLat = a[1] + tm * (b[1] - a[1]);

    // Tight collinearity tolerance (1 mm) so segments running directly on polygon
    // boundary are counted as intercepted while grazing exterior segments are not.
    const relation = classifyPointInValidatedPolygons(
      { lat: midLat, lon: midLon },
      candidatePolys,
      1e-3,
    );

    if (relation === "inside" || relation === "boundary") {
      const prev = covered[covered.length - 1];
      if (prev && Math.abs(prev[1] - t0) <= 1e-9) {
        prev[1] = t1;
      } else {
        covered.push([t0, t1]);
      }
    }
  }

  return covered;
}

/**
 * Clips a polyline (LineString coordinates) against validated flood polygons,
 * returning exact WGS84 geodesic intercepted length (m) and continuous
 * intercepted sub-segment count.
 */
export function clipLineStringAgainstPolygons(
  coords: readonly [number, number][],
  indexedPolygons: readonly IndexedPolygon[],
): {
  readonly interceptedLengthMeters: number;
  readonly interceptedSubSegmentCount: number;
} {
  let interceptedLengthMeters = 0;
  let interceptedSubSegmentCount = 0;
  let prevEndedCovered = false;

  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const intervals = clipSegmentToCoveredIntervals(a, b, indexedPolygons);

    if (intervals.length === 0) {
      prevEndedCovered = false;
      continue;
    }

    for (let k = 0; k < intervals.length; k += 1) {
      const [t0, t1] = intervals[k];
      const p0Lon = a[0] + t0 * (b[0] - a[0]);
      const p0Lat = a[1] + t0 * (b[1] - a[1]);
      const p1Lon = a[0] + t1 * (b[0] - a[0]);
      const p1Lat = a[1] + t1 * (b[1] - a[1]);
      interceptedLengthMeters += computeGeodesicSegmentLengthMeters(
        p0Lon,
        p0Lat,
        p1Lon,
        p1Lat,
      );

      const continuesPrevious = k === 0 && prevEndedCovered && t0 <= 1e-9;
      if (!continuesPrevious) {
        interceptedSubSegmentCount += 1;
      }
    }

    const lastInterval = intervals[intervals.length - 1];
    prevEndedCovered = lastInterval[1] >= 1 - 1e-9;
  }

  return {
    interceptedLengthMeters,
    interceptedSubSegmentCount,
  };
}

function validateLineStringCoords(
  rawCoords: readonly Position[],
): [number, number][] | null {
  if (!Array.isArray(rawCoords) || rawCoords.length < 2) return null;
  const out: [number, number][] = [];
  for (const pos of rawCoords) {
    if (!isFiniteWgs84Position(pos)) return null;
    out.push([pos[0], pos[1]]);
  }
  return out;
}

function isPointInsideCoverageBbox(
  lon: number,
  lat: number,
  bbox: BBox,
): boolean {
  return (
    lon >= bbox.minLon &&
    lon <= bbox.maxLon &&
    lat >= bbox.minLat &&
    lat <= bbox.maxLat
  );
}

/**
 * Evaluates road-axis linear exposure for an OSM-style road FeatureCollection
 * against an official SGB flood scenario polygon (Polygon/MultiPolygon + holes).
 *
 * Scientific & governance safeguards:
 * - Excludes elevated bridges (`bridge=yes`) and tunnels (`tunnel=yes`) from
 *   surface road totals by default, reporting them separately with caveats.
 * - Reports percentage per road ONLY when the road's full extent lies inside
 *   the documented coverage bbox (`denominatorStatus === "complete_in_coverage"`).
 * - Evaluates `publicUiEligible` against completeness & licensing gates so low-
 *   coverage collaborative extracts are kept out of the public UI.
 * - Explicitly attaches semantic guardrails prohibiting interpretation as
 *   road blockage, damage, water depth, or traffic impossibility.
 */
export function evaluateRoadExposure(
  roadNetwork: RoadNetworkInput | null | undefined,
  floodInput: FloodAreaInput | null | undefined,
  levelCm: number,
  options: {
    readonly excludeBridgesAndTunnels?: boolean;
    readonly coverageBbox?: BBox;
    readonly licenseClearedForPublicUi?: boolean;
    readonly maxPublicUiUnnamedRatio?: number;
  } = {},
): RoadExposureResult {
  const excludeBridgesAndTunnels = options.excludeBridgesAndTunnels ?? true;
  const coverageBbox = options.coverageBbox ?? SGB_MODEL_COVERAGE_BBOX;
  const licenseClearedForPublicUi = options.licenseClearedForPublicUi ?? false;
  const maxUnnamedRatio =
    options.maxPublicUiUnnamedRatio ?? MAX_PUBLIC_UI_UNNAMED_RATIO;

  const fail = (
    status: "empty" | "invalid",
    reason: string,
  ): RoadExposureResult => ({
    status,
    classification: "derived",
    method: SGB_ROAD_EXPOSURE_METHOD_ID,
    crs: "EPSG:4326",
    floodSource: SGB_AREA_SOURCE,
    roadSourceLicense: OSM_ROAD_LICENSE,
    roadAttribution: OSM_ROAD_ATTRIBUTION,
    levelCm,
    reason,
    publicUiEligible: false,
    semanticGuardrails: SEMANTIC_GUARDRAILS,
  });

  if (
    !roadNetwork ||
    roadNetwork.type !== "FeatureCollection" ||
    !Array.isArray(roadNetwork.features)
  ) {
    return fail("invalid", "Entrada de malha viária GeoJSON ausente ou inválida.");
  }

  if (roadNetwork.features.length === 0) {
    return fail("empty", "Malha viária vazia (nenhum eixo viário fornecido).");
  }

  const extractedFlood = extractValidatedPolygons(floodInput);
  if (extractedFlood.status !== "valid") {
    return fail(extractedFlood.status, extractedFlood.reason);
  }

  const indexedPolygons = indexPolygons(extractedFlood.polygons);

  const lengthByCategoryGroupMeters: Record<RoadCategoryGroup, number> = {
    arterial: 0,
    local_vehicular: 0,
    service_access: 0,
    pedestrian: 0,
    other: 0,
  };

  type RoadAccumulator = {
    canonicalKey: string;
    displayName: string;
    identificationSource: "name" | "ref";
    rawNameVariants: Set<string>;
    highwayCategories: Set<string>;
    totalLengthMeters: number;
    interceptedLengthMeters: number;
    interceptedSegmentCount: number;
    extendsOutsideCoverage: boolean;
  };

  const roadMap = new Map<string, RoadAccumulator>();
  const elevatedStructures: ElevatedStructureIntersection[] = [];

  let totalNetworkLengthMeters = 0;
  let totalInterceptedLengthMeters = 0;
  let identifiableInterceptedLengthMeters = 0;
  let unnamedInterceptedLengthMeters = 0;
  let interceptedSegmentCount = 0;
  let interceptedFeatureCount = 0;
  let elevatedStructuresInterceptedLengthMeters = 0;

  for (let idx = 0; idx < roadNetwork.features.length; idx += 1) {
    const feature = roadNetwork.features[idx];
    if (!feature || feature.type !== "Feature" || !feature.geometry) {
      return fail("invalid", `Feição viária inválida no índice ${idx}.`);
    }

    const lineStrings: [number, number][][] = [];
    if (feature.geometry.type === "LineString") {
      const valid = validateLineStringCoords(feature.geometry.coordinates);
      if (!valid) {
        return fail("invalid", `LineString inválido na feição viária ${idx}.`);
      }
      lineStrings.push(valid);
    } else if (feature.geometry.type === "MultiLineString") {
      if (
        !Array.isArray(feature.geometry.coordinates) ||
        feature.geometry.coordinates.length === 0
      ) {
        return fail(
          "invalid",
          `MultiLineString vazio ou inválido na feição viária ${idx}.`,
        );
      }
      for (const part of feature.geometry.coordinates) {
        const valid = validateLineStringCoords(part);
        if (!valid) {
          return fail(
            "invalid",
            `Parte inválida em MultiLineString na feição viária ${idx}.`,
          );
        }
        lineStrings.push(valid);
      }
    } else {
      return fail(
        "invalid",
        `Geometria não linear encontrada na malha viária (índice ${idx}).`,
      );
    }

    const props = feature.properties ?? {};
    const highway =
      typeof props.highway === "string" && props.highway.trim()
        ? props.highway.trim()
        : "unknown";
    const categoryGroup = classifyHighwayCategory(highway);
    const isBridge = isTruthyOsmStructureTag(props.bridge);
    const isTunnel = isTruthyOsmStructureTag(props.tunnel);
    const rawName =
      typeof props.name === "string" && props.name.trim()
        ? props.name.trim()
        : null;
    const rawRef =
      typeof props.ref === "string" && props.ref.trim()
        ? props.ref.trim()
        : null;

    let featureTotalLengthM = 0;
    let featureInterceptedM = 0;
    let featureInterceptedSegs = 0;
    let featureExtendsOutside = false;

    for (const coords of lineStrings) {
      featureTotalLengthM += computeGeodesicLineLengthMeters(coords);
      if (!featureExtendsOutside) {
        for (const [lon, lat] of coords) {
          if (!isPointInsideCoverageBbox(lon, lat, coverageBbox)) {
            featureExtendsOutside = true;
            break;
          }
        }
      }
      const clipped = clipLineStringAgainstPolygons(coords, indexedPolygons);
      featureInterceptedM += clipped.interceptedLengthMeters;
      featureInterceptedSegs += clipped.interceptedSubSegmentCount;
    }

    if (excludeBridgesAndTunnels && (isBridge || isTunnel)) {
      if (featureInterceptedM > 0) {
        elevatedStructuresInterceptedLengthMeters += featureInterceptedM;
        elevatedStructures.push({
          id: String(props.osmId ?? props.id ?? feature.id ?? `way_${idx}`),
          name: rawName,
          ref: rawRef,
          highway,
          structureType: isBridge ? "bridge" : "tunnel",
          interceptedLengthMeters: featureInterceptedM,
        });
      }
      continue;
    }

    totalNetworkLengthMeters += featureTotalLengthM;

    const normName = normalizeRoadName(rawName);
    const normRef = !normName ? normalizeRoadName(rawRef) : null;
    const canonicalKey = normName
      ? `name:${normName}`
      : normRef
        ? `ref:${normRef}`
        : null;

    if (canonicalKey) {
      let acc = roadMap.get(canonicalKey);
      if (!acc) {
        acc = {
          canonicalKey,
          displayName: rawName ?? rawRef ?? canonicalKey,
          identificationSource: normName ? "name" : "ref",
          rawNameVariants: new Set<string>(),
          highwayCategories: new Set<string>(),
          totalLengthMeters: 0,
          interceptedLengthMeters: 0,
          interceptedSegmentCount: 0,
          extendsOutsideCoverage: false,
        };
        roadMap.set(canonicalKey, acc);
      }
      if (rawName) acc.rawNameVariants.add(rawName);
      else if (rawRef) acc.rawNameVariants.add(rawRef);
      acc.highwayCategories.add(highway);
      acc.totalLengthMeters += featureTotalLengthM;
      acc.interceptedLengthMeters += featureInterceptedM;
      acc.interceptedSegmentCount += featureInterceptedSegs;
      if (featureExtendsOutside) {
        acc.extendsOutsideCoverage = true;
      }
    }

    if (featureInterceptedM > 0) {
      totalInterceptedLengthMeters += featureInterceptedM;
      interceptedSegmentCount += featureInterceptedSegs;
      interceptedFeatureCount += 1;
      lengthByCategoryGroupMeters[categoryGroup] += featureInterceptedM;
      if (canonicalKey) {
        identifiableInterceptedLengthMeters += featureInterceptedM;
      } else {
        unnamedInterceptedLengthMeters += featureInterceptedM;
      }
    }
  }

  const interceptedRoads: RoadExposureItem[] = Array.from(roadMap.values())
    .filter((acc) => acc.interceptedLengthMeters > 0)
    .map((acc) => {
      const denominatorStatus: RoadDenominatorStatus = acc.extendsOutsideCoverage
        ? "extends_outside_coverage"
        : "complete_in_coverage";
      const interceptedPercent =
        denominatorStatus === "complete_in_coverage" && acc.totalLengthMeters > 0
          ? Math.min(
              100,
              Math.max(
                0,
                (acc.interceptedLengthMeters / acc.totalLengthMeters) * 100,
              ),
            )
          : null;
      return {
        canonicalKey: acc.canonicalKey,
        displayName: acc.displayName,
        identificationSource: acc.identificationSource,
        rawNameVariants: Array.from(acc.rawNameVariants).sort(),
        highwayCategories: Array.from(acc.highwayCategories).sort(),
        totalLengthMeters: acc.totalLengthMeters,
        interceptedLengthMeters: acc.interceptedLengthMeters,
        interceptedSegmentCount: acc.interceptedSegmentCount,
        denominatorStatus,
        interceptedPercent,
      };
    })
    .sort((a, b) => b.interceptedLengthMeters - a.interceptedLengthMeters);

  const unnamedInterceptedRatio =
    totalInterceptedLengthMeters > 0
      ? unnamedInterceptedLengthMeters / totalInterceptedLengthMeters
      : 0;

  const publicUiBlockReasons: string[] = [];
  if (!licenseClearedForPublicUi) {
    publicUiBlockReasons.push(
      "Compatibilidade ODbL 1.0 (OSM) × cadastro municipal (Lei nº 4.135/2021) sem autorização formal de redistribuição combinada.",
    );
  }
  if (unnamedInterceptedRatio > maxUnnamedRatio) {
    publicUiBlockReasons.push(
      `Proporção de extensão viária sem identificação (${(unnamedInterceptedRatio * 100).toFixed(1)}%) excede o limite de qualidade (${(maxUnnamedRatio * 100).toFixed(0)}%).`,
    );
  }

  return {
    status: "valid",
    classification: "derived",
    method: SGB_ROAD_EXPOSURE_METHOD_ID,
    crs: "EPSG:4326",
    floodSource: SGB_AREA_SOURCE,
    roadSourceLicense: OSM_ROAD_LICENSE,
    roadAttribution: OSM_ROAD_ATTRIBUTION,
    levelCm,
    excludedBridgesAndTunnels: excludeBridgesAndTunnels,
    totalNetworkLengthMeters,
    totalInterceptedLengthMeters,
    totalInterceptedLengthKm: totalInterceptedLengthMeters / 1000,
    identifiableInterceptedLengthMeters,
    unnamedInterceptedLengthMeters,
    unnamedInterceptedRatio,
    identifiableRoadCount: interceptedRoads.length,
    interceptedSegmentCount,
    interceptedFeatureCount,
    lengthByCategoryGroupMeters,
    roads: interceptedRoads,
    elevatedOrSubsurfaceStructures: elevatedStructures,
    elevatedStructuresInterceptedLengthMeters,
    publicUiEligible: publicUiBlockReasons.length === 0,
    publicUiBlockReasons,
    semanticGuardrails: SEMANTIC_GUARDRAILS,
  };
}
