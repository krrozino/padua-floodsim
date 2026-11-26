"use client";

import { useEffect, useState, type FormEvent, type ClipboardEvent } from "react";
import {
  formatCoordPtBr,
  formatLocationTechnicalSummary,
  parseCoordinatePairText,
  parseLatLonFields,
  type CrossStagePointSummary,
  type GeoPoint,
  type HydraulicDomainStatus,
  type MapServerEnvelopeStatus,
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
      return "Fronteira (±0,5 m)";
    case "outside":
      return "Fora";
    default:
      return "Indisponível";
  }
}

function relationChipLabel(relation: SpatialPointRelation): string {
  switch (relation) {
    case "inside":
      return "Interior";
    case "boundary":
      return "Fronteira";
    case "outside":
      return "Fora";
    default:
      return "Indisp.";
  }
}

function relationCssClass(
  relation: SpatialPointRelation,
  outsideEnvelope = false,
): string {
  if (relation === "inside") return "is-inside";
  if (relation === "boundary") return "is-boundary";
  if (relation === "outside") {
    return outsideEnvelope ? "is-outside-coverage" : "is-outside";
  }
  return "is-unavailable";
}

function singleResultHeadline(result: PointScenarioQueryResult): string {
  if (result.status !== "valid") {
    return "Informação indisponível";
  }
  if (result.relation === "inside") {
    return "Interceptado pela geometria consultada";
  }
  if (result.relation === "boundary") {
    return "Ponto na faixa de proximidade da fronteira (±0,5 m)";
  }
  if (result.envelopeStatus === "outside_mapserver_envelope") {
    return "Fora do envelope auxiliar do MapServer SGB";
  }
  return "Sem interseção com a geometria consultada";
}

function compareResultHeadline(result: PointComparisonQueryResult): string {
  if (result.status !== "valid") {
    return "Informação indisponível na comparação";
  }
  switch (result.combinedRelation) {
    case "both":
      return "Interceptado por A e B (A ∩ B)";
    case "only_a":
      return String.raw`Interceptado apenas por A (A \ B)`;
    case "only_b":
      return String.raw`Interceptado apenas por B (B \ A)`;
    case "neither":
      return result.envelopeStatus === "outside_mapserver_envelope"
        ? "Fora do envelope auxiliar do MapServer SGB"
        : "Sem interseção nas geometrias A e B";
    default:
      return "Informação indisponível na comparação";
  }
}

function getCompareBoxClass(
  result: PointComparisonQueryResult,
  outsideEnvelope: boolean,
): string {
  if (result.status !== "valid") return "is-unavailable";
  if (result.combinedRelation === "neither") {
    return outsideEnvelope ? "is-outside-coverage" : "is-outside";
  }
  if (
    result.relationA !== "inside" &&
    result.relationB !== "inside" &&
    result.involvesBoundaryProximity
  ) {
    return "is-boundary";
  }
  return "is-inside";
}

function getCoveragePillText(
  envelopeStatus: MapServerEnvelopeStatus | null,
  hydraulicDomainStatus: HydraulicDomainStatus | null,
): string {
  if (envelopeStatus === "outside_mapserver_envelope") {
    return "Fora do envelope auxiliar do MapServer SGB";
  }
  if (hydraulicDomainStatus === "covered") {
    return "Dentro do domínio hidráulico validado";
  }
  return "Dentro do envelope auxiliar do MapServer · domínio hidráulico desconhecido";
}

function getCrossStageButtonLabel(
  status: "idle" | "running" | "completed",
  summary: CrossStagePointSummary | null,
): string {
  if (status !== "completed") {
    return "Analisar nas 11 cotas";
  }
  if (summary && summary.failedLevelsCm.length > 0) {
    return "Tentar cenários pendentes";
  }
  return "Reanalisar 11 cotas";
}

