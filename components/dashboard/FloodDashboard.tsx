"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import {
  FloodMap,
  type FloodLayerStatus,
} from "@/components/map/FloodMap";
import { REFERENCE_NEIGHBORHOODS } from "@/lib/map/neighborhoods";
import { SGB_STAGE_ELEVATIONS, type SgbFloodLevelCm } from "@/lib/sgb/stages";

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
  const ortometricElevation = SGB_STAGE_ELEVATIONS[levelCm as SgbFloodLevelCm];

  const handleRetry = useCallback(() => {
    setRetryToken((prev) => prev + 1);
  }, []);

  const mapPanelRef = useRef<HTMLElement | null>(null);
  const handleScrollToMap = () => {
    mapPanelRef.current?.scrollIntoView({ block: "start" });
    mapPanelRef.current?.focus({ preventScroll: true });
  };

  const handleScrollToRealtime = useCallback(() => {
    realtimeCardRef.current?.focus({ preventScroll: true });
    realtimeCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const mapBadge = useMemo(() => {
    if (layerStatus.levelCm !== levelCm) return "Carregando mancha oficial do SGB...";
    if (layerStatus.state === "official") {
      return `Mancha oficial SGB · cota local ${formatMetersFromCm(layerStatus.levelCm)} m${
        ortometricElevation
          ? ` (${ortometricElevation.toFixed(2).replace(".", ",")} m ortométrica)`
          : ""
      }`;
    }
    if (layerStatus.state === "error") {
      return "Mancha SGB indisponível · nenhuma extensão exibida";
    }
    if (layerStatus.state === "empty") return "SGB retornou uma camada vazia · nenhuma extensão exibida";
    return "Carregando mancha oficial do SGB...";
  }, [layerStatus, ortometricElevation, levelCm]);

  return (
    <main className="shell">
      {/* Top Navigation Bar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            ≈
          </div>
          <div>
            <h1>Pádua FloodSim</h1>
            <span>Santo Antônio de Pádua, RJ · Foco no Rio Pomba</span>
          </div>
        </div>

        <nav className="topnav" aria-label="Navegação principal">
          <button
            type="button"
            className="nav-btn active"
            title="Ir para o mapa"
            onClick={handleScrollToMap}
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
          title="Ir para o mapa"
          onClick={handleScrollToMap}
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
      <section className="map-panel" ref={mapPanelRef} tabIndex={-1} aria-label="Mapa e cenários SGB">
        <FloodMap
          level={level}
          onStatusChange={setLayerStatus}
          retryToken={retryToken}
        />

        {/* Status Badge */}
        <div className={`demo-badge ${layerStatus.state}`}>
          <span role="status" aria-live="polite">{mapBadge}</span>
          {(layerStatus.state === "error" || layerStatus.state === "empty") && (
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
            aria-valuetext={`${level.toFixed(2).replace(".", ",")} metros, cenário SGB`}
            onChange={(event) => setLevel(Number(event.target.value))}
          />

          <div className="slider-scale">
            <span>3,00 m — primeiro cenário SGB disponível</span>
            <span>4,25 m</span>
            <span>5,50 m</span>
          </div>

          {/* Quick Stage Shortcuts */}
          <div className="quick-stages" role="group" aria-label="Atalhos rápidos para cotas de teste">
            <span className="quick-stages-label">Testar cotas:</span>
            <button
              type="button"
              className={`stage-chip ${level === 3.0 ? "active" : ""}`}
              aria-pressed={level === 3.0}
              onClick={() => setLevel(3.0)}
              title="3,00 m — primeiro cenário SGB disponível"
            >
              3,00 m
            </button>
            <button
              type="button"
              className={`stage-chip ${level === 4.25 ? "active" : ""}`}
              aria-pressed={level === 4.25}
              onClick={() => setLevel(4.25)}
              title="4,25 m — cenário SGB disponível"
            >
              4,25 m
            </button>
            <button
              type="button"
              className={`stage-chip ${level === 5.5 ? "active" : ""}`}
              aria-pressed={level === 5.5}
              onClick={() => setLevel(5.5)}
              title="5,50 m — maior cota disponível no MapServer"
            >
              5,50 m
            </button>
          </div>
        </div>
      </section>

      {/* Right Information & Monitoring Panel */}
      <aside className="right-panel">
        <p className="research-warning">Projeto acadêmico e experimental. Não é previsão nem alerta oficial; consulte INEA e Defesa Civil. O futuro modelo DEM permanece separado dos cenários SGB.</p>
        {/* Real-time Monitoring Card (Explicitly MOCK) */}
        <article ref={realtimeCardRef} id="realtime-card" tabIndex={-1} className="card realtime">
          <div className="card-heading">
            <strong>Monitoramento demonstrativo</strong>
            <span className="live-mock">
              <i /> MOCK / DEMO
            </span>
          </div>
          <h2>Rio Pomba · Estação INEA</h2>
          <div className="river-grid">
            <div>
              <span>Nível fictício</span>
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
            Os 7 bairros exibidos pertencem à lista dos 27 bairros oficiais do município
            (Lei Municipal nº 3.864/2017). As posições são referências aproximadas
            (mock), não limites territoriais. Nenhum bairro possui risco calculado.
            A classificação depende de limites validados e interseção GIS.
          </p>
          <p className="neighborhood-explainer">{REFERENCE_NEIGHBORHOODS.map((item) => item.name).join(", ")}</p>
        </article>

        {/* Estimated Metrics Card */}
        <article className="metrics">
          <div>
            <span>Bairros potencialmente afetados</span>
            <b>Indisponível</b>
            <small>pendente: limites de bairros validados e interseção GIS</small>
          </div>
          <div>
            <span>Ruas com trechos na mancha</span>
            <b>Indisponível</b>
            <small>pendente: malha viária integrada e interseção GIS</small>
          </div>
          <div>
            <span>Área da mancha</span>
            <b>Indisponível</b>
            <small>pendente: cálculo GIS real em CRS métrico</small>
          </div>
        </article>
      </aside>
    </main>
  );
}
