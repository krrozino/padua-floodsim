import type { FloodAreaInput } from "../sgb/area.ts";
import { evaluatePointAgainstFloodScenario } from "../sgb/location.ts";
import type {
  ControlPointEvidenceState,
  HistoricalControlPoint,
} from "./contract.ts";

/**
 * Structured validation control points for Santo Antônio de Pádua (Section 9).
 *
 * Governance rules:
 * 1. Never invent observation coordinates: only features with audited cartographic
 *    coordinates in the repository (`MUNICIPAL_NEIGHBORHOOD_BOUNDARIES.md`) carry
 *    non-null WGS84 points; all others preserve `coordinatesWgs84: null`.
 * 2. Never infer `water_absent` from the mere absence of a photograph: whenever
 *    direct positive or negative field evidence is missing for an event, `unknown`
 *    is recorded explicitly.
 */
export const HISTORICAL_CONTROL_POINTS: readonly HistoricalControlPoint[] = [
  {
    id: "CP-MONSENHOR-DINIZ",
    name: "Praça Monsenhor Diniz",
    category: "urban_square",
    neighborhoodOrSector: "Centro (margem esquerda do Rio Pomba)",
    coordinatesWgs84: { lat: -21.543205, lon: -42.17721 },
    coordinateStatus: "verified_cartographic",
    coordinateProvenance:
      "Centroide/referência do polígono OSM way/260637176 (4.272,0 m², ODbL 1.0, © OpenStreetMap contributors), auditado em MUNICIPAL_NEIGHBORHOOD_BOUNDARIES.md.",
    featureGeometryNote:
      "Polígono urbano na margem esquerda voltado à Av. Senar Frederico Rocha; pontos cotados BC25_RJ nas adjacências registram 84,0 m (escala 1:25.000).",
    sgbReferenceBehaviorNote:
      "Interceptada na borda sudoeste já em COTA_300cm (493,0 m² / 11,54%, penetração máxima 11,35 m) e em COTA_325cm (529,2 m² / 12,39%).",
    validationUsageNote:
      "Ponto-chave para investigar a diferença entre o limiar SGB de primeiro dano (310 cm) e a intrusão marginal modelada em 300 cm (efeito de declividade longitudinal WSE vs. reamostragem 10 cm -> 10 m).",
    eventRecords: [
      {
        eventId: "HIST-2012-01-04",
        state: "unknown",
        evidenceSummary:
          "Embora o Centro tenha sofrido inundação severa em jan/2012 (12 mil desalojados), não há fotografia ou auto de vistoria georreferenciado específico da praça catalogado nesta etapa.",
        sourceIds: ["DOC-2012-SGB-MANCHA", "DOC-2012-G1-JAN06"],
      },
      {
        eventId: "HIST-2022-01-08",
        state: "unknown",
        evidenceSummary:
          "Situação específica na praça não confirmada isoladamente nas reportagens gerais do Centro; mantida como desconhecida (sem inferir ausência).",
        sourceIds: ["DOC-2022-JAN-J3"],
      },
      {
        eventId: "HIST-2023-01-08",
        state: "unknown",
        evidenceSummary:
          "Enchente atingiu fortemente o eixo central (Praça Pereira Lima documentada por drone), mas a lâmina exata sobre a Praça Monsenhor Diniz aguarda levantamento municipal/fotográfico específico.",
        sourceIds: ["DOC-2023-JAN-G1-DRONE"],
      },
      {
        eventId: "HIST-2025-12-17",
        state: "unknown",
        evidenceSummary:
          "Pulso limítrofe de 310,76 cm sem relato de alagamento, porém sem vistoria negativa formal registrada na praça.",
        sourceIds: ["DOC-2025-DEC-EXP"],
      },
      {
        eventId: "HIST-2026-02-25",
        state: "unknown",
        evidenceSummary:
          "Inundação extensa no Centro em 28/02/2026; confirmação pontual na praça depende de registro fotográfico com ponto de vista verificável.",
        sourceIds: ["DOC-2026-MAR-DECRETO", "DOC-2026-FEB28-G1"],
      },
    ],
  },
  {
    id: "CP-ILHA-CONVIVENCIA",
    name: "Ilha da Convivência",
    category: "fluvial_island",
    neighborhoodOrSector: "Calha central do Rio Pomba (Centro / São Félix)",
    coordinatesWgs84: { lat: -21.543554, lon: -42.178531 },
    coordinateStatus: "verified_cartographic",
    coordinateProvenance:
      "Polígono oficial IBGE / SEA-RJ / INEA BC25_RJ (hid_ilha_a, 9.822,1 m², -21.543554, -42.178531; ponto cotado de topo 86,0 m em -21.543502, -42.178636) e OSM way/445129454 (-21.543518, -42.178546).",
    featureGeometryNote:
      "Ilha fluvial urbanizada no trecho central bifurcado do Rio Pomba, com taludes marginais baixos e platô central mais elevado (~86,0 m na BC25_RJ).",
    sgbReferenceBehaviorNote:
      "Em COTA_300cm há sobreposição periférica nas margens (30,68% em BC25_RJ / 36,63% em OSM), permanecendo o platô central fora da mancha nas cotas iniciais.",
    validationUsageNote:
      "Permite distinguir inundação de taludes periféricos da submersão do platô central ao avaliar modelos hidráulicos 1D/2D e o modelo próprio DEM+conectividade.",
    eventRecords: [
      {
        eventId: "HIST-2012-01-04",
        state: "unknown",
        evidenceSummary:
          "Sem cota de marca d'água medida no platô central da ilha nas fontes públicas auditadas.",
        sourceIds: ["DOC-2012-SGB-MANCHA"],
      },
      {
        eventId: "HIST-2022-01-08",
        state: "unknown",
        evidenceSummary:
          "Sem registro fotográfico georreferenciado específico distinguindo talude e platô central em 11/01/2022.",
        sourceIds: ["DOC-2022-JAN-DECRETO"],
      },
      {
        eventId: "HIST-2023-01-08",
        state: "unknown",
        evidenceSummary:
          "Sem confirmação pública sobre alcance no platô central em 08/01/2023; mantido como desconhecido.",
        sourceIds: ["DOC-2023-JAN-DECRETO"],
      },
      {
        eventId: "HIST-2026-02-25",
        state: "unknown",
        evidenceSummary:
          "Sem confirmação documental específica sobre submersão do platô central em 28/02/2026.",
        sourceIds: ["DOC-2026-MAR-DECRETO"],
      },
    ],
  },
  {
    id: "CP-BEIRA-RIO-SENAR",
    name: "Av. Senar Frederico Rocha e setor marginal Beira Rio",
    category: "marginal_avenue",
    neighborhoodOrSector: "Centro / Beira Rio (margem esquerda)",
    coordinatesWgs84: null,
    coordinateStatus: "unverified_kept_null",
    coordinateProvenance:
      "Eixo linear auditado no OSM (way/254402825, 374,0 m, ODbL 1.0); coordenada pontual única mantida nula para não representar um segmento viário inteiro por ponto arbitrário.",
    featureGeometryNote:
      "Via marginal imediatamente paralela ao cais da margem esquerda do Rio Pomba.",
    sgbReferenceBehaviorNote:
      "67,3% da extensão linear (251,6 m) interceptada em COTA_300cm e 69,6% (260,2 m) em COTA_325cm.",
    validationUsageNote:
      "Indicador de extravasamento marginal precoce na margem esquerda; requer perfil topográfico longitudinal do cais (PMSB Vol. II Tomo I) para validação métrica.",
    eventRecords: [
      {
        eventId: "HIST-2012-01-04",
        state: "water_present",
        evidenceSummary:
          "Reportagem do G1 (01/02/2012) e relatos de 2012 confirmam alagamento recorrente das ruas do setor Beira Rio na cheia e no repique subsequente.",
        sourceIds: ["DOC-2012-G1-FEB01", "DOC-2012-G1-JAN06"],
      },
      {
        eventId: "HIST-2022-01-08",
        state: "water_present",
        evidenceSummary:
          "Defesa Civil e imprensa regional registraram transbordamento da calha tomando as vias marginais e bairros ribeirinhos em 09–12/01/2022.",
        sourceIds: ["DOC-2022-JAN-G1-PHOTO", "DOC-2022-JAN-J3"],
      },
      {
        eventId: "HIST-2026-02-25",
        state: "water_present",
        evidenceSummary:
          "Alagamento de vias marginais documentado desde 27/02/2026 (5,55 m INEA) até o pico de 6,31 m em 28/02/2026.",
        sourceIds: ["DOC-2026-FEB27-G1", "DOC-2026-MAR-DECRETO"],
      },
    ],
  },
  {
    id: "CP-PRACA-PEREIRA-LIMA",
    name: "Praça Pereira Lima",
    category: "urban_square",
    neighborhoodOrSector: "Centro",
    coordinatesWgs84: null,
    coordinateStatus: "unverified_kept_null",
    coordinateProvenance:
      "Localização nominal verificada no Centro de Santo Antônio de Pádua; coordenada exata mantida nula até conferência cadastral/ortofoto para evitar geocodificação aproximada.",
    featureGeometryNote: "Praça histórica na área central baixa da margem do Rio Pomba.",
    sgbReferenceBehaviorNote:
      "A ser confrontada geometricamente após homologação do polígono cadastral da praça.",
    validationUsageNote:
      "Possui evidência aerofotográfica positiva inequívoca na cheia de janeiro de 2023 (428/431 cm em 58790002).",
    eventRecords: [
      {
        eventId: "HIST-2023-01-08",
        state: "water_present",
        evidenceSummary:
          "Fotografia aérea identificada (crédito: Tiago Vieira / PR Drone, publicada pelo G1 em 10/01/2023) comprova a Praça Pereira Lima coberta pelas águas do Rio Pomba em 08/01/2023.",
        sourceIds: ["DOC-2023-JAN-G1-DRONE"],
      },
    ],
  },
  {
    id: "CP-RUA-CORONEL-OLIVIER",
    name: "Rua Coronel Olivier (trecho adjacente à Praça Monsenhor Diniz / RJ-116)",
    category: "marginal_avenue",
    neighborhoodOrSector: "Centro (face nordeste da Praça Monsenhor Diniz)",
    coordinatesWgs84: null,
    coordinateStatus: "unverified_kept_null",
    coordinateProvenance:
      "Segmentos lineares auditados no OSM (way/254402829 + way/1306864131 + way/232492957 = 501,8 m, ODbL 1.0); sem ponto único inventado.",
    featureGeometryNote:
      "Corredor viário interno paralelo à face nordeste da Praça Monsenhor Diniz.",
    sgbReferenceBehaviorNote:
      "0,0% de interseção em COTA_300cm (distância mínima 20,79 m) e COTA_325cm; útil para aferir o limite de progressão transversal nas cotas superiores (>= 400 cm).",
    validationUsageNote:
      "Controle transversal para delimitar até onde o extravasamento avança do cais em direção ao interior do Centro.",
    eventRecords: [
      {
        eventId: "HIST-2023-01-08",
        state: "unknown",
        evidenceSummary:
          "Sem marca de inundação pontual verificada neste trecho específico; mantido como desconhecido.",
        sourceIds: ["DOC-2023-JAN-DECRETO"],
      },
    ],
  },
  {
    id: "CP-AV-CHAIM-ELIAS",
    name: "Av. Chaim Elias (margem direita / São Félix)",
    category: "marginal_avenue",
    neighborhoodOrSector: "São Félix (margem direita do Rio Pomba)",
    coordinatesWgs84: null,
    coordinateStatus: "unverified_kept_null",
    coordinateProvenance:
      "Segmentos lineares auditados no OSM (way/232492946 + way/299559859 + way/390654390 = 611,8 m, ODbL 1.0); coordenada pontual mantida nula.",
    featureGeometryNote: "Eixo arterial da margem direita do Rio Pomba no bairro São Félix.",
    sgbReferenceBehaviorNote:
      "0,0% de interseção em COTA_300cm (distância mínima 51,28 m) e COTA_325cm.",
    validationUsageNote:
      "Controle da margem direita para comparar assimetria topográfica entre Centro (margem esquerda) e São Félix (margem direita).",
    eventRecords: [
      {
        eventId: "HIST-2023-01-08",
        state: "unknown",
        evidenceSummary:
          "Sem confirmação pública georreferenciada sobre presença ou ausência de lâmina d'água ao longo dos segmentos da avenida em 08/01/2023.",
        sourceIds: ["DOC-2023-JAN-DECRETO"],
      },
    ],
  },
  {
    id: "CP-PONTE-RAUL-VEIGA",
    name: "Ponte Raul Veiga",
    category: "bridge_or_footbridge",
    neighborhoodOrSector: "Ligação Centro ↔ margem direita sobre o Rio Pomba",
    coordinatesWgs84: null,
    coordinateStatus: "unverified_kept_null",
    coordinateProvenance:
      "Eixo linear auditado no OSM (way/232492952, 169,1 m + way/876431944, 29,3 m, bridge=yes); coordenada pontual mantida nula.",
    featureGeometryNote:
      "Ponte rodoviária principal sobre o canal do Rio Pomba no Centro urbano.",
    sgbReferenceBehaviorNote:
      "100% do vão intercepta o polígono 2D em COTA_300cm e COTA_325cm porque a mancha representa a superfície d'água no canal SOB o tabuleiro elevado.",
    validationUsageNote:
      "Ponto de controle metodológico essencial para evitar falsos positivos viários em projeção 2D (interseção planar no canal != submersão do tabuleiro da ponte).",
    eventRecords: [
      {
        eventId: "HIST-2022-01-08",
        state: "unknown",
        evidenceSummary:
          "Restrição municipal ao tráfego pesado na área central registrada em 12/01/2022, sem confirmação de galgamento do tabuleiro.",
        sourceIds: ["DOC-2022-JAN-J3"],
      },
    ],
  },
  {
    id: "CP-PONTES-PEDESTRES",
    name: "Ponte Alberíades Gabry e Passarela de pedestres central",
    category: "bridge_or_footbridge",
    neighborhoodOrSector: "Travessias urbanas sobre o Rio Pomba",
    coordinatesWgs84: null,
    coordinateStatus: "unverified_kept_null",
    coordinateProvenance:
      "Ponte Alberíades Gabry mapeada no OSM (way/456633979, 239,1 m, ODbL 1.0); coordenada pontual mantida nula.",
    featureGeometryNote: "Travessias urbanas sobre o canal principal do Rio Pomba.",
    sgbReferenceBehaviorNote:
      "99,9%–100% de sobreposição planar 2D sobre o canal já em COTA_300cm/325cm (escoamento sob a estrutura).",
    validationUsageNote:
      "Requer comparação altimétrica da cota inferior da viga/tabuleiro (borda livre) e não simples interseção 2D.",
    eventRecords: [
      {
        eventId: "HIST-2023-01-08",
        state: "unknown",
        evidenceSummary:
          "Monitoramento preventivo das travessias durante o pico de 08/01/2023; galgamento efetivo do piso mantido como desconhecido.",
        sourceIds: ["DOC-2023-JAN-DECRETO"],
      },
    ],
  },
  {
    id: "CP-HOSPITAL-HELIO-MONTEZANO",
    name: "Entorno do Hospital Hélio Montezano de Oliveira",
    category: "critical_facility",
    neighborhoodOrSector: "Equipamento crítico de saúde municipal",
    coordinatesWgs84: null,
    coordinateStatus: "unverified_kept_null",
    coordinateProvenance:
      "Coordenada oficial de acesso viário e cota de soleira ainda não levantadas em base cadastral aberta; mantida nula.",
    featureGeometryNote:
      "Unidade hospitalar de referência municipal sujeita a vulnerabilidade de acessos viários em grandes cheias.",
    sgbReferenceBehaviorNote:
      "Avaliação geométrica condicionada ao levantamento oficial do lote e dos eixos de acesso.",
    validationUsageNote:
      "Prioritário para análise futura de acessibilidade de serviços essenciais (sem emitir recomendação operacional).",
    eventRecords: [
      {
        eventId: "HIST-2026-02-25",
        state: "unknown",
        evidenceSummary:
          "Impactos severos nos serviços públicos municipais registrados no Decreto nº 025/2026; presença de lâmina interna vs. isolamento viário mantida como desconhecida até vistoria técnica.",
        sourceIds: ["DOC-2026-MAR-DECRETO"],
      },
    ],
  },
  {
    id: "CP-RUA-ALBERTO-FREIRE",
    name: "Rua Alberto Freire (Bairro Santa Luzia — Bacia do Rio Pirapetinga)",
    category: "tributary_urban_area",
    neighborhoodOrSector: "Bairro Santa Luzia (divisa com Pirapetinga/MG)",
    coordinatesWgs84: null,
    coordinateStatus: "unverified_kept_null",
    coordinateProvenance:
      "Logradouro identificado nominalmente pela Defesa Civil no evento de jan/2023; coordenada pontual mantida nula.",
    featureGeometryNote:
      "Via urbana sob influência direta do afluente Rio Pirapetinga, fora do eixo modelado unidimensionalmente apenas para o Rio Pomba.",
    sgbReferenceBehaviorNote:
      "Fora da modelagem hidráulica unidimensional exclusiva da calha principal do Rio Pomba — alerta contra falsos negativos por omissão de tributários.",
    validationUsageNote:
      "Controle científico fundamental para demonstrar que cheias reais em Pádua incluem inundações tributárias (Rio Pirapetinga) não representadas pelas manchas estáticas do Rio Pomba.",
    eventRecords: [
      {
        eventId: "HIST-2023-01-08",
        state: "water_present",
        evidenceSummary:
          "Defesa Civil confirmou ao G1 (10/01/2023) que a Rua Alberto Freire, no bairro Santa Luzia, ficou completamente inundada pela cheia do Rio Pirapetinga.",
        sourceIds: ["DOC-2023-JAN-G1-DRONE"],
      },
    ],
  },
] as const;

