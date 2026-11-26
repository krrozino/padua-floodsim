import { expect, test } from "@playwright/test";

function sgbPayload(level: number) {
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

test("Histórico module: timeline, filters, station independence, divergences, comparison, map association, control points, and mobile layout", async ({
  page,
}) => {
  await page.route("**/tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/demotiles.maplibre.org/**", (route) => route.abort());

  const requestedLevels: number[] = [];
  await page.route("**/api/sgb/flood?*", async (route) => {
    const level = Number(
      new URL(route.request().url()).searchParams.get("level"),
    );
    requestedLevels.push(level);
    await route.fulfill({ json: sgbPayload(level) });
  });

  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.goto("/");
  await expect(page.locator(".scenario-status-badge")).toHaveClass(/official/);
  // Initial load requests only default 425 cm
  expect(requestedLevels).toEqual([425]);

  // Navigate to Histórico
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Histórico hidrológico e acervo de enchentes",
    }),
  ).toBeVisible();

  // No raw internal tokens or mock labels leaked in visible body text
  await expect(page.locator("body")).not.toContainText("official_reference");
  await expect(page.locator("body")).not.toContainText("em breve");
  await expect(page.locator("nav button:disabled")).toHaveCount(0);

  // Verify all 13 cataloged events are listed initially, newest first
  const timelineCards = page.locator(".history-event-card");
  await expect(timelineCards).toHaveCount(13);
  await expect(timelineCards.first()).toContainText("HIST-2026-03-21");

  // Default selected event is HIST-2026-02-25
  const detailPanel = page.locator(".history-detail-panel");
  await expect(detailPanel).toContainText("HIST-2026-02-25");
  await expect(detailPanel).toContainText("6,314 m");
  await expect(detailPanel).toContainText("412 cm");
  await expect(detailPanel).toContainText("BLOCKED_LOCAL_DATA");

  // Sort chronologically (oldest first -> 2012 first)
  await page.locator("#history-filter-sort").selectOption("oldest_first");
  await expect(timelineCards.first()).toContainText("HIST-2012-01-04");

  // Inspect 2012: DST note and blocked map association due to unverified pre-2020 gauge-zero continuity
  await timelineCards.first().click();
  await expect(detailPanel).toContainText("HIST-2012-01-04");
  await expect(detailPanel).toContainText("BRST");
  await expect(detailPanel).toContainText(
    "Associação ao mapa não habilitada para este evento",
  );

  // Filter by station INEA-213042120 -> must exclude HIST-2023-01-08 (modem outage)
  await page
    .locator("#history-filter-station")
    .selectOption("INEA-213042120");
  await expect(page.locator(".history-timeline-list")).not.toContainText(
    "HIST-2023-01-08",
  );
  await expect(page.locator(".history-timeline-list")).toContainText(
    "HIST-2026-02-25",
  );

  // Clear filters and filter to year 2023
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.locator("#history-filter-year").selectOption("2023");
  await expect(timelineCards).toHaveCount(2);

  // Select HIST-2023-01-08 and verify 428 vs 431 cm divergence, INEA gap, Braúna flatline, and photo credit
  await page
    .locator(".history-event-card", { hasText: "HIST-2023-01-08" })
    .click();
  await expect(detailPanel).toContainText("428 cm");
  await expect(detailPanel).toContainText("431 cm");
  await expect(detailPanel).toContainText("LACUNA CRÍTICA");
  await expect(detailPanel).toContainText("81,08%");
  await expect(detailPanel).toContainText("Tiago Vieira / PR Drone");
  await expect(detailPanel).toContainText("Praça Pereira Lima");

  // Filter to 2020 elevated hydrological events -> verify HIST-2020-02-13 separation
  await page.locator("#history-filter-year").selectOption("2020");
  await page
    .locator("#history-filter-class")
    .selectOption("elevated_hydrological_event");
  await expect(timelineCards).toHaveCount(2);
  await page
    .locator(".history-event-card", { hasText: "HIST-2020-02-13" })
    .click();
  await expect(detailPanel).toContainText(
    "Evento hidrológico elevado (sem confirmação urbana)",
  );
  await expect(detailPanel).toContainText("408 cm");

  // Event comparison tool: valid comparison on INEA (2022 vs 2026) and fail-closed on 2023 outage
  const cmpCard = page.locator(".history-comparison-card");
  await expect(cmpCard).toContainText("-11 cm");
  await page.locator("#hist-cmp-station").selectOption("INEA-213042120");
  await expect(cmpCard).toContainText("6,452 m");
  await expect(cmpCard).toContainText("6,314 m");
  await page.locator("#hist-cmp-event-b").selectOption("HIST-2023-01-08");
  await expect(cmpCard).toContainText(
    "Comparação bloqueada para a combinação selecionada",
  );

  // Clear filters, select HIST-2023-01-08, and associate approximate SGB 4,25 m scenario on map
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page
    .locator(".history-event-card", { hasText: "HIST-2023-01-08" })
    .click();
  await page
    .getByRole("button", {
      name: /Associar cenário SGB aproximado \(4,25 m\) no mapa/,
    })
    .click();

  const histBanner = page.locator(".historical-map-context-banner");
  await expect(histBanner).toBeVisible();
  await expect(histBanner).toContainText("HIST-2023-01-08");
  await expect(histBanner).toContainText(
    "não representa inundação observada",
  );

  // Stepping slider to 4,50 m automatically clears historical single-stage association
  await page
    .getByRole("button", { name: "Aumentar cota em 25 centímetros" })
    .click();
  await expect(histBanner).toHaveCount(0);

  // Return to Histórico and launch bracketing comparison 4,25 × 4,50 m without interpolation
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await page
    .locator(".history-event-card", { hasText: "HIST-2023-01-08" })
    .click();
  await page
    .getByRole("button", {
      name: /Comparar cotas adjacentes 4,25 × 4,50 m no mapa/,
    })
    .click();
  await expect(histBanner).toBeVisible();
  await expect(histBanner).toContainText(
    "Representação derivada — faixa SGB 4,25 × 4,50 m",
  );
  await page.getByRole("button", { name: "Voltar ao Histórico" }).click();

  // Inspect verified control point coordinate (Praça Monsenhor Diniz) on map
  await page
    .locator(".control-point-item", { hasText: "Praça Monsenhor Diniz" })
    .getByRole("button", { name: "Consultar ponto no mapa" })
    .click();
  await expect(page.locator(".location-selected-meta")).toContainText(
    "-21,54321, -42,17721",
  );

  // Mobile responsiveness check (390x844) without horizontal overflow
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  expect(pageErrors).toEqual([]);
});
