import { createHash } from "node:crypto";
import type {
  HydroGaugeReference,
  HydroMonitoringResponse,
  HydroQualityFlag,
  RainObservationRecord,
  RainWindowKey,
} from "./contract.ts";
import {
  PARSER_VERSION,
  computeRecentStageTrend,
  convertStageToCm,
  evaluateFreshness,
  parseBrazilLocalDateTime,
  parseRainMm,
} from "./normalize.ts";

export const INEA_INSTITUTION =
  "INEA — Instituto Estadual do Ambiente (Alerta de Cheias)";
export const INEA_PADUA_STATION_ID = "213042120";
export const INEA_PADUA_STATION_NAME = "Santo Antônio de Pádua";
export const INEA_PADUA_RIVER_NAME = "Rio Pomba";
export const INEA_PADUA_COORDINATES = {
  latitude: -21.511110305786,
  longitude: -42.207527160645,
  crs: "EPSG:4326",
} as const;
export const INEA_PADUA_PUBLIC_PAGE_URL =
  "https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.html";
export const INEA_PADUA_XML_URL =
  "https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.xml";

export const INEA_PADUA_GAUGE_REFERENCE: HydroGaugeReference = {
  stationCode: INEA_PADUA_STATION_ID,
  rhnCode: null,
  gaugeZeroMeters: null,
  verticalDatum: null,
  attentionStageCm: 400,
  overflowStageCm: 500,
  crosswalkValidated: false,
};

export const INEA_FRESHNESS_POLICY = {
  expectedCadenceMinutes: 15,
  staleAfterMinutes: 45,
  cacheTtlSeconds: 300,
} as const;

export const INEA_SCIENTIFIC_DISCLAIMER =
  "Medição observada na estação INEA 213042120 (-21,5111°, -42,2075°). Não altera automaticamente a mancha oficial SGB (estação RHN 58790002), pois as estações e referências de régua são distintas e ainda sem crosswalk validado. Não substitui avisos oficiais da Defesa Civil ou do INEA.";

const RAIN_FIELDS: ReadonlyArray<{
  tag: string;
  window: RainWindowKey;
  windowMinutes: number;
  label: string;
}> = [
  { tag: "chuva_ultimo", window: "15m", windowMinutes: 15, label: "15 min" },
  { tag: "chuva_1h", window: "1h", windowMinutes: 60, label: "1 h" },
  { tag: "chuva_4h", window: "4h", windowMinutes: 240, label: "4 h" },
  { tag: "chuva_24h", window: "24h", windowMinutes: 1440, label: "24 h" },
  { tag: "chuva_96h", window: "96h", windowMinutes: 5760, label: "96 h" },
  { tag: "chuva_30d", window: "30d", windowMinutes: 43200, label: "30 dias" },
];

export interface ParseIneaXmlOptions {
  now: Date;
  retrievedAt?: Date;
  expectedStationId?: string;
  stageUnit?: string;
  rainUnit?: string;
  staleAfterMinutes?: number;
  sourceUrl?: string;
  publicPageUrl?: string;
}

interface ParsedXmlRow {
  index: number;
  measuredAt: string;
  measuredAtMs: number;
  rawStage: string;
  stageCm: number | null;
  stageFlag?: HydroQualityFlag;
  rainByWindow: Array<{
    window: RainWindowKey;
    windowMinutes: number;
    label: string;
    rawValue: string;
    rainMm: number | null;
    flag?: HydroQualityFlag;
  }>;
  signature: string;
}

function decodeXmlText(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .trim();
}

function extractTagText(block: string, tagName: string): string | null {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  const match = pattern.exec(block);
  if (!match) return null;
  return decodeXmlText(match[1]);
}

function addFlag(set: Set<HydroQualityFlag>, flag: HydroQualityFlag | undefined) {
  if (flag) set.add(flag);
}

function buildStationMetadata(sourceUrl: string, publicPageUrl: string) {
  return {
    stationId: INEA_PADUA_STATION_ID,
    stationName: INEA_PADUA_STATION_NAME,
    riverName: INEA_PADUA_RIVER_NAME,
    coordinates: { ...INEA_PADUA_COORDINATES },
    publicPageUrl,
    sourceUrl,
    gaugeReference: { ...INEA_PADUA_GAUGE_REFERENCE },
  };
}

