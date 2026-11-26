# Catálogo Histórico Hidrológico e Acervo de Enchentes — Santo Antônio de Pádua (Rio Pomba)

**Frente:** Pádua FloodSim — R02-E (`#52`, Backlog Mestre `#53`)  
**Branch de origem:** `feat/research-r02-flood-history`  
**Versão do catálogo:** `2026.11.26-r02e.2` ([`lib/history/catalog.ts`](../../lib/history/catalog.ts) · [`lib/history/data/historicalCatalog.json`](../../lib/history/data/historicalCatalog.json))  
**Governança:** Programations Engineering Standard 2.0 — Research  
**Classificações de dados presentes:** `observed`, `processed`, `official_reference` e `derived` (**zero `mock` público**)

> **Aviso científico e institucional:** Este catálogo tem finalidade exclusivamente acadêmica e experimental. Nenhum registro, métrica ou exploração espacial aqui documentado substitui os alertas oficiais da Defesa Civil Municipal, do INEA, do SGB/CPRM ou da ANA, nem declara qualquer imóvel ou logradouro seguro.

---

## 1. Escopo, Governança e Inventário Auditado

O módulo **R02-E** transforma os metadados, manifestos hidrológicos e auditorias documentais já produzidos no projeto em um catálogo público determinístico, navegável e rastreável na interface web (`Histórico`), preservando integralmente:

- os manifestos auditados em `data/metadata/hydrology/` (`run_manifest.json`, `candidate_events.json`, `quality_report.json`, `station_inventory.json` e `source_access_audit.json`, **sem qualquer alteração de bytes ou hashes**);
- a auditoria do acervo telemétrico do INEA ([`docs/research/INEA_HISTORICAL_ARCHIVE.md`](./INEA_HISTORICAL_ARCHIVE.md)) e o inventário consolidado ([`docs/research/RESEARCH_CATALOG_2026-11-25.md`](./RESEARCH_CATALOG_2026-11-25.md));
- a auditoria geométrica de feições urbanas de controle ([`docs/research/MUNICIPAL_NEIGHBORHOOD_BOUNDARIES.md`](./MUNICIPAL_NEIGHBORHOOD_BOUNDARIES.md));
- relatórios técnicos oficiais do SGB/CPRM (`doc/25035`, `doc/24903`, `doc/23915`, `doc/22818`), atos normativos da Prefeitura Municipal de Santo Antônio de Pádua (`Decretos nº 004/2022`, `002/2023` e `025/2026`), dissertação acadêmica (Simiqueli, 2024) e reportagens verificadas com autoria e localização identificáveis.

Nenhuma reaquisição histórica em massa foi executada e nenhum arquivo bruto não autorizado foi incluído no repositório Git.

---

## 2. Separação entre Inundações Urbanas Documentadas, Base Documental e Eventos Hidrológicos Elevados

Nem toda superação de cota hidrométrica comprova extravasamento urbano documentado em ruas e imóveis. O catálogo separa explicitamente duas classes principais e explicita o nível da base documental (`documentaryBasisLevel`):

1. **`documented_urban_flood` (6 eventos):**
   - **Base institucional primária (`primary_official_act_and_report` — 4 eventos):** `HIST-2012-01-04`, `HIST-2022-01-08`, `HIST-2023-01-08` e `HIST-2026-02-25` (sustentados por decretos municipais oficiais com hash SHA-256 e/ou relatórios técnicos descritivos do SGB).
   - **Base jornalística secundária citando Defesa Civil / SEDEC-RJ (`secondary_press_citing_civil_defense` — 2 eventos):** `HIST-2020-01-25` e `HIST-2022-02-04` (sustentados por superação hidrométrica combinada a cobertura de imprensa citando Defesa Civil/SEDEC-RJ, sem decreto municipal específico localizado no portal oficial).
2. **`elevated_hydrological_event` (`hydrological_telemetry_only` — 7 eventos):** eventos em que a régua `RHN 58790002` superou os limiares operacionais do SAH-Pomba (`>= 275 cm` Alerta ou `>= 310 cm` Inundação), mas para os quais **não há comprovação documental de inundação de vias urbanas** no período específico (incluindo o caso emblemático de **13–19/02/2020**, com `408,0 cm` na telemetria).

### 2.1 Síntese reconciliada dos 13 eventos catalogados (2012–2026)

Os 12 eventos pós-2020 coincidem integralmente com `data/metadata/hydrology/candidate_events.json` em picos, timestamps `UTC`, contagens de leituras e extensão da janela mesclada:

| ID determinístico | Manifesto `EXP-2026-001` | Janela (`ISO`) | Classe / Nível documental | Pico `RHN 58790002` (`cm`) e instante | Pico `INEA 213042120` (`m`) e instante | Pico `58788600` Braúna (`cm`) | Pico `58770000` Cataguases (`cm`) | Status no mapa SGB |
|---|---|---|---|---:|---:|---:|---:|---|
| `HIST-2012-01-04` | — *(pré-2020)* | `2012-01-02` a `2012-01-06` | `documented_urban_flood` *(primária)* | `450,0` (`2012-01-04`, diário) | `6,91` (`2012-01-04 01:15` local, DST) | Não disp. | `910,0` (`2012-01-03`) | **Associação bloqueada** *(exploração indep. `4,50 m`)* |
| `HIST-2020-01-25` | `EVT-20200125-02` | `2020-01-25` a `2020-02-08` | `documented_urban_flood` *(imprensa sec.)* | `398,5` (`2020-01-26T17:15Z`; `383` SAH) | Não extraído | `530,0` | `860,09` | **Associação bloqueada** *(exploração indep. `4,00 m` / `3,75×4,00`)* |
| `HIST-2020-02-13` | `EVT-20200213-03` | `2020-02-13` a `2020-02-19` | `elevated_hydrological_event` | `408,0` (`2020-02-15T10:30Z`; `407` SAH) | Não extraído | `492,0` *(49,7% cob., inut.)* | `823,42` | **Associação bloqueada** *(exploração indep. `4,00 m` / `4,00×4,25`)* |
| `HIST-2020-02-28` | `EVT-20200228-04` | `2020-02-28` a `2020-03-08` | `elevated_hydrological_event` | `369,0` (`2020-03-06T20:30Z`; `372` SAH) | Não extraído | `483,0` | `758,39` | **Associação bloqueada** *(exploração indep. `3,75 m` / `3,50×3,75`)* |
| `HIST-2022-01-08` | `EVT-20220108-11` | `2022-01-08` a `2022-01-14` | `documented_urban_flood` *(primária)* | `423,0` (`2022-01-11T10:00Z`; `425` SAH) | `6,452` (`2022-01-11 07:15 GMT`) | `528,0` | `762,0` | **Associação bloqueada** *(exploração indep. `4,25 m` / `4,00×4,25`)* |
| `HIST-2022-02-04` | `EVT-20220204-12` | `2022-02-04` a `2022-02-27` | `documented_urban_flood` *(imprensa sec.)* | `365,0` (`2022-02-16T15:45Z`) | `5,516` (`2022-02-16 15:00 GMT`) | `473,0` | `644,0` | **Associação bloqueada** *(exploração indep. `3,75 m` / `3,50×3,75`)* |
| `HIST-2023-01-08` | `EVT-20221231-27` | `2022-12-31` a `2023-01-16` | `documented_urban_flood` *(primária)* | `428,0` (`2023-01-08T12:45Z`; `431` Mancha) | **Lacuna crítica** | **Flatline 81,08%** | `780,0` | **Associação bloqueada** *(exploração indep. `4,25 m` / `4,25×4,50`)* |
| `HIST-2023-01-21` | `EVT-20230121-28` | `2023-01-21` a `2023-01-27` | `elevated_hydrological_event` | `337,0` (`2023-01-26T14:45Z`) | `5,238` (`2023-01-26 13:30 GMT`) | **Flatline 92,4%** | `583,45` | **Associação bloqueada** *(exploração indep. `3,25 m` / `3,25×3,50`)* |
| `HIST-2025-12-17` | `EVT-20251217-36` | `2025-12-17` a `2025-12-19` | `elevated_hydrological_event` | `310,76` (`2025-12-18T15:15Z`; `312` máx. anual) | Não extraído | `381,0` | `514,41` | **Associação bloqueada** *(exploração indep. `3,00 m` / `3,00×3,25`)* |
| `HIST-2026-02-05` | `EVT-20260205-37` | `2026-02-05` a `2026-02-11` | `elevated_hydrological_event` | `294,7` (`2026-02-09T23:45Z`, Alerta) | Não extraído | `335,0` | `403,84` | **Bloqueada** *(`< 300 cm`)* |
| `HIST-2026-02-25` | `EVT-20260225-38` | `2026-02-25` a `2026-03-02` | `documented_urban_flood` *(primária)* | `412,0` (`2026-02-28T18:30Z`) | `6,314` (`2026-02-28 17:15 GMT`) | `560,0` | `815,99` | **Associação bloqueada** *(exploração indep. `4,00 m` / `4,00×4,25`)* |
| `HIST-2026-03-14` | `EVT-20260314-39` | `2026-03-14` a `2026-03-15` | `elevated_hydrological_event` | `298,0` (`2026-03-15T02:45Z`, Alerta) | Não extraído | `373,0` | `423,0` | **Bloqueada** *(`< 300 cm`)* |
| `HIST-2026-03-21` | `EVT-20260321-40` | `2026-03-21` a `2026-03-23` | `elevated_hydrological_event` | `296,0` (`2026-03-22T09:00Z`, Alerta) | Não extraído | `352,0` | `427,0` | **Bloqueada** *(`< 300 cm`)* |