function SingleScenarioRelationBox({
  result,
  outsideEnvelope,
}: Readonly<{
  result: PointScenarioQueryResult;
  outsideEnvelope: boolean;
}>) {
  const elevation = SGB_STAGE_ELEVATIONS[result.levelCm as SgbFloodLevelCm];
  return (
    <div
      className={`location-relation-box ${relationCssClass(
        result.relation,
        outsideEnvelope,
      )}`}
      data-testid="location-relation-result"
      data-relation={result.relation}
      data-envelope={result.envelopeStatus ?? "unknown"}
      data-hydraulic-domain={result.hydraulicDomainStatus ?? "unknown"}
    >
      <div className="location-relation-head">
        <strong>{singleResultHeadline(result)}</strong>
        <span className="location-relation-tag">
          {relationShortLabel(result.relation)}
        </span>
      </div>

      <p className="location-relation-meta">
        {SGB_REFERENCE_STATION_LABEL} · Cota {formatMetersFromCm(result.levelCm)}{" "}
        m ({result.levelCm} cm)
        {elevation ? ` · Alt. ${elevation.toFixed(2).replace(".", ",")} m` : ""}.
      </p>

      {result.status === "valid" && result.relation === "boundary" && (
        <p
          className="location-relation-detail"
          data-testid="location-boundary-semantics"
        >
          {result.boundarySemanticsNote}
        </p>
      )}

      {result.status === "unavailable" && (
        <p className="location-relation-detail">{result.reason}</p>
      )}

      <p className="location-safety-note">{result.safetyDisclaimer}</p>
    </div>
  );
}

function CompareScenarioRelationBox({
  result,
  outsideEnvelope,
}: Readonly<{
  result: PointComparisonQueryResult;
  outsideEnvelope: boolean;
}>) {
  return (
    <div
      className={`location-relation-box ${getCompareBoxClass(
        result,
        outsideEnvelope,
      )}`}
      data-testid="location-relation-result"
      data-combined-relation={result.combinedRelation}
      data-envelope={result.envelopeStatus ?? "unknown"}
      data-hydraulic-domain={result.hydraulicDomainStatus ?? "unknown"}
    >
      <div className="location-relation-head">
        <strong>{compareResultHeadline(result)}</strong>
      </div>

      <div className="location-compare-chips">
        <span
          className={`location-stage-pill ${relationCssClass(
            result.relationA,
            outsideEnvelope,
          )}`}
          data-testid="location-compare-relation-a"
        >
          A ({formatMetersFromCm(result.levelACm)} m):{" "}
          {relationShortLabel(result.relationA)}
        </span>
        <span
          className={`location-stage-pill ${relationCssClass(
            result.relationB,
            outsideEnvelope,
          )}`}
          data-testid="location-compare-relation-b"
        >
          B ({formatMetersFromCm(result.levelBCm)} m):{" "}
          {relationShortLabel(result.relationB)}
        </span>
      </div>

      {result.involvesBoundaryProximity && (
        <p
          className="location-relation-detail"
          data-testid="location-boundary-semantics"
        >
          {result.boundarySemanticsNote}
        </p>
      )}

      {result.reason && (
        <p className="location-relation-detail">{result.reason}</p>
      )}

      <p className="location-safety-note">{result.safetyDisclaimer}</p>
    </div>
  );
}

function formatLowestCrossStageLabel(
  summary: CrossStagePointSummary | null,
): string {
  if (!summary || summary.lowestInterceptedLevelCm === null) {
    return "Nenhuma interseção identificada";
  }
  const baseLabel = `${formatMetersFromCm(summary.lowestInterceptedLevelCm)} m (${summary.lowestInterceptedLevelCm} cm)`;
  if (summary.lowestInterceptedRelation === "boundary") {
    return `${baseLabel} · fronteira (±0,5 m)`;
  }
  return baseLabel;
}

