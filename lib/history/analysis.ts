import {
  SGB_FLOOD_LEVELS_CM,
  type SgbFloodLevelCm,
} from "../sgb/stages.ts";
import { getStationReferenceById } from "./catalog.ts";
import type {
  HistoricalEventClassification,
  HistoricalFloodEvent,
  HistoricalMapAssociation,
  HistoricalStationId,
  StationEventObservation,
  StationThresholdDuration,
} from "./contract.ts";
import { formatTrimmedDecimalPtBr } from "./normalize.ts";

export type HistoricalSortOrder = "newest_first" | "oldest_first";

export type HistoricalEventFilters = {
  readonly year: number | "all";
  readonly stationId: HistoricalStationId | "all";
  readonly classification: HistoricalEventClassification | "all";
  readonly sortOrder: HistoricalSortOrder;
};

export const DEFAULT_HISTORICAL_FILTERS: HistoricalEventFilters = {
  year: "all",
  stationId: "all",
  classification: "all",
  sortOrder: "newest_first",
};

export function findStationObservation(
  event: HistoricalFloodEvent,
  stationId: HistoricalStationId,
): StationEventObservation | undefined {
  return event.stationObservations.find((obs) => obs.stationId === stationId);
}

/**
 * Checks whether an event includes a verified hydrological peak for a station
 * (used when filtering by station so users see events measured on that gauge).
 */
export function hasVerifiedStationMeasurement(
  event: HistoricalFloodEvent,
  stationId: HistoricalStationId,
): boolean {
  const obs = findStationObservation(event, stationId);
  if (typeof obs?.peakStageCm !== "number" || !Number.isFinite(obs.peakStageCm)) {
    return false;
  }
  return (
    obs.availability === "verified_telemetry" ||
    obs.availability === "verified_documentary_peak"
  );
}

export function extractAvailableYears(
  events: readonly HistoricalFloodEvent[],
): readonly number[] {
  const uniqueYears = Array.from(new Set(events.map((ev) => ev.year)));
  return uniqueYears.sort((a, b) => b - a);
}

function matchesEventFilters(
  event: HistoricalFloodEvent,
  filters: HistoricalEventFilters,
): boolean {
  if (filters.year !== "all" && event.year !== filters.year) {
    return false;
  }
  if (
    filters.classification !== "all" &&
    event.classification !== filters.classification
  ) {
    return false;
  }
  if (
    filters.stationId !== "all" &&
    !hasVerifiedStationMeasurement(event, filters.stationId)
  ) {
    return false;
  }
  return true;
}

function compareEventStartDates(
  a: HistoricalFloodEvent,
  b: HistoricalFloodEvent,
  sortOrder: HistoricalSortOrder,
): number {
  const cmp = a.startDateIso.localeCompare(b.startDateIso);
  if (cmp !== 0) {
    return sortOrder === "oldest_first" ? cmp : -cmp;
  }
  return sortOrder === "oldest_first"
    ? a.id.localeCompare(b.id)
    : b.id.localeCompare(a.id);
}

export function filterAndSortHistoricalEvents(
  events: readonly HistoricalFloodEvent[],
  filters: HistoricalEventFilters = DEFAULT_HISTORICAL_FILTERS,
): readonly HistoricalFloodEvent[] {
  return events
    .filter((ev) => matchesEventFilters(ev, filters))
    .sort((a, b) => compareEventStartDates(a, b, filters.sortOrder));
}

export type CompatibleEventComparisonResult =
  | {
      readonly status: "compatible";
      readonly stationId: HistoricalStationId;
      readonly stationLabel: string;
      readonly verticalReferenceLabel: string;
      readonly eventAId: string;
      readonly eventBId: string;
      readonly peakACm: number;
      readonly peakBCm: number;
      readonly deltaPeakCm: number;
      readonly rawUnit: "cm" | "m";
      readonly rawPeakA: number;
      readonly rawPeakB: number;
      readonly deltaRawPeak: number;
      readonly dischargeAM3s: number | null;
      readonly dischargeBM3s: number | null;
      readonly deltaDischargeM3s: number | null;
      readonly rainAMm: number | null;
      readonly rainBMm: number | null;
      readonly deltaRainMm: number | null;
      readonly sharedThresholdLabel: string | null;
      /** Populated ONLY when continuous exceedance without internal gaps/recessions is proven. */
      readonly provenDurationAHours: number | null;
      readonly provenDurationBHours: number | null;
      readonly deltaProvenDurationHours: number | null;
      readonly nominalSupportAHours: number | null;
      readonly nominalSupportBHours: number | null;
      readonly mergedWindowSpanAHours: number | null;
      readonly mergedWindowSpanBHours: number | null;
      readonly warnings: readonly string[];
    }
  | {
      readonly status: "blocked";
      readonly stationId: HistoricalStationId;
      readonly reason: string;
    };