---

## 3. Semântica Auditada de Duração dos Eventos (`duration_above_threshold_hours`)

Em [`scripts/research/hydrology/events.py`](../../scripts/research/hydrology/events.py), `duration_above_threshold_hours` é calculado como `(end_utc - start_utc)` após agrupar leituras `>= 240 cm` separadas por até `merge_gap_hours = 72,0 h`. Portanto, esse campo representa a **extensão da janela mesclada (`mergedWindowSpanHours`)**, e **não** necessariamente permanência ininterrupta acima do limiar.

O contrato [`StationThresholdDuration`](../../lib/history/contract.ts) separa explicitamente quatro grandezas para cada evento de `RHN 58790002` (passo nominal $\Delta t = 15\text{ min} = 0,25\text{ h}$):

| Evento (`candidateEventId`) | Janela mesclada (`end - start`) | Leituras `>= 240 cm` (`n`) | Suporte amostral nominal (`n × 0,25 h`) | Passos `< 240 cm` ou em lacuna | Duração contínua efetivamente comprovada |
|---|---:|---:|---:|---:|---|
| `HIST-2020-01-25` (`EVT-20200125-02`) | `337,5 h` (`1.351` passos) | `796` | `199,0 h` | `555` (`138,75 h` nom.) | Não comprovada continuamente *(janela mesclada)* |
| `HIST-2020-02-13` (`EVT-20200213-03`) | `142,25 h` (`570` passos) | `467` | `116,75 h` | `103` (`25,75 h` nom.) | Não comprovada continuamente *(janela mesclada)* |
| `HIST-2020-02-28` (`EVT-20200228-04`) | `212,0 h` (`849` passos) | `849` | `212,25 h` | **`0`** | **`212,0 h` comprovadas** (`100%` dos passos) |
| `HIST-2022-01-08` (`EVT-20220108-11`) | `153,75 h` (`616` passos) | `616` | `154,0 h` | **`0`** | **`153,75 h` comprovadas** (`100%` dos passos) |
| `HIST-2022-02-04` (`EVT-20220204-12`) | `564,0 h` (`2.257` passos) | `1.444` | `361,0 h` | `813` *(inclui lacuna `23,25 h`)* | Não comprovada continuamente *(janela mesclada)* |
| `HIST-2023-01-08` (`EVT-20221231-27`) | `370,75 h` (`1.484` passos) | `1.162` | **`290,5 h`** | `322` (`80,5 h` nom.) | Não comprovada continuamente *(janela mesclada)* |
| `HIST-2023-01-21` (`EVT-20230121-28`) | `151,25 h` (`606` passos) | `304` | `76,0 h` | `302` (`75,5 h` nom.) | Não comprovada continuamente *(janela mesclada)* |
| `HIST-2025-12-17` (`EVT-20251217-36`) | `39,75 h` (`160` passos) | `160` | `40,0 h` | **`0`** | **`39,75 h` comprovadas** (`100%` dos passos) |
| `HIST-2026-02-05` (`EVT-20260205-37`) | `121,5 h` (`487` passos) | `357` | `89,25 h` | `130` (`32,5 h` nom.) | Não comprovada continuamente *(janela mesclada)* |
| `HIST-2026-02-25` (`EVT-20260225-38`) | `111,5 h` (`447` passos) | `443` | `110,75 h` | `4` (`1,0 h` nom.) | Não comprovada continuamente *(janela mesclada)* |
| `HIST-2026-03-14` (`EVT-20260314-39`) | `22,5 h` (`91` passos) | `91` | `22,75 h` | **`0`** | **`22,5 h` comprovadas** (`100%` dos passos) |
| `HIST-2026-03-21` (`EVT-20260321-40`) | `34,25 h` (`138` passos) | `138` | `34,5 h` | **`0`** | **`34,25 h` comprovadas** (`100%` dos passos) |

