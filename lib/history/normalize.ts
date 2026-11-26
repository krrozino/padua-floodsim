import type {
  HistoricalTimestampRecord,
  OriginalTimezoneKind,
  StageDisplayUnit,
} from "./contract.ts";

const ISO_UTC_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?Z$/;
const SPACE_DATE_TIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?(?:\s+GMT)?$/;
const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatBrtDateTimeParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const yyyy = String(year).padStart(4, "0");
  const hh = String(hour).padStart(2, "0");
  const min = String(minute).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function convertUtcMsToFixedBrtLabel(utcMs: number): string {
  // Fixed UTC-3 (BRT standard offset; Brazil abolished DST in 2019).
  const brtMs = utcMs - 3 * 60 * 60 * 1000;
  const dt = new Date(brtMs);
  return `${formatBrtDateTimeParts(
    dt.getUTCFullYear(),
    dt.getUTCMonth() + 1,
    dt.getUTCDate(),
    dt.getUTCHours(),
    dt.getUTCMinutes(),
  )} BRT (UTC−3)`;
}

function parseUtcMsFromGroups(match: RegExpExecArray): number {
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    match[6] ? Number(match[6]) : 0,
  );
}

function buildDateOnlyTimestamp(
  trimmed: string,
  hasExcelSerialRoundingNote: boolean,
  customNote?: string,
): HistoricalTimestampRecord {
  const match = DATE_ONLY_REGEX.exec(trimmed);
  const displayBrt = match
    ? `${match[3]}/${match[2]}/${match[1]} (data diária, sem horário instantâneo publicado)`
    : `${trimmed} (data diária)`;
  return {
    originalTimestamp: trimmed,
    originalTimezone: "DATE_ONLY_BRT",
    utcIso: null,
    displayBrt,
    hasDstAmbiguity: false,
    hasExcelSerialRoundingNote,
    conversionNote:
      customNote ??
      "Fonte documental publica apenas a data do pico diário, sem horário subdiário.",
  };
}

function buildAmbiguousDstTimestamp(
  trimmed: string,
  hasExcelSerialRoundingNote: boolean,
  customNote?: string,
): HistoricalTimestampRecord {
  const match = SPACE_DATE_TIME_REGEX.exec(trimmed);
  const formattedLocal = match
    ? formatBrtDateTimeParts(
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
      )
    : trimmed;
  return {
    originalTimestamp: trimmed,
    originalTimezone: "LOCAL_AMBIGUOUS_BRST_OR_BRT",
    utcIso: null,
    displayBrt: `${formattedLocal} (horário local da planilha; fuso BRST UTC−2 vs. UTC−3 em verificação)`,
    hasDstAmbiguity: true,
    hasExcelSerialRoundingNote,
    conversionNote:
      customNote ??
      "Cabeçalho 'DATA E HORA' sem sufixo GMT (abas INEA 2011–2014). Em janeiro de 2012 vigorava o horário brasileiro de verão (BRST, UTC−2), mas não há confirmação institucional se o datalogger operava em UTC−2 ou UTC−3 fixo; timestamp original preservado sem conversão silenciosa para UTC.",
  };
}

function buildFixedBrtTimestamp(
  trimmed: string,
  hasExcelSerialRoundingNote: boolean,
  customNote?: string,
): HistoricalTimestampRecord | null {
  const match = SPACE_DATE_TIME_REGEX.exec(trimmed);
  if (!match) return null;
  const utcMs = parseUtcMsFromGroups(match) + 3 * 60 * 60 * 1000;
  return {
    originalTimestamp: trimmed,
    originalTimezone: "BRT_UTC_MINUS_3",
    utcIso: new Date(utcMs).toISOString().replace(".000Z", "Z"),
    displayBrt: `${formatBrtDateTimeParts(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
    )} BRT (UTC−3)`,
    hasDstAmbiguity: false,
    hasExcelSerialRoundingNote,
    conversionNote:
      customNote ??
      "Horário oficial de Brasília (BRT, UTC−3, sem horário de verão após 2019) convertido deterministicamente para UTC (+3 h).",
  };
}

function buildUtcOrGmtTimestamp(
  trimmed: string,
  originalTimezone: OriginalTimezoneKind,
  hasExcelSerialRoundingNote: boolean,
  customNote?: string,
): HistoricalTimestampRecord | null {
  const isoMatch = ISO_UTC_REGEX.exec(trimmed);
  if (isoMatch) {
    const utcMs = parseUtcMsFromGroups(isoMatch);
    return {
      originalTimestamp: trimmed,
      originalTimezone,
      utcIso: new Date(utcMs).toISOString().replace(".000Z", "Z"),
      displayBrt: convertUtcMsToFixedBrtLabel(utcMs),
      hasDstAmbiguity: false,
      hasExcelSerialRoundingNote,
      conversionNote:
        customNote ??
        "Timestamp auditado em UTC; exibido em horário padrão de Brasília (UTC−3, sem horário de verão no período 2020–2026).",
    };
  }

  const gmtMatch = SPACE_DATE_TIME_REGEX.exec(trimmed);
  if (!gmtMatch) return null;

  const utcMs = parseUtcMsFromGroups(gmtMatch);
  const baseNote =
    "Cabeçalho 'Data e Hora (GMT)' (UTC+0 confirmado por confronto cruzado com o Decreto Municipal nº 025/2026: 17:15 GMT = 14:15 BRT em 28/02/2026).";
  const roundingNote = hasExcelSerialRoundingNote
    ? " Inclui artefato de ponto flutuante de serial Excel (ex.: :29 em vez de :30), preservado literalmente."
    : "";
  return {
    originalTimestamp: trimmed,
    originalTimezone,
    utcIso: new Date(utcMs).toISOString().replace(".000Z", "Z"),
    displayBrt: convertUtcMsToFixedBrtLabel(utcMs),
    hasDstAmbiguity: false,
    hasExcelSerialRoundingNote,
    conversionNote: customNote ?? `${baseNote}${roundingNote}`,
  };
}