export type ControlPointValidationOutcome =
  | "true_positive"
  | "false_positive"
  | "false_negative"
  | "true_negative"
  | "unknown_field_evidence"
  | "unverified_coordinates"
  | "scenario_unavailable";

export type ControlPointScenarioEvaluationItem = {
  readonly controlPointId: string;
  readonly controlPointName: string;
  readonly fieldState: ControlPointEvidenceState;
  readonly spatialRelation: "inside" | "boundary" | "outside" | "unavailable" | "not_geocoded";
  readonly outcome: ControlPointValidationOutcome;
};

export type ControlPointScenarioValidationSummary = {
  readonly eventId: string;
  readonly levelCm: number;
  readonly items: readonly ControlPointScenarioEvaluationItem[];
  readonly counts: {
    readonly truePositive: number;
    readonly falsePositive: number;
    readonly falseNegative: number;
    readonly trueNegative: number;
    readonly unknownFieldEvidence: number;
    readonly unverifiedCoordinates: number;
    readonly scenarioUnavailable: number;
  };
};

/**
 * Evaluates cataloged control points against a GeoJSON flood scenario (SGB or
 * future custom model) for a given historical event. Preserves `unknown` and
 * `unverified_coordinates` outside the confusion matrix so missing coordinates
 * or missing field evidence never bias TP/FP/FN/TN metrics.
 */
