import type {
  NeighborhoodAcquisitionStatus,
  NeighborhoodBoundaryRecord,
  OfficialNeighborhoodId,
  OsmAuxiliaryNeighborhoodPoint,
  RiverBank,
} from "./contract.ts";

export const OFFICIAL_NEIGHBORHOOD_COUNT = 27 as const;

export const NEIGHBORHOOD_ACQUISITION_STATUS: NeighborhoodAcquisitionStatus =
  "BLOCKED_DATA_SOURCE";

export const NEIGHBORHOOD_BLOCKED_REASON =
  "A Lei Municipal nº 3.864/2017 (Anexo VI, p. 34: '* Vide Mapa em anexo'; Anexo XIII, p. 42: 'cujos limites se encontram na PGV') e a Lei Municipal nº 4.135/2021 (Tabela I de logradouros) oficializam os 27 bairros da sede, porém o mapa anexo e os vetores/memoriais descritivos não foram publicados no portal da Prefeitura (o PDF da Lei 3.864/2017 apresenta 73 páginas em branco). IBGE (Censo 2022 Malha de Bairros e Setores Censitários), SGB/CPRM (2015/2024), SEA/INEA-IBGE BC25_RJ e OpenStreetMap tampouco possuem polígonos dos bairros de Santo Antônio de Pádua." as const;

export const MAINTAINER_PRIORITY_NEIGHBORHOOD_IDS: readonly OfficialNeighborhoodId[] =
  [
    "centro",
    "sao-felix",
    "aeroporto",
    "cidade-nova",
    "divineia",
    "farol",
    "mirante",
  ] as const;

const PRIORITY_SET = new Set<OfficialNeighborhoodId>(
  MAINTAINER_PRIORITY_NEIGHBORHOOD_IDS,
);

const PGV_SOURCE_LABEL =
  "Prefeitura Municipal de Santo Antônio de Pádua — Lei nº 3.864/2017 (Anexos VI e XIII) e Lei nº 4.135/2021 (Tabela I)" as const;
const PGV_NAMES_VERSION = "pgv-2017-2021-names-only" as const;

type NeighborhoodSeed = readonly [
  id: OfficialNeighborhoodId,
  officialNumber: number,
  officialName: string,
  riverBank: RiverBank,
  lei3864AnexoVi: string,
  lei3864AnexoXiii: string,
  lei4135TabelaI: string,
  orthographicNotes: string | null,
  osmTuple?: readonly [osmNodeId: number, osmName: string, lat: number, lon: number],
];

function buildOsmPoint(
  osmTuple?: readonly [number, string, number, number],
): OsmAuxiliaryNeighborhoodPoint | null {
  if (!osmTuple) return null;
  const [osmNodeId, osmName, latitude, longitude] = osmTuple;
  return {
    classification: "auxiliary_reference_point_only",
    osmNodeId,
    osmName,
    latitude,
    longitude,
    crs: "EPSG:4326",
    license: "ODbL-1.0",
    usableForPolygonIntersection: false,
  };
}

function buildRecord(seed: NeighborhoodSeed): NeighborhoodBoundaryRecord {
  const [
    id,
    officialNumber,
    officialName,
    riverBank,
    lei3864AnexoVi,
    lei3864AnexoXiii,
    lei4135TabelaI,
    orthographicNotes,
    osmTuple,
  ] = seed;

  return {
    id,
    officialNumber,
    officialName,
    riverBank,
    maintainerPriority: PRIORITY_SET.has(id),
    legalNomenclature: {
      lei3864AnexoVi,
      lei3864AnexoXiii,
      lei4135TabelaI,
      orthographicNotes,
    },
    geometryStatus: "unavailable",
    geometry: null,
    source: PGV_SOURCE_LABEL,
    version: PGV_NAMES_VERSION,
    osmAuxiliaryPoint: buildOsmPoint(osmTuple),
  };
}

