"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

const MAP_STYLE = "https://demotiles.maplibre.org/style.json";
const PADUA_CENTER: [number, number] = [-42.18, -21.54];

function buildMockFloodData(level: number) {
  const spread = 0.0014 + Math.max(0, level - 2.5) * 0.00085;
  const deepSpread = Math.max(0.00065, spread * 0.42);

  const corridor = (width: number) => [
    [-42.205, -21.545 - width],
    [-42.196, -21.541 - width],
    [-42.188, -21.544 - width],
    [-42.180, -21.548 - width],
    [-42.171, -21.546 - width],
    [-42.162, -21.541 - width],
    [-42.154, -21.543 - width],
    [-42.154, -21.543 + width],
    [-42.162, -21.541 + width],
    [-42.171, -21.546 + width],
    [-42.180, -21.548 + width],
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
        properties: { depth: "shallow" },
        geometry: { type: "Polygon" as const, coordinates: [corridor(spread)] },
      },
      {
        type: "Feature" as const,
        properties: { depth: "deep" },
        geometry: { type: "Polygon" as const, coordinates: [corridor(deepSpread)] },
      },
    ],
  };
}

export function FloodMap({ level }: { level: number }) {
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
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");

    map.on("load", () => {
      map.addSource("mock-flood", {
        type: "geojson",
        data: buildMockFloodData(level),
      });

      map.addLayer({
        id: "mock-flood-shallow",
        type: "fill",
        source: "mock-flood",
        filter: ["==", ["get", "depth"], "shallow"],
        paint: {
          "fill-color": "#38bdf8",
          "fill-opacity": 0.34,
        },
      });

      map.addLayer({
        id: "mock-flood-deep",
        type: "fill",
        source: "mock-flood",
        filter: ["==", ["get", "depth"], "deep"],
        paint: {
          "fill-color": "#0759b8",
          "fill-opacity": 0.68,
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

    const update = () => {
      const source = map.getSource("mock-flood") as maplibregl.GeoJSONSource | undefined;
      source?.setData(buildMockFloodData(level));
    };

    if (map.isStyleLoaded()) update();
    else map.once("load", update);
  }, [level]);

  return <div ref={containerRef} className="map-canvas" aria-label="Mapa de Santo Antônio de Pádua" />;
}
