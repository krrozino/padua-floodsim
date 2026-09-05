import { test, expect, type Page } from "@playwright/test";

// Synthetic payloads exist only in intercepted test responses, never in app data.
function payload(level: number) {
  return {
    classification: "official_reference", levelCm: level, layerName: `COTA_${level}cm`,
    geojson: { type: "FeatureCollection", features: [{
      type: "Feature", properties: { testStage: level }, geometry: {
        type: "Polygon", coordinates: [[[-42.19,-21.54],[-42.18,-21.54],[-42.18,-21.53],[-42.19,-21.54]]],
      },
    }] },
  };
}

async function instrument(page: Page) {
  await page.addInitScript(() => {
    // Observe the real MapLibre worker boundary without exposing a map in production.
    const nativeFetch = window.fetch;
    window.fetch = (input, options) => nativeFetch(input,
      String(input).includes("level=300") ? { ...options, signal: undefined } : options);
    const original = Worker.prototype.postMessage;
    (window as any).workerData = [];
    Worker.prototype.postMessage = function (message: any, options: any) {
      if (message.data?.source && message.data?.data?.type === "FeatureCollection") {
        (window as any).workerData.push({ source: message.data.source, geojson: message.data.data });
      }
      return original.call(this, message, options);
    };
  });
}
async function lastFloodStage(page: Page) {
  return page.evaluate(() => (window as any).workerData.filter((d: any) => d.source === "flood-zone")
    .at(-1)?.geojson.features[0]?.properties.testStage ?? null);
}

test("latest request wins, failures clear geometry, retry and empty/mismatched responses", async ({ page }) => {
  await instrument(page);
  let mode = "success";
  let releaseOld: (() => void) | undefined;
  let oldStarted = false;
  await page.route("**/api/sgb/flood?*", async route => {
    const level = Number(new URL(route.request().url()).searchParams.get("level"));
    if (level === 300 && mode === "race") {
      oldStarted = true;
      await new Promise<void>(resolve => { releaseOld = resolve; });
    }
    if (mode === "failure") return route.abort("failed");
    const data = payload(mode === "mismatch" ? 300 : level);
    if (mode === "empty") data.geojson.features = [];
    await route.fulfill({ json: data });
  });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".demo-badge")).toHaveClass(/official/);
  await expect.poll(() => lastFloodStage(page)).toBe(425);
  mode = "race";
  await page.getByRole("button", { name: "3,00 m", exact: true }).click();
  await expect.poll(() => oldStarted).toBe(true);
  await expect.poll(() => lastFloodStage(page)).toBe(null);
  await page.getByRole("button", { name: "4,25 m", exact: true }).click();
  await page.getByRole("button", { name: "5,50 m", exact: true }).click();
  await expect.poll(() => lastFloodStage(page)).toBe(550);
  const oldResponse = page.waitForResponse(response => response.url().includes("level=300"));
  releaseOld?.();
  await (await oldResponse).finished();
  expect(await lastFloodStage(page)).toBe(550);
  await expect(page.locator(".demo-badge")).toContainText("5,50 m");
  mode = "failure";
  await page.getByRole("button", { name: "4,25 m", exact: true }).click();
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await expect.poll(() => lastFloodStage(page)).toBe(null);
  mode = "success";
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect.poll(() => lastFloodStage(page)).toBe(425);
  mode = "empty";
  await page.getByRole("button", { name: "5,50 m", exact: true }).click();
  await expect(page.locator(".demo-badge")).toContainText("camada vazia");
  await expect.poll(() => lastFloodStage(page)).toBe(null);
  mode = "mismatch";
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.locator(".demo-badge")).toHaveClass(/error/);
  expect(await lastFloodStage(page)).toBe(null);
  expect(await page.locator(".metrics b").allTextContents()).toEqual(Array(3).fill("Indisponível"));
  expect(await page.evaluate(() => "_paduaMap" in window)).toBe(false);
  expect(errors).toEqual([]);
});

