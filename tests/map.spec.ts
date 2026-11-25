import { test, expect, type Page } from "@playwright/test";

// Synthetic payloads exist only in intercepted test responses, never in app data.
function payload(level: number) {
  const span = 0.005 + (level - 300) * 0.00002;
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
                [-42.19, -21.54],
                [-42.19 + span, -21.54],
                [-42.19 + span, -21.54 + span],
                [-42.19, -21.54 + span],
                [-42.19, -21.54],
              ],
            ],
          },
        },
      ],
    },
  };
}

async function instrument(page: Page) {
  await page.addInitScript(() => {
    // Observe the real MapLibre worker boundary without exposing a map in production.
    const nativeFetch = window.fetch;
    window.fetch = (input, options) =>
      nativeFetch(
        input,
        String(input).includes("level=300")
          ? { ...options, signal: undefined }
          : options,
      );
    const original = Worker.prototype.postMessage;
    (window as any).workerData = [];
    Worker.prototype.postMessage = function (message: any, options: any) {
      if (
        message.data?.source &&
        message.data?.data?.type === "FeatureCollection"
      ) {
        (window as any).workerData.push({
          source: message.data.source,
          geojson: message.data.data,
        });
      }
      return original.call(this, message, options);
    };
  });
}

async function lastFloodStage(page: Page) {
  return page.evaluate(
    () =>
      (window as any).workerData
        .filter((d: any) => d.source === "flood-zone")
        .at(-1)?.geojson.features[0]?.properties.testStage ?? null,
  );
}

