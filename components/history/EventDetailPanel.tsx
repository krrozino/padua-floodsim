"use client";

import { useMemo } from "react";
import { getControlPointEvidenceLabel } from "@/components/history/ControlPointsCatalogCard";
import { HistoricalHydrographViewer } from "@/components/history/HistoricalHydrographViewer";
import { resolveHistoricalMapAssociation } from "@/lib/history/analysis";
import {
  getProvenanceArtifactById,
  getStationReferenceById,
} from "@/lib/history/catalog";
import type {
  DocumentaryBasisLevel,
  DocumentaryEvidenceKind,
  HistoricalControlPoint,
  HistoricalFloodEvent,
  HistoricalStationId,
  StationEventAvailability,
  StationEventObservation,
  StationThresholdDuration,
} from "@/lib/history/contract";
import {
  prepareHistoricalHydrograph,
  type RawHydrographPoint,
} from "@/lib/history/hydrograph";
import {
  formatCoveragePct,
  formatDurationHours,
  formatHistoricalDischarge,
  formatHistoricalRain,
  formatHistoricalStage,
  formatTrimmedDecimalPtBr,
} from "@/lib/history/normalize";
import type { GeoPoint } from "@/lib/sgb/location";
import type { SgbFloodLevelCm } from "@/lib/sgb/stages";

export type HistoricalMapAssociationSelection = {
  readonly eventId: string;
  readonly eventTitle: string;
  readonly eventPeriodLabel: string;
  readonly observedPeakCm: number;
  readonly historicalEquivalenceConfirmed: boolean;
  readonly representationLabel: string;
  readonly mode: "single" | "compare";
  readonly stageACm: SgbFloodLevelCm;
  readonly stageBCm: SgbFloodLevelCm | null;
};

function formatSgbMeters(cm: number): string {
  return (cm / 100).toFixed(2).replace(".", ",");
}

function getAvailabilityBadge(availability: StationEventAvailability): {
  readonly label: string;
  readonly tone: "ok" | "warn" | "blocked";
} {
  switch (availability) {
    case "verified_telemetry":
      return { label: "Telemetria verificada", tone: "ok" };
    case "verified_documentary_peak":
      return { label: "Pico documental oficial", tone: "ok" };
    case "unavailable_critical_gap":
      return { label: "Lacuna crítica na fonte", tone: "blocked" };
    case "suspect_flatline":
      return { label: "Sinal travado (flatline)", tone: "blocked" };
    case "partial_coverage_unusable":
      return { label: "Cobertura parcial insuficiente", tone: "warn" };
    case "not_audited_for_period":
      return { label: "Recorte não extraído", tone: "warn" };
  }
}

function getEvidenceKindLabel(kind: DocumentaryEvidenceKind): string {
  switch (kind) {
    case "municipal_decree":
      return "Decreto municipal";
    case "technical_report":
      return "Relatório técnico institucional";
    case "civil_defense_record":
      return "Registro oficial Defesa Civil";
    case "academic_study":
      return "Estudo acadêmico";
    case "press_report":
      return "Imprensa verificada";
    case "external_photograph":
      return "Fotografia externa creditada";
    case "project_audit":
      return "Auditoria interna do projeto";
  }
}

function getDocumentaryBasisLabel(level: DocumentaryBasisLevel): string {
  switch (level) {
    case "primary_official_act_and_report":
      return "Base documental primária (decreto municipal oficial e/ou relatório SGB)";
    case "secondary_press_citing_civil_defense":
      return "Base secundária (imprensa regional citando Defesa Civil / SEDEC-RJ)";
    case "hydrological_telemetry_only":
      return "Base hidrométrica (sem confirmação documental de inundação urbana)";
  }
}

