"use client";

import { useState } from "react";
import { formatHectares, formatSignedHectares, formatSignedPercent } from "@/lib/sgb/area";
import {
  SGB_AREA_SNAPSHOT_BY_LEVEL,
  SGB_AREA_SNAPSHOT_DATE,
  SGB_AREA_SNAPSHOT_ENTRIES,
  SGB_REFERENCE_STATION_LABEL,
  type CatalogAreaDivergenceCheck,
} from "@/lib/sgb/areaCatalog";
import {
  SGB_STAGE_DISCHARGES_M3S,
  SGB_STAGE_ELEVATIONS,
  type SgbFloodLevelCm,
} from "@/lib/sgb/stages";

function formatMetersFromCm(levelCm: number): string {
  return (levelCm / 100).toFixed(2).replace(".", ",");
}

export type ScenarioAreaChartProps = {
  readonly mode: "single" | "compare";
  readonly selectedLevelACm: number;
  readonly selectedLevelBCm?: number;
  readonly onSelectSingleLevel?: (levelMeters: number) => void;
  readonly onSelectCompareLevel?: (target: "A" | "B", levelMeters: number) => void;
  readonly catalogAreaDivergences?: readonly CatalogAreaDivergenceCheck[];
};

export function ScenarioAreaChart({
  mode,
  selectedLevelACm,
  selectedLevelBCm,
  onSelectSingleLevel,
  onSelectCompareLevel,
  catalogAreaDivergences = [],
}: ScenarioAreaChartProps) {
  const [hoveredLevelCm, setHoveredLevelCm] = useState<SgbFloodLevelCm | null>(null);
  const [clickTarget, setClickTarget] = useState<"A" | "B">("B");

  const maxAreaHa = Math.max(
    ...SGB_AREA_SNAPSHOT_ENTRIES.map((entry) => entry.areaHectares),
  );
  const scaleMaxHa = Math.ceil(maxAreaHa / 10) * 10; // 280 ha

  const inspectedLevelCm: SgbFloodLevelCm =
    hoveredLevelCm ??
    ((mode === "compare" && selectedLevelBCm
      ? selectedLevelBCm
      : selectedLevelACm) as SgbFloodLevelCm);

  const inspectedEntry =
    SGB_AREA_SNAPSHOT_BY_LEVEL[inspectedLevelCm] ??
    SGB_AREA_SNAPSHOT_ENTRIES[0];

  const refAEntry =
    SGB_AREA_SNAPSHOT_BY_LEVEL[selectedLevelACm as SgbFloodLevelCm] ?? null;

  const deltaVsAHa =
    mode === "compare" && refAEntry
      ? inspectedEntry.areaHectares - refAEntry.areaHectares
      : null;
  const deltaVsAPct =
    mode === "compare" && refAEntry && refAEntry.areaHectares > 0
      ? ((inspectedEntry.areaHectares - refAEntry.areaHectares) /
          refAEntry.areaHectares) *
        100
      : null;

  const handleBarClick = (levelCm: SgbFloodLevelCm) => {
    const levelMeters = levelCm / 100;
    if (mode === "compare") {
      onSelectCompareLevel?.(clickTarget, levelMeters);
    } else {
      onSelectSingleLevel?.(levelMeters);
    }
  };

  const activeDivergences = catalogAreaDivergences.filter(
    (d) => !d.matchesCatalogArea,
  );

  return (
    <article
      className="card area-chart-card"
      data-classification="derived"
      aria-labelledby="area-chart-title"
    >
      <div className="card-heading">
        <strong id="area-chart-title">Área por cota oficial (11 cenários)</strong>
        <span
          className="data-origin-badge derived"
          data-classification="derived"
          title={`Snapshot catalogado e validado em ${SGB_AREA_SNAPSHOT_DATE}`}
        >
          Snapshot {SGB_AREA_SNAPSHOT_DATE}
        </span>
      </div>

      <p className="area-chart-subtitle">
        {SGB_REFERENCE_STATION_LABEL}. Curva catalogada sem requisições extras ao
        SGB na abertura; não equivale à régua do INEA.
      </p>

      {mode === "compare" && (
        <div
          className="chart-target-row"
          role="group"
          aria-label="Destino do clique no gráfico"
        >
          <span className="chart-target-label">Ao clicar na barra:</span>
          <button
            type="button"
            className={`chart-target-btn target-a ${
              clickTarget === "A" ? "active" : ""
            }`}
            aria-pressed={clickTarget === "A"}
            onClick={() => setClickTarget("A")}
          >
            Definir Cota A
          </button>
          <button
            type="button"
            className={`chart-target-btn target-b ${
              clickTarget === "B" ? "active" : ""
            }`}
            aria-pressed={clickTarget === "B"}
            onClick={() => setClickTarget("B")}
          >
            Definir Cota B
          </button>
        </div>
      )}

      {/* Interactive Bar Chart */}
      <div
        className="area-chart-plot"
        role="group"
        aria-label="Gráfico interativo de área em hectares por cota SGB de 3,00 m a 5,50 m"
      >
        <div className="area-chart-bars">
          {SGB_AREA_SNAPSHOT_ENTRIES.map((entry) => {
            const isA = entry.levelCm === selectedLevelACm;
            const isB =
              mode === "compare" && entry.levelCm === selectedLevelBCm;
            const isBoth = isA && isB;
            const isHovered = entry.levelCm === hoveredLevelCm;

            // Keep 0-based true proportionality visually clear with minimum visible bar height
            const heightPct = Math.max(
              12,
              Math.min(100, (entry.areaHectares / scaleMaxHa) * 100),
            );

            let stateClass = "";
            if (isBoth) {
              stateClass = "is-both";
            } else if (isA && mode === "compare") {
              stateClass = "is-a";
            } else if (isB) {
              stateClass = "is-b";
            } else if (isA) {
              stateClass = "is-selected";
            }

            const markerLabel = isBoth
              ? "A=B"
              : isA && mode === "compare"
                ? "A"
                : isB
                  ? "B"
                  : null;

            return (
              <button
                key={entry.levelCm}
                type="button"
                className={`area-chart-bar-btn ${stateClass} ${
                  isHovered ? "is-hovered" : ""
                }`}
                onClick={() => handleBarClick(entry.levelCm)}
                onMouseEnter={() => setHoveredLevelCm(entry.levelCm)}
                onMouseLeave={() => setHoveredLevelCm(null)}
                onFocus={() => setHoveredLevelCm(entry.levelCm)}
                onBlur={() => setHoveredLevelCm(null)}
                aria-label={`Cota ${formatMetersFromCm(entry.levelCm)} m (${entry.levelCm} cm): ${formatHectares(entry.areaHectares, 1)}`}
                aria-pressed={isA || isB}
                title={`Cota ${formatMetersFromCm(entry.levelCm)} m · ${formatHectares(entry.areaHectares, 2)} (snapshot ${SGB_AREA_SNAPSHOT_DATE})`}
              >
                <span className="area-chart-bar-track" aria-hidden="true">
                  {markerLabel && (
                    <span className="area-chart-bar-tag">{markerLabel}</span>
                  )}
                  <span
                    className="area-chart-bar-fill"
                    style={{ height: `${heightPct.toFixed(1)}%` }}
                  />
                </span>
                <span className="area-chart-bar-label">
                  {(entry.levelCm / 100).toFixed(2).replace(".", ",")}
                </span>
              </button>
            );
          })}
        </div>
        <div className="area-chart-axis-note" aria-hidden="true">
          <span>Escala 0 – {scaleMaxHa} ha</span>
          <span>Cota (m) · Pádua II (58790002)</span>
        </div>
      </div>

      {/* Live readout for hovered or active stage */}
      <div className="area-chart-readout" aria-live="polite">
        <div className="area-chart-readout-top">
          <strong>
            Cota {formatMetersFromCm(inspectedEntry.levelCm)} m (
            {inspectedEntry.levelCm} cm)
          </strong>
          <b>{formatHectares(inspectedEntry.areaHectares, 2)}</b>
        </div>
        <div className="area-chart-readout-meta">
          <span>
            {inspectedEntry.areaSquareKm.toFixed(2).replace(".", ",")} km² · Alt.{" "}
            {SGB_STAGE_ELEVATIONS[inspectedEntry.levelCm]
              .toFixed(2)
              .replace(".", ",")}{" "}
            m · Vazão{" "}
            {SGB_STAGE_DISCHARGES_M3S[inspectedEntry.levelCm].toLocaleString(
              "pt-BR",
            )}{" "}
            m³/s
          </span>
          {deltaVsAHa !== null && deltaVsAPct !== null && (
            <span className="area-chart-readout-delta">
              vs. A ({formatMetersFromCm(selectedLevelACm)} m):{" "}
              <strong>
                {formatSignedHectares(deltaVsAHa, 2)} (
                {formatSignedPercent(deltaVsAPct, 1)})
              </strong>
            </span>
          )}
        </div>
      </div>

      {activeDivergences.length > 0 && (
        <div
          className="snapshot-divergence-warning"
          role="alert"
          data-testid="snapshot-divergence-warning"
        >
          <strong>Divergência de área em relação ao catálogo:</strong>{" "}
          {activeDivergences
            .map(
              (d) =>
                `Cota ${formatMetersFromCm(d.levelCm)} m na geometria consultada (${formatHectares(d.queriedAreaHectares, 2)}) difere do snapshot catalogado de ${SGB_AREA_SNAPSHOT_DATE} (${formatHectares(d.snapshotEntry.areaHectares, 2)}).`,
            )
            .join(" ")}{" "}
          A verificação compara apenas áreas totais (áreas equivalentes não
          comprovam geometrias idênticas). O gráfico acima preserva o snapshot
          catalogado; os cartões de área e comparação exibem o cálculo sobre a
          geometria consultada.
        </div>
      )}

      <small className="area-metric-note">
        Valores do gráfico derivados do snapshot validado em{" "}
        {SGB_AREA_SNAPSHOT_DATE} (WGS84, união topológica, hashes registrados).
        Faixa total: {formatHectares(SGB_AREA_SNAPSHOT_ENTRIES[0].areaHectares, 1)}{" "}
        a{" "}
        {formatHectares(
          SGB_AREA_SNAPSHOT_ENTRIES[SGB_AREA_SNAPSHOT_ENTRIES.length - 1]
            .areaHectares,
          1,
        )}{" "}
        (escala proporcional a partir de 0 ha).
      </small>
    </article>
  );
}