- **Proibição de comparar somas anuais/sazonais como duração individual:** os acumulados publicados nos Relatórios Anuais SAH-Pomba (`246 h >= 310 cm` em jan–fev/2022 e `188 h >= 310 cm` no ciclo 2022/2023) recebem `aggregationScope: "multi_event_or_annual_aggregate"` e são **incondicionalmente excluídos** de [`compareHistoricalEventsOnStation`](../../lib/history/analysis.ts). A diferença `Δ duração` só é calculada quando ambos os eventos possuem `provenContinuousHours` não nulo no mesmo limiar.

---

## 4. Independência entre Referências Hidrológicas, Agregados Mensais/Anuais e Divergências

### 4.1 Cinco referências hidrológicas estritamente separadas

1. **`RHN-58790002` — Santo Antônio de Pádua II (ANA / SGB-CPRM):** zero `79,709 m` (`hgeoHNOR_IMBITUBA`, GPS geodésico SGB set/2024), unidade nativa `cm`, limiares `240 / 275 / 310 cm`. Coordenadas divergentes em `2,415 km` entre ANA (`-21,5422, -42,1806`) e Tabela 1 do SAH-Pomba 2024 (`-21,5375, -42,1578`).
2. **`INEA-213042120` — Santo Antônio de Pádua (INEA / ANA FLU `58774000` / ANA PLU `2141094`):** instalada ~`6 km` a montante (`-21,51122, -42,20767`), unidade nativa `m`, transbordo `5,00 m`, datum vertical **não confirmado**. Diferença empírica nos picos frente à `58790002`: `+2,41 m` (jan/2012), `+2,22 m` (jan/2022), `+1,87 m` (fev/2022) e `+2,19 m` (fev/2026) — inexistindo offset constante.
3. **`RHN-58788600` — UHE Barra do Braúna Jusante (BRAÚNA / ANA):** estação horária em Recreio/MG sujeita a *flatlines* (`81,08%` e `92,4%` em jan/2023).
4. **`RHN-58770000` — Cataguases (ANA / SGB-CPRM):** estação de bacia superior (`5.880 km²`) para contexto de propagação de cheia.
5. **`INEA-58789000` — Ponte Paraoquena (INEA `BE7176FE`):** inventariada sem extração histórica (`inventory_only_not_audited`).

### 4.2 Separação entre métricas específicas do evento e agregados mensais/anuais

- **Cobertura temporal (`coveragePct` vs. `periodAggregateNote`):** percentuais mensais ou anuais (`99,97%` em jan/2022, `99,96%` em fev/2022, `43,1%` em jan/2023 e `54,39%` em 2020 na planilha INEA; completudes anuais de `quality_report.json`) são exibidos exclusivamente em `periodAggregateNote`, sem serem atribuídos como cobertura da janela curta do evento (`coveragePct: null` salvo quando `100%` dos passos da janela/mês completo estão comprovadamente presentes ou quando `candidate_events.json` publica `coverage_pct` específico da janela em `58788600` e `58770000`).
- **Vazão máxima (`peakDischargeM3s` vs. `yearly.max`):** `peakDischargeM3s` é preenchido **apenas** quando `quality_report.json` (`top_10_peaks`) confirma o timestamp exato dentro do evento (`1.287,9 m³/s` em `2023-01-08T12:45Z` para `58790002`; `1.017,74 m³/s` em `2026-02-28T15:00Z` para `58788600`; `1.166,25 m³/s` em `2026-02-27T22:00Z` para `58770000`). Máximos anuais sem timestamp individual (`yearly[YYYY].max`) permanecem apenas como nota contextual (`peakDischargeM3s: null`).
- **Timestamps e fuso horário:** séries RHN `2020–2026` em `UTC`; planilha INEA `2015–2026` comprovada como `UTC+0` genuíno pelo confronto com o Decreto Municipal nº `025/2026` (`6,31 m` às `14:15 BRT` = `17:15 GMT` em `28/02/2026`); planilha INEA `2012` preservada sem conversão silenciosa para `UTC` (`hasDstAmbiguity: true`, `BRST UTC−2` vs. `UTC−3`).

---

## 5. Continuidade Vertical e Regras de Associação ao Mapa SGB

A auditoria de `datumContinuityVerified` em `2012–2026` estabelece que:

