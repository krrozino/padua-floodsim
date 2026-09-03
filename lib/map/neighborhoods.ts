import type { FeatureCollection, Point } from "geojson";

export type NeighborhoodSeverity = "safe" | "attention" | "high" | "critical";

export type NeighborhoodReference = {
  name: string;
  coordinates: [number, number]; // [lng, lat] in WGS84 EPSG:4326
  threshold: number; // reference threshold in meters
  margin: "direita" | "esquerda"; // Rio Pomba margin
};

/**
 * 7 reference neighborhoods in Santo Antônio de Pádua with approximate center coordinates.
 * In accordance with municipal law nº 3.864/2017, these names belong to the 27 official
 * neighborhoods. Vector polygon boundaries are pending municipal GIS release;
 * these coordinates serve as georeferenced point references.
 */
export const REFERENCE_NEIGHBORHOODS: readonly NeighborhoodReference[] = [
  {
    name: "Centro",
    coordinates: [-42.1805, -21.5398],
    threshold: 3.75,
    margin: "esquerda",
  },
  {
    name: "São Félix",
    coordinates: [-42.1817, -21.5436],
    threshold: 4.55,
    margin: "direita",
  },
  {
    name: "Aeroporto",
    coordinates: [-42.1948, -21.5312],
    threshold: 4.2,
    margin: "direita",
  },
  {
    name: "Cidade Nova",
    coordinates: [-42.2068, -21.5276],
    threshold: 4.0,
    margin: "direita",
  },
  {
    name: "Divinéia",
    coordinates: [-42.161, -21.5368],
    threshold: 4.85,
    margin: "esquerda",
  },
  {
    name: "Farol",
    coordinates: [-42.1944, -21.534],
    threshold: 5.25,
    margin: "direita",
  },
  {
    name: "Mirante",
    coordinates: [-42.191, -21.5294],
    threshold: 5.1,
    margin: "esquerda",
  },
] as const;

export const SEVERITY_COLORS: Record<NeighborhoodSeverity, string> = {
  safe: "#087acb",
  attention: "#df9b00",
  high: "#ed6b13",
  critical: "#dc2f3d",
};

export const SEVERITY_LABELS: Record<NeighborhoodSeverity, string> = {
  safe: "Normal / Fora da mancha",
  attention: "Atenção",
  high: "Risco alto",
  critical: "Crítico",
};

export function getNeighborhoodSeverity(
  level: number,
  threshold: number,
): NeighborhoodSeverity {
  if (level >= threshold + 0.7) return "critical";
  if (level >= threshold + 0.25) return "high";
  if (level >= threshold) return "attention";
  return "safe";
}

export function buildNeighborhoodPointsGeoJSON(level: number): FeatureCollection<
  Point,
  {
    name: string;
    threshold: number;
    severity: NeighborhoodSeverity;
    severityLabel: string;
    color: string;
    margin: string;
    status: "temporary_reference_point";
    classification: "mock";
    disclaimer: string;
  }
> {
  return {
    type: "FeatureCollection",
    features: REFERENCE_NEIGHBORHOODS.map((item) => {
      const severity = getNeighborhoodSeverity(level, item.threshold);
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: item.coordinates,
        },
        properties: {
          name: item.name,
          threshold: item.threshold,
          severity,
          severityLabel: SEVERITY_LABELS[severity],
          color: SEVERITY_COLORS[severity],
          margin: item.margin === "direita" ? "Margem Direita" : "Margem Esquerda",
          status: "temporary_reference_point",
          classification: "mock",
          disclaimer:
            "Ponto de referência aproximado (mock). Limites poligonais oficiais aguardam vetorização municipal (Lei 3.864/2017).",
        },
      };
    }),
  };
}
