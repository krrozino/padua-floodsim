# R02-F — Aquisição, Auditoria e Validação dos Limites dos Bairros de Santo Antônio de Pádua (RJ)

**Projeto:** Pádua FloodSim  
**Governança:** Programations Engineering Standard 2.0 — Research  
**Data da auditoria:** `2026-11-25`  
**Branch:** `research/municipal-neighborhood-boundaries`  
**Issues relacionadas:** `#10` (Limites dos 27 bairros), `#20` (Sobreposição territorial por bairro), `#53` (Backlog mestre), `#7` e `#9` (Validação espacial local e modelo digital de terreno)  
**Status de aquisição vetorial:** **`BLOCKED_DATA_SOURCE`** (`27/27` bairros oficiais identificados em lei; `0/27` polígonos oficiais ou georreferenciáveis disponíveis em fontes públicas)

---

## 1. Sumário Executivo

Esta pesquisa executou uma varredura sistemática em fontes municipais, estaduais, federais e colaborativas para localizar limites geográficos confiáveis dos **27 bairros oficiais** da sede urbana (1º Distrito) de Santo Antônio de Pádua, RJ, visando viabilizar a reconstrução cientificamente defensável do painel territorial de impacto por cenário de inundação (`#10` e `#20`).

### Principais conclusões

1. **Existência jurídica e nomenclatura oficial confirmadas (`27` bairros):** a **Lei Municipal nº 3.864, de 27/12/2017** (*Planta Genérica de Valores — PGV*, Anexos VI e XIII) cria e enumera oficialmente **27 bairros** na sede urbana (`16` na margem direita e `11` na margem esquerda do Rio Pomba). Além disso, foi localizada e auditada a **Lei Municipal nº 4.135, de 17/11/2021**, que atualiza a PGV a partir de 2022 e publica a *Tabela I — Valor do m² por Logradouro* (`1.065` registros), confirmando a vigência cadastral dos códigos `01` a `27` (sede) e separando-os das localidades distritais (`28` a `44`), além de corrigir erros de digitação do texto de 2017 (`Ferreira` no lugar de `FERRERIRA`; `Pereira` no lugar de `PERERIRA`).
2. **Ausência de geometria pública (`0/27` polígonos utilizáveis -> `BLOCKED_DATA_SOURCE`):**
   - O Anexo VI da Lei nº 3.864/2017 (`p. 34`) registra expressamente `* Vide Mapa em anexo` e o Anexo XIII (`p. 42`, Ata de `25/07/2017`) afirma que os limites *"se encontram na PGV"*. Contudo, **o mapa anexo não foi publicado no portal da Prefeitura**, e **73 das 137 páginas** do PDF oficial sancionado encontram-se em branco (contendo apenas o timbre municipal).
   - A Lei nº 4.135/2021 publica apenas tabela alfanumérica de logradouros, sem mapa, memorial descritivo de perímetros ou coordenadas, sendo vários logradouros compartilhados por dois ou três bairros adjacentes.
   - O **IBGE** possui **`0` registros** para Santo Antônio de Pádua (`3304706`) na *Malha Territorial de Bairros do Censo Demográfico 2022* (`RJ_bairros_CD2022.zip`) e mantém `CD_BAIRRO` e `NM_BAIRRO` vazios em **100% dos setores censitários** de 2010 (`71` setores) e 2022 (`154` setores).
   - A base estadual/federal **BC25_RJ (1:25.000, IBGE/SEA-RJ/INEA)**, o pacote **SGB/CPRM 2015** (`doc/15089`), os mapas **M1–M6 do Plano Diretor de 2018**, os mapas **CAD do PMSB (2019/2024)** e o **OpenStreetMap** tampouco contêm polígonos dos bairros.
