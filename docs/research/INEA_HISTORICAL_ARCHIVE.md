# Auditoria do Acervo Histórico Oficial do INEA — Santo Antônio de Pádua (Rio Pomba)

**Frente:** Pádua FloodSim — R02-A (Recuperação de Fontes Hidrológicas)  
**Branch:** `research/inea-historical-archive`  
**Data da auditoria:** 2026-11-25  
**Skills aplicadas:** `audit-hydro-source` e `verify-hydro-observations` (PR `#41`)  
**Classificação dos dados auditados:** `observed` (acervo telemétrico e fichas INEA), `official_reference` (relatórios SGB/CPRM e inventário ANA/RHN). Nenhuma série bruta foi versionada neste repositório.

> **Aviso científico e operacional:** este documento é exclusivamente de pesquisa acadêmica e auditoria de fontes. Os dados e achados aqui registrados **não** constituem alerta oficial, **não** substituem INEA, Defesa Civil, SGB ou ANA e **não** autorizam a conversão direta de cotas do INEA para as manchas de inundação do SGB (`58790002`) sem crosswalk validado.

---

## 1. Resumo executivo (contrato `audit-hydro-source` / `verify-hydro-observations`)

| Dimensão (`audit-hydro-source`) | Resultado verificado |
| --- | --- |
| **FONTE** | Repositório público oficial do INEA no Google Drive (`Dados Públicos`, pasta `1jOfCAhb8llozzsAOE-KW9NJYC_ivcgNx`) + confronto com metadados públicos ANA (`HidroInventario`) e relatórios SGB/CPRM (RIGeo). |
| **ID / REFERÊNCIA** | Estação INEA **Santo Antônio de Pádua**: ID de Transmissão **`213042120`**, Código ANA Fluviométrico **`58774000`**, Código ANA Pluviométrico **`2141094`**, Entidade Proprietária INEA (`438`), Tipo `PFT` (`Plu/Flu`). Estação adicional do INEA no município: **Ponte Paraoquena** (ANA FLU `58789000`, ANA PLU `2142083`, ID `BE7176FE`). Referência SGB/ANA confrontada: **Santo Antônio de Pádua II** (RHN **`58790002`**). |
| **ACESSO TESTADO** | Google Drive público acessível sem autenticação (`HTTP 200`, listagem e download direto de arquivos de inventário, ficha descritiva, medições de vazão e planilha telemétrica para inspeção local temporária). **Bloqueio:** `https://www.inea.rj.gov.br/wp-content/uploads/2025/07/Orienta%C3%A7%C3%B5es_Drive.pdf` sofreu *timeout* de conexão TCP (25 s) a partir do ambiente cloud (`187.62.129.119:443`). |
| **EVIDÊNCIA** | Vínculo `213042120` ↔ `58774000` / `2141094` confirmado em `InventarioINEA2026.xlsx` (linha 89) e `SANTO ANTÔNIO DE PÁDUA.docx`. Planilha `Santo Antonio de Pádua.xlsx` (`29.254.116` bytes, SHA-256 `c5f96d0ee96fc043c11dd0290fcdb8eb7c6c857d48ca2363c2ded085f4d95bdb`, 15 abas, 2011–2026) auditada quanto a esquema, unidades, fuso, lacunas e períodos-alvo. Origem primária das duas coordenadas de `58790002` identificada (`ANA HidroInventario` vs. `SGB Relatório Anual SAH-Pomba 2024`). |
| **LIMITAÇÕES** | (1) `Orientações_Drive.pdf` indisponível no ambiente cloud (termos/regras oficiais do PDF permanecem **NÃO CONFIRMADO**); (2) ausência de arquivo de licença explícita no Drive para redistribuição ou consumo automatizado; (3) datum vertical do zero da régua INEA (`83,299 m`) **NÃO CONFIRMADO**; (4) lacuna crítica de 01 a 18/01/2023 na planilha INEA (perde o pico de 08/01/2023); (5) aba `2013` contém dados de `2014` (ano de `2013` ausente); (6) divergência cadastral em `Santo Antônio de Pádua_Q.xlsx` (usa código `58790002`) e em `ÍNDICE_DOS_BANCOS_DE_DADOS.xlsx` (coordenada `-21,4894; -41,6328`); (7) causa da divergência de `2,415 km` entre as duas coordenadas de `58790002` **NÃO CONFIRMADO**. |
| **PRÓXIMA AÇÃO** | Confirmar condições de uso, datum vertical e inconsistências cadastrais via consulta institucional (Seção 9) antes de incorporar séries INEA em pipeline permanente ou redistribuir derivados; validar crosswalk INEA `58774000` × RHN `58790002` apenas após controle de qualidade (QC) dos períodos com sobreposição (`2012-01`, `2022-01/02`, `2026-02/03`). |

**Verificação `verify-hydro-observations`:**
- **MUDANÇA:** Somente documentação técnica de auditoria (`docs/research/INEA_HISTORICAL_ARCHIVE.md`); sem alteração de `DATA_SOURCES.md`, aplicação, API, UI ou pipeline.
- **TESTES / EVIDÊNCIA:** Inspeção determinística local (fora do repositório Git) de 7 arquivos oficiais do Drive do INEA, metadados SOAP `HidroInventario` da ANA e 3 relatórios PDF do SGB/CPRM.
- **STATUS DE DADOS:** `observed` (INEA Drive, majoritariamente `Bruto`/`Transmitido`, com marcações de `Ajustado`/`Suspeito`/`Invalidado`/`Ausente`) e `official_reference` (SGB/ANA). Nenhum dado bruto commitado.
- **RISCO RESIDUAL:** Mistura indevida de fusos (local até 2014 vs. GMT a partir de 2015 vs. XML operacional), de esquemas de colunas entre abas (2011–2014 vs. 2015–2020/2024–2026 vs. 2021–2023) e de réguas (`58774000` a 6 km a montante com zero `83,299 m` vs. `58790002` urbana com zero `79,709 m`).
- **GO / NO-GO:** **GO** para registro científico e planejamento de QC offline com amostra autorizada; **NO-GO** para ingestão contínua/redistribuição de dados brutos ou acionamento de manchas SGB a partir de leituras INEA.

