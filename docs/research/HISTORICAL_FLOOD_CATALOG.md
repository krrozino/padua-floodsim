# Catálogo Histórico Hidrológico e Acervo de Enchentes — Santo Antônio de Pádua (Rio Pomba)

**Frente:** Pádua FloodSim — R02-E (`#52`, Backlog Mestre `#53`)  
**Branch de origem:** `feat/research-r02-flood-history`  
**Versão do catálogo:** `2026.11.26-r02e.1` ([`lib/history/catalog.ts`](../../lib/history/catalog.ts))  
**Governança:** Programations Engineering Standard 2.0 — Research  
**Classificações de dados presentes:** `observed`, `processed`, `official_reference` e `derived` (**zero `mock` público**)

> **Aviso científico e institucional:** Este catálogo tem finalidade exclusivamente acadêmica e experimental. Nenhum registro, métrica ou associação espacial aqui documentado substitui os alertas oficiais da Defesa Civil Municipal, do INEA, do SGB/CPRM ou da ANA, nem declara qualquer imóvel ou logradouro seguro.

---

## 1. Escopo, Governança e Inventário Auditado

O módulo **R02-E** transforma os metadados, manifestos hidrológicos e auditorias documentais já produzidos no projeto em um catálogo público determinístico, navegável e rastreável na interface web (`Histórico`), preservando integralmente:

- os manifestos auditados em `data/metadata/hydrology/` (`run_manifest.json`, `candidate_events.json`, `quality_report.json`, `station_inventory.json` e `source_access_audit.json`, **sem qualquer alteração de bytes ou hashes**);
- a auditoria do acervo telemétrico do INEA ([`docs/research/INEA_HISTORICAL_ARCHIVE.md`](./INEA_HISTORICAL_ARCHIVE.md)) e o inventário consolidado ([`docs/research/RESEARCH_CATALOG_2026-11-25.md`](./RESEARCH_CATALOG_2026-11-25.md));
- a auditoria geométrica de feições urbanas de controle ([`docs/research/MUNICIPAL_NEIGHBORHOOD_BOUNDARIES.md`](./MUNICIPAL_NEIGHBORHOOD_BOUNDARIES.md));
- relatórios técnicos oficiais do SGB/CPRM (`doc/25035`, `doc/24903`, `doc/23915`, `doc/22818`), atos normativos da Prefeitura Municipal de Santo Antônio de Pádua (`Decretos nº 004/2022`, `002/2023` e `025/2026`), dissertação acadêmica (Simiqueli, 2024) e reportagens verificadas com autoria e localização identificáveis.

Nenhuma reaquisição histórica em massa foi executada e nenhum arquivo bruto não autorizado foi incluído no repositório Git.

---

## 2. Separação entre Inundações Urbanas Documentadas e Eventos Hidrológicos Elevados

Nem toda superação de cota hidrométrica comprova extravasamento urbano documentado em ruas e imóveis. O catálogo separa explicitamente duas classes:

1. **`documented_urban_flood` (6 eventos):** eventos com evidência documental independente de inundação urbana em Santo Antônio de Pádua (decretos municipais de situação de emergência/gabinete de crise, relatórios da Defesa Civil, relatórios descritivos do SGB ou registros fotográficos/jornalísticos verificados).
2. **`elevated_hydrological_event` (7 eventos):** eventos em que a régua `RHN 58790002` superou os limiares operacionais do SAH-Pomba (`>= 275 cm` Alerta ou `>= 310 cm` Inundação), mas para os quais **não há comprovação documental primária de inundação de vias urbanas** no período específico (incluindo o caso emblemático de **fevereiro de 2020**, com `408,0 cm` na telemetria).

### 2.1 Síntese dos 13 eventos catalogados (2012–2026)