function buildNonOperationalResponse(args: {
  status: "unavailable" | "invalid";
  retrievedAtIso: string;
  staleAfterMinutes: number;
  sourceUrl: string;
  publicPageUrl: string;
  qualityFlags: HydroQualityFlag[];
  message: string;
}): HydroMonitoringResponse {
  return {
    schemaVersion: "1.0",
    classification: "observed",
    status: args.status,
    provider: "inea",
    institution: INEA_INSTITUTION,
    station: buildStationMetadata(args.sourceUrl, args.publicPageUrl),
    measuredAt: null,
    retrievedAt: args.retrievedAtIso,
    ageMinutes: null,
    freshnessPolicy: {
      expectedCadenceMinutes: INEA_FRESHNESS_POLICY.expectedCadenceMinutes,
      staleAfterMinutes: args.staleAfterMinutes,
      cacheTtlSeconds: INEA_FRESHNESS_POLICY.cacheTtlSeconds,
    },
    latestStage: null,
    recentTrend: null,
    rainfall: [],
    qualityFlags: args.qualityFlags,
    message: args.message,
    scientificDisclaimer: INEA_SCIENTIFIC_DISCLAIMER,
  };
}

/**
 * Pure, deterministic parser and normalizer for the INEA station XML export (`21304212020.xml`).
 * Separated from network acquisition so all edge cases are reproducibly testable offline.
 */
