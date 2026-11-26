import type { FloodAreaInput } from "../sgb/area.ts";
import { evaluatePointAgainstFloodScenario } from "../sgb/location.ts";
import type {
  ControlPointEvidenceState,
  HistoricalControlPoint,
} from "./contract.ts";
import rawControlPoints from "./data/controlPoints.json" with { type: "json" };

export const HISTORICAL_CONTROL_POINTS: readonly HistoricalControlPoint[] =
  rawControlPoints.controlPoints as unknown as readonly HistoricalControlPoint[];

export type ControlPointValidationOutcome =
  | "true_positive"
  | "false_positive"
  | "false_negative"
  | "true_negative"
  | "unknown_field_evidence"
  | "unverified_coordinates"
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
    readonly unknownFieldEvidence: number;
    readonly unverifiedCoordinates: number;
    readonly scenarioUnavailable: number;
  };
};

function classifyWetDryOutcome(
  modelWet: boolean,
  fieldWet: boolean,
): "true_positive" | "false_positive" | "false_negative" | "true_negative" {
  if (modelWet && fieldWet) return "true_positive";
  if (modelWet) return "false_positive";
  if (fieldWet) return "false_negative";
  return "true_negative";
}

function evaluateSingleControlPoint(
  cp: HistoricalControlPoint,
  eventId: string,
  scenarioGeojson: FloodAreaInput | null | undefined,
  levelCm: number,
): ControlPointScenarioEvaluationItem {
  const record = cp.eventRecords.find((r) => r.eventId === eventId);
  const fieldState: ControlPointEvidenceState = record?.state ?? "unknown";

  if (!cp.coordinatesWgs84) {
    return {
      controlPointId: cp.id,
      controlPointName: cp.name,
      fieldState,
      spatialRelation: "not_geocoded",
      outcome: "unverified_coordinates",
    };
  }

  const query = evaluatePointAgainstFloodScenario(
    cp.coordinatesWgs84,
    scenarioGeojson,
    levelCm,
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

  if (fieldState === "unknown") {
    return {
      controlPointId: cp.id,
      controlPointName: cp.name,
      fieldState,
      spatialRelation: query.relation,
      outcome: "unknown_field_evidence",
    };
  }

  return {
    controlPointId: cp.id,
    controlPointName: cp.name,
    fieldState,
    spatialRelation: query.relation,
    outcome: classifyWetDryOutcome(
      query.isIntercepted,
      fieldState === "water_present",
    ),
  };
}

export function evaluateControlPointsForEventScenario(
  eventId: string,
  scenarioGeojson: FloodAreaInput | null | undefined,
  levelCm: number,
  controlPoints: readonly HistoricalControlPoint[] = HISTORICAL_CONTROL_POINTS,
): ControlPointScenarioValidationSummary {
  const items = controlPoints.map((cp) =>
    evaluateSingleControlPoint(cp, eventId, scenarioGeojson, levelCm),
  );

  const tally: Record<ControlPointValidationOutcome, number> = {
    true_positive: 0,
    false_positive: 0,
    false_negative: 0,
    true_negative: 0,
    unknown_field_evidence: 0,
    unverified_coordinates: 0,
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
      unknownFieldEvidence: tally.unknown_field_evidence,
      unverifiedCoordinates: tally.unverified_coordinates,
      scenarioUnavailable: tally.scenario_unavailable,
    },
  };
}
