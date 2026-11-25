"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import { buildHydroStationsGeoJSON } from "@/lib/hydro/stations";
import type { DerivedFloodAreaResult } from "@/lib/sgb/area";
import {
  useSgbFlood,
  EMPTY_FLOOD,
  type FloodLayerStatus,
  type FloodGeometry,
} from "@/lib/sgb/useSgbFlood";

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
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · Manchas: <a href="https://rigeo.sgb.gov.br/handle/doc/25035" target="_blank" rel="noreferrer">SGB/CPRM (2024)</a> · Estações: <a href="https://alertadecheias.inea.rj.gov.br/" target="_blank" rel="noreferrer">INEA-RJ</a>',
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

function ensureHydroStationLayers(map: maplibregl.Map) {
  const data = buildHydroStationsGeoJSON();

  if (!map.getSource("hydro-stations")) {
    map.addSource("hydro-stations", {
      type: "geojson",
      data,
    });
  }

  if (!map.getLayer("hydro-stations-circle")) {
    map.addLayer({
      id: "hydro-stations-circle",
      type: "circle",
      source: "hydro-stations",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          6,
          13,
          8,
          16,
          11,
        ],
        "circle-color": [
          "case",
          ["boolean", ["get", "hasLiveIntegration"], false],
          "#0f766e",
          "#475569",
        ],
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#ffffff",
      },
    });
  }

  if (!map.getLayer("hydro-stations-label")) {
    map.addLayer({
      id: "hydro-stations-label",
      type: "symbol",
      source: "hydro-stations",
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
          13,
        ],
        "text-offset": [0, 1.3],
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
  onDerivedAreaChange?: (area: DerivedFloodAreaResult | null) => void;
  retryToken?: number;
  isVisible?: boolean;
};

export function FloodMap({
  level,
  onStatusChange,
  onDerivedAreaChange,
  retryToken = 0,
  isVisible = true,
}: FloodMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  const onDerivedAreaChangeRef = useRef(onDerivedAreaChange);
  const [renderedData, setRenderedData] = useState<FloodGeometry | null>(null);
  const [readyMap, setReadyMap] = useState<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRetry, setMapRetry] = useState(0);
  const [showFlood, setShowFlood] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const { status, geojson, derivedArea } = useSgbFlood(level, retryToken);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onDerivedAreaChangeRef.current = onDerivedAreaChange;
  }, [onDerivedAreaChange]);

  useEffect(() => {
    onStatusChangeRef.current?.(status);
  }, [status]);

  useEffect(() => {
    onDerivedAreaChangeRef.current?.(derivedArea);
  }, [derivedArea]);

  useEffect(() => {
    if (isVisible && mapRef.current) {
      mapRef.current.resize();
    }
  }, [isVisible]);

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
        zoom: 12.6,
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
    map
      .getCanvas()
      .setAttribute("aria-label", "Mapa interativo de Santo Antônio de Pádua");
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-left",
    );

    const initLayers = () => {
      try {
        ensureFloodLayers(map);
        ensureHydroStationLayers(map);
        setReadyMap(map);
      } catch {
        setMapError(
          "Não foi possível inicializar as camadas. Tente recarregar o mapa.",
        );
      }
    };

    const onError = () =>
      setMapError(
        "Um recurso do mapa falhou. A base ou os rótulos podem estar incompletos; a consulta SGB é independente.",
      );

    const onStationClick = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const props = feature.properties ?? {};
      popupRef.current?.remove();

      const content = document.createElement("div");
      content.className = "station-popup";

      const title = document.createElement("strong");
      title.className = "station-popup-title";
      title.textContent = String(props.name ?? "Estação hidrológica");

      const institution = document.createElement("p");
      institution.className = "station-popup-meta";
      institution.textContent = String(props.institution ?? "");

      const identifiers = document.createElement("p");
      identifiers.className = "station-popup-ids";
      identifiers.textContent = String(props.identifiers ?? "");

      const location = document.createElement("p");
      location.className = "station-popup-loc";
      location.textContent = String(props.locationDescription ?? "");

      const note = document.createElement("p");
      note.className = "station-popup-note";
      note.textContent = String(props.statusNote ?? "");

      content.append(title, institution, identifiers, location, note);

      const officialUrl = String(props.officialUrl ?? "");
      if (officialUrl.startsWith("https://")) {
        const link = document.createElement("a");
        link.className = "station-popup-link";
        link.href = officialUrl;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = `${String(props.officialLinkLabel || "Acessar página oficial")} ↗`;
        content.append(link);
      }

      popupRef.current = new maplibregl.Popup({ offset: 14, maxWidth: "300px" })
        .setLngLat(feature.geometry.coordinates.slice(0, 2) as [number, number])
        .setDOMContent(content)
        .addTo(map);
    };

    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("error", onError);
    map.on("style.load", initLayers);
    map.on("click", "hydro-stations-circle", onStationClick);
    map.on("mouseenter", "hydro-stations-circle", onEnter);
    map.on("mouseleave", "hydro-stations-circle", onLeave);

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.off("error", onError);
      map.off("style.load", initLayers);
      map.off("click", "hydro-stations-circle", onStationClick);
      map.off("mouseenter", "hydro-stations-circle", onEnter);
      map.off("mouseleave", "hydro-stations-circle", onLeave);
      mapRef.current = null;
      map.remove();
    };
  }, [mapRetry]);

  useEffect(() => {
    if (!readyMap || readyMap !== mapRef.current) return;
    const source = readyMap.getSource("flood-zone") as maplibregl.GeoJSONSource;
    // MapLibre queues replacements in order; cleanup suppresses stale completion/errors.
    let active = true;
    void source
      .setData(geojson)
      .then(() => {
        if (active) setRenderedData(geojson);
      })
      .catch(() => {
        if (active)
          setMapError("Falha ao desenhar a camada SGB. Tente recarregar o mapa.");
      });
    return () => {
      active = false;
    };
  }, [readyMap, geojson]);

  useEffect(() => {
    if (!readyMap || readyMap !== mapRef.current) return;
    for (const id of ["flood-zone-fill", "flood-zone-line"]) {
      readyMap.setLayoutProperty(
        id,
        "visibility",
        showFlood && renderedData === geojson ? "visible" : "none",
      );
    }
    for (const id of ["hydro-stations-circle", "hydro-stations-label"]) {
      readyMap.setLayoutProperty(
        id,
        "visibility",
        showStations ? "visible" : "none",
      );
    }
    if (!showStations) {
      popupRef.current?.remove();
      popupRef.current = null;
      readyMap.getCanvas().style.cursor = "";
    }
  }, [readyMap, showFlood, showStations, renderedData, geojson]);

  // Handler to recenter the map
  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: PADUA_CENTER,
      zoom: 12.6,
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

      {mapError && (
        <div className="map-resource-error" role="status">
          <span>{mapError}</span>
          <button
            type="button"
            onClick={() => {
              setReadyMap(null);
              setMapRetry((value) => value + 1);
            }}
          >
            Recarregar mapa
          </button>
        </div>
      )}

      {/* Map layer & navigation controls overlay */}
      <div
        className="map-controls-panel"
        role="group"
        aria-label="Controles do mapa"
      >
        <button
          type="button"
          className="map-ctrl-btn"
          onClick={handleRecenter}
          title="Centralizar mapa em Santo Antônio de Pádua"
        >
          Centralizar
        </button>

        <div className="map-layer-toggles">
          <label
            className="toggle-label"
            title="Alternar exibição da mancha oficial SGB"
          >
            <input
              type="checkbox"
              checked={showFlood}
              onChange={(e) => setShowFlood(e.target.checked)}
            />
            <span>Mancha SGB</span>
          </label>

          <label
            className="toggle-label"
            title="Alternar exibição das estações hidrológicas oficiais com coordenadas confirmadas"
          >
            <input
              type="checkbox"
              checked={showStations}
              onChange={(e) => setShowStations(e.target.checked)}
            />
            <span>Estações hidrológicas</span>
          </label>
        </div>
      </div>
    </div>
  );
}
