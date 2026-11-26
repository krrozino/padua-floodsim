"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ALLOWED_REPLAY_SPEEDS,
  createInitialReplayState,
  seekHydrographReplay,
  sliceHydrographInterval,
  stepHydrographReplay,
  type PreparedHydrographResult,
  type ReplaySpeedMultiplier,
} from "@/lib/history/hydrograph";

type ReadyHydrograph = Extract<PreparedHydrographResult, { status: "ready" }>;

function formatStageAxis(stageCm: number, unit: "cm" | "m"): string {
  if (unit === "m") {
    return `${(stageCm / 100).toFixed(2).replace(".", ",")} m`;
  }
  return `${Math.round(stageCm)} cm`;
}

function formatUtcShortBrt(epochMs: number): string {
  const brt = new Date(epochMs - 3 * 60 * 60 * 1000);
  const dd = String(brt.getUTCDate()).padStart(2, "0");
  const mm = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(brt.getUTCHours()).padStart(2, "0");
  const min = String(brt.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${min} BRT`;
}

export function HistoricalHydrographViewer({
  hydrograph,
}: Readonly<{
  hydrograph: ReadyHydrograph;
}>) {
  const [rangeStartIdx, setRangeStartIdx] = useState(0);
  const [rangeEndIdx, setRangeEndIdx] = useState(
    Math.max(1, hydrograph.points.length - 1),
  );

  const activeHydrograph: ReadyHydrograph = useMemo(() => {
    const startPt = hydrograph.points[rangeStartIdx] ?? hydrograph.points[0];
    const endPt =
      hydrograph.points[rangeEndIdx] ??
      hydrograph.points[hydrograph.points.length - 1];
    if (!startPt || !endPt || endPt.epochMs <= startPt.epochMs) {
      return hydrograph;
    }
    const sliced = sliceHydrographInterval(
      hydrograph,
      startPt.epochMs,
      endPt.epochMs,
    );
    return sliced.status === "ready" ? sliced : hydrograph;
  }, [hydrograph, rangeStartIdx, rangeEndIdx]);

  const [replay, setReplay] = useState(() =>
    createInitialReplayState(activeHydrograph),
  );

  useEffect(() => {
    setReplay(createInitialReplayState(activeHydrograph));
  }, [activeHydrograph]);

  useEffect(() => {
    if (!replay.isPlaying) return undefined;
    const timer = window.setInterval(() => {
      setReplay((prev) => stepHydrographReplay(activeHydrograph, prev));
    }, 450);
    return () => window.clearInterval(timer);
  }, [replay.isPlaying, activeHydrograph]);

  const width = 680;
  const height = 230;
  const padLeft = 56;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 32;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const thresholdValues = activeHydrograph.stationThresholds.map(
    (t) => t.stageCm,
  );
  const minY = Math.min(
    activeHydrograph.minPoint.stageCm,
    ...thresholdValues,
  ) * 0.94;
  const maxY = Math.max(
    activeHydrograph.maxPoint.stageCm,
    ...thresholdValues,
  ) * 1.05;
  const spanY = Math.max(maxY - minY, 1);
  const spanX = Math.max(
    activeHydrograph.endEpochMs - activeHydrograph.startEpochMs,
    1,
  );

  const toX = (ms: number) =>
    padLeft + ((ms - activeHydrograph.startEpochMs) / spanX) * plotW;
  const toY = (cm: number) =>
    padTop + plotH - ((cm - minY) / spanY) * plotH;

  const cursorX = toX(replay.cursorEpochMs);

  return (
    <div className="hydrograph-viewer">
      <div className="hydrograph-summary-row">
        <div>
          <span>Pico no recorte</span>
          <strong>
            {formatStageAxis(
              activeHydrograph.maxPoint.stageCm,
              activeHydrograph.nativeStageUnit,
            )}
          </strong>
          <small>{formatUtcShortBrt(activeHydrograph.maxPoint.epochMs)}</small>
        </div>
        <div>
          <span>Mínimo no recorte</span>
          <strong>
            {formatStageAxis(
              activeHydrograph.minPoint.stageCm,
              activeHydrograph.nativeStageUnit,
            )}
          </strong>
          <small>{formatUtcShortBrt(activeHydrograph.minPoint.epochMs)}</small>
        </div>
        <div>
          <span>Lacunas preservadas</span>
          <strong>{activeHydrograph.gaps.length}</strong>
          <small>Sem interpolação linear</small>
        </div>
        {activeHydrograph.hasCompatibleRainfall &&
          activeHydrograph.totalRainMm !== null && (
            <div>
              <span>Chuva compatível</span>
              <strong>
                {activeHydrograph.totalRainMm.toFixed(1).replace(".", ",")} mm
              </strong>
              <small>Acumulado no recorte</small>
            </div>
          )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="hydrograph-svg"
        role="img"
        aria-label={`Hidrograma verificado de ${activeHydrograph.stationName}`}
      >
        {/* Preserved telemetry gaps */}
        {activeHydrograph.gaps.map((gap) => {
          const x1 = toX(Date.parse(gap.startUtc));
          const x2 = toX(Date.parse(gap.endUtc));
          return (
            <rect
              key={`${gap.startUtc}-${gap.endUtc}`}
              x={x1}
              y={padTop}
              width={Math.max(x2 - x1, 2)}
              height={plotH}
              fill="rgba(217, 119, 6, 0.13)"
            />
          );
        })}

        {/* Station-specific thresholds */}
        {activeHydrograph.stationThresholds.map((th) => {
          const y = toY(th.stageCm);
          return (
            <g key={th.id}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="#b45309"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <text x={padLeft + 4} y={y - 4} fontSize={10} fill="#92400e">
                {th.label}: {th.nativeDisplayLabel}
              </text>
            </g>
          );
        })}

        {/* Discontinuous polyline segments (never bridging gaps) */}
        {activeHydrograph.segments.map((seg) => {
          if (seg.points.length === 1) {
            const pt = seg.points[0];
            return (
              <circle
                key={`seg-pt-${seg.segmentIndex}`}
                cx={toX(pt.epochMs)}
                cy={toY(pt.stageCm)}
                r={3}
                fill="#1764d2"
              />
            );
          }
          const ptsAttr = seg.points
            .map((pt) => `${toX(pt.epochMs).toFixed(1)},${toY(pt.stageCm).toFixed(1)}`)
            .join(" ");
          return (
            <polyline
              key={`seg-${seg.segmentIndex}`}
              fill="none"
              stroke="#1764d2"
              strokeWidth={2.2}
              points={ptsAttr}
            />
          );
        })}

        {/* Peak marker */}
        <circle
          cx={toX(activeHydrograph.maxPoint.epochMs)}
          cy={toY(activeHydrograph.maxPoint.stageCm)}
          r={4.5}
          fill="#b91c1c"
        />

        {/* Replay temporal cursor */}
        <line
          x1={cursorX}
          x2={cursorX}
          y1={padTop}
          y2={padTop + plotH}
          stroke="#0f2f5f"
          strokeWidth={1.6}
        />
      </svg>

      <div className="hydrograph-replay-bar">
        <div className="hydrograph-replay-buttons">
          <button
            type="button"
            className="secondary-action-btn"
            onClick={() =>
              setReplay((prev) =>
                prev.atEnd
                  ? { ...createInitialReplayState(activeHydrograph), isPlaying: true }
                  : { ...prev, isPlaying: !prev.isPlaying },
              )
            }
          >
            {replay.isPlaying ? "Pausar" : "Reproduzir evolução"}
          </button>

          <div className="replay-speed-group" role="group" aria-label="Velocidade do replay">
            {ALLOWED_REPLAY_SPEEDS.map((spd: ReplaySpeedMultiplier) => (
              <button
                key={spd}
                type="button"
                className={`stage-chip ${replay.speed === spd ? "active" : ""}`}
                aria-pressed={replay.speed === spd}
                onClick={() => setReplay((prev) => ({ ...prev, speed: spd }))}
              >
                {spd}×
              </button>
            ))}
          </div>
        </div>

        <input
          type="range"
          aria-label="Cursor temporal do hidrograma"
          min={activeHydrograph.startEpochMs}
          max={activeHydrograph.endEpochMs}
          step={activeHydrograph.nominalCadenceMinutes * 60 * 1000}
          value={replay.cursorEpochMs}
          onChange={(e) =>
            setReplay((prev) =>
              seekHydrographReplay(
                activeHydrograph,
                { ...prev, isPlaying: false },
                Number(e.target.value),
              ),
            )
          }
        />

        <p className="hydrograph-cursor-readout" role="status" aria-live="polite">
          {replay.isInsideGap || !replay.activePoint
            ? `Instante ${formatUtcShortBrt(replay.cursorEpochMs)}: LACUNA TELEMÉTRICA (nenhuma medição interpolada).`
            : `Instante ${formatUtcShortBrt(replay.activePoint.epochMs)}: nível ${formatStageAxis(replay.activePoint.stageCm, activeHydrograph.nativeStageUnit)}.`}
        </p>

        {hydrograph.points.length > 3 && (
          <div className="hydrograph-interval-controls">
            <label htmlFor={`hydro-start-${hydrograph.stationId}`}>
              Início do intervalo:
            </label>
            <select
              id={`hydro-start-${hydrograph.stationId}`}
              value={rangeStartIdx}
              onChange={(e) => {
                const next = Number(e.target.value);
                setRangeStartIdx(Math.min(next, rangeEndIdx - 1));
              }}
            >
              {hydrograph.points.slice(0, -1).map((pt) => (
                <option key={pt.index} value={pt.index}>
                  {formatUtcShortBrt(pt.epochMs)}
                </option>
              ))}
            </select>

            <label htmlFor={`hydro-end-${hydrograph.stationId}`}>
              Fim do intervalo:
            </label>
            <select
              id={`hydro-end-${hydrograph.stationId}`}
              value={rangeEndIdx}
              onChange={(e) => {
                const next = Number(e.target.value);
                setRangeEndIdx(Math.max(next, rangeStartIdx + 1));
              }}
            >
              {hydrograph.points.slice(1).map((pt) => (
                <option key={pt.index} value={pt.index}>
                  {formatUtcShortBrt(pt.epochMs)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