type SharedDurationMetrics = {
  readonly sharedThresholdLabel: string | null;
  readonly provenDurationAHours: number | null;
  readonly provenDurationBHours: number | null;
  readonly deltaProvenDurationHours: number | null;
  readonly nominalSupportAHours: number | null;
  readonly nominalSupportBHours: number | null;
  readonly mergedWindowSpanAHours: number | null;
  readonly mergedWindowSpanBHours: number | null;
  readonly warning: string | null;
};

function findMatchingSingleEventDuration(
  durations: readonly StationThresholdDuration[],
  thresholdNativeValue: string,
): StationThresholdDuration | undefined {
  return durations.find(
    (d) =>
      d.aggregationScope === "single_event" &&
      d.thresholdNativeValue === thresholdNativeValue,
  );
}

/**
 * Compares threshold durations strictly across `single_event` records on the
 * same threshold. Multi-event, monthly, or annual sums (`246 h`, `188 h`) are
 * unconditionally excluded, and `deltaProvenDurationHours` is computed ONLY
 * when BOTH events have proven continuous duration without internal gaps/recessions.
 */
function computeSharedThresholdComparison(
  obsA: StationEventObservation,
  obsB: StationEventObservation,
): SharedDurationMetrics {
  for (const durA of obsA.thresholdDurations) {
    if (durA.aggregationScope !== "single_event") continue;

    const matchingB = findMatchingSingleEventDuration(
      obsB.thresholdDurations,
      durA.thresholdNativeValue,
    );
    if (!matchingB) continue;

    const deltaProven = computeNullableDelta(
      durA.provenContinuousHours,
      matchingB.provenContinuousHours,
      100,
    );
    const hasMergedOrUnproven =
      durA.includesMergedGapsOrRecessions ||
      matchingB.includesMergedGapsOrRecessions ||
      durA.provenContinuousHours === null ||
      matchingB.provenContinuousHours === null;

    return {
      sharedThresholdLabel: durA.thresholdLabel,
      provenDurationAHours: durA.provenContinuousHours,
      provenDurationBHours: matchingB.provenContinuousHours,
      deltaProvenDurationHours: deltaProven,
      nominalSupportAHours: durA.nominalSampleSupportHours,
      nominalSupportBHours: matchingB.nominalSampleSupportHours,
      mergedWindowSpanAHours: durA.mergedWindowSpanHours,
      mergedWindowSpanBHours: matchingB.mergedWindowSpanHours,
      warning: hasMergedOrUnproven
        ? "Ao menos um evento possui janela mesclada (<= 72 h) com lacunas ou recessões abaixo do limiar; por isso a diferença de duração contínua comprovada não é computada sobre a extensão bruta da janela."
        : null,
    };
  }

  return {
    sharedThresholdLabel: null,
    provenDurationAHours: null,
    provenDurationBHours: null,
    deltaProvenDurationHours: null,
    nominalSupportAHours: null,
    nominalSupportBHours: null,
    mergedWindowSpanAHours: null,
    mergedWindowSpanBHours: null,
    warning: null,
  };
}

type UsableObservation = StationEventObservation & {
  readonly peakStageCm: number;
  readonly rawPeakValue: number;
};

function isUsableObservation(
  obs: StationEventObservation | undefined,
): obs is UsableObservation {
  return Boolean(
    obs &&
      obs.usableForComparison &&
      obs.peakStageCm !== null &&
      obs.rawPeakValue !== null,
  );
}

function computeNullableDelta(
  a: number | null,
  b: number | null,
  precisionFactor: number,
): number | null {
  if (a === null || b === null) return null;
  return Math.round((b - a) * precisionFactor) / precisionFactor;
}

type ComparisonWarningContext = {
  readonly eventA: HistoricalFloodEvent;
  readonly eventB: HistoricalFloodEvent;
  readonly obsA: UsableObservation;
  readonly obsB: UsableObservation;
  readonly stationShortName: string;
  readonly durationWarning: string | null;
};

