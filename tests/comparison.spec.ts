import { test, expect, type Page } from "@playwright/test";

// Synthetic payloads exist only in intercepted test responses, never in app data.
function makeStagePayload(
  level: number,
  options: { shifted?: boolean; invalidHole?: boolean } = {},
) {
  const span = 0.005 + (level - 300) * 0.00002;
  const shiftLon = options.shifted ? 0.003 : 0;
  const ring: [number, number][] = [
    [-42.19 + shiftLon, -21.54],
    [-42.19 + shiftLon + span, -21.54],
    [-42.19 + shiftLon + span, -21.54 + span],
    [-42.19 + shiftLon, -21.54 + span],
    [-42.19 + shiftLon, -21.54],
  ];
  const coords: [number, number][][] = [ring];
  if (options.invalidHole) {
    coords.push([
      [-42.189, -21.539],
      [-42.188, -21.539],
      [-42.189, -21.539],
    ]);
  }
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

async function lastSourceFeatureCount(page: Page, sourceName: string) {
  return page.evaluate(
    (name) =>
      (window as any).workerData
        .filter((d: any) => d.source === name)
        .at(-1)?.geojson.features.length ?? 0,
    sourceName,
  );
}

test("scenario comparison mode: 11-stage chart without 11 initial fetches, equal/different/non-nested topologies, snapshot divergence, and mobile layout", async ({
  page,
}) => {
  await instrumentWorker(page);
  await page.route("**/tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/demotiles.maplibre.org/**", (route) => route.abort());

  const requestedLevels: number[] = [];
  let shiftLevel500 = false;
  let invalidLevel325 = false;

  await page.route("**/api/sgb/flood?*", async (route) => {
    const level = Number(
      new URL(route.request().url()).searchParams.get("level"),
    );
    requestedLevels.push(level);
    await route.fulfill({
      json: makeStagePayload(level, {
        shifted: shiftLevel500 && level === 500,
        invalidHole: invalidLevel325 && level === 325,
      }),
    });
  });

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/official/);

  // 1. Only 1 SGB request on initial open (not 11!), while chart shows all 11 cataloged stages
  expect(requestedLevels).toEqual([425]);
  await expect(page.locator(".area-chart-bar-btn")).toHaveCount(11);
  await expect(page.locator("body")).toContainText(
    "Cota de referência SGB — Pádua II (58790002)",
  );

  // Synthetic geometry differs from the 25/11/2026 cataloged snapshot -> divergence warning must appear
  await expect(page.getByTestId("snapshot-divergence-warning")).toBeVisible();

  // Clicking a bar in single mode updates the selected stage
  await page
    .getByRole("button", { name: /Cota 3,00 m \(300 cm\)/ })
    .click();
  await expect(page.locator(".scenario-status-badge")).toContainText("3,00 m");

  // 2. Switch to comparison mode (default B = 5.50 m, A = 3.00 m)
  await page.getByRole("button", { name: "Comparar cenários" }).click();
  await expect(page.locator(".comparison-metric-card")).toBeVisible();
  await expect(page.locator(".scenario-status-badge")).toContainText(
    "Comparação A 3,00 m × B 5,50 m",
  );
  await expect(page.getByTestId("comparison-delta-ha")).toContainText("+");
  await expect(page.getByTestId("comparison-delta-pct")).toContainText("+");
  await expect.poll(() => lastSourceFeatureCount(page, "flood-compare-common")).toBe(1);
  await expect.poll(() => lastSourceFeatureCount(page, "flood-compare-only-b")).toBe(1);
  await expect.poll(() => lastSourceFeatureCount(page, "flood-compare-only-a")).toBe(0);

  // Legend clearly distinguishes A ∩ B, A \ B, B \ A
  await expect(page.locator("body")).toContainText("Área comum (A ∩ B)");
  await expect(page.locator("body")).toContainText("Exclusiva de A (A \\ B)");
  await expect(page.locator("body")).toContainText("Exclusiva de B (B \\ A)");

  // 3. Equal stages (A = 3.00 m, B = 3.00 m) -> 0,00 ha delta and 0,0%
  await page.getByLabel("Cota B de referência SGB").selectOption("300");
  await expect(page.getByTestId("comparison-delta-ha")).toHaveText("0,00 ha");
  await expect(page.getByTestId("comparison-delta-pct")).toHaveText("0,0%");
  await expect(page.getByTestId("comparison-only-a-ha")).toHaveText("0,00 ha");
  await expect(page.getByTestId("comparison-only-b-ha")).toHaveText("0,00 ha");

  // 4. Partially overlapping non-nested geometries (A = 4.25 m, B = 5.00 m shifted)
  shiftLevel500 = true;
  await page.getByLabel("Cota A de referência SGB").selectOption("425");
  await page.getByLabel("Cota B de referência SGB").selectOption("500");
  await expect(page.locator(".scenario-status-badge")).toContainText(
    "Comparação A 4,25 m × B 5,00 m",
  );
  await expect.poll(() => lastSourceFeatureCount(page, "flood-compare-common")).toBe(1);
  await expect.poll(() => lastSourceFeatureCount(page, "flood-compare-only-a")).toBe(1);
  await expect.poll(() => lastSourceFeatureCount(page, "flood-compare-only-b")).toBe(1);
  expect(await page.getByTestId("comparison-only-a-ha").textContent()).not.toBe("0,00 ha");
  expect(await page.getByTestId("comparison-only-b-ha").textContent()).not.toBe("0,00 ha");

  // Swap A ⇄ B reverses the signed delta
  await page.getByRole("button", { name: "Inverter A ⇄ B" }).click();
  await expect(page.locator(".scenario-status-badge")).toContainText(
    "Comparação A 5,00 m × B 4,25 m",
  );
  await expect(page.getByTestId("comparison-delta-ha")).toContainText("−");

  // 5. Fail-closed on invalid hole in Scenario B -> error box, no partial metrics, layers cleared
  invalidLevel325 = true;
  await page.getByLabel("Cota B de referência SGB").selectOption("325");
  await expect(page.locator(".comparison-state-box.error")).toContainText(
    "falha fechada",
  );
  await expect(page.getByTestId("comparison-delta-ha")).toHaveCount(0);
  await expect.poll(() => lastSourceFeatureCount(page, "flood-compare-common")).toBe(0);

  // Recover by clicking a valid stage on the chart (target defaults to B)
  await page.getByRole("button", { name: /Cota 5,50 m \(550 cm\)/ }).click();
  await expect(page.getByTestId("comparison-delta-ha")).toBeVisible();

  // 6. Mobile responsiveness (390x844) in comparison mode with zero horizontal overflow
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  expect(errors).toEqual([]);
});

