"use client";

import { useMemo, useRef, useState } from "react";
import { ControlPointsCatalogCard } from "@/components/history/ControlPointsCatalogCard";
import { EventComparisonPanel } from "@/components/history/EventComparisonPanel";
import {
  EventDetailPanel,
  type HistoricalMapAssociationSelection,
} from "@/components/history/EventDetailPanel";
import {
  DEFAULT_HISTORICAL_FILTERS,
  extractAvailableYears,
  filterAndSortHistoricalEvents,
  findStationObservation,
  resolveHistoricalMapAssociation,
  type HistoricalEventFilters,
  type HistoricalSortOrder,
} from "@/lib/history/analysis";
import {
  HISTORICAL_CATALOG_VERSION,
  HISTORICAL_FLOOD_EVENTS,
  HISTORICAL_STATION_REGISTRY,
  PROVENANCE_ARTIFACTS,
} from "@/lib/history/catalog";
import type {
  HistoricalEventClassification,
  HistoricalFloodEvent,
  HistoricalStationId,
} from "@/lib/history/contract";
import { HISTORICAL_CONTROL_POINTS } from "@/lib/history/controlPoints";
import { formatHistoricalStage } from "@/lib/history/normalize";
import type { GeoPoint } from "@/lib/sgb/location";

const FILTERABLE_STATIONS = HISTORICAL_STATION_REGISTRY.filter(
  (s) => s.historicalAuditStatus !== "inventory_only_not_audited",
);

function TimelineEventCard({
  event,
  isSelected,
  onSelect,
}: Readonly<{
  event: HistoricalFloodEvent;
  isSelected: boolean;
  onSelect: () => void;
}>) {
  const sgbObs = findStationObservation(event, "RHN-58790002");
  const ineaObs = findStationObservation(event, "INEA-213042120");
  const mapAssoc = resolveHistoricalMapAssociation(event);

  return (
    <li className="history-timeline-item">
      <div className="history-timeline-marker" aria-hidden="true">
        <span
          className={`timeline-dot ${
            event.classification === "documented_urban_flood"
              ? "urban"
              : "hydro"
          }`}
        />
      </div>

      <button
        type="button"
        className={`history-event-card ${isSelected ? "selected" : ""}`}
        aria-pressed={isSelected}
        onClick={onSelect}
      >
        <div className="history-card-top">
          <span className="history-card-period">{event.periodLabel}</span>
          <span
            className={`history-class-badge ${
              event.classification === "documented_urban_flood"
                ? "urban-flood"
                : "hydro-pulse"
            }`}
          >
            {event.classification === "documented_urban_flood"
              ? "Inundação urbana documentada"
              : "Evento hidrológico elevado"}
          </span>
        </div>

        <strong className="history-card-title">{event.title}</strong>
        <span className="history-card-dates">
          {event.startDateIso} a {event.endDateIso} · <code>{event.id}</code>
        </span>

        <div className="history-card-peaks">
          {typeof sgbObs?.peakStageCm === "number" && (
            <span className="peak-chip sgb">
              RHN 58790002:{" "}
              <b>
                {formatHistoricalStage(
                  sgbObs.peakStageCm,
                  sgbObs.rawPeakValue,
                  sgbObs.rawPeakUnit,
                )}
              </b>
            </span>
          )}

          {typeof ineaObs?.peakStageCm === "number" && (
            <span className="peak-chip inea">
              INEA 213042120:{" "}
              <b>
                {formatHistoricalStage(
                  ineaObs.peakStageCm,
                  ineaObs.rawPeakValue,
                  ineaObs.rawPeakUnit,
                )}
              </b>
            </span>
          )}

          {ineaObs?.availability === "unavailable_critical_gap" && (
            <span className="peak-chip gap">
              INEA 213042120: lacuna crítica (01–18/01/2023)
            </span>
          )}
        </div>

        <div className="history-card-footer">
          <span>
            {event.documentaryEvidence.length}{" "}
            {event.documentaryEvidence.length === 1
              ? "evidência documental"
              : "evidências documentais"}
          </span>
          <span
            className={`map-compat-tag ${
              mapAssoc.status === "compatible" ? "ready" : "blocked"
            }`}
          >
            {mapAssoc.status === "compatible"
              ? `Mapa SGB aprox.: ${(mapAssoc.recommendedSingleStageCm / 100).toFixed(2).replace(".", ",")} m`
              : "Sem equivalência SGB confirmada"}
          </span>
        </div>
      </button>
    </li>
  );
}

