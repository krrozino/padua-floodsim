import { test, expect, type Page } from "@playwright/test";

// Synthetic payloads exist only in intercepted test responses, never in app data.
function makeStageWithHoleAndNonNestedPayload(levelCm: number) {
  // Base polygon covers lon [-42.190, -42.170], lat [-21.545, -21.530]
  // with an internal dry hole (island) at lon [-42.184, -42.180], lat [-21.540, -21.536].
  // To test non-nested behavior explicitly:
  // - Stages >= 375 EXCEPT 450 cover [-42.176, -42.172] x [-21.535, -21.531] (second part).
  // - Stage 300..350 cover a narrower strip [-42.190, -42.186] x [-21.545, -21.530].
  const outerMain: [number, number][] =
    levelCm < 375
      ? [
          [-42.19, -21.545],
          [-42.186, -21.545],
          [-42.186, -21.53],
          [-42.19, -21.53],
          [-42.19, -21.545],
        ]
      : [
          [-42.19, -21.545],
          [-42.178, -21.545],
          [-42.178, -21.53],
          [-42.19, -21.53],
          [-42.19, -21.545],
        ];

  const hole: [number, number][] = [
    [-42.184, -21.54],
    [-42.18, -21.54],
    [-42.18, -21.536],
    [-42.184, -21.536],
    [-42.184, -21.54],
  ];

  const secondPart: [number, number][] = [
    [-42.176, -21.535],
    [-42.172, -21.535],
    [-42.172, -21.531],
    [-42.176, -21.531],
    [-42.176, -21.535],
  ];

  const coords: [number, number][][][] =
    levelCm < 375
      ? [[outerMain]]
      : levelCm === 450
        ? [[outerMain, hole]] // intentionally omits secondPart at 450 cm -> non-nested!
        : [[outerMain, hole], [secondPart]];

  return {
    classification: "official_reference",
    levelCm,
    layerName: `COTA_${levelCm}cm`,
    geojson: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { testStage: levelCm },
          geometry: {
            type: "MultiPolygon",
            coordinates: coords,
          },
        },
      ],
    },
  };
}

