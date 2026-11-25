"use client";

import {
  formatFloodArea,
  formatHectares,
  formatSignedHectares,
  formatSignedPercent,
} from "@/lib/sgb/area";
import { SGB_REFERENCE_STATION_LABEL } from "@/lib/sgb/areaCatalog";
import type { ScenarioComparisonResult } from "@/lib/sgb/compare";
import type { FloodLayerStatus } from "@/lib/sgb/useSgbFlood";

function formatMetersFromCm(levelCm: number): string {
  return (levelCm / 100).toFixed(2).replace(".", ",");
}

export type ScenarioComparisonCardProps = {
  readonly levelACm: number;
  readonly levelBCm: number;
  readonly statusA: FloodLayerStatus;
  readonly statusB: FloodLayerStatus | null;
  readonly comparison: ScenarioComparisonResult | null;
  readonly onRetryA: () => void;
  readonly onRetryB: () => void;
};

export function ScenarioComparisonCard({
  levelACm,
  levelBCm,
  statusA,
  statusB,
  comparison,
  onRetryA,
  onRetryB,
}: ScenarioComparisonCardProps) {
  const isALoading = statusA.levelCm !== levelACm || statusA.state === "loading";
  const isBLoading =
    !statusB || statusB.levelCm !== levelBCm || statusB.state === "loading";

  const isAFailed =
    statusA.levelCm === levelACm &&
    (statusA.state === "error" || statusA.state === "empty");
  const isBFailed =
    statusB !== null &&
    statusB.levelCm === levelBCm &&
    (statusB.state === "error" || statusB.state === "empty");

  const validComparison =
    !isALoading &&
    !isBLoading &&
    !isAFailed &&
    !isBFailed &&
    comparison?.status === "valid" &&
    comparison.levelACm === levelACm &&
    comparison.levelBCm === levelBCm
      ? comparison
      : null;

  const invalidComparison =
    !isALoading &&
    !isBLoading &&
    !isAFailed &&
    !isBFailed &&
    comparison &&
    comparison.status !== "valid" &&
    comparison.levelACm === levelACm &&
    comparison.levelBCm === levelBCm
      ? comparison
      : null;

  return (
    <article
      className="card comparison-metric-card"
      data-classification="derived"
      aria-labelledby="comparison-card-title"
    >
      <div className="card-heading">
        <strong id="comparison-card-title">Comparação de cenários (A vs. B)</strong>
        <span
          className="data-origin-badge derived"
          data-classification="derived"
        >
          Dado derivado
        </span>
      </div>

      <p className="comparison-station-ref">
        {SGB_REFERENCE_STATION_LABEL} · Geometria consultada ao vivo.
      </p>

      {(isALoading || isBLoading) && (
        <div className="comparison-state-box loading" role="status" aria-live="polite">
          Carregando camadas oficiais SGB ({formatMetersFromCm(levelACm)} m e{" "}
          {formatMetersFromCm(levelBCm)} m) para sobreposição topológica...
        </div>
      )}

      {(isAFailed || isBFailed) && (
        <div className="comparison-state-box error" role="alert">
          <p>
            Não foi possível concluir a comparação porque uma ou mais camadas
            oficiais do SGB falharam ou vieram vazias. Nenhuma métrica parcial é
            exibida.
          </p>
          <div className="comparison-retry-row">
            {isAFailed && (
              <button
                type="button"
                className="badge-retry-btn"
                onClick={onRetryA}
              >
                Recarregar Cota A ({formatMetersFromCm(levelACm)} m)
              </button>
            )}
            {isBFailed && (
              <button
                type="button"
                className="badge-retry-btn"
                onClick={onRetryB}
              >
                Recarregar Cota B ({formatMetersFromCm(levelBCm)} m)
              </button>
            )}
          </div>
        </div>
      )}

      {invalidComparison && (
        <div className="comparison-state-box error" role="alert">
          <p>
            <strong>Comparação indisponível (falha fechada):</strong>{" "}
            {invalidComparison.reason}
          </p>
        </div>
      )}

      {validComparison && (
        <>
          {/* Scenario A & B Totals */}
          <div className="comparison-totals-grid">
            <div className="comparison-total-box box-a">
              <span className="comparison-box-label">
                Cenário A · {formatMetersFromCm(validComparison.levelACm)} m
              </span>
              <strong>
                {formatHectares(validComparison.scenarioA.areaHectares, 2)}
              </strong>
              <small>
                {formatFloodArea(validComparison.scenarioA.areaSquareMeters).primary}
              </small>
            </div>
            <div className="comparison-total-box box-b">
              <span className="comparison-box-label">
                Cenário B · {formatMetersFromCm(validComparison.levelBCm)} m
              </span>
              <strong>
                {formatHectares(validComparison.scenarioB.areaHectares, 2)}
              </strong>
              <small>
                {formatFloodArea(validComparison.scenarioB.areaSquareMeters).primary}
              </small>
            </div>
          </div>

          {/* Net Difference (B - A) */}
          <div className="comparison-delta-banner">
            <div>
              <span className="comparison-delta-label">
                Diferença absoluta (B − A)
              </span>
              <strong
                className="comparison-delta-value"
                data-testid="comparison-delta-ha"
              >
                {formatSignedHectares(validComparison.deltaHectares, 2)}
              </strong>
            </div>
            <div className="comparison-delta-pct-block">
              <span className="comparison-delta-label">Variação (%)</span>
              <strong
                className="comparison-delta-pct"
                data-testid="comparison-delta-pct"
              >
                {formatSignedPercent(validComparison.deltaPercent, 1)}
              </strong>
            </div>
          </div>

          {/* Topological Decomposition: A ∩ B, A \ B, B \ A */}
          <div
            className="comparison-regions-list"
            aria-label="Decomposição topológica das manchas"
          >
            <div className="comparison-region-row">
              <span className="comparison-region-key">
                <i className="legend-swatch-common" aria-hidden="true" />
                <span>Área comum (A ∩ B)</span>
              </span>
              <strong data-testid="comparison-common-ha">
                {formatHectares(validComparison.common.areaHectares, 2)}
              </strong>
            </div>

            <div className="comparison-region-row">
              <span className="comparison-region-key">
                <i className="legend-swatch-only-a" aria-hidden="true" />
                <span>Exclusiva de A (A \ B)</span>
              </span>
              <strong data-testid="comparison-only-a-ha">
                {formatHectares(validComparison.onlyA.areaHectares, 2)}
              </strong>
            </div>

            <div className="comparison-region-row">
              <span className="comparison-region-key">
                <i className="legend-swatch-only-b" aria-hidden="true" />
                <span>Exclusiva de B (B \ A)</span>
              </span>
              <strong data-testid="comparison-only-b-ha">
                {formatHectares(validComparison.onlyB.areaHectares, 2)}
              </strong>
            </div>
          </div>

          <div className="comparison-diagnostics">
            <span>
              Sobreposição (Jaccard):{" "}
              <strong>
                {(validComparison.jaccardIndex * 100)
                  .toFixed(1)
                  .replace(".", ",")}
                %
              </strong>
            </span>
            <span>
              Conservação verificada (erro máx.{" "}
              {Math.max(
                validComparison.conservation.errorAM2,
                validComparison.conservation.errorBM2,
              ) < 0.01
                ? "< 0,01 m²"
                : `${Math.max(
                    validComparison.conservation.errorAM2,
                    validComparison.conservation.errorBM2,
                  )
                    .toFixed(2)
                    .replace(".", ",")} m²`}
              )
            </span>
          </div>

          <small className="area-metric-note">
            Operações topológicas reais (<code>polygon-clipping</code>, WGS84)
            sobre as geometrias oficiais SGB consultadas, sem pressupor
            aninhamento perfeito. Não representa área inundada no momento,
            profundidade ou risco.
          </small>
        </>
      )}
    </article>
  );
}