test("SGB starts despite blocked basemap/glyphs; early toggles persist and map retries", async ({ page }) => {
  await instrument(page);
  await page.route("**/tile.openstreetmap.org/**", route => route.abort());
  await page.route("**/demotiles.maplibre.org/**", route => route.abort());
  const releaseWorkers: (() => void)[] = [];
  await page.route("**/maplibre-gl-worker.mjs", async route => {
    await new Promise<void>(resolve => { releaseWorkers.push(resolve); });
    await route.continue();
  });
  await page.route("**/api/sgb/flood?*", route => route.fulfill({ json: payload(425) }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("checkbox", { name: "Mancha SGB", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "Bairros (pontos)", exact: true }).uncheck();
  await expect(page.locator(".demo-badge")).toHaveClass(/official/);
  await expect.poll(() => releaseWorkers.length > 0).toBe(true);
  releaseWorkers.forEach(resolve => resolve());
  await expect.poll(() => lastFloodStage(page)).toBe(425);
  await expect(page.getByRole("checkbox", { name: "Mancha SGB", exact: true })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Bairros (pontos)", exact: true })).not.toBeChecked();
  // With both layers hidden and base blocked, the canvas must remain unchanged on pan.
  const canvas = page.locator("canvas");
  const shot = () => canvas.screenshot({ style: ".map-controls-panel,.map-resource-error,.demo-badge,.slider-card,.maplibregl-control-container { visibility: hidden !important; }" });
  const hidden = await shot();
  await page.getByRole("button", { name: "Aproximar", exact: true }).click();
  await expect.poll(async () => (await shot()).equals(hidden)).toBe(true);
  await page.getByRole("checkbox", { name: "Mancha SGB", exact: true }).check();
  await expect.poll(async () => (await shot()).equals(hidden)).toBe(false);
  await page.getByRole("checkbox", { name: "Mancha SGB", exact: true }).uncheck();
  await expect.poll(async () => (await shot()).equals(hidden)).toBe(true);
  await page.getByRole("checkbox", { name: "Bairros (pontos)", exact: true }).check();
  await expect.poll(async () => (await shot()).equals(hidden)).toBe(false);
  await page.getByRole("checkbox", { name: "Bairros (pontos)", exact: true }).uncheck();
  await page.unroute("**/maplibre-gl-worker.mjs");
  await page.getByRole("button", { name: "Recarregar mapa", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Bairros (pontos)", exact: true })).not.toBeChecked();
  await expect.poll(() => lastFloodStage(page)).toBe(425);
});

test("hung requests time out and retry recovers after offline mode", async ({ page, context }) => {
  await page.clock.install();
  let hang = true;
  await page.route("**/api/sgb/flood?*", async route => {
    if (hang) return;
    await route.fulfill({ json: payload(425) });
  });
  const initialRequest = page.waitForRequest("**/api/sgb/flood?*");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  // SSR already shows loading, but the client timeout only exists after hydration.
  // Wait for the actual fetch before advancing the browser clock.
  await initialRequest;
  await expect(page.locator(".demo-badge")).toHaveClass(/loading/);
  await page.clock.fastForward(46_000);
  await expect(page.locator(".demo-badge")).toHaveClass(/error/);
  await context.setOffline(true);
  const retryRequest = page.waitForRequest("**/api/sgb/flood?*");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await retryRequest;
  await page.clock.fastForward(46_000);
  await expect(page.locator(".demo-badge")).toHaveClass(/error/);
  await context.setOffline(false);
  hang = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.locator(".demo-badge")).toHaveClass(/official/);
});

test("real SGB scenarios, neutral neighborhoods, pan/zoom/center, popup and mobile", async ({ page }) => {
  await instrument(page);
  await page.goto("/");
  await expect(page.locator(".demo-badge")).toHaveClass(/official/, { timeout: 50_000 });
  for (const stage of ["3,00 m", "4,25 m", "5,50 m"]) {
    await page.getByRole("button", { name: stage, exact: true }).click();
    await expect(page.locator(".demo-badge")).toHaveClass(/official/, { timeout: 50_000 });
    await expect(page.locator(".demo-badge")).toContainText(stage);
  }
  await expect.poll(() => page.evaluate(() => (window as any).workerData.filter((d: any) =>
    d.source === "flood-zone" && d.geojson.features[0]?.geometry.type === "MultiPolygon").length)).toBeGreaterThanOrEqual(3);
  const neighborhoods = await page.evaluate(() => (window as any).workerData.find((d: any) => d.source === "neighborhood-points").geojson.features);
  expect(neighborhoods).toHaveLength(7);
  for (const feature of neighborhoods) {
    expect(feature.properties.classification).toBe("mock");
    expect(feature.properties.status).toBe("temporary_reference_point");
    expect(feature.properties).not.toHaveProperty("severity");
    expect(feature.properties).not.toHaveProperty("threshold");
  }
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  await page.mouse.click(box!.x + box!.width / 2 - 6, box!.y + box!.height / 2 + 7);
  await expect(page.locator(".maplibregl-popup")).toContainText("Pontos de referência aproximados");
  await expect(page.locator(".maplibregl-popup")).not.toContainText("Cota referencial");
  await page.getByRole("checkbox", { name: "Bairros (pontos)", exact: true }).uncheck();
  await expect(page.locator(".maplibregl-popup")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Bairros (pontos)", exact: true }).check();
  await page.screenshot({ path: "test-results/desktop.png" });
  const mapShot = () => canvas.screenshot({ style: ".map-controls-panel,.map-resource-error,.demo-badge,.slider-card,.maplibregl-control-container { visibility: hidden !important; }" });
  const before = await mapShot();
  await page.mouse.move(650, 430);
  await page.mouse.down();
  await page.mouse.move(780, 460, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await mapShot()).equals(before)).toBe(false);
  const panned = await mapShot();
  await page.getByRole("button", { name: "Aproximar", exact: true }).click();
  await expect.poll(async () => (await mapShot()).equals(panned)).toBe(false);
  await page.getByRole("button", { name: "Afastar", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Centralizar", exact: true }).click();
  // A geographically distant reference must return to its original screen position.
  // Pixel equality is unsuitable here: raster/WebGL antialiasing changes after zoom.
  await expect.poll(async () => {
    await page.mouse.click(box!.x + box!.width / 2 - 266, box!.y + box!.height / 2 - 117);
    return page.locator(".maplibregl-popup strong").textContent({ timeout: 500 }).catch(() => "");
  }).toBe("Cidade Nova");
  await page.locator(".maplibregl-popup-close-button").click();
  await page.getByRole("button", { name: "Nível do rio", exact: true }).click();
  await expect(page.locator("#realtime-card")).toBeFocused();
  await page.getByRole("button", { name: "Mapa", exact: true }).first().click();
  await expect(page.locator(".map-panel")).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  for (const name of ["3,00 m", "4,25 m", "5,50 m", "Centralizar", "Aproximar", "Afastar"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeInViewport();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByText("Não equivale à régua do INEA.", { exact: false })).toBeVisible();
});

test("methodology modal displays official SGB 2024 parameters, gauge zero, 11 scenarios and dismisses correctly", async ({ page }) => {
  await page.route("**/api/sgb/flood?*", route => route.fulfill({ json: payload(425) }));
  await page.goto("/");

  const modal = page.locator(".methodology-modal");
  await expect(modal).not.toBeVisible();

  // 1. Open from the slider status bar
  await page.getByRole("button", { name: "Fonte e metodologia ℹ" }).click();
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("Delimitação da mancha de inundação do rio Pomba");
  await expect(modal).toContainText("58790002");
  await expect(modal).toContainText("79,709 m");
  await expect(modal).toContainText("hgeoHNOR_IMBITUBA");
  await expect(modal).toContainText("11 cenários modelados");
  await expect(modal).toContainText("Extensão, não profundidade");
  await expect(modal).toContainText("official_reference");

  // 2. Dismiss via Escape key
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();

  // 3. Open from the sidebar card
  await page.getByRole("button", { name: "Metodologia e parâmetros completos ℹ" }).click();
  await expect(modal).toBeVisible();

  // 4. Dismiss via "Entendido, fechar" primary button
  await page.getByRole("button", { name: "Entendido, fechar" }).click();
  await expect(modal).not.toBeVisible();

  // 5. Open again and dismiss via close "✕" button
  await page.getByRole("button", { name: "Fonte e metodologia ℹ" }).click();
  await expect(modal).toBeVisible();
  await page.getByRole("button", { name: "Fechar painel de metodologia" }).click();
  await expect(modal).not.toBeVisible();
});