async function instrumentWorker(page: Page) {
  await page.addInitScript(() => {
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

async function lastQueryPointFeature(page: Page) {
  return page.evaluate(
    () =>
      (window as any).workerData
        .filter((d: any) => d.source === "query-location-point")
        .at(-1)?.geojson.features[0] ?? null,
  );
}

test("geographic point query: coordinates, boundary, hole, outside coverage, map click, A/B compare, on-demand 11-stage analysis with cache & non-nested detection, and mobile layout", async ({
  page,
}) => {
  await instrumentWorker(page);
  await page.route("**/tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/demotiles.maplibre.org/**", (route) => route.abort());

  const requestedLevels: number[] = [];
  let failLevel525 = false;

  await page.route("**/api/sgb/flood?*", async (route) => {
    const level = Number(
      new URL(route.request().url()).searchParams.get("level"),
    );
    requestedLevels.push(level);
    if (failLevel525 && level === 525) {
      return route.fulfill({ status: 502, json: { error: "upstream" } });
    }
    await route.fulfill({ json: makeStageWithHoleAndNonNestedPayload(level) });
  });

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/official/);

  // 1. Opening the app MUST NOT trigger 11 requests!
  expect(requestedLevels).toEqual([425]);

  const latInput = page.getByLabel("Latitude (WGS84)");
  const lonInput = page.getByLabel("Longitude (WGS84)");
  const submitBtn = page.getByRole("button", { name: "Consultar coordenadas" });

  // 2. Invalid coordinates fail closed
  await latInput.fill("95.0");
  await lonInput.fill("-42.18");
  await submitBtn.click();
  await expect(page.getByTestId("location-input-error")).toBeVisible();

  // 3. Interior point inside flooded polygon (425 cm) -> inside + georeferenced MapLibre marker
  await latInput.fill("-21.5330");
  await lonInput.fill("-42.1740"); // inside secondPart (non-nested at 450 cm!)
  await submitBtn.click();

  const relationBox = page.getByTestId("location-relation-result");
  await expect(relationBox).toHaveAttribute("data-relation", "inside");
  await expect(relationBox).toContainText("Interceptado pelo cenário selecionado");
  await expect
    .poll(() => lastQueryPointFeature(page))
    .toMatchObject({
      geometry: { type: "Point", coordinates: [-42.174, -21.533] },
      properties: { relation: "inside" },
    });

  // 4. Boundary point on outer edge (-42.190, -21.535)
  await latInput.fill("-21.5350");
  await lonInput.fill("-42.1900");
  await submitBtn.click();
  await expect(relationBox).toHaveAttribute("data-relation", "boundary");
  await expect(relationBox).toContainText("Ponto na fronteira da mancha selecionada");

  // 5. Point inside internal hole (dry island: -42.182, -21.538) -> outside + non-safety caveat
  await latInput.fill("-21.5380");
  await lonInput.fill("-42.1820");
  await submitBtn.click();
  await expect(relationBox).toHaveAttribute("data-relation", "outside");
  await expect(relationBox).toContainText("Sem interseção com o cenário selecionado");
  await expect(relationBox).toContainText("não declara imóvel seguro");

  // 6. Point outside known SGB model coverage -> explicit coverage caveat
  await latInput.fill("-21.6200");
  await lonInput.fill("-42.3100");
  await submitBtn.click();
  await expect(relationBox).toHaveAttribute("data-coverage", "outside_model_coverage");
  await expect(relationBox).toContainText("Fora da cobertura conhecida do modelo SGB");
  await expect(relationBox).toContainText(
    "ausência de interseção não indica ausência de possibilidade de inundação",
  );

  // 7. A/B comparison mode compatibility (A = 425 cm inside secondPart, B = 450 cm outside secondPart -> only_a!)
  await latInput.fill("-21.5330");
  await lonInput.fill("-42.1740");
  await submitBtn.click();
  await page.getByRole("button", { name: "Comparar cenários" }).click();
  await page.getByLabel("Cota B de referência SGB").selectOption("450");

  await expect(relationBox).toHaveAttribute("data-combined-relation", "only_a");
  await expect(relationBox).toContainText("Interceptado apenas por A");
  await expect(page.getByTestId("location-compare-relation-a")).toContainText(
    "Interior",
  );
  await expect(page.getByTestId("location-compare-relation-b")).toContainText(
    "Fora",
  );

  // If Scenario B fails -> fail-closed unavailable in comparison mode
  failLevel525 = true;
  await page.getByLabel("Cota B de referência SGB").selectOption("525");
  await expect(relationBox).toHaveAttribute(
    "data-combined-relation",
    "unavailable",
  );
  failLevel525 = false;

  // Return to single mode & run explicit on-demand 11-stage analysis
  await page.getByRole("button", { name: "Cenário único" }).click();
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/official/);

  const countBeforeCross = requestedLevels.length;
  await page.getByTestId("analyze-all-stages-btn").click();
  await expect(page.getByTestId("cross-stage-results")).toBeVisible();
  await expect(page.getByTestId("cross-stage-lowest")).toContainText("3,75 m");
  await expect(page.getByTestId("cross-stage-lowest")).toContainText(
    /não corresponde necessariamente ao início real de inundação/i,
  );
  // Non-nested pattern (375..425 inside, 450 outside, 475..550 inside) must be surfaced!
  await expect(page.getByTestId("cross-stage-non-nested-warning")).toBeVisible();
  await expect(page.getByTestId("cross-stage-chip-450")).toHaveAttribute(
    "data-relation",
    "outside",
  );
  await expect(page.getByTestId("cross-stage-chip-375")).toHaveAttribute(
    "data-relation",
    "inside",
  );
  // Active stage (425) was preloaded -> at most 10 new fetches!
  expect(requestedLevels.length - countBeforeCross).toBeLessThanOrEqual(10);

  // Select a NEW point and run 11-stage analysis again -> MUST use session cache (0 new fetches!)
  await latInput.fill("-21.5350");
  await lonInput.fill("-42.1880");
  await submitBtn.click();
  const countBeforeCachedRun = requestedLevels.length;
  await page.getByTestId("analyze-all-stages-btn").click();
  await expect(page.getByTestId("cross-stage-lowest")).toContainText("3,00 m");
  await expect(page.getByTestId("cross-stage-lowest")).toContainText(
    "abaixo de 300 cm",
  );
  expect(requestedLevels.length).toBe(countBeforeCachedRun);

  // Clicking a chip in the 11-stage matrix updates the active map stage
  await page.getByTestId("cross-stage-chip-300").click();
  await expect(page.locator(".scenario-status-badge")).toContainText("3,00 m");

  // 8. Map click selection updates selected coordinates & marker
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.45);
  }
  await expect(page.getByTestId("location-selected-coords")).toContainText(
    "Clique no mapa",
  );

  // 9. Mobile viewport (390x844) with open location query & 11-stage results -> zero horizontal overflow
  await page.getByTestId("analyze-all-stages-btn").click();
  await expect(page.getByTestId("cross-stage-results")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  expect(errors).toEqual([]);
});