function ThresholdDurationItem({
  dur,
}: Readonly<{
  dur: StationThresholdDuration;
}>) {
  if (dur.aggregationScope === "multi_event_or_annual_aggregate") {
    return (
      <li>
        <strong>{dur.thresholdLabel} (agregado multi-evento/anual):</strong>{" "}
        {formatDurationHours(dur.aggregateHoursReported)} ({dur.sourceLabel})
        {dur.note ? ` — ${dur.note}` : ""}
      </li>
    );
  }

  const provenText =
    dur.provenContinuousHours !== null
      ? formatDurationHours(dur.provenContinuousHours)
      : "Não comprovada continuamente (janela mesclada / BLOCKED_LOCAL_DATA)";

  return (
    <li>
      <strong>{dur.thresholdLabel}:</strong> duração contínua comprovada:{" "}
      <strong>{provenText}</strong>
      {dur.mergedWindowSpanHours !== null && (
        <>
          {" "}
          · janela mesclada:{" "}
          {formatDurationHours(dur.mergedWindowSpanHours)}
        </>
      )}
      {dur.readingsAboveCount !== null && (
        <>
          {" "}
          · {dur.readingsAboveCount.toLocaleString("pt-BR")} leituras acima do
          limiar
        </>
      )}
      {dur.nominalSampleSupportHours !== null && (
        <>
          {" "}
          (suporte amostral nominal:{" "}
          {formatDurationHours(dur.nominalSampleSupportHours)})
        </>
      )}
      {dur.unaccountedSlotsInWindow !== null &&
        dur.unaccountedSlotsInWindow > 0 && (
          <>
            {" "}
            · {dur.unaccountedSlotsInWindow.toLocaleString("pt-BR")} passos
            abaixo do limiar ou em lacuna
          </>
        )}{" "}
      ({dur.sourceLabel}){dur.note ? ` — ${dur.note}` : ""}
    </li>
  );
}

