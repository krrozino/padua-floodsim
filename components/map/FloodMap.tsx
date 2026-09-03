"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import {
  buildNeighborhoodPointsGeoJSON,
  REFERENCE_NEIGHBORHOODS,
  type NeighborhoodSeverity,
} from "@/lib/map/neighborhoods";

export const PADUA_CENTER: [number, number] = [-42.18, -21.539];

if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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

function ensureFloodLayers(map: maplibregl.Map, initialLevel: number) {
  if (!map.getSource("flood-zone")) {
    map.addSource("flood-zone", {
      type: "geojson",
      data: buildFallbackFloodData(initialLevel),
    });
  }

  if (!map.getLayer("flood-zone-fill")) {
    map.addLayer({
      id: "flood-zone-fill",
      type: "fill",
      source: "flood-zone",
      paint: {
        "fill-color": "#087acb",
        "fill-opacity": 0.45,
      },
    });
  }

  if (!map.getLayer("flood-zone-line")) {
    map.addLayer({
      id: "flood-zone-line",
      type: "line",
      source: "flood-zone",
      paint: {
        "line-color": "#034c8c",
        "line-width": 2,
        "line-opacity": 0.85,
      },
    });
  }
}

function ensureNeighborhoodLayers(map: maplibregl.Map, level: number) {
  const data = buildNeighborhoodPointsGeoJSON(level);

  if (!map.getSource("neighborhood-points")) {
    map.addSource("neighborhood-points", {
      type: "geojson",
      data,
    });
  } else {
    const source = map.getSource(
      "neighborhood-points",
    ) as maplibregl.GeoJSONSource;
    source.setData(data);
  }

  if (!map.getLayer("neighborhood-points-circle")) {
    map.addLayer({
      id: "neighborhood-points-circle",
      type: "circle",
      source: "neighborhood-points",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          5,
          13,
          8,
          16,
          12,
        ],
        "circle-color": ["get", "color"],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
  }

  if (!map.getLayer("neighborhood-points-label")) {
    map.addLayer({
      id: "neighborhood-points-label",
      type: "symbol",
      source: "neighborhood-points",
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          10,
          13,
          12,
          16,
          14,
        ],
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#0f2f5f",
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
      },
    });
  }
}

export type FloodMapProps = {
  level: number;
  onStatusChange?: (status: FloodLayerStatus) => void;
  retryToken?: number;
};