test("cross-stage query aborts and ignores out-of-order responses when user switches to a new point", async ({
  page,
}) => {
  await page.route("**/tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/demotiles.maplibre.org/**", (route) => route.abort());

  // Prevent fetch abort on level=300 so slow response completes AFTER switching points
  await page.addInitScript(() => {
    const nativeFetch = window.fetch;
    window.fetch = (input, options) =>
      nativeFetch(
        input,
        String(input).includes("level=300")
          ? { ...options, signal: undefined }
          : options,
      );
  });

  let releaseSlow300: (() => void) | undefined;
  let slow300Started = false;

  await page.route("**/api/sgb/flood?*", async (route) => {
    const level = Number(
      new URL(route.request().url()).searchParams.get("level"),
    );
    if (level === 300 && !slow300Started) {
      slow300Started = true;
      await new Promise<void>((resolve) => {
        releaseSlow300 = resolve;
      });
    }
    await route.fulfill({ json: makeStageWithHoleAndNonNestedPayload(level) });
  });

  await page.goto("/");
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/official/);

  const latInput = page.getByLabel("Latitude (WGS84)");
  const lonInput = page.getByLabel("Longitude (WGS84)");
  const submitBtn = page.getByRole("button", { name: "Consultar coordenadas" });

  // Point 1: start 11-stage query (blocks on level=300)
  await latInput.fill("-21.5350");
  await lonInput.fill("-42.1880");
  await submitBtn.click();
  await page.getByTestId("analyze-all-stages-btn").click();
  await expect.poll(() => slow300Started).toBe(true);
  await expect(page.getByTestId("cross-stage-progress")).toBeVisible();

  // Immediately switch to Point 2 (outside coverage) before Point 1 finishes
  await latInput.fill("-21.6200");
  await lonInput.fill("-42.3100");
  await submitBtn.click();

  // Cross-stage panel must have reset to idle for Point 2 (no stale results from Point 1!)
  await expect(page.getByTestId("cross-stage-results")).toHaveCount(0);

  // Release the stale level=300 response from Point 1 -> must NOT re-populate Point 1 results!
  const staleRes = page.waitForResponse((res) => res.url().includes("level=300"));
  releaseSlow300?.();
  await (await staleRes).finished();

  await expect(page.getByTestId("cross-stage-results")).toHaveCount(0);
  await expect(page.getByTestId("location-relation-result")).toHaveAttribute(
    "data-coverage",
    "outside_model_coverage",
  );
});
