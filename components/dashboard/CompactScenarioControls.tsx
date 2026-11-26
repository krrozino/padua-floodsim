"use client";

import { SGB_FLOOD_LEVELS_CM } from "@/lib/sgb/stages";
import type { FloodLayerStatus } from "@/components/map/FloodMap";
import type { MapScenarioMode } from "./FloodDashboard";

type CompactScenarioControlsProps = {
  mode: MapScenarioMode;
  levelCm: number;
  levelBCm: number;
  onChangeLevel: (level: number) => void;
  onChangeLevelB: (level: number) => void;
  onStepLevel: (delta: number) => void;
  onModeChange: (mode: MapScenarioMode) => void;
  onSwapLevels: () => void;
  mapBadge: string;
  badgeState: FloodLayerStatus["state"];
  onRetry: () => void;
};

function formatStage(cm: number) {
  return `${(cm / 100).toFixed(2).replace(".", ",")} m`;
}

function CompactStageSelect({
  label,
  levelCm,
  onChange,
}: {
  label: string;
  levelCm: number;
  onChange: (level: number) => void;
}) {
  return (
    <label className="compact-stage-select">
      <span>{label}</span>
      <select
        value={levelCm}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      >
        {SGB_FLOOD_LEVELS_CM.map((cm) => (
          <option key={cm} value={cm}>{formatStage(cm)}</option>
        ))}
      </select>
    </label>
  );
}

export function CompactScenarioControls({
  mode,
  levelCm,
  levelBCm,
  onChangeLevel,
  onChangeLevelB,
  onStepLevel,
  onModeChange,
  onSwapLevels,
  mapBadge,
  badgeState,
  onRetry,
}: CompactScenarioControlsProps) {
  const minCm = SGB_FLOOD_LEVELS_CM[0];
  const maxCm = SGB_FLOOD_LEVELS_CM[SGB_FLOOD_LEVELS_CM.length - 1];
  return (
    <div className="compact-scenario-controls">
      <p className="compact-stage-reference">Pádua II (58790002) · cenário oficial, não nível observado.</p>
      <div className="compact-stage-row">
        {mode === "single" && (
          <button
            type="button"
            className="stage-step-btn"
            aria-label="Diminuir cota compacta em 25 centímetros"
            disabled={levelCm <= minCm}
            onClick={() => onStepLevel(-0.25)}
          >−</button>
        )}
        <CompactStageSelect
          label={mode === "compare" ? "Cota A" : "Cota SGB"}
          levelCm={levelCm}
          onChange={onChangeLevel}
        />
        {mode === "single" && (
          <button
            type="button"
            className="stage-step-btn"
            aria-label="Aumentar cota compacta em 25 centímetros"
            disabled={levelCm >= maxCm}
            onClick={() => onStepLevel(0.25)}
          >+</button>
        )}
        {mode === "compare" && (
          <CompactStageSelect label="Cota B" levelCm={levelBCm} onChange={onChangeLevelB} />
        )}
      </div>
      <div className="compact-mode-row">
        <button
          type="button"
          className="mode-toggle-btn"
          onClick={() => onModeChange(mode === "single" ? "compare" : "single")}
        >{mode === "single" ? "Comparar cenários" : "Cenário único"}</button>
        {mode === "compare" && (
          <button type="button" className="compare-swap-btn" onClick={onSwapLevels}>Inverter A ⇄ B</button>
        )}
      </div>
      <output className={`scenario-status-badge ${badgeState}`} aria-live="polite">
        {mapBadge}
      </output>
      {(badgeState === "error" || badgeState === "empty") && (
        <button type="button" className="badge-retry-btn" onClick={onRetry}>Tentar novamente</button>
      )}
    </div>
  );
}