---

## 2. Fontes auditadas e inventário do repositório oficial do INEA

### 2.1. Fontes institucionais consultadas

| Fonte | URL | Acesso em 2026-11-25 | Observação |
| --- | --- | --- | --- |
| Documento de orientações INEA (`Orientações_Drive.pdf`) | https://www.inea.rj.gov.br/wp-content/uploads/2025/07/Orienta%C3%A7%C3%B5es_Drive.pdf | **BLOQUEADO** (timeout TCP 25 s em `187.62.129.119:443`) | Conteúdo integral **NÃO CONFIRMADO** diretamente neste ambiente; informações de referência provenientes apenas do enunciado da tarefa. |
| Pasta raiz INEA (`Dados Públicos`) | https://drive.google.com/drive/folders/1jOfCAhb8llozzsAOE-KW9NJYC_ivcgNx?usp=share_link | **ACESSÍVEL** (`HTTP 200`, público) | 6 subpastas principais inventariadas. |
| Portal RJ Digital — Serviço de dados históricos INEA | https://www.rj.gov.br/servico/monitoramento-hidrometeorologico-dados-historicos39 | Consultado via busca web | Registra serviço gratuito ao cidadão mediante requerimento formal (`alertadecheias@gmail.com` / `geseg@inea.rj.gov.br`). |
| ANA `ServiceANA.asmx/HidroInventario` (somente metadados) | https://telemetriaws1.ana.gov.br/ServiceANA.asmx/HidroInventario | **ACESSÍVEL** (`HTTP 200`, XML) | Consultado apenas para metadados cadastrais (14 estações em Santo Antônio de Pádua); **não** foi repetida aquisição de séries históricas da ANA. |
| SGB/CPRM — Relatório Mancha de Inundação (2024) | https://rigeo.sgb.gov.br/bitstream/doc/25035/1/relatorio_sa_padua.pdf | **ACESSÍVEL** (`HTTP 200`, PDF) | Confirma RHN `58790002`, zero `79,709 m` (`hgeoHNOR_IMBITUBA`) e cota máxima `431 cm` em `08/01/2023`. |
| SGB/CPRM — Relatório Anual SAH-Pomba 2024 | https://rigeo.sgb.gov.br/bitstream/doc/24903/1/relatorio_anual_2024_sah_pomba.pdf | **ACESSÍVEL** (`HTTP 200`, PDF) | **Tabela 1 (p. 15)** publica `21°32'15''S`, `42°09'28''W` (`-21,5375; -42,1578`) para `58790002`; **Tabela 5 (p. 17)** lista 10 maiores cheias (`450 cm` em `04/01/2012`, `428 cm` em `08/01/2023`, `425 cm` em `11/01/2022`). |
| SGB/CPRM — Relatório Técnico SAH-Pomba 2021 | https://rigeo.sgb.gov.br/server/api/core/bitstreams/59c0e2b1-8a9e-4898-9c3b-1737d6f71256/content | **ACESSÍVEL** (`HTTP 200`, PDF) | Não publica tabela de coordenadas geográficas de `58790002`. |

### 2.2. Estrutura da pasta raiz `Dados Públicos` do INEA

| Subpasta / Caminho | ID / Link direto | Conteúdo relevante para Santo Antônio de Pádua |
| --- | --- | --- |
| `Informações Estações` | https://drive.google.com/drive/folders/1JK3hG4mxejSDPz0aC-qV3oBQAQIRGv3m | `InventarioINEA2026.xlsx`, `Fichas Descritivas/`, `Mapa_rede_hidro/`, `Processos de Avisos Meteorológicos/` |
| `Telemétricas` (135 arquivos) | https://drive.google.com/drive/folders/12Z3_HfXV06ziDXnwL1p29tzRcfmFG7kV | `Santo Antonio de Pádua.xlsx` e `Ponte Paraoquena.xlsx` |
| `Medição de Descarga Líquida` (67 pastas) | https://drive.google.com/drive/folders/1RhhWfb2VhOKDc2euOANKoxN_7fQwW9Xp | Pasta `Santo Antônio de Pádua/` (`Santo Antônio de Pádua_Q.xlsx` + `Fichas de Campo/` 2017–2019) |
| `Curvas-Chave` | https://drive.google.com/drive/folders/1Qb8MwDp_mo5PI6xnjk78YOCFxBmhz4X7 | **NÃO possui** Santo Antônio de Pádua (nem em `Dados Consistidos` [31 pastas], nem em `Relatórios Curvas-Chave` [18 PDFs]). |
| `Convencionais` (`BD_FLU`, `BD_PLU`) | https://drive.google.com/drive/folders/1LvX6WaDD3ec5uHmI5ljlWvqgFmf_SipQ | Contém apenas `ÍNDICE_DOS_BANCOS_DE_DADOS.xlsx` em cada subpasta (sem arquivos `.mdb`/`.csv` publicados nas subpastas inspecionadas). |
| `Descargas Atmosféricas` | https://drive.google.com/drive/folders/1fRI9gImJMVjcEASZr81yuWr38b6hL78w | Fora do escopo hidrométrico imediato (não baixado). |

### 2.3. Arquivos específicos encontrados para Santo Antônio de Pádua