/**
 * Preserves original historical timestamps while producing deterministic UTC and
 * local display labels when unambiguous. Never guesses UTC offsets when DST
 * (`BRST UTC-2` vs `BRT UTC-3` in 2011–2014 INEA sheets) is unconfirmed.
 */
export function buildHistoricalTimestamp(
  originalTimestamp: string,
  originalTimezone: OriginalTimezoneKind,
  options: {
    readonly hasExcelSerialRoundingNote?: boolean;
    readonly customNote?: string;
  } = {},
): HistoricalTimestampRecord {
  const trimmed = originalTimestamp.trim();
  const rounding = Boolean(options.hasExcelSerialRoundingNote);

  if (originalTimezone === "DATE_ONLY_BRT") {
    return buildDateOnlyTimestamp(trimmed, rounding, options.customNote);
  }
  if (originalTimezone === "LOCAL_AMBIGUOUS_BRST_OR_BRT") {
    return buildAmbiguousDstTimestamp(trimmed, rounding, options.customNote);
  }
  if (originalTimezone === "BRT_UTC_MINUS_3") {
    const fixed = buildFixedBrtTimestamp(trimmed, rounding, options.customNote);
    if (fixed) return fixed;
  }

  const utcOrGmt = buildUtcOrGmtTimestamp(
    trimmed,
    originalTimezone,
    rounding,
    options.customNote,
  );
  if (utcOrGmt) return utcOrGmt;

  return {
    originalTimestamp: trimmed,
    originalTimezone,
    utcIso: null,
    displayBrt: trimmed,
    hasDstAmbiguity: false,
    hasExcelSerialRoundingNote: rounding,
    conversionNote: options.customNote ?? null,
  };
}

/**
 * Normalizes a finite non-negative stage measurement into centimeters (`cm`)
 * within its own station scale, rejecting NaN, negative artifacts (such as the
 * `-0,769 m` sensor glitches in Jan–Feb 2022 INEA data), and null values without
 * substituting zero.
 */
export function normalizeStageReadingToCm(
  rawValue: number | null | undefined,
  unit: StageDisplayUnit,
): number | null {
  if (rawValue === null || rawValue === undefined || !Number.isFinite(rawValue)) {
    return null;
  }
  if (rawValue < 0) {
    return null;
  }
  if (unit === "m") {
    return Math.round(rawValue * 10000) / 100;
  }
  return Math.round(rawValue * 100) / 100;
}

/**
 * Formats a stage reading preserving station-native units (`cm` for RHN/SGB,
 * `m` with cm parenthetical for INEA), returning `"Não disponível"` when absent.
 * Never substitutes `0` for missing data.
 */
export function formatTrimmedDecimalPtBr(
  value: number,
  maxDecimals: number,
): string {
  let trimmed = value.toFixed(maxDecimals);
  if (maxDecimals > 0 && trimmed.includes(".")) {
    while (trimmed.endsWith("0")) {
      trimmed = trimmed.slice(0, -1);
    }
    if (trimmed.endsWith(".")) {
      trimmed = trimmed.slice(0, -1);
    }
  }
  return trimmed.replace(".", ",");
}

export function formatHistoricalStage(
  peakStageCm: number | null,
  rawPeakValue: number | null,
  rawPeakUnit: StageDisplayUnit,
): string {
  if (
    peakStageCm === null ||
    !Number.isFinite(peakStageCm) ||
    rawPeakValue === null ||
    !Number.isFinite(rawPeakValue)
  ) {
    return "Não disponível";
  }

  if (rawPeakUnit === "m") {
    const decimals =
      Math.abs(rawPeakValue * 100 - Math.round(rawPeakValue * 100)) > 1e-6
        ? 3
        : 2;
    const formattedMeters = rawPeakValue.toFixed(decimals).replace(".", ",");
    const formattedCm = formatTrimmedDecimalPtBr(peakStageCm, 1);
    return `${formattedMeters} m (${formattedCm} cm na régua INEA)`;
  }

  const formattedCm = formatTrimmedDecimalPtBr(peakStageCm, 2);
  const formattedMeters = (peakStageCm / 100).toFixed(2).replace(".", ",");
  return `${formattedCm} cm (${formattedMeters} m)`;
}

export function formatHistoricalDischarge(
  dischargeM3s: number | null,
): string {
  if (dischargeM3s === null || !Number.isFinite(dischargeM3s)) {
    return "Não disponível";
  }
  return `${dischargeM3s.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} m³/s`;
}

export function formatHistoricalRain(rainMm: number | null): string {
  if (rainMm === null || !Number.isFinite(rainMm)) {
    return "Não disponível";
  }
  return `${rainMm.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} mm`;
}

export function formatDurationHours(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) {
    return "Não disponível";
  }
  return `${formatTrimmedDecimalPtBr(hours, 2)} h`;
}

export function formatCoveragePct(coveragePct: number | null): string {
  if (coveragePct === null || !Number.isFinite(coveragePct)) {
    return "Não avaliada";
  }
  return `${coveragePct.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })}%`;
}