export function evaluateControlPointsForEventScenario(
  eventId: string,
  scenarioGeojson: FloodAreaInput | null | undefined,
  levelCm: number,
  controlPoints: readonly HistoricalControlPoint[] = HISTORICAL_CONTROL_POINTS,
): ControlPointScenarioValidationSummary {
  const items: ControlPointScenarioEvaluationItem[] = [];
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let trueNegative = 0;
  let unknownFieldEvidence = 0;
  let unverifiedCoordinates = 0;
  let scenarioUnavailable = 0;

  for (const cp of controlPoints) {
    const record = cp.eventRecords.find((r) => r.eventId === eventId);
    const fieldState: ControlPointEvidenceState = record?.state ?? "unknown";

    if (!cp.coordinatesWgs84) {
      unverifiedCoordinates += 1;
      items.push({
        controlPointId: cp.id,
        controlPointName: cp.name,
        fieldState,
        spatialRelation: "not_geocoded",
        outcome: "unverified_coordinates",
      });
      continue;
    }

    const query = evaluatePointAgainstFloodScenario(
      cp.coordinatesWgs84,
      scenarioGeojson,
      levelCm,
    );

    if (query.status !== "valid") {
      scenarioUnavailable += 1;
      items.push({
        controlPointId: cp.id,
        controlPointName: cp.name,
        fieldState,
        spatialRelation: "unavailable",
        outcome: "scenario_unavailable",
      });
      continue;
    }

    if (fieldState === "unknown") {
      unknownFieldEvidence += 1;
      items.push({
        controlPointId: cp.id,
        controlPointName: cp.name,
        fieldState,
        spatialRelation: query.relation,
        outcome: "unknown_field_evidence",
      });
      continue;
    }

    const modelWet = query.isIntercepted;
    const fieldWet = fieldState === "water_present";
    let outcome: ControlPointValidationOutcome;
    if (modelWet && fieldWet) {
      outcome = "true_positive";
      truePositive += 1;
    } else if (modelWet && !fieldWet) {
      outcome = "false_positive";
      falsePositive += 1;
    } else if (!modelWet && fieldWet) {
      outcome = "false_negative";
      falseNegative += 1;
    } else {
      outcome = "true_negative";
      trueNegative += 1;
    }

    items.push({
      controlPointId: cp.id,
      controlPointName: cp.name,
      fieldState,
      spatialRelation: query.relation,
      outcome,
    });
  }

  return {
    eventId,
    levelCm,
    items,
    counts: {
      truePositive,
      falsePositive,
      falseNegative,
      trueNegative,
      unknownFieldEvidence,
      unverifiedCoordinates,
      scenarioUnavailable,
    },
  };
}