export function FloodMap({
  level,
  onStatusChange,
  retryToken = 0,
}: FloodMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  const isMapReadyRef = useRef(false);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const [showFlood, setShowFlood] = useState(true);
  const [showNeighborhoods, setShowNeighborhoods] = useState(true);

  // Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: PADUA_CENTER,
      zoom: 12.8,
      pitch: 15,
      bearing: 0,
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-left",
    );

    const initLayers = () => {
      isMapReadyRef.current = true;
      ensureFloodLayers(map, level);
      ensureNeighborhoodLayers(map, level);
    };

    if (map.isStyleLoaded()) {
      initLayers();
    } else {
      map.once("load", initLayers);
    }

    if (typeof window !== "undefined") {
      (window as unknown as { _paduaMap?: maplibregl.Map })._paduaMap = map;
    }

    // Interactive popup for neighborhood points
    map.on("click", "neighborhood-points-circle", (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const coords = (
        feature.geometry as GeoJSON.Point
      ).coordinates.slice() as [number, number];
      const props = feature.properties as {
        name: string;
        threshold: number;
        severity: NeighborhoodSeverity;
        severityLabel: string;
        color: string;
        margin: string;
        disclaimer: string;
      };

      if (popupRef.current) {
        popupRef.current.remove();
      }

      popupRef.current = new maplibregl.Popup({ offset: 12 })
        .setLngLat(coords)
        .setHTML(
          `
          <div style="font-family: inherit; min-width: 180px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <strong style="font-size: 14px; color: #0f2f5f;">${props.name}</strong>
              <span style="background: ${props.color}; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 999px;">
                ${props.severityLabel}
              </span>
            </div>
            <div style="font-size: 11px; color: #4b5563; margin-top: 6px;">
              <span>${props.margin}</span> · <span>Cota referencial: ${props.threshold.toFixed(2).replace(".", ",")} m</span>
            </div>
            <div style="margin-top: 8px; font-size: 10px; line-height: 1.35; color: #6b7280; background: #f3f4f6; padding: 6px; border-radius: 6px; border: 1px solid #e5e7eb;">
              ⚠️ ${props.disclaimer}
            </div>
          </div>
        `,
        )
        .addTo(map);
    });

    map.on("mouseenter", "neighborhood-points-circle", () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "neighborhood-points-circle", () => {
      map.getCanvas().style.cursor = "";
    });

    mapRef.current = map;

    return () => {
      if (typeof window !== "undefined") {
        delete (window as unknown as { _paduaMap?: maplibregl.Map })._paduaMap;
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      map.off("load", initLayers);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update flood and neighborhood layer data when level or retryToken changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const controller = new AbortController();
    const levelCm = Math.round(level * 100);

    const updateFlood = async () => {
      onStatusChangeRef.current?.({ state: "loading", levelCm });

      try {
        if (!isMapReadyRef.current) {
          await new Promise<void>((resolve) => {
            map.once("load", () => resolve());
          });
        }
        if (controller.signal.aborted) return;

        ensureFloodLayers(map, level);
        ensureNeighborhoodLayers(map, level);

        const response = await fetch(`/api/sgb/flood?level=${levelCm}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Flood API returned ${response.status}`);
        }

        const payload = (await response.json()) as SgbFloodApiResponse;
        if (controller.signal.aborted) return;

        const source = map.getSource("flood-zone") as
          | maplibregl.GeoJSONSource
          | undefined;

        source?.setData(
          payload.geojson as Parameters<maplibregl.GeoJSONSource["setData"]>[0],
        );

        onStatusChangeRef.current?.({
          state: "official",
          levelCm: payload.levelCm,
          layerName: payload.layerName,
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        if (map.isStyleLoaded()) {
          ensureFloodLayers(map, level);
          const source = map.getSource("flood-zone") as
            | maplibregl.GeoJSONSource
            | undefined;
          source?.setData(buildFallbackFloodData(level));
        }

        onStatusChangeRef.current?.({
          state: "fallback",
          levelCm,
          message:
            error instanceof Error
              ? error.message
              : "Falha ao consultar manchas oficiais do SGB",
        });
      }
    };

    void updateFlood();

    return () => {
      controller.abort();
    };
  }, [level, retryToken]);

  // Toggle flood layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const visibility = showFlood ? "visible" : "none";
    if (map.getLayer("flood-zone-fill")) {
      map.setLayoutProperty("flood-zone-fill", "visibility", visibility);
    }
    if (map.getLayer("flood-zone-line")) {
      map.setLayoutProperty("flood-zone-line", "visibility", visibility);
    }
  }, [showFlood]);

  // Toggle neighborhood layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const visibility = showNeighborhoods ? "visible" : "none";
    if (map.getLayer("neighborhood-points-circle")) {
      map.setLayoutProperty(
        "neighborhood-points-circle",
        "visibility",
        visibility,
      );
    }
    if (map.getLayer("neighborhood-points-label")) {
      map.setLayoutProperty(
        "neighborhood-points-label",
        "visibility",
        visibility,
      );
    }
  }, [showNeighborhoods]);

  // Handler to recenter the map
  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: PADUA_CENTER,
      zoom: 12.8,
      pitch: 15,
      bearing: 0,
      essential: true,
    });
  }, []);

  return (
    <div className="map-wrapper">
      <div
        ref={containerRef}
        className="map-canvas"
        aria-label="Mapa interativo de Santo Antônio de Pádua"
      />

      {/* Map layer & navigation controls overlay */}
      <div className="map-controls-panel" aria-label="Controles do mapa">
        <button
          type="button"
          className="map-ctrl-btn"
          onClick={handleRecenter}
          title="Centralizar mapa em Santo Antônio de Pádua"
        >
          <span aria-hidden="true">🎯</span> Centralizar
        </button>

        <div className="map-layer-toggles">
          <label className="toggle-label" title="Alternar exibição da mancha oficial SGB">
            <input
              type="checkbox"
              checked={showFlood}
              onChange={(e) => setShowFlood(e.target.checked)}
            />
            <span>Mancha SGB</span>
          </label>

          <label
            className="toggle-label"
            title="Alternar exibição dos pontos de referência de bairros (mock)"
          >
            <input
              type="checkbox"
              checked={showNeighborhoods}
              onChange={(e) => setShowNeighborhoods(e.target.checked)}
            />
            <span>Bairros (pontos)</span>
          </label>
        </div>
      </div>
    </div>
  );
}
