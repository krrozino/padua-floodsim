"use client";

import { useMemo, useState } from "react";
import { compareHistoricalEventsOnStation } from "@/lib/history/analysis";
import { HISTORICAL_STATION_REGISTRY } from "@/lib/history/catalog";
import type {
  HistoricalFloodEvent,
  HistoricalStationId,
} from "@/lib/history/contract";
import {
  formatDurationHours,
  formatHistoricalDischarge,
  formatHistoricalRain,
  formatHistoricalStage,
  formatTrimmedDecimalPtBr,
} from "@/lib/history/normalize";

const COMPARABLE_STATIONS = HISTORICAL_STATION_REGISTRY.filter(
  (s) => s.historicalAuditStatus !== "inventory_only_not_audited",
);

function formatSignedDeltaStage(
  deltaPeakCm: number,
  deltaRawPeak: number,
  rawUnit: "cm" | "m",
): string {
  const sign = deltaPeakCm > 0 ? "+" : "";
  if (rawUnit === "m") {
    const rawStr = `${sign}${formatTrimmedDecimalPtBr(deltaRawPeak, 3)} m`;
    return `${rawStr} (${sign}${formatTrimmedDecimalPtBr(deltaPeakCm, 1)} cm)`;
  }
  return `${sign}${formatTrimmedDecimalPtBr(deltaPeakCm, 2)} cm`;
}

