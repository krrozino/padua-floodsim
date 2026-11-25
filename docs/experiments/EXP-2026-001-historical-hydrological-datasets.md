# EXP-2026-001 — Auditoria, Aquisição e Qualidade de Séries Históricas Hidrológicas do Rio Pomba

## Identificação

- **ID:** `EXP-2026-001`
- **Título:** Aquisição reproduzível, controle de qualidade e viabilidade experimental de séries hidrológicas históricas em Santo Antônio de Pádua (RJ)
- **Data:** 2026-11-25
- **Responsável:** Programations 2.0 — Research (`research/historical-hydrological-datasets`)
- **Status:** `Piloto / Exploratório` (base empírica construída; nenhum modelo complexo ajustado; nenhuma tradução automática INEA → mancha SGB habilitada)
- **Issues / PRs relacionados:** `#37`, `#38`, PR `#41` (`docs/OBSERVATION_CONTRACT.md`)

---

## Pergunta

1. Quais fontes oficiais de séries históricas para **Santo Antônio de Pádua II (`58790002`)**, **UHE Barra do Braúna Jusante (`58788600`)**, estações complementares da bacia e INEA estão legal e tecnicamente acessíveis de forma reproduzível?
2. As séries adquiridas (especialmente **2022 e 2023**, além do período completo **2020–2026**) possuem qualidade, sobreposição temporal e resolução suficientes para testar persistência (`B0`), tendência recente (`B1`), modelos autorregressivos de Pádua (`M1`), contribuição de montante (`M2`) e precipitação (`M3`) nos horizontes `+1 h` a `+10 h`?

---

## Inventário de Estações

### Estações fluviométricas auditadas

| Código | Nome | Papel no estudo | Coordenadas (EPSG:4674) | Rio | Posição na bacia | Instituição / Operadora | Período obtido (UTC) | Frequência | Unidade orig. → norm. | Referência de régua | Datum vertical | Licença / Redistribuição |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `58790002` | Santo Antônio de Pádua II | Alvo urbano prioritário | `-21.5422, -42.1806` | Rio Pomba | Seção urbana de Pádua (`8.210 km²`) | ANA / SGB-CPRM | `2020-01-01T03:00Z .. 2026-11-25T02:30Z` (telem.); `2020-01-01 .. 2025-12-31` (conv. diária) | `15 min` (telem.); diária (conv.) | `cm → cm` (`Nivel`), `m³/s`, `mm` | `RHN-58790002` (zero = `79,709 m` ref. SGB 2024; atenção `240 cm`, alerta `275 cm`, inundação `310 cm`) | `hgeoHNOR_IMBITUBA` (via estudo SGB 2024) | RHN pública (ANA/SGB-CPRM); atribuir fontes; CSVs/XMLs brutos fora do Git |
| `58788600` | UHE Barra do Braúna Jusante | Montante prioritária (benchmark SAH-Pomba) | `-21.4453, -42.3919` | Rio Pomba | Jusante de barramento hidrelétrico (Recreio/MG) | BRAÚNA via ANA/ANEEL RHN | `2020-01-01T03:00Z .. 2026-11-25T02:00Z` | `60 min` | `cm → cm`, `m³/s`, `mm` | `RHN-58788600` (zero não publicado no endpoint) | Desconhecido | RHN pública (setor elétrico / Res. ANA/ANEEL); atribuir fontes; documentar falhas |
| `58770000` | Cataguases | Montante complementar (justificada cientificamente) | `-21.3894, -42.6964` | Rio Pomba | Montante SGB-CPRM (Cataguases/MG, `5.880 km²`) | ANA / SGB-CPRM | `2020-01-01T03:00Z .. 2026-11-25T02:00Z` | `15 min` | `cm → cm`, `m³/s`, `mm` | `RHN-58770000` (zero não publicado no endpoint) | Desconhecido | RHN pública (ANA/SGB-CPRM); atribuir fontes |
| `INEA-213042120` | Santo Antônio de Pádua (INEA) | Auditoria local / sobreposição 10 dias | Não publicado no XML (`21304212020.html`; local físico distinto de `58790002`) | Rio Pomba | Trecho urbano de Pádua | INEA-RJ | `2026-11-15T03:00Z .. 2026-11-25T03:00Z` (janela móvel 10 dias) | `15 min` | `m → cm` (`nivel_rio_ultimo`), `mm` (janelas distintas) | `INEA-213042120` (transbordamento HTML `5,00 m`; equivalência com `58790002` **não estabelecida**) | Desconhecido | Acesso público 10 dias; termos de consumo contínuo/armazenamento/redistribuição pendentes; solicitação formal necessária |