| ID determinístico | Manifesto `EXP-2026-001` | Janela (`ISO`) | Classe documental | Pico `RHN 58790002` (`cm`) | Pico `INEA 213042120` (`m`) | Pico `58788600` Braúna (`cm`) | Pico `58770000` Cataguases (`cm`) | Associação ao mapa SGB |
|---|---|---|---|---:|---:|---:|---:|---|
| `HIST-2012-01-04` | — *(pré-2020)* | `2012-01-02` a `2012-01-06` | `documented_urban_flood` | `450,0` *(Tab. 5 SAH)* | `6,91` *(local, DST)* | Não disp. | `910,0` *(Tab. 4 SAH)* | **Bloqueada** *(continuidade pré-2020 do zero não confirmada)* |
| `HIST-2020-01-25` | `EVT-20200125-02` | `2020-01-25` a `2020-02-08` | `documented_urban_flood` | `398,5` *(383 SAH)* | Não extraído | `530,0` | `860,09` | Compatível (`4,00 m` aprox.; `3,75 × 4,00 m`) |
| `HIST-2020-02-13` | `EVT-20200213-03` | `2020-02-13` a `2020-02-19` | `elevated_hydrological_event` | `408,0` *(407 SAH)* | Não extraído | `492,0` *(49,7% cob., inut.)* | `823,42` | Compatível (`4,00 m` aprox.; `4,00 × 4,25 m`) |
| `HIST-2020-02-28` | `EVT-20200228-04` | `2020-02-28` a `2020-03-08` | `elevated_hydrological_event` | `369,0` *(372 SAH)* | Não extraído | `483,0` | `758,39` | Compatível (`3,75 m` aprox.; `3,50 × 3,75 m`) |
| `HIST-2022-01-08` | `EVT-20220108-11` | `2022-01-08` a `2022-01-14` | `documented_urban_flood` | `423,0` *(425 SAH)* | `6,452` | `528,0` | `762,0` | Compatível (`4,25 m` aprox.; `4,00 × 4,25 m`) |
| `HIST-2022-02-04` | `EVT-20220204-12` | `2022-02-04` a `2022-02-27` | `documented_urban_flood` | `365,0` *(lacuna 23,25 h)* | `5,516` | `473,0` | `644,0` | Compatível (`3,75 m` aprox.; `3,50 × 3,75 m`) |
| `HIST-2023-01-08` | `EVT-20221231-27` | `2022-12-31` a `2023-01-16` | `documented_urban_flood` | `428,0` *(431 Mancha)* | **Lacuna crítica** | **Flatline 81,1%** | `780,0` | Compatível (`4,25 m` aprox.; `4,25 × 4,50 m`) |
| `HIST-2023-01-21` | `EVT-20230121-28` | `2023-01-21` a `2023-01-27` | `elevated_hydrological_event` | `337,0` | `5,238` | **Flatline 92,4%** | `583,45` | Compatível (`3,25 m` aprox.; `3,25 × 3,50 m`) |
| `HIST-2025-12-17` | `EVT-20251217-36` | `2025-12-17` a `2025-12-19` | `elevated_hydrological_event` | `310,76` *(312 diário)* | Não extraído | `381,0` | `514,41` | Compatível (`3,00 m` aprox.; `3,00 × 3,25 m`) |
| `HIST-2026-02-05` | `EVT-20260205-37` | `2026-02-05` a `2026-02-11` | `elevated_hydrological_event` | `294,7` *(Alerta)* | Não extraído | `335,0` | `403,84` | **Bloqueada** *(`< 300 cm`)* |
| `HIST-2026-02-25` | `EVT-20260225-38` | `2026-02-25` a `2026-03-02` | `documented_urban_flood` | `412,0` | `6,314` | `560,0` | `815,99` | Compatível (`4,00 m` aprox.; `4,00 × 4,25 m`) |
| `HIST-2026-03-14` | `EVT-20260314-39` | `2026-03-14` a `2026-03-15` | `elevated_hydrological_event` | `298,0` *(Alerta)* | Não extraído | `373,0` | `423,0` | **Bloqueada** *(`< 300 cm`)* |
| `HIST-2026-03-21` | `EVT-20260321-40` | `2026-03-21` a `2026-03-23` | `elevated_hydrological_event` | `296,0` *(Alerta)* | Não extraído | `352,0` | `427,0` | **Bloqueada** *(`< 300 cm`)* |

