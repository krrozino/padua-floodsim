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
} from "./contract.ts";

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
  if (!obs || obs.peakStageCm === null || !Number.isFinite(obs.peakStageCm)) {
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
  if (filters.stationId !== "all") {
    return hasVerifiedStationMeasurement(event, filters.stationId);
  }
  return true;
}

export function filterAndSortHistoricalEvents(
  events: readonly HistoricalFloodEvent[],
  filters: HistoricalEventFilters,
): readonly HistoricalFloodEvent[] {
  const filtered = events.filter((ev) => matchesEventFilters(ev, filters));
  const sign = filters.sortOrder === "oldest_first" ? 1 : -1;

  return [...filtered].sort((a, b) => {
    const dateCompare = a.startDateIso.localeCompare(b.startDateIso);
    if (dateCompare !== 0) {
      return sign * dateCompare;
    }
    return sign * a.id.localeCompare(b.id);
  });
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
      readonly durationAHours: number | null;
      readonly durationBHours: number | null;
      readonly deltaDurationHours: number | null;
      readonly warnings: readonly string[];
    }
  | {
      readonly status: "blocked";
      readonly stationId: HistoricalStationId;
      readonly reason: string;
    };

function computeSharedThresholdComparison(
  obsA: StationEventObservation,
  obsB: StationEventObservation,
): {
  readonly sharedThresholdLabel: string | null;
  readonly durationAHours: number | null;
  readonly durationBHours: number | null;
  readonly deltaDurationHours: number | null;
  readonly warning: string | null;
} {
  for (const durA of obsA.thresholdDurations) {
    const matchingB = obsB.thresholdDurations.find(
      (durB) => durB.thresholdNativeValue === durA.thresholdNativeValue,
    );
    if (!matchingB) continue;

    const aIsAnnual = /soma|anual|2022\/2023/i.test(durA.thresholdLabel);
    const bIsAnnual = /soma|anual|2022\/2023/i.test(matchingB.thresholdLabel);
    if (aIsAnnual !== bIsAnnual) continue;

    const delta =
      Math.round((matchingB.hoursAbove - durA.hoursAbove) * 100) / 100;
    const hasMergedGap = durA.includesMergedGaps || matchingB.includesMergedGaps;
    return {
      sharedThresholdLabel: durA.thresholdLabel,
      durationAHours: durA.hoursAbove,
      durationBHours: matchingB.hoursAbove,
      deltaDurationHours: delta,
      warning: hasMergedGap
        ? "Ao menos uma janela de duração acima do limiar inclui mesclagem de lacuna telemétrica documentada."
        : null,
    };
  }

  return {
    sharedThresholdLabel: null,
    durationAHours: null,
    durationBHours: null,
    deltaDurationHours: null,
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

function collectComparisonWarnings(
  eventA: HistoricalFloodEvent,
  eventB: HistoricalFloodEvent,
  obsA: UsableObservation,
  obsB: UsableObservation,
  stationShortName: string,
  durationWarning: string | null,
): readonly string[] {
  const warnings: string[] = [];
  if (!obsA.datumContinuityVerified || !obsB.datumContinuityVerified) {
    warnings.push(
      `Continuidade histórica do zero da régua em ${stationShortName} não está integralmente confirmada entre ${eventA.year} e ${eventB.year}; interprete Δ pico com cautela.`,
    );
  }
  if (
    Boolean(obsA.peakTimestamp?.hasDstAmbiguity) ||
    Boolean(obsB.peakTimestamp?.hasDstAmbiguity)
  ) {
    warnings.push(
      "Ao menos um evento possui incerteza de horário de verão (BRST UTC−2 vs. UTC−3) no instante do pico.",
    );
  }
  if (durationWarning) {
    warnings.push(durationWarning);
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
  const warnings = collectComparisonWarnings(
    eventA,
    eventB,
    obsA,
    obsB,
    stationRef.shortName,
    durationCmp.warning,
  );

  return {
    status: "compatible",
    stationId,
    stationLabel: stationRef.shortName,
    verticalReferenceLabel: obsA.verticalReferenceLabel,
    eventAId: eventA.id,
    eventBId: eventB.id,
    peakACm: obsA.peakStageCm,
    peakBCm: obsB.peakStageCm,
    deltaPeakCm: computeNullableDelta(obsA.peakStageCm, obsB.peakStageCm, 100)!,
    rawUnit: obsA.rawPeakUnit,
    rawPeakA: obsA.rawPeakValue,
    rawPeakB: obsB.rawPeakValue,
    deltaRawPeak: computeNullableDelta(
      obsA.rawPeakValue,
      obsB.rawPeakValue,
      1000,
    )!,
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
    durationAHours: durationCmp.durationAHours,
    durationBHours: durationCmp.durationBHours,
    deltaDurationHours: durationCmp.deltaDurationHours,
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
      ? `Representação derivada: sobreposição topológica A × B entre as cotas oficiais adjacentes ${bracketing[0]} cm e ${bracketing[1]} cm que enquadram o pico observado, sem interpolar nova mancha.`
      : "Representação derivada: métricas de área e sobreposição calculadas sobre geometrias oficiais SGB sem geração de polígonos intermediários.",
    approximateScenario:
      !isExact && nearestCm !== null
        ? `Cenário aproximado: cota discreta SGB mais próxima (${nearestCm} cm / ${(nearestCm / 100).toFixed(2).replace(".", ",")} m) na mesma estação e datum (58790002, hgeoHNOR_IMBITUBA). Não é registro exato da enchente histórica.`
        : "Cenário aproximado: associação discreta à cota SGB mais próxima quando estação, datum e faixa de cotas são compatíveis.",
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

/**
 * Evaluates whether a historical event can be associated with an official SGB
 * flood scenario on the map (Section 7).
 */
export function resolveHistoricalMapAssociation(
  event: HistoricalFloodEvent,
): HistoricalMapAssociation {
  const sgbObs = findStationObservation(event, "RHN-58790002");

  if (!isUsableObservation(sgbObs)) {
    return {
      status: "blocked",
      eventId: event.id,
      representationKind: "blocked_incompatible_reference",
      observedExtentAvailable: false,
      reason:
        "Associação espacial bloqueada: o evento não possui leitura verificada na estação de referência RHN 58790002. Leituras do INEA (213042120) ou de montante não podem ser convertidas em cotas SGB sem crosswalk validado.",
      taxonomyNotes: buildSpatialTaxonomyNotes(null, null, false),
    };
  }

  if (!sgbObs.datumContinuityVerified) {
    return {
      status: "blocked",
      eventId: event.id,
      representationKind: "blocked_incompatible_reference",
      observedExtentAvailable: false,
      reason:
        "Associação espacial bloqueada por precaução altimétrica: embora o pico de 450 cm seja da estação 58790002, a continuidade do zero da régua entre 2012 e o nivelamento geodésico SGB de 2024 (79,709 m hgeoHNOR_IMBITUBA) ainda não foi confirmada institucionalmente.",
      taxonomyNotes: buildSpatialTaxonomyNotes(null, null, false),
    };
  }

  const minSgb = SGB_FLOOD_LEVELS_CM[0];
  const maxSgb = SGB_FLOOD_LEVELS_CM[SGB_FLOOD_LEVELS_CM.length - 1];

  if (sgbObs.peakStageCm < minSgb || sgbObs.peakStageCm > maxSgb) {
    return {
      status: "blocked",
      eventId: event.id,
      representationKind: "blocked_incompatible_reference",
      observedExtentAvailable: false,
      reason: `Associação espacial bloqueada: o pico observado em 58790002 (${sgbObs.peakStageCm.toFixed(1).replace(".0", "").replace(".", ",")} cm) está fora do intervalo modelado pelo SGB (${minSgb} a ${maxSgb} cm). Não é realizada extrapolação abaixo de 3,00 m nem acima de 5,50 m.`,
      taxonomyNotes: buildSpatialTaxonomyNotes(null, null, false),
    };
  }

  const { isExact, nearestCm, bracketing } = findNearestAndBracketingSgbStages(
    sgbObs.peakStageCm,
  );
  const offsetCm = Math.round((nearestCm - sgbObs.peakStageCm) * 100) / 100;

  return {
    status: "compatible",
    eventId: event.id,
    eventTitle: event.title,
    eventPeriodLabel: event.periodLabel,
    stationId: "RHN-58790002",
    verticalDatum: "hgeoHNOR_IMBITUBA",
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