function formatSignedNumber(value: number | null, unit: string, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) {
    return "Não disponível";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals).replace(".", ",")} ${unit}`;
}

export function EventComparisonPanel({
  events,
}: Readonly<{
  events: readonly HistoricalFloodEvent[];
}>) {
  const [stationId, setStationId] =
    useState<HistoricalStationId>("RHN-58790002");
  const [eventAId, setEventAId] = useState<string>("HIST-2022-01-08");
  const [eventBId, setEventBId] = useState<string>("HIST-2026-02-25");

  const eventA = useMemo(
    () => events.find((ev) => ev.id === eventAId) ?? events[0],
    [events, eventAId],
  );
  const eventB = useMemo(
    () => events.find((ev) => ev.id === eventBId) ?? events[1] ?? events[0],
    [events, eventBId],
  );

  const comparison = useMemo(() => {
    if (!eventA || !eventB) return null;
    return compareHistoricalEventsOnStation(eventA, eventB, stationId);
  }, [eventA, eventB, stationId]);

  return (
    <article
      className="card history-comparison-card"
      aria-labelledby="history-comparison-title"
    >
      <div className="card-heading">
        <div>
          <strong id="history-comparison-title">
            Comparação entre eventos compatíveis (mesma estação)
          </strong>
          <p className="section-lead history-sublead">
            Compara métricas hidrológicas estritamente dentro da mesma régua e
            referência vertical. Nunca mistura leituras do INEA com cotas SGB e
            nunca preenche lacunas com zero.
          </p>
        </div>
        <span
          className="data-origin-badge derived"
          data-classification="derived"
        >
          Comparação controlada
        </span>
      </div>

      <div className="history-compare-selectors">
        <div className="history-filter-field">
          <label htmlFor="hist-cmp-station">Estação hidrológica de referência</label>
          <select
            id="hist-cmp-station"
            value={stationId}
            onChange={(e) =>
              setStationId(e.target.value as HistoricalStationId)
            }
          >
            {COMPARABLE_STATIONS.map((st) => (
              <option key={st.id} value={st.id}>
                {st.shortName} ({st.nativeStageUnit})
              </option>
            ))}
          </select>
        </div>

        <div className="history-filter-field">
          <label htmlFor="hist-cmp-event-a">Evento base (A)</label>
          <select
            id="hist-cmp-event-a"
            value={eventA?.id ?? ""}
            onChange={(e) => setEventAId(e.target.value)}
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.periodLabel} — {ev.title}
              </option>
            ))}
          </select>
        </div>

        <div className="history-filter-field">
          <label htmlFor="hist-cmp-event-b">Evento comparado (B)</label>
          <select
            id="hist-cmp-event-b"
            value={eventB?.id ?? ""}
            onChange={(e) => setEventBId(e.target.value)}
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.periodLabel} — {ev.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {comparison?.status === "blocked" && (
        <div
          className="history-blocked-notice"
          role="status"
          aria-live="polite"
        >
          <strong>Comparação bloqueada para a combinação selecionada:</strong>{" "}
          {comparison.reason}
        </div>
      )}

      {comparison?.status === "compatible" && eventA && eventB && (
        <div className="history-compare-result">
          <p className="history-compare-ref">
            <strong>Estação avaliada:</strong> {comparison.stationLabel} ·{" "}
            <span>{comparison.verticalReferenceLabel}</span>
          </p>

          <div className="table-scroll">
            <table className="stages-table history-compare-table">
              <thead>
                <tr>
                  <th>Métrica na estação</th>
                  <th>Evento A ({eventA.periodLabel})</th>
                  <th>Evento B ({eventB.periodLabel})</th>
                  <th>Diferença (B − A)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Nível máximo observado</strong>
                  </td>
                  <td>
                    {formatHistoricalStage(
                      comparison.peakACm,
                      comparison.rawPeakA,
                      comparison.rawUnit,
                    )}
                  </td>
                  <td>
                    {formatHistoricalStage(
                      comparison.peakBCm,
                      comparison.rawPeakB,
                      comparison.rawUnit,
                    )}
                  </td>
                  <td>
                    <strong>
                      {formatSignedDeltaStage(
                        comparison.deltaPeakCm,
                        comparison.deltaRawPeak,
                        comparison.rawUnit,
                      )}
                    </strong>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Vazão máxima auditada</strong>
                  </td>
                  <td>{formatHistoricalDischarge(comparison.dischargeAM3s)}</td>
                  <td>{formatHistoricalDischarge(comparison.dischargeBM3s)}</td>
                  <td>
                    {formatSignedNumber(comparison.deltaDischargeM3s, "m³/s", 1)}
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Chuva acumulada local (PCD)</strong>
                  </td>
                  <td>{formatHistoricalRain(comparison.rainAMm)}</td>
                  <td>{formatHistoricalRain(comparison.rainBMm)}</td>
                  <td>{formatSignedNumber(comparison.deltaRainMm, "mm", 1)}</td>
                </tr>
                <tr>
                  <td>
                    <strong>
                      Duração contínua comprovada
                      {comparison.sharedThresholdLabel
                        ? ` (${comparison.sharedThresholdLabel})`
                        : ""}
                    </strong>
                  </td>
                  <td>
                    {formatDurationHours(comparison.provenDurationAHours)}
                  </td>
                  <td>
                    {formatDurationHours(comparison.provenDurationBHours)}
                  </td>
                  <td>
                    {formatSignedNumber(
                      comparison.deltaProvenDurationHours,
                      "h",
                      2,
                    )}
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>
                      Suporte amostral nominal / janela mesclada
                      {comparison.sharedThresholdLabel
                        ? ` (${comparison.sharedThresholdLabel})`
                        : ""}
                    </strong>
                  </td>
                  <td>
                    {formatDurationHours(comparison.nominalSupportAHours)} (janela:{" "}
                    {formatDurationHours(comparison.mergedWindowSpanAHours)})
                  </td>
                  <td>
                    {formatDurationHours(comparison.nominalSupportBHours)} (janela:{" "}
                    {formatDurationHours(comparison.mergedWindowSpanBHours)})
                  </td>
                  <td>Sem Δ (janelas mescladas &lt;= 72 h)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {comparison.warnings.length > 0 && (
            <ul className="history-warning-list">
              {comparison.warnings.map((warn) => (
                <li key={warn}>{warn}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}
