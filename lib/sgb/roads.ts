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
  DEFAULT_AUXILIARY_MAPSERVER_DOMAIN,
  SGB_MAPSERVER_ENVELOPE_BBOX,
  classifyPointInValidatedPolygons,
  type PointModelCoverageDomain,
} from "./location.ts";

export const SGB_ROAD_EXPOSURE_METHOD_ID = "wgs84-geodesic-line-clip-v1" as const;
export const OSM_ROAD_LICENSE = "ODbL-1.0" as const;
export const OSM_ROAD_ATTRIBUTION = "© OpenStreetMap contributors" as const;

/**
 * Provisional governance criterion (10%) for unnamed road-length share when
 * considering future promotion of nominal road metrics to the public UI.
 *
 * Scientific note: total intercepted road-axis length and nominal street
 * identification are distinct metrics. This 10% threshold is strictly a
 * provisional project governance criterion, NOT a universal scientific requirement.
 */
export const PROVISIONAL_PUBLIC_UI_UNNAMED_RATIO_CRITERION = 0.1;
export const MAX_PUBLIC_UI_UNNAMED_RATIO =
  PROVISIONAL_PUBLIC_UI_UNNAMED_RATIO_CRITERION;

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

export type RoadEnvelopeStatus =
  | "within_mapserver_envelope"
  | "extends_outside_mapserver_envelope";

export type RoadHydraulicDomainStatus =
  | "covered"
  | "outside_or_partial_model_extent"
  | "unknown";

/**
 * Denominator completeness status for per-road percentage calculations:
 * - `"complete_documented"`: road denominator explicitly documented as complete
 *   AND verified within a validated hydraulic model domain polygon.
 * - `"unverified_bbox_only"`: road lies inside the auxiliary MapServer bbox,
 *   which does NOT prove complete road denominator or full hydraulic coverage.
 * - `"extends_outside_envelope"`: road extends beyond the auxiliary MapServer
 *   envelope or validated hydraulic domain.
 */
export type RoadDenominatorStatus =
  | "complete_documented"
  | "unverified_bbox_only"
  | "extends_outside_envelope";