function collectComparisonWarnings(
  ctx: ComparisonWarningContext,
): readonly string[] {
  const warnings: string[] = [];
  if (!ctx.obsA.datumContinuityVerified || !ctx.obsB.datumContinuityVerified) {
    warnings.push(
      `Continuidade geodésica do zero da régua em ${ctx.stationShortName} não está formalmente comprovada por histórico de nivelamento entre ${ctx.eventA.periodLabel} e ${ctx.eventB.periodLabel}; interprete Δ pico com cautela.`,
    );
  }
  if (
    Boolean(ctx.obsA.peakTimestamp?.hasDstAmbiguity) ||
    Boolean(ctx.obsB.peakTimestamp?.hasDstAmbiguity)
  ) {
    warnings.push(
      "Ao menos um evento possui incerteza de horário de verão (BRST UTC−2 vs. UTC−3) no instante do pico.",
    );
  }
  if (ctx.durationWarning) {
    warnings.push(ctx.durationWarning);
  }
  return warnings;
}

/**
 * Compares two historical events strictly on the SAME hydrological station.
 * Fails closed if either event lacks a verified usable peak on that station,
 * never substituting zero or mixing independent gauges.
 */
export function compareHistoricalEventsOnStation(
  eventA: HistoricalFloodEvent,
  eventB: HistoricalFloodEvent,
  stationId: HistoricalStationId,
  requestedStationBId: HistoricalStationId = stationId,
): CompatibleEventComparisonResult {
  if (stationId !== requestedStationBId) {
    return {
      status: "blocked",
      stationId,
      reason:
        "Comparação direta entre estações distintas é proibida por independência de seção fluvial, zero de régua e datum vertical.",
    };
  }
  if (eventA.id === eventB.id) {
    return {
      status: "blocked",
      stationId,
      reason: "Selecione dois eventos distintos para realizar a comparação.",
    };
  }

  const stationRef = getStationReferenceById(stationId);
  if (!stationRef) {
    return {
      status: "blocked",
      stationId,
      reason: "Estação hidrológica não reconhecida no cadastro.",
    };
  }

  const obsA = findStationObservation(eventA, stationId);
  const obsB = findStationObservation(eventB, stationId);
  if (!obsA || !obsB) {
    return {
      status: "blocked",
      stationId,
      reason: `Um ou ambos os eventos selecionados não possuem registro catalogado para ${stationRef.shortName}.`,
    };
  }
  if (!isUsableObservation(obsA)) {
    return {
      status: "blocked",
      stationId,
      reason: `${eventA.title}: medição indisponível ou invalidada em ${stationRef.shortName} (${obsA.qualitySummary}). Nenhum valor é preenchido com zero.`,
    };
  }
  if (!isUsableObservation(obsB)) {
    return {
      status: "blocked",
      stationId,
      reason: `${eventB.title}: medição indisponível ou invalidada em ${stationRef.shortName} (${obsB.qualitySummary}). Nenhum valor é preenchido com zero.`,
    };
  }

  const durationCmp = computeSharedThresholdComparison(obsA, obsB);
  const warnings = collectComparisonWarnings({
    eventA,
    eventB,
    obsA,
    obsB,
    stationShortName: stationRef.shortName,
    durationWarning: durationCmp.warning,
  });

  const deltaPeakCm =
    Math.round((obsB.peakStageCm - obsA.peakStageCm) * 100) / 100;
  const deltaRawPeak =
    Math.round((obsB.rawPeakValue - obsA.rawPeakValue) * 1000) / 1000;

  return {
    status: "compatible",
    stationId,
    stationLabel: stationRef.shortName,
    verticalReferenceLabel: obsA.verticalReferenceLabel,
    eventAId: eventA.id,
    eventBId: eventB.id,
    peakACm: obsA.peakStageCm,
    peakBCm: obsB.peakStageCm,
    deltaPeakCm,
    rawUnit: obsA.rawPeakUnit,
    rawPeakA: obsA.rawPeakValue,
    rawPeakB: obsB.rawPeakValue,
    deltaRawPeak,
    dischargeAM3s: obsA.peakDischargeM3s,
    dischargeBM3s: obsB.peakDischargeM3s,
    deltaDischargeM3s: computeNullableDelta(
      obsA.peakDischargeM3s,
      obsB.peakDischargeM3s,
      100,
    ),
    rainAMm: obsA.accumulatedRainMm,
    rainBMm: obsB.accumulatedRainMm,
    deltaRainMm: computeNullableDelta(
      obsA.accumulatedRainMm,
      obsB.accumulatedRainMm,
      10,
    ),
    sharedThresholdLabel: durationCmp.sharedThresholdLabel,
    provenDurationAHours: durationCmp.provenDurationAHours,
    provenDurationBHours: durationCmp.provenDurationBHours,
    deltaProvenDurationHours: durationCmp.deltaProvenDurationHours,
    nominalSupportAHours: durationCmp.nominalSupportAHours,
    nominalSupportBHours: durationCmp.nominalSupportBHours,
    mergedWindowSpanAHours: durationCmp.mergedWindowSpanAHours,
    mergedWindowSpanBHours: durationCmp.mergedWindowSpanBHours,
    warnings,
  };
}

