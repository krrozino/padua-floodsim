"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import {
  FloodMap,
  type FloodLayerStatus,
} from "@/components/map/FloodMap";
import { REFERENCE_NEIGHBORHOODS } from "@/lib/map/neighborhoods";

const SGB_STAGE_ELEVATIONS: Record<number, number> = {
  300: 82.71,
  325: 82.96,
  350: 83.21,
  375: 83.46,
  400: 83.71,
  425: 83.96,
  450: 84.21,
  475: 84.46,
  500: 84.71,
  525: 84.96,
  550: 85.21,
};

function impactFor(level: number) {
  const severity = Math.max(0, level - 2.5);
  return {
    neighborhoods: Math.min(
      REFERENCE_NEIGHBORHOODS.length,
      Math.round(severity * 1.7),
    ),
    roads: Math.max(0, Math.round(severity * 22)),
    area: Math.max(0, severity * 1.06),
  };
}

function formatMetersFromCm(levelCm: number) {
  return (levelCm / 100).toFixed(2).replace(".", ",");
}

export function FloodDashboard() {
  const [level, setLevel] = useState(4.25);
  const [layerStatus, setLayerStatus] = useState<FloodLayerStatus>({
    state: "loading",
    levelCm: 425,
  });
  const [retryToken, setRetryToken] = useState(0);

  const realtimeCardRef = useRef<HTMLElement | null>(null);

  const levelCm = Math.round(level * 100);
  const ortometricElevation = SGB_STAGE_ELEVATIONS[levelCm];
  const impact = useMemo(() => impactFor(level), [level]);

  const handleRetry = useCallback(() => {
    setRetryToken((prev) => prev + 1);
  }, []);

  const handleScrollToRealtime = useCallback(() => {
    realtimeCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const mapBadge = useMemo(() => {
    if (layerStatus.state === "official") {
      return `Mancha oficial SGB · cota local ${formatMetersFromCm(layerStatus.levelCm)} m${
        ortometricElevation
          ? ` (${ortometricElevation.toFixed(2).replace(".", ",")} m ortométrica)`
          : ""
      }`;
    }
    if (layerStatus.state === "fallback") {
      return "Geoportal SGB indisponível · exibindo fallback demonstrativo";
    }
    return "Carregando mancha oficial do SGB...";
  }, [layerStatus, ortometricElevation]);

  return (
    <main className="shell">
      {/* Top Navigation Bar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            ≈
          </div>
          <div>
            <strong>Pádua FloodSim</strong>
            <span>Santo Antônio de Pádua, RJ · Foco no Rio Pomba</span>
          </div>
        </div>

        <nav className="topnav" aria-label="Navegação principal">
          <button
            type="button"
            className="nav-btn active"
            title="Visualização cartográfica ativa"
          >
            Mapa
          </button>
          <button
            type="button"
            className="nav-btn"
            disabled
            title="Módulo de simulação avançada e MDE (V4) — Em breve"
          >
            Simulação <span className="badge-soon">em breve</span>
          </button>
          <button
            type="button"
            className="nav-btn"
            disabled
            title="Módulo de alertas e avisos (V3) — Em breve"
          >
            Alertas <span className="badge-soon">em breve</span>
          </button>
          <button
            type="button"
            className="nav-btn"
            disabled
            title="Relatórios técnicos e exportação de dados GIS — Em breve"
          >
            Relatórios <span className="badge-soon">em breve</span>
          </button>
        </nav>

        <div
          className="status-pill"
          title="Versão 1.0 experimental · Dados oficiais de referência: SGB 2024"
        >
          <i /> V1 · SGB 2024
        </div>
      </header>

      {/* Left Sidebar */}
      <aside className="sidebar" aria-label="Seções do sistema">
        <button
          type="button"
          className="sidebar-btn active"
          title="Visualização principal do mapa interativo"
        >
          Mapa
        </button>
        <button
          type="button"
          className="sidebar-btn"
          onClick={handleScrollToRealtime}
          title="Visualizar painel de monitoramento do Rio Pomba"
        >
          Nível do rio
        </button>
        <button
          type="button"
          className="sidebar-btn"
          disabled
          title="Integração pluviométrica (V2) — Em breve"
        >
          Pluviometria <span className="badge-soon">em breve</span>
        </button>
        <button
          type="button"
          className="sidebar-btn"
          disabled
          title="Modelagem topográfica experimental com MDE (V3) — Em breve"
        >
          Simulações <span className="badge-soon">em breve</span>
        </button>
        <button
          type="button"
          className="sidebar-btn"
          disabled
          title="Sistema de alertas e contingência (V3) — Em breve"
        >
          Alertas <span className="badge-soon">em breve</span>
        </button>
        <button
          type="button"
          className="sidebar-btn"
          disabled
          title="Séries históricas e eventos passados (V3) — Em breve"
        >
          Histórico <span className="badge-soon">em breve</span>
        </button>
      </aside>

      {/* Main Interactive Map Section */}
      <section className="map-panel">
        <FloodMap
          level={level}
          onStatusChange={setLayerStatus}
          retryToken={retryToken}
        />

        {/* Status Badge */}
        <div className={`demo-badge ${layerStatus.state}`}>
          <span>{mapBadge}</span>
          {layerStatus.state === "fallback" && (
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

        {/* Bottom Slider & Scenario Controls */}
        <div className="slider-card">
          <div className="slider-title">
            <div>
              <strong>Cota do cenário oficial SGB</strong>
              <span>
                Estação RHN 58790002 · Manchas oficiais de 25 em 25 cm (SGB 2024).
                Não equivale à régua do INEA.
              </span>
            </div>
            <div className="slider-value-group">
              <b>{level.toFixed(2).replace(".", ",")} m</b>
              {ortometricElevation && (
                <span className="elev-label">
                  Alt. ortométrica: {ortometricElevation.toFixed(2).replace(".", ",")} m
                </span>
              )}
            </div>
          </div>

          <input
            aria-label="Cota da mancha oficial do SGB"
            type="range"
            min="3"
            max="5.5"
            step="0.25"
            value={level}
            onChange={(event) => setLevel(Number(event.target.value))}
          />

          <div className="slider-scale">
            <span>3,00 m (1º dano)</span>
            <span>4,25 m</span>
            <span>5,50 m (máx. modelada)</span>
          </div>

          {/* Quick Stage Shortcuts */}
          <div className="quick-stages" aria-label="Atalhos rápidos para cotas de teste">
            <span className="quick-stages-label">Testar cotas:</span>
            <button
              type="button"
              className={`stage-chip ${level === 3.0 ? "active" : ""}`}
              onClick={() => setLevel(3.0)}
              title="Cota 3,00 m (Primeiro dano / atenção SGB)"
            >
              3,00 m
            </button>
            <button
              type="button"
              className={`stage-chip ${level === 4.25 ? "active" : ""}`}
              onClick={() => setLevel(4.25)}
              title="Cota 4,25 m (Cenário intermediário próximo a cheia histórica)"
            >
              4,25 m
            </button>
            <button
              type="button"
              className={`stage-chip ${level === 5.5 ? "active" : ""}`}
              onClick={() => setLevel(5.5)}
              title="Cota 5,50 m (Cota máxima modelada pelo SGB)"
            >
              5,50 m
            </button>
          </div>
        </div>
      </section>

      {/* Right Information & Monitoring Panel */}
      <aside className="right-panel">
        {/* Real-time Monitoring Card (Explicitly MOCK) */}
        <article ref={realtimeCardRef} id="realtime-card" className="card realtime">
          <div className="card-heading">
            <strong>Nível em tempo real</strong>
            <span className="live-mock">
              <i /> MOCK / DEMO
            </span>
          </div>
          <h3>Rio Pomba · Estação INEA</h3>
          <div className="river-grid">
            <div>
              <span>Nível simulado</span>
              <b>4,35 m</b>
            </div>
            <div>
              <span>Tendência</span>
              <strong className="warning">subindo ↗</strong>
            </div>
            <div>
              <span>Transbordamento INEA</span>
              <strong className="danger">5,00 m</strong>
            </div>
            <div>
              <span>Chuva 24h</span>
              <strong>62 mm</strong>
            </div>
          </div>
          <small>
            ⚠️ <strong>Aviso:</strong> Nível, tendência e chuva exibidos neste painel são
            fictícios (mock demonstrativo). A régua do INEA não é convertida
            automaticamente para as cotas SGB até que a equivalência entre os zeros de régua
            seja tecnicamente validada.
          </small>
        </article>

        {/* Official SGB Inundation Layer Card */}
        <article className="card">
          <div className="card-heading">
            <strong>Camada de inundação</strong>
          </div>
          <div className="official-layer-legend">
            <i />
            <div>
              <strong>Extensão da mancha oficial (SGB 2024)</strong>
              <small>
                Polígonos por cota publicados pelo Serviço Geológico do Brasil.
                Representa <strong>extensão de inundação</strong>; profundidade d&apos;água
                não é calculada nesta camada de referência oficial.
              </small>
            </div>
          </div>
          <a
            className="source-link"
            href="https://rigeo.sgb.gov.br/handle/doc/25035"
            target="_blank"
            rel="noreferrer"
          >
            Ver relatório técnico do SGB (2024) ↗
          </a>
        </article>

        {/* Neighborhood Reference Disclaimer Card */}
        <article className="card">
          <div className="card-heading">
            <strong>Bairros de referência</strong>
          </div>
          <p className="neighborhood-explainer">
            Os nomes no mapa correspondem aos 27 bairros oficiais (Lei Municipal nº 3.864/2017).
            Como os limites poligonais vetoriais ainda estão pendentes de disponibilização
            pela Prefeitura, são exibidos como <strong>pontos de referência georreferenciados</strong>{" "}
            no mapa (não são polígonos inventados).
          </p>
        </article>

        {/* Estimated Metrics Card */}
        <article className="metrics">
          <div>
            <span>Bairros potencialmente afetados</span>
            <b>{impact.neighborhoods}</b>
            <small>estimativa preliminar mock até limites oficiais</small>
          </div>
          <div>
            <span>Ruas com trechos na mancha</span>
            <b>{impact.roads}</b>
            <small>estimativa preliminar mock até integração viária OSM</small>
          </div>
          <div>
            <span>Área alagada estimada</span>
            <b>{impact.area.toFixed(2).replace(".", ",")} km²</b>
            <small>estimativa preliminar mock; cálculo GIS pendente</small>
          </div>
        </article>
      </aside>
    </main>
  );
}
