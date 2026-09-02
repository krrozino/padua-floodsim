"use client";

import { useMemo, useState } from "react";
import { FloodMap } from "@/components/map/FloodMap";

const depthLegend = [
  ["0–0,20 m", "Muito raso"],
  ["0,20–0,50 m", "Raso"],
  ["0,50–1,00 m", "Moderado"],
  ["1,00–2,00 m", "Profundo"],
  ["> 2,00 m", "Muito profundo"],
] as const;

const neighborhoods = [
  { name: "Mirante", threshold: 5.1 },
  { name: "Boa Vista", threshold: 4.2 },
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

export function FloodDashboard() {
  const [level, setLevel] = useState(4.35);
  const impact = useMemo(() => impactFor(level), [level]);

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
        <div className="status-pill"><i /> Protótipo V0</div>
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
        <FloodMap level={level} />
        <div className="demo-badge">Cenário demonstrativo — não representa previsão oficial</div>

        <div className="neighborhood-labels" aria-label="Bairros demonstrativos">
          {neighborhoods.map((neighborhood) => (
            <span
              key={neighborhood.name}
              className={neighborhoodSeverity(level, neighborhood.threshold)}
            >
              {neighborhood.name}
            </span>
          ))}
        </div>

        <div className="slider-card">
          <div className="slider-title">
            <div>
              <strong>Nível da água</strong>
              <span>Arraste para visualizar diferentes cenários.</span>
            </div>
            <b>{level.toFixed(2).replace(".", ",")} m</b>
          </div>
          <input
            aria-label="Nível simulado da água"
            type="range"
            min="0"
            max="7"
            step="0.05"
            value={level}
            onChange={(event) => setLevel(Number(event.target.value))}
          />
          <div className="slider-scale"><span>0,00 m</span><span>3,50 m</span><span>7,00 m</span></div>
        </div>
      </section>

      <aside className="right-panel">
        <article className="card realtime">
          <div className="card-heading"><strong>Nível em tempo real</strong><span className="live"><i /> mock</span></div>
          <h3>Rio Pomba</h3>
          <div className="river-grid">
            <div><span>Atual</span><b>4,35 m</b></div>
            <div><span>Tendência</span><strong className="warning">subindo ↗</strong></div>
            <div><span>Transbordamento</span><strong className="danger">5,00 m</strong></div>
            <div><span>Chuva 24h</span><strong>62 mm</strong></div>
          </div>
          <small>Dados fictícios para desenvolvimento da interface.</small>
        </article>

        <article className="card">
          <div className="card-heading"><strong>Profundidade</strong></div>
          <div className="depth-list">
            {depthLegend.map(([range, label], index) => (
              <div key={range}>
                <i className={`depth depth-${index + 1}`} />
                <span>{range}</span>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="metrics">
          <div><span>Bairros afetados</span><b>{impact.neighborhoods}</b><small>de 7 no mock</small></div>
          <div><span>Ruas afetadas</span><b>{impact.roads}</b><small>estimativa visual</small></div>
          <div><span>Área alagada</span><b>{impact.area.toFixed(2).replace(".", ",")} km²</b><small>mock</small></div>
        </article>
      </aside>
    </main>
  );
}
