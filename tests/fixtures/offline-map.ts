import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

// Synthetic raster grid, not an OpenStreetMap extract.
const syntheticTile = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAIUlEQVR4nGM4+/ASSYgBiN99eoaJcImPaiBWw2g8DLwGAOU0tbd3pyU7AAAAAElFTkSuQmCC",
  "base64",
);

export const test = base.extend<{ offlineMap: void }>({
  offlineMap: [async ({ context, baseURL }, use) => {
    const localOrigin = new URL(baseURL!).origin;
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "tile.openstreetmap.org") {
        await route.fulfill({ body: syntheticTile, contentType: "image/png" });
      } else if (url.origin !== localOrigin) {
        await route.abort();
      } else if (url.pathname === "/api/hydro/observations") {
        await route.fulfill({ status: 503, json: { fixture: "synthetic unavailable" } });
      } else if (url.pathname.startsWith("/api/")) {
        // A test must explicitly provide any additional API response.
        await route.abort();
      } else {
        await route.continue();
      }
    });
    await use();
  }, { auto: true }],
});

// Synthetic geometry. The response uses the app's SGB API contract.
export function syntheticSgbPayload(level: number) {
  const span = 0.02 + (level - 300) * 0.00004;
  return {
    classification: "official_reference",
    levelCm: level,
    layerName: `COTA_${level}cm`,
    geojson: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { testStage: level },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-42.19, -21.55],
                [-42.19 + span, -21.55],
                [-42.19 + span, -21.55 + span],
                [-42.19, -21.55 + span],
                [-42.19, -21.55],
              ],
            ],
          },
        },
      ],
    },
  };
}