### Pluviômetros inventariados em Santo Antônio de Pádua (ANA `HidroInventario`, Sub-bacia 58)

| Código | Nome | Operadora | Telemétrica | Em operação | Coordenadas | Início telemétrico (metadado ANA) |
|---|---|---|---|---|---|---|
| `2142067` | Santo Antônio de Pádua II | `SGB-CPRM` | Sim | Sim | `-21.5419, -42.1825` | `2001-02-01` |
| `2141094` | Santo Antônio de Pádua | `INFOPER` | Sim | Sim | `-21.5111, -42.2075` | `2011-12-01` |
| `2142083` | Ponte Paraoquena | `INFOPER` | Sim | Sim | `-21.4953, -42.2533` | `2012-02-01` |
| `2142049` | Santo Antônio de Pádua | `INMET` | Não | Sim | `-21.5422, -42.1806` | — |
| `2142058` | Santo Antônio de Pádua | `SGB-CPRM` | Não | Sim | `-21.5419, -42.1825` | — |

*(Além dos pluviômetros dedicados, as três estações telemétricas `58790002`, `58788600` e `58770000` possuem canal `Chuva` próprio no mesmo feed SOAP da ANA.)*

---

## Fontes Acessíveis e Bloqueadas

| FONTE | ID/REFERÊNCIA | ACESSO TESTADO | EVIDÊNCIA | LIMITAÇÕES | PRÓXIMA AÇÃO |
|---|---|---|---|---|---|
| ANA SOAP (`telemetriaws1.ana.gov.br/ServiceANA.asmx`) | `58790002`, `58788600`, `58770000`, inventário Sub-bacia 58 | `HidroInventario`, `DadosHidrometeorologicos`, `HidroSerieHistorica` (`https`, blocos de 90 dias) | HTTP 200 XML diffgram; 84 blocos telemétricos + 1 série convencional + 2 inventários baixados e verificados por SHA-256 | Sem zero de régua/datum no payload; requisições sequenciais; `58788600` apresenta períodos longos travados (*flatline*) | **GO** para base histórica experimental em Python |
| INEA Alerta de Cheias (`alertadecheias.inea.rj.gov.br`) | `21304212020.xml` (`codigo="213042120"`) | GET HTTPS XML (`2026-11-25`) | HTTP 200 XML com 961 timestamps (~10 dias, passo 15 min) | Somente janela móvel de 10 dias; sem histórico 2022–2023; usa `"Dado Nulo"`; referência vertical diferente de `58790002` | **NO-GO** para histórico e conversão direta SGB; solicitar série histórica e zero da régua ao INEA |
| ANA / SNIRH HidroWebService REST (`snirh.gov.br/hidroweb/rest/api/*` e `ana.gov.br/hidrowebservice/`) | API v1/REST oficial | GET HTTPS (`2026-11-25`) | HTTP `401 Unauthorized` no SNIRH (`Token de Autenticação da API Inexistente ou mal Formatado`) e HTTP `503` em `ana.gov.br/hidrowebservice/` | Requer credenciamento institucional por e-mail (`hidro@ana.gov.br` / `telemetria@ana.gov.br`) com token de 60 min | **BLOQUEADO** — minuta preparada em [`HIDROWEBSERVICE_ACCESS_REQUEST.md`](./HIDROWEBSERVICE_ACCESS_REQUEST.md) |
| SGB / SACE (`sace.sgb.gov.br/bacia_pomba/`) | SAH-Pomba web | GET HTTPS (`2026-11-25`) | Reset de conexão TLS (`WinError 10054`) no redirecionamento; sem API histórica pública verificada | Dados das estações SGB da RHN já disponíveis via ANA; relatórios RIGeo como referência | **BLOQUEADO** — usar ANA/RHN para séries e RIGeo SGB para referência técnica |

