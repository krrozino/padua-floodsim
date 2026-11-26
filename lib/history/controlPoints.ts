import type { FloodAreaInput } from "../sgb/area.ts";
import {
  DEFAULT_AUXILIARY_MAPSERVER_DOMAIN,
  evaluatePointAgainstFloodScenario,
  type PointModelCoverageDomain,
} from "../sgb/location.ts";
import { resolveHistoricalMapAssociation } from "./analysis.ts";
import type {
  ControlPointEvidenceState,
  HistoricalControlPoint,
  HistoricalFloodEvent,
} from "./contract.ts";
import rawControlPoints from "./data/controlPoints.json" with { type: "json" };

export const HISTORICAL_CONTROL_POINTS: readonly HistoricalControlPoint[] =
  rawControlPoints.controlPoints as unknown as readonly HistoricalControlPoint[];

export type ControlPointValidationOutcome =
  | "true_positive"
  | "false_positive"
  | "false_negative"
  | "true_negative"
  | "indeterminate_boundary_proximity"
  | "unknown_field_evidence"
  | "unverified_coordinates"
  | "incompatible_temporal_or_stage_reference"
  | "unverified_hydraulic_domain"
  | "scenario_unavailable";

export type ControlPointScenarioEvaluationItem = {
  readonly controlPointId: string;
  readonly controlPointName: string;
  readonly fieldState: ControlPointEvidenceState;
  readonly spatialRelation:
    | "inside"
    | "boundary"
    | "outside"
    | "unavailable"
    | "not_geocoded";
  readonly outcome: ControlPointValidationOutcome;
};

export type ControlPointScenarioValidationSummary = {
  readonly eventId: string;
  readonly levelCm: number;
  readonly items: readonly ControlPointScenarioEvaluationItem[];
  readonly counts: {
    readonly truePositive: number;
    readonly falsePositive: number;
    readonly falseNegative: number;
    readonly trueNegative: number;
    readonly indeterminateBoundaryProximity: number;
    readonly unknownFieldEvidence: number;
    readonly unverifiedCoordinates: number;
    readonly incompatibleTemporalOrStageReference: number;
    readonly unverifiedHydraulicDomain: number;
    readonly scenarioUnavailable: number;
  };
};

export type ControlPointsCatalogReadiness = {
  readonly totalControlPoints: number;
  readonly verifiedCoordinatesCount: number;
  readonly documentedKnownStateRecordsCount: number;
  readonly usableCoordinateAndKnownStatePairs: number;
};

/**
 * Audits how many (controlPoint, eventRecord) pairs currently possess BOTH
 * a cartographically verified coordinate AND a documented flood state
 * (`water_present` or `water_absent`) backed by at least one source.
 * Currently `0` in the public catalog — preventing premature spatial skill claims.
 */
export function summarizeControlPointsReadiness(
  controlPoints: readonly HistoricalControlPoint[] = HISTORICAL_CONTROL_POINTS,
): ControlPointsCatalogReadiness {
  let verifiedCoordinatesCount = 0;
  let documentedKnownStateRecordsCount = 0;
  let usableCoordinateAndKnownStatePairs = 0;

  for (const cp of controlPoints) {
    const hasAuditedCoord =
      cp.coordinateStatus === "verified_cartographic" &&
      cp.coordinatesWgs84 !== null;
    if (hasAuditedCoord) {
      verifiedCoordinatesCount += 1;
    }
    for (const rec of cp.eventRecords) {
      const hasKnownState =
        (rec.state === "water_present" || rec.state === "water_absent") &&
        rec.sourceIds.length > 0;
      if (hasKnownState) {
        documentedKnownStateRecordsCount += 1;
        if (hasAuditedCoord) {
          usableCoordinateAndKnownStatePairs += 1;
        }
      }
    }
  }

  return {
    totalControlPoints: controlPoints.length,
    verifiedCoordinatesCount,
    documentedKnownStateRecordsCount,
    usableCoordinateAndKnownStatePairs,
  };
}

export type EvaluateControlPointsOptions = {
  readonly event: HistoricalFloodEvent | null | undefined;
  readonly scenarioGeojson: FloodAreaInput | null | undefined;
  readonly levelCm: number;
  readonly coverageDomain?: PointModelCoverageDomain;
  readonly maxStageCompatibilityDiffCm?: number;
  readonly controlPoints?: readonly HistoricalControlPoint[];
};

function isTemporalAndStageCompatible(
  event: HistoricalFloodEvent | null | undefined,
  levelCm: number,
  maxStageDiffCm: number,
): boolean {
  if (!event) return false;
  const assoc = resolveHistoricalMapAssociation(event);
  if (assoc.status !== "compatible") {
    return false;
  }
  return Math.abs(assoc.observedPeakCm - levelCm) <= maxStageDiffCm;
}

function classifyStrictInteriorExteriorOutcome(
  relation: "inside" | "outside",
  fieldWet: boolean,
): "true_positive" | "false_positive" | "false_negative" | "true_negative" {
  const modelWet = relation === "inside";
  if (modelWet && fieldWet) return "true_positive";
  if (modelWet) return "false_positive";
  if (fieldWet) return "false_negative";
  return "true_negative";
}

type SingleCpContext = {
  readonly eventId: string;
  readonly temporalAndStageCompatible: boolean;
  readonly scenarioGeojson: FloodAreaInput | null | undefined;
  readonly levelCm: number;
  readonly coverageDomain: PointModelCoverageDomain;
};