---

## 3. Independência entre Referências Hidrológicas, Fuso Horário e Divergências Auditadas

### 3.1 Cinco referências hidrológicas estritamente separadas

1. **`RHN-58790002` — Santo Antônio de Pádua II (ANA / SGB-CPRM):** zero da régua `79,709 m` (`hgeoHNOR_IMBITUBA`, GPS geodésico SGB 2024), unidade nativa `cm`, limiares SGB `240 cm` (atenção), `275 cm` (alerta) e `310 cm` (inundação/1º dano). Coordenadas divergentes em `2,415 km` entre ANA (`-21,5422, -42,1806`) e Tabela 1 do SAH-Pomba 2024 (`-21,5375, -42,1578`).
2. **`INEA-213042120` — Santo Antônio de Pádua (INEA / ANA FLU `58774000` / ANA PLU `2141094`):** instalada ~`6 km` a montante do centro (`-21,51122, -42,20767`), unidade nativa `m`, alerta máximo `4,00 m` e transbordo `5,00 m`. Zero da régua grafado `83299` (`~83,299 m`) na Ficha Descritiva, porém datum vertical **não confirmado**. Diferença empírica nos picos históricos frente à `58790002`: `+2,41 m` em jan/2012 (`6,91 m` vs. `4,50 m`), `+2,22 m` em jan/2022 (`6,452 m` vs. `4,23 m`), `+1,87 m` em fev/2022 (`5,516 m` vs. `3,65 m`) e `+2,19 m` em fev/2026 (`6,314 m` vs. `4,12 m`) — provando que **não existe offset constante simples** entre as duas seções.
3. **`RHN-58788600` — UHE Barra do Braúna Jusante (BRAÚNA / ANA):** estação horária a montante em Recreio/MG; sujeita a travamentos prolongados (*flatlines*) que exigem bloqueio automático por evento.
4. **`RHN-58770000` — Cataguases (ANA / SGB-CPRM):** estação de cabeceira/médio Rio Pomba (`5.880 km²`), utilizada como referência de propagação de onda de cheia (~`20–24 h` de antecedência até Pádua).
5. **`INEA-58789000` — Ponte Paraoquena (INEA `BE7176FE` / ANA PLU `2142083`):** mantida no inventário de estações independentes, sem séries históricas extraídas nesta etapa (`inventory_only_not_audited`).

### 3.2 Regras de timestamps, fuso horário e horário de verão (DST)

- **Séries RHN normalizadas (`2020–2026`):** armazenadas em `UTC` (`Z`) e exibidas em `BRT (UTC−3)`, sem ambiguidade de horário de verão (extinto no Brasil em 2019).
- **Planilha INEA `2015–2026` (`Data e Hora (GMT)`):** o confronto independente entre o **Decreto Municipal nº 025/2026** (*pico de `6,31 m` às `14:15` de `28/02/2026`*) e a aba `2026` de `Santo Antonio de Pádua.xlsx` (`6,314 m` em `2026-02-28 17:15 GMT`) **comprova documentalmente** que os registros `Data e Hora (GMT)` de `2015–2026` estão em **UTC+0 genuíno** (`17:15 GMT − 3 h = 14:15 BRT`). Artefatos de serial Excel (`02:29` para `:30`) são preservados literalmente com nota explícita.
- **Planilha INEA `2011–2014` (`DATA E HORA ` sem GMT):** em `2012-01-04 01:15`, vigorava o horário brasileiro de verão (`BRST`, `UTC−2`). Como o INEA não documenta se o datalogger aplicava `UTC−2` ou `UTC−3` fixo, [`buildHistoricalTimestamp`](../../lib/history/normalize.ts) preserva `utcIso: null` e `hasDstAmbiguity: true`, proibindo conversão silenciosa.