function buildSpatialTaxonomyNotes(
  nearestCm: SgbFloodLevelCm | null,
  bracketing: readonly [SgbFloodLevelCm, SgbFloodLevelCm] | null,
  isExact: boolean,
) {
  return {
    observedFloodExtent:
      "Inundação observada: polígono georreferenciado medido diretamente em campo, aerolevantamento ou satélite durante o evento — indisponível neste acervo público.",
    officialModeledExtent:
      isExact && nearestCm !== null
        ? `Extensão oficial modelada: camada estática HEC-RAS 1D publicada pelo SGB (2024) para exatamente ${nearestCm} cm (${(nearestCm / 100).toFixed(2).replace(".", ",")} m) na estação 58790002.`
        : "Extensão oficial modelada: polígonos estáticos SGB (2024) disponíveis em passos discretos de 25 cm (300 a 550 cm) na régua 58790002.",
    derivedRepresentation: bracketing
      ? `Representação derivada: sobreposição topológica A × B entre as cotas oficiais adjacentes ${bracketing[0]} cm e ${bracketing[1]} cm, sem interpolar nova mancha.`
      : "Representação derivada: métricas de área e sobreposição calculadas sobre geometrias oficiais SGB sem geração de polígonos intermediários.",
    approximateScenario:
      !isExact && nearestCm !== null
        ? `Cenário aproximado: cota discreta SGB mais próxima (${nearestCm} cm / ${(nearestCm / 100).toFixed(2).replace(".", ",")} m) quando estação, continuidade vertical da régua e faixa de cotas estão confirmadas.`
        : "Cenário aproximado: associação discreta à cota SGB mais próxima somente quando estação, continuidade vertical da régua por período e faixa de cotas estão confirmadas.",
  };
}

function findNearestAndBracketingSgbStages(peakCm: number): {
  readonly isExact: boolean;
  readonly nearestCm: SgbFloodLevelCm;
  readonly bracketing: readonly [SgbFloodLevelCm, SgbFloodLevelCm] | null;
} {
  let nearestCm: SgbFloodLevelCm = SGB_FLOOD_LEVELS_CM[0];
  let bestAbsDiff = Math.abs(peakCm - nearestCm);

  for (const level of SGB_FLOOD_LEVELS_CM) {
    const diff = Math.abs(peakCm - level);
    if (diff < bestAbsDiff) {
      bestAbsDiff = diff;
      nearestCm = level;
    }
  }

  if (bestAbsDiff < 1e-6) {
    return { isExact: true, nearestCm, bracketing: null };
  }

  for (let i = 0; i < SGB_FLOOD_LEVELS_CM.length - 1; i += 1) {
    const a = SGB_FLOOD_LEVELS_CM[i];
    const b = SGB_FLOOD_LEVELS_CM[i + 1];
    if (peakCm > a && peakCm < b) {
      return { isExact: false, nearestCm, bracketing: [a, b] };
    }
  }

  return { isExact: false, nearestCm, bracketing: null };
}

function hasConfirmedDatumContinuity(obs: UsableObservation): boolean {
  return Boolean(
    obs.datumContinuityVerified &&
      typeof obs.datumContinuityEvidence === "string" &&
      obs.datumContinuityEvidence.trim().length > 0,
  );
}

/**
 * Evaluates whether a historical event can be associated with an official SGB
 * flood scenario on the map (Section 7 + Vertical Continuity Gate).
 *
 * Requires BOTH `datumContinuityVerified === true` AND non-empty period-specific
 * `datumContinuityEvidence`. In the absence of period-specific leveling evidence,
 * historical equivalence remains BLOCKED with a generalized reason (never
 * assuming 2012), offering at most independent SGB scenario exploration without
 * confirmed historical equivalence when `300 <= peakStageCm <= 550`.
 */