test("comparison mode handles rapid selection and out-of-order responses for Scenario B without stale overlay", async ({
  page,
}) => {
  await instrumentWorker(page);
  await page.route("**/tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/demotiles.maplibre.org/**", (route) => route.abort());

  // Prevent abort on level=350 so the delayed response actually completes after level=550
  await page.addInitScript(() => {
    const nativeFetch = window.fetch;
    window.fetch = (input, options) =>
      nativeFetch(
        input,
        String(input).includes("level=350")
          ? { ...options, signal: undefined }
          : options,
      );
  });

  let releaseSlow350: (() => void) | undefined;
  let slow350Started = false;

  await page.route("**/api/sgb/flood?*", async (route) => {
    const level = Number(
      new URL(route.request().url()).searchParams.get("level"),
    );
    if (level === 350) {
      slow350Started = true;
      await new Promise<void>((resolve) => {
        releaseSlow350 = resolve;
      });
    }
    await route.fulfill({ json: makeStagePayload(level) });
  });

  await page.goto("/");
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/official/);

  await page.getByRole("button", { name: "Comparar cenários" }).click();
  await expect(page.locator(".scenario-status-badge")).toContainText(
    "Comparação A 4,25 m × B 5,50 m",
  );

  // Trigger slow B=350, then rapidly switch B to 525
  const selectB = page.getByLabel("Cota B de referência SGB");
  await selectB.selectOption("350");
  await expect.poll(() => slow350Started).toBe(true);
  await selectB.selectOption("525");

  await expect(page.locator(".scenario-status-badge")).toContainText(
    "Comparação A 4,25 m × B 5,25 m",
  );
  const delta525 = await page.getByTestId("comparison-delta-ha").textContent();

  // Now release the stale 350 response — must NOT overwrite 525!
  const staleRes = page.waitForResponse((res) => res.url().includes("level=350"));
  releaseSlow350?.();
  await (await staleRes).finished();

  await expect(page.locator(".scenario-status-badge")).toContainText(
    "Comparação A 4,25 m × B 5,25 m",
  );
  expect(await page.getByTestId("comparison-delta-ha").textContent()).toBe(
    delta525,
  );
});
