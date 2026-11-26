"use client";

import { useEffect, useState, type FormEvent, type ClipboardEvent } from "react";
import {
  DEFAULT_BOUNDARY_TOLERANCE_METERS,
  formatCoordPtBr,
  formatLocationTechnicalSummary,
  parseCoordinatePairText,
  parseLatLonFields,
  type CrossStagePointSummary,
  type GeoPoint,
  type PointComparisonQueryResult,
  type PointScenarioQueryResult,
  type SpatialPointRelation,
} from "@/lib/sgb/location";
import { SGB_REFERENCE_STATION_LABEL } from "@/lib/sgb/areaCatalog";
import { SGB_STAGE_ELEVATIONS, type SgbFloodLevelCm } from "@/lib/sgb/stages";

export type LocationPointOrigin = "map_click" | "coordinates";

export type LocationQueryCardProps = {
  readonly mode: "single" | "compare";
  readonly levelACm: number;
  readonly levelBCm: number;
  readonly selectedPoint: GeoPoint | null;
  readonly pointOrigin: LocationPointOrigin | null;
  readonly singleResult: PointScenarioQueryResult | null;
  readonly compareResult: PointComparisonQueryResult | null;
  readonly crossStageStatus: "idle" | "running" | "completed";
  readonly crossStageCompleted: number;
  readonly crossStageTotal: number;
  readonly crossStageCachedHits: number;
  readonly crossStageSummary: CrossStagePointSummary | null;
  readonly onSubmitCoordinates: (point: GeoPoint) => void;
  readonly onClearPoint: () => void;
  readonly onFocusPoint: () => void;
  readonly onAnalyzeAllStages: () => void;
  readonly onCancelAllStages: () => void;
  readonly onSelectStageFromMatrix: (levelMeters: number) => void;
};

function formatMetersFromCm(levelCm: number): string {
  return (levelCm / 100).toFixed(2).replace(".", ",");
}

function relationShortLabel(relation: SpatialPointRelation): string {
  switch (relation) {
    case "inside":
      return "Interior";
    case "boundary":
      return "Fronteira";
    case "outside":
      return "Fora";
    default:
      return "Indisponível";
  }
}

function relationCssClass(
  relation: SpatialPointRelation,
  outsideCoverage = false,
): string {
  if (relation === "inside") return "is-inside";
  if (relation === "boundary") return "is-boundary";
  if (relation === "outside") {
    return outsideCoverage ? "is-outside-coverage" : "is-outside";
  }
  return "is-unavailable";
}

function singleResultHeadline(result: PointScenarioQueryResult): string {
  if (result.status !== "valid") {
    return "Informação indisponível";
  }
  if (result.relation === "inside") {
    return "Interceptado pelo cenário selecionado";
  }
  if (result.relation === "boundary") {
    return "Ponto na fronteira da mancha selecionada";
  }
  if (result.coverageStatus === "outside_model_coverage") {
    return "Fora da cobertura conhecida do modelo SGB";
  }
  return "Sem interseção com o cenário selecionado";
}

function compareResultHeadline(result: PointComparisonQueryResult): string {
  if (result.status !== "valid") {
    return "Informação indisponível na comparação";
  }
  switch (result.combinedRelation) {
    case "both":
      return "Interceptado por A e B (A ∩ B)";
    case "only_a":
      return "Interceptado apenas por A (A \\ B)";
    case "only_b":
      return "Interceptado apenas por B (B \\ A)";
    case "neither":
      return result.coverageStatus === "outside_model_coverage"
        ? "Fora da cobertura conhecida do modelo SGB"
        : "Sem interseção nos cenários A e B";
    default:
      return "Informação indisponível na comparação";
  }
}