---

## Dados, Reprodutibilidade e Preservação

- **Pipeline:** `scripts/research/hydrology/` (`PIPELINE_VERSION=1.0.0`, `PARSER_VERSION=1.0.0`, execução original em `Python 3.14.7`, 0 dependências externas; CI científico offline em `Python 3.12`).
- **Comando de verificação somente leitura:** `python -m scripts.research.hydrology.pipeline --verify-only`
- **Comando de reprodução offline (execuções futuras):** `python -m scripts.research.hydrology.pipeline --mode offline --verify-manifest`
- **Artefatos de manifesto:** [`data/metadata/hydrology/run_manifest.json`](../../data/metadata/hydrology/run_manifest.json) (`98` artefatos identificados por SHA-256: `88` entradas brutas em `data/raw/hydrology/`, `5` CSVs normalizados em `data/processed/hydrology/`, `5` relatórios JSON em `data/metadata/hydrology/`).
- **Vínculo histórico de código e status de reprodução (`BLOCKED_LOCAL_DATA`):**
  - O manifesto histórico preservado registra `git_commit: 054ff6f47a0456d6d4de7382e22cc4a8ce97b0be` (commit anterior ao commit `f86259d` que versionou o pipeline). Esse registro **foi preservado sem alteração** e **não demonstra isoladamente** a identidade exata do código executado originalmente; a vinculação retrospectiva depende das evidências versionadas disponíveis.
  - Para execuções futuras, `pipeline.py` implementa `compute_code_identity()` (`schema_version: 2`), registrando `git_base_commit`, estado `dirty`, `pipeline_fingerprint_sha256` determinístico e não circular sobre `scripts/research/hydrology/*.py`, versão do parser, versão do Python, parâmetros e hashes de entradas e saídas.
  - Como os `95` arquivos locais brutos/processados (~`554,67 MB`) permanecem fora do Git via `.gitignore` e indisponíveis no ambiente Cloud, a reprodução integral com os inputs originais fica classificada como **`BLOCKED_LOCAL_DATA`** até acesso ao armazenamento local (procedimento de recuperação e backup em [`scripts/research/hydrology/README.md`](../../scripts/research/hydrology/README.md)).

### Matriz de Permissões por Fonte (sem presumir licença irrestrita por HTTP 200)

| Fonte | Acesso público | Consumo permitido | Armazenamento | Produção de derivados | Redistribuição |
|---|---|---|---|---|---|
| ANA SOAP RHN (`58790002`, `58788600`, `58770000`) | Sim (HTTPS público sem token) | Consumo técnico/acadêmico sequencial de baixo volume; confirmar termos formais antes de coleta contínua em produção | Local fora do Git para pesquisa; verificar condições institucionais para arquivamento prolongado | Permitida para análise acadêmica com atribuição explícita a ANA / SGB-CPRM / operadora | **Não redistribuir** dumps/CSVs brutos no Git; versionar apenas metadados, resumos e manifestos |
| INEA Alerta de Cheias (`21304212020.xml`) | Sim (janela móvel 10 dias) | **Pendente de confirmação** para consumo automatizado contínuo (HTTP 200 não comprova autorização irrestrita) | **Pendente de confirmação** junto ao INEA (`geseg@inea.rj.gov.br` / `alertadecheias@gmail.com`) | Apenas métricas agregadas de auditoria com atribuição | **Pendente / não autorizada**; testes offline usam apenas fixtures sintéticas rotuladas |
| ANA/SNIRH HidroWebService REST | Bloqueado (`HTTP 401` / `503`) | Requer credenciamento institucional prévio | Conforme credenciamento | Conforme credenciamento | Conforme credenciamento |

---

## Análise Quantitativa de Qualidade

### Resumo das séries obtidas (`2020-01-01` a `2026-11-25`)

