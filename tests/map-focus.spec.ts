import { expect, test } from "@playwright/test";

test("compact map controls and focus mode preserve scenario state on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/sgb/flood?*", async (route) => {
    const level = Number(new URL(route.request().url()).searchParams.get("level"));
    const geometry = { type: "Polygon", coordinates: [[[-42.19,-21.54],[-42.18,-21.54],[-42.18,-21.53],[-42.19,-21.53],[-42.19,-21.54]]] };
    await route.fulfill({ json: {
      classification: "official_reference", levelCm: level, layerName: `COTA_${level}cm`,
      geojson: { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry }] },
    } });
  });
  await page.goto("/");
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/official/);
  const expanded = page.locator("#scenario-expanded-controls");
  await page.getByRole("button", { name: "Recolher controles" }).click();
  await expect(expanded).toBeHidden();
  await page.getByRole("button", { name: "Aumentar cota compacta em 25 centímetros" }).click();
  await expect(page.getByLabel("Cota SGB", { exact: true })).toHaveValue("450");
  await page.getByRole("button", { name: "Mapa em foco", exact: true }).click();
  await expect(page.locator("#map-information-panel")).toBeHidden();
  await expect(page.locator(".platform-root")).toHaveClass(/is-map-focused/);
  await expect(page.getByRole("button", { name: "Sair do mapa em foco" })).toBeVisible();
  await expect(page.locator(".map-focus-notice")).toBeVisible();
  await page.getByRole("button", { name: "Camadas", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Mancha SGB" })).toBeVisible();
  await page.getByRole("button", { name: "Recolher camadas" }).click();
  await page.getByRole("button", { name: "Comparar cenários", exact: true }).click();
  await page.getByLabel("Cota B", { exact: true }).selectOption("500");
  await expect(page.getByLabel("Cota A", { exact: true })).toHaveValue("450");
  await expect(page.getByLabel("Cota B", { exact: true })).toHaveValue("500");
  await page.keyboard.press("Escape");
  await expect(page.locator("#map-information-panel")).toBeVisible();
  await page.getByRole("button", { name: "Expandir controles" }).click();
  await expect(page.getByLabel("Cota A de referência SGB")).toHaveValue("450");
  await expect(page.getByLabel("Cota B de referência SGB")).toHaveValue("500");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
