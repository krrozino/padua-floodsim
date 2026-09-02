"use client";

import { useMemo, useState } from "react";
import {
  FloodMap,
  type FloodLayerStatus,
} from "@/components/map/FloodMap";

const neighborhoods = [
  { name: "Mirante", threshold: 5.1 },
  { name: "Aeroporto", threshold: 4.2 },
  { name: "São Félix", threshold: 4.55 },
  { name: "Centro", threshold: 3.75 },
  { name: "Cidade Nova", threshold: 4.0 },
  { name: "Divinéia", threshold: 4.85 },
  { name: "Farol", threshold: 5.25 },
] as const;

function impactFor(level: number) {
  const severity = Math.max(0, level - 2.5);
  return {
    neighborhoods: Math.min(7, Math.round(severity * 1.7)),
    roads: Math.max(0, Math.round(severity * 22)),
    area: Math.max(0, severity * 1.06),
  };
}

function neighborhoodSeverity(level: number, threshold: number) {
  if (level >= threshold + 0.7) return "critical";
  if (level >= threshold + 0.25) return "high";
  if (level >= threshold) return "attention";
  return "safe";
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
  const impact = useMemo(() => impactFor(level), [level]);

  const mapBadge =
    layerStatus.state === "official"
      ? `Mancha oficial SGB · cota ${formatMetersFromCm(layerStatus.levelCm)} m`
      : layerStatus.state === "fallback"
        ? "Geoportal SGB indisponível · exibindo fallback demonstrativo"
        : "Carregando mancha oficial do SGB...";

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">≈</div>
          <div>
            <strong>Pádua FloodSim</strong>
            <span>Santo Antônio de Pádua, RJ</span>
          </div>
        </div>
        <nav className="topnav" aria-label="Navegação principal">
          <button className="active">Mapa</button>
          <button>Simulação</button>
          <button>Alertas</button>
          <button>Relatórios</button>
        </nav>
        <div className="status-pill"><i /> V1 · SGB</div>
      </header>

      <aside className="sidebar" aria-label="Seções">
        <button className="active">Mapa</button>
        <button>Nível do rio</button>
        <button>Pluviometria</button>
        <button>Simulações</button>
        <button>Alertas</button>
        <button>Histórico</button>
      </aside>

      <section className="map-panel">
        <FloodMap level={level} onStatusChange={setLayerStatus} />
        <div className={`demo-badge ${layerStatus.state}`}>{mapBadge}</div>

        <div className="neighborhood-labels" aria-label="Bairros demonstrativos">
          {neighborhoods.map((neighborhood) => (
            <span
              key={neighborhood.name}
              className={neighborhoodSeverity(level, neighborhood.threshold)}
              title="Posição e criticidade ainda demonstrativas; limites oficiais estão em levantamento."
            >
              {neighborhood.name}
            </span>
          ))}
        </div>

        <div className="slider-card">
          <div className="slider-title">
            <div>
              <strong>Cota do cenário SGB</strong>
              <span>Manchas oficiais disponíveis de 25 em 25 cm.</span>
            </div>
            <b>{level.toFixed(2).replace(".", ",")} m</b>
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
          <div className="slider-scale"><span>3,00 m</span><span>4,25 m</span><span>5,50 m</span></div>
        </div>
      </section>

      <aside className="right-panel">
        <article className="card realtime">
          <div className="card-heading"><strong>Nível em tempo real</strong><span className="live"><i /> mock</span></div>
          <h3>Rio Pomba</h3>
          <div className="river-grid">
            <div><span>Atual</span><b>4,35 m</b></div>
            <div><span>Tendência</span><strong className="warning">subindo ↗</strong></div>
            <div><span>Transbordamento INEA</span><strong className="danger">5,00 m</strong></div>
            <div><span>Chuva 24h</span><strong>62 mm</strong></div>
          </div>
          <small>
            Nível, tendência e chuva ainda são fictícios. A régua do INEA não é convertida
            automaticamente para a referência SGB até validarmos a equivalência entre as estações.
          </small>
        </article>

        <article className="card">
          <div className="card-heading"><strong>Camada de inundação</strong></div>
          <div className="official-layer-legend">
            <i />
            <div>
              <strong>Extensão da mancha</strong>
              <small>
                Polígono por cota publicado pelo Serviço Geológico do Brasil. Profundidade ainda não
                é calculada nesta camada.
              </small>
            </div>
          </div>
          <a
            className="source-link"
            href="https://rigeo.sgb.gov.br/handle/doc/25035"
            target="_blank"
            rel="noreferrer"
          >
            Ver referência técnica SGB ↗
          </a>
        </article>

        <article className="metrics">
          <div><span>Bairros afetados</span><b>{impact.neighborhoods}</b><small>mock até termos polígonos oficiais</small></div>
          <div><span>Ruas afetadas</span><b>{impact.roads}</b><small>mock até integrar malha viária</small></div>
          <div><span>Área alagada</span><b>{impact.area.toFixed(2).replace(".", ",")} km²</b><small>mock; cálculo GIS ainda pendente</small></div>
        </article>
      </aside>
    </main>
  );
}
