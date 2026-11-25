import { validateHydroMonitoringResponse } from "../lib/hydro/contract.ts";
import { parseIneaStationXml } from "../lib/hydro/ineaParser.ts";
import { createIneaAdapter } from "../lib/hydro/providers/ineaAdapter.ts";

const adapter = createIneaAdapter();

const raw = await adapter.fetchRawPayload();
if (raw.kind !== "ok") {
  throw new Error(`Expected fresh XML payload, received ${raw.kind}`);
}

const now = new Date();
const observation = parseIneaStationXml(raw.xml, { now });

if (!validateHydroMonitoringResponse(observation)) {
  throw new Error("Live INEA response failed HydroMonitoringResponse schema validation.");
}

if (observation.status === "invalid") {
  throw new Error(`Live INEA payload parsed as invalid: ${observation.message}`);
}

const summary = {
  classification: observation.classification,
  status: observation.status,
  provider: observation.provider,
  stationId: observation.station.stationId,
  stationName: observation.station.stationName,
  measuredAt: observation.measuredAt,
  retrievedAt: observation.retrievedAt,
  ageMinutes: observation.ageMinutes,
  stageCm: observation.latestStage?.stageCm ?? null,
  rawStage: observation.latestStage?.rawValue ?? null,
  unitOriginal: observation.latestStage?.unitOriginal ?? null,
  recentTrend: observation.recentTrend,
  rainfallWindows: observation.rainfall.map((r) => ({
    window: r.window,
    rainMm: r.rainMm,
  })),
  qualityFlags: observation.qualityFlags,
  byteLength: raw.byteLength,
  sourceHashSha256: observation.latestStage?.sourceHashSha256 ?? null,
  parserVersion: observation.latestStage?.parserVersion ?? null,
};

console.log(JSON.stringify(summary, null, 2));