| Arquivo / Pasta | Caminho no Drive | Link específico | Tamanho / Metadados observados |
| --- | --- | --- | --- |
| `InventarioINEA2026.xlsx` | `Informações Estações/` | https://drive.google.com/file/d/1RyN6tno3IlDDe869kWL-dyfPKRTlqiiE/view?usp=drive_web | `129.938` bytes; modificado em `2026-10-08T16:06:50Z`; abas `INVENTÁRIO` (104 linhas) e `Inventário_Desativadas`. |
| `SANTO ANTÔNIO DE PÁDUA.docx` | `Informações Estações/Fichas Descritivas/` | https://drive.google.com/file/d/1g_gzTOuDMgQLfqDpM_iZgJ1lkzXJEadJ/view?usp=drive_web | `1.960.855` bytes; 9 páginas; ficha descritiva completa com histórico de manutenção até `10/12/2024`. |
| `Santo Antonio de Pádua.xlsx` | `Telemétricas/` | https://drive.google.com/file/d/1z2w1J6BPOXmezGdWF_v4QtupG39kqCs4/view?usp=drive_web | `29.254.116` bytes; SHA-256 `c5f96d0ee96fc043c11dd0290fcdb8eb7c6c857d48ca2363c2ded085f4d95bdb`; modificado em `2026-05-14T14:57:14Z`; 15 abas (`2011`–`2026`, sem 2013 real). |
| `Santo Antônio de Pádua_Q.xlsx` | `Medição de Descarga Líquida/Santo Antônio de Pádua/` | https://drive.google.com/file/d/1oKPJuGUkBLJ9AO92PUz196iApC5veAXX/view?usp=drive_web | `6.220` bytes; 8 medições ADCP (M9 / RiverRay) entre 2017 e 2019; **atenção:** coluna A registra código `58790002`. |
| `Fichas de Campo/` (5 PDFs: 2017, 2018, 2019) | `Medição de Descarga Líquida/Santo Antônio de Pádua/` | https://drive.google.com/drive/folders/1_FTohv-qXU3RCeGVlYKmCL9V0CVIJO6E | `26-10-2017.pdf`, `Sto Ant de Pádua 23-1-18.pdf` (inspecionado: RiverSurveyor Live, `Pm331`, `Sant Ant. Padua`, `Q = 37,933 m³/s`), e 3 PDFs de 2019 (`SEHIDRO`/`SEMA`). |
| `estacao_hidro.csv` e `inventario_v36.xlsx` | `Informações Estações/Mapa_rede_hidro/estacoes_hidro/` | https://drive.google.com/file/d/1iQhGCS5B2Z93-ZHxnzf8Z6ciF06QPhae/view?usp=drive_web e https://drive.google.com/file/d/1GNp2A5SQMJX--6K3YlilpFUAQqFOK-P0/view?usp=drive_web | Confirmam `2141094` (`Santo Antônio de Pádua`, `-21.51122, -42.20767`) e `2142083` (`Ponte Paraoquena`, `-21.49539, -42.25336`). |
| `ÍNDICE_DOS_BANCOS_DE_DADOS.xlsx` (`BD_FLU` e `BD_PLU`) | `Convencionais/BD_FLU/` e `BD_PLU/` | https://drive.google.com/file/d/1nxpikHts5xC6ueRRhgPlMrI-k58KZE25/view?usp=drive_web e https://drive.google.com/file/d/1NhGYT3MU_-wwXQZPOGPDdeEol88UltiF/view?usp=drive_web | Referenciam `58774000` e `2141094` (`ALERTA CHEIAS`), porém com coordenada divergente (`-21.4894, -41.6328`). |
| `PONTE PARAOQUENA.docx` e `Ponte Paraoquena.xlsx` *(estação adicional no município)* | `Fichas Descritivas/` e `Telemétricas/` | https://drive.google.com/file/d/1H2q0S9qJ_4ZhC1BPFjHktGDrCDJG_H9_/view?usp=drive_web e https://drive.google.com/file/d/1oB17AE9wtleXarEq5qHBQqxQXkFFaE2o/view?usp=drive_web | **Não baixados** nesta etapa; registrados apenas no inventário como estação INEA a montante no Rio Pomba (`58789000` / `2142083`, `BE7176FE`). |

---

## 3. Identidade e metadados verificados da estação INEA `213042120`

### 3.1. Confirmação do vínculo `213042120` ↔ RHN/ANA `58774000`

A hipótese de vínculo entre a estação INEA `213042120` e o código RHN/ANA `58774000` está **CONFIRMADA** por evidência documental primária cruzada:

1. **`InventarioINEA2026.xlsx` (aba `INVENTÁRIO`, linha 89):** associa explicitamente na mesma linha `ID Transmissão = 213042120`, `Código ANA Flu = 58774000`, `Código ANA Plu = 2141094`, `Nome das estações = Santo Antônio de Pádua`, `Rio monitorado = Rio Pomba`, `Latitude = -21.51122`, `Longitude = -42.20767`, `Cota de Transbordo (m) = 5`, `Área de Drenagem (Km2) = 7957.99`, `Data de Implantação = 2011-12-14` (serial Excel `40891`).
2. **`SANTO ANTÔNIO DE PÁDUA.docx` (Ficha Descritiva INEA):** confirma `Código FLU = 58774000`, `Código PLU = 2141094`, `Entidade Proprietária = INEA (438)`, `Tipo = PFT`, `Coordenadas = 21°30'40.4"S; 42°12'27.6"W (WGS 84)` (= `-21,511222; -42,207667`), `Área de Drenagem = 7.957,99 km²`, `Cota de Transbordamento = 5,00 m` (margem direita), instalação em `14/12/2011` (FLU) e `16/12/2011` (PLU).
3. **`ANA HidroInventario` (`ServiceANA.asmx`):** registra `58774000` (`SANTO ANTÔNIO DE PÁDUA`, `Rio Pomba`, `ResponsavelSigla = INEA-RJ`, `OperadoraSigla = INFOPER`, `Latitude = -21.5111`, `Longitude = -42.2075`, início `2011-12-01`) e `2141094` (pluviométrica, mesmas coordenadas).

**Conclusão crítica de identidade:** a estação INEA `213042120` (`58774000`) **NÃO é a mesma estação** que a estação SGB/ANA `58790002` (`SANTO ANTÔNIO DE PÁDUA II`). Ela está instalada **6 km a montante do centro da cidade** (*"Centro da cidade, subir o rio pela margem direita 6 (seis) Km, dentro da propriedade do Sr. Luiz Fernando"*), a `4,439 km` em linha reta a noroeste da coordenada ANA de `58790002` (`-21,5422; -42,1806`), com área de drenagem menor (`7.957,99 km²` vs. `8.210–8.237 km²`) e zero de régua distinto (`83,299 m` vs. `79,709 m`).