| Série | Registros totais | Válidos | Ausentes (`missing`) | Inválidos / Neg. | Cadência mediana (p10–p90) | Duplicatas exatas colapsadas / Conflitos | Lacunas (> 2× passo) | Maior lacuna (h) | Min / p50 / p95 / Máx |
|---|---|---|---|---|---|---|---|---|---|
| `58790002::stage_cm` | 236.732 | 228.274 (`94,36%` do span) | 8.458 | 0 | `15 min` (`15–15`) | `454` / `5.391` (arquivo station-wide) | 228 | `1.597,25 h` | `29,0 / 105,0 / 224,0 / 428,0 cm` |
| `58790002::daily_stage_cm` (conv.) | 2.192 | 2.192 (`100,0%` 2020–2025) | 0 | 0 | `1.440 min` (diária) | — | 0 | `0,0 h` | `33,0 / 101,0 / 220,0 / 428,0 cm` |
| `58790002::rainfall_mm` | 236.732 | 231.977 (`95,89%`) | 4.755 | 0 | `15 min` | — | 296 | `682,5 h` | `0,0 / 0,0 / 0,0 / 41,0 mm` |
| `58788600::stage_cm` | 58.069 | 57.900 (`95,73%`) | 82 | 87 | `60 min` (`60–60`) | `1.284` / `0` | 170 | `381,0 h` | `0,0 / 139,0 / 251,0 / 1.012,0 cm` |
| `58770000::stage_cm` | 236.954 | 220.902 (`91,31%`) | 16.052 | 0 | `15 min` (`15–15`) | `0` / `0` | 191 | `3.538,25 h` | `64,0 / 127,1 / 275,0 / 860,09 cm` |
| `INEA-213042120::stage_cm` (10d) | 961 | 932 (`96,98%`) | 29 | 0 | `15 min` (`15–15`) | `0` / `0` | 2 | `0,75 h` | `243,0 / 289,0 / 365,35 / 426,0 cm` |

### Achados críticos de qualidade (evidências empíricas)

1. **Preservação integral de extremos reais e divergência pendente de janeiro/2023 (`428 cm` vs `431 cm`):**
   - Todos os `2.657` registros `>= 310 cm` em `58790002` foram preservados com a flag `extreme_high_preserved`.
   - **Questão pendente:** o pipeline reportou pico máximo de **`428,0 cm` em `2023-01-08T12:45:00Z`** (`09:45 BRT`) na série telemétrica de 15 min e **`428,0 cm`** na série convencional diária (`2023-01-08T10:00Z`), enquanto o relatório técnico SGB (2024) registra **`431 cm`** em `08/01/2023` (divergência de `3 cm`).
   - **Verificação possível pelos metadados versionados:** em `quality_report.json` (`2023`), a comparação `telemétrica − convencional` às `07:00 BRT` em `363` dias pareados apresentou mediana `0,0 cm`, média `0,35 cm`, desvio `6,86 cm` e diferença absoluta máxima de `60,0 cm`.
   - **Hipóteses não confirmadas (`BLOCKED_LOCAL_DATA`):** possíveis diferenças de amostragem entre passos de 15 min, horário exato de leitura ou nível de revisão/consistência **não são tratadas como causas confirmadas** sem inspeção direta dos XMLs brutos de janeiro/2023 e da ficha/boletim original do SGB (`BLOCKED_LOCAL_DATA` no ambiente Cloud).
2. **Estabilidade de referência em `58790002` (convencional × telemétrica às 07:00 BRT):**
   - Em `2.086` dias pareados (`2020–2025`), a diferença `telemétrica − convencional` apresentou mediana de **`1,0 cm`** (média `1,41 cm`, desvio `7,94 cm`), caindo para mediana **`0,0 cm` em 2023 e 2024** e `0,48 cm` em 2025. Não há evidência de salto de zero da régua em `58790002` entre 2020 e 2025.
