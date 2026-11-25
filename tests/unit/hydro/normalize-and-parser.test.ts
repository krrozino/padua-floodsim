import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { validateHydroMonitoringResponse } from "../../../lib/hydro/contract.ts";
import { parseIneaStationXml } from "../../../lib/hydro/ineaParser.ts";
import {
  PARSER_VERSION,
  convertStageToCm,
  evaluateFreshness,
  parseBrazilLocalDateTime,
  parseDecimalValue,
  parseRainMm,
} from "../../../lib/hydro/normalize.ts";

const SYNTHETIC_FIXTURE_XML = readFileSync(
  path.resolve(
    process.cwd(),
    "tests/fixtures/hydro/inea-213042120-synthetic.xml",
  ),
  "utf8",
);

function makeSyntheticXml(
  recordsXml: string,
  codigo = "213042120",
): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<estacao codigo="${codigo}" tipo="Plu/Flu">
  <nome_estacao>Santo Antônio de Pádua</nome_estacao>
  <dados_ultimos_10_dias>
    ${recordsXml}
  </dados_ultimos_10_dias>
</estacao>`;
}

function makeRecordXml(overrides: Partial<{
  data_hora: string;
  chuva_ultimo: string;
  chuva_1h: string;
  chuva_4h: string;
  chuva_24h: string;
  chuva_96h: string;
  chuva_30d: string;
  nivel_rio_ultimo: string;
}> = {}): string {
  return `<registro>
    <nome_estacao>Santo Antônio de Pádua</nome_estacao>
    <data_hora>${overrides.data_hora ?? "24/11/2026 23:45"}</data_hora>
    <chuva_ultimo>${overrides.chuva_ultimo ?? "0.0"}</chuva_ultimo>
    <chuva_1h>${overrides.chuva_1h ?? "0.0"}</chuva_1h>
    <chuva_4h>${overrides.chuva_4h ?? "0.0"}</chuva_4h>
    <chuva_24h>${overrides.chuva_24h ?? "0.2"}</chuva_24h>
    <chuva_96h>${overrides.chuva_96h ?? "4.6"}</chuva_96h>
    <chuva_30d>${overrides.chuva_30d ?? "17.0"}</chuva_30d>
    <nivel_rio_ultimo>${overrides.nivel_rio_ultimo ?? "4.17"}</nivel_rio_ultimo>
  </registro>`;
}

describe("hydro normalization helpers", () => {
  it("distinguishes legitimate zero from missing sentinels and converts units", () => {
    assert.deepEqual(parseDecimalValue("0"), { kind: "value", value: 0 });
    assert.deepEqual(parseDecimalValue("0.0"), { kind: "value", value: 0 });
    assert.deepEqual(parseDecimalValue("0,00"), { kind: "value", value: 0 });
    assert.deepEqual(parseDecimalValue("Dado Nulo"), { kind: "missing" });
    assert.deepEqual(parseDecimalValue("-"), { kind: "missing" });
    assert.deepEqual(parseDecimalValue(" "), { kind: "missing" });
    assert.deepEqual(parseDecimalValue("1.2.3"), { kind: "invalid" });

    assert.deepEqual(convertStageToCm("4.17", "m"), {
      stageCm: 417,
      unitValid: true,
    });
    assert.deepEqual(convertStageToCm("4,17", "m"), {
      stageCm: 417,
      unitValid: true,
    });
    assert.deepEqual(convertStageToCm("0.0", "m"), {
      stageCm: 0,
      unitValid: true,
    });
    assert.deepEqual(convertStageToCm("310", "cm"), {
      stageCm: 310,
      unitValid: true,
    });
    assert.deepEqual(convertStageToCm("4.17", "ft"), {
      stageCm: null,
      unitValid: false,
      flag: "invalid_unit",
    });
    assert.deepEqual(convertStageToCm("-0.5", "m"), {
      stageCm: null,
      unitValid: true,
      flag: "suspect_range",
    });
    assert.deepEqual(convertStageToCm("25.0", "m"), {
      stageCm: null,
      unitValid: true,
      flag: "suspect_range",
    });

    assert.deepEqual(parseRainMm("0.0", "mm"), {
      rainMm: 0,
      unitValid: true,
    });
    assert.deepEqual(parseRainMm("4,6", "mm"), {
      rainMm: 4.6,
      unitValid: true,
    });
    assert.deepEqual(parseRainMm("4.6", "cm"), {
      rainMm: null,
      unitValid: false,
      flag: "invalid_unit",
    });
  });

  it("validates Brazil local timestamps and rejects impossible or future dates", () => {
    const nowMs = Date.parse("2026-11-25T02:56:00Z"); // 2026-11-24 23:56 BRT
    const valid = parseBrazilLocalDateTime("24/11/2026 23:45", nowMs);
    assert.ok(valid);
    assert.equal(valid.iso, "2026-11-24T23:45:00-03:00");
    assert.equal(valid.epochMs, Date.parse("2026-11-25T02:45:00Z"));

    assert.equal(parseBrazilLocalDateTime("31/02/2026 12:00", nowMs), null);
    assert.equal(parseBrazilLocalDateTime("24/11/2026 25:00", nowMs), null);
    assert.equal(parseBrazilLocalDateTime("2026-11-24 23:45", nowMs), null);
    assert.equal(parseBrazilLocalDateTime("25/11/2026 02:30", nowMs), null);
  });

  it("evaluates freshness deterministically from measuredAt vs injectable now", () => {
    const measuredAtMs = Date.parse("2026-11-24T23:45:00-03:00");
    assert.deepEqual(
      evaluateFreshness(measuredAtMs, measuredAtMs + 12 * 60_000, 45),
      { status: "fresh", ageMinutes: 12 },
    );
    assert.deepEqual(
      evaluateFreshness(measuredAtMs, measuredAtMs + 45 * 60_000, 45),
      { status: "fresh", ageMinutes: 45 },
    );
    assert.deepEqual(
      evaluateFreshness(measuredAtMs, measuredAtMs + 46 * 60_000, 45),
      { status: "stale", ageMinutes: 46 },
    );
  });
});

describe("INEA XML deterministic parser", () => {
  it("parses the synthetic INEA fixture with provenance, trend, and rainfall windows", () => {
    const now = new Date("2026-06-15T17:57:00Z"); // 14:57 BRT (12 min after 14:45)
    const parsed = parseIneaStationXml(SYNTHETIC_FIXTURE_XML, { now });

    assert.equal(validateHydroMonitoringResponse(parsed), true);
    assert.equal(parsed.classification, "observed");
    assert.equal(parsed.status, "fresh");
    assert.equal(parsed.ageMinutes, 12);
    assert.equal(parsed.measuredAt, "2026-06-15T14:45:00-03:00");
    assert.equal(parsed.retrievedAt, "2026-06-15T17:57:00.000Z");
    assert.equal(parsed.station.stationId, "213042120");
    assert.equal(parsed.station.gaugeReference.crosswalkValidated, false);
    assert.equal(parsed.station.gaugeReference.gaugeZeroMeters, null);
    assert.equal(parsed.station.gaugeReference.verticalDatum, null);

    assert.ok(parsed.latestStage);
    assert.equal(parsed.latestStage.stageCm, 342);
    assert.equal(parsed.latestStage.unitOriginal, "m");
    assert.equal(parsed.latestStage.rawValue, "3.42");
    assert.equal(parsed.latestStage.parserVersion, PARSER_VERSION);
    assert.match(parsed.latestStage.sourceHashSha256, /^[a-f0-9]{64}$/);

    // 14:45 (342 cm) vs 13:45 (348 cm) -> -6 cm falling
    assert.deepEqual(parsed.recentTrend, {
      direction: "falling",
      deltaCm: -6,
      windowMinutes: 60,
      referenceMeasuredAt: "2026-06-15T13:45:00-03:00",
    });

    assert.equal(parsed.rainfall.length, 6);
    assert.equal(parsed.rainfall[0].window, "15m");
    assert.equal(parsed.rainfall[0].rainMm, 0);
    assert.equal(parsed.rainfall[3].window, "24h");
    assert.equal(parsed.rainfall[3].rainMm, 1.2);
    assert.equal(parsed.rainfall[4].window, "96h");
    assert.equal(parsed.rainfall[4].rainMm, 5.8);
  });

  it("preserves legitimate zero stage and zero rainfall without treating zero as missing", () => {
    const xml = makeSyntheticXml(
      makeRecordXml({
        data_hora: "24/11/2026 23:45",
        nivel_rio_ultimo: "0.00",
        chuva_ultimo: "0",
        chuva_1h: "0,0",
      }),
    );
    const parsed = parseIneaStationXml(xml, {
      now: new Date("2026-11-25T02:50:00Z"),
    });

    assert.equal(validateHydroMonitoringResponse(parsed), true);
    assert.equal(parsed.status, "fresh");
    assert.equal(parsed.latestStage?.stageCm, 0);
    assert.equal(parsed.rainfall[0].rainMm, 0);
    assert.equal(parsed.rainfall[1].rainMm, 0);
  });

  it("marks delayed readings as stale when injectable clock exceeds 45 minutes", () => {
    const parsed = parseIneaStationXml(SYNTHETIC_FIXTURE_XML, {
      now: new Date("2026-06-15T18:40:00Z"), // 15/06 14:45 BRT + 55 min
    });

    assert.equal(validateHydroMonitoringResponse(parsed), true);
    assert.equal(parsed.status, "stale");
    assert.equal(parsed.ageMinutes, 55);
    assert.ok(parsed.qualityFlags.includes("stale"));
  });

  it("handles missing stage ('Dado Nulo') without fabricating zero and marks fallback as stale", () => {
    const xml = makeSyntheticXml(
      [
        makeRecordXml({
          data_hora: "24/11/2026 23:45",
          nivel_rio_ultimo: "Dado Nulo",
        }),
        makeRecordXml({
          data_hora: "24/11/2026 23:30",
          nivel_rio_ultimo: "4.18",
        }),
      ].join("\n"),
    );

    const parsed = parseIneaStationXml(xml, {
      now: new Date("2026-11-25T02:50:00Z"),
    });

    assert.equal(validateHydroMonitoringResponse(parsed), true);
    assert.equal(parsed.status, "stale");
    assert.equal(parsed.measuredAt, "2026-11-24T23:30:00-03:00");
    assert.equal(parsed.latestStage?.stageCm, 418);
    assert.ok(parsed.qualityFlags.includes("missing"));
    assert.ok(parsed.qualityFlags.includes("stale"));

    const allMissingXml = makeSyntheticXml(
      makeRecordXml({
        data_hora: "24/11/2026 23:45",
        nivel_rio_ultimo: "Dado Nulo",
      }),
    );
    const unavailable = parseIneaStationXml(allMissingXml, {
      now: new Date("2026-11-25T02:50:00Z"),
    });
    assert.equal(validateHydroMonitoringResponse(unavailable), true);
    assert.equal(unavailable.status, "unavailable");
    assert.equal(unavailable.latestStage, null);
    assert.ok(unavailable.qualityFlags.includes("missing"));
  });

  it("fails closed on invalid unit, invalid timestamp, malformed HTML/XML, or wrong station", () => {
    const now = new Date("2026-11-25T02:50:00Z");

    const badUnit = parseIneaStationXml(SYNTHETIC_FIXTURE_XML, {
      now,
      stageUnit: "ft",
    });
    assert.equal(badUnit.status, "invalid");
    assert.equal(badUnit.latestStage, null);
    assert.ok(badUnit.qualityFlags.includes("invalid_unit"));

    const badDate = parseIneaStationXml(
      makeSyntheticXml(makeRecordXml({ data_hora: "31/02/2026 23:45" })),
      { now },
    );
    assert.equal(badDate.status, "invalid");
    assert.ok(badDate.qualityFlags.includes("invalid_timestamp"));

    const htmlError = parseIneaStationXml(
      "<html><body><h1>503 Service Unavailable</h1></body></html>",
      { now },
    );
    assert.equal(htmlError.status, "invalid");
    assert.ok(htmlError.qualityFlags.includes("malformed_payload"));

    const wrongStation = parseIneaStationXml(
      makeSyntheticXml(makeRecordXml(), "999999999"),
      { now },
    );
    assert.equal(wrongStation.status, "invalid");
    assert.ok(wrongStation.qualityFlags.includes("malformed_payload"));

    const suspectStage = parseIneaStationXml(
      makeSyntheticXml(makeRecordXml({ nivel_rio_ultimo: "99.99" })),
      { now },
    );
    assert.equal(suspectStage.status, "invalid");
    assert.ok(suspectStage.qualityFlags.includes("suspect_range"));
  });

  it("deduplicates identical timestamps and flags out-of-order observations after sorting", () => {
    const outOfOrderAndDuplicateXml = makeSyntheticXml(
      [
        makeRecordXml({
          data_hora: "24/11/2026 22:45",
          nivel_rio_ultimo: "4.22",
        }),
        makeRecordXml({
          data_hora: "24/11/2026 23:45",
          nivel_rio_ultimo: "4.17",
        }),
        makeRecordXml({
          data_hora: "24/11/2026 23:45",
          nivel_rio_ultimo: "4.17",
        }),
      ].join("\n"),
    );

    const parsed = parseIneaStationXml(outOfOrderAndDuplicateXml, {
      now: new Date("2026-11-25T02:55:00Z"),
    });

    assert.equal(validateHydroMonitoringResponse(parsed), true);
    assert.equal(parsed.status, "fresh");
    assert.equal(parsed.measuredAt, "2026-11-24T23:45:00-03:00");
    assert.equal(parsed.latestStage?.stageCm, 417);
    assert.deepEqual(parsed.recentTrend, {
      direction: "falling",
      deltaCm: -5,
      windowMinutes: 60,
      referenceMeasuredAt: "2026-11-24T22:45:00-03:00",
    });
    assert.ok(parsed.qualityFlags.includes("duplicate"));
    assert.ok(parsed.qualityFlags.includes("out_of_order"));

    const conflictingDuplicatesXml = makeSyntheticXml(
      [
        makeRecordXml({
          data_hora: "24/11/2026 23:45",
          nivel_rio_ultimo: "4.17",
        }),
        makeRecordXml({
          data_hora: "24/11/2026 23:45",
          nivel_rio_ultimo: "4.95",
        }),
      ].join("\n"),
    );
    const conflict = parseIneaStationXml(conflictingDuplicatesXml, {
      now: new Date("2026-11-25T02:55:00Z"),
    });
    assert.equal(conflict.status, "invalid");
    assert.ok(conflict.qualityFlags.includes("duplicate"));
    assert.ok(conflict.qualityFlags.includes("malformed_payload"));
  });
});
