import { test, expect, type Page } from "@playwright/test";
import type { HydroMonitoringResponse } from "../lib/hydro/contract";

function sgbPayload(level: number) {
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
                [-42.18, -21.54],
                [-42.18, -21.53],
                [-42.19, -21.54],
              ],
            ],
          },
        },
      ],
    },
  };
}

function makeHydroObservation(
  overrides: Partial<HydroMonitoringResponse> & {
    stageCm?: number | null;
    includeRain?: boolean;
  } = {},
): HydroMonitoringResponse {
  const status = overrides.status ?? "fresh";
  const stageCm = overrides.stageCm === undefined ? 417 : overrides.stageCm;
  const measuredAt =
    status === "unavailable" || status === "invalid"
      ? null
      : (overrides.measuredAt ?? "2026-11-24T23:45:00-03:00");
  const retrievedAt = overrides.retrievedAt ?? "2026-11-25T02:57:00.000Z";
  const includeRain = overrides.includeRain ?? true;

  return {
    schemaVersion: "1.0",
    classification: "observed",
    status,
    provider: "inea",
    institution: "INEA — Instituto Estadual do Ambiente (Alerta de Cheias)",
    station: {
      stationId: "213042120",
      stationName: "Santo Antônio de Pádua",
      riverName: "Rio Pomba",
      coordinates: {
        latitude: -21.511110305786,
        longitude: -42.207527160645,
        crs: "EPSG:4326",
      },
      publicPageUrl:
        "https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.html",
      sourceUrl:
        "https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.xml",
      gaugeReference: {
        stationCode: "213042120",
        rhnCode: null,
        gaugeZeroMeters: null,
        verticalDatum: null,
        attentionStageCm: 400,
        overflowStageCm: 500,
        crosswalkValidated: false,
      },
    },
    measuredAt,
    retrievedAt,
    ageMinutes:
      status === "unavailable" || status === "invalid"
        ? null
        : (overrides.ageMinutes ?? (status === "stale" ? 55 : 12)),
    freshnessPolicy: {
      expectedCadenceMinutes: 15,
      staleAfterMinutes: 45,
      cacheTtlSeconds: 300,
    },
    latestStage:
      status === "unavailable" || status === "invalid" || stageCm === null
        ? null
        : {
            classification: "observed",
            provider: "inea",
            institution: "INEA — Instituto Estadual do Ambiente (Alerta de Cheias)",
            stationId: "213042120",
            stationName: "Santo Antônio de Pádua",
            riverName: "Rio Pomba",
            coordinates: {
              latitude: -21.511110305786,
              longitude: -42.207527160645,
              crs: "EPSG:4326",
            },
            sourceUrl:
              "https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.xml",
            publicPageUrl:
              "https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.html",
            sourceRecordId: `inea:213042120:${measuredAt}`,
            measuredAt: measuredAt!,
            retrievedAt,
            stageCm,
            unitOriginal: "m",
            rawValue: (stageCm / 100).toFixed(2),
            gaugeReference: {
              stationCode: "213042120",
              rhnCode: null,
              gaugeZeroMeters: null,
              verticalDatum: null,
              attentionStageCm: 400,
              overflowStageCm: 500,
              crosswalkValidated: false,
            },
            qualityFlags: status === "stale" ? ["stale"] : [],
            status,
            sourceHashSha256: "a".repeat(64),
            parserVersion: "inea-xml-v1.0.0",
          },
    recentTrend:
      status === "unavailable" || status === "invalid"
        ? null
        : overrides.recentTrend !== undefined
          ? overrides.recentTrend
          : {
              direction: "falling",
              deltaCm: -5,
              windowMinutes: 60,
              referenceMeasuredAt: "2026-11-24T22:45:00-03:00",
            },
    rainfall:
      !includeRain || status === "unavailable" || status === "invalid"
        ? []
        : [
            {
              classification: "observed",
              provider: "inea",
              stationId: "213042120",
              sensorId: "213042120-plu-15m",
              window: "15m",
              windowMinutes: 15,
              label: "15 min",
              measuredAt: measuredAt!,
              retrievedAt,
              rainMm: 0,
              unitOriginal: "mm",
              rawValue: "0.0",
              qualityFlags: [],
              parserVersion: "inea-xml-v1.0.0",
            },
            {
              classification: "observed",
              provider: "inea",
              stationId: "213042120",
              sensorId: "213042120-plu-24h",
              window: "24h",
              windowMinutes: 1440,
              label: "24 h",
              measuredAt: measuredAt!,
              retrievedAt,
              rainMm: 0.2,
              unitOriginal: "mm",
              rawValue: "0.2",
              qualityFlags: [],
              parserVersion: "inea-xml-v1.0.0",
            },
          ],
    qualityFlags:
      overrides.qualityFlags ??
      (status === "stale"
        ? ["stale"]
        : status === "unavailable"
          ? ["upstream_error"]
          : status === "invalid"
            ? ["malformed_payload"]
            : []),
    message:
      overrides.message ??
      (status === "fresh"
        ? "Leitura oficial observada e atualizada dentro da janela operacional do INEA."
        : status === "stale"
          ? "Última leitura observada há 55 min (acima da janela de 45 min)."
          : status === "unavailable"
            ? "Não foi possível consultar a estação oficial do INEA neste momento."
            : "Payload inválido recebido da fonte oficial."),
    scientificDisclaimer:
      "Medição observada na estação INEA 213042120. Não altera automaticamente a mancha oficial SGB.",
  };
}

