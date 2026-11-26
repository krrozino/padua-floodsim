import type { GeoPoint } from "../sgb/location.ts";
import type { SgbFloodLevelCm } from "../sgb/stages.ts";

/**
 * Canonical information classes enforced by AGENTS.md and OBSERVATION_CONTRACT.md.
 * Public historical modules never expose `mock` data.
 */
export type HistoricalInformationClass =
  | "observed"
  | "processed"
  | "official_reference"
  | "derived";

/**
 * Independent hydrological station identifiers audited for the Rio Pomba basin.
 * Never merge or apply arbitrary offsets across these identifiers.
 */
export type HistoricalStationId =
  | "RHN-58790002"
  | "INEA-213042120"
  | "RHN-58788600"
  | "RHN-58770000"
  | "INEA-58789000";

export type StageDisplayUnit = "cm" | "m";

export type StationThresholdDefinition = {
  readonly id: string;
  readonly label: string;
  readonly stageCm: number;
  readonly nativeDisplayLabel: string;
  readonly source: string;
};

export type HistoricalStationReference = {
  readonly id: HistoricalStationId;
  readonly shortName: string;
  readonly officialName: string;
  readonly codesLabel: string;
  readonly institution: string;
  readonly operator: string;
  readonly river: string;
  readonly roleLabel: string;
  readonly nativeStageUnit: StageDisplayUnit;
  readonly nominalCadenceMinutes: number | null;
  readonly drainageAreaKm2: number | null;
  readonly gaugeZeroMeters: number | null;
  readonly gaugeZeroStatusNote: string;
  readonly verticalDatum: string | null;
  readonly verticalDatumStatus: "confirmed" | "unconfirmed" | "not_applicable";
  readonly coordinatesWgs84: GeoPoint | null;
  readonly coordinateStatusNote: string;
  readonly thresholds: readonly StationThresholdDefinition[];
  readonly sgbCrosswalkValidated: boolean;
  readonly independenceConstraintNote: string;
  readonly historicalAuditStatus:
    | "audited_primary_target"
    | "audited_independent_local"
    | "audited_upstream"
    | "inventory_only_not_audited";
  readonly officialUrl: string;
};

export type OriginalTimezoneKind =
  | "UTC"
  | "GMT"
  | "BRT_UTC_MINUS_3"
  | "LOCAL_AMBIGUOUS_BRST_OR_BRT"
  | "DATE_ONLY_BRT";

export type HistoricalTimestampRecord = {
  readonly originalTimestamp: string;
  readonly originalTimezone: OriginalTimezoneKind;
  readonly utcIso: string | null;
  readonly displayBrt: string;
  readonly hasDstAmbiguity: boolean;
  readonly hasExcelSerialRoundingNote: boolean;
  readonly conversionNote: string | null;
};

export type SecondaryPeakReport = {
  readonly valueCm: number;
  readonly nativeLabel: string;
  readonly sourceTitle: string;
  readonly informationClass: HistoricalInformationClass;
  readonly isSecondaryPressOrBulletin: boolean;
  readonly note: string;
};

export type StationThresholdDuration = {
  readonly thresholdLabel: string;
  readonly thresholdNativeValue: string;
  readonly hoursAbove: number;
  readonly sourceLabel: string;
  readonly includesMergedGaps: boolean;
  readonly note: string | null;
};

export type HistoricalSeriesAvailability =
  | "available_authorized"
  | "blocked_local_data"
  | "blocked_authorization"
  | "unavailable_source_gap";

export type StationEventAvailability =
  | "verified_telemetry"
  | "verified_documentary_peak"
  | "unavailable_critical_gap"
  | "suspect_flatline"
  | "partial_coverage_unusable"
  | "not_audited_for_period";

export type StationEventObservation = {
  readonly stationId: HistoricalStationId;
  readonly informationClass: HistoricalInformationClass;
  readonly availability: StationEventAvailability;
  readonly usableForComparison: boolean;
  readonly datumContinuityVerified: boolean;
  readonly peakStageCm: number | null;
  readonly rawPeakValue: number | null;
  readonly rawPeakUnit: StageDisplayUnit;
  readonly secondaryPeaks: readonly SecondaryPeakReport[];
  readonly peakTimestamp: HistoricalTimestampRecord | null;
  readonly peakDischargeM3s: number | null;
  readonly dischargeNote: string | null;
  readonly accumulatedRainMm: number | null;
  readonly rainStationLabel: string | null;
  readonly rainWindowNote: string | null;
  readonly thresholdDurations: readonly StationThresholdDuration[];
  readonly coveragePct: number | null;
  readonly qualitySummary: string;
  readonly gapsAndInconsistencies: readonly string[];
  readonly verticalReferenceLabel: string;
  readonly seriesAvailability: HistoricalSeriesAvailability;
  readonly seriesAvailabilityNote: string;
  readonly provenanceIds: readonly string[];
};

export type ProvenanceArtifact = {
  readonly id: string;
  readonly title: string;
  readonly institution: string;
  readonly url: string;
  readonly sha256: string | null;
  readonly sizeBytes: number | null;
  readonly versionOrDate: string;
  readonly informationClass: HistoricalInformationClass;
  readonly accessStatus:
    | "verified_public"
    | "verified_repo_manifest"
    | "blocked_local_data"
    | "timeout_in_cloud";
  readonly usageAndRedistribution: string;
};

