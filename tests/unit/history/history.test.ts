import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
  summarizeControlPointsReadiness,
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
import type { PointModelCoverageDomain } from "../../../lib/sgb/location.ts";

describe("R02-E Historical flood catalog, manifest reconciliation, and provenance", () => {
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

  it("reconciles all 12 post-2020 RHN 58790002 events bit-for-bit against candidate_events.json", () => {
    const manifestPath = path.resolve(
      process.cwd(),
      "data/metadata/hydrology/candidate_events.json",
    );
    const rawManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      events: Array<{
        event_id: string;
        peak_stage_cm: number;
        peak_utc: string;
        readings_above_threshold: number;
        duration_above_threshold_hours: number;
        local_rain_padua_mm: number;
      }>;
    };
    const manifestById = new Map(
      rawManifest.events.map((e) => [e.event_id, e]),
    );

    const post2020Events = HISTORICAL_FLOOD_EVENTS.filter(
      (ev) => ev.candidateEventId !== null,
    );
    assert.equal(post2020Events.length, 12);

    for (const ev of post2020Events) {
      const m = manifestById.get(ev.candidateEventId!);
      assert.ok(m, `Missing candidateEventId ${ev.candidateEventId} in manifest`);

      const rhn = ev.stationObservations.find(
        (o) => o.stationId === "RHN-58790002",
      );
      assert.ok(rhn, `Missing RHN-58790002 observation on ${ev.id}`);
      assert.equal(rhn.peakStageCm, m.peak_stage_cm);
      assert.equal(rhn.peakTimestamp?.originalTimestamp, m.peak_utc);
      assert.equal(rhn.accumulatedRainMm, m.local_rain_padua_mm);

      const singleDur = rhn.thresholdDurations.find(
        (d) => d.aggregationScope === "single_event",
      );
      assert.ok(singleDur, `Missing single_event thresholdDuration on ${ev.id}`);
      assert.equal(
        singleDur.mergedWindowSpanHours,
        m.duration_above_threshold_hours,
      );
      assert.equal(singleDur.readingsAboveCount, m.readings_above_threshold);
      assert.equal(
        singleDur.nominalSampleSupportHours,
        Math.round(m.readings_above_threshold * 25) / 100,
      );

      const expectedSlots = Math.round(m.duration_above_threshold_hours * 4) + 1;
      const expectedUnaccounted = expectedSlots - m.readings_above_threshold;
      assert.equal(singleDur.unaccountedSlotsInWindow, expectedUnaccounted);

      if (expectedUnaccounted === 0) {
        assert.equal(
          singleDur.provenContinuousHours,
          m.duration_above_threshold_hours,
        );
        assert.equal(singleDur.includesMergedGapsOrRecessions, false);
        assert.equal(rhn.coveragePct, 100);
      } else {
        assert.equal(singleDur.provenContinuousHours, null);
        assert.equal(singleDur.includesMergedGapsOrRecessions, true);
        assert.equal(rhn.coveragePct, null);
      }
    }
  });

  it("separates documented urban floods, documentary basis tiers, press vs audit kinds, and monthly/annual aggregates", () => {
    assert.equal(HISTORICAL_FLOOD_EVENTS.length, 13);

    const ids = new Set<string>();
    let urbanFloodCount = 0;
    let elevatedHydroCount = 0;
    let primaryBasisCount = 0;
    let secondaryPressBasisCount = 0;

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
        assert.equal(ev.documentaryBasisLevel, "hydrological_telemetry_only");
      }

      if (ev.documentaryBasisLevel === "primary_official_act_and_report") {
        primaryBasisCount += 1;
      } else if (
        ev.documentaryBasisLevel === "secondary_press_citing_civil_defense"
      ) {
        secondaryPressBasisCount += 1;
      }

      for (const obs of ev.stationObservations) {
        if (obs.peakStageCm !== null) {
          assert.ok(obs.peakStageCm > 0);
        }
        if (obs.peakDischargeM3s !== null) {
          assert.ok(obs.peakDischargeM3s > 0);
        }
      }

      for (const doc of ev.documentaryEvidence) {
        assert.match(doc.url, /^https:\/\//);
        if (doc.id === "DOC-2022-FEB-CNN" || doc.id === "DOC-2023-JAN-J3") {
          assert.equal(doc.kind, "press_report");
        }
        if (doc.kind === "external_photograph") {
          assert.ok(doc.photoAttribution);
          assert.ok(doc.photoAttribution.photographerOrCredit.length > 3);
          assert.ok(doc.photoAttribution.verifiedLocation.length > 3);
        }
      }
    }

    assert.equal(urbanFloodCount, 6);
    assert.equal(elevatedHydroCount, 7);
    assert.equal(primaryBasisCount, 4);
    assert.equal(secondaryPressBasisCount, 2);
    assert.ok(PROVENANCE_ARTIFACTS.length >= 9);

    // Monthly INEA coverages (< 100%) are stored in periodAggregateNote, never conflated as event-window coveragePct
    const jan2022Inea = getHistoricalEventById(
      "HIST-2022-01-08",
    )!.stationObservations.find((o) => o.stationId === "INEA-213042120")!;
    assert.equal(jan2022Inea.coveragePct, null);
    assert.match(jan2022Inea.periodAggregateNote ?? "", /99,97%/);

    // Annual discharge maxima without event timestamps are not exposed as peakDischargeM3s
    const jan2022Rhn = getHistoricalEventById(
      "HIST-2022-01-08",
    )!.stationObservations.find((o) => o.stationId === "RHN-58790002")!;
    assert.equal(jan2022Rhn.peakDischargeM3s, null);
    assert.match(jan2022Rhn.dischargeNote ?? "", /1199,7 m³\/s/);
  });

  it("audits EVT-20221231-27 (HIST-2023-01-08) duration decomposition (370.75 h window, 1162 readings, 290.5 h support), 428 vs 431 cm divergence, INEA outage, and Braúna flatline", () => {
    const jan2023 = getHistoricalEventById("HIST-2023-01-08");
    assert.ok(jan2023);
    assert.equal(jan2023.candidateEventId, "EVT-20221231-27");

    const sgbObs = jan2023.stationObservations.find(
      (o) => o.stationId === "RHN-58790002",
    );
    assert.ok(sgbObs);
    assert.equal(sgbObs.peakStageCm, 428);
    assert.equal(sgbObs.peakDischargeM3s, 1287.9);
    assert.ok(sgbObs.secondaryPeaks.some((sp) => sp.valueCm === 431));

    const singleDur = sgbObs.thresholdDurations.find(
      (d) => d.aggregationScope === "single_event",
    )!;
    assert.equal(singleDur.mergedWindowSpanHours, 370.75);
    assert.equal(singleDur.readingsAboveCount, 1162);
    assert.equal(singleDur.nominalSampleSupportHours, 290.5);
    assert.equal(singleDur.unaccountedSlotsInWindow, 322);
    assert.equal(singleDur.provenContinuousHours, null);

    const annualAgg = sgbObs.thresholdDurations.find(
      (d) => d.aggregationScope === "multi_event_or_annual_aggregate",
    )!;
    assert.equal(annualAgg.aggregateHoursReported, 188);
    assert.equal(annualAgg.provenContinuousHours, null);

    const ineaObs = jan2023.stationObservations.find(
      (o) => o.stationId === "INEA-213042120",
    );
    assert.ok(ineaObs);
    assert.equal(ineaObs.availability, "unavailable_critical_gap");
    assert.equal(ineaObs.peakStageCm, null);
    assert.equal(ineaObs.coveragePct, null);
    assert.match(ineaObs.periodAggregateNote ?? "", /43,1%/);
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

describe("R02-E Filtering, chronological ordering, and duration-safe comparison", () => {
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
    assert.equal(
      ineaMeasured.some((e) => e.id === "HIST-2023-01-08"),
      false,
    );
    assert.equal(
      ineaMeasured.some((e) => e.id === "HIST-2026-02-25"),
      true,
    );
  });

  it("never compares annual/seasonal sums or merged windows as proven continuous durations, while computing delta when both events are contiguous", () => {
    const ev2022 = getHistoricalEventById("HIST-2022-01-08")!;
    const ev2026 = getHistoricalEventById("HIST-2026-02-25")!;
    const ev2023 = getHistoricalEventById("HIST-2023-01-08")!;
    const ev2025Dec = getHistoricalEventById("HIST-2025-12-17")!;

    // 2022-01 (153.75 h proven) vs 2026-02 (merged window 111.5 h, proven = null) -> deltaProvenDurationHours MUST be null!
    const sgbMergedCmp = compareHistoricalEventsOnStation(
      ev2022,
      ev2026,
      "RHN-58790002",
    );
    assert.equal(sgbMergedCmp.status, "compatible");
    assert.equal(sgbMergedCmp.deltaPeakCm, -11); // 412 - 423
    assert.equal(sgbMergedCmp.deltaRainMm, -107.4); // 61.0 - 168.4
    assert.equal(sgbMergedCmp.provenDurationAHours, 153.75);
    assert.equal(sgbMergedCmp.provenDurationBHours, null);
    assert.equal(sgbMergedCmp.deltaProvenDurationHours, null);
    assert.equal(sgbMergedCmp.nominalSupportAHours, 154);
    assert.equal(sgbMergedCmp.nominalSupportBHours, 110.75);

    // 2022-01 (153.75 h proven) vs 2025-12 (39.75 h proven) -> both 100% contiguous, delta = -114 h
    const bothContiguousCmp = compareHistoricalEventsOnStation(
      ev2022,
      ev2025Dec,
      "RHN-58790002",
    );
    assert.equal(bothContiguousCmp.status, "compatible");
    assert.equal(bothContiguousCmp.deltaProvenDurationHours, -114);

    // Synthetic check: two events that ONLY carry multi_event_or_annual_aggregate durations (246 h vs 188 h) must NEVER be compared!
    const onlyAnnualA: HistoricalFloodEvent = {
      ...ev2022,
      id: "HIST-ANN-A",
      stationObservations: ev2022.stationObservations.map((o) =>
        o.stationId === "RHN-58790002"
          ? {
              ...o,
              thresholdDurations: o.thresholdDurations.filter(
                (d) => d.aggregationScope === "multi_event_or_annual_aggregate",
              ),
            }
          : o,
      ),
    };
    const onlyAnnualB: HistoricalFloodEvent = {
      ...ev2023,
      id: "HIST-ANN-B",
      stationObservations: ev2023.stationObservations.map((o) =>
        o.stationId === "RHN-58790002"
          ? {
              ...o,
              thresholdDurations: o.thresholdDurations.filter(
                (d) => d.aggregationScope === "multi_event_or_annual_aggregate",
              ),
            }
          : o,
      ),
    };
    const annualRejected = compareHistoricalEventsOnStation(
      onlyAnnualA,
      onlyAnnualB,
      "RHN-58790002",
    );
    assert.equal(annualRejected.status, "compatible");
    assert.equal(annualRejected.sharedThresholdLabel, null);
    assert.equal(annualRejected.deltaProvenDurationHours, null);

    // Cross-station & outage/flatline still fail closed
    assert.equal(
      compareHistoricalEventsOnStation(
        ev2022,
        ev2026,
        "RHN-58790002",
        "INEA-213042120",
      ).status,
      "blocked",
    );
    assert.equal(
      compareHistoricalEventsOnStation(ev2022, ev2023, "INEA-213042120").status,
      "blocked",
    );
    assert.equal(
      compareHistoricalEventsOnStation(ev2022, ev2023, "RHN-58788600").status,
      "blocked",
    );
  });
});