3. **Episódios de valor constante (*flatline* >= 24 h) e anomalia em `58788600` (Barra do Braúna Jusante):**
   - Foram detectados **78 episódios de valor constante `>= 24 h`** somando **`6.276,0 horas`** (~10,8% da série válida), incluindo `1.342,0 h` (`2022-09-28 .. 2022-11-23` em `123,0 cm`) e `1.004,0 h` (`2026-10-05 .. 2026-11-16` em `179,0 cm`).
   - **Interpretação científica rigorosa:** um episódio de *flatline* `>= 24 h` constitui **suspeita de qualidade (`suspect_flatline`)** e **não comprova isoladamente defeito instrumental** (pode refletir operação de barramento/regulação, repetição de telemetria ou falha de sensor). **A estação não deve ser descartada automaticamente**, mas requer tratamento causal explícito em modelagem.
   - **Impacto em janeiro de 2023:** durante `EVT-20221231-27` e `EVT-20230121-28` (quando Pádua II atingiu `428 cm` e `337 cm` e Cataguases atingiu `780 cm` e `583,45 cm`), `58788600` permaneceu entre **`177–182 cm`** (`81,08%` e `92,40%` sinalizados com `suspect_flatline`).
   - **Anomalia de setembro/2025:** entre `2025-09-16` e `2025-09-18` (estação seca), `58788600` registrou picos de **`798–1.012 cm`** enquanto Cataguases (`76–118 cm`) e Pádua II (`57–96 cm`) permaneciam em estiagem, exigindo triagem cruzada antes de uso em modelagem.
4. **Picos telemétricos isolados (*single-sample spikes*) em `58790002`:**
   - Entre abril/2022 e fevereiro/2023 ocorreram saltos isolados de uma única amostra (`+87 a +191 cm` em 15 min, ex.: `2022-04-26T04:30Z = 255 cm` entre leituras de `122 cm`). Esses pontos foram **mantidos** no CSV normalizado para rastreabilidade e classificados separadamente em `candidate_events.json` como `suspected_telemetry_spike_artifact` (`13` ocorrências).
5. **Sobreposição temporal INEA (`213042120`) ↔ RHN (`58790002`):**
   - `58790002 × 58788600` (horário): `54.667` pares (`48.790` sem `suspect_flatline`, `r = 0,7830` em lag 0).
   - `58790002 × 58770000` (15 min): `215.486` pares (`r = 0,8910` em lag 0).
   - `INEA-213042120 × 58790002` (15 min, janela de 10 dias `2026-11-15..2026-11-25`): as estações estão em **localizações físicas distintas** (~5,9 km ao longo do Rio Pomba) e, nos `926` pares simultâneos, a diferença `INEA − RHN` variou entre **`+88,0 cm` e `+159,0 cm`** (média `+111,02 cm`, desvio `13,95 cm`). Essa variação de `71 cm` em 10 dias **não sustenta conversão direta** entre as leituras (decisão **NO-GO** para associação automática INEA → mancha SGB). Como o zero da régua e o datum vertical do INEA ainda não foram identificados, **não se afirma diferença de datum comprovada** sem os respectivos metadados oficiais.

---

## Eventos Hidrológicos Candidatos

De `42` cruzamentos brutos `>= 240 cm` em `58790002` (fusão de lacunas `< 72 h`), **`29` são eventos hidrológicos sustentados** (e **`9` atingiram a cota de inundação SGB `>= 310 cm`**):

