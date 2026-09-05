const SGB_MAP_SERVER =
  "https://geoportal.sgb.gov.br/server/rest/services/hidrologia/mancha_santo_antonio_de_padua/MapServer";

export { SGB_FLOOD_LEVELS_CM, type SgbFloodLevelCm } from "./stages";
import { SGB_FLOOD_LEVELS_CM, type SgbFloodLevelCm } from "./stages";

type ArcGisLayer = {
  id: number;
  name: string;
};

type ArcGisServiceMetadata = {
  layers?: ArcGisLayer[];
  error?: unknown;
};

export type SgbFloodResult = {
  levelCm: SgbFloodLevelCm;
  layerId: number;
  layerName: string;
  sourceUrl: string;
  geojson: unknown;
};

export function isSgbFloodLevelCm(value: number): value is SgbFloodLevelCm {
  return (SGB_FLOOD_LEVELS_CM as readonly number[]).includes(value);
}

export function nearestSgbFloodLevelCm(levelMeters: number): SgbFloodLevelCm {
  const requestedCm = levelMeters * 100;

  return SGB_FLOOD_LEVELS_CM.reduce((closest, candidate) =>
    Math.abs(candidate - requestedCm) < Math.abs(closest - requestedCm)
      ? candidate
      : closest,
  );
}

export async function fetchSgbFloodLayer(
  levelCm: SgbFloodLevelCm,
): Promise<SgbFloodResult> {
  const metadataResponse = await fetch(`${SGB_MAP_SERVER}?f=pjson`, {
    signal: AbortSignal.timeout(30_000),
    next: { revalidate: 86_400 },
  });

  if (!metadataResponse.ok) {
    throw new Error(`SGB metadata request failed: ${metadataResponse.status}`);
  }

  const metadata = (await metadataResponse.json()) as ArcGisServiceMetadata;

  if (metadata.error || !Array.isArray(metadata.layers)) {
    throw new Error("SGB MapServer returned invalid service metadata");
  }

  const layerName = `COTA_${levelCm}cm`;
  const layer = metadata.layers.find((candidate) => candidate.name === layerName);

  if (!layer) {
    throw new Error(`SGB layer not found: ${layerName}`);
  }

  const queryUrl = new URL(`${SGB_MAP_SERVER}/${layer.id}/query`);
  queryUrl.searchParams.set("where", "1=1");
  queryUrl.searchParams.set("outFields", "*");
  queryUrl.searchParams.set("returnGeometry", "true");
  queryUrl.searchParams.set("outSR", "4326");
  queryUrl.searchParams.set("f", "geojson");

  const geometryResponse = await fetch(queryUrl, {
    signal: AbortSignal.timeout(30_000),
    next: { revalidate: 3_600 },
  });

  if (!geometryResponse.ok) {
    throw new Error(`SGB geometry request failed: ${geometryResponse.status}`);
  }

  const geojson = (await geometryResponse.json()) as {
    type?: string;
    features?: unknown[];
    error?: unknown;
  };

  if (
    geojson.error ||
    geojson.type !== "FeatureCollection" ||
    !Array.isArray(geojson.features)
  ) {
    throw new Error(`SGB layer ${layerName} did not return a GeoJSON FeatureCollection`);
  }

  return {
    levelCm,
    layerId: layer.id,
    layerName,
    sourceUrl: queryUrl.toString(),
    geojson,
  };
}