const NEIGHBORHOOD_SEEDS: readonly NeighborhoodSeed[] = [
  ["aeroporto", 1, "Aeroporto", "right", "AEROPORTO", "AEROPORTO", "Aeroporto", null, [2661555812, "Aeroporto", -21.5312369, -42.1948014]],
  ["alipio", 2, "Alípio", "right", "ALÍPIO", "ALÍPIO", "Alípio", null],
  ["arraialzinho", 3, "Arraialzinho", "right", "ARRAIALZINHO", "ARRAIALZINHO", "Arraialzinho", null],
  ["cafe-garoto", 4, "Café Garoto", "right", "CAFÉ GAROTO", "CAFÉ GAROTO", "Café Garoto", null],
  [
    "cehab",
    5,
    "CEHAB",
    "right",
    "CEHAB",
    "CEHAB",
    "Cehab",
    "Sigla do conjunto habitacional (CEHAB-RJ); grafada em caixa-alta na Lei 3.864/2017 e capitalizada na Lei 4.135/2021.",
    [2661555842, "Cehab", -21.5307582, -42.1980357],
  ],
  ["cidade-nova", 6, "Cidade Nova", "right", "CIDADE NOVA", "CIDADE NOVA", "Cidade Nova", null, [2661555848, "Cidade Nova", -21.5275987, -42.2068198]],
  ["dezessete", 7, "Dezessete", "right", "DEZESSETE", "DEZESSETE", "Dezessete", null, [2661555860, "Dezessete", -21.5292685, -42.2008689]],
  ["farol", 8, "Farol", "right", "FAROL", "FAROL", "Farol", null],
  [
    "gabri",
    9,
    "Gabri",
    "right",
    "GABRI",
    "GABRI",
    "Gabry",
    "Grafado 'GABRI' na Lei 3.864/2017 (Anexos VI e XIII) e 'Gabry' na Lei 4.135/2021 (Tabela I) e no OpenStreetMap.",
    [2661555901, "Gabry", -21.5475712, -42.1902873],
  ],
  ["gloria", 10, "Glória", "right", "GLÓRIA", "GLÓRIA", "Glória", null],
  ["monte-libano", 11, "Monte Líbano", "right", "MONTE LÍBANO", "MONTE LÍBANO", "Monte Líbano", null],
  ["parque-das-aguas", 12, "Parque das Águas", "right", "PARQUE DAS ÁGUAS", "PARQUE DAS ÁGUAS", "Parque das Águas", null, [2661555946, "Parque das Águas", -21.544562, -42.1865436]],
  ["santa-afra", 13, "Santa Afra", "right", "SANTA AFRA", "SANTA AFRA", "Santa Afra", null],
  ["sao-felix", 14, "São Félix", "right", "SÃO FÉLIX", "SÃO FÉLIX", "São Félix", null, [2661555955, "São Félix", -21.5436294, -42.1816858]],
  [
    "sao-luis",
    15,
    "São Luis",
    "right",
    "SÃO LUIS",
    "SÃO LUIS",
    "São Luiz",
    "Grafado 'SÃO LUIS' na Lei 3.864/2017 (Anexos VI e XIII) e 'São Luiz' na Lei 4.135/2021 (Tabela I).",
  ],
  [
    "sardemberg",
    16,
    "Sardemberg",
    "right",
    "SARDEMBERG",
    "SARDEMBERG",
    "Sardenberg",
    "Grafado 'SARDEMBERG' na Lei 3.864/2017 (Anexos VI e XIII) e 'Sardenberg' na Lei 4.135/2021 (Tabela I).",
  ],
  [
    "alequicis",
    17,
    "Alequicis",
    "left",
    "ALEQUICIS",
    "ALEQUICIS",
    "Alequicis",
    "Grafado consistentemente 'Alequicis' nas Leis 3.864/2017 e 4.135/2021; no OpenStreetMap consta a grafia fonética popular 'Alexis'.",
    [2661555816, "Alexis", -21.5490414, -42.1712396],
  ],
  ["barro-branco", 18, "Barro Branco", "left", "BARRO BRANCO", "BARRO BRANCO", "Barro Branco", null],
  ["carvalho", 19, "Carvalho", "left", "CARVALHO", "CARVALHO", "Carvalho", null],
  ["centro", 20, "Centro", "left", "CENTRO", "CENTRO", "Centro", null],
  ["divineia", 21, "Divinéia", "left", "DIVINÉIA", "DIVINÉIA", "Divinéia", null, [2661555867, "Divineia", -21.5368553, -42.1610008]],
  [
    "ferreira",
    22,
    "Ferreira",
    "left",
    "FERRERIRA",
    "FERRERIRA",
    "Ferreira",
    "Erro tipográfico 'FERRERIRA' nos Anexos VI e XIII da Lei 3.864/2017; grafia retificada para 'Ferreira' na Tabela I da Lei 4.135/2021.",
  ],
  ["industrial", 23, "Industrial", "left", "INDUSTRIAL", "INDUSTRIAL", "Industrial", null],
  ["jorimpa", 24, "Jorimpa", "left", "JORIMPA", "JORIMPA", "Jorimpa", null],
  ["mirante", 25, "Mirante", "left", "MIRANTE", "MIRANTE", "Mirante", null],
  [
    "pereira",
    26,
    "Pereira",
    "left",
    "PERERIRA",
    "PEREIRA",
    "Pereira",
    "Erro tipográfico 'PERERIRA' no Anexo VI da Lei 3.864/2017; grafia correta 'PEREIRA'/'Pereira' confirmada no Anexo XIII (Ata) e na Lei 4.135/2021.",
    [2601989430, "Pereira", -21.53658, -42.1755131],
  ],
  ["tavares", 27, "Tavares", "left", "TAVARES", "TAVARES", "Tavares", null, [2661555957, "Tavares", -21.5457489, -42.1759833]],
];