export type ExternalPhotoAttribution = {
  readonly photographerOrCredit: string;
  readonly captureOrPublicationDate: string;
  readonly verifiedLocation: string;
  readonly usageRights: string;
  readonly externalOnlyReason: string;
};

export type DocumentaryEvidenceKind =
  | "municipal_decree"
  | "technical_report"
  | "civil_defense_record"
  | "academic_study"
  | "press_report"
  | "external_photograph";

export type DocumentaryFloodEvidence = {
  readonly id: string;
  readonly kind: DocumentaryEvidenceKind;
  readonly title: string;
  readonly authorOrInstitution: string;
  readonly publishedDate: string;
  readonly url: string;
  readonly sha256: string | null;
  readonly locationDescription: string | null;
  readonly summary: string;
  readonly usageRights: string;
  readonly photoAttribution: ExternalPhotoAttribution | null;
};

/**
 * Explicit separation between hydrological threshold exceedance on a gauge and
 * confirmed urban flooding documented by official/field sources.
 */
export type HistoricalEventClassification =
  | "documented_urban_flood"
  | "elevated_hydrological_event";

/**
 * Spatial representation categories mandated by Section 7 (Mapa Histórico):
 * - `observed_flood_extent`: inundação observada (georreferenciada em campo/sensoriamento)
 * - `official_modeled_extent`: extensão oficial modelada (cota exata publicada pelo SGB)
 * - `derived_representation`: representação derivada (ex.: comparação topológica A×B entre cotas SGB adjacentes, sem interpolar mancha)
 * - `approximate_reference_scenario`: cenário aproximado (cota discreta SGB mais próxima em estação/datum compatíveis)
 * - `blocked_incompatible_reference`: associação espacial bloqueada por incompatibilidade de estação, datum ou faixa de cotas
 */
export type HistoricalSpatialRepresentationKind =
  | "observed_flood_extent"
  | "official_modeled_extent"
  | "derived_representation"
  | "approximate_reference_scenario"
  | "blocked_incompatible_reference";

export type HistoricalFloodEvent = {
  readonly id: string;
  readonly candidateEventId: string | null;
  readonly title: string;
  readonly periodLabel: string;
  readonly year: number;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly windowTimestampNote: string;
  readonly classification: HistoricalEventClassification;
  readonly classificationRationale: string;
  readonly primaryStationId: HistoricalStationId;
  readonly summary: string;
  readonly hydrologicalContext: string;
  readonly urbanImpactSummary: string | null;
  readonly stationObservations: readonly StationEventObservation[];
  readonly documentaryEvidence: readonly DocumentaryFloodEvidence[];
  readonly keyDivergencesAndCaveats: readonly string[];
  readonly controlPointIds: readonly string[];
};

export type HistoricalMapAssociation =
  | {
      readonly status: "compatible";
      readonly eventId: string;
      readonly eventTitle: string;
      readonly eventPeriodLabel: string;
      readonly stationId: "RHN-58790002";
      readonly verticalDatum: "hgeoHNOR_IMBITUBA";
      readonly observedPeakCm: number;
      readonly isExactSgbStage: boolean;
      readonly primaryRepresentationKind:
        | "official_modeled_extent"
        | "approximate_reference_scenario";
      readonly recommendedSingleStageCm: SgbFloodLevelCm;
      readonly stageOffsetFromPeakCm: number;
      readonly bracketingCompareStagesCm: readonly [
        SgbFloodLevelCm,
        SgbFloodLevelCm,
      ] | null;
      readonly observedExtentAvailable: false;
      readonly taxonomyNotes: {
        readonly observedFloodExtent: string;
        readonly officialModeledExtent: string;
        readonly derivedRepresentation: string;
        readonly approximateScenario: string;
      };
      readonly nonExactWarning: string;
    }
  | {
      readonly status: "blocked";
      readonly eventId: string;
      readonly representationKind: "blocked_incompatible_reference";
      readonly observedExtentAvailable: false;
      readonly reason: string;
      readonly taxonomyNotes: {
        readonly observedFloodExtent: string;
        readonly officialModeledExtent: string;
        readonly derivedRepresentation: string;
        readonly approximateScenario: string;
      };
    };

export type ControlPointCategory =
  | "urban_square"
  | "fluvial_island"
  | "marginal_avenue"
  | "bridge_or_footbridge"
  | "critical_facility"
  | "tributary_urban_area";

export type ControlPointEvidenceState =
  | "water_present"
  | "water_absent"
  | "unknown";

export type ControlPointEventRecord = {
  readonly eventId: string;
  readonly state: ControlPointEvidenceState;
  readonly evidenceSummary: string;
  readonly sourceIds: readonly string[];
};

export type HistoricalControlPoint = {
  readonly id: string;
  readonly name: string;
  readonly category: ControlPointCategory;
  readonly neighborhoodOrSector: string;
  readonly coordinatesWgs84: GeoPoint | null;
  readonly coordinateStatus: "verified_cartographic" | "unverified_kept_null";
  readonly coordinateProvenance: string;
  readonly featureGeometryNote: string;
  readonly sgbReferenceBehaviorNote: string;
  readonly validationUsageNote: string;
  readonly eventRecords: readonly ControlPointEventRecord[];
};