### 3.2. Ficha técnica consolidada — INEA `213042120` (`58774000` / `2141094`)

| Atributo | Valor verificado | Fonte primária | Status |
| --- | --- | --- | --- |
| Nome oficial | `Santo Antônio de Pádua` | Ficha Descritiva / `InventarioINEA2026.xlsx` | Confirmado |
| ID Transmissão INEA | `213042120` (página/XML operacional usa sufixo `21304212020`) | `InventarioINEA2026.xlsx` (linha 89) | Confirmado |
| Código ANA Fluviométrico | `58774000` | Ficha Descritiva / `InventarioINEA2026.xlsx` / ANA | Confirmado |
| Código ANA Pluviométrico | `2141094` | Ficha Descritiva / `InventarioINEA2026.xlsx` / ANA | Confirmado |
| Proprietária / Operadora | INEA (`438`) / Água & Solo Estudos e Projetos LTDA (Ficha); `INFOPER` (ANA, última atualização 2014) | Ficha Descritiva / ANA `HidroInventario` | Confirmado (operadora atual pós-2024: **NÃO CONFIRMADO**) |
| Tipo / Transmissão | `PFT` (`Plu/Flu` telemétrica), GSM/GPRS, resolução nominal 15 min | Ficha Descritiva / `Santo Antonio de Pádua.xlsx` | Confirmado |
| Coordenadas oficiais | `21°30'40.4"S`, `42°12'27.6"W` (`-21,51122; -42,20767`) | Ficha Descritiva / `InventarioINEA2026.xlsx` / `estacao_hidro.csv` | Confirmado (ANA arredonda para `-21,5111; -42,2075`) |
| Datum horizontal | `WGS 84` | Ficha Descritiva | Confirmado |
| Unidade de nível / chuva | Nível em **metros (`m`)**; chuva em **milímetros (`mm`)** | `Santo Antonio de Pádua.xlsx` | Confirmado |
| Seção de réguas | 3 lances (`L1/3 m`, `L3/4 m`, `L4/5 m`), amplitude `5 m`, margem direita | Ficha Descritiva / `InventarioINEA2026.xlsx` | Confirmado |
| Cota de transbordamento | `5,00 m` (margem direita); `% Alerta Máximo = 80%` | Ficha Descritiva / `InventarioINEA2026.xlsx` | Confirmado |
| Altitude do zero da régua | `83,299 m` (grafado `83299` na célula da Ficha; coerente com `RN1 = 7108 mm → 90,407 m` e `RN2 = 5020→4990 mm → 88,319 m`). Em `InventarioINEA2026.xlsx` consta `Não Possui`. | Ficha Descritiva | Parcialmente confirmado (grafia sem separador decimal e `Não Possui` no inventário exigem confirmação formal) |
| Datum vertical | **NÃO CONFIRMADO** (não declarado na Ficha nem no inventário) | Ficha Descritiva / `InventarioINEA2026.xlsx` | **NÃO CONFIRMADO** |
| Área de drenagem | `7.957,99 km²` | Ficha Descritiva / `InventarioINEA2026.xlsx` | Confirmado |
| Equipamentos principais | Linímetro Velki VKL-214 (ativado `20/03/2018`, sensor relativo em substituição a absoluto); pluviômetro Hydrological Services TB04/0,2 (`16/12/2011`); modem Absolut Mobile AM3000 (`26/12/2017`). | Ficha Descritiva | Confirmado até `10/12/2024` |
| Histórico de manutenção relevante | Remoção do datalogger (`23/11/2017`); troca de sensor absoluto→relativo (`20/03/2018`); invalidação de chuva por *reed switch* (`11/02–25/03/2019`); múltiplos ajustes de nível do sensor (2021–2024 e 2026); ninho de pássaro no pluviômetro (`10/12/2024`). | Ficha Descritiva + abas anuais da planilha | Confirmado |

---

## 4. Auditoria da planilha telemétrica histórica (`Santo Antonio de Pádua.xlsx`)

### 4.1. Visão geral por aba (2011–2026)

A planilha `Telemétricas/Santo Antonio de Pádua.xlsx` (`29,25 MB`, 15 abas) cobre o período de `2011-12-08` a `2026-03-30`, mas apresenta **três esquemas de colunas distintos**, **mudança de padrão de fuso horário** e **lacunas importantes**:

| Aba | Período real observado | Linhas de data | Nível não-nulo | Chuva não-nula | Fuso declarado no cabeçalho | Esquema / Observações críticas |
| --- | --- | ---: | ---: | ---: | --- | --- |
| `2011` | `2011-12-08 11:45` – `2011-12-31 23:45` | 2.257 | 2.257 | 2.257 | `DATA E HORA ` *(local; sem GMT)* | 4 colunas (`DATA E HORA`, `CHUVA (mm)`, `CHUVA COLETADA`, `NIVEL (m)`). |
| `2012` | `2012-01-01 00:00` – `2012-12-31 23:45` | 35.136 | 35.136 | 35.136 | `DATA E HORA ` *(local; sem GMT)* | Mesmo esquema de 4 colunas (`NIVEL (m)` está na coluna `D`). |
| `2013` | **`2014-01-01 00:00` – `2014-12-23 00:00`** | 34.177 | 33.004 | 33.002 | `DATA E HORA ` *(local; sem GMT)* | **Anomalia:** aba nomeada `2013` contém registros de **2014**. O ano de **2013 está ausente** e não existe aba `2014`. |
| `2015` | `2015-05-06 00:00` – `2015-12-31 23:45` | 23.040 | 22.188 | 22.190 | `Data e Hora (GMT)` | Início do esquema `Tripa Final` (11 colunas, com `Correção`, `Origem`, `Classificação` e `Comentários`). Lacuna de jan–abr/2015. |
| `2016` | `2016-01-01 00:00` – `2016-12-31 23:45` | 35.136 | 21.400 | 21.400 | `Data e Hora (GMT)` | 13.736 linhas `Ausente`; 12.657 `Transmitido`; 8.706 `Bruto`; 37 `Invalidado`. |
| `2017` | `2017-01-01 00:00` – `2017-12-31 23:45` | 35.040 | 2.305 | 2.305 | `Data e Hora (GMT)` | 32.735 `Ausente`; 1.841 `Invalidado` (coerente com falha/remoção de datalogger na Ficha). |
| `2018` | `2018-01-01 00:00` – `2018-12-31 23:45` | 35.040 | 35.007 | 35.007 | `Data e Hora (GMT)` | 34.315 `Bruto`; 619 `Ajustado`; 71 `Invalidado`; 33 `Ausente`. |
| `2019` | `2019-01-01 00:00` – `2019-12-31 23:45` | 35.040 | 31.142 | 31.202 | `Data e Hora (GMT)` | 17.722 `Transmitido`; 13.425 `Bruto`; 3.875 `Ausente`; 18 `Invalidado`. |
| `2020` | `2020-01-01 00:00` – `2020-12-31 23:45` | 35.136 | 19.111 | 19.113 | `Data e Hora (GMT)` | 16.025 `Ausente`; 11.589 `Transmitido`; 6.893 `Bruto`; 382 `Invalidado`; 247 `Ajustado`. |
| `2021` | `2021-01-01 00:00` – `2021-12-31 23:45` | 35.040 | 35.020 | 35.020 | `Data e Hora (GMT)` | Esquema reduzido (9 colunas, sem coluna separada `Classificação`; notas de manutenção na col. `I`/`K`). |
| `2022` | `2022-01-01 00:00` – `2022-12-31 23:45` | 35.040 | 33.560 | 33.560 | `Data e Hora (GMT)` | Esquema de 9 colunas; majoritariamente `Bruto`, com notas de ajuste de sensor. |
| `2023` | `2023-01-01 00:00` – `2023-12-31 23:45` | 35.040 | 33.330 | 33.330 | `Data e Hora (GMT)` | Esquema de 9 colunas; **lacuna severa de 01 a 18/01/2023**; nota cita possível influência da UHE Barra do Braúna em variações sem chuva. |
| `2024` | `2024-01-01 00:00` – `2024-12-31 23:45` | 35.132 | 35.105 | 35.109 | `Data e Hora (GMT)` | Retorno ao esquema de 11 colunas (`Bruto`: 30.766; `Ajustado`: 4.337; `Ausente`: 25; `Suspeito`: 4). |
| `2025` | `2025-01-01 00:00` – `2025-12-19 18:59` | 33.871 | 33.863 | 33.868 | `Data e Hora (GMT)` | 11 colunas (`Bruto`: 33.844; `Invalidado`: 19; `Ausente`: 8); termina em `19/12/2025`. |
| `2026` | `2026-01-01 00:00` – `2026-03-30 16:44` | 8.516 | 8.514 | 8.514 | `Data e Hora (GMT)` | 11 colunas (`Bruto`: 5.392; `Suspeito`: 2.175 em jan/2026; `Ajustado`: 947 em fev/2026; `Ausente`: 2). |

### 4.2. Disponibilidade nos 4 períodos-alvo (Tarefa 4)

| Período-alvo | Aba | Grade esperada (15 min) | Nível não-nulo | Cobertura | Mín. / Máx. nível (`m`) | Instante do pico (no fuso da aba) | Qualidade / Observações críticas |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| **Janeiro de 2012** | `2012` | 2.976 | 2.976 | **100,0%** | `2,35 m` / **`6,91 m`** | `2012-01-04 01:15` *(local)* | Sem coluna de classificação de qualidade. Pico ocorre no mesmo dia da maior cheia histórica de `58790002` (`450 cm` em `04/01/2012`), confirmando deslocamento de escala (~2,41 m no pico). |
| **Janeiro de 2022** | `2022` | 2.976 | 2.975 | **99,97%** | `-0,769 m` / **`6,452 m`** | `2022-01-11 07:15 GMT` | Majoritariamente `Bruto`. Presença de valores negativos espúrios (7 registros negativos em jan–fev/2022) que exigem filtragem de QC. Pico acima da cota de transbordo (`5,00 m`), compatível com `425 cm` em `11/01/2022` na `58790002`. |
| **Fevereiro de 2022** | `2022` | 2.688 | 2.687 | **99,96%** | `-0,229 m` / **`5,516 m`** | `2022-02-16 15:00 GMT` | Majoritariamente `Bruto`, com ajustes de manutenção registrados (`-0,09 m`). |
| **Janeiro de 2023** | `2023` | 2.976 | **1.282** | **43,1%** | `2,755 m` / `5,238 m` | `2023-01-26 13:30 GMT` | **LACUNA CRÍTICA:** `2023-01-01 00:00` até `2023-01-18 15:15 GMT` estão completamente ausentes (1.694 registros). Nota na planilha: *"No momento da extração dos dados da memória interna deu erro. Não foi possível extrair os dados. Realizado reset do sistema do modem. N.A.=2.88m"*. **O pico histórico de `08/01/2023` (`431 cm` / `428 cm` em `58790002`) não foi registrado pelo INEA.** |
| **Fevereiro de 2026** | `2026` | 2.688 | 2.688 | **100,0%** | `2,070 m` / **`6,314 m`** | `2026-02-28 17:15 GMT` | `1.741` `Bruto` + `947` `Ajustado`. Supera amplamente a cota de transbordo (`5,00 m`); resumo interno da aba confirma `6,31 - 28/02/26`. *(Atenção: jan/2026 teve 2.175 linhas `Suspeito` por descalibração do sensor antes do ajuste em fev/2026).* |
| **Março de 2026** | `2026` | 2.976 *(mês)* / 2.852 *(até 30/03 16:45)* | 2.852 | **95,8% do mês** *(100% até 30/03 16:45)* | `2,193 m` / **`6,201 m`** | `2026-03-01 02:29 GMT` | Todos os 2.852 registros classificados como `Bruto`; captura a recessão da cheia iniciada no fim de fevereiro de 2026. |

