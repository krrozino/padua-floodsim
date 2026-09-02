"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";

const MAP_STYLE = "https://demotiles.maplibre.org/style.json";
const PADUA_CENTER: [number, number] = [-42.18, -21.54];

export type FloodLayerStatus = {
  state: "loading" | "official" | "fallback";
  levelCm: number;
  layerName?: string;
  message?: string;
};

type SgbFloodApiResponse = {
  classification: "official_reference";
  provider: string;
  levelCm: number;
  layerId: number;
  layerName: string;
  geojson: unknown;
};

function buildFallbackFloodData(level: number) {
  const spread = 0.0014 + Math.max(0, level - 2.5) * 0.00085;

  const corridor = (width: number) => [
    [-42.205, -21.545 - width],
    [-42.196, -21.541 - width],
    [-42.188, -21.544 - width],
    [-42.18, -21.548 - width],
    [-42.171, -21.546 - width],
    [-42.162, -21.541 - width],
    [-42.154, -21.543 - width],
    [-42.154, -21.543 + width],
    [-42.162, -21.541 + width],
    [-42.171, -21.546 + width],
    [-42.18, -21.548 + width],
    [-42.188, -21.544 + width],
    [-42.196, -21.541 + width],
    [-42.205, -21.545 + width],
    [-42.205, -21.545 - width],
  ];

  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: { classification: "mock" },
        geometry: {
          type: "Polygon" as const,
          coordinates: [corridor(spread)],
        },
      },
    ],
  };
}

export function FloodMap({
  level,
  onStatusChange,
}: {
  level: number;
  onStatusChange?: (status: FloodLayerStatus) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: PADUA_CENTER,
      zoom: 12.3,
      pitch: 18,
      bearing: 0,
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-left",
    );

    map.on("load", () => {
      map.addSource("flood-zone", {
        type: "geojson",
        data: buildFallbackFloodData(level),
      });

      map.addLayer({
        id: "flood-zone-fill",
        type: "fill",
        source: "flood-zone",
        paint: {
          "fill-color": "#087acb",
          "fill-opacity": 0.42,
          "fill-outline-color": "#075ba8",
        },
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const controller = new AbortController();
    const levelCm = Math.round(level * 100);

    const update = async () => {
      onStatusChange?.({ state: "loading", levelCm });

      try {
        const response = await fetch(`/api/sgb/flood?level=${levelCm}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Flood API returned ${response.status}`);
        }

        const payload = (await response.json()) as SgbFloodApiResponse;
        const source = map.getSource("flood-zone") as
          | maplibregl.GeoJSONSource
          | undefined;

        source?.setData(
          payload.geojson as Parameters<maplibregl.GeoJSONSource["setData"]>[0],
        );

        onStatusChange?.({
          state: "official",
          levelCm: payload.levelCm,
          layerName: payload.layerName,
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        const source = map.getSource("flood-zone") as
          | maplibregl.GeoJSONSource
          | undefined;

        source?.setData(buildFallbackFloodData(level));

        onStatusChange?.({
          state: "fallback",
          levelCm,
          message:
            error instanceof Error
              ? error.message
              : "Falha desconhecida ao consultar o SGB",
        });
      }
    };

    const runUpdate = () => {
      void update();
    };

    if (map.isStyleLoaded()) runUpdate();
    else map.once("load", runUpdate);

    return () => {
      controller.abort();
      map.off("load", runUpdate);
    };
  }, [level, onStatusChange]);

  return (
    <div
      ref={containerRef}
      className="map-canvas"
      aria-label="Mapa de Santo Antônio de Pádua"
    />
  );
}
