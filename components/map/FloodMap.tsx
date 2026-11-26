"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { FeatureCollection, Point } from "geojson";
import * as maplibregl from "maplibre-gl";
import { buildHydroStationsGeoJSON } from "@/lib/hydro/stations";
import type { DerivedFloodAreaResult } from "@/lib/sgb/area";
import {
  compareFloodScenarios,
  type ScenarioComparisonResult,
} from "@/lib/sgb/compare";
import type { GeoPoint, SpatialPointRelation } from "@/lib/sgb/location";
import {
  useSgbFlood,
  EMPTY_FLOOD,
  type FloodLayerStatus,
  type FloodGeometry,
} from "@/lib/sgb/useSgbFlood";

export type { FloodLayerStatus } from "@/lib/sgb/useSgbFlood";

const EMPTY_POINTS: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [],
};

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

const COMPARE_LAYER_IDS = [
  "flood-compare-common-fill",
  "flood-compare-common-line",
  "flood-compare-only-a-fill",
  "flood-compare-only-a-line",
  "flood-compare-only-b-fill",
  "flood-compare-only-b-line",
] as const;

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

function ensureComparisonLayers(map: maplibregl.Map) {
  const specs: readonly {
    sourceId: string;
    fillId: string;
    lineId: string;
    fillColor: string;
    fillOpacity: number;
    lineColor: string;
    lineWidth: number;
  }[] = [
    {
      sourceId: "flood-compare-common",
      fillId: "flood-compare-common-fill",
      lineId: "flood-compare-common-line",
      fillColor: "#1d4ed8",
      fillOpacity: 0.46,
      lineColor: "#1e3a8a",
      lineWidth: 1.5,
    },
    {
      sourceId: "flood-compare-only-a",
      fillId: "flood-compare-only-a-fill",
      lineId: "flood-compare-only-a-line",
      fillColor: "#ea580c",
      fillOpacity: 0.56,
      lineColor: "#9a3412",
      lineWidth: 1.8,
    },
    {
      sourceId: "flood-compare-only-b",
      fillId: "flood-compare-only-b-fill",
      lineId: "flood-compare-only-b-line",
      fillColor: "#7c3aed",
      fillOpacity: 0.52,
      lineColor: "#4c1d95",
      lineWidth: 1.8,
    },
  ];

  for (const spec of specs) {
    if (!map.getSource(spec.sourceId)) {
      map.addSource(spec.sourceId, {
        type: "geojson",
        data: EMPTY_FLOOD,
      });
    }
    if (!map.getLayer(spec.fillId)) {
      map.addLayer({
        id: spec.fillId,
        type: "fill",
        source: spec.sourceId,
        layout: { visibility: "none" },
        paint: {
          "fill-color": spec.fillColor,
          "fill-opacity": spec.fillOpacity,
        },
      });
    }
    if (!map.getLayer(spec.lineId)) {
      map.addLayer({
        id: spec.lineId,
        type: "line",
        source: spec.sourceId,
        layout: { visibility: "none" },
        paint: {
          "line-color": spec.lineColor,
          "line-width": spec.lineWidth,
          "line-opacity": 0.9,
        },
      });
    }
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

function ensureQueryLocationLayers(map: maplibregl.Map) {
  if (!map.getSource("query-location-point")) {
    map.addSource("query-location-point", {
      type: "geojson",
      data: EMPTY_POINTS,
    });
  }

  if (!map.getLayer("query-location-halo")) {
    map.addLayer({
      id: "query-location-halo",
      type: "circle",
      source: "query-location-point",
      paint: {
        "circle-radius": 16,
        "circle-color": [
          "match",
          ["get", "relation"],
          "inside",
          "#dc2626",
          "boundary",
          "#d97706",
          "outside",
          "#1e3a8a",
          "#64748b",
        ],
        "circle-opacity": 0.24,
      },
    });
  }

  if (!map.getLayer("query-location-dot")) {
    map.addLayer({
      id: "query-location-dot",
      type: "circle",
      source: "query-location-point",
      paint: {
        "circle-radius": 7.5,
        "circle-color": [
          "match",
          ["get", "relation"],
          "inside",
          "#dc2626",
          "boundary",
          "#d97706",
          "outside",
          "#1e3a8a",
          "#64748b",
        ],
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#ffffff",
      },
    });
  }
}

export type FloodMapProps = {
  level: number;
  mode?: "single" | "compare";
  compareLevelB?: number;
  selectedPoint?: GeoPoint | null;
  selectedPointRelation?: SpatialPointRelation;
  flyToPointToken?: number;
  onMapPointSelect?: (point: GeoPoint) => void;
  onScenarioAGeometryChange?: (
    geojson: FloodGeometry | null,
    levelCm: number,
  ) => void;
  onScenarioBGeometryChange?: (
    geojson: FloodGeometry | null,
    levelCm: number,
  ) => void;
  onStatusChange?: (status: FloodLayerStatus) => void;
  onStatusBChange?: (status: FloodLayerStatus | null) => void;
  onDerivedAreaChange?: (area: DerivedFloodAreaResult | null) => void;
  onDerivedAreaBChange?: (area: DerivedFloodAreaResult | null) => void;
  onComparisonChange?: (comparison: ScenarioComparisonResult | null) => void;
  retryToken?: number;
  retryTokenB?: number;
  isVisible?: boolean;
  isMapFocus?: boolean;
  onToggleMapFocus?: () => void;
};

export function FloodMap({
  level,
  mode = "single",
  compareLevelB = 5.5,
  selectedPoint = null,
  selectedPointRelation = "unavailable",
  flyToPointToken = 0,
  onMapPointSelect,
  onScenarioAGeometryChange,
  onScenarioBGeometryChange,
  onStatusChange,
  onStatusBChange,
  onDerivedAreaChange,
  onDerivedAreaBChange,
  onComparisonChange,
  retryToken = 0,
  retryTokenB = 0,
  isVisible = true,
  isMapFocus = false,
  onToggleMapFocus,
}: FloodMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onMapPointSelectRef = useRef(onMapPointSelect);
  const onScenarioAGeometryChangeRef = useRef(onScenarioAGeometryChange);
  const onScenarioBGeometryChangeRef = useRef(onScenarioBGeometryChange);
  const onStatusChangeRef = useRef(onStatusChange);
  const onStatusBChangeRef = useRef(onStatusBChange);
  const onDerivedAreaChangeRef = useRef(onDerivedAreaChange);
  const onDerivedAreaBChangeRef = useRef(onDerivedAreaBChange);
  const onComparisonChangeRef = useRef(onComparisonChange);
  const lastFlyTokenRef = useRef(flyToPointToken);

  const [renderedData, setRenderedData] = useState<FloodGeometry | null>(null);
  const [renderedComparison, setRenderedComparison] =
    useState<ScenarioComparisonResult | null>(null);
  const [readyMap, setReadyMap] = useState<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRetry, setMapRetry] = useState(0);
  const [showFlood, setShowFlood] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [showLayerControls, setShowLayerControls] = useState(true);

  const scenarioA = useSgbFlood(level, retryToken, true);
  const scenarioB = useSgbFlood(
    compareLevelB,
    retryTokenB,
    mode === "compare",
  );

  const comparison: ScenarioComparisonResult | null = useMemo(() => {
    if (mode !== "compare") return null;
    if (
      scenarioA.status.state !== "official" ||
      scenarioB.status.state !== "official"
    ) {
      return null;
    }
    return compareFloodScenarios(
      scenarioA.geojson,
      scenarioA.status.levelCm,
      scenarioB.geojson,
      scenarioB.status.levelCm,
    );
  }, [
    mode,
    scenarioA.status.state,
    scenarioA.status.levelCm,
    scenarioA.geojson,
    scenarioB.status.state,
    scenarioB.status.levelCm,
    scenarioB.geojson,
  ]);

  useEffect(() => {
    onMapPointSelectRef.current = onMapPointSelect;
  }, [onMapPointSelect]);

  useEffect(() => {
    onScenarioAGeometryChangeRef.current = onScenarioAGeometryChange;
  }, [onScenarioAGeometryChange]);

  useEffect(() => {
    onScenarioBGeometryChangeRef.current = onScenarioBGeometryChange;
  }, [onScenarioBGeometryChange]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onStatusBChangeRef.current = onStatusBChange;
  }, [onStatusBChange]);

  useEffect(() => {
    onDerivedAreaChangeRef.current = onDerivedAreaChange;
  }, [onDerivedAreaChange]);

  useEffect(() => {
    onDerivedAreaBChangeRef.current = onDerivedAreaBChange;
  }, [onDerivedAreaBChange]);

  useEffect(() => {
    onComparisonChangeRef.current = onComparisonChange;
  }, [onComparisonChange]);

  useEffect(() => {
    onStatusChangeRef.current?.(scenarioA.status);
  }, [scenarioA.status]);

  useEffect(() => {
    onScenarioAGeometryChangeRef.current?.(
      scenarioA.status.state === "official" ? scenarioA.geojson : null,
      scenarioA.status.levelCm,
    );
  }, [scenarioA.status.state, scenarioA.status.levelCm, scenarioA.geojson]);

  useEffect(() => {
    onStatusBChangeRef.current?.(
      mode === "compare" ? scenarioB.status : null,
    );
  }, [mode, scenarioB.status]);

  useEffect(() => {
    onScenarioBGeometryChangeRef.current?.(
      mode === "compare" && scenarioB.status.state === "official"
        ? scenarioB.geojson
        : null,
      scenarioB.status.levelCm,
    );
  }, [mode, scenarioB.status.state, scenarioB.status.levelCm, scenarioB.geojson]);

  useEffect(() => {
    onDerivedAreaChangeRef.current?.(scenarioA.derivedArea);
  }, [scenarioA.derivedArea]);

  useEffect(() => {
    onDerivedAreaBChangeRef.current?.(
      mode === "compare" ? scenarioB.derivedArea : null,
    );
  }, [mode, scenarioB.derivedArea]);

  useEffect(() => {
    onComparisonChangeRef.current?.(comparison);
  }, [comparison]);

  useEffect(() => {
    const container = containerRef.current;
    if (!isVisible || !container || !readyMap) return;
    const resize = () => {
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        readyMap.resize();
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isVisible, readyMap]);

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
        ensureComparisonLayers(map);
        ensureHydroStationLayers(map);
        ensureQueryLocationLayers(map);
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

    const onMapClick = (event: maplibregl.MapMouseEvent) => {
      // Preserve hydrological station marker clicks without dropping a query marker on top
      if (map.getLayer("hydro-stations-circle")) {
        const stationHits = map.queryRenderedFeatures(event.point, {
          layers: ["hydro-stations-circle"],
        });
        if (stationHits.length > 0) {
          return;
        }
      }
      onMapPointSelectRef.current?.({
        lat: event.lngLat.lat,
        lon: event.lngLat.lng,
      });
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
    map.on("click", onMapClick);
    map.on("mouseenter", "hydro-stations-circle", onEnter);
    map.on("mouseleave", "hydro-stations-circle", onLeave);

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.off("error", onError);
      map.off("style.load", initLayers);
      map.off("click", "hydro-stations-circle", onStationClick);
      map.off("click", onMapClick);
      map.off("mouseenter", "hydro-stations-circle", onEnter);
      map.off("mouseleave", "hydro-stations-circle", onLeave);
      mapRef.current = null;
      map.remove();
    };
  }, [mapRetry]);

  // Single-scenario raw official SGB source update (never alters official coordinates)
  useEffect(() => {
    if (!readyMap || readyMap !== mapRef.current) return;
    const source = readyMap.getSource("flood-zone") as maplibregl.GeoJSONSource;
    let active = true;
    void source
      .setData(scenarioA.geojson)
      .then(() => {
        if (active) setRenderedData(scenarioA.geojson);
      })
      .catch(() => {
        if (active)
          setMapError("Falha ao desenhar a camada SGB. Tente recarregar o mapa.");
      });
    return () => {
      active = false;
    };
  }, [readyMap, scenarioA.geojson]);

  // Georeferenced queried location marker update
  useEffect(() => {
    if (!readyMap || readyMap !== mapRef.current) return;
    const source = readyMap.getSource(
      "query-location-point",
    ) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const pointData: FeatureCollection<Point> = selectedPoint
      ? {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {
                relation: selectedPointRelation,
              },
              geometry: {
                type: "Point",
                coordinates: [selectedPoint.lon, selectedPoint.lat],
              },
            },
          ],
        }
      : EMPTY_POINTS;

    void source.setData(pointData).catch(() => {
      // Non-fatal marker redraw error
    });
  }, [readyMap, selectedPoint, selectedPointRelation]);

  // Smooth pan/zoom to queried coordinates when explicitly requested
  useEffect(() => {
    if (flyToPointToken === lastFlyTokenRef.current) return;
    lastFlyTokenRef.current = flyToPointToken;
    const map = mapRef.current;
    if (!map || !selectedPoint) return;
    const currentZoom = map.getZoom();
    map.flyTo({
      center: [selectedPoint.lon, selectedPoint.lat],
      zoom: Math.max(currentZoom, 14.2),
      essential: false,
    });
  }, [flyToPointToken, selectedPoint]);

  // Topological comparison sources update (A ∩ B, A \ B, B \ A)
  useEffect(() => {
    if (!readyMap || readyMap !== mapRef.current) return;
    const commonSource = readyMap.getSource(
      "flood-compare-common",
    ) as maplibregl.GeoJSONSource;
    const onlyASource = readyMap.getSource(
      "flood-compare-only-a",
    ) as maplibregl.GeoJSONSource;
    const onlyBSource = readyMap.getSource(
      "flood-compare-only-b",
    ) as maplibregl.GeoJSONSource;

    const commonData =
      mode === "compare" && comparison?.status === "valid"
        ? comparison.geometries.common
        : EMPTY_FLOOD;
    const onlyAData =
      mode === "compare" && comparison?.status === "valid"
        ? comparison.geometries.onlyA
        : EMPTY_FLOOD;
    const onlyBData =
      mode === "compare" && comparison?.status === "valid"
        ? comparison.geometries.onlyB
        : EMPTY_FLOOD;

    let active = true;
    void Promise.all([
      commonSource.setData(commonData),
      onlyASource.setData(onlyAData),
      onlyBSource.setData(onlyBData),
    ])
      .then(() => {
        if (active) {
          setRenderedComparison(
            mode === "compare" && comparison?.status === "valid"
              ? comparison
              : null,
          );
        }
      })
      .catch(() => {
        if (active)
          setMapError(
            "Falha ao desenhar a comparação das camadas SGB. Tente recarregar o mapa.",
          );
      });
    return () => {
      active = false;
    };
  }, [readyMap, mode, comparison]);

  // Layer visibility controller
  useEffect(() => {
    if (!readyMap || readyMap !== mapRef.current) return;

    const singleVisible =
      mode === "single" && showFlood && renderedData === scenarioA.geojson;
    for (const id of ["flood-zone-fill", "flood-zone-line"]) {
      readyMap.setLayoutProperty(
        id,
        "visibility",
        singleVisible ? "visible" : "none",
      );
    }

    const compareVisible =
      mode === "compare" &&
      showFlood &&
      comparison?.status === "valid" &&
      renderedComparison === comparison;
    for (const id of COMPARE_LAYER_IDS) {
      readyMap.setLayoutProperty(
        id,
        "visibility",
        compareVisible ? "visible" : "none",
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
  }, [
    readyMap,
    mode,
    showFlood,
    showStations,
    renderedData,
    scenarioA.geojson,
    renderedComparison,
    comparison,
  ]);

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
        {onToggleMapFocus && (
          <button
            type="button"
            className="map-ctrl-btn"
            aria-expanded={!isMapFocus}
            aria-controls="map-information-panel"
            onClick={() => {
              if (!isMapFocus) setShowLayerControls(false);
              onToggleMapFocus();
            }}
          >
            {isMapFocus ? "Sair do mapa em foco" : "Mapa em foco"}
          </button>
        )}
        <button
          type="button"
          className="map-ctrl-btn"
          onClick={handleRecenter}
          title="Centralizar mapa em Santo Antônio de Pádua"
        >
          Centralizar
        </button>

        <button
          type="button"
          className="map-ctrl-btn"
          aria-expanded={showLayerControls}
          aria-controls="map-layer-options"
          onClick={() => setShowLayerControls((value) => !value)}
        >
          {showLayerControls ? "Recolher camadas" : "Camadas"}
        </button>
        <div id="map-layer-options" className="map-layer-toggles" hidden={!showLayerControls}>
          <label
            className="toggle-label"
            title={
              mode === "compare"
                ? "Alternar exibição das manchas comparadas SGB"
                : "Alternar exibição da mancha oficial SGB"
            }
          >
            <input
              type="checkbox"
              checked={showFlood}
              onChange={(e) => setShowFlood(e.target.checked)}
            />
            <span>{mode === "compare" ? "Manchas comparadas" : "Mancha SGB"}</span>
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
