import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_HISTORICAL_FILTERS,
  compareHistoricalEventsOnStation,
  extractAvailableYears,
  filterAndSortHistoricalEvents,
  resolveHistoricalMapAssociation,
} from "../../../lib/history/analysis.ts";
import {
  HISTORICAL_FLOOD_EVENTS,
  HISTORICAL_STATION_REGISTRY,
  PROVENANCE_ARTIFACTS,
  getHistoricalEventById,
} from "../../../lib/history/catalog.ts";
import type { HistoricalFloodEvent } from "../../../lib/history/contract.ts";
import {
  HISTORICAL_CONTROL_POINTS,
  evaluateControlPointsForEventScenario,
} from "../../../lib/history/controlPoints.ts";
import {
  createInitialReplayState,
  prepareHistoricalHydrograph,
  seekHydrographReplay,
  sliceHydrographInterval,
  stepHydrographReplay,
} from "../../../lib/history/hydrograph.ts";
import {
  buildHistoricalTimestamp,
  formatHistoricalDischarge,
  formatHistoricalRain,
  formatHistoricalStage,
  normalizeStageReadingToCm,
} from "../../../lib/history/normalize.ts";

describe("R02-E Historical flood catalog and hydrological references", () => {
  it("maintains strict independence across all 5 stations and validates SGB crosswalk only on RHN 58790002", () => {
    assert.equal(HISTORICAL_STATION_REGISTRY.length, 5);
    const sgbCompatible = HISTORICAL_STATION_REGISTRY.filter(
      (s) => s.sgbCrosswalkValidated,
    );
    assert.equal(sgbCompatible.length, 1);
    assert.equal(sgbCompatible[0].id, "RHN-58790002");
    assert.equal(sgbCompatible[0].gaugeZeroMeters, 79.709);
    assert.equal(sgbCompatible[0].verticalDatum, "hgeoHNOR_IMBITUBA");

    const inea = HISTORICAL_STATION_REGISTRY.find(
      (s) => s.id === "INEA-213042120",
    );
    assert.ok(inea);
    assert.equal(inea.sgbCrosswalkValidated, false);
    assert.equal(inea.verticalDatum, null);
    assert.equal(inea.verticalDatumStatus, "unconfirmed");

    const paraoquena = HISTORICAL_STATION_REGISTRY.find(
      (s) => s.id === "INEA-58789000",
    );
    assert.ok(paraoquena);
    assert.equal(paraoquena.historicalAuditStatus, "inventory_only_not_audited");
  });

  it("separates documented urban floods from elevated hydrological events without mock values or zero-filled gaps", () => {
    assert.equal(HISTORICAL_FLOOD_EVENTS.length, 13);

    const ids = new Set<string>();
    let urbanFloodCount = 0;
    let elevatedHydroCount = 0;

    for (const ev of HISTORICAL_FLOOD_EVENTS) {
      assert.match(ev.id, /^HIST-\d{4}-\d{2}-\d{2}$/);
      assert.equal(ids.has(ev.id), false, `Duplicate event ID: ${ev.id}`);
      ids.add(ev.id);
      assert.ok(ev.startDateIso <= ev.endDateIso, `${ev.id} start > end`);

      if (ev.classification === "documented_urban_flood") {
        urbanFloodCount += 1;
        assert.ok(
          ev.urbanImpactSummary && ev.urbanImpactSummary.length > 10,
          `${ev.id} missing urbanImpactSummary`,
        );
      } else {
        elevatedHydroCount += 1;
      }

      for (const obs of ev.stationObservations) {
        if (obs.peakStageCm !== null) {
          assert.ok(obs.peakStageCm > 0, `${ev.id} ${obs.stationId} has zero/negative peak`);
        }
        if (obs.peakDischargeM3s !== null) {
          assert.ok(obs.peakDischargeM3s > 0);
        }
        if (obs.accumulatedRainMm !== null) {
          assert.ok(obs.accumulatedRainMm >= 0);
        }
      }

      for (const doc of ev.documentaryEvidence) {
        assert.match(doc.url, /^https?:\/\//);
        if (doc.kind === "external_photograph") {
          assert.ok(doc.photoAttribution, `${doc.id} missing photoAttribution`);
          assert.ok(doc.photoAttribution.photographerOrCredit.length > 3);
          assert.ok(doc.photoAttribution.verifiedLocation.length > 3);
        }
      }
    }

    assert.equal(urbanFloodCount, 6);
    assert.equal(elevatedHydroCount, 7);
    assert.ok(PROVENANCE_ARTIFACTS.length >= 9);
  });

  it("documents January 2023 SGB 428 vs 431 cm divergence, INEA modem outage, and Braúna flatline", () => {
    const jan2023 = getHistoricalEventById("HIST-2023-01-08");
    assert.ok(jan2023);
    assert.equal(jan2023.classification, "documented_urban_flood");

    const sgbObs = jan2023.stationObservations.find(
      (o) => o.stationId === "RHN-58790002",
    );
    assert.ok(sgbObs);
    assert.equal(sgbObs.peakStageCm, 428);
    assert.ok(sgbObs.secondaryPeaks.some((sp) => sp.valueCm === 431));

    const ineaObs = jan2023.stationObservations.find(
      (o) => o.stationId === "INEA-213042120",
    );
    assert.ok(ineaObs);
    assert.equal(ineaObs.availability, "unavailable_critical_gap");
    assert.equal(ineaObs.peakStageCm, null);
    assert.equal(ineaObs.usableForComparison, false);

    const braunaObs = jan2023.stationObservations.find(
      (o) => o.stationId === "RHN-58788600",
    );
    assert.ok(braunaObs);
    assert.equal(braunaObs.availability, "suspect_flatline");
    assert.equal(braunaObs.peakStageCm, null);
    assert.equal(braunaObs.usableForComparison, false);
  });
});

describe("R02-E Timestamp, DST, and unit normalization", () => {
  it("preserves ambiguous 2012 DST timestamps without silent UTC conversion and converts GMT/UTC accurately", () => {
    const ts2012 = buildHistoricalTimestamp(
      "2012-01-04 01:15",
      "LOCAL_AMBIGUOUS_BRST_OR_BRT",
    );
    assert.equal(ts2012.utcIso, null);
    assert.equal(ts2012.hasDstAmbiguity, true);
    assert.match(ts2012.displayBrt, /04\/01\/2012 01:15/);

    const ts2026Gmt = buildHistoricalTimestamp("2026-02-28 17:15 GMT", "GMT");
    assert.equal(ts2026Gmt.utcIso, "2026-02-28T17:15:00Z");
    assert.equal(ts2026Gmt.displayBrt, "28/02/2026 14:15 BRT (UTC−3)");
    assert.equal(ts2026Gmt.hasDstAmbiguity, false);
  });

  it("rejects negative sensor glitches and formats missing metrics without substituting zero", () => {
    assert.equal(normalizeStageReadingToCm(-0.769, "m"), null);
    assert.equal(normalizeStageReadingToCm(null, "cm"), null);
    assert.equal(normalizeStageReadingToCm(6.314, "m"), 631.4);

    assert.equal(formatHistoricalStage(null, null, "m"), "Não disponível");
    assert.equal(formatHistoricalDischarge(null), "Não disponível");
    assert.equal(formatHistoricalRain(null), "Não disponível");
    assert.match(formatHistoricalStage(631.4, 6.314, "m"), /6,314 m/);
  });
});

describe("R02-E Filtering, chronological ordering, and compatible comparison", () => {
  it("filters by year, verified station measurement, classification, and sorts deterministically", () => {
    const years = extractAvailableYears(HISTORICAL_FLOOD_EVENTS);
    assert.deepEqual(years, [2026, 2025, 2023, 2022, 2020, 2012]);

    const newestFirst = filterAndSortHistoricalEvents(
      HISTORICAL_FLOOD_EVENTS,
      DEFAULT_HISTORICAL_FILTERS,
    );
    assert.equal(newestFirst[0].id, "HIST-2026-03-21");
    assert.equal(newestFirst.at(-1)?.id, "HIST-2012-01-04");

    const oldestFirst = filterAndSortHistoricalEvents(HISTORICAL_FLOOD_EVENTS, {
      ...DEFAULT_HISTORICAL_FILTERS,
      sortOrder: "oldest_first",
    });
    assert.equal(oldestFirst[0].id, "HIST-2012-01-04");

    const ineaMeasured = filterAndSortHistoricalEvents(HISTORICAL_FLOOD_EVENTS, {
      ...DEFAULT_HISTORICAL_FILTERS,
      stationId: "INEA-213042120",
    });
    // Must exclude HIST-2023-01-08 (modem outage) and include HIST-2026-02-25, HIST-2022-01-08, HIST-2012-01-04
    assert.equal(
      ineaMeasured.some((e) => e.id === "HIST-2023-01-08"),
      false,
    );
    assert.equal(
      ineaMeasured.some((e) => e.id === "HIST-2026-02-25"),
      true,
    );
  });

  it("compares compatible events on the same station and blocks cross-station or missing/flatline comparisons", () => {
    const ev2022 = getHistoricalEventById("HIST-2022-01-08")!;
    const ev2026 = getHistoricalEventById("HIST-2026-02-25")!;
    const ev2023 = getHistoricalEventById("HIST-2023-01-08")!;
    const ev2012 = getHistoricalEventById("HIST-2012-01-04")!;

    const sgbCmp = compareHistoricalEventsOnStation(
      ev2022,
      ev2026,
      "RHN-58790002",
    );
    assert.equal(sgbCmp.status, "compatible");
    assert.equal(sgbCmp.deltaPeakCm, -11); // 412 - 423
    assert.equal(sgbCmp.deltaDischargeM3s, -2); // 1197.7 - 1199.7
    assert.equal(sgbCmp.deltaRainMm, -107.4); // 61.0 - 168.4

    const crossStation = compareHistoricalEventsOnStation(
      ev2022,
      ev2026,
      "RHN-58790002",
      "INEA-213042120",
    );
    assert.equal(crossStation.status, "blocked");

    const ineaOutageCmp = compareHistoricalEventsOnStation(
      ev2022,
      ev2023,
      "INEA-213042120",
    );
    assert.equal(ineaOutageCmp.status, "blocked");

    const braunaFlatlineCmp = compareHistoricalEventsOnStation(
      ev2022,
      ev2023,
      "RHN-58788600",
    );
    assert.equal(braunaFlatlineCmp.status, "blocked");

    const pre2020Cmp = compareHistoricalEventsOnStation(
      ev2012,
      ev2023,
      "RHN-58790002",
    );
    assert.equal(pre2020Cmp.status, "compatible");
    assert.ok(pre2020Cmp.warnings.length > 0);
  });
});

describe("R02-E Historical map association rules (Section 7)", () => {
  it("associates only datum-verified 58790002 events within 300..550 cm without interpolation and blocks incompatible cases", () => {
    const ev2023 = getHistoricalEventById("HIST-2023-01-08")!;
    const assoc2023 = resolveHistoricalMapAssociation(ev2023);
    assert.equal(assoc2023.status, "compatible");
    assert.equal(assoc2023.observedExtentAvailable, false);
    assert.equal(
      assoc2023.primaryRepresentationKind,
      "approximate_reference_scenario",
    );
    assert.equal(assoc2023.recommendedSingleStageCm, 425);
    assert.deepEqual(assoc2023.bracketingCompareStagesCm, [425, 450]);

    const ev2026 = getHistoricalEventById("HIST-2026-02-25")!;
    const assoc2026 = resolveHistoricalMapAssociation(ev2026);
    assert.equal(assoc2026.status, "compatible");
    assert.equal(assoc2026.recommendedSingleStageCm, 400);
    assert.deepEqual(assoc2026.bracketingCompareStagesCm, [400, 425]);

    // 2012 blocked due to unverified pre-2020 gauge-zero continuity
    const assoc2012 = resolveHistoricalMapAssociation(
      getHistoricalEventById("HIST-2012-01-04")!,
    );
    assert.equal(assoc2012.status, "blocked");

    // Alert pulse < 300 cm blocked without extrapolation
    const assocAlert = resolveHistoricalMapAssociation(
      getHistoricalEventById("HIST-2026-02-05")!,
    );
    assert.equal(assocAlert.status, "blocked");

    // Exact SGB stage synthetic check (e.g., 425 cm)
    const exactSynthetic: HistoricalFloodEvent = {
      ...ev2026,
      id: "HIST-2024-01-01",
      stationObservations: [
        {
          ...ev2026.stationObservations[0],
          peakStageCm: 425,
          rawPeakValue: 425,
        },
      ],
    };
    const exactAssoc = resolveHistoricalMapAssociation(exactSynthetic);
    assert.equal(exactAssoc.status, "compatible");
    assert.equal(exactAssoc.isExactSgbStage, true);
    assert.equal(exactAssoc.primaryRepresentationKind, "official_modeled_extent");
    assert.equal(exactAssoc.bracketingCompareStagesCm, null);
  });
});

describe("R02-E Hydrograph and replay engine (Section 6)", () => {
  it("enforces BLOCKED_LOCAL_DATA / authorization gates and refuses fabricating curves from isolated peaks", () => {
    const blockedLocal = prepareHistoricalHydrograph({
      stationId: "RHN-58790002",
      seriesAvailability: "blocked_local_data",
      rawPoints: [],
    });
    assert.equal(blockedLocal.status, "unavailable");
    assert.equal(blockedLocal.reasonCode, "blocked_local_data");

    const singlePeak = prepareHistoricalHydrograph({
      stationId: "RHN-58790002",
      seriesAvailability: "available_authorized",
      rawPoints: [{ timestampUtc: "2023-01-08T12:45:00Z", stageCm: 428 }],
    });
    assert.equal(singlePeak.status, "unavailable");
    assert.equal(singlePeak.reasonCode, "insufficient_points_no_fabrication");
  });

  it("preserves telemetry gaps without interpolation and steps replay cursor across segments and gaps", () => {
    const prepared = prepareHistoricalHydrograph({
      stationId: "RHN-58790002",
      seriesAvailability: "available_authorized",
      rawPoints: [
        { timestampUtc: "2026-02-28T17:00:00Z", stageCm: 390, rainMm: 2.4 },
        { timestampUtc: "2026-02-28T17:15:00Z", stageCm: 402, rainMm: 1.2 },
        // Missing 17:30, 17:45, 18:00 -> 60 min gap (> 30 min threshold)
        { timestampUtc: "2026-02-28T18:15:00Z", stageCm: 410, rainMm: 0 },
        { timestampUtc: "2026-02-28T18:30:00Z", stageCm: 412, rainMm: 0 },
      ],
    });

    assert.equal(prepared.status, "ready");
    assert.equal(prepared.segments.length, 2);
    assert.equal(prepared.gaps.length, 1);
    assert.equal(prepared.gaps[0].durationMinutes, 60);
    assert.equal(prepared.minPoint.stageCm, 390);
    assert.equal(prepared.maxPoint.stageCm, 412);
    assert.equal(prepared.totalRainMm, 3.6);
    assert.equal(prepared.stationThresholds.length, 3);

    let replay = { ...createInitialReplayState(prepared), isPlaying: true };
    replay = stepHydrographReplay(prepared, replay);
    assert.equal(replay.activePoint?.stageCm, 402);
    assert.equal(replay.isInsideGap, false);

    // Next 15-min step lands at 17:30Z -> strictly inside the gap, NEVER interpolated!
    replay = stepHydrographReplay(prepared, replay);
    assert.equal(replay.isInsideGap, true);
    assert.equal(replay.activePoint, null);

    // Seek to end
    replay = seekHydrographReplay(prepared, replay, prepared.endEpochMs);
    assert.equal(replay.atEnd, true);
    assert.equal(replay.isPlaying, false);
    assert.equal(replay.activePoint?.stageCm, 412);

    const sliced = sliceHydrographInterval(
      prepared,
      Date.parse("2026-02-28T18:15:00Z"),
      Date.parse("2026-02-28T18:30:00Z"),
    );
    assert.equal(sliced.status, "ready");
    assert.equal(sliced.points.length, 2);
  });
});

describe("R02-E Scientific control points and validation matrix (Section 9)", () => {
  it("never invents coordinates and evaluates TP/FP/FN/TN cleanly while isolating unknown and unverified points", () => {
    const geocoded = HISTORICAL_CONTROL_POINTS.filter(
      (cp) => cp.coordinatesWgs84 !== null,
    );
    assert.equal(geocoded.length, 2);
    assert.deepEqual(
      geocoded.map((c) => c.id),
      ["CP-MONSENHOR-DINIZ", "CP-ILHA-CONVIVENCIA"],
    );

    // Ensure catalog never assigns water_absent merely from lack of photographs
    for (const cp of HISTORICAL_CONTROL_POINTS) {
      for (const rec of cp.eventRecords) {
        assert.notEqual(rec.state, "water_absent");
      }
    }

    // Synthetic polygon covering CP-MONSENHOR-DINIZ (-42.17721, -21.543205) but NOT CP-ILHA-CONVIVENCIA (-42.178531, -21.543554)
    const syntheticPoly = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [-42.1776, -21.5436],
                [-42.1768, -21.5436],
                [-42.1768, -21.5428],
                [-42.1776, -21.5428],
                [-42.1776, -21.5436],
              ],
            ],
          },
        },
      ],
    };

    const customPoints = [
      {
        ...HISTORICAL_CONTROL_POINTS[0],
        eventRecords: [
          {
            eventId: "HIST-TEST",
            state: "water_present" as const,
            evidenceSummary: "Synthetic positive",
            sourceIds: [],
          },
        ],
      },
      {
        ...HISTORICAL_CONTROL_POINTS[1],
        eventRecords: [
          {
            eventId: "HIST-TEST",
            state: "water_absent" as const,
            evidenceSummary: "Synthetic verified dry",
            sourceIds: [],
          },
        ],
      },
      HISTORICAL_CONTROL_POINTS[2], // unverified_coordinates
      HISTORICAL_CONTROL_POINTS[0], // unknown for HIST-TEST
    ];

    const evalRes = evaluateControlPointsForEventScenario(
      "HIST-TEST",
      syntheticPoly,
      300,
      customPoints,
    );
    assert.equal(evalRes.counts.truePositive, 1);
    assert.equal(evalRes.counts.trueNegative, 1);
    assert.equal(evalRes.counts.unverifiedCoordinates, 1);
    assert.equal(evalRes.counts.unknownFieldEvidence, 1);
  });
});