| Evento | Tier SGB | Início (UTC) | Pico (UTC) | Duração >= 240 cm | Pico Pádua (`58790002`) | Chuva Pádua | Braúna (`58788600`) sem suspeita excessiva? | Cataguases (`58770000`) utilizável? |
|---|---|---|---|---|---|---|---|---|
| `EVT-20200125-02` | `flood >= 310` | `2020-01-25T04:30Z` | `2020-01-26T17:15Z` | `337,5 h` | `398,5 cm` | `103,6 mm` | Sim (`530 cm`) | Sim (`860,09 cm`) |
| `EVT-20200213-03` | `flood >= 310` | `2020-02-13T09:15Z` | `2020-02-15T10:30Z` | `142,25 h` | `408,0 cm` | `104,8 mm` | **Não** (cob. `49,7%`) | Sim (`823,42 cm`) |
| `EVT-20200228-04` | `flood >= 310` | `2020-02-28T09:00Z` | `2020-03-06T20:30Z` | `212,0 h` | `369,0 cm` | `94,0 mm` | Sim (`483 cm`) | Sim (`758,39 cm`) |
| `EVT-20220108-11` | `flood >= 310` | `2022-01-08T11:45Z` | `2022-01-11T10:00Z` | `153,75 h` | `423,0 cm` | `168,4 mm` | Sim (`528 cm`) | Sim (`762,0 cm`) |
| `EVT-20220204-12` | `flood >= 310` | `2022-02-04T06:15Z` | `2022-02-16T15:45Z` | `564,0 h` | `365,0 cm` | `89,4 mm` | Sim (`473 cm`) | Sim (`644,0 cm`) |
| `EVT-20221231-27` | `flood >= 310` | `2022-12-31T19:45Z` | `2023-01-08T12:45Z` | `370,75 h` | **`428,0 cm`** *(vs `431 cm` SGB — pendente)* | `168,2 mm` | **Não** (`81,1%` `suspect_flatline`) | Sim (`780,0 cm`) |
| `EVT-20230121-28` | `flood >= 310` | `2023-01-21T03:30Z` | `2023-01-26T14:45Z` | `151,25 h` | `337,0 cm` | `111,4 mm` | **Não** (`92,4%` `suspect_flatline`) | Sim (`583,45 cm`) |
| `EVT-20251217-36` | `flood >= 310` | `2025-12-17T22:30Z` | `2025-12-18T15:15Z` | `39,75 h` | `310,76 cm` | `58,0 mm` | Sim (`381 cm`) | Sim (`514,41 cm`) |
| `EVT-20260225-38` | `flood >= 310` | `2026-02-25T11:15Z` | `2026-02-28T18:30Z` | `111,5 h` | `412,0 cm` | `61,0 mm` | Sim (`560 cm`) | Sim (`815,99 cm`) |

*(Os 29 eventos sustentados e os 13 artefatos de pico estão listados integralmente em [`candidate_events.json`](../../data/metadata/hydrology/candidate_events.json).)*

---

## Viabilidade Experimental e Análise de Defasagem

1. **Resolução temporal para `+1 h .. +10 h`:**
   - `58790002` (`15 min`) e `58770000` (`15 min`) suportam nativamente todos os horizontes `+1 h` a `+10 h`; `58788600` (`60 min`) suporta todos os horizontes em grade horária sem necessidade de interpolação.
2. **Diagnóstico exploratório de correlação cruzada (`0..16 h`):**
   - Correlação global (séries horárias sem `suspect_flatline`): para `58788600 → 58790002`, o máximo observado na janela foi `r = 0,7945` em `lag = 7 h` (vs `r = 0,7942` em `8 h`); nos eventos `>= 310 cm` utilizáveis, o máximo local ocorreu entre `4 h` e `6 h`.
   - Para `58770000 → 58790002` (Cataguases), a correlação máxima observada na grade testada foi **`r = 0,9302` em `lag = 16 h`**. **Limitação crítica:** como `16 h` corresponde ao **limite superior da janela investigada (`0..16 h`)**, **não se afirma que `16 h` seja o tempo real de propagação** entre Cataguases e Pádua. Além disso, **correlação cruzada elevada não demonstra ganho preditivo fora da amostra** — qualquer benefício precisa ser demonstrado em validação preditiva controlada (`EXP-2026-002`).
3. **Decisão sobre famílias de modelos:**
   - **Persistência (`B0`) e Tendência (`B1`):** **GO** (piloto exploratório executado abaixo).
   - **Regressão com defasagens de Pádua (`M1`):** **GO** para investigação em `EXP-2026-002` (`57.113` horas válidas; 29 eventos sustentados).
   - **Contribuição de Barra do Braúna (`M2`):** **GO CONDICIONAL** — não descartar automaticamente a estação, mas aplicar triagem causal de episódios constantes (sem vazamento futuro) e avaliar em conjunto com `58770000`.
   - **Contribuição de precipitação (`M3`):** **GO CONDICIONAL** — séries de chuva telemétricas disponíveis nas 3 estações (`58.255` horas em Pádua), condicionadas à validação de cobertura horária de passos de 15 min.