### 4.3. Amostra direcionada de formato, unidade e timestamps (Tarefa 7)

Abaixo estão apenas amostras mínimas sanitizadas extraídas durante a inspeção local (sem publicação de séries brutas):

- **Aba `2012` (horário local declarado implicitamente em `DATA E HORA `, 4 colunas, nível em `D`):**
  - `2012-01-01 00:00` → `CHUVA (mm) = 0.2` | `CHUVA COLETADA = 125.4` | `NIVEL (m) = 2.97`
  - `2012-01-01 00:15` → `CHUVA (mm) = 0` | `CHUVA COLETADA = 125.4` | `NIVEL (m) = 3`
- **Aba `2022` (`Data e Hora (GMT)`, 9 colunas, nível bruto em `C` e corrigido em `E`):**
  - `2022-01-01 00:00` → `Chuva (mm) = 0` | `Nível (m) = 2.99915` | `Correção Nível = 2.99915` | `Origem = Bruto`
  - `2022-01-01 00:15` → `Chuva (mm) = 0` | `Nível (m) = 2.99915` | `Correção Nível = 2.99915` | `Origem = Bruto`
- **Aba `2026` (`Data e Hora (GMT)`, 11 colunas, com `Classificação` explícita):**
  - `2026-02-01 00:00` → `Chuva (mm) = 0` | `Nível (m) = 2.19043` | `Correção Nível (m) = 2.19043` | `Origem = Bruto` | `Classificação = Bruto`
  - `2026-02-01 00:14` *(arredondamento de serial Excel para `00:15`)* → `Chuva (mm) = 0` | `Nível (m) = 2.19043` | `Classificação = Bruto`

**Regra de normalização (`source -> record -> normalization`) para futuros pipelines:**
1. Detectar esquema por aba (`4 colunas` em 2011–2014 vs. `9 colunas` em 2021–2023 vs. `11 colunas` em 2015–2020/2024–2026), nunca por índice fixo de coluna.
2. Tratar timestamps de `2011`–`2014` como horário local (`America/Sao_Paulo`, atenção a horário de verão brasileiro vigente em jan/2012, UTC-2, a confirmar com INEA) e de `2015` em diante como `UTC`/`GMT`, aplicando arredondamento controlado de seriais Excel ao minuto mais próximo (`00:14:59.999` → `00:15:00`). **Não** reutilizar o parser de fuso do XML operacional do INEA sem validação separada.
3. Converter `m` → `cm` preservando `rawValue`, `unitOriginal = "m"`, `Correção Nível (m)` separada de `Nível (m)`, e propagar `Classificação` (`Bruto`, `Ajustado`, `Suspeito`, `Invalidado`, `Ausente`) para `qualityFlags`.
4. Sinalizar valores negativos (ex.: `-0,769 m` em 2022) e períodos `Suspeito`/`Invalidado` antes de qualquer análise estatística.

---

## 5. Confronto com RHN `58790002` e divergência de coordenadas (Tarefa 5)

### 5.1. Comparação estrutural entre INEA `58774000` e RHN/SGB `58790002`

| Parâmetro | INEA `213042120` / ANA `58774000` | RHN/SGB `58790002` (Santo Antônio de Pádua II) |
| --- | --- | --- |
| Nome oficial | `Santo Antônio de Pádua` | `SANTO ANTÔNIO DE PÁDUA II` |
| Responsável / Operadora | INEA-RJ / Água & Solo (ficha) ou INFOPER (ANA) | ANA / SGB-CPRM |
| Posição no Rio Pomba | 6 km a montante do centro urbano (margem direita) | Trecho urbano de Santo Antônio de Pádua |
| Área de drenagem | `7.957,99 km²` | `8.210 km²` (ANA) / `8.237 km²` (SGB SAH-Pomba 2024, Fig. 2) |
| Zero da régua | `83,299 m` *(datum vertical NÃO CONFIRMADO)* | `79,709 m` (`hgeoHNOR_IMBITUBA`, GPS geodésico, SGB 2024) |
| Cota de transbordo / inundação | `5,00 m` (`500 cm`) | `310 cm` (inundação / 1º dano); `275 cm` (alerta); `240 cm` (atenção) |
| Início da telemetria | `14/12/2011` | `01/02/2001` (ANA `HidroInventario`) |

### 5.2. Origem verificada das duas coordenadas publicadas para RHN `58790002`

O relatório do Gemini Deep Research identificou duas coordenadas distintas publicadas para a estação `58790002`. A auditoria de fontes primárias confirmou a **origem exata de ambas**:

| Par de coordenadas (decimal / GMS) | Fonte primária verificada | Contexto registrado na fonte | Distância entre os dois pontos |
| --- | --- | --- | --- |
| **`-21,5422; -42,1806`** (`21°32'32"S; 42°10'50"W`) | **ANA `ServiceANA.asmx/HidroInventario`** (consulta em 2026-11-25; `UltimaAtualizacao = 2022-02-14`) | Registrado para `58790002` (`SANTO ANTÔNIO DE PÁDUA II`, `AreaDrenagem = 8210 km²`). **A mesma coordenada exata** consta na ANA para as estações históricas desativadas `58790000` (1935–2002, ANA) e `58790001` (1964, DNOS), além do pluviômetro INMET `2142049`. O pluviômetro pareado SGB `2142067` aparece a ~200 m (`-21,5419; -42,1825`). | **`2,415 km`** (linha reta; `-21,5375; -42,1578` fica a ENE / jusante de `-21,5422; -42,1806`) |
| **`-21,5375; -42,1578`** (`21°32'15''S; 42°09'28''W`) | **SGB/CPRM — *Relatório Anual do Sistema de Alerta Hidrológico da Bacia do Rio Pomba – 2024***, **Tabela 1 (p. 15)** (`rigeo.sgb.gov.br/bitstream/doc/24903/1/relatorio_anual_2024_sah_pomba.pdf`) | Listado explicitamente na linha `Sto. Ant. de Pádua II | Código F: 58790002 | Código P: 02142067 | Rio: Pomba | 21°32'15''S | 42°09'28''W`. Ambos os pontos caem dentro da AOI oficial da mancha SGB 2024 (`[-42,2090; -21,5533]` a `[-42,1456; -21,5125]`). Na Fig. 2 (p. 14), a área de drenagem informada é `8.237 km²`. | |