export const OFFICIAL_NEIGHBORHOOD_REGISTRY: readonly NeighborhoodBoundaryRecord[] =
  NEIGHBORHOOD_SEEDS.map(buildRecord);

export function validateUniqueNeighborhoodRecords(
  records: readonly NeighborhoodBoundaryRecord[],
): void {
  const seenIds = new Set<string>();
  const seenNumbers = new Set<number>();
  for (const rec of records) {
    if (!rec.id || seenIds.has(rec.id)) {
      throw new Error(
        `Identificador de bairro duplicado ou inválido detectado no painel: '${String(rec.id)}'.`,
      );
    }
    if (!Number.isInteger(rec.officialNumber) || seenNumbers.has(rec.officialNumber)) {
      throw new Error(
        `Número oficial de bairro duplicado ou inválido detectado: '${String(rec.officialNumber)}' (${rec.id}).`,
      );
    }
    seenIds.add(rec.id);
    seenNumbers.add(rec.officialNumber);
  }
}

export function getOfficialNeighborhoods(): readonly NeighborhoodBoundaryRecord[] {
  return OFFICIAL_NEIGHBORHOOD_REGISTRY;
}

export function getPriorityNeighborhoods(): readonly NeighborhoodBoundaryRecord[] {
  return OFFICIAL_NEIGHBORHOOD_REGISTRY.filter((item) => item.maintainerPriority);
}

export function deriveAcquisitionStatus(
  boundaryAvailableCount: number,
): NeighborhoodAcquisitionStatus {
  if (boundaryAvailableCount <= 0) return "BLOCKED_DATA_SOURCE";
  if (boundaryAvailableCount < OFFICIAL_NEIGHBORHOOD_COUNT) {
    return "PARTIAL_OFFICIAL_COVERAGE";
  }
  return "COMPLETE_OFFICIAL_COVERAGE";
}