---

## Piloto Exploratório de Persistência (`B0`) e Tendência (`B1`)

**Status:** `Exploratório` (não operacional; não validado para uso público; apenas baselines simples).  
**Split temporal do piloto:** referência `<= 2022-12-31T23:59:59Z` (`23.758` horas válidas em Pádua) | avaliação `>= 2023-01-01T00:00:00Z` (`33.355` horas válidas em Pádua).  
**Ressalva metodológica:** o evento `EVT-20221231-27` (início `2022-12-31T19:45Z`, pico `2023-01-08T12:45Z`) atravessa a fronteira `2022-12-31 / 2023-01-01`. Embora `B0` e `B1` não possuam parâmetros ajustados na janela anterior, o experimento seguinte ([`EXP-2026-002-forecast-protocol.md`](./EXP-2026-002-forecast-protocol.md)) **exige separação por eventos inteiros** antes de qualquer treino de `M1/M2/M3`.

| Horizonte | Subset | `n_pairs` | `B0` MAE (cm) | `B0` RMSE (cm) | `B0` Viés (cm) | `B0` KGE | `B1` MAE (cm) | `B1` RMSE (cm) | `B1` Viés (cm) | `B1` KGE |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `+1h` | Global | 33.118 | 0,86 | 1,89 | 0,00 | 0,9993 | **0,64** | **1,28** | 0,00 | 0,9987 |
| `+1h` | Cheia (`H >= 240 cm`) | 884 | 2,80 | 3,79 | 0,19 | 0,9948 | **1,49** | **2,12** | 0,32 | 0,9984 |
| `+2h` | Global | 33.092 | 1,66 | 3,55 | 0,00 | 0,9977 | **1,48** | **2,98** | 0,00 | 0,9957 |
| `+2h` | Cheia (`H >= 240 cm`) | 884 | 5,46 | 7,30 | 0,60 | 0,9830 | **3,56** | **5,13** | 0,88 | 0,9940 |
| `+3h` | Global | 33.084 | **2,42** | 5,01 | 0,00 | 0,9953 | 2,48 | **4,95** | 0,00 | 0,9909 |
| `+3h` | Cheia (`H >= 240 cm`) | 883 | 7,97 | 10,54 | 1,16 | 0,9668 | **5,97** | **8,49** | 1,58 | 0,9849 |
| `+4h` | Global | 33.079 | **3,13** | **6,28** | 0,00 | 0,9926 | 3,56 | 6,98 | 0,00 | 0,9840 |
| `+4h` | Cheia (`H >= 240 cm`) | 882 | 10,33 | 13,48 | 1,81 | 0,9488 | **8,42** | **11,78** | 2,37 | 0,9710 |
| `+5h` | Global | 33.073 | **3,80** | **7,41** | 0,00 | 0,9898 | 4,68 | 9,02 | 0,00 | 0,9754 |
| `+5h` | Cheia (`H >= 240 cm`) | 881 | 12,57 | 16,20 | 2,51 | 0,9300 | **10,84** | **14,94** | 3,20 | 0,9528 |
| `+6h` | Global | 33.067 | **4,41** | **8,42** | 0,00 | 0,9868 | 5,81 | 11,02 | 0,00 | 0,9652 |
| `+6h` | Cheia (`H >= 240 cm`) | 880 | 14,74 | 18,83 | 3,26 | 0,9104 | **13,36** | **18,18** | 4,06 | 0,9298 |
| `+7h` | Global | 33.062 | **4,99** | **9,35** | -0,01 | 0,9837 | 6,95 | 12,97 | -0,01 | 0,9535 |
| `+7h` | Cheia (`H >= 240 cm`) | 879 | 16,84 | **21,37** | 4,03 | 0,8901 | **15,91** | 21,49 | 4,97 | 0,9029 |
| `+8h` | Global | 33.057 | **5,52** | **10,20** | -0,01 | 0,9805 | 8,09 | 14,96 | -0,02 | 0,9399 |
| `+8h` | Cheia (`H >= 240 cm`) | 878 | 18,86 | **23,87** | 4,82 | 0,8689 | **18,41** | 24,77 | 5,84 | 0,8734 |
| `+9h` | Global | 33.053 | **6,02** | **11,00** | -0,01 | 0,9774 | 9,22 | 16,99 | -0,02 | 0,9243 |
| `+9h` | Cheia (`H >= 240 cm`) | 877 | **20,80** | **26,32** | 5,66 | 0,8468 | 21,01 | 28,13 | 6,61 | 0,8407 |
| `+10h` | Global | 33.048 | **6,49** | **11,75** | -0,01 | 0,9742 | 10,34 | 18,96 | -0,03 | 0,9077 |
| `+10h` | Cheia (`H >= 240 cm`) | 876 | **22,71** | **28,73** | 6,46 | 0,8245 | 23,65 | 31,66 | 7,55 | 0,8052 |