### 5.3. Explicação causal da divergência

- **Status:** **NÃO CONFIRMADO.**
- Nenhuma das fontes públicas consultadas (ANA `HidroInventario`, Relatório SGB Mancha 2024, Relatórios SAH-Pomba 2021 e 2024) documenta explicitamente o motivo da diferença de `2,415 km` entre `-21,5422; -42,1806` e `-21,5375; -42,1578`.
- Hipóteses plausíveis (mantidas **em aberto**, sem escolha sem evidência):
  1. realocação física da estação `58790002` (ou da PCD/seção de réguas) em relação à antiga `58790000`, mantendo na ANA a coordenada herdada de `58790000`;
  2. coordenadas distintas para sensores/estruturas diferentes (ex.: régua linimétrica vs. PCD telemétrica vs. seção de medição de vazão);
  3. erro cadastral ou atualização pendente no banco `HidroInventario` da ANA ou na Tabela 1 do relatório SAH-Pomba 2024.

---

## 6. Outras divergências e inconsistências documentadas

1. **Código `58790002` na planilha de vazão do INEA (`Santo Antônio de Pádua_Q.xlsx`):** o arquivo localizado na pasta do INEA `Medição de Descarga Líquida/Santo Antônio de Pádua/` lista 8 medições ADCP (2017–2019) atribuídas na coluna A ao código **`58790002`**, e não ao `58774000`. A ficha de campo de `23/01/2018` (`Sto Ant de Pádua 23-1-18.pdf`) identifica o local apenas como `Pm331 / Sant Ant. Padua / Rio Pomba`, sem coordenadas nem código RHN. Permanece **NÃO CONFIRMADO** em qual seção física essas medições foram realizadas e se houve erro de codificação na planilha do INEA.
2. **Coordenada incorreta nos índices `Convencionais` (`BD_FLU` e `BD_PLU`):** `ÍNDICE_DOS_BANCOS_DE_DADOS.xlsx` lista `58774000` e `2141094` (`SANTO ANTÔNIO DE PÁDUA / ALERTA CHEIAS`) com `-21,4894; -41,6328` (~`57,0 km` a leste, fora do município de Santo Antônio de Pádua — erro cadastral evidente).
3. **Aba `2013` contendo dados de `2014`:** em `Santo Antonio de Pádua.xlsx`, a aba rotulada `2013` possui datas de `2014-01-01` a `2014-12-23`, deixando o ano de `2013` completamente ausente.
4. **Estações adicionais cadastradas na ANA em Santo Antônio de Pádua:** além de `58774000` (INEA, `-21,5111; -42,2075`) e `58790002` (SGB/ANA, `-21,5422; -42,1806`), o `HidroInventario` lista `58789000` (`PONTE PARAOQUENA`, INEA, `-21,4953; -42,2533`, ativa no Drive) e `58775000` (`SANTO ANTÔNIO DE PÁDUA`, INEA-RJ, `-21,5494; -42,1769`, sem início de série listado e ausente em `InventarioINEA2026.xlsx`).
5. **Pequena divergência de cota máxima de `08/01/2023` entre dois relatórios SGB:** o relatório de mancha SGB (set/2024, p. 12) registra `431 cm` em `08/01/2023`, enquanto o relatório anual SAH-Pomba (jul/2024, Tabela 5, p. 17) registra `428 cm` em `08/01/2023` (possivelmente diferença entre leitura telemétrica instantânea vs. máxima diária ou revisão de consistência — **NÃO CONFIRMADO**).

---

## 7. Condições de utilização dos dados (Tarefa 6)

O acervo está publicado em pasta pública denominada `Dados Públicos` no Google Drive, porém **não foi encontrado nenhum arquivo `LICENSE`, `README` ou termo de uso explícito dentro da pasta**, e o PDF `Orientações_Drive.pdf` não pôde ser acessado diretamente a partir do ambiente cloud (timeout). O portal RJ Digital (`rj.gov.br/servico/monitoramento-hidrometeorologico-dados-historicos39`) descreve o fornecimento histórico como serviço público gratuito mediante solicitação formal com justificativa de uso.

| Dimensão de uso | Situação verificada | Regra adotada no Pádua FloodSim |
| --- | --- | --- |
| **Acesso** | Público e gratuito via link institucional do Google Drive (`Dados Públicos`), sem exigência de login. | Permitido para consulta acadêmica e auditoria pontual; citar INEA-RJ e link oficial. |
| **Armazenamento local (pesquisa)** | Não há proibição explícita observada, mas termos formais do `Orientações_Drive.pdf` estão **NÃO CONFIRMADO**. | Manter apenas cópias locais temporárias em diretórios ignorados pelo Git (`data/raw/` ou `/tmp`), com manifestos e hashes SHA-256. |
| **Processamento / análise acadêmica** | Compatível com finalidade pública/científica mediante citação da fonte; condições específicas do PDF **NÃO CONFIRMADO**. | Permitido para pesquisa reprodutível offline (QC, comparação de eventos, artigo científico), mantendo classificação `observed` / `processed` e atribuição obrigatória ao INEA. |
| **Consumo automatizado (scraping / polling contínuo)** | **NÃO CONFIRMADO / SEM AUTORIZAÇÃO EXPLICITA.** O Google Drive não é API operacional com SLA ou política de rate limit publicada pelo INEA. | **Bloqueado** no código da aplicação e em CI/cron. Não criar coletor automatizado sobre o Drive sem autorização formal do INEA. |
| **Redistribuição (dados brutos ou derivados públicos)** | **NÃO CONFIRMADO.** A disponibilização pública não implica autorização irrestrita de redistribuição no GitHub ou em APIs públicas. | **Proibido** commitar planilhas brutas ou espelhar o acervo no GitHub. Publicar apenas metadados, hashes, estatísticas agregadas e instruções de obtenção junto à fonte original até confirmação formal. |