export function resolveHistoricalMapAssociation(
  event: HistoricalFloodEvent,
): HistoricalMapAssociation {
  const sgbObs = findStationObservation(event, "RHN-58790002");

  if (!isUsableObservation(sgbObs)) {
    return {
      status: "blocked",
      historicalEquivalenceConfirmed: false,
      blockCode: "missing_sgb_station_observation",
      eventId: event.id,
      representationKind: "blocked_incompatible_reference",
      observedExtentAvailable: false,
      reason:
        "Associação histórica bloqueada: o evento não possui leitura verificada na estação de referência RHN 58790002. Leituras do INEA (213042120) ou de estações a montante não podem ser convertidas em cotas SGB sem crosswalk validado.",
      independentScenarioExploration: null,
      taxonomyNotes: buildSpatialTaxonomyNotes(null, null, false),
    };
  }

  const minSgb = SGB_FLOOD_LEVELS_CM[0];
  const maxSgb = SGB_FLOOD_LEVELS_CM.at(-1) ?? 550;
  const formattedPeak = formatTrimmedDecimalPtBr(sgbObs.peakStageCm, 2);

  if (sgbObs.peakStageCm < minSgb || sgbObs.peakStageCm > maxSgb) {
    return {
      status: "blocked",
      historicalEquivalenceConfirmed: false,
      blockCode: "outside_sgb_modeled_range",
      eventId: event.id,
      representationKind: "blocked_incompatible_reference",
      observedExtentAvailable: false,
      reason: `Associação histórica bloqueada: o pico observado em RHN 58790002 em ${event.periodLabel} (${formattedPeak} cm) está fora do intervalo modelado pelo SGB (${minSgb} a ${maxSgb} cm). Não é realizada extrapolação abaixo de 3,00 m nem acima de 5,50 m.`,
      independentScenarioExploration: null,
      taxonomyNotes: buildSpatialTaxonomyNotes(null, null, false),
    };
  }

  const { isExact, nearestCm, bracketing } = findNearestAndBracketingSgbStages(
    sgbObs.peakStageCm,
  );

  if (!hasConfirmedDatumContinuity(sgbObs)) {
    return {
      status: "blocked",
      historicalEquivalenceConfirmed: false,
      blockCode: "unverified_datum_continuity",
      eventId: event.id,
      representationKind: "blocked_incompatible_reference",
      observedExtentAvailable: false,
      reason: `Associação histórica bloqueada por precaução altimétrica: para ${event.periodLabel} (pico nominal de ${formattedPeak} cm em RHN 58790002), ainda não há evidência documental específica de continuidade do zero da régua em relação ao nivelamento geodésico SGB de setembro de 2024 (79,709 m hgeoHNOR_IMBITUBA). ${sgbObs.datumContinuityNote}`,
      independentScenarioExploration: {
        nominalObservedPeakCm: sgbObs.peakStageCm,
        nominalSingleStageCm: nearestCm,
        nominalBracketingStagesCm: bracketing,
        disclaimer:
          "Permite consultar de forma independente o catálogo estático SGB (2024) na vizinhança nominal da leitura, SEM equivalência histórica confirmada e SEM representar a extensão real observada.",
      },
      taxonomyNotes: buildSpatialTaxonomyNotes(nearestCm, bracketing, isExact),
    };
  }

  const offsetCm = Math.round((nearestCm - sgbObs.peakStageCm) * 100) / 100;

  return {
    status: "compatible",
    historicalEquivalenceConfirmed: true,
    eventId: event.id,
    eventTitle: event.title,
    eventPeriodLabel: event.periodLabel,
    stationId: "RHN-58790002",
    verticalDatum: "hgeoHNOR_IMBITUBA",
    datumContinuityEvidence: sgbObs.datumContinuityEvidence!,
    observedPeakCm: sgbObs.peakStageCm,
    isExactSgbStage: isExact,
    primaryRepresentationKind: isExact
      ? "official_modeled_extent"
      : "approximate_reference_scenario",
    recommendedSingleStageCm: nearestCm,
    stageOffsetFromPeakCm: offsetCm,
    bracketingCompareStagesCm: bracketing,
    observedExtentAvailable: false,
    taxonomyNotes: buildSpatialTaxonomyNotes(nearestCm, bracketing, isExact),
    nonExactWarning:
      "A mancha SGB (2024) é uma simulação hidráulica unidimensional estática (HEC-RAS) referenciada à régua 58790002. Ela NÃO constitui registro exato da extensão observada na enchente histórica, não representa inundações de afluentes (como o Rio Pirapetinga) e não interpola cotas intermediárias.",
  };
}