describe("R02-E Vertical continuity & historical map association rules (Section 3 & 7)", () => {
  it("keeps all 2012–2026 cataloged events blocked for historical equivalence with generalized non-2012 reasons, allowing only unconfirmed independent SGB exploration within 300..550 cm", () => {
    for (const ev of HISTORICAL_FLOOD_EVENTS) {
      for (const obs of ev.stationObservations) {
        assert.equal(obs.datumContinuityVerified, false);
      }

      const assoc = resolveHistoricalMapAssociation(ev);
      assert.equal(assoc.status, "blocked");
      assert.equal(assoc.historicalEquivalenceConfirmed, false);

      if (ev.year !== 2012) {
        assert.equal(
          assoc.reason.includes("2012"),
          false,
          `Generalized block reason on ${ev.id} must not hardcode 2012: ${assoc.reason}`,
        );
        assert.equal(
          assoc.reason.includes("450 cm"),
          false,
          `Generalized block reason on ${ev.id} must not hardcode 450 cm`,
        );
      }
    }

    // 2023-01-08 (428 cm) -> blocked for historical equivalence, offers independent exploration at 425 cm / 425x450 cm
    const ev2023 = getHistoricalEventById("HIST-2023-01-08")!;
    const assoc2023 = resolveHistoricalMapAssociation(ev2023);
    assert.equal(assoc2023.status, "blocked");
    assert.equal(assoc2023.blockCode, "unverified_datum_continuity");
    assert.equal(
      assoc2023.independentScenarioExploration?.nominalSingleStageCm,
      425,
    );
    assert.deepEqual(
      assoc2023.independentScenarioExploration?.nominalBracketingStagesCm,
      [425, 450],
    );

    // Alert pulse < 300 cm -> outside_sgb_modeled_range, no independent exploration
    const assocAlert = resolveHistoricalMapAssociation(
      getHistoricalEventById("HIST-2026-02-05")!,
    );
    assert.equal(assocAlert.status, "blocked");
    assert.equal(assocAlert.blockCode, "outside_sgb_modeled_range");
    assert.equal(assocAlert.independentScenarioExploration, null);

    // datumContinuityVerified=true WITHOUT specific datumContinuityEvidence MUST still fail closed!
    const missingEvidenceSynthetic: HistoricalFloodEvent = {
      ...ev2023,
      id: "HIST-NO-EVIDENCE",
      stationObservations: [
        {
          ...ev2023.stationObservations[0],
          datumContinuityVerified: true,
          datumContinuityEvidence: "   ",
        },
      ],
    };
    assert.equal(
      resolveHistoricalMapAssociation(missingEvidenceSynthetic).status,
      "blocked",
    );

    // Only with BOTH datumContinuityVerified=true AND specific datumContinuityEvidence does status become compatible
    const verifiedSynthetic: HistoricalFloodEvent = {
      ...ev2023,
      id: "HIST-VERIFIED-2024",
      stationObservations: [
        {
          ...ev2023.stationObservations[0],
          peakStageCm: 425,
          rawPeakValue: 425,
          datumContinuityVerified: true,
          datumContinuityStatus: "verified_leveling_record",
          datumContinuityEvidence:
            "Ficha sintética de nivelamento geodésico RN SGB confirmando Z0 = 79,709 m hgeoHNOR_IMBITUBA no período.",
        },
      ],
    };
    const compat = resolveHistoricalMapAssociation(verifiedSynthetic);
    assert.equal(compat.status, "compatible");
    assert.equal(compat.historicalEquivalenceConfirmed, true);
    assert.equal(compat.isExactSgbStage, true);
    assert.equal(compat.recommendedSingleStageCm, 425);
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
        { timestampUtc: "2026-02-28T18:15:00Z", stageCm: 410, rainMm: 0 },
        { timestampUtc: "2026-02-28T18:30:00Z", stageCm: 412, rainMm: 0 },
      ],
    });

    assert.equal(prepared.status, "ready");
    assert.equal(prepared.segments.length, 2);
    assert.equal(prepared.gaps.length, 1);
    assert.equal(prepared.gaps[0].durationMinutes, 60);

    let replay = { ...createInitialReplayState(prepared), isPlaying: true };
    replay = stepHydrographReplay(prepared, replay);
    assert.equal(replay.activePoint?.stageCm, 402);
    assert.equal(replay.isInsideGap, false);

    replay = stepHydrographReplay(prepared, replay);
    assert.equal(replay.isInsideGap, true);
    assert.equal(replay.activePoint, null);

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

describe("R02-E Scientific control points and 6-gate spatial validation (Section 4 & 9)", () => {
  it("verifies zero usable coordinate+state pairs in current catalog and enforces all 6 gates plus boundary indeterminacy", () => {
    const readiness = summarizeControlPointsReadiness(HISTORICAL_CONTROL_POINTS);
    assert.equal(readiness.totalControlPoints, 10);
    assert.equal(readiness.verifiedCoordinatesCount, 2);
    assert.equal(readiness.documentedKnownStateRecordsCount, 5);
    assert.equal(readiness.usableCoordinateAndKnownStatePairs, 0);

    for (const cp of HISTORICAL_CONTROL_POINTS) {
      for (const rec of cp.eventRecords) {
        assert.notEqual(rec.state, "water_absent");
      }
    }

    // Validated hydraulic domain polygon covering the central reach
    const validatedDomain: PointModelCoverageDomain = {
      kind: "polygon",
      label: "Domínio hidráulico sintético validado para teste unitário",
      geometry: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-42.185, -21.548],
                  [-42.172, -21.548],
                  [-42.172, -21.539],
                  [-42.185, -21.539],
                  [-42.185, -21.548],
                ],
              ],
            },
          },
        ],
      },
    };

    // Flood polygon whose western edge passes EXACTLY through lon = -42.178 (for boundary test),
    // covering CP-MONSENHOR-DINIZ (-42.17721, -21.543205) and leaving CP-ILHA-CONVIVENCIA (-42.178531, -21.543554) outside
    const syntheticFloodPoly = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [-42.178, -21.544],
                [-42.1765, -21.544],
                [-42.1765, -21.5425],
                [-42.178, -21.5425],
                [-42.178, -21.544],
              ],
            ],
          },
        },
      ],
    };

    // 1. On real catalog event HIST-2023-01-08 (datumContinuityVerified=false), produces ZERO TP/FP/FN/TN
    const realEventEval = evaluateControlPointsForEventScenario({
      event: getHistoricalEventById("HIST-2023-01-08")!,
      scenarioGeojson: syntheticFloodPoly,
      levelCm: 425,
      coverageDomain: validatedDomain,
    });
    assert.equal(realEventEval.counts.truePositive, 0);
    assert.equal(realEventEval.counts.falsePositive, 0);
    assert.equal(realEventEval.counts.falseNegative, 0);
    assert.equal(realEventEval.counts.trueNegative, 0);
    assert.equal(realEventEval.counts.incompatibleTemporalOrStageReference, 2);
    assert.equal(realEventEval.counts.unverifiedCoordinates, 8);

    // 2. Synthetic datum-verified exact-stage event (300 cm)
    const base2025 = getHistoricalEventById("HIST-2025-12-17")!;
    const compatibleSyntheticEvent: HistoricalFloodEvent = {
      ...base2025,
      id: "HIST-TEST-300",
      stationObservations: [
        {
          ...base2025.stationObservations[0],
          peakStageCm: 300,
          rawPeakValue: 300,
          datumContinuityVerified: true,
          datumContinuityStatus: "verified_leveling_record",
          datumContinuityEvidence: "Nivelamento sintético verificado.",
        },
      ],
    };

    const customPoints = [
      // Inside flood polygon -> TP
      {
        ...HISTORICAL_CONTROL_POINTS[0],
        id: "CP-SYN-TP",
        eventRecords: [
          {
            eventId: "HIST-TEST-300",
            state: "water_present" as const,
            evidenceSummary: "Synthetic positive",
            sourceIds: ["DOC-SYN-1"],
          },
        ],
      },
      // Outside flood polygon -> TN
      {
        ...HISTORICAL_CONTROL_POINTS[1],
        id: "CP-SYN-TN",
        eventRecords: [
          {
            eventId: "HIST-TEST-300",
            state: "water_absent" as const,
            evidenceSummary: "Synthetic dry",
            sourceIds: ["DOC-SYN-2"],
          },
        ],
      },
      // On boundary edge (lon = -42.178 within ±0.5 m) -> MUST be indeterminate_boundary_proximity, NEVER TP/FP/FN/TN!
      {
        ...HISTORICAL_CONTROL_POINTS[0],
        id: "CP-SYN-BOUNDARY",
        coordinatesWgs84: { lat: -21.5432, lon: -42.178 },
        eventRecords: [
          {
            eventId: "HIST-TEST-300",
            state: "water_present" as const,
            evidenceSummary: "Synthetic boundary",
            sourceIds: ["DOC-SYN-3"],
          },
        ],
      },
    ];

    // Without validated hydraulic domain polygon (default auxiliary bbox) -> 0 TP/TN, all 3 unverified_hydraulic_domain
    const unverifiedDomainEval = evaluateControlPointsForEventScenario({
      event: compatibleSyntheticEvent,
      scenarioGeojson: syntheticFloodPoly,
      levelCm: 300,
      controlPoints: customPoints,
    });
    assert.equal(unverifiedDomainEval.counts.truePositive, 0);
    assert.equal(unverifiedDomainEval.counts.trueNegative, 0);
    assert.equal(unverifiedDomainEval.counts.unverifiedHydraulicDomain, 3);

    // Stage mismatch (325 cm vs 300 cm peak with default tolerance 0) -> 0 TP/TN, incompatible_temporal_or_stage_reference
    const stageMismatchEval = evaluateControlPointsForEventScenario({
      event: compatibleSyntheticEvent,
      scenarioGeojson: syntheticFloodPoly,
      levelCm: 325,
      coverageDomain: validatedDomain,
      controlPoints: customPoints,
    });
    assert.equal(stageMismatchEval.counts.truePositive, 0);
    assert.equal(
      stageMismatchEval.counts.incompatibleTemporalOrStageReference,
      3,
    );

    // All 5 prerequisites satisfied + boundary point -> 1 TP, 1 TN, 1 indeterminate_boundary_proximity
    const fullGateEval = evaluateControlPointsForEventScenario({
      event: compatibleSyntheticEvent,
      scenarioGeojson: syntheticFloodPoly,
      levelCm: 300,
      coverageDomain: validatedDomain,
      controlPoints: customPoints,
    });
    assert.equal(fullGateEval.counts.truePositive, 1);
    assert.equal(fullGateEval.counts.trueNegative, 1);
    assert.equal(fullGateEval.counts.indeterminateBoundaryProximity, 1);
    assert.equal(fullGateEval.counts.falsePositive, 0);
    assert.equal(fullGateEval.counts.falseNegative, 0);
  });
});