test("latest request wins, failures clear geometry, derived area updates/omits cleanly, and no mock UI exists", async ({
  page,
}) => {
  await instrument(page);
  let mode = "success";
  let releaseOld: (() => void) | undefined;
  let oldStarted = false;
  await page.route("**/api/sgb/flood?*", async (route) => {
    const level = Number(
      new URL(route.request().url()).searchParams.get("level"),
    );
    if (level === 300 && mode === "race") {
      oldStarted = true;
      await new Promise<void>((resolve) => {
        releaseOld = resolve;
      });
    }
    if (mode === "failure") return route.abort("failed");
    const data = payload(mode === "mismatch" ? 300 : level);
    if (mode === "empty") data.geojson.features = [];
    await route.fulfill({ json: data });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");

  // No prototype labels, disabled "em breve" buttons, or mock neighborhoods in public UI
  await expect(page.locator("body")).not.toContainText("em breve");
  await expect(page.locator("body")).not.toContainText("V1 · SGB + INEA");
  await expect(page.locator("body")).not.toContainText("official_reference");
  await expect(page.locator("body")).not.toContainText("Bairros (pontos)");
  await expect(page.locator("body")).not.toContainText("Bairros potencialmente afetados");
  await expect(page.locator("body")).not.toContainText("Ruas com trechos na mancha");
  await expect(page.locator("nav button:disabled")).toHaveCount(0);
  await expect(page.locator("body")).toContainText(
    "Esta plataforma não substitui os alertas e as orientações dos órgãos oficiais.",
  );

  await expect(page.locator(".scenario-status-badge")).toHaveClass(/official/);
  await expect.poll(() => lastFloodStage(page)).toBe(425);

  // Derived area card must be visible with derived badge and scenario context
  const areaCard = page.locator(".area-metric-card");
  await expect(areaCard).toBeVisible();
  await expect(areaCard).toContainText("Área da mancha selecionada");
  await expect(areaCard).toContainText("Dado derivado");
  await expect(areaCard).toContainText("4,25 m");
  const area425 = await areaCard.locator(".area-metric-primary").textContent();

  mode = "race";
  await page.getByRole("button", { name: "3,00 m", exact: true }).click();
  await expect.poll(() => oldStarted).toBe(true);
  await expect.poll(() => lastFloodStage(page)).toBe(null);
  await page.getByRole("button", { name: "4,25 m", exact: true }).click();
  await page.getByRole("button", { name: "5,50 m", exact: true }).click();
  await expect.poll(() => lastFloodStage(page)).toBe(550);
  const oldResponse = page.waitForResponse((response) =>
    response.url().includes("level=300"),
  );
  releaseOld?.();
  await (await oldResponse).finished();
  expect(await lastFloodStage(page)).toBe(550);
  await expect(page.locator(".scenario-status-badge")).toContainText("5,50 m");
  const area550 = await areaCard.locator(".area-metric-primary").textContent();
  expect(area550).not.toBe(area425);

  // Failure clears geometry and omits derived area card
  mode = "failure";
  await page.getByRole("button", { name: "4,25 m", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Tentar novamente" }),
  ).toBeVisible();
  await expect.poll(() => lastFloodStage(page)).toBe(null);
  await expect(areaCard).toHaveCount(0);

  mode = "success";
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect.poll(() => lastFloodStage(page)).toBe(425);
  await expect(areaCard).toBeVisible();

  // Empty response clears geometry and omits derived area card
  mode = "empty";
  await page.getByRole("button", { name: "5,50 m", exact: true }).click();
  await expect(page.locator(".scenario-status-badge")).toContainText(
    "camada vazia",
  );
  await expect.poll(() => lastFloodStage(page)).toBe(null);
  await expect(areaCard).toHaveCount(0);

  mode = "mismatch";
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/error/);
  expect(await lastFloodStage(page)).toBe(null);
  await expect(areaCard).toHaveCount(0);

  expect(await page.evaluate(() => "_paduaMap" in window)).toBe(false);
  expect(errors).toEqual([]);
});

test("SGB starts despite blocked basemap/glyphs; early layer toggles persist and map retries", async ({
  page,
}) => {
  await instrument(page);
  await page.route("**/tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/demotiles.maplibre.org/**", (route) => route.abort());
  const releaseWorkers: (() => void)[] = [];
  await page.route("**/maplibre-gl-worker.mjs", async (route) => {
    await new Promise<void>((resolve) => {
      releaseWorkers.push(resolve);
    });
    await route.continue();
  });
  await page.route("**/api/sgb/flood?*", (route) =>
    route.fulfill({ json: payload(425) }),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("checkbox", { name: "Mancha SGB", exact: true })
    .uncheck();
  await page
    .getByRole("checkbox", { name: "Estações hidrológicas", exact: true })
    .uncheck();
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/official/);
  await expect.poll(() => releaseWorkers.length > 0).toBe(true);
  releaseWorkers.forEach((resolve) => resolve());
  await expect.poll(() => lastFloodStage(page)).toBe(425);
  await expect(
    page.getByRole("checkbox", { name: "Mancha SGB", exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Estações hidrológicas", exact: true }),
  ).not.toBeChecked();

  const canvas = page.locator("canvas");
  const shot = () =>
    canvas.screenshot({
      style:
        ".map-controls-panel,.map-resource-error,.slider-card,.maplibregl-control-container { visibility: hidden !important; }",
    });
  const hidden = await shot();
  await page.getByRole("button", { name: "Aproximar", exact: true }).click();
  await expect.poll(async () => (await shot()).equals(hidden)).toBe(true);
  await page
    .getByRole("checkbox", { name: "Mancha SGB", exact: true })
    .check();
  await expect.poll(async () => (await shot()).equals(hidden)).toBe(false);
  await page
    .getByRole("checkbox", { name: "Mancha SGB", exact: true })
    .uncheck();
  await expect.poll(async () => (await shot()).equals(hidden)).toBe(true);
  await page
    .getByRole("checkbox", { name: "Estações hidrológicas", exact: true })
    .check();
  await expect.poll(async () => (await shot()).equals(hidden)).toBe(false);
  await page
    .getByRole("checkbox", { name: "Estações hidrológicas", exact: true })
    .uncheck();
  await page.unroute("**/maplibre-gl-worker.mjs");
  await page
    .getByRole("button", { name: "Recarregar mapa", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Estações hidrológicas", exact: true }),
  ).not.toBeChecked();
  await expect.poll(() => lastFloodStage(page)).toBe(425);
});

test("hung requests time out and retry recovers after offline mode", async ({
  page,
  context,
}) => {
  await page.clock.install();
  let hang = true;
  await page.route("**/api/sgb/flood?*", async (route) => {
    if (hang) return;
    await route.fulfill({ json: payload(425) });
  });
  const initialRequest = page.waitForRequest("**/api/sgb/flood?*");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await initialRequest;
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/loading/);
  await page.clock.fastForward(46_000);
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/error/);
  await context.setOffline(true);
  const retryRequest = page.waitForRequest("**/api/sgb/flood?*");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await retryRequest;
  await page.clock.fastForward(46_000);
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/error/);
  await context.setOffline(false);
  hang = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/official/);
});

test("all 4 real navigation views, 11 SGB stages, verified stations layer, and mobile responsiveness without overflow", async ({
  page,
}) => {
  await instrument(page);
  await page.route("**/tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/demotiles.maplibre.org/**", (route) => route.abort());
  const requestedLevels = new Set<number>();
  await page.route("**/api/sgb/flood?*", async (route) => {
    const level = Number(
      new URL(route.request().url()).searchParams.get("level"),
    );
    requestedLevels.add(level);
    await route.fulfill({ json: payload(level) });
  });

  await page.goto("/");
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/official/);

  // Verify real stations layer (2 verified INEA stations, no mock neighborhoods)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).workerData.find(
            (d: any) => d.source === "hydro-stations",
          )?.geojson.features.length ?? 0,
      ),
    )
    .toBe(2);
  const hasMockNeighborhoods = await page.evaluate(() =>
    (window as any).workerData.some(
      (d: any) => d.source === "neighborhood-points",
    ),
  );
  expect(hasMockNeighborhoods).toBe(false);

  // Navigate to Monitoramento
  await page.getByRole("button", { name: "Monitoramento", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Monitoramento do Rio Pomba" }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText("Ponte Paraoquena (INEA)");
  await expect(page.locator("body")).toContainText("58790002");
  await expect(page.locator("body")).toContainText("divergentes");

  // Navigate to Dados e fontes and verify all 11 SGB stages in table
  await page
    .getByRole("button", { name: "Dados e fontes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dados e fontes" }),
  ).toBeVisible();
  await expect(page.locator(".stages-table tbody tr")).toHaveCount(11);

  // Click "Ver no mapa" on the 3,00 m row -> returns to map and loads 300 cm
  await page.locator(".stages-table tbody tr").first().getByRole("button", { name: "Ver no mapa" }).click();
  await expect(page.locator(".scenario-status-badge")).toContainText("3,00 m");
  await expect.poll(() => lastFloodStage(page)).toBe(300);

  // Step through all remaining 10 stages (325..550 cm) using the + button
  const incBtn = page.getByRole("button", {
    name: "Aumentar cota em 25 centímetros",
  });
  for (let i = 0; i < 10; i += 1) {
    await incBtn.click();
  }
  await expect(page.locator(".scenario-status-badge")).toContainText("5,50 m");
  await expect.poll(() => lastFloodStage(page)).toBe(550);
  expect(requestedLevels.size).toBe(11);

  // Navigate to Sobre e metodologia
  await page
    .getByRole("button", { name: "Sobre e metodologia", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sobre e metodologia" }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText(
    "Esta plataforma não substitui os alertas e as orientações dos órgãos oficiais.",
  );

  // Return to Mapa and check desktop + mobile responsiveness & zero horizontal overflow across all views
  await page
    .getByRole("button", { name: "Mapa e cenários", exact: true })
    .click();
  await expect(page.locator(".map-panel")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  for (const navName of [
    "Mapa e cenários",
    "Monitoramento",
    "Dados e fontes",
    "Sobre e metodologia",
  ]) {
    await page.getByRole("button", { name: navName, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("methodology modal stays open during async map state changes and dismisses deterministically", async ({
  page,
}) => {
  let releaseFlood: (() => void) | undefined;
  await page.route("**/tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/demotiles.maplibre.org/**", (route) => route.abort());
  await page.route("**/api/sgb/flood?*", async (route) => {
    const level = Number(
      new URL(route.request().url()).searchParams.get("level"),
    );
    if (!releaseFlood) {
      await new Promise<void>((resolve) => {
        releaseFlood = resolve;
      });
    }
    await route.fulfill({ json: payload(level) });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const modal = page.locator(".methodology-modal");
  await expect(modal).not.toBeVisible();

  // Open modal BEFORE async SGB fetch finishes
  await page.getByRole("button", { name: "Fonte e metodologia" }).click();
  await expect(modal).toBeVisible();

  // Now resolve the SGB fetch (triggers async layerStatus & derivedArea parent re-renders)
  await expect.poll(() => Boolean(releaseFlood)).toBe(true);
  releaseFlood?.();
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/official/);

  // Regression check: dialog MUST remain open after async parent re-renders!
  await expect(modal).toBeVisible();
  expect(
    await modal.evaluate((el) => (el as HTMLDialogElement).open),
  ).toBe(true);
  await expect(modal).toContainText(
    "Delimitação da mancha de inundação do rio Pomba",
  );
  await expect(modal).toContainText("58790002");
  await expect(modal).toContainText("79,709 m");
  await expect(modal).toContainText("hgeoHNOR_IMBITUBA");
  await expect(modal).toContainText("11 cenários modelados");
  await expect(modal).toContainText("Cenário oficial SGB");

  // Dismiss via Escape key
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();

  // Open from right panel button & dismiss via primary button
  await page
    .getByRole("button", { name: "Metodologia e parâmetros do SGB" })
    .click();
  await expect(modal).toBeVisible();
  await page.getByRole("button", { name: "Entendido, fechar" }).click();
  await expect(modal).not.toBeVisible();

  // Open & dismiss via close "✕" button
  await page.getByRole("button", { name: "Fonte e metodologia" }).click();
  await expect(modal).toBeVisible();
  await page.getByRole("button", { name: "Fechar painel de metodologia" }).click();
  await expect(modal).not.toBeVisible();

  // Open & dismiss via backdrop click
  await page.getByRole("button", { name: "Fonte e metodologia" }).click();
  await expect(modal).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(modal).not.toBeVisible();

  // Mobile viewport check
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Fonte e metodologia" }).click();
  await expect(modal).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Entendido, fechar" }).click();
  await expect(modal).not.toBeVisible();
});