export function LocationQueryCard({
  mode,
  levelACm,
  levelBCm,
  selectedPoint,
  pointOrigin,
  singleResult,
  compareResult,
  crossStageStatus,
  crossStageCompleted,
  crossStageTotal,
  crossStageCachedHits,
  crossStageSummary,
  onSubmitCoordinates,
  onClearPoint,
  onFocusPoint,
  onAnalyzeAllStages,
  onCancelAllStages,
  onSelectStageFromMatrix,
}: LocationQueryCardProps) {
  const [latInput, setLatInput] = useState("");
  const [lonInput, setLonInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [swappedHint, setSwappedHint] = useState<GeoPoint | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Sync inputs when user clicks directly on the map
  useEffect(() => {
    if (!selectedPoint) {
      return;
    }
    setLatInput(selectedPoint.lat.toFixed(5));
    setLonInput(selectedPoint.lon.toFixed(5));
    setInputError(null);
  }, [selectedPoint]);

  const handleLatPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!pasted) return;
    // Detect pasted coordinate pair like "-21.5390, -42.1800" or "-21,5390; -42,1800"
    if (/[;\s]/.test(pasted.trim()) || (pasted.includes(",") && pasted.includes("."))) {
      const parsed = parseCoordinatePairText(pasted);
      if (parsed.ok) {
        event.preventDefault();
        setLatInput(String(parsed.point.lat));
        setLonInput(String(parsed.point.lon));
        setInputError(null);
        setSwappedHint(parsed.likelySwappedPadua ? parsed.point : null);
      }
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCopyFeedback(false);
    // Also support pasting a pair into latInput while leaving lonInput empty
    const parsed =
      lonInput.trim() === "" && latInput.trim() !== ""
        ? parseCoordinatePairText(latInput)
        : parseLatLonFields(latInput, lonInput);

    if (!parsed.ok) {
      setInputError(parsed.error);
      setSwappedHint(null);
      return;
    }

    setInputError(null);
    setSwappedHint(parsed.likelySwappedPadua ? parsed.point : null);
    onSubmitCoordinates(parsed.point);
  };

  const handleSwapHint = () => {
    if (!swappedHint) return;
    const swapped: GeoPoint = { lat: swappedHint.lon, lon: swappedHint.lat };
    setLatInput(swapped.lat.toFixed(5));
    setLonInput(swapped.lon.toFixed(5));
    setSwappedHint(null);
    setInputError(null);
    onSubmitCoordinates(swapped);
  };

  const handleClear = () => {
    setLatInput("");
    setLonInput("");
    setInputError(null);
    setSwappedHint(null);
    setCopyFeedback(false);
    onClearPoint();
  };

  const handleCopySummary = async () => {
    if (!selectedPoint) return;
    const relationLabel =
      mode === "compare"
        ? compareResult
          ? compareResultHeadline(compareResult)
          : "Indisponível"
        : singleResult
          ? singleResultHeadline(singleResult)
          : "Indisponível";

    const text = formatLocationTechnicalSummary({
      point: selectedPoint,
      mode,
      levelACm,
      levelBCm: mode === "compare" ? levelBCm : undefined,
      relationLabel,
      lowestInterceptedLevelCm:
        crossStageSummary?.lowestInterceptedLevelCm ?? undefined,
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 2500);
    } catch {
      setCopyFeedback(false);
    }
  };

  const activeCoverageStatus =
    mode === "compare"
      ? compareResult?.coverageStatus ?? null
      : singleResult?.coverageStatus ?? null;

  const activeOutsideCoverage =
    activeCoverageStatus === "outside_model_coverage";

  const singleHeadline = singleResult ? singleResultHeadline(singleResult) : null;
  const compareHeadline = compareResult
    ? compareResultHeadline(compareResult)
    : null;

  return (
    <article
      className="card location-query-card"
      data-classification="derived"
      aria-labelledby="location-query-title"
    >
      <div className="card-heading">
        <strong id="location-query-title">Consulta geográfica</strong>
        <span
          className="data-origin-badge derived"
          data-classification="derived"
        >
          Dado derivado
        </span>
      </div>

      <p className="location-query-lead">
        Clique em qualquer ponto do mapa ou informe coordenadas{" "}
        <strong>WGS84 (EPSG:4326)</strong> para verificar a interseção com os
        cenários oficiais SGB.
      </p>

      <form
        className="coord-query-form"
        onSubmit={handleSubmit}
        noValidate
        aria-label="Consulta por coordenadas geográficas"
      >
        <div className="coord-inputs-grid">
          <label className="coord-field">
            <span>Latitude</span>
            <input
              type="text"
              inputMode="decimal"
              name="latitude"
              aria-label="Latitude (WGS84)"
              placeholder="-21.5390"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              onPaste={handleLatPaste}
              autoComplete="off"
            />
          </label>

          <label className="coord-field">
            <span>Longitude</span>
            <input
              type="text"
              inputMode="decimal"
              name="longitude"
              aria-label="Longitude (WGS84)"
              placeholder="-42.1800"
              value={lonInput}
              onChange={(e) => setLonInput(e.target.value)}
              autoComplete="off"
            />
          </label>
        </div>

        <div className="coord-form-actions">
          <button type="submit" className="coord-submit-btn">
            Consultar coordenadas
          </button>
          {selectedPoint && (
            <button
              type="button"
              className="coord-secondary-btn"
              onClick={handleClear}
            >
              Limpar
            </button>
          )}
        </div>
      </form>

      {inputError && (
        <div
          className="location-feedback-box error"
          role="alert"
          data-testid="location-input-error"
        >
          {inputError}
        </div>
      )}

      {swappedHint && (
        <div className="location-feedback-box warning" role="status">
          <span>
            As coordenadas informadas parecem ter latitude e longitude invertidas
            para Santo Antônio de Pádua. Nenhuma troca automática foi feita.
          </span>
          <button
            type="button"
            className="location-inline-btn"
            onClick={handleSwapHint}
          >
            Inverter lat/lon
          </button>
        </div>
      )}

      {!selectedPoint ? (
        <p className="location-geocoder-note">
          <strong>Busca por endereço:</strong> não habilitada nesta etapa devido
          aos limites de uso de geocodificadores públicos (proibição de
          autocomplete e taxa global compartilhada) e à baixa cobertura de nomes
          e números prediais no OSM local.
        </p>
      ) : (
        <div className="location-result-stack">
          {/* Selected point header & actions */}
          <div
            className="location-selected-meta"
            data-testid="location-selected-coords"
          >
            <div className="location-coords-row">
              <strong>
                {formatCoordPtBr(selectedPoint.lat, 5)},{" "}
                {formatCoordPtBr(selectedPoint.lon, 5)}
              </strong>
              <span className="location-origin-tag">
                {pointOrigin === "map_click" ? "Clique no mapa" : "Coordenadas"}
              </span>
            </div>

            <div className="location-coverage-row">
              <span
                className={`location-coverage-pill ${
                  activeOutsideCoverage ? "outside" : "within"
                }`}
                data-testid="location-coverage-status"
              >
                {activeOutsideCoverage
                  ? "Fora da cobertura conhecida do modelo SGB"
                  : "Dentro da extensão coberta pelo modelo SGB"}
              </span>
            </div>

            <div className="location-point-actions">
              <button
                type="button"
                className="location-inline-btn"
                onClick={onFocusPoint}
              >
                Centralizar no ponto
              </button>
              <button
                type="button"
                className="location-inline-btn"
                onClick={() => void handleCopySummary()}
                title="Copiar resumo técnico com coordenadas, cota, estação e fonte (sem endereço pessoal)"
              >
                {copyFeedback ? "Resumo copiado" : "Copiar resumo técnico"}
              </button>
            </div>
          </div>

          {/* Active scenario spatial relation (Single OR Comparison A/B) */}
          {mode === "single" && singleResult && singleHeadline && (
            <div
              className={`location-relation-box ${relationCssClass(
                singleResult.relation,
                activeOutsideCoverage,
              )}`}
              data-testid="location-relation-result"
              data-relation={singleResult.relation}
              data-coverage={singleResult.coverageStatus ?? "unknown"}
            >
              <div className="location-relation-head">
                <strong>{singleHeadline}</strong>
                <span className="location-relation-tag">
                  {relationShortLabel(singleResult.relation)}
                </span>
              </div>

              <p className="location-relation-meta">
                {SGB_REFERENCE_STATION_LABEL} · Cota{" "}
                {formatMetersFromCm(singleResult.levelCm)} m (
                {singleResult.levelCm} cm)
                {SGB_STAGE_ELEVATIONS[singleResult.levelCm as SgbFloodLevelCm]
                  ? ` · Alt. ${SGB_STAGE_ELEVATIONS[
                      singleResult.levelCm as SgbFloodLevelCm
                    ]
                      .toFixed(2)
                      .replace(".", ",")} m`
                  : ""}
                .
              </p>

              {singleResult.status === "valid" &&
                singleResult.relation === "boundary" && (
                  <p className="location-relation-detail">
                    Ponto localizado sobre o contorno vetorial SGB (tolerância
                    métrica de ±
                    {DEFAULT_BOUNDARY_TOLERANCE_METERS.toFixed(1).replace(
                      ".",
                      ",",
                    )}{" "}
                    m sobre anel externo ou interno).
                  </p>
                )}

              {singleResult.status === "unavailable" && (
                <p className="location-relation-detail">
                  {singleResult.reason}
                </p>
              )}

              <p className="location-safety-note">
                {singleResult.safetyDisclaimer}
              </p>
            </div>
          )}

          {mode === "compare" && compareResult && compareHeadline && (
            <div
              className={`location-relation-box ${
                compareResult.status !== "valid"
                  ? "is-unavailable"
                  : compareResult.combinedRelation === "neither"
                    ? activeOutsideCoverage
                      ? "is-outside-coverage"
                      : "is-outside"
                    : "is-inside"
              }`}
              data-testid="location-relation-result"
              data-combined-relation={compareResult.combinedRelation}
              data-coverage={compareResult.coverageStatus ?? "unknown"}
            >
              <div className="location-relation-head">
                <strong>{compareHeadline}</strong>
              </div>

              <div className="location-compare-chips">
                <span
                  className={`location-stage-pill ${relationCssClass(
                    compareResult.relationA,
                    activeOutsideCoverage,
                  )}`}
                  data-testid="location-compare-relation-a"
                >
                  A ({formatMetersFromCm(compareResult.levelACm)} m):{" "}
                  {relationShortLabel(compareResult.relationA)}
                </span>
                <span
                  className={`location-stage-pill ${relationCssClass(
                    compareResult.relationB,
                    activeOutsideCoverage,
                  )}`}
                  data-testid="location-compare-relation-b"
                >
                  B ({formatMetersFromCm(compareResult.levelBCm)} m):{" "}
                  {relationShortLabel(compareResult.relationB)}
                </span>
              </div>

              {compareResult.reason && (
                <p className="location-relation-detail">
                  {compareResult.reason}
                </p>
              )}

              <p className="location-safety-note">
                {compareResult.safetyDisclaimer}
              </p>
            </div>
          )}

          {/* Cross-stage 11-scenario on-demand analysis */}
          <div className="cross-stage-section">
            <div className="cross-stage-header">
              <strong>Consulta entre as 11 cotas oficiais</strong>
              {crossStageStatus === "running" ? (
                <button
                  type="button"
                  className="location-inline-btn danger"
                  onClick={onCancelAllStages}
                >
                  Cancelar
                </button>
              ) : (
                <button
                  type="button"
                  className="cross-stage-run-btn"
                  onClick={onAnalyzeAllStages}
                  data-testid="analyze-all-stages-btn"
                >
                  {crossStageStatus === "completed"
                    ? crossStageSummary &&
                      crossStageSummary.failedLevelsCm.length > 0
                      ? "Tentar cenários pendentes"
                      : "Reanalisar 11 cotas"
                    : "Analisar nas 11 cotas"}
                </button>
              )}
            </div>

            {crossStageStatus === "idle" && (
              <p className="cross-stage-hint">
                Executa somente sob solicitação (com cache local e concorrência
                limitada), verificando cada cota de 3,00 m a 5,50 m sem
                interpolação e sem presumir aninhamento.
              </p>
            )}

            {crossStageStatus === "running" && (
              <div
                className="cross-stage-progress"
                role="status"
                aria-live="polite"
                data-testid="cross-stage-progress"
              >
                <div className="cross-stage-progress-text">
                  <span>
                    Consultando cenários SGB: {crossStageCompleted}/
                    {crossStageTotal}
                  </span>
                  {crossStageCachedHits > 0 && (
                    <span>({crossStageCachedHits} em cache)</span>
                  )}
                </div>
                <div className="cross-stage-progress-track" aria-hidden="true">
                  <div
                    className="cross-stage-progress-fill"
                    style={{
                      width: `${Math.round(
                        (crossStageCompleted / Math.max(1, crossStageTotal)) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {crossStageSummary && (
              <div
                className="cross-stage-results"
                data-testid="cross-stage-results"
              >
                <div
                  className="cross-stage-lowest-box"
                  data-testid="cross-stage-lowest"
                >
                  <span className="cross-stage-lowest-label">
                    Menor cota identificada entre os cenários consultados
                  </span>
                  <strong>
                    {crossStageSummary.lowestInterceptedLevelCm !== null
                      ? `${formatMetersFromCm(
                          crossStageSummary.lowestInterceptedLevelCm,
                        )} m (${crossStageSummary.lowestInterceptedLevelCm} cm)`
                      : "Nenhuma interseção identificada"}
                  </strong>
                  <p className="cross-stage-distinction-note">
                    {crossStageSummary.lowestStageDistinctionNote}
                  </p>
                </div>

                {crossStageSummary.hasNonNestedPattern && (
                  <div
                    className="location-feedback-box warning"
                    role="status"
                    data-testid="cross-stage-non-nested-warning"
                  >
                    <strong>Padrão não aninhado identificado:</strong> o ponto é
                    interceptado em{" "}
                    {crossStageSummary.nonNestedTransitions
                      .map(
                        (t) =>
                          `${formatMetersFromCm(t.lowerInterceptedCm)} m (e fora em ${formatMetersFromCm(t.higherOutsideCm)} m)`,
                      )
                      .join("; ")}
                    . Por isso todas as 11 cotas são verificadas
                    independentemente.
                  </div>
                )}

                {crossStageSummary.failedLevelsCm.length > 0 && (
                  <div
                    className="location-feedback-box error"
                    role="alert"
                    data-testid="cross-stage-partial-error"
                  >
                    {crossStageSummary.failedLevelsCm.length} de{" "}
                    {crossStageSummary.totalStages} cenário(s) indisponível(is) (
                    {crossStageSummary.failedLevelsCm
                      .map((cm) => `${formatMetersFromCm(cm)} m`)
                      .join(", ")}
                    ). Cenários com falha não são tratados como ausência de
                    interseção.
                  </div>
                )}

                <div
                  className="cross-stage-matrix"
                  role="list"
                  aria-label="Resultado do ponto nas 11 cotas oficiais SGB"
                >
                  {crossStageSummary.entries.map((entry) => {
                    const cls =
                      entry.status === "pending"
                        ? "is-pending"
                        : relationCssClass(entry.relation, activeOutsideCoverage);
                    return (
                      <button
                        key={entry.levelCm}
                        type="button"
                        role="listitem"
                        className={`cross-stage-chip ${cls}`}
                        data-testid={`cross-stage-chip-${entry.levelCm}`}
                        data-relation={entry.relation}
                        data-status={entry.status}
                        onClick={() =>
                          onSelectStageFromMatrix(entry.levelCm / 100)
                        }
                        title={`Abrir cota ${formatMetersFromCm(
                          entry.levelCm,
                        )} m no mapa — ${relationShortLabel(entry.relation)}`}
                      >
                        <b>{formatMetersFromCm(entry.levelCm)} m</b>
                        <span>
                          {entry.status === "pending"
                            ? "..."
                            : relationShortLabel(entry.relation)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
