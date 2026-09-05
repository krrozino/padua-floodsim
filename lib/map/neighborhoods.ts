import type { FeatureCollection, Point } from "geojson";

export type NeighborhoodReference = {
  name: string;
  coordinates: [number, number]; // [lng, lat] in WGS84 EPSG:4326
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
    margin: "esquerda",
  },
  {
    name: "São Félix",
    coordinates: [-42.1817, -21.5436],
    margin: "direita",
  },
  {
    name: "Aeroporto",
    coordinates: [-42.1948, -21.5312],
    margin: "direita",
  },
  {
    name: "Cidade Nova",
    coordinates: [-42.2068, -21.5276],
    margin: "direita",
  },
  {
    name: "Divinéia",
    coordinates: [-42.161, -21.5368],
    margin: "esquerda",
  },
  {
    name: "Farol",
    coordinates: [-42.1944, -21.534],
    margin: "direita",
  },
  {
    name: "Mirante",
    coordinates: [-42.191, -21.5294],
    margin: "esquerda",
  },
] as const;

export const NEIGHBORHOOD_DISCLAIMER =
  "Pontos de referência aproximados (mock), não limites territoriais. Não permitem classificar risco nem afirmar que um bairro está dentro ou fora da mancha.";

export function buildNeighborhoodPointsGeoJSON(): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: REFERENCE_NEIGHBORHOODS.map((item) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: item.coordinates },
      properties: {
        name: item.name,
        margin: item.margin,
        status: "temporary_reference_point",
        classification: "mock",
        disclaimer: NEIGHBORHOOD_DISCLAIMER,
      },
    })),
  };
}