function CrossStageAnalysisSection({
  status,
  completed,
  total,
  cachedHits,
  summary,
  outsideEnvelope,
  onAnalyzeAllStages,
  onCancelAllStages,
  onSelectStageFromMatrix,
}: Readonly<{
  status: "idle" | "running" | "completed";
  completed: number;
  total: number;
  cachedHits: number;
  summary: CrossStagePointSummary | null;
  outsideEnvelope: boolean;
  onAnalyzeAllStages: () => void;
  onCancelAllStages: () => void;
  onSelectStageFromMatrix: (levelMeters: number) => void;
}>) {
  const lowestLabel = formatLowestCrossStageLabel(summary);

  return (
    <div className="cross-stage-section">
      <div className="cross-stage-header">
        <strong>Consulta entre as 11 cotas oficiais</strong>
        {status === "running" ? (
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
            {getCrossStageButtonLabel(status, summary)}
          </button>
        )}
      </div>

      {status === "idle" && (
        <p className="cross-stage-hint">
          Executa somente sob solicitação (com cache local e concorrência
          limitada), verificando cada cota de 3,00 m a 5,50 m sem interpolação e
          sem presumir aninhamento.
        </p>
      )}

      {status === "running" && (
        <output
          className="cross-stage-progress"
          aria-live="polite"
          data-testid="cross-stage-progress"
        >
          <div className="cross-stage-progress-text">
            <span>
              Consultando cenários SGB: {completed}/{total}
            </span>
            {cachedHits > 0 && <span>({cachedHits} em cache)</span>}
          </div>
          <div className="cross-stage-progress-track" aria-hidden="true">
            <div
              className="cross-stage-progress-fill"
              style={{
                width: `${Math.round((completed / Math.max(1, total)) * 100)}%`,
              }}
            />
          </div>
        </output>
      )}

      {summary && (
        <div className="cross-stage-results" data-testid="cross-stage-results">
          <div
            className="cross-stage-lowest-box"
            data-testid="cross-stage-lowest"
          >
            <span className="cross-stage-lowest-label">
              Menor cota identificada entre os cenários consultados
            </span>
            <strong>{lowestLabel}</strong>
            <p className="cross-stage-distinction-note">
              {summary.lowestStageDistinctionNote}
            </p>
          </div>

          {summary.hasNonNestedPattern && (
            <output
              className="location-feedback-box warning"
              data-testid="cross-stage-non-nested-warning"
            >
              <strong>Padrão não aninhado identificado:</strong> o ponto é
              interceptado em{" "}
              {summary.nonNestedTransitions
                .map(
                  (t) =>
                    `${formatMetersFromCm(t.lowerInterceptedCm)} m (e fora em ${formatMetersFromCm(t.higherOutsideCm)} m)`,
                )
                .join("; ")}
              . Por isso todas as 11 cotas são verificadas independentemente.
            </output>
          )}

          {summary.failedLevelsCm.length > 0 && (
            <div
              className="location-feedback-box error"
              role="alert"
              data-testid="cross-stage-partial-error"
            >
              {summary.failedLevelsCm.length} de {summary.totalStages}{" "}
              cenário(s) indisponível(is) (
              {summary.failedLevelsCm
                .map((cm) => `${formatMetersFromCm(cm)} m`)
                .join(", ")}
              ). Cenários com falha não são tratados como ausência de
              interseção.
            </div>
          )}

          <ul
            className="cross-stage-matrix"
            aria-label="Resultado do ponto nas 11 cotas oficiais SGB"
          >
            {summary.entries.map((entry) => {
              const cls =
                entry.status === "pending"
                  ? "is-pending"
                  : relationCssClass(entry.relation, outsideEnvelope);
              return (
                <li key={entry.levelCm}>
                  <button
                    type="button"
                    className={`cross-stage-chip ${cls}`}
                    data-testid={`cross-stage-chip-${entry.levelCm}`}
                    data-relation={entry.relation}
                    data-status={entry.status}
                    onClick={() => onSelectStageFromMatrix(entry.levelCm / 100)}
                    title={`Abrir cota ${formatMetersFromCm(
                      entry.levelCm,
                    )} m no mapa — ${relationShortLabel(entry.relation)}`}
                  >
                    <b>{formatMetersFromCm(entry.levelCm)} m</b>
                    <span>
                      {entry.status === "pending"
                        ? "..."
                        : relationChipLabel(entry.relation)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
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

  useEffect(() => {
    if (!selectedPoint) return;
    setLatInput(selectedPoint.lat.toFixed(5));
    setLonInput(selectedPoint.lon.toFixed(5));
    setInputError(null);
  }, [selectedPoint]);

  const handleLatPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!pasted) return;
    if (
      /[;\s]/.test(pasted.trim()) ||
      (pasted.includes(",") && pasted.includes("."))
    ) {
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

  const activeEnvelopeStatus: MapServerEnvelopeStatus | null =
    mode === "compare"
      ? (compareResult?.envelopeStatus ?? null)
      : (singleResult?.envelopeStatus ?? null);

  const activeHydraulicDomainStatus: HydraulicDomainStatus | null =
    mode === "compare"
      ? (compareResult?.hydraulicDomainStatus ?? null)
      : (singleResult?.hydraulicDomainStatus ?? null);

  const outsideEnvelope =
    activeEnvelopeStatus === "outside_mapserver_envelope";

  const handleCopySummary = async () => {
    if (!selectedPoint) return;
    let relationLabel = "Indisponível";
    if (mode === "compare" && compareResult) {
      relationLabel = compareResultHeadline(compareResult);
    } else if (mode === "single" && singleResult) {
      relationLabel = singleResultHeadline(singleResult);
    }

    const text = formatLocationTechnicalSummary({
      point: selectedPoint,
      mode,
      levelACm,
      levelBCm: mode === "compare" ? levelBCm : undefined,
      relationLabel,
      envelopeStatus: activeEnvelopeStatus,
      hydraulicDomainStatus: activeHydraulicDomainStatus,
      lowestInterceptedLevelCm:
        crossStageSummary?.lowestInterceptedLevelCm ?? undefined,
      lowestInterceptedRelation:
        crossStageSummary?.lowestInterceptedRelation ?? undefined,
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 2500);
    } catch {
      setCopyFeedback(false);
    }
  };

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
        <strong>WGS84 (EPSG:4326)</strong> para verificar a relação com a
        geometria oficial consultada do SGB.
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
        <output className="location-feedback-box warning">
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
        </output>
      )}

      {selectedPoint ? (
        <div className="location-result-stack">
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
                  outsideEnvelope ? "outside" : "within"
                }`}
                data-testid="location-coverage-status"
              >
                {getCoveragePillText(
                  activeEnvelopeStatus,
                  activeHydraulicDomainStatus,
                )}
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
                title="Copiar resumo técnico com coordenadas, cota, estação, fronteira e fonte (sem endereço pessoal)"
              >
                {copyFeedback ? "Resumo copiado" : "Copiar resumo técnico"}
              </button>
            </div>
          </div>

          {mode === "single" && singleResult && (
            <SingleScenarioRelationBox
              result={singleResult}
              outsideEnvelope={outsideEnvelope}
            />
          )}

          {mode === "compare" && compareResult && (
            <CompareScenarioRelationBox
              result={compareResult}
              outsideEnvelope={outsideEnvelope}
            />
          )}

          <CrossStageAnalysisSection
            status={crossStageStatus}
            completed={crossStageCompleted}
            total={crossStageTotal}
            cachedHits={crossStageCachedHits}
            summary={crossStageSummary}
            outsideEnvelope={outsideEnvelope}
            onAnalyzeAllStages={onAnalyzeAllStages}
            onCancelAllStages={onCancelAllStages}
            onSelectStageFromMatrix={onSelectStageFromMatrix}
          />
        </div>
      ) : (
        <p className="location-geocoder-note">
          <strong>Busca por endereço:</strong> não habilitada nesta etapa devido
          aos limites de uso de geocodificadores públicos (proibição de
          autocomplete e taxa global compartilhada) e à baixa cobertura de nomes
          e números prediais no OSM local.
        </p>
      )}
    </article>
  );
}
