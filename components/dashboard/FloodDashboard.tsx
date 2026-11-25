"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import {
  FloodMap,
  type FloodLayerStatus,
} from "@/components/map/FloodMap";
import { MethodologyModal } from "@/components/dashboard/MethodologyModal";
import {
  AboutMethodologySection,
  DataSourcesSection,
  MonitoringSection,
} from "@/components/dashboard/PlatformSections";
import { HydroMonitoringCard } from "@/components/monitoring/HydroMonitoringCard";
import { useHydroMonitoring } from "@/lib/hydro/useHydroMonitoring";
import {
  formatFloodArea,
  type DerivedFloodAreaResult,
} from "@/lib/sgb/area";
import {
  SGB_FLOOD_LEVELS_CM,
  SGB_STAGE_ELEVATIONS,
  type SgbFloodLevelCm,
} from "@/lib/sgb/stages";

export type PlatformSection = "mapa" | "monitoramento" | "fontes" | "sobre";

function formatMetersFromCm(levelCm: number) {
  return (levelCm / 100).toFixed(2).replace(".", ",");
}

const NAV_ITEMS: readonly { readonly id: PlatformSection; readonly label: string }[] = [
  { id: "mapa", label: "Mapa e cenários" },
  { id: "monitoramento", label: "Monitoramento" },
  { id: "fontes", label: "Dados e fontes" },
  { id: "sobre", label: "Sobre e metodologia" },
];

