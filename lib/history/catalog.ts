import type {
  HistoricalFloodEvent,
  HistoricalStationId,
  HistoricalStationReference,
  ProvenanceArtifact,
} from "./contract.ts";
import rawCatalog from "./data/historicalCatalog.json" with { type: "json" };

export const HISTORICAL_CATALOG_VERSION = "2026.11.26-r02e.2" as const;

export const HISTORICAL_STATION_REGISTRY: readonly HistoricalStationReference[] =
  rawCatalog.stations as unknown as readonly HistoricalStationReference[];

export const PROVENANCE_ARTIFACTS: readonly ProvenanceArtifact[] =
  rawCatalog.provenanceArtifacts as unknown as readonly ProvenanceArtifact[];

export const HISTORICAL_FLOOD_EVENTS: readonly HistoricalFloodEvent[] =
  rawCatalog.events as unknown as readonly HistoricalFloodEvent[];

export function getStationReferenceById(
  stationId: HistoricalStationId,
): HistoricalStationReference | undefined {
  return HISTORICAL_STATION_REGISTRY.find((s) => s.id === stationId);
}

export function getProvenanceArtifactById(
  provenanceId: string,
): ProvenanceArtifact | undefined {
  return PROVENANCE_ARTIFACTS.find((p) => p.id === provenanceId);
}

export function getHistoricalEventById(
  eventId: string,
): HistoricalFloodEvent | undefined {
  return HISTORICAL_FLOOD_EVENTS.find((ev) => ev.id === eventId);
}