export type RoadExposureItem = {
  readonly canonicalKey: string;
  readonly displayName: string;
  readonly identificationSource: "name" | "ref";
  readonly rawNameVariants: readonly string[];
  readonly highwayCategories: readonly string[];
  readonly totalLengthMeters: number;
  readonly interceptedLengthMeters: number;
  readonly interceptedSegmentCount: number;
  readonly envelopeStatus: RoadEnvelopeStatus;
  readonly hydraulicDomainStatus: RoadHydraulicDomainStatus;
  readonly denominatorStatus: RoadDenominatorStatus;
  /**
   * Percentage of the road axis intercepted by the queried flood geometry.
   * Strictly `null` unless `denominatorStatus === "complete_documented"` (never
   * assumed complete merely because coordinates fall inside an auxiliary bbox).
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
  readonly totalAxisLengthDistinctFromNominalIdentification: true;
  readonly unnamedRatioCriterionIsProvisional: true;
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
      readonly hydraulicDomainKind: PointModelCoverageDomain["kind"];
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
  totalAxisLengthDistinctFromNominalIdentification: true,
  unnamedRatioCriterionIsProvisional: true,
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
  [
    /\bs\b(?=\s+(?:jose|joao|paulo|pedro|antonio|sebastiao|felix|luis|luiz|francisco))/g,
    "sao",
  ],
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
    const dLat = phi2 - phi1;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(L / 2) ** 2;
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

type Segment2D = {
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
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
 * Collects exact intersection parameters t ∈ [0, 1] of segment `seg` against
 * polygon edge `edge` (including crossings, touches, and collinear overlaps).
 */
function collectSegmentEdgeIntersectionParams(
  seg: Segment2D,
  edge: Segment2D,
  outParams: number[],
): void {
  const [ax, ay] = seg.start;
  const [bx, by] = seg.end;
  const [cx, cy] = edge.start;
  const [dx, dy] = edge.end;

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

function collectRingIntersectionsForSegment(
  seg: Segment2D,
  segBbox: BBox,
  ring: ClipRing,
  outParams: number[],
): void {
  for (let i = 0; i < ring.length - 1; i += 1) {
    const start = ring[i];
    const end = ring[i + 1];
    if (
      Math.max(start[0], end[0]) < segBbox.minLon - 1e-10 ||
      Math.min(start[0], end[0]) > segBbox.maxLon + 1e-10 ||
      Math.max(start[1], end[1]) < segBbox.minLat - 1e-10 ||
      Math.min(start[1], end[1]) > segBbox.maxLat + 1e-10
    ) {
      continue;
    }
    collectSegmentEdgeIntersectionParams(seg, { start, end }, outParams);
  }
}

function deduplicateSortedParams(params: number[]): number[] {
  params.sort((x, y) => x - y);
  const uniqueParams: number[] = [];
  for (const t of params) {
    const last = uniqueParams.at(-1);
    if (last === undefined || t - last > 1e-10) {
      uniqueParams.push(t);
    }
  }
  return uniqueParams;
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
  const seg: Segment2D = { start: a, end: b };
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
      if (bboxesOverlap(segBbox, item.ringBboxes[r])) {
        collectRingIntersectionsForSegment(seg, segBbox, item.polygon[r], params);
      }
    }
  }

  const uniqueParams = deduplicateSortedParams(params);
  const candidatePolys = candidates.map((c) => c.polygon);
  const covered: [number, number][] = [];

  for (let i = 0; i < uniqueParams.length - 1; i += 1) {
    const t0 = uniqueParams[i];
    const t1 = uniqueParams[i + 1];
    if (t1 - t0 <= 1e-10) continue;
    const tm = (t0 + t1) / 2;
    const midLon = a[0] + tm * (b[0] - a[0]);
    const midLat = a[1] + tm * (b[1] - a[1]);

    const relation = classifyPointInValidatedPolygons(
      { lat: midLat, lon: midLon },
      candidatePolys,
      1e-3,
    );

    if (relation === "inside" || relation === "boundary") {
      const prev = covered.at(-1);
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

    const lastInterval = intervals.at(-1);
    prevEndedCovered = lastInterval !== undefined && lastInterval[1] >= 1 - 1e-9;
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

function extractFeatureLineStrings(
  feature: RoadLineFeature | null | undefined,
  idx: number,
):
  | { readonly ok: true; readonly lineStrings: readonly [number, number][][] }
  | { readonly ok: false; readonly reason: string } {
  if (!feature || feature.type !== "Feature" || !feature.geometry) {
    return { ok: false, reason: `Feição viária inválida no índice ${idx}.` };
  }

  if (feature.geometry.type === "LineString") {
    const valid = validateLineStringCoords(feature.geometry.coordinates);
    if (!valid) {
      return {
        ok: false,
        reason: `LineString inválido na feição viária ${idx}.`,
      };
    }
    return { ok: true, lineStrings: [valid] };
  }

  if (feature.geometry.type === "MultiLineString") {
    if (
      !Array.isArray(feature.geometry.coordinates) ||
      feature.geometry.coordinates.length === 0
    ) {
      return {
        ok: false,
        reason: `MultiLineString vazio ou inválido na feição viária ${idx}.`,
      };
    }
    const lineStrings: [number, number][][] = [];
    for (const part of feature.geometry.coordinates) {
      const valid = validateLineStringCoords(part);
      if (!valid) {
        return {
          ok: false,
          reason: `Parte inválida em MultiLineString na feição viária ${idx}.`,
        };
      }
      lineStrings.push(valid);
    }
    return { ok: true, lineStrings };
  }

  return {
    ok: false,
    reason: `Geometria não linear encontrada na malha viária (índice ${idx}).`,
  };
}

function isPointInsideBbox(lon: number, lat: number, bbox: BBox): boolean {
  return (
    lon >= bbox.minLon &&
    lon <= bbox.maxLon &&
    lat >= bbox.minLat &&
    lat <= bbox.maxLat
  );
}

type RoadAccumulator = {
  readonly canonicalKey: string;
  readonly displayName: string;
  readonly identificationSource: "name" | "ref";
  readonly rawNameVariants: Set<string>;
  readonly highwayCategories: Set<string>;
  totalLengthMeters: number;
  interceptedLengthMeters: number;
  interceptedSegmentCount: number;
  extendsOutsideEnvelope: boolean;
  outsideValidatedDomain: boolean;
};

function resolveRoadIdentity(
  rawName: string | null,
  rawRef: string | null,
): {
  readonly canonicalKey: string;
  readonly displayName: string;
  readonly source: "name" | "ref";
} | null {
  const normName = normalizeRoadName(rawName);
  if (normName && rawName) {
    return {
      canonicalKey: `name:${normName}`,
      displayName: rawName,
      source: "name",
    };
  }
  const normRef = normalizeRoadName(rawRef);
  if (normRef && rawRef) {
    return {
      canonicalKey: `ref:${normRef}`,
      displayName: rawRef,
      source: "ref",
    };
  }
  return null;
}

function resolveRoadDenominator(
  acc: RoadAccumulator,
  hasValidatedPolygonDomain: boolean,
  documentedCompleteRoadKeys: ReadonlySet<string> | null,
): {
  readonly envelopeStatus: RoadEnvelopeStatus;
  readonly hydraulicDomainStatus: RoadHydraulicDomainStatus;
  readonly denominatorStatus: RoadDenominatorStatus;
  readonly interceptedPercent: number | null;
} {
  const envelopeStatus: RoadEnvelopeStatus = acc.extendsOutsideEnvelope
    ? "extends_outside_mapserver_envelope"
    : "within_mapserver_envelope";

  let hydraulicDomainStatus: RoadHydraulicDomainStatus;
  if (hasValidatedPolygonDomain) {
    hydraulicDomainStatus = acc.outsideValidatedDomain
      ? "outside_or_partial_model_extent"
      : "covered";
  } else if (acc.extendsOutsideEnvelope) {
    hydraulicDomainStatus = "outside_or_partial_model_extent";
  } else {
    hydraulicDomainStatus = "unknown";
  }

  let denominatorStatus: RoadDenominatorStatus;
  if (acc.extendsOutsideEnvelope || acc.outsideValidatedDomain) {
    denominatorStatus = "extends_outside_envelope";
  } else if (
    hasValidatedPolygonDomain &&
    documentedCompleteRoadKeys?.has(acc.canonicalKey)
  ) {
    denominatorStatus = "complete_documented";
  } else {
    // Being inside the MapServer auxiliary bbox NEVER proves a complete road denominator.
    denominatorStatus = "unverified_bbox_only";
  }

  const interceptedPercent =
    denominatorStatus === "complete_documented" && acc.totalLengthMeters > 0
      ? Math.min(
          100,
          Math.max(0, (acc.interceptedLengthMeters / acc.totalLengthMeters) * 100),
        )
      : null;

  return {
    envelopeStatus,
    hydraulicDomainStatus,
    denominatorStatus,
    interceptedPercent,
  };
}

function measureFeatureLines(params: {
  readonly lineStrings: readonly [number, number][][];
  readonly indexedPolygons: readonly IndexedPolygon[];
  readonly envelopeBbox: BBox;
  readonly validatedDomainPolygons: readonly ClipPolygon[] | null;
}): {
  readonly totalLengthM: number;
  readonly interceptedM: number;
  readonly interceptedSegs: number;
  readonly extendsOutsideEnvelope: boolean;
  readonly outsideValidatedDomain: boolean;
} {
  let totalLengthM = 0;
  let interceptedM = 0;
  let interceptedSegs = 0;
  let extendsOutsideEnvelope = false;
  let outsideValidatedDomain = false;

  for (const coords of params.lineStrings) {
    totalLengthM += computeGeodesicLineLengthMeters(coords);
    for (const [lon, lat] of coords) {
      if (!isPointInsideBbox(lon, lat, params.envelopeBbox)) {
        extendsOutsideEnvelope = true;
      }
      if (params.validatedDomainPolygons && !outsideValidatedDomain) {
        const rel = classifyPointInValidatedPolygons(
          { lat, lon },
          params.validatedDomainPolygons,
          1e-3,
        );
        if (rel === "outside") {
          outsideValidatedDomain = true;
        }
      }
    }
    const clipped = clipLineStringAgainstPolygons(
      coords,
      params.indexedPolygons,
    );
    interceptedM += clipped.interceptedLengthMeters;
    interceptedSegs += clipped.interceptedSubSegmentCount;
  }

  return {
    totalLengthM,
    interceptedM,
    interceptedSegs,
    extendsOutsideEnvelope,
    outsideValidatedDomain,
  };
}

function buildPublicUiBlockReasons(params: {
  readonly licenseClearedForPublicUi: boolean;
  readonly unnamedInterceptedRatio: number;
  readonly maxUnnamedRatio: number;
}): readonly string[] {
  const reasons: string[] = [];
  if (!params.licenseClearedForPublicUi) {
    reasons.push(
      "Compatibilidade ODbL 1.0 (OSM) × cadastro municipal (Lei nº 4.135/2021) sem autorização formal de redistribuição combinada.",
    );
  }
  if (params.unnamedInterceptedRatio > params.maxUnnamedRatio) {
    reasons.push(
      `Proporção de extensão viária sem identificação nominal (${(params.unnamedInterceptedRatio * 100).toFixed(1)}%) excede o critério provisório de governança (${(params.maxUnnamedRatio * 100).toFixed(0)}%).`,
    );
  }
  return reasons;
}

/**
 * Evaluates road-axis linear exposure for an OSM-style road FeatureCollection
 * against an official SGB flood scenario polygon (Polygon/MultiPolygon + holes).
 *
 * Scientific & governance safeguards (harmonized with R02-F / PR #55):
 * - Distinguishes total intercepted road-axis length from nominal street
 *   identification as separate metrics.
 * - Excludes elevated bridges (`bridge=yes`) and tunnels (`tunnel=yes`) from
 *   surface road totals by default, reporting them separately with caveats.
 * - NEVER assumes a complete road denominator merely because vertices lie inside
 *   the auxiliary MapServer bbox (`denominatorStatus: "unverified_bbox_only"` ->
 *   `interceptedPercent: null`). Per-road percentages are computed ONLY when an
 *   explicitly documented complete denominator AND a validated hydraulic domain
 *   polygon are supplied (`denominatorStatus: "complete_documented"`).
 * - Treats `PROVISIONAL_PUBLIC_UI_UNNAMED_RATIO_CRITERION` (10%) explicitly as a
 *   provisional governance criterion, not a universal scientific requirement.
 */
type RoadExposureAccumulation = {
  readonly roadMap: Map<string, RoadAccumulator>;
  readonly elevatedStructures: ElevatedStructureIntersection[];
  readonly lengthByCategoryGroupMeters: Record<RoadCategoryGroup, number>;
  totalNetworkLengthMeters: number;
  totalInterceptedLengthMeters: number;
  identifiableInterceptedLengthMeters: number;
  unnamedInterceptedLengthMeters: number;
  interceptedSegmentCount: number;
  interceptedFeatureCount: number;
  elevatedStructuresInterceptedLengthMeters: number;
};

function upsertRoadAccumulator(
  roadMap: Map<string, RoadAccumulator>,
  identity: {
    readonly canonicalKey: string;
    readonly displayName: string;
    readonly source: "name" | "ref";
  },
): RoadAccumulator {
  const existing = roadMap.get(identity.canonicalKey);
  if (existing) return existing;
  const created: RoadAccumulator = {
    canonicalKey: identity.canonicalKey,
    displayName: identity.displayName,
    identificationSource: identity.source,
    rawNameVariants: new Set<string>(),
    highwayCategories: new Set<string>(),
    totalLengthMeters: 0,
    interceptedLengthMeters: 0,
    interceptedSegmentCount: 0,
    extendsOutsideEnvelope: false,
    outsideValidatedDomain: false,
  };
  roadMap.set(identity.canonicalKey, created);
  return created;
}

function readOptionalTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function accumulateMeasuredFeature(params: {
  readonly state: RoadExposureAccumulation;
  readonly feature: RoadLineFeature;
  readonly idx: number;
  readonly measured: ReturnType<typeof measureFeatureLines>;
  readonly excludeBridgesAndTunnels: boolean;
}): void {
  const { state, feature, idx, measured, excludeBridgesAndTunnels } = params;
  const props = feature.properties ?? {};
  const highway = readOptionalTrimmedString(props.highway) ?? "unknown";
  const categoryGroup = classifyHighwayCategory(highway);
  const isBridge = isTruthyOsmStructureTag(props.bridge);
  const isTunnel = isTruthyOsmStructureTag(props.tunnel);
  const rawName = readOptionalTrimmedString(props.name);
  const rawRef = readOptionalTrimmedString(props.ref);

  if (excludeBridgesAndTunnels && (isBridge || isTunnel)) {
    if (measured.interceptedM > 0) {
      state.elevatedStructuresInterceptedLengthMeters += measured.interceptedM;
      state.elevatedStructures.push({
        id: String(props.osmId ?? props.id ?? feature.id ?? `way_${idx}`),
        name: rawName,
        ref: rawRef,
        highway,
        structureType: isBridge ? "bridge" : "tunnel",
        interceptedLengthMeters: measured.interceptedM,
      });
    }
    return;
  }

  state.totalNetworkLengthMeters += measured.totalLengthM;

  const identity = resolveRoadIdentity(rawName, rawRef);
  if (identity) {
    const acc = upsertRoadAccumulator(state.roadMap, identity);
    acc.rawNameVariants.add(rawName ?? rawRef ?? identity.displayName);
    acc.highwayCategories.add(highway);
    acc.totalLengthMeters += measured.totalLengthM;
    acc.interceptedLengthMeters += measured.interceptedM;
    acc.interceptedSegmentCount += measured.interceptedSegs;
    acc.extendsOutsideEnvelope ||= measured.extendsOutsideEnvelope;
    acc.outsideValidatedDomain ||= measured.outsideValidatedDomain;
  }

  if (measured.interceptedM <= 0) return;

  state.totalInterceptedLengthMeters += measured.interceptedM;
  state.interceptedSegmentCount += measured.interceptedSegs;
  state.interceptedFeatureCount += 1;
  state.lengthByCategoryGroupMeters[categoryGroup] += measured.interceptedM;
  if (identity) {
    state.identifiableInterceptedLengthMeters += measured.interceptedM;
  } else {
    state.unnamedInterceptedLengthMeters += measured.interceptedM;
  }
}

export function evaluateRoadExposure(
  roadNetwork: RoadNetworkInput | null | undefined,
  floodInput: FloodAreaInput | null | undefined,
  levelCm: number,
  options: {
    readonly excludeBridgesAndTunnels?: boolean;
    readonly coverageDomain?: PointModelCoverageDomain;
    readonly documentedCompleteRoadKeys?: ReadonlySet<string> | null;
    readonly licenseClearedForPublicUi?: boolean;
    readonly maxPublicUiUnnamedRatio?: number;
  } = {},
): RoadExposureResult {
  const excludeBridgesAndTunnels = options.excludeBridgesAndTunnels ?? true;
  const coverageDomain =
    options.coverageDomain ?? DEFAULT_AUXILIARY_MAPSERVER_DOMAIN;
  const documentedCompleteRoadKeys = options.documentedCompleteRoadKeys ?? null;
  const licenseClearedForPublicUi = options.licenseClearedForPublicUi ?? false;
  const maxUnnamedRatio =
    options.maxPublicUiUnnamedRatio ??
    PROVISIONAL_PUBLIC_UI_UNNAMED_RATIO_CRITERION;

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
    roadNetwork?.type !== "FeatureCollection" ||
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

  let validatedDomainPolygons: readonly ClipPolygon[] | null = null;
  if (coverageDomain.kind === "polygon") {
    const extractedDomain = extractValidatedPolygons(coverageDomain.geometry);
    if (extractedDomain.status !== "valid") {
      return fail(
        "invalid",
        `Domínio hidráulico de cobertura inválido: ${extractedDomain.reason}`,
      );
    }
    validatedDomainPolygons = extractedDomain.polygons;
  }

  const envelopeBbox: BBox =
    coverageDomain.kind === "bbox"
      ? coverageDomain.bbox
      : SGB_MAPSERVER_ENVELOPE_BBOX;
  const indexedPolygons = indexPolygons(extractedFlood.polygons);

  const state: RoadExposureAccumulation = {
    roadMap: new Map<string, RoadAccumulator>(),
    elevatedStructures: [],
    lengthByCategoryGroupMeters: {
      arterial: 0,
      local_vehicular: 0,
      service_access: 0,
      pedestrian: 0,
      other: 0,
    },
    totalNetworkLengthMeters: 0,
    totalInterceptedLengthMeters: 0,
    identifiableInterceptedLengthMeters: 0,
    unnamedInterceptedLengthMeters: 0,
    interceptedSegmentCount: 0,
    interceptedFeatureCount: 0,
    elevatedStructuresInterceptedLengthMeters: 0,
  };

  for (let idx = 0; idx < roadNetwork.features.length; idx += 1) {
    const feature = roadNetwork.features[idx];
    const parsedLines = extractFeatureLineStrings(feature, idx);
    if (!parsedLines.ok) {
      return fail("invalid", parsedLines.reason);
    }
    const measured = measureFeatureLines({
      lineStrings: parsedLines.lineStrings,
      indexedPolygons,
      envelopeBbox,
      validatedDomainPolygons,
    });
    accumulateMeasuredFeature({
      state,
      feature,
      idx,
      measured,
      excludeBridgesAndTunnels,
    });
  }

  const hasValidatedPolygonDomain = validatedDomainPolygons !== null;
  const interceptedRoads: RoadExposureItem[] = Array.from(
    state.roadMap.values(),
  )
    .filter((acc) => acc.interceptedLengthMeters > 0)
    .map((acc) => {
      const denom = resolveRoadDenominator(
        acc,
        hasValidatedPolygonDomain,
        documentedCompleteRoadKeys,
      );
      return {
        canonicalKey: acc.canonicalKey,
        displayName: acc.displayName,
        identificationSource: acc.identificationSource,
        rawNameVariants: Array.from(acc.rawNameVariants).sort((a, b) =>
          a.localeCompare(b, "pt-BR"),
        ),
        highwayCategories: Array.from(acc.highwayCategories).sort((a, b) =>
          a.localeCompare(b, "en"),
        ),
        totalLengthMeters: acc.totalLengthMeters,
        interceptedLengthMeters: acc.interceptedLengthMeters,
        interceptedSegmentCount: acc.interceptedSegmentCount,
        envelopeStatus: denom.envelopeStatus,
        hydraulicDomainStatus: denom.hydraulicDomainStatus,
        denominatorStatus: denom.denominatorStatus,
        interceptedPercent: denom.interceptedPercent,
      };
    })
    .sort((a, b) => b.interceptedLengthMeters - a.interceptedLengthMeters);

  const unnamedInterceptedRatio =
    state.totalInterceptedLengthMeters > 0
      ? state.unnamedInterceptedLengthMeters /
        state.totalInterceptedLengthMeters
      : 0;

  const publicUiBlockReasons = buildPublicUiBlockReasons({
    licenseClearedForPublicUi,
    unnamedInterceptedRatio,
    maxUnnamedRatio,
  });

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
    hydraulicDomainKind: coverageDomain.kind,
    totalNetworkLengthMeters: state.totalNetworkLengthMeters,
    totalInterceptedLengthMeters: state.totalInterceptedLengthMeters,
    totalInterceptedLengthKm: state.totalInterceptedLengthMeters / 1000,
    identifiableInterceptedLengthMeters:
      state.identifiableInterceptedLengthMeters,
    unnamedInterceptedLengthMeters: state.unnamedInterceptedLengthMeters,
    unnamedInterceptedRatio,
    identifiableRoadCount: interceptedRoads.length,
    interceptedSegmentCount: state.interceptedSegmentCount,
    interceptedFeatureCount: state.interceptedFeatureCount,
    lengthByCategoryGroupMeters: state.lengthByCategoryGroupMeters,
    roads: interceptedRoads,
    elevatedOrSubsurfaceStructures: state.elevatedStructures,
    elevatedStructuresInterceptedLengthMeters:
      state.elevatedStructuresInterceptedLengthMeters,
    publicUiEligible: publicUiBlockReasons.length === 0,
    publicUiBlockReasons,
    semanticGuardrails: SEMANTIC_GUARDRAILS,
  };
}