async function stubBaseMapAndSgb(page: Page) {
  await page.route("**/tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/demotiles.maplibre.org/**", (route) => route.abort());
  await page.route("**/api/sgb/flood?*", async (route) => {
    const level = Number(new URL(route.request().url()).searchParams.get("level"));
    await route.fulfill({ json: sgbPayload(level) });
  });
}

test("replaces mock panel, displays observed states including zero stage, and handles unavailable/invalid", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-25T02:57:00Z"));
  await stubBaseMapAndSgb(page);

  let mode: "hold" | "fresh" | "zero" | "stale" | "unavailable" | "invalid" = "hold";
  let releaseHold: (() => void) | undefined;

  await page.route("**/api/hydro/observations*", async (route) => {
    if (mode === "hold") {
      await new Promise<void>((resolve) => {
        releaseHold = resolve;
      });
    }
    if (mode === "unavailable") {
      return route.fulfill({
        status: 503,
        json: makeHydroObservation({ status: "unavailable" }),
      });
    }
    if (mode === "invalid") {
      return route.fulfill({
        status: 502,
        body: "{not-valid-json",
        contentType: "application/json",
      });
    }
    if (mode === "stale") {
      return route.fulfill({
        status: 200,
        json: makeHydroObservation({
          status: "stale",
          measuredAt: "2026-11-24T22:50:00-03:00",
          ageMinutes: 67,
        }),
      });
    }
    if (mode === "zero") {
      return route.fulfill({
        status: 200,
        json: makeHydroObservation({
          status: "fresh",
          stageCm: 0,
          recentTrend: null,
          includeRain: false,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      json: makeHydroObservation({ status: "fresh", stageCm: 417 }),
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const card = page.locator("#realtime-card");

  // Mock strings must never exist in the public UI.
  await expect(page.locator("body")).not.toContainText("MOCK / DEMO");
  await expect(page.locator("body")).not.toContainText("Nível fictício");
  await expect(page.locator("body")).not.toContainText("4,35 m");
  await expect(page.locator("body")).not.toContainText("62 mm");

  await expect(card).toContainText("Carregando...");
  await expect(card).toContainText("Consultando...");

  mode = "fresh";
  releaseHold?.();

  await expect(card).toContainText("observed");
  await expect(card).toContainText("Atualizado");
  await expect(card).toContainText("4,17 m");
  await expect(card).toContainText("417 cm na régua INEA");
  await expect(card).toContainText("Descendo ↘");
  await expect(card).toContainText("24/11/2026 às 23:45 (BRT)");
  await expect(card).toContainText("24/11/2026 às 23:57 (BRT)");
  await expect(card).toContainText("0,0 mm");
  await expect(card).toContainText("0,2 mm");

  const sourceLink = card.getByRole("link", {
    name: /Fonte oficial INEA \(213042120\)/,
  });
  await expect(sourceLink).toHaveAttribute(
    "href",
    "https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.html",
  );

  // Legitimate 0.00 m stage must render as 0,00 m and not as missing/unavailable.
  mode = "zero";
  await card.getByRole("button", { name: "Atualizar leitura" }).click();
  await expect(card).toContainText("0,00 m");
  await expect(card).toContainText("0 cm na régua INEA");
  await expect(card).toContainText("Não calculável");
  await expect(card).not.toContainText("Chuva observada");

  // Stale reading state
  mode = "stale";
  await card.getByRole("button", { name: "Atualizar leitura" }).click();
  await expect(card).toContainText("Desatualizado");
  await expect(card).toContainText("4,17 m");

  // Unavailable upstream state -> no numbers shown
  mode = "unavailable";
  await card.getByRole("button", { name: "Atualizar leitura" }).click();
  await expect(card).toContainText("Fonte indisponível");
  await expect(card).toContainText("Indisponível");
  await expect(card).not.toContainText("4,17 m");

  // Invalid payload state -> no numbers shown
  mode = "invalid";
  await card.getByRole("button", { name: "Atualizar leitura" }).click();
  await expect(card).toContainText("Dado inválido");
  await expect(card).toContainText("Indisponível");

  // Recovery on next valid refresh
  mode = "fresh";
  await card.getByRole("button", { name: "Atualizar leitura" }).click();
  await expect(card).toContainText("Atualizado");
  await expect(card).toContainText("4,17 m");
});

test("transitions from fresh to stale via injectable clock and polls every 5 minutes", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-25T02:57:00Z") });
  await stubBaseMapAndSgb(page);

  let requestCount = 0;
  let serveFresh = true;

  await page.route("**/api/hydro/observations*", async (route) => {
    requestCount += 1;
    if (serveFresh) {
      return route.fulfill({
        status: 200,
        json: makeHydroObservation({
          status: "fresh",
          stageCm: 417,
          measuredAt: "2026-11-24T23:45:00-03:00",
          ageMinutes: 12,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      json: makeHydroObservation({
        status: "fresh",
        stageCm: 429,
        measuredAt: "2026-11-25T00:35:00-03:00",
        retrievedAt: "2026-11-25T03:37:00.000Z",
        ageMinutes: 2,
      }),
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const card = page.locator("#realtime-card");
  await expect(card).toContainText("Atualizado");
  await expect(card).toContainText("4,17 m");
  expect(requestCount).toBe(1);

  // Advance 5 minutes -> periodic poll runs
  await page.clock.runFor(300_000);
  await expect.poll(() => requestCount).toBeGreaterThanOrEqual(2);

  // Simulate upstream freezing on old timestamp while clock advances past 45 min
  await page.route("**/api/hydro/observations*", async (route) => {
    requestCount += 1;
    return route.fulfill({
      status: 200,
      json: makeHydroObservation({
        status: "fresh",
        stageCm: 417,
        measuredAt: "2026-11-24T23:45:00-03:00",
        ageMinutes: 12,
      }),
    });
  });

  await page.clock.fastForward(40 * 60_000);
  await expect(card).toContainText("Desatualizado");

  // Next poll delivers newer reading -> recovers to Atualizado
  await page.unroute("**/api/hydro/observations*");
  serveFresh = false;
  await page.route("**/api/hydro/observations*", async (route) => {
    requestCount += 1;
    return route.fulfill({
      status: 200,
      json: makeHydroObservation({
        status: "fresh",
        stageCm: 429,
        measuredAt: "2026-11-25T00:35:00-03:00",
        retrievedAt: "2026-11-25T03:45:00.000Z",
        ageMinutes: 2,
      }),
    });
  });

  await page.clock.runFor(300_000);
  await expect(card).toContainText("Atualizado");
  await expect(card).toContainText("4,29 m");
});

test("keeps INEA observations scientifically independent from SGB scenarios across desktop and mobile", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-25T02:57:00Z"));
  await stubBaseMapAndSgb(page);

  await page.route("**/api/hydro/observations*", async (route) => {
    await route.fulfill({
      status: 200,
      json: makeHydroObservation({ status: "fresh", stageCm: 520 }),
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  const card = page.locator("#realtime-card");
  const sliderCard = page.locator(".slider-card");

  // INEA reads 5,20 m, but SGB slider MUST remain at its default 4,25 m scenario.
  await expect(card).toContainText("5,20 m");
  await expect(sliderCard).toContainText("4,25 m");
  await expect(page.locator(".demo-badge")).toContainText("4,25 m");

  // Changing SGB scenario must never mutate observed INEA reading.
  await page.getByRole("button", { name: "3,00 m", exact: true }).click();
  await expect(page.locator(".demo-badge")).toContainText("3,00 m");
  await expect(card).toContainText("5,20 m");

  await page.getByRole("button", { name: "5,50 m", exact: true }).click();
  await expect(page.locator(".demo-badge")).toContainText("5,50 m");
  await expect(card).toContainText("5,20 m");

  await page.screenshot({ path: "test-results/hydro-desktop.png" });

  // Mobile viewport responsiveness check
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(card).toContainText("5,20 m");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/hydro-mobile.png",
    fullPage: true,
  });
});

test("rejects refresh=1 and arbitrary query params at API boundary and preserves scientific precision in UI", async ({
  page,
  request,
}) => {
  const refreshRes = await request.get("/api/hydro/observations?refresh=1");
  expect(refreshRes.status()).toBe(400);
  expect(refreshRes.headers()["cache-control"]).toBe("no-store");
  const refreshBody = await refreshRes.json();
  expect(refreshBody.error).toBe("unsupported_query_parameter");

  const arbitraryRes = await request.get(
    "/api/hydro/observations?provider=inea&nocache=123",
  );
  expect(arbitraryRes.status()).toBe(400);
  expect(arbitraryRes.headers()["cache-control"]).toBe("no-store");

  await page.clock.setFixedTime(new Date("2026-11-25T02:57:00Z"));
  await stubBaseMapAndSgb(page);
  await page.route("**/api/hydro/observations*", async (route) => {
    await route.fulfill({
      status: 200,
      json: makeHydroObservation({ status: "fresh", stageCm: 342 }),
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const card = page.locator("#realtime-card");
  await expect(card).toContainText("zero da régua e datum ainda não identificados");
  await expect(card).toContainText("equivalência entre as referências não foi estabelecida");
  await expect(card).not.toContainText("não são equivalentes");
});

