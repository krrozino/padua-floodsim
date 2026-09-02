const MAP_SERVER =
  "https://geoportal.sgb.gov.br/server/rest/services/hidrologia/mancha_santo_antonio_de_padua/MapServer";

const levels = [300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550];

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "padua-floodsim-sgb-smoke/0.1" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }

  return response.json();
}

const metadata = await fetchJson(`${MAP_SERVER}?f=pjson`);

if (!Array.isArray(metadata.layers)) {
  throw new Error("SGB MapServer metadata does not contain a layers array");
}

for (const levelCm of levels) {
  const layerName = `COTA_${levelCm}cm`;
  const layer = metadata.layers.find((candidate) => candidate.name === layerName);

  if (!layer) {
    throw new Error(`Official SGB layer not found: ${layerName}`);
  }

  const query = new URL(`${MAP_SERVER}/${layer.id}/query`);
  query.searchParams.set("where", "1=1");
  query.searchParams.set("outFields", "*");
  query.searchParams.set("returnGeometry", "true");
  query.searchParams.set("outSR", "4326");
  query.searchParams.set("f", "geojson");

  const geojson = await fetchJson(query);

  if (geojson.type !== "FeatureCollection") {
    throw new Error(`${layerName} did not return a GeoJSON FeatureCollection`);
  }

  if (!Array.isArray(geojson.features) || geojson.features.length === 0) {
    throw new Error(`${layerName} returned no features`);
  }

  const geometryTypes = [...new Set(
    geojson.features
      .map((feature) => feature?.geometry?.type)
      .filter(Boolean),
  )];

  console.log(
    JSON.stringify({
      levelCm,
      layerId: layer.id,
      layerName,
      features: geojson.features.length,
      geometryTypes,
    }),
  );
}

console.log("SGB smoke validation passed for all official gauge levels.");