### 3.3 Divergências e lacunas críticas documentadas

1. **Janeiro de 2023 em `RHN 58790002` (`428 cm` vs. `431 cm`):** a telemetria de 15 min (`2023-01-08T12:45Z..16:45Z`), a série diária convencional (`07h BRT`) e os Relatórios Anuais SAH-Pomba 2023 (`doc/23915`) e 2024 (`doc/24903`, Tabela 5) registram **`428,0 cm`**, enquanto o texto do Relatório de Mancha SGB (set/2024, `doc/25035`, p. 12) cita **`431 cm`**. Ambos os valores são exibidos lado a lado sem supressão.
2. **Lacuna total no INEA `213042120` em `01–18/01/2023`:** perda de `1.694` registros por erro na extração da memória interna do modem. O máximo aparente da aba `2023` (`5,238 m` em `26/01/2023 13:30 GMT`) pertence ao segundo pulso (`HIST-2023-01-21`) e nunca é atribuído a `08/01/2023`.
3. **Travamento (*flatline*) em Barra do Braúna (`58788600`) em jan/2023:** `81,08%` de leituras constantes em `HIST-2023-01-08` e `92,4%` em `HIST-2023-01-21`; ambos marcados como `usableForComparison: false`.
4. **Lacuna de `23,25 h` em `58790002` durante fev/2022 (`HIST-20220204`):** interrupção entre `2022-02-10T17:30Z` e `2022-02-11T16:45Z` dentro da janela mesclada de `564 h`.
5. **Valores negativos espúrios no INEA em jan–fev/2022:** `7` leituras negativas (`−0,769 m` em jan/2022; `−0,229 m` em fev/2022), rejeitadas automaticamente por [`normalizeStageReadingToCm`](../../lib/history/normalize.ts).

---

## 4. Hidrogramas Contínuos e Replay Temporal (`BLOCKED_LOCAL_DATA`)

O motor desacoplado [`lib/history/hydrograph.ts`](../../lib/history/hydrograph.ts) e o visualizador [`HistoricalHydrographViewer.tsx`](../../components/history/HistoricalHydrographViewer.tsx) implementam integralmente:

- segmentação contígua sem interpolação através de lacunas (`dt > 2 × cadência nominal`), destacando visualmente os intervalos sem medição;
- recusa estrita de séries com `< 2` medições válidas (`insufficient_points_no_fabrication`), impedindo fabricar hidrogramas a partir de picos isolados;
- extração de mínimo, máximo, marcador de pico, limiares próprios da estação e chuva compatível;
- seleção de subintervalo e cursor temporal com reprodução (`1×`, `2×`, `4×`, `8×`) e pausa, sinalizando `LACUNA TELEMÉTRICA` quando o cursor cruza uma falha de transmissão.

**Situação operacional na interface pública:** como os arquivos processados (`data/processed/hydrology/*.csv`) e brutos (`Santo Antonio de Pádua.xlsx`) não estão versionados no Git nem montados no ambiente cloud (`BLOCKED_LOCAL_DATA`), e as autorizações formais de redistribuição de séries contínuas (`#6` ANA HidroWebService, `#37` redistribuição RHN/ANA, `#46` termos `Orientações_Drive.pdf` do INEA) permanecem em aberto, a interface pública entrega o catálogo documental completo, omite controles mortos e exibe transparência explícita sobre o bloqueio, mantendo a ativação das séries contínuas registrada no backlog (`#52` / `#53`).

---

## 5. Associação ao Mapa Histórico e Taxonomia Espacial

A função [`resolveHistoricalMapAssociation`](../../lib/history/analysis.ts) aplica quatro regras cumulativas antes de permitir vínculo com o mapa:

1. existência de medição verificada e utilizável na estação **`RHN-58790002`**;
2. continuidade altimétrica verificada com o nivelamento geodésico de 2024 (`79,709 m`, `hgeoHNOR_IMBITUBA`) — o que bloqueia `HIST-2012-01-04` por precaução científica até confirmação institucional;
3. pico observado dentro do intervalo discreto publicado pelo SGB (`300 cm <= pico <= 550 cm`), bloqueando pulsos de Alerta `< 300 cm` sem extrapolação;
4. proibição absoluta de interpolar novas manchas poligonais entre cotas de 25 cm.

Sempre que um evento compatível é aberto no mapa, o painel exibe um aviso contextual distinguindo explicitamente:
- **Inundação observada:** polígono medido em campo/sensoriamento durante o evento (indisponível no acervo vetorial atual);
- **Extensão oficial modelada:** camada estática HEC-RAS 1D publicada pelo SGB (2024);
- **Representação derivada:** comparação topológica `A × B` entre as duas cotas SGB adjacentes que enquadram o pico observado (ex.: `4,25 × 4,50 m` para `428 cm` em jan/2023; `4,00 × 4,25 m` para `412 cm` em fev/2026);
- **Cenário aproximado:** cota discreta SGB mais próxima na mesma estação e datum (`4,25 m` para `428 cm`; `4,00 m` para `412 cm`).

Se o usuário alterar manualmente a cota ou o modo no mapa, o vínculo histórico é automaticamente encerrado para evitar associação enganosa.

---

## 6. Acervo Documental, Checksums SHA-256 e Direitos de Terceiros

| ID de procedência / evidência | Documento / Fonte | Versão / Data | Tamanho (B) | SHA-256 verificado | Condição de uso / redistribuição |
|---|---|---|---:|---|---|
| `PROV-EXP-2026-001` | `data/metadata/hydrology/candidate_events.json` (+ `quality_report.json`) | `2026-11-25` | `48.064` | `5af9962c21dd2de3e777378e82bd6b6b5dafcbf969babfb8a98fea82b8de881d` | Metadados versionados no repositório; brutos fora do Git. |
| `PROV-SGB-MANCHA-2024` | Relatório Mancha SGB (`doc/25035`) | Set/2024 | `1.001.842` | `e7bdaae296dc5ce9424fa3df9e30e531721018aec7174cfed154f7e6d4e9aa1a` | Reprodução permitida desde que mencionada a fonte (SGB). |
| `PROV-SGB-SAH-2024` | Relatório Anual SAH-Pomba 2024 (`doc/24903`) | Jul/2024 | `2.012.533` | `ccf4b2f01af2b3e9b6f60d66435ea9e8b320933b21d97002633d77981f5ba593` | Reprodução de tabelas permitida mediante citação ao SGB. |
| `PROV-SGB-SAH-2023` | Relatório Anual SAH-Pomba 2023 (`doc/23915`) | Jul/2023 | `2.670.914` | `74cb8ea42dc33e2539acddbc62320e3e22c193d58e7d8e5bbfc15338ff651561` | Reprodução permitida mediante citação ao SGB. |
| `PROV-SGB-SAH-2022` | Relatório Anual SAH-Pomba 2022 (`doc/22818`) | Jul/2022 | `2.717.091` | `8318866fa7bcd3d768aab18d69075302e74f31ff727f169d79918f8414b37b21` | Reprodução permitida mediante citação ao SGB. |
| `PROV-INEA-DRIVE-XLSX` | `Santo Antonio de Pádua.xlsx` (Drive INEA) | `2026-05-14` | `29.254.116` | `c5f96d0ee96fc043c11dd0290fcdb8eb7c6c857d48ca2363c2ded085f4d95bdb` | Sem licença aberta explícita; apenas estatísticas pontuais publicadas (`#46`). |
| `PROV-DECRETO-004-2022` | Decreto Municipal nº `004/2022` | `11/01/2022` | `281.302` | `0e0941a932ec64ec5305a658179820b10338888a8f7b27d373128b16676bb28d` | Ato normativo público municipal — link direto. |
| `PROV-DECRETO-002-2023` | Decreto Municipal nº `002/2023` | `08/01/2023` | `532.145` | `40a2d47cfce62de18db4e87acfb973fce83461d2cd79667ff5fec75e5f8033ac` | Ato normativo público municipal — link direto. |
| `PROV-DECRETO-025-2026` | Decreto Municipal nº `025/2026` | `04/03/2026` | `205.352` | `78ee72e5dc9bef04bd4e2664f59d6d3fcc311f294a45f9b4431c6220b3bba005` | Ato normativo público municipal — link direto. |

