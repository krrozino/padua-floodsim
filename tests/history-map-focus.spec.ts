import { expect, syntheticSgbPayload, test } from "./fixtures/offline-map";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("Histórico bloqueia associações e preserva exploração independente no mapa em foco", async ({ page }) => {
  const requestedLevels: number[] = [];
  await page.route("**/api/sgb/flood?*", async (route) => {
    const level = Number(new URL(route.request().url()).searchParams.get("level"));
    requestedLevels.push(level);
    await route.fulfill({ json: syntheticSgbPayload(level) });
  });

  await page.goto("/");
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/official/);
  const navigation = page.getByRole("navigation", { name: "Navegação principal" });
  const historyButton = navigation.getByRole("button", { name: "Histórico", exact: true });
  const historyHeading = page.getByRole("heading", {
    name: "Histórico hidrológico e acervo de enchentes",
  });
  await historyButton.tap();
  await expect(historyHeading).toBeVisible();

  const events = page.locator(".history-event-card");
  const detail = page.locator(".history-detail-panel");
  await expect(events).toHaveCount(13);
  for (const event of await events.all()) {
    await event.tap();
    await expect(detail).toContainText("Associação histórica ao mapa bloqueada:");
    await expect(detail.getByRole("button", {
      name: /Associar cenário|Abrir extensão oficial modelada|Comparar cotas adjacentes/,
    })).toHaveCount(0);
  }
  expect(requestedLevels).toEqual([425]);

  await events.filter({ hasText: "HIST-2023-01-08" }).tap();
  await expect(detail).toContainText("continuidade do zero da régua");
  await expect(detail).toContainText("hgeoHNOR_IMBITUBA");
  await detail.getByRole("button", { name: /Explorar faixa SGB independente 4,25 × 4,50 m/ }).tap();
  const banner = page.locator(".historical-map-context-banner");
  await expect(banner).toContainText("Exploração independente derivada — faixa SGB 4,25 × 4,50 m");
  await expect(banner).toContainText("Equivalência altimétrica histórica NÃO confirmada");
  await expect(banner).toContainText("não representa inundação observada");
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/official/);
  expect(requestedLevels).toEqual([425, 450]);

  const enterFocus = page.getByRole("button", { name: "Mapa em foco", exact: true });
  const exitFocus = page.getByRole("button", { name: "Sair do mapa em foco", exact: true });
  const focusNote = page.locator(".map-focus-exploration-note");
  const stageA = page.getByRole("combobox", { name: "Cota A", exact: true });
  const stageB = page.getByRole("combobox", { name: "Cota B", exact: true });
  await enterFocus.tap();
  await expect(navigation).toBeHidden();
  await expect(focusNote).toBeInViewport();
  await expect(focusNote).toContainText("sem equivalência histórica confirmada");
  await expect(focusNote).toContainText("não representa inundação observada");
  await expect(stageA).toHaveValue("425");
  await expect(stageB).toHaveValue("450");
  await exitFocus.tap();
  await expect(navigation).toBeVisible();
  await banner.getByRole("button", { name: "Voltar ao Histórico" }).tap();
  await expect(historyHeading).toBeVisible();

  await page.getByRole("button", { name: "Voltar ao mapa", exact: true }).tap();
  await stageB.selectOption("475");
  await expect(banner).toHaveCount(0);
  await enterFocus.tap();
  await expect(stageB).toHaveValue("475");
  await expect(focusNote).toHaveCount(0);
  await page.getByRole("button", { name: "Camadas", exact: true }).tap();
  await expect(page.getByRole("checkbox", { name: "Manchas comparadas" })).toBeVisible();
  await page.getByRole("button", { name: "Recolher camadas", exact: true }).tap();
  await exitFocus.tap();
  await expect(stageB).toHaveValue("475");
  expect(requestedLevels).toEqual([425, 450, 475]);
  await historyButton.tap();
  await expect(historyHeading).toBeVisible();
  await expect(historyButton).toHaveAttribute("aria-current", "page");
});