3. **Respeito estrito à integridade científica:** em conformidade com a Ordem de Preferência (Seção 4) e as regras do projeto, **nenhum polígono foi inventado**, setores censitários não foram convertidos em bairros e pontos colaborativos (`11` nós `place=suburb` compatíveis no OSM) não foram expandidos por diagramas de Voronoi ou cascos convexos. O estado formal **`BLOCKED_DATA_SOURCE`** foi registrado nos metadados versionados ([`neighborhood_registry.json`](file:///home/antigravity/krrozino/padua-floodsim/data/metadata/neighborhoods/neighborhood_registry.json)) e no contrato de domínio ([`lib/neighborhoods/`](file:///home/antigravity/krrozino/padua-floodsim/lib/neighborhoods/contract.ts)), onde bairros sem geometria validada são classificados obrigatoriamente como **Cinza** (*dados indisponíveis ou insuficientes*).
4. **Validação espacial local (`Praça Monsenhor Diniz`, `Ilha da Convivência` e avenidas marginais):** a auditoria métrica em `SIRGAS 2000 / UTM 23S (EPSG:31983)` confirmou que o arquivo `COTA_300cm` utilizado pelo projeto preserva integralmente as coordenadas oficiais do SGB (`SHA-256: 100cd53b...`). Na `COTA_300cm`, a mancha oficial intercepta `11,54%` (`493,0 m²`, penetração máxima de `11,35 m`) da borda sudoeste da `Praça Monsenhor Diniz`, `67,3%` (`251,6 m`) da `Avenida Senar Frederico Rocha` e `30,68%` a `36,63%` das bordas baixas da `Ilha da Convivência`, poupando integralmente a `Rua Coronel Olivier` (`0,0%`, a `20,79 m`). Essa divergência aparente frente à cota de primeiro dano publicada pelo SGB (`310 cm` na régua `58790002`) explica-se fisicamente pela combinação de: (i) declividade longitudinal da linha d'água (`~1,0 m/km` ao longo dos `~2,4 km` entre a estação `58790002` a jusante, cota `79 m` na BC25, e o Centro/Ilha da Convivência, onde a BC25 registra pontos cotados de `84,0 m` nas margens e `86,0 m` no topo da ilha); (ii) reamostragem do MDE seco VANTE de `10 cm` para **`10 m`**, suavizando muros de contenção e taludes estreitos em `~1 célula` (`10–11,35 m`) na submalha de `1 m` do RAS Mapper; (iii) modelagem HEC-RAS 1D uniforme em canal bifurcado por ilha; e (iv) incerteza posicional do OSM (`±2–8 m`).

---

## 2. Avaliação segundo a Ordem de Preferência (A–D)

| Nível | Categoria de fonte | Resultado em Santo Antônio de Pádua (`2026-11-25`) | Decisão adotada |
|---|---|---|---|
| **A** | Polígonos vetoriais oficiais da Prefeitura | **Inexistente em acesso público.** O próprio PMSB municipal (*Anexo VIII, Programa A.PI-1*) documenta que a Prefeitura ainda não dispõe de Cadastro Técnico Multifinalitário / SIG implantado. | Solicitar formalmente à Prefeitura (ver Seção 8). |
| **B** | Base cartográfica fornecida por órgão público com procedência e autorização | **Sem polígonos de bairros.** IBGE (`RJ_bairros_CD2022` = `0` registros; `RJ_setores_CD2022` com `CD_BAIRRO` vazio), IBGE/SEA-RJ `BC25_RJ` (`0` limites intramunicipais urbanos) e SGB/CPRM 2015 (`0` bairros). | Não aplicável para bairros; `BC25_RJ` retida como referência altimétrica/hidrográfica auxiliar (`#7`/`#9`). |
| **C** | Digitalização georreferenciada de mapa municipal oficial (`derived`) | **Bloqueada pela omissão do mapa anexo.** A Lei nº 3.864/2017 remete a `* Vide Mapa em anexo` (`p. 34`), porém o mapa não consta no PDF publicado; os mapas `M1–M6` do Plano Diretor (2018) e as pranchas do PMSB (2024) não trazem divisas de bairros. | Solicitar o *Mapa Anexo da PGV* (Lei 3.864/2017 / Predial Cadastros) para eventual vetorização `derived` sob licença clara. |
| **D** | Outras delimitações documentadas e avaliadas (referência auxiliar) | **Insuficientes para gerar polígonos.** O OpenStreetMap possui apenas `13` nós pontuais `place=suburb` (`11` correspondentes à PGV e `2` populares) e `0` polígonos. A Lei nº 4.135/2021 traz `1.065` logradouros por bairro, mas sem geometria de lotes/quadras nem pontos de seccionamento de vias compartilhadas. | Registrar pontos OSM apenas como `auxiliary_reference_point_only` (`usableForPolygonIntersection: false`) e declarar **`BLOCKED_DATA_SOURCE`**. |

---

## 3. Auditoria Geoespacial Detalhada das Fontes Investigadas

> **Nota técnica de infraestrutura:** o subdomínio legado `https://santoantoniodepadua.itcast.com.br/...` expirou/sofreu timeout de conexão em `2026-11-25`; o acervo oficial ativo da Prefeitura responde em `http://santoantoniodepadua.rj.gov.br/portal/arquivo/...` (e `www.santoantoniodepadua.rj.gov.br`), preservando a estrutura de diretórios `/portal/arquivo/...`. Todos os arquivos inspecionados foram auditados em diretório temporário fora da árvore Git (`/tmp/r02f_audit/`), evitando versionamento de acervos brutos de terceiros.

### 3.1 Matriz consolidada de auditoria (14 requisitos técnicos e legais)

| # | Fonte / Arquivo | Instituição | URL auditada | Acesso | Licença / Condições de uso | Abrangência | Escala / Resolução | CRS | Precisão conhecida | Formato | Qtd. bairros (polígonos) | Qualidade topológica | Tamanho e SHA-256 | Redistribuição no Git |
|---:|---|---|---|---|---|---|---|---|---|---|---:|---|---|---|
| 1 | **Lei nº 3.864/2017** (*PGV 2018*) | Prefeitura de S. A. de Pádua (*elaboração técnica: Predial Serviços de Cadastros e Valores Ltda.*) | `http://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2017/12-dezembro/lei_sancionada_no_3.864-17.pdf` | `2026-11-25` | Ato normativo público (Lei Federal nº 12.527/2011 — LAI) | Sede urbana (1º Distrito) | N/A (mapa omitido) | N/A | Nomenclatura oficial exata; `73/137` páginas em branco no PDF | PDF (`137` pág.) | `27` nomes (`0` políg.) | Sem geometria | `1.962.244` B · `379a5accce9c37a31ce160cad9dc6b3164a455a540cabfc4a151f8ed6e95a971` | Metadados/nomes públicos; PDF bruto não versionado |
| 2 | **Lei nº 4.135/2021** (*Atualiza PGV / Tabela I*) | Prefeitura de S. A. de Pádua | `http://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2021/11-novembro/lei_sancionada_no_4.135-21.pdf` | `2026-11-25` | Ato normativo público (LAI) | Sede (`1–27`) + distritos (`28–44`) | Tabular (`1.065` logradouros) | N/A | Associação oficial rua-bairro; sem seccionamento métrico | PDF digitalizado (`18` pág.) | `27` nomes (`0` políg.) | Sem geometria | `934.409` B · `7d0482d79a0b8cca038b340f51abae42f0448b2ecd93386b355bc17fba9081a2` | Metadados públicos; PDF bruto não versionado |
| 3 | **Leis PGV anteriores** (`3.537/13`, `3.643/14`, `3.705/15`, `3.775/16`) | Prefeitura de S. A. de Pádua | `http://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2013..2016/...` | `2026-11-25` | Atos normativos públicos | Município | N/A (1 pág. cada, reajuste percentual) | N/A | Sem anexos cartográficos | PDF (`1` pág.) | `0` (`0` políg.) | Sem geometria | `3.537`: `104.677` B (`87471a18...`); `3.643`: `106.515` B (`b78b3df7...`); `3.705`: `153.831` B (`1cf81554...`); `3.775`: `129.694` B (`54449057...`) | Não aplicável |
| 4 | **Leis de Perímetro Urbano** (`3.651/2015` e `3.687/2015`) | Prefeitura de S. A. de Pádua | `http://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2015/...` | `2026-11-25` | Atos normativos públicos | 5º Distrito (Ibitinema) e eixo RJ-186 (1º Distrito) | Descritivo textual / 2 pontos | Não especificado | Sem divisas internas de bairros | PDF | `0` (`0` políg.) | Sem geometria poligonal | `3.651`: `96.081` B (`7b0f9926...`); `3.687`: `92.725` B (`088108e7...`) | Não aplicável |
| 5 | **Plano Diretor 2018** (`Lei 3.922/2018` + Mapas `M1–M6`) | Prefeitura de S. A. de Pádua / IBAM | `http://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2018/11-novembro/` | `2026-11-25` | Ato normativo e anexos públicos | Município e sede urbana | `1:125.000` (`M1–M3, M5`) e `1:35.000` (`M4, M6`) | Não informado no carimbo; sem grade de coordenadas | Macrozonas e zonas urbanas (`ZPROPOMBA`, `ZOUP`, `ZRU` etc.); sem bairros | PDF | `0` (`0` políg.) | Sem camada de bairros e sem graticulado | Lei `3.922`: `333.074` B (`b6ceb430...`); `M4`: `450.895` B (`0682ee0a...`); `M6`: `800.155` B (`a3cdcdca...`) | Apenas metadados |
| 6 | **PMSB SES 2024 — Setores Sede Urbana** (`setores_censitarios_-_sede_urbana.pdf`) | Prefeitura / AGEVAP / Fortaleza Ambiental | `http://www.santoantoniodepadua.rj.gov.br/portal/arquivo/36/2024/volume_1_relatorio_tecnico_preliminar_rtp/tomo_iv_n_desenho/setores_censitarios_-_sede_urbana.pdf` | `2026-11-25` | Relatório técnico público (Contrato `02/2024`) | Sede urbana (`706,39 ha`) | `1:3.500` (`7` pranchas CAD) | `EPSG:31983` (`SIRGAS 2000 / UTM 23S`) | Polígonos são `37` setores de saneamento (`CS01–CS37`); tabela lista apenas ruas | PDF vetorial CAD | `0` (`0` políg.) | Topologia de setores, não de bairros | `10.180.389` B · `609e59c3c3d098383141e89193db2de4ecb5df6ca8ced1ca5646012d8a2cbb08` | Não redistribuído |
| 7 | **PMSB 2024 Diagnóstico & PMSB 2019 Drenagem** | Prefeitura / AGEVAP | `http://www.santoantoniodepadua.rj.gov.br/portal/arquivo/36/2024/...` e `/19/2019/...` | `2026-11-25` | Relatórios públicos municipais | Município | Relatórios técnicos | N/A | Documentam ausência de SIG municipal, ZIDs do PAE Barra do Braúna e existência do *Vol. II Tomo I — Levantamento Topográfico (2024)* | PDF | `0` (`0` políg.) | N/A | `pmsb2024_diagnostico`: `8.294.152` B (`ff0abfe5...`); `pmsb2019_vol6_drenagem`: `8.905.036` B (`119b6299...`) | Apenas metadados |
| 8 | **IBGE Malha de Bairros 2022** (`RJ_bairros_CD2022.zip`) | IBGE | `https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/bairros/shp/UF/RJ_bairros_CD2022.zip` | `2026-11-25` | Dados abertos governamentais (atribuição IBGE) | `31` municípios do RJ (`1.509` bairros) | Base censitária urbana IBGE | `EPSG:4674` (`SIRGAS 2000`) | Oficial IBGE, porém **`0` registros para `3304706`** | Shapefile | `0` em Pádua (`0` políg.) | N/A para `3304706` | `3.287.988` B · `8eb963e547e8bc2e95b9a94fb5492f660d0828e4e5ec0211f4bb1f3ceae5546e` | Permitida, mas vazia para Pádua |
| 9 | **IBGE Setores Censitários 2022 e 2010** + **Descrições RJ** | IBGE | `https://geoftp.ibge.gov.br/.../censo_2022/setores/shp/UF/RJ_setores_CD2022.zip` | `2026-11-25` | Dados abertos governamentais (atribuição IBGE) | `154` setores em 2022 (`73` urbanos na sede); `71` em 2010 | Base censitária IBGE | `EPSG:4674` (`SIRGAS 2000`) | `CD_BAIRRO` e `NM_BAIRRO` vazios em **100%** dos setores | Shapefile + XLSX | `0` (`0` políg.) | Topologia censitária válida; sem relação 1:1/N:1 com bairros | `2022`: `32.297.299` B (`88dc4a6c...`); `2010`: `15.815.423` B (`1a794c55...`) | Não usar como bairros |
| 10 | **IBGE CNEFE 2022 Coordenadas** (`3304706.zip`) | IBGE | `https://ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/Censo_Demografico_2022/Coordenadas_enderecos/Municipio/33_RJ/3304706.zip` | `2026-11-25` | Dados abertos IBGE | `25.749` endereços geocodificados em `3304706` | Pontual por endereço | `EPSG:4674` | Pontos de edificações; não delimita perímetros de bairros | CSV (`ZIP`) | `0` (`0` políg.) | Nuvem de pontos (proibido Voronoi como limite oficial) | `164.535` B · `9e872278ae8dc686e3795db42048318306645acb2b64f1cd9ad6a26f8d3c6d0e` | Apenas referência futura de exposição |
| 11 | **BC25_RJ (EDGV 3.0)** | IBGE / SEA-RJ / INEA | `https://geoftp.ibge.gov.br/cartas_e_mapas/bases_cartograficas_continuas/bc25/rj/versao2018_edgv_3.0/` | `2026-11-25` | Dados abertos IBGE / Estado do RJ | Estado do RJ (inclui Pádua) | `1:25.000` (PEC Classe A) | `EPSG:4674` (`SIRGAS 2000`) | `0` limites intramunicipais de bairros; `427` pontos cotados e `48` ilhas na AOI urbana | Shapefile + CSV | `0` (`0` políg.) | Excelente para hidrografia e altimetria (`#7`/`#9`) | CSV nomesgeo: `14.330.093` B · `1d4924705f12309c241d5d30e13df9c3792bf7ce3650abdf661feae05566307e` | Permitida com atribuição |
| 12 | **SGB/CPRM 2015 — Carta de Suscetibilidade** (`doc/15089`) | CPRM / SGB | `https://rigeo.sgb.gov.br/handle/doc/15089` | `2026-11-25` | PDF permite uso com citação; `license.txt` do ZIP é template DSpace não preenchido | Município de S. A. de Pádua | Mapa `1:60.000`; MDE `30 m`; Ortofoto `1,0 m` | `EPSG:4674` e `EPSG:31983` | `bc_santoantoniodepadua_rj.zip` traz apenas pontos de distritos (`Distritos.shp`), sem bairros | SHP, MDB, Esri Grid, ECW | `0` (`0` políg.) | Sem camada de bairros | `bc_...zip`: `8.728.248` B · `fd3a14323576e591514aff20046b911248a890e0dc22b74a9660f84c47a9abfe` | Bloqueada até esclarecer `license.txt` |
| 13 | **SGB 2024 — Mancha de Inundação** (`COTA_300cm` e `COTA_325cm`) | SGB | `https://geoportal.sgb.gov.br/server/rest/services/hidrologia/mancha_santo_antonio_de_padua/MapServer` | `2026-11-25` | Serviço GIS público oficial (`official_reference`) | Trecho urbano do Rio Pomba | Submalha `1 m` sobre MDE seco `10 m` + 60 seções ADCP | `EPSG:4674` / `EPSG:4326` | Datum vertical `hgeoHNOR_IMBITUBA` (`Z0 = 79,709 m` em `58790002`) | GeoJSON | N/A (manchas) | MultiPolygon auditado (R02-C preservada sem alteração) | `300cm`: `755.946` B (`100cd53b...`); `325cm`: `749.198` B (`d71da1dd...`) | Consumo via serviço oficial |
| 14 | **OpenStreetMap API v0.6** (`padua_bbox.json`) | Colaboradores OpenStreetMap | `https://api.openstreetmap.org/api/0.6/map.json?bbox=-42.22,-21.56,-42.15,-21.51` | `2026-11-25` | Open Database License (`ODbL 1.0`) | BBox urbana (`9.516` elementos) | Colaborativa (Bing / IBGE) | `EPSG:4326` (`WGS84`) | `~2–8 m` em vias/praças; `0` polígonos de bairros e `13` nós pontuais `place=suburb` | JSON OSM | `11` pontos compatíveis (`0` políg.) | Sem polígonos de bairros; viário/praças úteis como apoio | `1.884.920` B · `16794b21458cff85504568e0a29fb045959e0ba00f64bc5bc435f18bff342875` | Permitida sob ODbL (apenas IDs/metadados versionados) |

---

### 3.2 Análise crítica das fontes municipais, censitárias e colaborativas

#### A. O defeito documental da Lei nº 3.864/2017 e o papel da Lei nº 4.135/2021
A inspeção página a página das `137` páginas de `lei_sancionada_no_3.864-17.pdf` (`SHA-256: 379a5acc...`) revelou que:
- Na **página 34 (Anexo VI — Relação de Bairros)**, a lei lista os `27` bairros divididos entre *Margem Direita do Rio Pomba* (`01` a `16`) e *Margem Esquerda do Rio Pomba* (`17` a `27`) e encerra com a remissão explícita **`* Vide Mapa em anexo`**.
- Na **página 42 (Anexo XIII — Ata da Reunião para Definição dos Bairros, de `25/07/2017`)**, a comissão municipal formada por *Antônio Carlos de Oliveira (Servidor Efetivo)*, *Alexandre de Castro Brasil (Secretário de Obras)*, *Henrique dos Santos Bastos (Engenheiro)* e *Ney Brandão de Sousa Júnior (Engenheiro)* delibera: *"ficaram determinados, a criação e os limites dos bairros abaixo, cujos limites se encontram na PGV"*.
- Contudo, **73 das 137 páginas** do PDF publicado no portal oficial (`p. 16–18, 46–61, 64–79, 82–97, 100–115, 122, 125–127, 131 e 134`) contêm exclusivamente o timbre do Gabinete do Prefeito, sem conteúdo tabular ou gráfico — omitindo tanto o *Anexo XVI (Tabela de Avaliação por Ordem de Bairros)* quanto a prancha cartográfica da PGV elaborada pela empresa contratada *Predial Serviços de Cadastros e Valores Ltda.* (CNPJ `09.073.860/0001-20`).
- Já a **Lei nº 4.135, de 17/11/2021** (`SHA-256: 7d0482d7...`), publica integralmente em `18` páginas digitalizadas a *Tabela I — Valor do m² por Logradouro* (`1.065` entradas), vinculando cada logradouro ou trecho fiscal ao código e nome do bairro (`1..27` na sede e `28..44` nos distritos). Todavia, diversos logradouros estruturantes atravessam múltiplos bairros sem indicação de coordenadas ou numeração métrica de corte — por exemplo, a `Av. Prefeito Alberto Vaz` aparece nos bairros `22 - Ferreira` e `25 - Mirante`; a `Rua Dr. Ferreira da Luz` aparece em `20 - Centro` e `22 - Ferreira`; e a `Rua Sebastião Teixeira de Carvalho` aparece em `19 - Carvalho`, `24 - Jorimpa` e `25 - Mirante`. Portanto, **não é cientificamente válido sintetizar polígonos fechados apenas a partir da Tabela I de logradouros**.

#### B. Por que setores censitários (IBGE 2010/2022 e PMSB CS01–CS37) não podem ser usados como bairros
A avaliação exigida pela Seção 3 confirmou três impedimentos objetivos para o uso de setores censitários como substitutos ou agregações diretas de bairros em Santo Antônio de Pádua:
1. **Atributos oficiais nulos:** nos arquivos `RJ_setores_CD2022.dbf` (`154` setores no município, `73` urbanos no distrito-sede `330470605`) e `rj_setores_censitarios.zip` de 2010 (`71` setores, `29` urbanos na sede), os campos `CD_BAIRRO` e `NM_BAIRRO` estão **100% em branco**, refletindo o fato de o município não ter depositado lei com descritivo cartográfico/georreferenciado de bairros junto ao IBGE antes do Censo 2022 (razão pela qual `RJ_bairros_CD2022.zip` possui `0` registros para `3304706`).
2. **Incompatibilidade topológica demonstrada nos memoriais do IBGE (`Descrição_RJ.xlsx`):** em todo o município, apenas `8` das `154` descrições de perímetros de setores mencionam nomes de bairros/loteamentos como referência pontual de caminhamento. Crucialmente, o setor `330470635000010` — pertencente ao **Distrito `35` (Paraoquena)** — descreve divisa direta com o *Loteamento Cidade Nova* (código `06` da sede na PGV), demonstrando que os recortes operacionais de coleta censitária e os bairros fiscais da PGV seguem lógicas territoriais distintas.
3. **Pranchas do PMSB 2024 (`setores_censitarios_-_sede_urbana.pdf`):** embora a tabela lateral das 7 folhas (`1:3.500`, `EPSG:31983`) possua uma coluna intitulada `"ABRANGÊNCIA - BAIRROS"` para os `37` setores (`CS01–CS37`, área total de `706,39 ha`), o preenchimento real das células lista apenas logradouros de referência (ex.: *Rua dos Leites, Rua Silva Jardim*), sem mapeamento para os `27` bairros da Lei nº 3.864/2017.

---

## 4. Inventário Oficial dos 27 Bairros e Reconciliação Nomenclatural

A tabela abaixo consolida os **27 bairros oficiais da sede urbana** identificados na legislação municipal, destacando os **7 bairros prioritários do mantenedor** (`★`), a reconciliação ortográfica entre os Anexos VI e XIII da Lei nº 3.864/2017 e a Tabela I da Lei nº 4.135/2021, a existência eventual de ponto auxiliar no OpenStreetMap (nunca utilizado como polígono) e o status geométrico atual.

| Nº | ID (`slug`) | Nome oficial reconciliado | Margem do Rio Pomba | Prioridade mantenedor | Grafia Lei 3.864/17 (Anexo VI) | Grafia Lei 3.864/17 (Anexo XIII — Ata) | Grafia Lei 4.135/21 (Tabela I) | Ponto auxiliar OSM (`place=suburb`) | Polígono utilizável |
|---:|---|---|---|---|---|---|---|---|---|
| 01 | `aeroporto` | **Aeroporto** | Direita | `★ Sim` | `AEROPORTO` | `AEROPORTO` | `Aeroporto` | `node/2661555812` (`-21.53124, -42.19480`) | Não (`Cinza`) |
| 02 | `alipio` | **Alípio** | Direita | Não | `ALÍPIO` | `ALÍPIO` | `Alípio` | — | Não (`Cinza`) |
| 03 | `arraialzinho` | **Arraialzinho** | Direita | Não | `ARRAIALZINHO` | `ARRAIALZINHO` | `Arraialzinho` | — | Não (`Cinza`) |
| 04 | `cafe-garoto` | **Café Garoto** | Direita | Não | `CAFÉ GAROTO` | `CAFÉ GAROTO` | `Café Garoto` | — | Não (`Cinza`) |
| 05 | `cehab` | **CEHAB** | Direita | Não | `CEHAB` | `CEHAB` | `Cehab` | `node/2661555842` (`-21.53076, -42.19804`) | Não (`Cinza`) |
| 06 | `cidade-nova` | **Cidade Nova** | Direita | `★ Sim` | `CIDADE NOVA` | `CIDADE NOVA` | `Cidade Nova` | `node/2661555848` (`-21.52760, -42.20682`) | Não (`Cinza`) |
| 07 | `dezessete` | **Dezessete** | Direita | Não | `DEZESSETE` | `DEZESSETE` | `Dezessete` | `node/2661555860` (`-21.52927, -42.20087`) | Não (`Cinza`) |
| 08 | `farol` | **Farol** | Direita | `★ Sim` | `FAROL` | `FAROL` | `Farol` | — | Não (`Cinza`) |
| 09 | `gabri` | **Gabri** | Direita | Não | `GABRI` | `GABRI` | `Gabry` *(variante)* | `node/2661555901` (`Gabry`, `-21.54757, -42.19029`) | Não (`Cinza`) |
| 10 | `gloria` | **Glória** | Direita | Não | `GLÓRIA` | `GLÓRIA` | `Glória` | — | Não (`Cinza`) |
| 11 | `monte-libano` | **Monte Líbano** | Direita | Não | `MONTE LÍBANO` | `MONTE LÍBANO` | `Monte Líbano` | — | Não (`Cinza`) |
| 12 | `parque-das-aguas` | **Parque das Águas** | Direita | Não | `PARQUE DAS ÁGUAS` | `PARQUE DAS ÁGUAS` | `Parque das Águas` | `node/2661555946` (`-21.54456, -42.18654`) | Não (`Cinza`) |
| 13 | `santa-afra` | **Santa Afra** | Direita | Não | `SANTA AFRA` | `SANTA AFRA` | `Santa Afra` | — | Não (`Cinza`) |
| 14 | `sao-felix` | **São Félix** | Direita | `★ Sim` | `SÃO FÉLIX` | `SÃO FÉLIX` | `São Félix` | `node/2661555955` (`-21.54363, -42.18169`) | Não (`Cinza`) |
| 15 | `sao-luis` | **São Luis** | Direita | Não | `SÃO LUIS` | `SÃO LUIS` | `São Luiz` *(variante)* | — | Não (`Cinza`) |
| 16 | `sardemberg` | **Sardemberg** | Direita | Não | `SARDEMBERG` | `SARDEMBERG` | `Sardenberg` *(variante)* | — | Não (`Cinza`) |
| 17 | `alequicis` | **Alequicis** | Esquerda | Não | `ALEQUICIS` | `ALEQUICIS` | `Alequicis` | `node/2661555816` (`Alexis`, `-21.54904, -42.17124`) | Não (`Cinza`) |
| 18 | `barro-branco` | **Barro Branco** | Esquerda | Não | `BARRO BRANCO` | `BARRO BRANCO` | `Barro Branco` | — | Não (`Cinza`) |
| 19 | `carvalho` | **Carvalho** | Esquerda | Não | `CARVALHO` | `CARVALHO` | `Carvalho` | — | Não (`Cinza`) |
| 20 | `centro` | **Centro** | Esquerda | `★ Sim` | `CENTRO` | `CENTRO` | `Centro` | — | Não (`Cinza`) |
| 21 | `divineia` | **Divinéia** | Esquerda | `★ Sim` | `DIVINÉIA` | `DIVINÉIA` | `Divinéia` | `node/2661555867` (`Divineia`, `-21.53686, -42.16100`) | Não (`Cinza`) |
| 22 | `ferreira` | **Ferreira** | Esquerda | Não | `FERRERIRA` *(erro)* | `FERRERIRA` *(erro)* | `Ferreira` *(corrigido)* | — | Não (`Cinza`) |
| 23 | `industrial` | **Industrial** | Esquerda | Não | `INDUSTRIAL` | `INDUSTRIAL` | `Industrial` | — | Não (`Cinza`) |
| 24 | `jorimpa` | **Jorimpa** | Esquerda | Não | `JORIMPA` | `JORIMPA` | `Jorimpa` | — | Não (`Cinza`) |
| 25 | `mirante` | **Mirante** | Esquerda | `★ Sim` | `MIRANTE` | `MIRANTE` | `Mirante` | — | Não (`Cinza`) |
| 26 | `pereira` | **Pereira** | Esquerda | Não | `PERERIRA` *(erro)* | `PEREIRA` *(corrigido)* | `Pereira` *(confirmado)* | `node/2601989430` (`-21.53658, -42.17551`) | Não (`Cinza`) |
| 27 | `tavares` | **Tavares** | Esquerda | Não | `TAVARES` | `TAVARES` | `Tavares` | `node/2661555957` (`-21.54575, -42.17598`) | Não (`Cinza`) |

### Divergências toponímicas e registros excluídos do universo dos 27 bairros

1. **Topônimos populares no OpenStreetMap sem correspondência na PGV (`2` nós):** `Gerador` (`node/2661555907`, `-21.53048, -42.18847`) e `São José` (`node/2661555956`, `-21.53816, -42.18992`). Ambos foram catalogados separadamente em [`neighborhood_registry.json`](file:///home/antigravity/krrozino/padua-floodsim/data/metadata/neighborhoods/neighborhood_registry.json) como `osmPopularUnmatchedPoints` e **não** devem ser adicionados como bairros municipais oficiais sem respaldo legal.
2. **Localidades e loteamentos distritais na Lei nº 4.135/2021 (`códigos 28 a 44`):** `28 Baltazar`, `29 Santa Cruz`, `30 Marangatu`, `31 São Pedro de Alcântara`, `32 Chalé`, `33 Ibitinema`, `34 Lot. Dom Carlos`, `36 Lot. Vitória do Sapê - Chalé`, `37 Lot. Vitória - Chalé`, `38 Recanto das Garças`, `39 Santa Luzia`, `40 Monte Alegre`, `41 Paraoquena`, `42 Ibitiguaçu`, `43 Campelo` e `44 Salgueiro` (código `35` ausente na tabela original). Trata-se de sedes distritais e núcleos rurais fora da relação dos `27` bairros da sede urbana (AOI SGB), devendo permanecer segregados.

---

## 5. Preparação Técnica do Painel de Bairros (`#20`) e Metodologia de Classificação

Embora nenhum componente público de interface tenha sido modificado nesta etapa, o contrato de domínio e o motor determinístico de interseção foram implementados de forma desacoplada do MapLibre em:

- [`lib/neighborhoods/contract.ts`](file:///home/antigravity/krrozino/padua-floodsim/lib/neighborhoods/contract.ts) — tipos do contrato técnico, esquema de limiares versionado e salvaguardas semânticas;
- [`lib/neighborhoods/registry.ts`](file:///home/antigravity/krrozino/padua-floodsim/lib/neighborhoods/registry.ts) — inventário tipado dos `27` bairros oficiais, subconjunto prioritário (`7` bairros) e derivação explícita de cobertura parcial/bloqueada;
- [`lib/neighborhoods/evaluate.ts`](file:///home/antigravity/krrozino/padua-floodsim/lib/neighborhoods/evaluate.ts) — cálculo *fail-closed* de área territorial e área interceptada sobre o elipsoide WGS84 (latitude autálica + união e interseção topológica via `polygon-clipping`);
- [`tests/unit/neighborhoods/neighborhoods.test.ts`](file:///home/antigravity/krrozino/padua-floodsim/tests/unit/neighborhoods/neighborhoods.test.ts) — suíte automatizada de testes unitários.

### 5.1 Contrato de dados por bairro e cenário

Para cada par `(bairro, cota_selecionada)`, [`NeighborhoodScenarioEvaluation`](file:///home/antigravity/krrozino/padua-floodsim/lib/neighborhoods/contract.ts#L194-L216) exige e produz:

- `neighborhoodId` (`OfficialNeighborhoodId`) e `officialNumber` (`1..27`);
- `officialName` (nome oficial reconciliado) e `riverBank` (`"right"` | `"left"`);
- `source` e `version` (proveniência explícita da geometria);
- `territorialAreaM2` e `territorialAreaHa` ($A_{\text{bairro}}$, ou `null` quando indisponível/inválido);
- `interceptedAreaM2` e `interceptedAreaHa` ($A_{\text{inter}} = \text{Área}(G_{\text{bairro}} \cap G_{\text{cenário}})$, garantindo conservação física $0 \le A_{\text{inter}} \le A_{\text{bairro}}$);
- `interceptedPercent` ($P = 100 \times A_{\text{inter}} / A_{\text{bairro}}$, em `[0, 100]`, ou `null`);
- `selectedStageCm` (cota oficial SGB selecionada);
- `coverageAndQuality` (`status: "valid" | "unavailable" | "invalid_geometry" | "partial_unverified"`, contagem de partes e anéis internos, e motivo de falha fechada);
- `visualClass` (`"green" | "yellow" | "orange" | "red" | "gray"`), `thresholdSchemeId`, `thresholdCalibrationStatus` e `disclaimers`.

No nível agregado do painel, [`NeighborhoodPanelEvaluationSummary`](file:///home/antigravity/krrozino/padua-floodsim/lib/neighborhoods/contract.ts#L218-L232) impõe declaração explícita de cobertura parcial sempre que `usableNeighborhoodCount < 27` (ex.: se inicialmente apenas os `7` bairros prioritários forem obtidos, o painel exibirá obrigatoriamente `"Cobertura parcial declarada: 7 de 27 bairros oficiais..."` e manterá os `20` demais em **Cinza**).

### 5.2 Metodologia justificável para os limiares percentuais globais

O documento anterior [`docs/FLOOD_MODEL.md`](file:///home/antigravity/krrozino/padua-floodsim/docs/FLOOD_MODEL.md#L205-L217) trazia apenas um rascunho ilustrativo (`azul < 5%`, `amarelo 5–15%`, `laranja 15–35%`, `vermelho > 35%`) que agrupava indevidamente **`0%` (ausência de interseção)** e **`0,1%–4,9%` (interseção real já iniciada)** na mesma classe. A especificação R02-F corrige esse problema ao separar estritamente **ausência de interseção (`Verde`)** de **qualquer interseção positiva (`Amarelo` ou superior)**.

#### Princípios metodológicos propostos

1. **Invariância territorial (proibição de limiares *ad hoc* por bairro):** os pontos de corte $0 < T_1 < T_2 < 100\%$ devem ser **globais e idênticos para todos os bairros** (`appliesUniformlyToAllNeighborhoods: true`). Criar limiares diferentes para cada bairro sem modelagem física de exposição/vulnerabilidade introduziria viés subjetivo e invalidaria a comparabilidade inter-bairros.
2. **Separação estrita do zero (`Verde`):** com geometrias válidas, `Verde` ocorre exclusivamente quando $A_{\text{inter}} \le \varepsilon_0$ (onde $\varepsilon_0 = 0,01\text{ m}^2$ atua apenas como tolerância numérica contra micro-resíduos de ponto flutuante IEEE-754). Qualquer sobreposição física efetiva ($A_{\text{inter}} > 0,01\text{ m}^2$) ingressa no mínimo em `Amarelo`.
3. **Escala geométrica para variáveis proporcionais assimétricas em planícies de inundação:** em cidades ribeirinhas encaixadas como Santo Antônio de Pádua, a distribuição de $P = A_{\text{inter}} / A_{\text{bairro}}$ entre bairros de fundo de vale e bairros de encosta é fortemente assimétrica à direita (muitos valores próximos de `0%–10%` e cauda superior nos bairros marginais). Em distribuições proporcionais positivas assimétricas, **progressões geométricas (espaçamento logarítmico)** preservam poder discriminatório nas faixas iniciais de transbordamento melhor do que divisões lineares iguais (`25% / 50% / 75%`).
4. **Esquema candidato inicial (`PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0`, razão `4×`, marcado como `provisional_uncalibrated`):**
   - **Cinza (`gray`):** geometria do bairro ou do cenário indisponível, incompleta ou topologicamente inválida (`null`).
   - **Verde (`green`):** dados válidos e $A_{\text{inter}} = 0\text{ m}^2$ (`0%`).
   - **Amarelo (`yellow` — sobreposição territorial baixa):** $0\% < P \le 5\%$ (atingimento marginal/localizado de franja ribeirinha ou baixada).
   - **Laranja (`orange` — sobreposição territorial elevada):** $5\% < P \le 20\%$ (comprometimento expressivo de fração territorial do bairro, razão $4\times$ sobre $T_1$).
   - **Vermelho (`red` — sobreposição territorial muito elevada):** $P > 20\%$ (mais de um quinto da área total do bairro contida na mancha do cenário).
5. **Protocolo de calibração e análise de sensibilidade pós-aquisição (antes de ativação na UI pública):** assim que os polígonos oficiais dos bairros forem obtidos junto à Prefeitura, executar sobre a matriz completa de $N \times 11$ cenários SGB (`300 cm` a `550 cm`):
   - cálculo da distribuição empírica dos valores positivos $\{P_{i,c} > 0\}$;
   - comparação objetiva entre três candidatos globais: (a) geométrico `4×` (`5%` / `20%`), (b) quantis empíricos de valores positivos ($Q_{33}$ e $Q_{67}$) e (c) quebras naturais de Jenks/Fisher-Jenks sobre $\log(P)$;
   - análise de estabilidade de ranking e sensibilidade ($\pm 2$ pontos percentuais em $T_1, T_2$) para documentar e congelar a versão `1.0.0` calibrada antes da exibição pública.

### 5.3 Regras obrigatórias de segurança e comunicação de risco

- **Verde não significa garantia de segurança:** um bairro com `0%` de interseção com a mancha fluvial SGB pode sofrer alagamentos por drenagem pluvial urbana, enxurradas de encosta, refluxo de galerias, isolamento viário ou incertezas de resolução do MDE.
- **Vermelho não significa alerta oficial:** as cores representam unicamente a proporção geométrica de área interceptada por um cenário estático selecionado; alertas e ordens de evacuação competem exclusivamente à Defesa Civil, ao INEA e ao SGB.
- **Extensão planar $\neq$ criticidade física:** a criticidade física real depende de profundidade da lâmina d'água, velocidade de escoamento, tempo de permanência, exposição de edificações/população, infraestrutura crítica e validação em campo.

---

## 6. Validação Espacial Local: Praça Monsenhor Diniz, Ilha da Convivência e Avenidas Marginais (`#7` e `#9`)

### 6.1 Integridade da geometria oficial SGB e métricas de sobreposição

A verificação criptográfica confirmou que `COTA_300cm.geojson` (`755.946` bytes, `SHA-256: 100cd53b4ca6be2abf33fbefd9c0701c6765cc3bd609dead7e82cf3442be394f`) preserva exatamente as coordenadas originais servidas pelo MapServer oficial do SGB (auditoria R02-C). **Nenhuma geometria oficial do SGB foi alterada.**

Cruzando as camadas oficiais `COTA_300cm` (`82,71 m` na régua `58790002`, $Q = 624\text{ m}^3/\text{s}$) e `COTA_325cm` (`82,96 m`, $Q = 728\text{ m}^3/\text{s}$) com as feições georreferenciadas locais (`EPSG:31983` / `WGS84`), obtiveram-se os seguintes resultados quantitativos:

| Feição local de referência | Fonte geométrica da feição | Tipo / Dimensão total | Interseção em `COTA_300cm` | Interseção em `COTA_325cm` | Observação espacial auditada |
|---|---|---|---|---|---|
| **Praça Monsenhor Diniz** (`Centro`, margem esquerda) | OSM `way/260637176` (`-21.543205, -42.177210`) | Polígono · `4.272,0 m²` | **`493,0 m²` (`11,54%`)** · penetração máx. **`11,35 m`** | **`529,2 m²` (`12,39%`)** | Atinge apenas a faixa sudoeste voltada para o Rio Pomba / Av. Senar Frederico Rocha |
| **Av. Senar Frederico Rocha** (marginal esquerda entre a praça e o rio) | OSM `way/254402825` | Eixo viário · `374,0 m` | **`251,6 m` (`67,3%`)** | **`260,2 m` (`69,6%`)** | Eixo marginal situado imediatamente no talude/cais da margem esquerda |
| **Ilha da Convivência** (contorno colaborativo) | OSM `way/445129454` (`-21.543518, -42.178546`) | Polígono · `10.745,4 m²` | **`3.936,3 m²` (`36,63%`)** | **`4.499,2 m²` (`41,87%`)** | Inunda taludes marginais e pontas da ilha; platô central permanece emerso |
| **Ilha da Convivência** (contorno cartográfico oficial `1:25.000`) | IBGE/SEA `BC25_RJ` (`hid_ilha_a`, `-21.543554, -42.178531`) | Polígono · `9.822,1 m²` | **`3.017,0 m²` (`30,68%`)** | — | Confirma de modo independente do OSM a submersão apenas periférica da ilha |
| **Rua Coronel Olivier** (`RJ-116`, face nordeste da Praça Monsenhor Diniz) | OSM `way/537175835` e `way/537175837` | Eixos viários · `156,9 m` + `295,6 m` | **`0,0 m` (`0,0%`)** (`dist. mín. = 20,79 m`) | **`0,0 m` (`0,0%`)** | Totalmente fora da mancha em `300 cm` e `325 cm` |
| **Av. Chaim Elias** (margem direita / São Félix) | OSM `way/254399708` | Eixo viário · `212,2 m` | **`0,0 m` (`0,0%`)** (`dist. mín. = 24,52 m`) | **`0,0 m` (`0,0%`)** | Fora da mancha nos cenários iniciais |
| **Ponte Raul Veiga** e **Ponte Alberíades Gabry** | OSM `way/260637180` (`169,1 m`) e `way/254402843` (`239,1 m`) | Pontes fluviais | `100%` / `99,9%` em projeção 2D | `100%` / `100%` | Artefato geométrico 2D: a mancha representa o espelho d'água do canal sob o tabuleiro elevado das pontes |

### 6.2 Explicação físico-hidráulica e cartográfica da divergência local em `300 cm`

O relatório do SGB (2024) informa que na estação de referência **`58790002` (Santo Antônio de Pádua II)** a cota de **inundação/primeiro dano é `310 cm`** (`82,81 m`). À primeira vista, parece contraditório que a camada `COTA_300cm` (`82,71 m` na estação) já intercepte `67,3%` do eixo da `Av. Senar Frederico Rocha` e `11,54%` (`11,35 m` de penetração) da `Praça Monsenhor Diniz`. A auditoria cruzada com os pontos cotados fotogramétricos da **`BC25_RJ`** e com a geometria dos vértices do SGB esclarece quatro fatores técnicos objetivos:

1. **Declividade longitudinal da superfície livre d'água (`~1,0 m/km`):** a altitude `82,71 m` não é um plano horizontal estático aplicado a toda a cidade, mas a condição na seção da régua `58790002` (situada no Clube de Pesca, a jusante do Centro, onde a `BC25_RJ` registra ponto cotado de **`79,0 m`**). Cerca de **`2,4 km` a montante**, no trecho da `Ilha da Convivência` e da `Praça Monsenhor Diniz`, a `BC25_RJ` (`rel_ponto_cotado_altimetrico_p`) registra altitude ortométrica de **`86,0 m`** no topo da `Ilha da Convivência` (`-21.543502, -42.178636`) e **`84,0 m`** em dois pontos da margem esquerda adjacente (`-21.542083, -42.177536` e `-21.545111, -42.175868`). Sob vazão $Q = 624\text{ m}^3/\text{s}$, a linha d'água calculada pelo HEC-RAS sobe aproximadamente `2,0 a 2,4 m` entre a estação a jusante e o Centro, atingindo `~84,5–85,0 m` — valor coerente tanto com a emersão do núcleo de `86,0 m` da ilha quanto com o tangenciamento da cota marginal de `~84,0 m`.
2. **Reamostragem do MDE seco de `10 cm` para `10 m` versus submalha de `1 m` do RAS Mapper:** a análise estatística dos `359` segmentos de vértices da `COTA_300cm` no entorno da praça (`EPSG:31983`) revelou comprimentos modais exatos de **`0,71 m`** ($|\Delta E| = 0,50\text{ m}, |\Delta N| = 0,50\text{ m}$) e **`1,00 m`** ($1,00 \times 0,00\text{ m}$). Isso comprova que a exportação poligonal ocorreu em grade de `1 m`, mas sobre o terreno seco **reamostrado de `10 cm` para `10 m`** descrito pelo SGB (2024). Ao agregar pixels de `10 cm` em células de `10 m × 10 m` na borda do canal, a cota do leito/talude fluvial e a cota do topo do cais/muro de arrimo da `Av. Senar Frederico Rocha` sofrem suavização espacial de **1 célula (`10 m`)**, produzindo exatamente a faixa de intrusão horizontal de **`~10 a 11,35 m`** sobre a borda da praça!
3. **Simplificação hidráulica 1D uniforme em trecho bifurcado:** o modelo SGB 2024 adotou escoamento unidimensional uniforme (HEC-RAS 6.5 Beta) em um trecho onde o Rio Pomba se divide em dois braços ao redor da `Ilha da Convivência` sob duas pontes próximas (`Ponte Raul Veiga` e `Ponte Alberíades Gabry`), onde efeitos bidimensionais locais e perdas singulares alteram a partição real de vazão.
4. **Incerteza planimétrica do OpenStreetMap (`±2–8 m`):** os contornos da praça e da avenida no OSM (`source=Bing;IBGE`) possuem deslocamento posicional compatível com imagens orbitais não ortorretificadas em escala cadastral (`1:1.000`).

### 6.3 Fontes topográficas catalogadas para aprofundar a validação (`#7` e `#9`)

| Fonte topográfica / batimétrica | Resolução / Escala | Situação de acesso | Utilidade específica para `#7` e `#9` |
|---|---|---|---|
| **MDE VANTE original (`10 cm`) + 60 seções batimétricas ADCP (SGB 2024)** | `0,10 m` (terreno seco) + seções de canal (`hgeoHNOR_IMBITUBA`) | Não publicado como raster aberto no RIGeo `doc/25035` (requer solicitação técnica ao SGB/DIPEME) | **Fonte ideal (Padrão-Ouro):** permite testar diretamente quanto da intrusão de `11,35 m` na Praça Monsenhor Diniz decorre apenas da reamostragem `10 cm -> 10 m`. |
| **PMSB SES 2024 — Vol. II (Levantamentos de Campo), Tomo I: Levantamento Topográfico** | Topografia cadastral urbana (Contrato `02/2024`, Fortaleza Ambiental / Fraga Marques Engenharia) | Citado na p. 14 do Diagnóstico 2024, porém não anexado ao portal web municipal | Fornece cotas de soleira, meios-fios e poços de visita em `SIRGAS 2000 / UTM 23S` na sede urbana; incluído na minuta de solicitação à Prefeitura. |
| **IBGE / SEA-RJ `BC25_RJ` (`rel_ponto_cotado_altimetrico_p` e curvas)** | `1:25.000` (`427` pontos cotados na AOI urbana) | **Aberto e já auditado** | Útil para controle altimétrico independente de macroescala (`79 m` a `86 m`), mas insuficiente para resolver muros/meios-fios submétricos. |
| **SGB/CPRM 2015 (`produtos_mde` e `ortofotos`, RIGeo `doc/15089`)** | MDE `30,0 m × 30,0 m`; Ortofoto `1,00 m × 1,00 m` (`EPSG:31983`) | Público no RIGeo, mas `license.txt` incompleto | A ortofoto de `1 m` auxilia conferência visual planimétrica de vias/margens; o MDE de `30 m` é **3× mais grosseiro** que o MDE de `10 m` do SGB 2024, não devendo substituí-lo em escala de quadra. |
| **Base topográfica PAE UHE Barra do Braúna (2017)** | Topografia de planície fluvial (citada no PMSB 2019 Vol. 6 e em Simiqueli, 2024) | Acesso restrito (`not_acquired / authorization_pending`) | Só pode ser utilizada mediante cessão/autorização formal do titular original, conforme regra de proveniência em [`docs/DATA_SOURCES.md`](file:///home/antigravity/krrozino/padua-floodsim/docs/DATA_SOURCES.md). |

---

## 7. Minuta de Solicitação Institucional à Prefeitura de Santo Antônio de Pádua

> **AVISO DE GOVERNANÇA:** A minuta abaixo foi apenas redigida e preparada para revisão do mantenedor do projeto. **Nenhuma mensagem, e-mail ou protocolo administrativo foi enviado nesta etapa.**

### Canais destinatários recomendados
1. **Protocolo Geral / e-SIC — Lei de Acesso à Informação (Lei Federal nº 12.527/2011)** no portal oficial `http://santoantoniodepadua.rj.gov.br/`;
2. **Secretaria Municipal de Fazenda / Setor de Cadastro Imobiliário e Tributos** (guardiã da Planta Genérica de Valores — Leis nº `3.864/2017` e `4.135/2021`);
3. **Secretaria Municipal de Obras e Infraestrutura Urbana** e **Secretaria Municipal de Planejamento / Meio Ambiente / Defesa Civil** (participantes da Comissão de Definição dos Bairros em `25/07/2017` e gestoras do Contrato nº `02/2024` do PMSB).

### Texto sugerido para Ofício / Pedido de Acesso à Informação (LAI)

```text
Assunto: Solicitação acadêmica de base cartográfica/cadastral dos limites oficiais dos 27 bairros (Leis Municipais nº 3.864/2017 e nº 4.135/2021) e levantamento topográfico urbano (PMSB 2024) — Projeto de Pesquisa Pádua FloodSim

À Prefeitura Municipal de Santo Antônio de Pádua — RJ
A/C: Secretaria Municipal de Fazenda (Cadastro Imobiliário), Secretaria Municipal de Obras e Secretaria Municipal de Planejamento / Serviço de Informação ao Cidadão (e-SIC)

Prezados(as) Senhores(as),

Na condição de pesquisador(es) responsável(is) pelo projeto acadêmico e experimental "Pádua FloodSim" — voltado ao monitoramento hidrológico, modelagem espacial e interpretação territorial de cenários de inundação do Rio Pomba em Santo Antônio de Pádua, com base nas manchas oficiais publicadas pelo Serviço Geológico do Brasil (SGB, 2024) — vimos respeitosamente solicitar, com fundamento na Lei Federal nº 12.527/2011 (Lei de Acesso à Informação) e para fins exclusivamente científicos, educacionais e de interesse público, o acesso aos seguintes documentos e arquivos técnicos municipais:

1. Mapa oficial de delimitação dos 27 bairros da sede urbana (1º Distrito) referido no Anexo VI (pág. 34: "* Vide Mapa em anexo") e no Anexo XIII (pág. 42: Ata da Reunião para Definição dos Bairros, de 25/07/2017) da Lei Municipal nº 3.864, de 27 de dezembro de 2017 (Planta Genérica de Valores, elaborada tecnicamente por Predial Serviços de Cadastros e Valores Ltda.), tendo em vista que o arquivo PDF atualmente disponível no portal municipal não inclui a referida prancha cartográfica nem o conteúdo integral das páginas anexas:
   a) preferencialmente em formato vetorial georreferenciado (Shapefile .shp, GeoJSON, GeoPackage, KML/KMZ ou CAD .dwg/.dxf), acompanhado da informação do sistema de coordenadas/datum (ex.: SIRGAS 2000 / UTM 23S);
   b) subsidiariamente, caso inexista arquivo vetorial, cópia digital legível em alta resolução da prancha cartográfica oficial e/ou dos memoriais descritivos de perímetro dos 27 bairros (atualizados até a Lei Municipal nº 4.135/2021, se houver alteração).

2. Caso disponível em meio digital público, o "Volume II — Levantamentos de Campo, Tomo I — Levantamento Topográfico" integrante da revisão do Plano Municipal de Saneamento Básico — Sistema de Esgotamento Sanitário (Contrato nº 02/2024, citado à pág. 14 do Relatório Técnico Preliminar de agosto/2024), para validação altimétrica de vias marginais e praças da área central frente aos cenários hidrológicos do SGB.

3. Confirmação expressa quanto às condições de uso institucional:
   a) autorização para utilização acadêmica dos limites oficiais dos bairros no cálculo de indicadores territoriais agregados de inundação; e
   b) possibilidade de publicação aberta, com atribuição explícita à Prefeitura Municipal de Santo Antônio de Pádua, da camada vetorial de limites dos bairros (ou de sua vetorização derivada devidamente rotulada) no repositório científico público do projeto.

Ressaltamos que o projeto Pádua FloodSim possui caráter estritamente acadêmico e experimental, não substitui alertas oficiais da Defesa Civil, do INEA ou do SGB, e adota protocolo rigoroso de rastreabilidade, não utilizando delimitações fictícias ou não autorizadas. Caso ainda não exista delimitação completa para todos os 27 bairros em meio vetorial, eventual disponibilização parcial (incluindo prioritariamente Centro, São Félix, Aeroporto, Cidade Nova, Divinéia, Farol e Mirante) também será de grande valia científica.

Colocamo-nos à disposição para quaisquer esclarecimentos técnicos ou formalização de termo de cooperação acadêmica.

Atenciosamente,

[Nome completo do pesquisador / orientador]
[Vínculo institucional / Universidade]
[E-mail institucional e telefone de contato]
[Santo Antônio de Pádua / RJ, data]
```

---

## 8. Viabilidade da Próxima Sprint e Próximos Passos

### Avaliação objetiva de viabilidade

1. **Ativação imediata do painel público de bairros com polígonos reais (`#10` -> `#20` na UI): BLOQUEADA (`BLOCKED_DATA_SOURCE`)** no momento, pois `0/27` bairros possuem polígonos oficiais ou mapa municipal anexo publicado para vetorização `derived`. Sob a governança *Programations 2.0 — Research*, o painel público não deve ser reativado com polígonos aproximados, setores censitários ou Voronoi de pontos.
2. **Engenharia de domínio e contrato de cálculo (`#20` backend/domain): CONCLUÍDA E PRONTA.** O contrato [`lib/neighborhoods/contract.ts`](file:///home/antigravity/krrozino/padua-floodsim/lib/neighborhoods/contract.ts), o registro dos `27` bairros [`lib/neighborhoods/registry.ts`](file:///home/antigravity/krrozino/padua-floodsim/lib/neighborhoods/registry.ts) e o motor geodésico *fail-closed* [`lib/neighborhoods/evaluate.ts`](file:///home/antigravity/krrozino/padua-floodsim/lib/neighborhoods/evaluate.ts) já estão implementados e testados com `0` acoplamento à interface pública. Assim que um arquivo GeoJSON oficial ou `derived` autorizado (mesmo com cobertura parcial inicial, como os `7` bairros prioritários) for incorporado, o cálculo de área territorial, área interceptada, percentual, classificação `Verde/Amarelo/Laranja/Vermelho/Cinza` e aviso automático de cobertura parcial funcionará imediatamente.
3. **Trilha paralela desbloqueada para a próxima sprint:**
   - **Passo 1 (Institucional — prioridade máxima para desbloquear `#10`):** protocolar a solicitação da Seção 7 junto à Prefeitura de Santo Antônio de Pádua (e-SIC / Secretaria de Fazenda / Secretaria de Obras) requerendo o *Mapa Anexo da Lei nº 3.864/2017* (acervo *Predial Cadastros*) e o *Tomo I — Levantamento Topográfico (PMSB 2024)*.
   - **Passo 2 (Institucional SGB — apoio a `#7` e `#9`):** solicitar ao SGB (`dipeme@sgb.gov.br` / autores do estudo `doc/25035`) acesso acadêmico ao MDE VANTE de `10 cm` (ou recorte urbano de `1 m`) e confirmação de licença do pacote `doc/15089` (`license.txt`).
   - **Passo 3 (Pesquisa espacial desbloqueada independentemente de `#10`):** enquanto a resposta da Prefeitura é aguardada, a equipe pode avançar na métrica complementar prevista em [`docs/FLOOD_MODEL.md`](file:///home/antigravity/krrozino/padua-floodsim/docs/FLOOD_MODEL.md#L200-L203) — **extensão de logradouros interceptados pelas 11 manchas SGB** utilizando a malha viária OpenStreetMap (`ODbL`, com atribuição e ressalva posicional de `±2–8 m`) cruzada com a Tabela I da Lei nº 4.135/2021, sempre mantendo a distinção clara entre *eixos viários colaborativos* e *limites oficiais de bairros*.
