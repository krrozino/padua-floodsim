"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import {
  buildNeighborhoodPointsGeoJSON,
  NEIGHBORHOOD_DISCLAIMER,
} from "@/lib/map/neighborhoods";

import { useSgbFlood, EMPTY_FLOOD, type FloodLayerStatus, type FloodGeometry } from "@/lib/sgb/useSgbFlood";
export type { FloodLayerStatus } from "@/lib/sgb/useSgbFlood";

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

function ensureFloodLayers(map: maplibregl.Map) {
  if (!map.getSource("flood-zone")) {
    map.addSource("flood-zone", {
      type: "geojson",
      data: EMPTY_FLOOD,
    });
  }

  if (!map.getLayer("flood-zone-fill")) {
    map.addLayer({
      id: "flood-zone-fill",
      type: "fill",
      source: "flood-zone",
      layout: { visibility: "none" },
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
      layout: { visibility: "none" },
      paint: {
        "line-color": "#034c8c",
        "line-width": 2,
        "line-opacity": 0.85,
      },
    });
  }
}

function ensureNeighborhoodLayers(map: maplibregl.Map) {
  const data = buildNeighborhoodPointsGeoJSON();

  if (!map.getSource("neighborhood-points")) {
    map.addSource("neighborhood-points", {
      type: "geojson",
      data,
    });
  }

  if (!map.getLayer("neighborhood-points-circle")) {
    map.addLayer({
      id: "neighborhood-points-circle",
      type: "circle",
      source: "neighborhood-points",
      layout: { visibility: "none" },
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
        "circle-color": "#64748b",
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
        visibility: "none",
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
  const [renderedData, setRenderedData] = useState<FloodGeometry | null>(null);
  const [readyMap, setReadyMap] = useState<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRetry, setMapRetry] = useState(0);
  const [showFlood, setShowFlood] = useState(true);
  const [showNeighborhoods, setShowNeighborhoods] = useState(true);
  const { status, geojson } = useSgbFlood(level, retryToken);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);
  useEffect(() => {
    onStatusChangeRef.current?.(status);
  }, [status]);

  // Style readiness only controls rendering; the SGB request starts independently.
  useEffect(() => {
    if (!containerRef.current) return;
    let map: maplibregl.Map;
    setMapError(null);
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: PADUA_CENTER,
        zoom: 12.8,
        pitch: 15,
        bearing: 0,
        locale: {
          "NavigationControl.ZoomIn": "Aproximar",
          "NavigationControl.ZoomOut": "Afastar",
          "NavigationControl.ResetBearing": "Orientar para o norte",
        },
      });
    } catch {
      setMapError("Não foi possível iniciar o mapa. Verifique o suporte a WebGL.");
      return;
    }
    mapRef.current = map;
    map.getCanvas().setAttribute("aria-label", "Mapa interativo de Santo Antônio de Pádua");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    const initLayers = () => {
      try {
        ensureFloodLayers(map);
        ensureNeighborhoodLayers(map);
        setReadyMap(map);
      } catch {
        setMapError("Não foi possível inicializar as camadas. Tente recarregar o mapa.");
      }
    };
    const onError = () => setMapError(
      "Um recurso do mapa falhou. A base ou os rótulos podem estar incompletos; a consulta SGB é independente.",
    );
    const onClick = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      popupRef.current?.remove();
      const content = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = String(feature.properties?.name ?? "Bairro de referência");
      const description = document.createElement("p");
      description.textContent = NEIGHBORHOOD_DISCLAIMER;
      content.append(title, description);
      popupRef.current = new maplibregl.Popup({ offset: 12 })
        .setLngLat(feature.geometry.coordinates.slice(0, 2) as [number, number])
        .setDOMContent(content).addTo(map);
    };
    const onEnter = () => { map.getCanvas().style.cursor = "pointer"; };
    const onLeave = () => { map.getCanvas().style.cursor = ""; };
    map.on("error", onError);
    map.on("style.load", initLayers);
    map.on("click", "neighborhood-points-circle", onClick);
    map.on("mouseenter", "neighborhood-points-circle", onEnter);
    map.on("mouseleave", "neighborhood-points-circle", onLeave);
    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.off("error", onError);
      map.off("style.load", initLayers);
      map.off("click", "neighborhood-points-circle", onClick);
      map.off("mouseenter", "neighborhood-points-circle", onEnter);
      map.off("mouseleave", "neighborhood-points-circle", onLeave);
      mapRef.current = null;
      map.remove();
    };
  }, [mapRetry]);

  useEffect(() => {
    if (!readyMap || readyMap !== mapRef.current) return;
    const source = readyMap.getSource("flood-zone") as maplibregl.GeoJSONSource;
    // MapLibre queues replacements in order; cleanup suppresses stale completion/errors.
    let active = true;
    void source.setData(geojson).then(() => {
      if (active) setRenderedData(geojson);
    }).catch(() => {
      if (active) setMapError("Falha ao desenhar a camada SGB. Tente recarregar o mapa.");
    });
    return () => { active = false; };
  }, [readyMap, geojson]);

  useEffect(() => {
    if (!readyMap || readyMap !== mapRef.current) return;
    for (const id of ["flood-zone-fill", "flood-zone-line"]) {
      readyMap.setLayoutProperty(id, "visibility", showFlood && renderedData === geojson ? "visible" : "none");
    }
    for (const id of ["neighborhood-points-circle", "neighborhood-points-label"]) {
      readyMap.setLayoutProperty(id, "visibility", showNeighborhoods ? "visible" : "none");
    }
    if (!showNeighborhoods) {
      popupRef.current?.remove();
      popupRef.current = null;
      readyMap.getCanvas().style.cursor = "";
    }
  }, [readyMap, showFlood, showNeighborhoods, renderedData, geojson]);

  // Handler to recenter the map
  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: PADUA_CENTER,
      zoom: 12.8,
      pitch: 15,
      bearing: 0,
      essential: false,
    });
  }, []);

  return (
    <div className="map-wrapper">
      <div
        ref={containerRef}
        className="map-canvas"
        role="group"
        aria-label="Visualização cartográfica"
      />

      {mapError && <div className="map-resource-error" role="status">
        <span>{mapError}</span>
        <button type="button" onClick={() => { setReadyMap(null); setMapRetry((value) => value + 1); }}>
          Recarregar mapa
        </button>
      </div>}
      {/* Map layer & navigation controls overlay */}
      <div className="map-controls-panel" role="group" aria-label="Controles do mapa">
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
