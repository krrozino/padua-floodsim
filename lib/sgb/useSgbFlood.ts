"use client";

import { useEffect, useState } from "react";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

export type FloodGeometry = FeatureCollection<Polygon | MultiPolygon>;
export const EMPTY_FLOOD: FloodGeometry = { type: "FeatureCollection", features: [] };
export type FloodLayerStatus = {
  state: "loading" | "official" | "empty" | "error";
  levelCm: number;
  layerName?: string;
  message?: string;
};
type FloodResult = { status: FloodLayerStatus; geojson: FloodGeometry; retryToken: number };

export function useSgbFlood(level: number, retryToken: number) {
  const levelCm = Math.round(level * 100);
  const [result, setResult] = useState<FloodResult>({
    status: { state: "loading", levelCm }, geojson: EMPTY_FLOOD, retryToken,
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const loading: FloodResult = {
      status: { state: "loading", levelCm }, geojson: EMPTY_FLOOD, retryToken,
    };
    setResult(loading);
    const timeout = setTimeout(() => controller.abort(), 45_000);
    void (async () => {
      try {
        const response = await fetch(`/api/sgb/flood?level=${levelCm}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`SGB API: HTTP ${response.status}`);
        const payload = await response.json();
        if (payload.classification !== "official_reference" || payload.levelCm !== levelCm ||
            payload.layerName !== `COTA_${levelCm}cm` ||
            payload.geojson?.type !== "FeatureCollection" || !Array.isArray(payload.geojson.features) ||
            !payload.geojson.features.every((feature: { type?: string; geometry?: { type?: string; coordinates?: unknown } }) =>
              feature?.type === "Feature" && ["Polygon", "MultiPolygon"].includes(feature.geometry?.type ?? "") &&
              Array.isArray(feature.geometry?.coordinates))) {
          throw new Error("Resposta SGB inválida ou incompatível com a cota solicitada");
        }
        if (!active || controller.signal.aborted) return;
        setResult({
          status: { state: payload.geojson.features.length ? "official" : "empty", levelCm, layerName: payload.layerName },
          geojson: payload.geojson, retryToken,
        });
      } catch (error) {
        if (!active) return;
        setResult({ ...loading, status: {
          state: "error", levelCm,
          message: controller.signal.aborted ? "Tempo limite da consulta SGB excedido" : String(error),
        } });
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [levelCm, retryToken]);

  // Never expose the previous scenario in the render preceding effect cleanup.
  return result.status.levelCm === levelCm && result.retryToken === retryToken
    ? result
    : { status: { state: "loading" as const, levelCm }, geojson: EMPTY_FLOOD, retryToken };
}