export function FloodDashboard() {
  const [activeSection, setActiveSection] = useState<PlatformSection>("mapa");
  const [level, setLevel] = useState(4.25);
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);
  const [layerStatus, setLayerStatus] = useState<FloodLayerStatus>({
    state: "loading",
    levelCm: 425,
  });
  const [derivedArea, setDerivedArea] = useState<DerivedFloodAreaResult | null>(
    null,
  );
  const [retryToken, setRetryToken] = useState(0);

  const monitoring = useHydroMonitoring();
  const mapPanelRef = useRef<HTMLElement | null>(null);
  const realtimeCardRef = useRef<HTMLElement | null>(null);

  const levelCm = Math.round(level * 100);
  const ortometricElevation = SGB_STAGE_ELEVATIONS[levelCm as SgbFloodLevelCm];
  const minLevel = SGB_FLOOD_LEVELS_CM[0] / 100;
  const maxLevel = SGB_FLOOD_LEVELS_CM[SGB_FLOOD_LEVELS_CM.length - 1] / 100;

  const handleRetry = useCallback(() => {
    setRetryToken((prev) => prev + 1);
  }, []);

  const handleOpenMethodology = useCallback(() => {
    setIsMethodologyOpen(true);
  }, []);

  const handleCloseMethodology = useCallback(() => {
    setIsMethodologyOpen(false);
  }, []);

  const handleGoToMap = useCallback(() => {
    setActiveSection("mapa");
  }, []);

  const handleGoToSources = useCallback(() => {
    setActiveSection("fontes");
  }, []);

  const handleSelectStageAndOpenMap = useCallback((nextLevel: number) => {
    setLevel(nextLevel);
    setActiveSection("mapa");
  }, []);

  const handleStepLevel = useCallback(
    (deltaMeters: number) => {
      setLevel((prev) => {
        const next = Math.round((prev + deltaMeters) * 100) / 100;
        if (next < minLevel) return minLevel;
        if (next > maxLevel) return maxLevel;
        return next;
      });
    },
    [minLevel, maxLevel],
  );

  const mapBadge = useMemo(() => {
    if (layerStatus.levelCm !== levelCm) {
      return "Carregando cenário oficial do SGB...";
    }
    if (layerStatus.state === "official") {
      return `Cota ${formatMetersFromCm(layerStatus.levelCm)} m${
        ortometricElevation
          ? ` (${ortometricElevation.toFixed(2).replace(".", ",")} m ortométrica)`
          : ""
      }`;
    }
    if (layerStatus.state === "error") {
      return "Mancha SGB indisponível · nenhuma extensão exibida";
    }
    if (layerStatus.state === "empty") {
      return "SGB retornou camada vazia · nenhuma extensão exibida";
    }
    return "Carregando cenário oficial do SGB...";
  }, [layerStatus, ortometricElevation, levelCm]);

  const validDerivedArea =
    layerStatus.state === "official" &&
    layerStatus.levelCm === levelCm &&
    derivedArea?.status === "valid" &&
    derivedArea.levelCm === levelCm
      ? derivedArea
      : null;

  const formattedArea = validDerivedArea
    ? formatFloodArea(validDerivedArea.areaSquareMeters)
    : null;

  return (
    <div className="platform-root">
      {/* Top Navigation Bar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            ≈
          </div>
          <div>
            <h1>Pádua FloodSim</h1>
            <span>Santo Antônio de Pádua, RJ · Rio Pomba</span>
          </div>
        </div>

        <nav className="topnav" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-btn ${activeSection === item.id ? "active" : ""}`}
              aria-current={activeSection === item.id ? "page" : undefined}
              onClick={() => setActiveSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="platform-main">
        {/* View A: Interactive Map & Official SGB Scenarios */}
        <div
          className={`map-workspace ${activeSection === "mapa" ? "" : "is-hidden"}`}
          aria-hidden={activeSection !== "mapa"}
        >
          <section
            className="map-panel"
            ref={mapPanelRef}
            tabIndex={-1}
            aria-label="Mapa e cenários de inundação"
          >
            <FloodMap
              level={level}
              onStatusChange={setLayerStatus}
              onDerivedAreaChange={setDerivedArea}
              retryToken={retryToken}
              isVisible={activeSection === "mapa"}
            />

            {/* Bottom Scenario Controls */}
            <div className="slider-card">
              <div className="slider-status-bar">
                <div className={`scenario-status-badge ${layerStatus.state}`}>
                  <span
                    className="data-origin-badge official"
                    data-classification="official_reference"
                  >
                    Cenário oficial SGB
                  </span>
                  <span role="status" aria-live="polite">
                    {mapBadge}
                  </span>
                  {(layerStatus.state === "error" ||
                    layerStatus.state === "empty") && (
                    <button
                      type="button"
                      className="badge-retry-btn"
                      onClick={handleRetry}
                      title="Tentar carregar novamente a mancha do SGB"
                    >
                      Tentar novamente
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="methodology-trigger-btn"
                  onClick={handleOpenMethodology}
                  title="Ver detalhes de fonte, estação e metodologia do SGB (2024)"
                >
                  Fonte e metodologia
                </button>
              </div>

              <div className="slider-title">
                <div>
                  <strong>Cota do cenário de referência</strong>
                  <span>
                    Estação SGB/ANA 58790002 · Cenário estático de referência
                    (não indica a extensão atual do rio nem profundidade). Não
                    equivale à régua do INEA.
                  </span>
                </div>
                <div className="slider-value-group">
                  <b>{level.toFixed(2).replace(".", ",")} m</b>
                  {Number.isFinite(ortometricElevation) && (
                    <span className="elev-label">
                      Alt. ortométrica:{" "}
                      {ortometricElevation.toFixed(2).replace(".", ",")} m
                    </span>
                  )}
                </div>
              </div>

              <div className="slider-control-row">
                <button
                  type="button"
                  className="stage-step-btn"
                  onClick={() => handleStepLevel(-0.25)}
                  disabled={level <= minLevel}
                  aria-label="Diminuir cota em 25 centímetros"
                  title="Diminuir 0,25 m"
                >
                  −
                </button>
                <input
                  aria-label="Cota da mancha oficial do SGB"
                  type="range"
                  min={minLevel}
                  max={maxLevel}
                  step="0.25"
                  value={level}
                  aria-valuetext={`${level.toFixed(2).replace(".", ",")} metros, cenário oficial SGB`}
                  onChange={(event) => setLevel(Number(event.target.value))}
                />
                <button
                  type="button"
                  className="stage-step-btn"
                  onClick={() => handleStepLevel(0.25)}
                  disabled={level >= maxLevel}
                  aria-label="Aumentar cota em 25 centímetros"
                  title="Aumentar 0,25 m"
                >
                  +
                </button>
              </div>

              <div className="slider-scale">
                <span>3,00 m</span>
                <span>4,25 m</span>
                <span>5,50 m</span>
              </div>

              {/* Quick Stage Shortcuts */}
              <div
                className="quick-stages"
                role="group"
                aria-label="Atalhos de cotas SGB"
              >
                <span className="quick-stages-label">Atalhos:</span>
                {[3.0, 4.25, 5.5].map((stage) => {
                  const label = `${stage.toFixed(2).replace(".", ",")} m`;
                  return (
                    <button
                      key={stage}
                      type="button"
                      className={`stage-chip ${level === stage ? "active" : ""}`}
                      aria-pressed={level === stage}
                      onClick={() => setLevel(stage)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Right Contextual Information Panel */}
          <aside className="right-panel" aria-label="Informações hidrológicas e legenda">
            <p className="official-notice-compact" role="note">
              Esta plataforma não substitui os alertas e as orientações dos
              órgãos oficiais.
            </p>

            {/* Derived Spatial Metric: Area of Selected SGB Scenario */}
            {validDerivedArea && formattedArea && (
              <article
                className="card area-metric-card"
                data-classification="derived"
                aria-labelledby="selected-area-title"
              >
                <div className="card-heading">
                  <strong id="selected-area-title">
                    Área da mancha selecionada
                  </strong>
                  <span
                    className="data-origin-badge derived"
                    data-classification="derived"
                  >
                    Dado derivado
                  </span>
                </div>
                <div className="area-metric-values">
                  <b className="area-metric-primary">{formattedArea.primary}</b>
                  <span className="area-metric-secondary">
                    ({formattedArea.secondary})
                  </span>
                </div>
                <p className="area-metric-meta">
                  Cenário SGB {formatMetersFromCm(validDerivedArea.levelCm)} m (
                  {validDerivedArea.levelCm} cm) · {validDerivedArea.source}.
                </p>
                <small className="area-metric-note">
                  Cálculo geodésico (WGS84) sobre os polígonos oficiais
                  carregados. Representa apenas a extensão do cenário escolhido,
                  não a área inundada no momento.
                </small>
              </article>
            )}

            {/* Real INEA Hydro Monitoring Card */}
            <HydroMonitoringCard
              cardRef={realtimeCardRef}
              monitoring={monitoring}
              id="realtime-card"
            />

            {/* Map Legend & Sources Card */}
            <article className="card">
              <div className="card-heading">
                <strong>Legenda do mapa</strong>
              </div>

              <div className="legend-list">
                <div className="official-layer-legend">
                  <i className="legend-swatch-flood" aria-hidden="true" />
                  <div>
                    <strong>Cenário oficial SGB (2024)</strong>
                    <small>
                      Extensão horizontal estimada para a cota selecionada. Não
                      indica profundidade, dano, probabilidade ou risco
                      individual.
                    </small>
                  </div>
                </div>

                <div className="official-layer-legend">
                  <i className="legend-swatch-station" aria-hidden="true" />
                  <div>
                    <strong>Estações hidrológicas (INEA)</strong>
                    <small>
                      Localização oficial de Santo Antônio de Pádua (213042120)
                      e Ponte Paraoquena (58789000). Clique no marcador para ver
                      detalhes.
                    </small>
                  </div>
                </div>
              </div>

              <div className="source-links-group">
                <button
                  type="button"
                  className="methodology-link-btn"
                  onClick={handleOpenMethodology}
                >
                  Metodologia e parâmetros do SGB
                </button>
                <button
                  type="button"
                  className="methodology-link-btn"
                  onClick={handleGoToSources}
                >
                  Consultar todas as fontes e cotas
                </button>
                <a
                  className="source-link"
                  href="https://rigeo.sgb.gov.br/handle/doc/25035"
                  target="_blank"
                  rel="noreferrer"
                >
                  Relatório técnico do SGB (2024) ↗
                </a>
              </div>
            </article>
          </aside>
        </div>

        {/* View B: Monitoramento do Rio Pomba */}
        {activeSection === "monitoramento" && (
          <MonitoringSection
            monitoring={monitoring}
            onGoToMap={handleGoToMap}
          />
        )}

        {/* View C: Dados e fontes */}
        {activeSection === "fontes" && (
          <DataSourcesSection
            onSelectStageAndOpenMap={handleSelectStageAndOpenMap}
          />
        )}

        {/* View D: Sobre e metodologia */}
        {activeSection === "sobre" && (
          <AboutMethodologySection
            onGoToMap={handleGoToMap}
            onGoToSources={handleGoToSources}
          />
        )}
      </main>

      {/* Official SGB Methodology Modal */}
      <MethodologyModal
        isOpen={isMethodologyOpen}
        onClose={handleCloseMethodology}
      />
    </div>
  );
}