1. Em `2020–2025`, `quality_report.json` (`conventional_vs_telemetric_58790002`, mediana anual `0,0 a 2,0 cm`) demonstra consistência interna entre o sensor telemétrico e a régua convencional local, **mas não substitui um histórico oficial de nivelamento de RNs** que comprove invariância geodésica do zero `79,709 m` (`hgeoHNOR_IMBITUBA`, medido pelo SGB em set/2024), sobretudo diante da divergência cadastral de `2,415 km` entre coordenadas ANA e SGB.
2. Em `2012` (pico documental pré-2020) e em `2026` (telemetria operacional pós-2024 ainda sem série convencional consistida publicada), tampouco há documento de nivelamento por período.
3. Consequentemente, **todos os 13 registros atuais mantêm `datumContinuityVerified: false`**.

A função [`resolveHistoricalMapAssociation`](../../lib/history/analysis.ts) exige cumulativamente `RHN-58790002` utilizável, `300 <= pico <= 550 cm`, `datumContinuityVerified === true` **e** `datumContinuityEvidence` não vazia:
- Na ausência de evidência específica por período, **a associação histórica permanece bloqueada (`status: "blocked"`, `historicalEquivalenceConfirmed: false`)** com mensagem dinâmica generalizada para o período e cota do evento (nunca pressupondo que todo bloqueio seja de 2012).
- Para eventos de `RHN 58790002` cujo valor nominal cai entre `300` e `550 cm`, oferece-se apenas **exploração independente de cenário estático SGB** (cota discreta mais próxima ou comparação derivada `A × B`, sem interpolar manchas), exibindo no mapa aviso explícito de que **a equivalência altimétrica histórica NÃO está confirmada** e que a camada **não representa inundação observada**.

---

## 6. Hidrogramas Contínuos e Replay Temporal (`BLOCKED_LOCAL_DATA`)

O motor [`lib/history/hydrograph.ts`](../../lib/history/hydrograph.ts) e o componente [`HistoricalHydrographViewer.tsx`](../../components/history/HistoricalHydrographViewer.tsx) preservam lacunas sem interpolação, recusam `< 2` pontos (`insufficient_points_no_fabrication`) e suportam cursor e replay (`1×–8×`). Como os CSVs/XLSX brutos permanecem fora do Git (`BLOCKED_LOCAL_DATA`) e sujeitos às confirmações `#6`, `#37` e `#46`, nenhuma série sintética é fabricada e a UI pública mantém transparência explícita sobre o bloqueio.

---

## 7. Validação Espacial e Pontos de Controle (`lib/history/controlPoints.ts`)

Foram estruturados **10 pontos de controle** (`CP-MONSENHOR-DINIZ`, `CP-ILHA-CONVIVENCIA`, `CP-BEIRA-RIO-SENAR`, `CP-PRACA-PEREIRA-LIMA`, `CP-RUA-CORONEL-OLIVIER`, `CP-AV-CHAIM-ELIAS`, `CP-PONTE-RAUL-VEIGA`, `CP-PONTES-PEDESTRES`, `CP-HOSPITAL-HELIO-MONTEZANO` e `CP-RUA-ALBERTO-FREIRE` na bacia do Rio Pirapetinga).

A função [`evaluateControlPointsForEventScenario`](../../lib/history/controlPoints.ts) aplica **6 travas obrigatórias** antes de produzir qualquer contagem `TP / FP / FN / TN`:
1. coordenada cartograficamente auditada (`verified_cartographic`);
2. geometria válida do cenário;
3. polígono validado do domínio hidráulico (`hydraulicDomainStatus === "covered"`, recusando o mero envelope retangular auxiliar do MapServer);
4. compatibilidade temporal, altimétrica (`datumContinuityVerified` + evidência) e de cota (`maxStageCompatibilityDiffCm = 0` por padrão);
5. estado documental de inundação conhecido (`water_present` ou `water_absent` com `sourceIds`);
6. pontos na faixa de proximidade geométrica da fronteira (`±0,5 m`, `relation === "boundary"`) são classificados estritamente como **indeterminados (`indeterminate_boundary_proximity`)**.

Conforme auditado por [`summarizeControlPointsReadiness`](../../lib/history/controlPoints.ts), **existem atualmente `0` pares utilizáveis simultaneamente com coordenada auditada e estado de inundação conhecido** (`2` pontos com coordenada auditada e estado `unknown`; `5` registros com `water_present` e coordenada pontual mantida `null`). **Nenhuma métrica de desempenho espacial (precisão, revocação, F1, acurácia ou IoU) é calculada ou publicada.**