*(Resultado observado honesto: a extrapolação linear simples de 1 h (`B1`) supera `B0` apenas até `+2 h` global e até `+6 h` em MAE de cheia, degradando rapidamente para `+7 h .. +10 h` por amplificar ruído/variações instantâneas e picos de 15 min.)*

---

## Interpretação e Limitações

- **Resultados observados:**
  1. A série `58790002` tem alta cobertura em 2020–2026 (`94,36%`) e estabilidade mediana frente à série convencional diária; a divergência de `3 cm` no pico de janeiro/2023 (`428 cm` vs `431 cm` SGB) permanece aberta (`BLOCKED_LOCAL_DATA` para inspeção de brutos);
  2. `58788600` (Barra do Braúna) apresenta episódios extensos de valor constante (`suspect_flatline >= 24 h`, suspeita de qualidade que não comprova isoladamente defeito instrumental) e pico anômalo em setembro/2025; não deve ser descartada automaticamente, mas requer filtro causal;
  3. `58770000` (Cataguases) oferece cobertura complementar nos 29 eventos sustentados, mas `r = 0,9302` em `16 h` (limite da janela) não define tempo de propagação nem prova ganho preditivo;
  4. `INEA-213042120` está em local físico distinto de `58790002`, não possui série plurianual aberta nem zero/datum identificados, e a variação de `+88..+159 cm` em 10 dias não sustenta conversão direta.
- **Limitações:**
  1. Os registros telemétricos da ANA (`DadosHidrometeorologicos`) são dados operacionais brutos, sem consistência oficial completa como as séries convencionais consistidas (`NivelConsistencia=2`);
  2. A exclusão dos `13` picos isolados de 15 min foi sinalizada apenas no inventário de eventos, mantendo os valores originais no dataset normalizado;
  3. Modelos `M1`, `M2` e `M3` não foram ajustados nesta sprint (escopo restrito a auditoria, pipeline, baselines `B0/B1` e protocolo [`EXP-2026-002`](./EXP-2026-002-forecast-protocol.md)).

---

## Decisões GO / NO-GO (Issue #37)

- **Aquisição reproduzível via ANA SOAP para pesquisa (`58790002`, `58788600`, `58770000`):** **GO** (observando a matriz de permissões e mantendo dados volumosos fora do Git).
- **Uso de `58788600` como feature preditiva (`M2`):** **GO CONDICIONAL** (não descartar automaticamente; exige triagem causal de `suspect_flatline` sem vazamento futuro e avaliação conjunta com `58770000`).
- **Conversão automática `INEA -> mancha SGB`:** **NO-GO** (estações fisicamente distintas, variação `+88..+159 cm` em 10 dias não sustenta conversão direta, sem histórico público nem zero da régua/datum identificados).
- **Previsão pública na UI:** **BLOQUEADO** até execução controlada do protocolo `EXP-2026-002` (`M1/M2/M3`), validação fora da amostra por eventos inteiros e quantificação de incerteza.