export function parseIneaStationXml(
  xml: string,
  options: ParseIneaXmlOptions,
): HydroMonitoringResponse {
  const nowMs = options.now.getTime();
  const retrievedAt = options.retrievedAt ?? options.now;
  const retrievedAtIso = retrievedAt.toISOString();
  const expectedStationId = options.expectedStationId ?? INEA_PADUA_STATION_ID;
  const stageUnit = options.stageUnit ?? "m";
  const rainUnit = options.rainUnit ?? "mm";
  const staleAfterMinutes =
    options.staleAfterMinutes ?? INEA_FRESHNESS_POLICY.staleAfterMinutes;
  const sourceUrl = options.sourceUrl ?? INEA_PADUA_XML_URL;
  const publicPageUrl = options.publicPageUrl ?? INEA_PADUA_PUBLIC_PAGE_URL;

  const trimmedXml = xml.trim();
  if (!trimmedXml) {
    return buildNonOperationalResponse({
      status: "invalid",
      retrievedAtIso,
      staleAfterMinutes,
      sourceUrl,
      publicPageUrl,
      qualityFlags: ["malformed_payload"],
      message: "Payload XML do INEA vazio ou malformado.",
    });
  }

  const sourceHashSha256 = createHash("sha256")
    .update(xml, "utf8")
    .digest("hex");

  if (stageUnit !== "m" && stageUnit !== "cm") {
    return buildNonOperationalResponse({
      status: "invalid",
      retrievedAtIso,
      staleAfterMinutes,
      sourceUrl,
      publicPageUrl,
      qualityFlags: ["invalid_unit"],
      message: `Unidade de nível não suportada: "${stageUnit}".`,
    });
  }

  if (rainUnit !== "mm") {
    return buildNonOperationalResponse({
      status: "invalid",
      retrievedAtIso,
      staleAfterMinutes,
      sourceUrl,
      publicPageUrl,
      qualityFlags: ["invalid_unit"],
      message: `Unidade de chuva não suportada: "${rainUnit}".`,
    });
  }

  const estacaoOpenMatch = /<estacao\b([^>]*)>/i.exec(trimmedXml);
  const hasClosingEnvelope =
    /<\/estacao>/i.test(trimmedXml) &&
    /<dados_ultimos_10_dias>/i.test(trimmedXml) &&
    /<\/dados_ultimos_10_dias>/i.test(trimmedXml);

  if (!estacaoOpenMatch || !hasClosingEnvelope) {
    return buildNonOperationalResponse({
      status: "invalid",
      retrievedAtIso,
      staleAfterMinutes,
      sourceUrl,
      publicPageUrl,
      qualityFlags: ["malformed_payload"],
      message: "Estrutura XML do INEA inválida ou incompleta.",
    });
  }

  const codigoMatch = /\bcodigo\s*=\s*["']([^"']+)["']/i.exec(
    estacaoOpenMatch[1],
  );
  if (!codigoMatch || codigoMatch[1].trim() !== expectedStationId) {
    return buildNonOperationalResponse({
      status: "invalid",
      retrievedAtIso,
      staleAfterMinutes,
      sourceUrl,
      publicPageUrl,
      qualityFlags: ["malformed_payload"],
      message: `Identificador de estação INEA incompatível (esperado ${expectedStationId}).`,
    });
  }

  const openRegistros = trimmedXml.match(/<registro\b[^>]*>/gi)?.length ?? 0;
  const closeRegistros = trimmedXml.match(/<\/registro>/gi)?.length ?? 0;
  if (openRegistros === 0 || openRegistros !== closeRegistros) {
    return buildNonOperationalResponse({
      status: "invalid",
      retrievedAtIso,
      staleAfterMinutes,
      sourceUrl,
      publicPageUrl,
      qualityFlags: ["malformed_payload"],
      message: "Registros XML ausentes ou truncados na resposta do INEA.",
    });
  }

  const registroBlocks = Array.from(
    trimmedXml.matchAll(/<registro\b[^>]*>([\s\S]*?)<\/registro>/gi),
    (match) => match[1],
  );

  const stationName =
    extractTagText(trimmedXml, "nome_estacao") || INEA_PADUA_STATION_NAME;

  const globalFlags = new Set<HydroQualityFlag>();
  const parsedRows: ParsedXmlRow[] = [];
  let firstRowInvalidTimestamp = false;

  for (let i = 0; i < registroBlocks.length; i += 1) {
    const block = registroBlocks[i];
    const rawDate = extractTagText(block, "data_hora");
    const rawStage = extractTagText(block, "nivel_rio_ultimo");

    if (rawDate === null || rawStage === null) {
      return buildNonOperationalResponse({
        status: "invalid",
        retrievedAtIso,
        staleAfterMinutes,
        sourceUrl,
        publicPageUrl,
        qualityFlags: ["malformed_payload"],
        message: "Registro XML do INEA sem data_hora ou nivel_rio_ultimo.",
      });
    }

    const parsedDate = parseBrazilLocalDateTime(rawDate, nowMs);
    if (!parsedDate) {
      globalFlags.add("invalid_timestamp");
      if (i === 0) {
        firstRowInvalidTimestamp = true;
      }
      continue;
    }

    const stageParsed = convertStageToCm(rawStage, stageUnit);
    if (!stageParsed.unitValid) {
      return buildNonOperationalResponse({
        status: "invalid",
        retrievedAtIso,
        staleAfterMinutes,
        sourceUrl,
        publicPageUrl,
        qualityFlags: ["invalid_unit"],
        message: "Unidade de nível inválida no registro INEA.",
      });
    }

    const rainByWindow: ParsedXmlRow["rainByWindow"] = [];
    const rainSignatureParts: string[] = [];

    for (const field of RAIN_FIELDS) {
      const rawRain = extractTagText(block, field.tag);
      if (rawRain === null) continue;
      const rainParsed = parseRainMm(rawRain, rainUnit);
      rainByWindow.push({
        window: field.window,
        windowMinutes: field.windowMinutes,
        label: field.label,
        rawValue: rawRain,
        rainMm: rainParsed.rainMm,
        flag: rainParsed.flag,
      });
      rainSignatureParts.push(`${field.window}:${rawRain.trim()}`);
    }

    parsedRows.push({
      index: i,
      measuredAt: parsedDate.iso,
      measuredAtMs: parsedDate.epochMs,
      rawStage,
      stageCm: stageParsed.stageCm,
      stageFlag: stageParsed.flag,
      rainByWindow,
      signature: `${rawStage.trim()}|${rainSignatureParts.join("|")}`,
    });
  }

  if (firstRowInvalidTimestamp || parsedRows.length === 0) {
    globalFlags.add("invalid_timestamp");
    return buildNonOperationalResponse({
      status: "invalid",
      retrievedAtIso,
      staleAfterMinutes,
      sourceUrl,
      publicPageUrl,
      qualityFlags: Array.from(globalFlags),
      message: "Horário de medição inválido ou futuro no XML do INEA.",
    });
  }

  // Detect out-of-order publication relative to INEA's descending chronological table.
  for (let i = 1; i < parsedRows.length; i += 1) {
    if (parsedRows[i].measuredAtMs > parsedRows[i - 1].measuredAtMs) {
      globalFlags.add("out_of_order");
      break;
    }
  }

  const sortedDesc = [...parsedRows].sort(
    (a, b) => b.measuredAtMs - a.measuredAtMs || a.index - b.index,
  );

  // Deduplicate idempotently by measuredAt; fail closed if newest timestamp has conflicting stage values.
  const deduplicated: ParsedXmlRow[] = [];
  const byTimestamp = new Map<string, ParsedXmlRow>();
  const newestTimestamp = sortedDesc[0].measuredAt;

  for (const row of sortedDesc) {
    const existing = byTimestamp.get(row.measuredAt);
    if (!existing) {
      byTimestamp.set(row.measuredAt, row);
      deduplicated.push(row);
      continue;
    }

    globalFlags.add("duplicate");
    if (existing.stageCm !== row.stageCm && row.measuredAt === newestTimestamp) {
      globalFlags.add("malformed_payload");
      return buildNonOperationalResponse({
        status: "invalid",
        retrievedAtIso,
        staleAfterMinutes,
        sourceUrl,
        publicPageUrl,
        qualityFlags: Array.from(globalFlags),
        message:
          "Leituras conflitantes para o mesmo instante mais recente no XML do INEA.",
      });
    }
  }

  const newestRow = deduplicated[0];
  if (
    newestRow.stageFlag === "malformed_payload" ||
    newestRow.stageFlag === "suspect_range"
  ) {
    globalFlags.add(newestRow.stageFlag);
    return buildNonOperationalResponse({
      status: "invalid",
      retrievedAtIso,
      staleAfterMinutes,
      sourceUrl,
      publicPageUrl,
      qualityFlags: Array.from(globalFlags),
      message: "Valor de nível inválido ou fora de faixa plausível no XML do INEA.",
    });
  }

  let selectedRow: ParsedXmlRow | undefined =
    newestRow.stageCm !== null ? newestRow : undefined;
  let fellBackToOlderValidStage = false;

  if (!selectedRow) {
    globalFlags.add("missing");
    selectedRow = deduplicated.find((row) => row.stageCm !== null);
    if (!selectedRow) {
      return buildNonOperationalResponse({
        status: "unavailable",
        retrievedAtIso,
        staleAfterMinutes,
        sourceUrl,
        publicPageUrl,
        qualityFlags: Array.from(globalFlags),
        message:
          "Estação INEA sem leitura válida de nível disponível na série recebida.",
      });
    }
    fellBackToOlderValidStage = true;
  }

  const freshness = evaluateFreshness(
    selectedRow.measuredAtMs,
    nowMs,
    staleAfterMinutes,
    fellBackToOlderValidStage,
  );

  if (freshness.status === "stale") {
    globalFlags.add("stale");
  }

  const validStagesForTrend = deduplicated.filter(
    (row): row is ParsedXmlRow & { stageCm: number } =>
      row.stageCm !== null && row.measuredAtMs <= selectedRow.measuredAtMs,
  );
  const recentTrend = computeRecentStageTrend(validStagesForTrend);

  const rainfall: RainObservationRecord[] = selectedRow.rainByWindow.map(
    (rain) => {
      const rainFlags: HydroQualityFlag[] = [];
      if (rain.flag) {
        rainFlags.push(rain.flag);
        addFlag(globalFlags, rain.flag);
      }
      return {
        classification: "observed",
        provider: "inea",
        stationId: expectedStationId,
        sensorId: `${expectedStationId}-plu-${rain.window}`,
        window: rain.window,
        windowMinutes: rain.windowMinutes,
        label: rain.label,
        measuredAt: selectedRow.measuredAt,
        retrievedAt: retrievedAtIso,
        rainMm: rain.rainMm,
        unitOriginal: "mm",
        rawValue: rain.rawValue,
        qualityFlags: rainFlags,
        parserVersion: PARSER_VERSION,
      };
    },
  );

  const stageFlags = Array.from(globalFlags);
  const status = freshness.status;
  const message =
    status === "fresh"
      ? "Leitura oficial observada e atualizada dentro da janela operacional do INEA."
      : fellBackToOlderValidStage
        ? "Leitura mais recente de nível ausente (Dado Nulo); exibindo última medição válida anterior como desatualizada."
        : `Última leitura observada há ${freshness.ageMinutes} min (acima da janela de ${staleAfterMinutes} min).`;

  const stationMeta = {
    ...buildStationMetadata(sourceUrl, publicPageUrl),
    stationName,
  };

  return {
    schemaVersion: "1.0",
    classification: "observed",
    status,
    provider: "inea",
    institution: INEA_INSTITUTION,
    station: stationMeta,
    measuredAt: selectedRow.measuredAt,
    retrievedAt: retrievedAtIso,
    ageMinutes: freshness.ageMinutes,
    freshnessPolicy: {
      expectedCadenceMinutes: INEA_FRESHNESS_POLICY.expectedCadenceMinutes,
      staleAfterMinutes,
      cacheTtlSeconds: INEA_FRESHNESS_POLICY.cacheTtlSeconds,
    },
    latestStage: {
      classification: "observed",
      provider: "inea",
      institution: INEA_INSTITUTION,
      stationId: expectedStationId,
      stationName,
      riverName: INEA_PADUA_RIVER_NAME,
      coordinates: { ...INEA_PADUA_COORDINATES },
      sourceUrl,
      publicPageUrl,
      sourceRecordId: `inea:${expectedStationId}:${selectedRow.measuredAt}`,
      measuredAt: selectedRow.measuredAt,
      retrievedAt: retrievedAtIso,
      stageCm: selectedRow.stageCm,
      unitOriginal: stageUnit,
      rawValue: selectedRow.rawStage,
      gaugeReference: { ...INEA_PADUA_GAUGE_REFERENCE },
      qualityFlags: stageFlags,
      status,
      sourceHashSha256,
      parserVersion: PARSER_VERSION,
    },
    recentTrend,
    rainfall,
    qualityFlags: stageFlags,
    message,
    scientificDisclaimer: INEA_SCIENTIFIC_DISCLAIMER,
  };
}
