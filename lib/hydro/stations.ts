import type { FeatureCollection, Point } from "geojson";

export interface HydroStationMetadata {
  readonly id: string;
  readonly name: string;
  readonly institution: string;
  readonly river: string;
  readonly identifiers: readonly { readonly label: string; readonly code: string }[];
  readonly coordinates: readonly [number, number] | null; // [lng, lat] in WGS84 (EPSG:4326)
  readonly locationDescription: string;
  readonly officialUrl: string | null;
  readonly officialLinkLabel: string | null;
  readonly sourceProvenance: string;
  readonly hasLiveIntegration: boolean;
  readonly plotOnMap: boolean;
  readonly statusNote: string;
  readonly classification: "official_reference";
}

/**
 * Verified hydrological station metadata for Santo Antônio de Pádua (Rio Pomba).
 * Sources: INEA-RJ inventory and station sheets audited in R02-A (#45),
 * ANA HidroInventário, and SGB/CPRM 2024 technical reports.
 */
export const HYDRO_STATIONS: readonly HydroStationMetadata[] = [
  {
    id: "inea-213042120",
    name: "Santo Antônio de Pádua (INEA)",
    institution: "INEA — Instituto Estadual do Ambiente (Alerta de Cheias)",
    river: "Rio Pomba",
    identifiers: [
      { label: "INEA", code: "213042120" },
      { label: "ANA FLU", code: "58774000" },
      { label: "ANA PLU", code: "2141094" },
    ],
    coordinates: [-42.20767, -21.51122],
    locationDescription:
      "Santo Antônio de Pádua, RJ · ~6 km a montante do centro urbano (WGS84: -21,51122, -42,20767)",
    officialUrl:
      "https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.html",
    officialLinkLabel: "Página oficial INEA (213042120)",
    sourceProvenance:
      "Inventário INEA 2026 e Ficha Descritiva INEA (auditoria documental R02-A).",
    hasLiveIntegration: true,
    plotOnMap: true,
    statusNote:
      "Estação vinculada ao painel de monitoramento do Rio Pomba (coleta automática sujeita à disponibilidade operacional).",
    classification: "official_reference",
  },
  {
    id: "inea-58789000",
    name: "Ponte Paraoquena (INEA)",
    institution: "INEA — Instituto Estadual do Ambiente",
    river: "Rio Pomba",
    identifiers: [
      { label: "ANA FLU", code: "58789000" },
      { label: "ANA PLU", code: "2142083" },
    ],
    coordinates: [-42.25336, -21.49539],
    locationDescription:
      "Distrito de Paraoquena, Santo Antônio de Pádua, RJ · trecho a montante (WGS84: -21,49539, -42,25336)",
    officialUrl: "https://alertadecheias.inea.rj.gov.br/",
    officialLinkLabel: "Portal Alerta de Cheias INEA",
    sourceProvenance:
      "Inventário INEA 2026 (auditoria documental R02-A).",
    hasLiveIntegration: false,
    plotOnMap: true,
    statusNote:
      "Sem integração de leitura automática nesta plataforma. Exibida apenas como referência de localização oficial.",
    classification: "official_reference",
  },
  {
    id: "rhn-58790002",
    name: "Santo Antônio de Pádua II (SGB / ANA)",
    institution: "Serviço Geológico do Brasil (SGB) / ANA — Rede Hidrometeorológica Nacional",
    river: "Rio Pomba",
    identifiers: [{ label: "RHN / ANA", code: "58790002" }],
    coordinates: null,
    locationDescription:
      "Coordenadas divergentes entre cadastro ANA (-21,5422, -42,1806) e relatório SGB SAH-Pomba 2024 (-21,5375, -42,1578) — diferença aproximada de 2,4 km.",
    officialUrl: "https://rigeo.sgb.gov.br/handle/doc/25035",
    officialLinkLabel: "Relatório técnico SGB (2024)",
    sourceProvenance:
      "Relatório de Mancha SGB 2024, Relatório Anual SAH-Pomba 2024 e ANA HidroInventário.",
    hasLiveIntegration: false,
    plotOnMap: false,
    statusNote:
      "Estação de referência das 11 manchas oficiais SGB (zero da régua: 79,709 m, hgeoHNOR_IMBITUBA). Não plotada como ponto único no mapa enquanto a divergência de coordenadas entre ANA e SGB não for resolvida institucionalmente.",
    classification: "official_reference",
  },
] as const;

export const PLOTTED_HYDRO_STATIONS = HYDRO_STATIONS.filter(
  (station): station is HydroStationMetadata & { coordinates: readonly [number, number] } =>
    station.plotOnMap && station.coordinates !== null,
);

export function formatStationIdentifiers(
  identifiers: readonly { readonly label: string; readonly code: string }[],
): string {
  return identifiers.map((item) => `${item.label} ${item.code}`).join(" · ");
}

export function buildHydroStationsGeoJSON(): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: PLOTTED_HYDRO_STATIONS.map((station) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [station.coordinates[0], station.coordinates[1]],
      },
      properties: {
        id: station.id,
        name: station.name,
        institution: station.institution,
        identifiers: formatStationIdentifiers(station.identifiers),
        locationDescription: station.locationDescription,
        officialUrl: station.officialUrl ?? "",
        officialLinkLabel: station.officialLinkLabel ?? "",
        hasLiveIntegration: station.hasLiveIntegration,
        statusNote: station.statusNote,
        sourceProvenance: station.sourceProvenance,
        classification: station.classification,
      },
    })),
  };
}