**Fotografias de terceiros:** todos os registros fotográficos jornalísticos (`Fabio Alves Brum` em `09/01/2022`; `Tiago Vieira / PR Drone` na Praça Pereira Lima em `08/01/2023`; `Diego Varsi / Inter TV RJ` em `27/02/2026`) possuem autoria, data e localização verificadas e são referenciados **exclusivamente por link externo**, sem cópia nem embutimento de imagem protegida por direitos autorais.

---

## 7. Pontos de Controle para Validação Científica (`lib/history/controlPoints.ts`)

Foram estruturados **10 pontos de controle** cobrindo praças, ilha fluvial, vias marginais, pontes, equipamento crítico de saúde e área tributária:

1. `CP-MONSENHOR-DINIZ` — **Praça Monsenhor Diniz** (`-21,543205, -42,177210`, OSM `way/260637176`, `11,54%` em `COTA_300cm`);
2. `CP-ILHA-CONVIVENCIA` — **Ilha da Convivência** (`-21,543554, -42,178531`, `BC25_RJ hid_ilha_a`, `30,68%` periférico em `COTA_300cm`, topo `86,0 m`);
3. `CP-BEIRA-RIO-SENAR` — **Av. Senar Frederico Rocha / setor Beira Rio** (OSM `way/254402825`, coordenada pontual mantida `null`, `water_present` em `2012-01`, `2022-01` e `2026-02`);
4. `CP-PRACA-PEREIRA-LIMA` — **Praça Pereira Lima** (coordenada pontual mantida `null`, `water_present` aerofotográfico em `2023-01-08`);
5. `CP-RUA-CORONEL-OLIVIER` — **Rua Coronel Olivier** (`0,0%` em `COTA_300cm/325cm`, controle transversal do Centro);
6. `CP-AV-CHAIM-ELIAS` — **Av. Chaim Elias** (`0,0%` em `COTA_300cm/325cm`, controle da margem direita / São Félix);
7. `CP-PONTE-RAUL-VEIGA` — **Ponte Raul Veiga** (controle contra falso positivo viário 2D sobre canal);
8. `CP-PONTES-PEDESTRES` — **Ponte Alberíades Gabry e passarela central** (controle de borda livre vs. projeção planar 2D);
9. `CP-HOSPITAL-HELIO-MONTEZANO` — **Entorno do Hospital Hélio Montezano de Oliveira** (acessibilidade de serviço crítico);
10. `CP-RUA-ALBERTO-FREIRE` — **Rua Alberto Freire, Santa Luzia — Bacia do Rio Pirapetinga** (`water_present` em `2023-01-08`, controle fundamental de inundação tributária fora da calha unidimensional do Rio Pomba).

A função [`evaluateControlPointsForEventScenario`](../../lib/history/controlPoints.ts) calcula determinísticamente `truePositive`, `falsePositive`, `falseNegative` e `trueNegative`, mantendo `unknownFieldEvidence` e `unverifiedCoordinates` isolados fora da matriz de confusão para futura validação das manchas SGB e do modelo próprio (`#5` / `#7`).