function evaluateSingleControlPoint(
  cp: HistoricalControlPoint,
  ctx: SingleCpContext,
): ControlPointScenarioEvaluationItem {
  const record = cp.eventRecords.find((r) => r.eventId === ctx.eventId);
  const fieldState: ControlPointEvidenceState = record?.state ?? "unknown";
  const hasKnownDocumentedState = Boolean(
    record &&
      (record.state === "water_present" || record.state === "water_absent") &&
      record.sourceIds.length > 0,
  );

  // Gate 1: Audited coordinate required
  if (
    cp.coordinateStatus !== "verified_cartographic" ||
    !cp.coordinatesWgs84
  ) {
    return {
      controlPointId: cp.id,
      controlPointName: cp.name,
      fieldState,
      spatialRelation: "not_geocoded",
      outcome: "unverified_coordinates",
    };
  }

  // Gate 2: Valid scenario geometry required
  const query = evaluatePointAgainstFloodScenario(
    cp.coordinatesWgs84,
    ctx.scenarioGeojson,
    ctx.levelCm,
    { coverageDomain: ctx.coverageDomain },
  );

  if (query.status !== "valid") {
    return {
      controlPointId: cp.id,
      controlPointName: cp.name,
      fieldState,
      spatialRelation: "unavailable",
      outcome: "scenario_unavailable",
    };
  }

  // Gate 3: Adequate validated hydraulic domain polygon required
  if (
    ctx.coverageDomain.kind !== "polygon" ||
    query.hydraulicDomainStatus !== "covered"
  ) {
    return {
      controlPointId: cp.id,
      controlPointName: cp.name,
      fieldState,
      spatialRelation: query.relation,
      outcome: "unverified_hydraulic_domain",
    };
  }

  // Gate 4: Temporal, vertical-datum, and stage compatibility required
  if (!ctx.temporalAndStageCompatible) {
    return {
      controlPointId: cp.id,
      controlPointName: cp.name,
      fieldState,
      spatialRelation: query.relation,
      outcome: "incompatible_temporal_or_stage_reference",
    };
  }

  // Gate 5: Documented known flood state required
  if (!hasKnownDocumentedState) {
    return {
      controlPointId: cp.id,
      controlPointName: cp.name,
      fieldState,
      spatialRelation: query.relation,
      outcome: "unknown_field_evidence",
    };
  }

  // Gate 6: ±0.5 m geometric boundary proximity band is indeterminate (never TP/FP/FN/TN)
  if (query.relation === "boundary") {
    return {
      controlPointId: cp.id,
      controlPointName: cp.name,
      fieldState,
      spatialRelation: "boundary",
      outcome: "indeterminate_boundary_proximity",
    };
  }

  return {
    controlPointId: cp.id,
    controlPointName: cp.name,
    fieldState,
    spatialRelation: query.relation,
    outcome: classifyStrictInteriorExteriorOutcome(
      query.relation,
      fieldState === "water_present",
    ),
  };
}

/**
 * Evaluates control points against a scenario strictly enforcing all 6 scientific
 * gates before producing any `TP / FP / FN / TN` classification:
 * 1. Audited coordinate (`verified_cartographic` + non-null WGS84);
 * 2. Valid scenario geometry;
 * 3. Explicit validated hydraulic domain polygon (`hydraulicDomainStatus === "covered"`);
 * 4. Verified temporal, vertical-datum, and stage compatibility (`maxStageCompatibilityDiffCm`, default `0`);
 * 5. Documented flood state (`water_present` or `water_absent` with `sourceIds`);
 * 6. Boundary proximity band (`relation === "boundary"`) treated as `"indeterminate_boundary_proximity"`.
 *
 * Never computes or publishes aggregate spatial skill metrics (IoU, F1, precision, recall).
 */
export function evaluateControlPointsForEventScenario(
  options: EvaluateControlPointsOptions,
): ControlPointScenarioValidationSummary {
  const {
    event,
    scenarioGeojson,
    levelCm,
    coverageDomain = DEFAULT_AUXILIARY_MAPSERVER_DOMAIN,
    maxStageCompatibilityDiffCm = 0,
    controlPoints = HISTORICAL_CONTROL_POINTS,
  } = options;

  const eventId = event?.id ?? "unknown_event";
  const temporalAndStageCompatible = isTemporalAndStageCompatible(
    event,
    levelCm,
    maxStageCompatibilityDiffCm,
  );

  const ctx: SingleCpContext = {
    eventId,
    temporalAndStageCompatible,
    scenarioGeojson,
    levelCm,
    coverageDomain,
  };

  const items = controlPoints.map((cp) => evaluateSingleControlPoint(cp, ctx));

  const tally: Record<ControlPointValidationOutcome, number> = {
    true_positive: 0,
    false_positive: 0,
    false_negative: 0,
    true_negative: 0,
    indeterminate_boundary_proximity: 0,
    unknown_field_evidence: 0,
    unverified_coordinates: 0,
    incompatible_temporal_or_stage_reference: 0,
    unverified_hydraulic_domain: 0,
    scenario_unavailable: 0,
  };

  for (const item of items) {
    tally[item.outcome] += 1;
  }

  return {
    eventId,
    levelCm,
    items,
    counts: {
      truePositive: tally.true_positive,
      falsePositive: tally.false_positive,
      falseNegative: tally.false_negative,
      trueNegative: tally.true_negative,
      indeterminateBoundaryProximity: tally.indeterminate_boundary_proximity,
      unknownFieldEvidence: tally.unknown_field_evidence,
      unverifiedCoordinates: tally.unverified_coordinates,
      incompatibleTemporalOrStageReference:
        tally.incompatible_temporal_or_stage_reference,
      unverifiedHydraulicDomain: tally.unverified_hydraulic_domain,
      scenarioUnavailable: tally.scenario_unavailable,
    },
  };
}