---

## 8. Bloqueios e limitações técnicas registradas

1. **Bloqueio de rede no ambiente cloud para `www.inea.rj.gov.br`:** tentativas via `curl` (`187.62.129.119:443`) resultaram em *connection timed out* após 25 s; ferramenta de navegação também não conseguiu acessar o PDF. Não houve contorno de restrições. A verificação direta do texto integral de `Orientações_Drive.pdf` deve ser feita a partir de rede local brasileira ou confirmada junto ao INEA.
2. **Lacuna de janeiro de 2023 na estação INEA `58774000`:** inviabiliza o uso da série INEA para validar o pico histórico de `08/01/2023`.
3. **Ausência de datum vertical e de curva-chave para `58774000`:** impede conversão altimétrica rigorosa para o MDE/manchas do SGB (`hgeoHNOR_IMBITUBA`) e cálculo independente de vazão na seção do INEA.

---

## 9. Perguntas institucionais pendentes (não enviar sem autorização)

### 9.1. Para o INEA (`alertadecheias@gmail.com` / `geseg@inea.rj.gov.br`)

1. **Termos de uso e redistribuição:** Quais são as condições formais de uso dos arquivos da pasta `Dados Públicos` do Google Drive (`Orientações_Drive.pdf`) para pesquisa acadêmica (armazenamento local, processamento estatístico, publicação de figuras/métricas em artigo científico e eventual redistribuição de derivados)?
2. **Datum vertical e zero da régua (`58774000` / `213042120`):** Na Ficha Descritiva de Santo Antônio de Pádua, a altitude do zero da régua consta como `83299` (interpretada como `83,299 m`), enquanto `InventarioINEA2026.xlsx` registra `Não Possui`. Esse valor corresponde a `83,299 m`? Qual é o **datum vertical** de referência (ex.: Imbituba/SGB, IBGE/hgeoHNOR, elipsoidal WGS84 ou nível local arbitrário) e houve nivelamento geodésico recente?
3. **Fuso horário (2011–2014 vs. 2015–2026):** Os registros de `2011`–`2014` em `Santo Antonio de Pádua.xlsx` estão em horário oficial de Brasília com horário de verão (UTC-2 em janeiro de 2012) ou em UTC-3 fixo? O XML operacional (`21304212020.xml`) adota horário local de Brasília ou GMT/UTC?
4. **Aba `2013` e lacuna de janeiro de 2023:** Existe arquivo separado com os dados telemétricos de `2013` (já que a aba `2013` contém `2014`)? Existe backup de memória interna ou leitura de observador para `01/01/2023` a `18/01/2023`?
5. **Medições de vazão (`Santo Antônio de Pádua_Q.xlsx`) e estação `58775000`:** As 8 medições de descarga líquida (2017–2019) na pasta `Santo Antônio de Pádua` foram executadas na seção da estação INEA `58774000` (e o código `58790002` na coluna A é erro de digitação) ou na seção da estação SGB `58790002`? Qual é o status da estação `58775000` cadastrada na ANA sob responsabilidade `INEA-RJ`?
6. **Situação de consistência de 2026:** Há previsão de consistência/revisão dos registros marcados como `Suspeito` em janeiro de 2026 e `Bruto` em fevereiro–março de 2026?

### 9.2. Para a ANA (`hidro@ana.gov.br` / `telemetria@ana.gov.br`)

1. **Coordenada cadastral de `58790002`:** No `HidroInventario`, `58790002` (`SANTO ANTÔNIO DE PÁDUA II`) compartilha exatamente a coordenada `-21,5422; -42,1806` com as estações desativadas `58790000` e `58790001`, divergindo em `2,415 km` da coordenada publicada pelo SGB no Relatório Anual SAH-Pomba 2024 (`-21,5375; -42,1578`). Qual coordenada representa a localização atual da régua e da PCD de `58790002`?
2. **Cadastro de `58774000` e `58789000`:** As séries históricas das estações INEA `58774000` (Santo Antônio de Pádua) e `58789000` (Ponte Paraoquena) são replicadas na base HidroWeb/RHN da ANA ou permanecem exclusivamente no repositório do INEA?
3. **Acesso institucional ao HidroWebService (REST):** Confirmar andamento/requisitos do credenciamento institucional para consulta de séries consistidas e metadados de revisão (complementando `docs/experiments/HIDROWEBSERVICE_ACCESS_REQUEST.md`).

### 9.3. Para o SGB / CPRM (`seus@sgb.gov.br` / SUREG-SP — SAH-Pomba)

1. **Coordenadas oficiais da estação `58790002`:** Confirmar a origem e a localização exata da coordenada `21°32'15''S; 42°09'28''W` (`-21,5375; -42,1578`) publicada na Tabela 1 do Relatório Anual SAH-Pomba 2024 frente à coordenada da ANA (`-21,5422; -42,1806`), esclarecendo se houve realocação da estação, diferença entre régua/PCD ou ajuste cadastral.
2. **Referência altimétrica e localização da régua no estudo de mancha (2024):** Confirmar a coordenada exata da seção de réguas nivelada com GPS geodésico (`zero = 79,709 m`, `hgeoHNOR_IMBITUBA`) usada para calibrar o modelo HEC-RAS do relatório de setembro de 2024.
3. **Diferença `431 cm` vs. `428 cm` em `08/01/2023`:** Esclarecer se a diferença entre a cota máxima citada no relatório de mancha (`431 cm`) e na Tabela 5 do relatório SAH-Pomba 2024 (`428 cm`) decorre de pico telemétrico instantâneo vs. leitura convencional/revisão de consistência.
4. **Série recente de fevereiro–março de 2026:** Confirmar disponibilidade e status de consistência dos dados de `58790002` no evento de fevereiro–março de 2026 para eventual comparação com a série INEA `58774000` (`6,31 m` em `28/02/2026`).