function StationObservationCard({
  obs,
}: Readonly<{
  obs: StationEventObservation;
}>) {
  const station = getStationReferenceById(obs.stationId);
  const avail = getAvailabilityBadge(obs.availability);

  return (
    <div className="history-station-obs-card">
      <div className="history-station-obs-head">
        <div>
          <strong>{station?.shortName ?? obs.stationId}</strong>
          <span className="history-station-codes">
            {station?.codesLabel} · {station?.institution}
          </span>
        </div>
        <span className={`history-avail-pill ${avail.tone}`}>{avail.label}</span>
      </div>

      <dl className="history-obs-grid">
        <div>
          <dt>Nível máximo observado</dt>
          <dd>
            <strong>
              {formatHistoricalStage(
                obs.peakStageCm,
                obs.rawPeakValue,
                obs.rawPeakUnit,
              )}
            </strong>
          </dd>
        </div>

        <div>
          <dt>Horário do pico e fuso</dt>
          <dd>
            {obs.peakTimestamp ? (
              <>
                <span>{obs.peakTimestamp.displayBrt}</span>
                <small className="history-ts-original">
                  Original: <code>{obs.peakTimestamp.originalTimestamp}</code>
                </small>
              </>
            ) : (
              "Não disponível"
            )}
          </dd>
        </div>

        <div>
          <dt>Vazão máxima do evento</dt>
          <dd>
            {formatHistoricalDischarge(obs.peakDischargeM3s)}
            {obs.dischargeNote && (
              <small className="history-obs-subnote">{obs.dischargeNote}</small>
            )}
          </dd>
        </div>

        <div>
          <dt>Chuva acumulada</dt>
          <dd>
            {formatHistoricalRain(obs.accumulatedRainMm)}
            {obs.rainWindowNote && (
              <small className="history-obs-subnote">{obs.rainWindowNote}</small>
            )}
          </dd>
        </div>

        <div>
          <dt>Cobertura na janela do evento</dt>
          <dd>
            {formatCoveragePct(obs.coveragePct)}
            {obs.periodAggregateNote && (
              <small className="history-obs-subnote">
                {obs.periodAggregateNote}
              </small>
            )}
          </dd>
        </div>

        <div>
          <dt>Referência e continuidade vertical</dt>
          <dd>
            {obs.verticalReferenceLabel}
            <small className="history-obs-subnote">
              {obs.datumContinuityNote}
            </small>
          </dd>
        </div>
      </dl>

      {obs.peakTimestamp?.conversionNote && (
        <p className="history-obs-note">
          <strong>Nota de timestamp/fuso:</strong>{" "}
          {obs.peakTimestamp.conversionNote}
        </p>
      )}

      {obs.secondaryPeaks.length > 0 && (
        <div className="history-secondary-peaks">
          <strong>
            Leituras complementares / divergências registradas na mesma estação:
          </strong>
          <ul>
            {obs.secondaryPeaks.map((sp) => (
              <li key={`${sp.sourceTitle}-${sp.nativeLabel}`}>
                <strong>{sp.nativeLabel}</strong> ({sp.sourceTitle}) — {sp.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {obs.thresholdDurations.length > 0 && (
        <div className="history-durations-box">
          <strong>Duração acima dos limiares da própria estação:</strong>
          <ul>
            {obs.thresholdDurations.map((dur) => (
              <ThresholdDurationItem key={dur.thresholdLabel} dur={dur} />
            ))}
          </ul>
        </div>
      )}

      <p className="history-obs-quality">
        <strong>Qualidade e consistência:</strong> {obs.qualitySummary}
      </p>

      {obs.gapsAndInconsistencies.length > 0 && (
        <ul className="history-gaps-list">
          {obs.gapsAndInconsistencies.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EventDetailPanel({
  event,
  controlPoints,
  authorizedSeriesByStation,
  onSelectHistoricalMapScenario,
  onInspectCoordinateOnMap,
}: Readonly<{
  event: HistoricalFloodEvent;
  controlPoints: readonly HistoricalControlPoint[];
  authorizedSeriesByStation?: Partial<
    Record<HistoricalStationId, readonly RawHydrographPoint[]>
  >;
  onSelectHistoricalMapScenario: (
    selection: HistoricalMapAssociationSelection,
  ) => void;
  onInspectCoordinateOnMap: (point: GeoPoint, label: string) => void;
}>) {
  const mapAssociation = useMemo(
    () => resolveHistoricalMapAssociation(event),
    [event],
  );

  const linkedControlPoints = useMemo(
    () => controlPoints.filter((cp) => event.controlPointIds.includes(cp.id)),
    [controlPoints, event.controlPointIds],
  );

  const eventProvenanceArtifacts = useMemo(() => {
    const ids = new Set<string>();
    for (const obs of event.stationObservations) {
      for (const pid of obs.provenanceIds) {
        ids.add(pid);
      }
    }
    return Array.from(ids)
      .map((pid) => getProvenanceArtifactById(pid))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [event.stationObservations]);

  const preparedHydrographs = useMemo(() => {
    return event.stationObservations.map((obs) => {
      const injected = authorizedSeriesByStation?.[obs.stationId];
      const availability = injected
        ? "available_authorized"
        : obs.seriesAvailability;
      return {
        stationId: obs.stationId,
        seriesNote: obs.seriesAvailabilityNote,
        result: prepareHistoricalHydrograph({
          stationId: obs.stationId,
          seriesAvailability: availability,
          rawPoints: injected ?? [],
        }),
      };
    });
  }, [event.stationObservations, authorizedSeriesByStation]);

  const readyHydrographs = preparedHydrographs.filter(
    (
      item,
    ): item is {
      stationId: HistoricalStationId;
      seriesNote: string;
      result: Extract<typeof item.result, { status: "ready" }>;
    } => item.result.status === "ready",
  );

  return (
    <article
      className="card history-detail-panel"
      aria-labelledby="history-event-detail-title"
    >
      <header className="history-detail-header">
        <div className="history-detail-badges">
          <span className="history-id-pill">{event.id}</span>
          {event.candidateEventId && (
            <span className="history-id-pill muted">
              Manifesto: {event.candidateEventId}
            </span>
          )}
          <span
            className={`history-class-badge ${
              event.classification === "documented_urban_flood"
                ? "urban-flood"
                : "hydro-pulse"
            }`}
          >
            {event.classification === "documented_urban_flood"
              ? "Inundação urbana documentada"
              : "Evento hidrológico elevado (sem confirmação urbana)"}
          </span>
        </div>

        <h3 id="history-event-detail-title">{event.title}</h3>
        <p className="history-detail-dates">
          <strong>Período:</strong> {event.periodLabel} ({event.startDateIso} a{" "}
          {event.endDateIso}) ·{" "}
          <span>{getDocumentaryBasisLabel(event.documentaryBasisLevel)}</span>
        </p>
        <p className="history-detail-window-note">{event.windowTimestampNote}</p>
      </header>

      <div className="history-detail-summary-box">
        <p>
          <strong>Síntese verificada:</strong> {event.summary}
        </p>
        <p>
          <strong>Dinâmica na bacia do Rio Pomba:</strong>{" "}
          {event.hydrologicalContext}
        </p>
        <p>
          <strong>Critério de enquadramento:</strong>{" "}
          {event.classificationRationale}
        </p>
        {event.urbanImpactSummary && (
          <p className="history-urban-impact">
            <strong>Impactos urbanos documentados:</strong>{" "}
            {event.urbanImpactSummary}
          </p>
        )}
      </div>

      {event.keyDivergencesAndCaveats.length > 0 && (
        <section
          className="history-detail-section"
          aria-label="Divergências e ressalvas científicas"
        >
          <h4>Divergências auditadas e ressalvas de referência</h4>
          <ul className="history-warning-list">
            {event.keyDivergencesAndCaveats.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Station-separated hydrological records */}
      <section
        className="history-detail-section"
        aria-label="Registros por estação hidrológica"
      >
        <h4>Medições separadas por estação hidrológica e referência vertical</h4>
        <p className="history-section-caption">
          As escalas de RHN 58790002 (cm), INEA 213042120 (m), Barra do Braúna
          (cm) e Cataguases (cm) são fisicamente independentes e nunca recebem
          offsets arbitrários. Agregados mensais ou anuais permanecem separados
          das métricas específicas de cada evento.
        </p>
        <div className="history-station-obs-stack">
          {event.stationObservations.map((obs) => (
            <StationObservationCard key={obs.stationId} obs={obs} />
          ))}
        </div>
      </section>

      {/* Section 7: Historical Map Association */}
      <section
        className="history-detail-section"
        aria-label="Associação espacial ao mapa histórico"
      >
        <h4>Mapa histórico e distinção de representações espaciais</h4>
        <div className="history-spatial-taxonomy-grid">
          <div className="taxonomy-box unavailable">
            <strong>1. Inundação observada</strong>
            <p>{mapAssociation.taxonomyNotes.observedFloodExtent}</p>
          </div>
          <div className="taxonomy-box official">
            <strong>2. Extensão oficial modelada</strong>
            <p>{mapAssociation.taxonomyNotes.officialModeledExtent}</p>
          </div>
          <div className="taxonomy-box derived">
            <strong>3. Representação derivada</strong>
            <p>{mapAssociation.taxonomyNotes.derivedRepresentation}</p>
          </div>
          <div className="taxonomy-box approximate">
            <strong>4. Cenário aproximado</strong>
            <p>{mapAssociation.taxonomyNotes.approximateScenario}</p>
          </div>
        </div>

        {mapAssociation.status === "compatible" ? (
          <div className="history-map-assoc-ready">
            <p className="history-map-assoc-lead">
              <strong>Compatibilidade verificada em RHN 58790002</strong> (pico
              observado de{" "}
              {formatTrimmedDecimalPtBr(mapAssociation.observedPeakCm, 2)} cm ·
              datum {mapAssociation.verticalDatum}):
            </p>
            <p className="history-map-assoc-warning">
              {mapAssociation.nonExactWarning}
            </p>
            <div className="history-map-assoc-actions">
              <button
                type="button"
                className="primary-map-assoc-btn"
                onClick={() =>
                  onSelectHistoricalMapScenario({
                    eventId: event.id,
                    eventTitle: event.title,
                    eventPeriodLabel: event.periodLabel,
                    observedPeakCm: mapAssociation.observedPeakCm,
                    historicalEquivalenceConfirmed: true,
                    representationLabel: mapAssociation.isExactSgbStage
                      ? `Extensão oficial modelada (${formatSgbMeters(mapAssociation.recommendedSingleStageCm)} m)`
                      : `Cenário aproximado (${formatSgbMeters(mapAssociation.recommendedSingleStageCm)} m na régua 58790002)`,
                    mode: "single",
                    stageACm: mapAssociation.recommendedSingleStageCm,
                    stageBCm: null,
                  })
                }
              >
                {mapAssociation.isExactSgbStage
                  ? `Abrir extensão oficial modelada (${formatSgbMeters(mapAssociation.recommendedSingleStageCm)} m) no mapa`
                  : `Associar cenário SGB aproximado (${formatSgbMeters(mapAssociation.recommendedSingleStageCm)} m) no mapa`}
              </button>

              {mapAssociation.bracketingCompareStagesCm && (
                <button
                  type="button"
                  className="secondary-action-btn"
                  onClick={() => {
                    const pair = mapAssociation.bracketingCompareStagesCm;
                    if (!pair) return;
                    const [lowCm, highCm] = pair;
                    onSelectHistoricalMapScenario({
                      eventId: event.id,
                      eventTitle: event.title,
                      eventPeriodLabel: event.periodLabel,
                      observedPeakCm: mapAssociation.observedPeakCm,
                      historicalEquivalenceConfirmed: true,
                      representationLabel: `Representação derivada — faixa SGB ${formatSgbMeters(lowCm)} × ${formatSgbMeters(highCm)} m`,
                      mode: "compare",
                      stageACm: lowCm,
                      stageBCm: highCm,
                    });
                  }}
                >
                  Comparar cotas adjacentes{" "}
                  {formatSgbMeters(mapAssociation.bracketingCompareStagesCm[0])}{" "}
                  ×{" "}
                  {formatSgbMeters(mapAssociation.bracketingCompareStagesCm[1])}{" "}
                  m no mapa (sem interpolar)
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="history-blocked-notice">
            <strong>Associação histórica ao mapa bloqueada:</strong>{" "}
            {mapAssociation.reason}
            {mapAssociation.independentScenarioExploration && (
              <div className="history-map-assoc-ready">
                <p className="history-map-assoc-warning">
                  <strong>
                    Exploração de cenário SGB independente (sem equivalência
                    histórica confirmada):
                  </strong>{" "}
                  {mapAssociation.independentScenarioExploration.disclaimer}
                </p>
                <div className="history-map-assoc-actions">
                  <button
                    type="button"
                    className="secondary-action-btn"
                    onClick={() => {
                      const indep =
                        mapAssociation.independentScenarioExploration;
                      if (!indep) return;
                      onSelectHistoricalMapScenario({
                        eventId: event.id,
                        eventTitle: event.title,
                        eventPeriodLabel: event.periodLabel,
                        observedPeakCm: indep.nominalObservedPeakCm,
                        historicalEquivalenceConfirmed: false,
                        representationLabel: `Exploração independente SGB (${formatSgbMeters(indep.nominalSingleStageCm)} m — sem equivalência histórica confirmada)`,
                        mode: "single",
                        stageACm: indep.nominalSingleStageCm,
                        stageBCm: null,
                      });
                    }}
                  >
                    Explorar cenário SGB independente (
                    {formatSgbMeters(
                      mapAssociation.independentScenarioExploration
                        .nominalSingleStageCm,
                    )}{" "}
                    m, sem equivalência confirmada)
                  </button>

                  {mapAssociation.independentScenarioExploration
                    .nominalBracketingStagesCm && (
                    <button
                      type="button"
                      className="secondary-action-btn"
                      onClick={() => {
                        const indep =
                          mapAssociation.independentScenarioExploration;
                        if (!indep?.nominalBracketingStagesCm) return;
                        const [lowCm, highCm] = indep.nominalBracketingStagesCm;
                        onSelectHistoricalMapScenario({
                          eventId: event.id,
                          eventTitle: event.title,
                          eventPeriodLabel: event.periodLabel,
                          observedPeakCm: indep.nominalObservedPeakCm,
                          historicalEquivalenceConfirmed: false,
                          representationLabel: `Exploração independente derivada — faixa SGB ${formatSgbMeters(lowCm)} × ${formatSgbMeters(highCm)} m (sem equivalência histórica confirmada)`,
                          mode: "compare",
                          stageACm: lowCm,
                          stageBCm: highCm,
                        });
                      }}
                    >
                      Explorar faixa SGB independente{" "}
                      {formatSgbMeters(
                        mapAssociation.independentScenarioExploration
                          .nominalBracketingStagesCm[0],
                      )}{" "}
                      ×{" "}
                      {formatSgbMeters(
                        mapAssociation.independentScenarioExploration
                          .nominalBracketingStagesCm[1],
                      )}{" "}
                      m (sem equivalência confirmada)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section 6: Hydrographs and Replay */}
      <section
        className="history-detail-section"
        aria-label="Hidrogramas e reprodução temporal"
      >
        <h4>Hidrogramas contínuos e replay da evolução hidrológica</h4>
        {readyHydrographs.length > 0 ? (
          readyHydrographs.map((item) => (
            <HistoricalHydrographViewer
              key={item.stationId}
              hydrograph={item.result}
            />
          ))
        ) : (
          <div className="history-hydrograph-blocked-box">
            <strong>
              Séries contínuas e replay interativo indisponíveis neste ambiente{" "}
              (<code>BLOCKED_LOCAL_DATA</code> / autorização pendente)
            </strong>
            <p>
              O motor de hidrogramas e replay temporal (preservação explícita de
              lacunas, cursor, limiares por estação e velocidade 1×–8×) está
              implementado e validado em testes, mas as séries subdiárias brutas
              e processadas (<code>data/processed/hydrology/*.csv</code> e{" "}
              <code>Santo Antonio de Pádua.xlsx</code>) permanecem fora do
              repositório público até confirmação institucional de redistribuição
              (pendências #6, #37 e #46).{" "}
              <strong>
                Nenhuma curva sintética é fabricada a partir dos picos isolados
                catalogados acima.
              </strong>
            </p>
            <ul className="history-hydrograph-status-list">
              {preparedHydrographs.map((item) => {
                const st = getStationReferenceById(item.stationId);
                return (
                  <li key={item.stationId}>
                    <strong>{st?.shortName ?? item.stationId}:</strong>{" "}
                    {item.seriesNote}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Section 8: Documentary & Photographic Archive */}
      <section
        className="history-detail-section"
        aria-label="Acervo documental e fotográfico"
      >
        <h4>Evidências documentais, decretos e registros fotográficos externos</h4>
        <div className="history-docs-list">
          {event.documentaryEvidence.map((doc) => (
            <div key={doc.id} className="history-doc-card">
              <div className="history-doc-head">
                <span className="history-doc-kind">
                  {getEvidenceKindLabel(doc.kind)}
                </span>
                <span className="history-doc-date">{doc.publishedDate}</span>
              </div>
              <strong>{doc.title}</strong>
              <p className="history-doc-author">
                <strong>Autor / Instituição:</strong> {doc.authorOrInstitution}
                {doc.locationDescription
                  ? ` · Local: ${doc.locationDescription}`
                  : ""}
              </p>
              <p className="history-doc-summary">{doc.summary}</p>

              {doc.photoAttribution && (
                <div className="history-photo-credit-box">
                  <strong>Registro fotográfico identificado (link externo):</strong>
                  <span>
                    Crédito: {doc.photoAttribution.photographerOrCredit} · Data:{" "}
                    {doc.photoAttribution.captureOrPublicationDate} · Local
                    confirmado: {doc.photoAttribution.verifiedLocation}
                  </span>
                  <small>{doc.photoAttribution.externalOnlyReason}</small>
                </div>
              )}

              <p className="history-doc-rights">
                <strong>Condições de uso:</strong> {doc.usageRights}
                {doc.sha256 ? (
                  <>
                    {" "}
                    · <code>SHA-256: {doc.sha256.slice(0, 16)}…</code>
                  </>
                ) : null}
              </p>

              <a
                className="source-link"
                href={doc.url}
                target="_blank"
                rel="noreferrer"
              >
                Consultar documento / registro na fonte original ↗
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Provenance hashes for this event */}
      <section
        className="history-detail-section"
        aria-label="Rastreabilidade técnica de fontes e hashes"
      >
        <h4>Rastreabilidade técnica (artefatos, versões e hashes SHA-256)</h4>
        <ul className="history-provenance-list">
          {eventProvenanceArtifacts.map((art) => (
            <li key={art.id}>
              <div>
                <strong>{art.title}</strong> ({art.versionOrDate}) —{" "}
                <span>{art.institution}</span>
              </div>
              <div className="history-provenance-meta">
                {art.sha256 && (
                  <span>
                    SHA-256: <code>{art.sha256}</code>
                  </span>
                )}
                {art.sizeBytes !== null && (
                  <span>
                    {" "}
                    · {art.sizeBytes.toLocaleString("pt-BR")} bytes
                  </span>
                )}
              </div>
              <div className="history-provenance-rights">
                {art.usageAndRedistribution}{" "}
                <a
                  className="source-link"
                  href={art.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Fonte ↗
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Linked Control Points for this event */}
      {linkedControlPoints.length > 0 && (
        <section
          className="history-detail-section"
          aria-label="Pontos de controle associados ao evento"
        >
          <h4>Pontos de controle vinculados a este evento</h4>
          <div className="history-linked-cp-list">
            {linkedControlPoints.map((cp) => {
              const rec = cp.eventRecords.find((r) => r.eventId === event.id);
              const state = rec?.state ?? "unknown";
              return (
                <div key={cp.id} className="history-linked-cp-item">
                  <div className="history-linked-cp-head">
                    <strong>{cp.name}</strong>
                    <span className={`cp-state-badge state-${state}`}>
                      {getControlPointEvidenceLabel(state)}
                    </span>
                  </div>
                  <p>{rec?.evidenceSummary ?? cp.validationUsageNote}</p>
                  {cp.coordinatesWgs84 && (
                    <button
                      type="button"
                      className="location-inline-btn"
                      onClick={() =>
                        cp.coordinatesWgs84 &&
                        onInspectCoordinateOnMap(cp.coordinatesWgs84, cp.name)
                      }
                    >
                      Consultar coordenada ({cp.coordinatesWgs84.lat.toFixed(5).replace(".", ",")},{" "}
                      {cp.coordinatesWgs84.lon.toFixed(5).replace(".", ",")}) no mapa
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}