export function FloodHistorySection({
  onGoToMap,
  onSelectHistoricalMapScenario,
  onInspectCoordinateOnMap,
}: Readonly<{
  onGoToMap: () => void;
  onSelectHistoricalMapScenario: (
    selection: HistoricalMapAssociationSelection,
  ) => void;
  onInspectCoordinateOnMap: (point: GeoPoint, label: string) => void;
}>) {
  const [filters, setFilters] = useState<HistoricalEventFilters>(
    DEFAULT_HISTORICAL_FILTERS,
  );
  const [selectedEventId, setSelectedEventId] =
    useState<string>("HIST-2026-02-25");
  const detailContainerRef = useRef<HTMLDivElement | null>(null);

  const availableYears = useMemo(
    () => extractAvailableYears(HISTORICAL_FLOOD_EVENTS),
    [],
  );

  const filteredEvents = useMemo(
    () => filterAndSortHistoricalEvents(HISTORICAL_FLOOD_EVENTS, filters),
    [filters],
  );

  const activeEvent = useMemo(() => {
    const exact = filteredEvents.find((ev) => ev.id === selectedEventId);
    return exact ?? filteredEvents[0] ?? null;
  }, [filteredEvents, selectedEventId]);

  const urbanFloodTotal = useMemo(
    () =>
      HISTORICAL_FLOOD_EVENTS.filter(
        (ev) => ev.classification === "documented_urban_flood",
      ).length,
    [],
  );

  const elevatedPulseTotal = HISTORICAL_FLOOD_EVENTS.length - urbanFloodTotal;

  const hasActiveFilters =
    filters.year !== "all" ||
    filters.stationId !== "all" ||
    filters.classification !== "all" ||
    filters.sortOrder !== DEFAULT_HISTORICAL_FILTERS.sortOrder;

  return (
    <section
      className="content-page history-page"
      aria-labelledby="history-page-title"
    >
      <div className="content-container">
        <header className="page-header">
          <div>
            <h2 id="history-page-title">
              Histórico hidrológico e acervo de enchentes
            </h2>
            <p>
              Registro público rastreável de eventos de cheia e pulsos
              hidrológicos elevados do Rio Pomba em Santo Antônio de Pádua (RJ),
              com separação estrita entre referências hidrométricas, qualidade
              observacional e evidências documentais (catálogo{" "}
              <code>{HISTORICAL_CATALOG_VERSION}</code>).
            </p>
          </div>
          <button
            type="button"
            className="secondary-action-btn"
            onClick={onGoToMap}
          >
            Voltar ao mapa
          </button>
        </header>

        <div className="official-notice-banner" role="note">
          <strong>Aviso institucional e científico:</strong> Esta plataforma não
          substitui os alertas e as orientações dos órgãos oficiais (Defesa
          Civil, INEA, SGB e ANA). Leituras do INEA e da RHN/SGB permanecem
          independentes, picos ausentes nunca são preenchidos com zero e manchas
          estáticas do SGB nunca são apresentadas como registro exato de uma
          enchente histórica.
        </div>

        {/* Summary KPI Strip */}
        <div
          className="history-kpi-strip"
          aria-label="Resumo quantitativo do acervo histórico"
        >
          <div className="history-kpi-card">
            <span>Eventos catalogados (2012–2026)</span>
            <strong>{HISTORICAL_FLOOD_EVENTS.length}</strong>
            <small>Períodos prioritários auditados</small>
          </div>
          <div className="history-kpi-card">
            <span>Inundações urbanas documentadas</span>
            <strong>{urbanFloodTotal}</strong>
            <small>Com decretos, Defesa Civil ou fotos verificadas</small>
          </div>
          <div className="history-kpi-card">
            <span>Eventos hidrológicos elevados</span>
            <strong>{elevatedPulseTotal}</strong>
            <small>Superaram limiares sem confirmação urbana</small>
          </div>
          <div className="history-kpi-card">
            <span>Referências hidrológicas separadas</span>
            <strong>{HISTORICAL_STATION_REGISTRY.length}</strong>
            <small>Sem conversão arbitrária entre réguas</small>
          </div>
        </div>

        {/* Functional Filters */}
        <section
          className="card history-filters-card"
          aria-label="Filtros da linha do tempo histórica"
        >
          <div className="history-filters-grid">
            <div className="history-filter-field">
              <label htmlFor="history-filter-year">Filtrar por ano</label>
              <select
                id="history-filter-year"
                value={filters.year === "all" ? "all" : String(filters.year)}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    year:
                      e.target.value === "all" ? "all" : Number(e.target.value),
                  }))
                }
              >
                <option value="all">Todos os anos ({availableYears.join(", ")})</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="history-filter-field">
              <label htmlFor="history-filter-station">
                Estação com medição verificada
              </label>
              <select
                id="history-filter-station"
                value={filters.stationId}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    stationId: e.target.value as HistoricalStationId | "all",
                  }))
                }
              >
                <option value="all">Todas as estações auditadas</option>
                {FILTERABLE_STATIONS.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.shortName}
                  </option>
                ))}
              </select>
            </div>

            <div className="history-filter-field">
              <label htmlFor="history-filter-class">
                Classificação documental
              </label>
              <select
                id="history-filter-class"
                value={filters.classification}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    classification: e.target.value as
                      | HistoricalEventClassification
                      | "all",
                  }))
                }
              >
                <option value="all">Todos os registros</option>
                <option value="documented_urban_flood">
                  Somente inundações urbanas documentadas ({urbanFloodTotal})
                </option>
                <option value="elevated_hydrological_event">
                  Somente eventos hidrológicos elevados ({elevatedPulseTotal})
                </option>
              </select>
            </div>

            <div className="history-filter-field">
              <label htmlFor="history-filter-sort">Ordenação temporal</label>
              <select
                id="history-filter-sort"
                value={filters.sortOrder}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    sortOrder: e.target.value as HistoricalSortOrder,
                  }))
                }
              >
                <option value="newest_first">Mais recentes primeiro</option>
                <option value="oldest_first">Cronológica (2012 → 2026)</option>
              </select>
            </div>
          </div>

          <div className="history-filters-status">
            <output aria-live="polite">
              Exibindo <strong>{filteredEvents.length}</strong> de{" "}
              {HISTORICAL_FLOOD_EVENTS.length} eventos catalogados.
            </output>
            {hasActiveFilters && (
              <button
                type="button"
                className="location-inline-btn"
                onClick={() => setFilters(DEFAULT_HISTORICAL_FILTERS)}
              >
                Limpar filtros
              </button>
            )}
          </div>
        </section>

        {/* Master-Detail: Chronological Timeline + Selected Event Details */}
        {filteredEvents.length === 0 ? (
          <output className="card history-empty-state" aria-live="polite">
            <strong>
              Nenhum evento encontrado para os filtros selecionados.
            </strong>
            <p>
              Ajuste o ano, a estação hidrológica ou a classe documental para
              visualizar os registros catalogados.
            </p>
          </output>
        ) : (
          <div className="history-master-detail">
            <div
              className="history-timeline-column"
              aria-label="Linha do tempo de eventos hidrológicos"
            >
              <ol className="history-timeline-list">
                {filteredEvents.map((ev) => (
                  <TimelineEventCard
                    key={ev.id}
                    event={ev}
                    isSelected={activeEvent?.id === ev.id}
                    onSelect={() => {
                      setSelectedEventId(ev.id);
                      if (
                        typeof window !== "undefined" &&
                        window.innerWidth <= 960
                      ) {
                        detailContainerRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }
                    }}
                  />
                ))}
              </ol>
            </div>

            <div
              className="history-detail-column"
              ref={detailContainerRef}
              tabIndex={-1}
            >
              {activeEvent && (
                <EventDetailPanel
                  event={activeEvent}
                  controlPoints={HISTORICAL_CONTROL_POINTS}
                  onSelectHistoricalMapScenario={onSelectHistoricalMapScenario}
                  onInspectCoordinateOnMap={onInspectCoordinateOnMap}
                />
              )}
            </div>
          </div>
        )}

        {/* Station-scoped Event Comparison */}
        <EventComparisonPanel events={HISTORICAL_FLOOD_EVENTS} />

        {/* Scientific Validation Control Points */}
        <ControlPointsCatalogCard
          controlPoints={HISTORICAL_CONTROL_POINTS}
          onInspectCoordinateOnMap={onInspectCoordinateOnMap}
        />

        {/* Independent Hydrological References & Provenance Inventory */}
        <article
          className="card history-stations-audit-card"
          aria-labelledby="history-stations-ref-title"
        >
          <div className="card-heading">
            <div>
              <strong id="history-stations-ref-title">
                Independência entre estações hidrológicas e inventário de procedência
              </strong>
              <p className="section-lead history-sublead">
                Cadastro completo das cinco estações de referência mantidas em
                separação estrita e dos nove artefatos primários verificados por
                checksum SHA-256.
              </p>
            </div>
            <span
              className="data-origin-badge official"
              data-classification="official_reference"
            >
              Rastreabilidade
            </span>
          </div>

          <div className="history-stations-ref-grid">
            {HISTORICAL_STATION_REGISTRY.map((st) => (
              <div key={st.id} className="station-item">
                <div className="station-item-header">
                  <strong>{st.shortName}</strong>
                  <span
                    className={`station-status-tag ${
                      st.sgbCrosswalkValidated ? "mapped" : "unmapped"
                    }`}
                  >
                    {st.sgbCrosswalkValidated
                      ? "Referência manchas SGB"
                      : "Escala independente"}
                  </span>
                </div>
                <p className="station-item-codes">{st.codesLabel}</p>
                <p className="station-item-inst">
                  {st.institution} · Unidade nativa: <code>{st.nativeStageUnit}</code>
                </p>
                <p className="station-item-loc">{st.gaugeZeroStatusNote}</p>
                <p className="station-item-note">{st.independenceConstraintNote}</p>
                <a
                  className="source-link"
                  href={st.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Consultar referência institucional ↗
                </a>
              </div>
            ))}
          </div>

          <details className="history-provenance-drawer">
            <summary>
              Ver inventário completo dos {PROVENANCE_ARTIFACTS.length} artefatos
              de procedência (URLs, versões, hashes SHA-256 e direitos)
            </summary>
            <ul className="history-provenance-list full">
              {PROVENANCE_ARTIFACTS.map((art) => (
                <li key={art.id}>
                  <strong>{art.title}</strong> ({art.versionOrDate}) —{" "}
                  {art.institution}
                  {art.sha256 ? (
                    <div className="history-provenance-meta">
                      SHA-256: <code>{art.sha256}</code>
                      {art.sizeBytes !== null
                        ? ` · ${art.sizeBytes.toLocaleString("pt-BR")} B`
                        : ""}
                    </div>
                  ) : null}
                  <div className="history-provenance-rights">
                    {art.usageAndRedistribution}{" "}
                    <a
                      className="source-link"
                      href={art.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir link ↗
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        </article>
      </div>
    </section>
  );
}
