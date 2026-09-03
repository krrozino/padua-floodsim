"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";

const PADUA_CENTER: [number, number] = [-42.18, -21.54];

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm-base",
      type: "raster",
      source: "osm",
    },
  ],
};

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

function ensureFloodLayer(map: maplibregl.Map, level: number) {
  if (!map.getSource("flood-zone")) {
    map.addSource("flood-zone", {
      type: "geojson",
      data: buildFallbackFloodData(level),
    });
  }

  if (!map.getLayer("flood-zone-fill")) {
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
  }
}

function waitForStyle(map: maplibregl.Map, signal: AbortSignal) {
  if (map.isStyleLoaded()) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      map.off("style.load", handleStyleLoad);
      signal.removeEventListener("abort", handleAbort);
    };

    const handleStyleLoad = () => {
      cleanup();
      resolve();
    };

    const handleAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    map.once("style.load", handleStyleLoad);
    signal.addEventListener("abort", handleAbort, { once: true });
  });
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

    const initializeFloodLayer = () => {
      ensureFloodLayer(map, level);
    };

    if (map.isStyleLoaded()) initializeFloodLayer();
    else map.once("style.load", initializeFloodLayer);

    mapRef.current = map;

    return () => {
      map.off("style.load", initializeFloodLayer);
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
        const responsePromise = fetch(`/api/sgb/flood?level=${levelCm}`, {
          signal: controller.signal,
        });

        await waitForStyle(map, controller.signal);
        ensureFloodLayer(map, level);

        const response = await responsePromise;

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

        if (map.isStyleLoaded()) {
          ensureFloodLayer(map, level);
          const source = map.getSource("flood-zone") as
            | maplibregl.GeoJSONSource
            | undefined;
          source?.setData(buildFallbackFloodData(level));
        }

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

    void update();

    return () => {
      controller.abort();
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
