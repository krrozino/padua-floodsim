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

1. **Existência jurídica e nomenclatura oficial confirmadas (`27` bairros):** a **Lei Municipal nº 3.864, de 27/12/2017** (*Planta Genérica de Valores — PGV*, Anexos VI e XIII) cria e enumera oficialmente **27 bairros** na sede urbana (`16` na margem direita e `11` na margem esquerda do Rio Pomba). Além disso, foi localizada e auditada a **Lei Municipal nº 4.135, de 17/11/2021**, que atualiza a PGV a partir de 2022 e publica a *Tabela I — Valor do m² por Logradouro* (`1.065` registros), confirmando a vigência cadastral dos códigos `01` a `27` (sede) e separando-os das localidades distritais (`28` a `44`), além de corrigir erros tipográficos do texto de 2017 (`Ferreira` no lugar de `FERRERIRA`; `Pereira` no lugar de `PERERIRA`).
2. **Ausência de geometria pública (`0/27` polígonos utilizáveis -> `BLOCKED_DATA_SOURCE`):**
   - O Anexo VI da Lei nº 3.864/2017 (`p. 34`) registra expressamente `* Vide Mapa em anexo` e o Anexo XIII (`p. 42`, Ata de `25/07/2017`) afirma que os limites *"se encontram na PGV"*. Contudo, **o mapa anexo não foi publicado no portal da Prefeitura**, e **73 das 137 páginas** do PDF oficial sancionado encontram-se em branco (contendo apenas o timbre municipal).
   - A Lei nº 4.135/2021 publica apenas tabela alfanumérica de logradouros, sem mapa, memorial descritivo de perímetros ou coordenadas, sendo vários logradouros compartilhados por dois ou três bairros adjacentes.
   - O **IBGE** possui **`0` registros** para Santo Antônio de Pádua (`3304706`) na *Malha Territorial de Bairros do Censo Demográfico 2022* (`RJ_bairros_CD2022.zip`) e mantém `CD_BAIRRO` e `NM_BAIRRO` vazios em **100% dos setores censitários** de 2010 (`71` setores) e 2022 (`154` setores).
   - A base estadual/federal **BC25_RJ (1:25.000, IBGE/SEA-RJ/INEA)**, o pacote **SGB/CPRM 2015** (`doc/15089`), os mapas **M1–M6 do Plano Diretor de 2018**, os mapas **CAD do PMSB (2019/2024)** e o **OpenStreetMap** tampouco contêm polígonos dos bairros.
3. **Respeito estrito à integridade científica:** em conformidade com a Ordem de Preferência (Seção 2) e as regras do projeto, **nenhum polígono foi inventado**, setores censitários não foram convertidos em bairros e pontos colaborativos (`11` nós `place=suburb` compatíveis no OSM) não foram expandidos por diagramas de Voronoi ou cascos convexos. O estado formal **`BLOCKED_DATA_SOURCE`** foi registrado nos metadados versionados ([`neighborhood_registry.json`](../../data/metadata/neighborhoods/neighborhood_registry.json)) e no contrato de domínio ([`lib/neighborhoods/contract.ts`](../../lib/neighborhoods/contract.ts)), separando estritamente disponibilidade dos limites municipais, cobertura espacial do modelo de inundação e sucesso/falha da consulta do cenário. Bairros sem polígono validado, com falha no cenário ou situados fora/parcialmente fora da cobertura conhecida do modelo são obrigatoriamente classificados como **Cinza** (nunca **Verde**).
4. **Validação espacial local (`Praça Monsenhor Diniz`, `Ilha da Convivência` e avenidas marginais):** a auditoria métrica em `SIRGAS 2000 / UTM 23S (EPSG:31983)` e geodésica `WGS84` confirmou que a camada `COTA_300cm` (`SHA-256: 100cd53b...`) preserva integralmente as coordenadas oficiais do SGB. Na `COTA_300cm`, a mancha oficial intercepta `11,54%` (`493,0 m²` de `4.272,0 m²` OSM, penetração máxima de `11,35 m`) da borda sudoeste da `Praça Monsenhor Diniz`, `67,3%` (`251,6 m` de `374,0 m` OSM) da `Avenida Senar Frederico Rocha` e `30,68%` (`BC25_RJ`, `3.017,0 m²` de `9.822,1 m²`) a `36,63%` (OSM, `3.936,3 m²` de `10.745,4 m²`) da `Ilha da Convivência`, sem atingir a `Rua Coronel Olivier` (`0,0%` de `501,8 m` OSM). A divergência aparente frente à cota de primeiro dano publicada para a estação `58790002` (`310 cm` a jusante) possui quatro **hipóteses explicativas físicas e cartográficas** documentadas na Seção 6.2 — destacando-se que os pontos cotados de terreno seco da `BC25_RJ` (`79,0 m`, `84,0 m`, `86,0 m`) **não demonstram por si sós a declividade da superfície livre da água**.

---

## 2. Avaliação segundo a Ordem de Preferência (A–D)

| Nível | Categoria de fonte | Resultado em Santo Antônio de Pádua (`2026-11-25`) | Decisão adotada |
|---|---|---|---|
| **A** | Polígonos vetoriais oficiais da Prefeitura | **Inexistente em acesso público.** O próprio PMSB municipal (*Anexo VIII, Programa A.PI-1*) documenta que a Prefeitura ainda não dispõe de Cadastro Técnico Multifinalitário / SIG implantado. | Solicitar formalmente à Prefeitura (ver Seção 7). |
| **B** | Base cartográfica fornecida por órgão público com procedência e autorização | **Sem polígonos de bairros.** IBGE (`RJ_bairros_CD2022` = `0` registros; `RJ_setores_CD2022` com `CD_BAIRRO` vazio), IBGE/SEA-RJ `BC25_RJ` (`0` limites intramunicipais urbanos) e SGB/CPRM 2015 (`0` bairros). | Não aplicável para bairros; `BC25_RJ` retida como referência altimétrica/hidrográfica auxiliar (`#7`/`#9`). |
| **C** | Digitalização georreferenciada de mapa municipal oficial (`derived`) | **Bloqueada pela omissão do mapa anexo.** A Lei nº 3.864/2017 remete a `* Vide Mapa em anexo` (`p. 34`), porém o mapa não consta no PDF publicado; os mapas `M1–M6` do Plano Diretor (2018) e as pranchas do PMSB (2024) não trazem divisas de bairros. | Solicitar o *Mapa Anexo da PGV* (Lei 3.864/2017 / Predial Cadastros) junto à confirmação de direitos de redistribuição de derivado. |
| **D** | Outras delimitações documentadas e avaliadas (referência auxiliar) | **Insuficientes para gerar polígonos.** O OpenStreetMap (`ODbL 1.0`) possui apenas `13` nós pontuais `place=suburb` (`11` correspondentes à PGV e `2` populares) e `0` polígonos. A Lei nº 4.135/2021 traz `1.065` logradouros por bairro, mas sem geometria de lotes/quadras nem pontos de seccionamento de vias compartilhadas. | Registrar pontos OSM apenas como `auxiliary_reference_point_only` (`usableForPolygonIntersection: false`) e declarar **`BLOCKED_DATA_SOURCE`**. |

---

## 3. Auditoria Geoespacial Detalhada das Fontes Investigadas

> **Distinção fundamental entre acesso público e licença de uso/redistribuição:** a disponibilidade pública de atos normativos, relatórios ou portais públicos sob o regime de transparência administrativa (**Lei Federal nº 12.527/2011 — LAI**) **não constitui automaticamente licença aberta irrestrita** para redistribuição de arquivos digitais originais ou bases cartográficas derivadas. Para cada fonte, a auditoria separa explicitamente acesso público de permissão de consumo, derivação e redistribuição.
>
> **Nota de infraestrutura:** o subdomínio legado `https://santoantoniodepadua.itcast.com.br/...` expirou/sofreu timeout de conexão em `2026-11-25`; o acervo oficial ativo da Prefeitura responde em `http://santoantoniodepadua.rj.gov.br/portal/arquivo/...` (e `www.santoantoniodepadua.rj.gov.br`). Todos os arquivos brutos foram inspecionados fora da árvore Git (`/tmp/r02f_audit/`), evitando versionamento indevido no repositório.

### 3.1 Matriz consolidada de auditoria (14 requisitos técnicos e legais)

| # | Fonte / Arquivo | Instituição | URL auditada | Acesso | Acesso público vs. Licença / Condições de uso | Abrangência | Escala / Resolução | CRS | Precisão conhecida | Formato | Qtd. bairros (polígonos) | Qualidade topológica | Tamanho e SHA-256 | Redistribuição no Git |
|---:|---|---|---|---|---|---|---|---|---|---|---:|---|---|---|
| 1 | **Lei nº 3.864/2017** (*PGV 2018*) | Prefeitura de S. A. de Pádua (*elaboração técnica: Predial Serviços de Cadastros e Valores Ltda.*) | `http://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2017/12-dezembro/lei_sancionada_no_3.864-17.pdf` | `2026-11-25` | Acesso público municipal (publicidade legal sob LAI nº 12.527/2011; sem licença aberta explícita para redistribuição de base derivada) | Sede urbana (1º Distrito) | N/A (mapa omitido) | N/A | Nomenclatura oficial exata; `73/137` páginas em branco no PDF | PDF (`137` pág.) | `27` nomes (`0` políg.) | Sem geometria | `1.962.244` B · `379a5accce9c37a31ce160cad9dc6b3164a455a540cabfc4a151f8ed6e95a971` | Apenas metadados e nomenclatura legal; PDF bruto não versionado |
| 2 | **Lei nº 4.135/2021** (*Atualiza PGV / Tabela I*) | Prefeitura de S. A. de Pádua | `http://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2021/11-novembro/lei_sancionada_no_4.135-21.pdf` | `2026-11-25` | Acesso público municipal (LAI nº 12.527/2011 não equivale a licença aberta automática para bases derivadas) | Sede (`1–27`) + distritos (`28–44`) | Tabular (`1.065` logradouros) | N/A | Associação oficial rua-bairro; sem seccionamento métrico | PDF digitalizado (`18` pág.) | `27` nomes (`0` políg.) | Sem geometria | `934.409` B · `7d0482d79a0b8cca038b340f51abae42f0448b2ecd93386b355bc17fba9081a2` | Apenas metadados; PDF bruto não versionado |
| 3 | **Leis PGV anteriores** (`3.537/13`, `3.643/14`, `3.705/15`, `3.775/16`) | Prefeitura de S. A. de Pádua | `http://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2013..2016/...` | `2026-11-25` | Acesso público municipal sem anexos cartográficos | Município | N/A (1 pág. cada, reajuste percentual) | N/A | Sem anexos cartográficos | PDF (`1` pág.) | `0` (`0` políg.) | Sem geometria | `3.537`: `104.677` B (`87471a18...`); `3.643`: `106.515` B (`b78b3df7...`); `3.705`: `153.831` B (`1cf81554...`); `3.775`: `129.694` B (`54449057...`) | Não aplicável |
| 4 | **Leis de Perímetro Urbano** (`3.651/2015` e `3.687/2015`) | Prefeitura de S. A. de Pádua | `http://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2015/...` | `2026-11-25` | Acesso público municipal (LAI); sem licença explícita de redistribuição vetorial | 5º Distrito (Ibitinema) e eixo RJ-186 (1º Distrito) | Descritivo textual / 2 pontos | Não especificado | Sem divisas internas de bairros | PDF | `0` (`0` políg.) | Sem geometria poligonal | `3.651`: `96.081` B (`7b0f9926...`); `3.687`: `92.725` B (`088108e7...`) | Não aplicável |
| 5 | **Plano Diretor 2018** (`Lei 3.922/2018` + Mapas `M1–M6`) | Prefeitura de S. A. de Pádua / IBAM | `http://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2018/11-novembro/` | `2026-11-25` | Acesso público em portal municipal sem licença aberta explícita de redistribuição cartográfica | Município e sede urbana | `1:125.000` (`M1–M3, M5`) e `1:35.000` (`M4, M6`) | Não informado no carimbo; sem grade de coordenadas | Macrozonas e zonas urbanas (`ZPROPOMBA`, `ZOUP`, `ZRU` etc.); sem bairros | PDF | `0` (`0` políg.) | Sem camada de bairros e sem graticulado | Lei `3.922`: `333.074` B (`b6ceb430...`); `M4`: `450.895` B (`0682ee0a...`); `M6`: `800.155` B (`a3cdcdca...`) | Apenas metadados |
| 6 | **PMSB SES 2024 — Setores Sede Urbana** (`setores_censitarios_-_sede_urbana.pdf`) | Prefeitura / AGEVAP / Fortaleza Ambiental | `http://www.santoantoniodepadua.rj.gov.br/portal/arquivo/36/2024/volume_1_relatorio_tecnico_preliminar_rtp/tomo_iv_n_desenho/setores_censitarios_-_sede_urbana.pdf` | `2026-11-25` | Relatório técnico de acesso público municipal (Contrato `02/2024`), sem licença explícita de redistribuição | Sede urbana (`706,39 ha`) | `1:3.500` (`7` pranchas CAD) | `EPSG:31983` (`SIRGAS 2000 / UTM 23S`) | Polígonos são `37` setores de saneamento (`CS01–CS37`); tabela lista apenas ruas | PDF vetorial CAD | `0` (`0` políg.) | Topologia de setores, não de bairros | `10.180.389` B · `609e59c3c3d098383141e89193db2de4ecb5df6ca8ced1ca5646012d8a2cbb08` | Não redistribuído |
| 7 | **PMSB 2024 Diagnóstico & PMSB 2019 Drenagem** | Prefeitura / AGEVAP | `http://www.santoantoniodepadua.rj.gov.br/portal/arquivo/36/2024/...` e `/19/2019/...` | `2026-11-25` | Relatórios de acesso público municipal sem licença aberta explícita de redistribuição | Município | Relatórios técnicos | N/A | Documentam ausência de SIG municipal, ZIDs do PAE Barra do Braúna e existência do *Vol. II Tomo I — Levantamento Topográfico (2024)* | PDF | `0` (`0` políg.) | N/A | `pmsb2024_diagnostico`: `8.294.152` B (`ff0abfe5...`); `pmsb2019_vol6_drenagem`: `8.905.036` B (`119b6299...`) | Apenas metadados |
| 8 | **IBGE Malha de Bairros 2022** (`RJ_bairros_CD2022.zip`) | IBGE | `https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/bairros/shp/UF/RJ_bairros_CD2022.zip` | `2026-11-25` | Dados abertos governamentais (acesso livre FTP + atribuição obrigatória ao IBGE) | `31` municípios do RJ (`1.509` bairros) | Base censitária urbana IBGE | `EPSG:4674` (`SIRGAS 2000`) | Oficial IBGE, porém **`0` registros para `3304706`** | Shapefile | `0` em Pádua (`0` políg.) | N/A para `3304706` | `3.287.988` B · `8eb963e547e8bc2e95b9a94fb5492f660d0828e4e5ec0211f4bb1f3ceae5546e` | Permitida com atribuição, mas vazia para Pádua |
| 9 | **IBGE Setores Censitários 2022 e 2010** + **Descrições RJ** | IBGE | `https://geoftp.ibge.gov.br/.../censo_2022/setores/shp/UF/RJ_setores_CD2022.zip` | `2026-11-25` | Dados abertos governamentais (atribuição ao IBGE) | `154` setores em 2022 (`73` urbanos na sede); `71` em 2010 | Base censitária IBGE | `EPSG:4674` (`SIRGAS 2000`) | `CD_BAIRRO` e `NM_BAIRRO` vazios em **100%** dos setores | Shapefile + XLSX | `0` (`0` políg.) | Topologia censitária válida; sem relação 1:1/N:1 com bairros | `2022`: `32.297.299` B (`88dc4a6c...`); `2010`: `15.815.423` B (`1a794c55...`) | Não usar como bairros |
| 10 | **IBGE CNEFE 2022 Coordenadas** (`3304706.zip`) | IBGE | `https://ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/Censo_Demografico_2022/Coordenadas_enderecos/Municipio/33_RJ/3304706.zip` | `2026-11-25` | Dados abertos governamentais (atribuição ao IBGE) | `25.749` endereços geocodificados em `3304706` | Pontual por endereço | `EPSG:4674` | Pontos de edificações; não delimita perímetros de bairros | CSV (`ZIP`) | `0` (`0` políg.) | Nuvem de pontos (proibido Voronoi como limite oficial) | `164.535` B · `9e872278ae8dc686e3795db42048318306645acb2b64f1cd9ad6a26f8d3c6d0e` | Apenas referência futura de exposição |
| 11 | **BC25_RJ (EDGV 3.0)** | IBGE / SEA-RJ / INEA | `https://geoftp.ibge.gov.br/cartas_e_mapas/bases_cartograficas_continuas/bc25/rj/versao2018_edgv_3.0/` | `2026-11-25` | Dados abertos IBGE / Estado do RJ (atribuição obrigatória ao IBGE/SEA-RJ/INEA) | Estado do RJ (inclui Pádua) | `1:25.000` (PEC Classe A) | `EPSG:4674` (`SIRGAS 2000`) | `0` limites intramunicipais de bairros; `427` pontos cotados de terreno e `48` ilhas na AOI urbana | Shapefile + CSV | `0` (`0` políg.) | Consistente para hidrografia e pontos cotados de terreno (`#7`/`#9`) | CSV nomesgeo: `14.330.093` B · `1d4924705f12309c241d5d30e13df9c3792bf7ce3650abdf661feae05566307e` | Permitida com atribuição |
| 12 | **SGB/CPRM 2015 — Carta de Suscetibilidade** (`doc/15089`) | CPRM / SGB | `https://rigeo.sgb.gov.br/handle/doc/15089` | `2026-11-25` | Acesso público no RIGeo; PDF autoriza reprodução com citação à CPRM, mas `license.txt` do ZIP é template DSpace não preenchido (*DSpace University*) | Município de S. A. de Pádua | Mapa `1:60.000`; MDE `30 m`; Ortofoto `1,0 m` | `EPSG:4674` e `EPSG:31983` | `bc_santoantoniodepadua_rj.zip` traz apenas pontos de distritos (`Distritos.shp`), sem bairros | SHP, MDB, Esri Grid, ECW | `0` (`0` políg.) | Sem camada de bairros | `bc_...zip`: `8.728.248` B · `fd3a14323576e591514aff20046b911248a890e0dc22b74a9660f84c47a9abfe` | Bloqueada até confirmação formal de licença do pacote |
| 13 | **SGB 2024 — Mancha de Inundação** (`COTA_300cm` e `COTA_325cm`) | SGB | `https://geoportal.sgb.gov.br/server/rest/services/hidrologia/mancha_santo_antonio_de_padua/MapServer` | `2026-11-25` | Serviço GIS público (`official_reference`); atribuição obrigatória; sem licença irrestrita explícita de redistribuição | Trecho urbano do Rio Pomba | Grade exportada `~1 m` sobre MDE seco reamostrado (`10 cm -> 10 m`) + 60 seções ADCP | `EPSG:4674` / `EPSG:4326` | Datum vertical `hgeoHNOR_IMBITUBA` (`Z0 = 79,709 m` em `58790002`) | GeoJSON | N/A (manchas) | MultiPolygon auditado (R02-C preservada sem alteração) | `300cm`: `755.946` B (`100cd53b...`); `325cm`: `749.198` B (`d71da1dd...`) | Consumo controlado via serviço oficial |
| 14 | **OpenStreetMap API v0.6** (`padua_bbox.json`) | Colaboradores OpenStreetMap | `https://api.openstreetmap.org/api/0.6/map.json?bbox=-42.22,-21.56,-42.15,-21.51` | `2026-11-25` | **Open Database License (`ODbL 1.0`)** — atribuição (`© OpenStreetMap contributors`) + obrigação *share-alike* para bases derivadas | BBox urbana (`9.516` elementos) | Colaborativa (digitalização sobre Bing / IBGE) | `EPSG:4326` (`WGS84`) | Incerteza posicional não aferida localmente (ordem típica métrica de imagens orbitais); `0` polígonos de bairros e `13` nós pontuais `place=suburb` | JSON OSM | `11` pontos compatíveis (`0` políg.) | Sem polígonos de bairros; viário/praças usados apenas como referência auxiliar | `1.884.920` B · `16794b21458cff85504568e0a29fb045959e0ba00f64bc5bc435f18bff342875` | Apenas IDs/metadados versionados (evita mistura prematura ODbL) |

---

### 3.2 Análise crítica das fontes municipais e censitárias

#### A. O defeito documental da Lei nº 3.864/2017 e o papel da Lei nº 4.135/2021
A inspeção página a página das `137` páginas de `lei_sancionada_no_3.864-17.pdf` (`SHA-256: 379a5acc...`) revelou que:
- Na **página 34 (Anexo VI — Relação de Bairros)**, a lei lista os `27` bairros divididos entre *Margem Direita do Rio Pomba* (`01` a `16`) e *Margem Esquerda do Rio Pomba* (`17` a `27`) e encerra com a remissão explícita **`* Vide Mapa em anexo`**.
- Na **página 42 (Anexo XIII — Ata da Reunião para Definição dos Bairros, de `25/07/2017`)**, a comissão municipal formada por *Antônio Carlos de Oliveira (Servidor Efetivo)*, *Alexandre de Castro Brasil (Secretário de Obras)*, *Henrique dos Santos Bastos (Engenheiro)* e *Ney Brandão de Sousa Júnior (Engenheiro)* delibera: *"ficaram determinados, a criação e os limites dos bairros abaixo, cujos limites se encontram na PGV"*.
- Contudo, **73 das 137 páginas** do PDF publicado no portal oficial (`p. 16–18, 46–61, 64–79, 82–97, 100–115, 122, 125–127, 131 e 134`) contêm exclusivamente o timbre do Gabinete do Prefeito, omitindo tanto o *Anexo XVI (Tabela de Avaliação por Ordem de Bairros)* quanto a prancha cartográfica elaborada pela empresa *Predial Serviços de Cadastros e Valores Ltda.* (CNPJ `09.073.860/0001-20`).
- Já a **Lei nº 4.135, de 17/11/2021** (`SHA-256: 7d0482d7...`), publica integralmente em `18` páginas digitalizadas a *Tabela I — Valor do m² por Logradouro* (`1.065` entradas), vinculando logradouros ou trechos fiscais aos códigos `1..27` (sede) e `28..44` (distritos). Porém, diversos logradouros atravessam múltiplos bairros sem indicação de coordenadas ou numeração métrica de corte — por exemplo, a `Av. Prefeito Alberto Vaz` aparece em `22 - Ferreira` e `25 - Mirante`; a `Rua Dr. Ferreira da Luz` em `20 - Centro` e `22 - Ferreira`; e a `Rua Sebastião Teixeira de Carvalho` em `19 - Carvalho`, `24 - Jorimpa` e `25 - Mirante`. Portanto, **não é cientificamente válido sintetizar polígonos fechados apenas a partir da Tabela I**.

#### B. Por que setores censitários (IBGE 2010/2022 e PMSB CS01–CS37) não podem ser usados como bairros
1. **Atributos oficiais nulos:** nos arquivos `RJ_setores_CD2022.dbf` (`154` setores no município, `73` urbanos em `330470605`) e `rj_setores_censitarios.zip` de 2010 (`71` setores), `CD_BAIRRO` e `NM_BAIRRO` estão **100% em branco** (refletindo a ausência de depósito de lei com limites descritos/georreferenciados junto ao IBGE, razão pela qual `RJ_bairros_CD2022.zip` possui `0` registros para `3304706`).
2. **Incompatibilidade topológica nos memoriais (`Descrição_RJ.xlsx`):** apenas `8` das `154` descrições citam bairros/loteamentos como referência pontual de caminhamento, e o setor `330470635000010` — pertencente ao **Distrito `35` (Paraoquena)** — faz divisa com o *Loteamento Cidade Nova* (código `06` da sede na PGV), demonstrando que setores censitários não respeitam as mesmas fronteiras administrativas dos bairros fiscais.
3. **Pranchas do PMSB 2024 (`setores_censitarios_-_sede_urbana.pdf`):** apesar do cabeçalho `"ABRANGÊNCIA - BAIRROS"` para os `37` setores (`CS01–CS37`, `706,39 ha`), a coluna lista apenas ruas de referência, não os `27` bairros da Lei nº 3.864/2017.

---

## 4. Inventário Oficial dos 27 Bairros e Reconciliação Nomenclatural

| Nº | ID (`slug`) | Nome oficial reconciliado | Margem do Rio Pomba | Prioridade mantenedor | Grafia Lei 3.864/17 (Anexo VI) | Grafia Lei 3.864/17 (Anexo XIII — Ata) | Grafia Lei 4.135/21 (Tabela I) | Ponto auxiliar OSM (`place=suburb`, `ODbL`) | Polígono utilizável |
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

### Registros excluídos do universo dos 27 bairros

1. **Topônimos populares no OpenStreetMap sem correspondência na PGV (`2` nós):** `Gerador` (`node/2661555907`) e `São José` (`node/2661555956`), registrados separadamente em [`neighborhood_registry.json`](../../data/metadata/neighborhoods/neighborhood_registry.json) como `osmPopularUnmatchedPoints`.
2. **Localidades e loteamentos distritais na Lei nº 4.135/2021 (`códigos 28 a 44`):** `28 Baltazar`, `29 Santa Cruz`, `30 Marangatu`, `31 São Pedro de Alcântara`, `32 Chalé`, `33 Ibitinema`, `34 Lot. Dom Carlos`, `36 Lot. Vitória do Sapê - Chalé`, `37 Lot. Vitória - Chalé`, `38 Recanto das Garças`, `39 Santa Luzia`, `40 Monte Alegre`, `41 Paraoquena`, `42 Ibitiguaçu`, `43 Campelo` e `44 Salgueiro`.

---

## 5. Preparação Técnica do Painel de Bairros (`#20`) e Metodologia de Classificação

Sem alterar nenhum componente público de interface nesta etapa, o contrato de domínio e o motor determinístico foram implementados em:

- [`lib/neighborhoods/contract.ts`](../../lib/neighborhoods/contract.ts) — contrato técnico, separação ortogonal de estados, domínio espacial (`unknown` por padrão) e esquema de limiares provisórios;
- [`lib/neighborhoods/registry.ts`](../../lib/neighborhoods/registry.ts) — inventário dos `27` bairros, `7` prioritários e validação de unicidade de identificadores/números oficiais;
- [`lib/neighborhoods/evaluate.ts`](../../lib/neighborhoods/evaluate.ts) — preparação única da geometria do cenário por painel (`prepareFloodScenario`), reuso direto de `extractAndDissolvePolygons` e `computeDissolvedAreaMetrics` de [`lib/sgb/area.ts`](../../lib/sgb/area.ts) (integrados da R02-C / PR `#54` na `main` `63f191b`) em passo único, e cálculo geodésico de interseção sobre o elipsoide WGS84;
- [`tests/unit/neighborhoods/neighborhoods.test.ts`](../../tests/unit/neighborhoods/neighborhoods.test.ts) — suíte de testes unitários cobrindo todas as invariantes e integração combinada com [`compareFloodScenarios`](../../lib/sgb/compare.ts).

### 5.1 Separação estrita entre disponibilidade municipal, cobertura do modelo e cálculo de interseção

Para evitar falsos negativos ou falsos positivos semânticos, [`NeighborhoodCoverageQuality`](../../lib/neighborhoods/contract.ts#L194-L206) distingue independentemente:

1. **Disponibilidade e qualidade dos limites municipais (`boundaryStatus`):** `"valid"`, `"unavailable"`, `"invalid_geometry"` ou `"partial_unverified"`. Se a consulta da mancha de inundação falhar (`scenarioStatus: "unavailable" | "invalid"`), `boundaryStatus` **não** muda para `"unavailable"` e a área territorial conhecida do bairro continua preservada.
2. **Cobertura espacial do modelo de inundação (`modelCoverageStatus`):** `"covered"`, `"partial_model_coverage"`, `"outside_model_extent"` ou `"unknown"`. **Por padrão, o domínio espacial é `DEFAULT_UNKNOWN_MODEL_COVERAGE_DOMAIN` (`kind: "unknown"`):** o retângulo envolvente (`bbox`) publicado pelo MapServer SGB 2024 (`SGB_2024_MAPSERVER_ENVELOPE_BBOX`) serve apenas como filtro externo negativo (`outside_model_extent`), pois **não comprova cobertura hidráulica integral no seu interior**. Somente um polígono validado do domínio do modelo (`kind: "polygon"`) autoriza classificar um bairro como `"covered"`. Qualquer bairro fora, parcialmente fora ou sob cobertura desconhecida do modelo recebe obrigatoriamente **Cinza** (`calculationStatus: "skipped_outside_model_coverage"`), **nunca Verde**.
3. **Sucesso ou falha do cálculo de interseção (`calculationStatus`):** `"computed"` somente quando limite municipal válido, cenário válido e cobertura completa (`"covered"`) estão satisfeitos simultaneamente e a conservação física $0 \le A_{\text{inter}} \le A_{\text{bairro}}$ é verificada via `computeDissolvedAreaMetrics`. Falhas topológicas ou de medição (`status !== "valid"`) **nunca são convertidas em área `0`** e falham fechadas em **Cinza**.
4. **Unicidade de identificadores:** [`validateUniqueNeighborhoodRecords`](../../lib/neighborhoods/registry.ts#L204-L220) bloqueia qualquer duplicidade de `id` ou `officialNumber` antes da agregação do painel.

### 5.2 Metodologia justificável e estatuto provisório dos limiares (`5%` e `20%`)

O rascunho ilustrativo anterior de [`docs/FLOOD_MODEL.md`](../FLOOD_MODEL.md#L205-L217) (`azul < 5%`, `amarelo 5–15%`, `laranja 15–35%`, `vermelho > 35%`) misturava `0%` (sem interseção) com `0,1%–4,9%` (interseção positiva). A formulação R02-F corrige essa ambiguidade:

- **Invariância territorial:** pontos de corte globais idênticos para todos os bairros (`appliesUniformlyToAllNeighborhoods: true`), proibindo limiares *ad hoc* por bairro.
- **Separação do zero (`Verde`) e candidatos provisórios (`PROVISIONAL_GLOBAL_GEOMETRIC_SCHEME_V0`):**
  - **Cinza (`gray`):** limite ausente/inválido, falha na consulta do cenário, ou bairro fora/parcialmente fora da cobertura conhecida do modelo;
  - **Verde (`green`):** dados válidos dentro da cobertura do modelo e $A_{\text{inter}} \le \varepsilon_0$ (`0,01 m²` — tolerância numérica **provisória** para resíduos de ponto flutuante);
  - **Amarelo (`yellow` — sobreposição territorial baixa):** $0\% < P \le 5\%$;
  - **Laranja (`orange` — sobreposição territorial elevada):** $5\% < P \le 20\%$ (progressão geométrica `4×`);
  - **Vermelho (`red` — sobreposição territorial muito elevada):** $P > 20\%$.
- **Estatuto científico explícito:** os pontos de corte **`5%` e `20%`** e a tolerância **`0,01 m²`** permanecem marcados no código como **`provisional_uncalibrated`** (candidatos provisórios ainda não calibrados) e **não são publicados na interface**. Sua calibração e análise de sensibilidade ($\pm 2$ p.p.; comparação contra quantis empíricos positivos $Q_{33}/Q_{67}$ e Jenks em $\log P$) ocorrerão somente após a obtenção dos polígonos oficiais sobre a matriz completa de cenários `300–550 cm`.

### 5.3 Salvaguardas semânticas obrigatórias

- **Verde não significa garantia de segurança** (drenagem pluvial local, enxurradas, isolamento viário ou incertezas topográficas ainda podem ocorrer).
- **Vermelho não significa alerta oficial** (alertas e evacuações competem exclusivamente à Defesa Civil, INEA e SGB).
- **Extensão planar $\neq$ criticidade física** (que depende de profundidade, velocidade, exposição, vulnerabilidade e validação local).

---

## 6. Validação Espacial Local: Praça Monsenhor Diniz, Ilha da Convivência e Avenidas Marginais (`#7` e `#9`)

### 6.1 Procedência das geometrias de controle, denominadores e métricas de sobreposição

A verificação de integridade confirmou que `COTA_300cm` (`755.946` B, `SHA-256: 100cd53b4ca6be2abf33fbefd9c0701c6765cc3bd609dead7e82cf3442be394f`, Layer `3` do `MapServer` SGB 2024) e `COTA_325cm` (`749.198` B, `SHA-256: d71da1dd...`, Layer `4`) preservam integralmente as coordenadas oficiais do SGB. **Nenhuma geometria oficial do SGB foi modificada.**

Todas as métricas abaixo foram calculadas em projeção métrica `SIRGAS 2000 / UTM 23S (EPSG:31983)` e geodésica `WGS84` a partir de duas bases de controle claramente distinguidas:
- **Base colaborativa OSM (extraída via API v0.6 em `2026-11-25`, `padua_bbox.json`, `SHA-256: 16794b21...`, licença `ODbL 1.0`, atribuição `© OpenStreetMap contributors`, digitalização atribuída a `Bing;IBGE`):**
- **Base cartográfica oficial `BC25_RJ` (`1:25.000`, EDGV 3.0, IBGE / SEA-RJ / INEA, `EPSG:4674`):**

| Feição de controle | Origem / Identificador exato / Licença | Tipo | Denominador total usado no percentual | Sobreposição `COTA_300cm` (`82,71 m` em `58790002`) | Sobreposição `COTA_325cm` (`82,96 m` em `58790002`) | Observação espacial |
|---|---|---|---|---|---|---|
| **Praça Monsenhor Diniz** (`Centro`, margem esquerda) | OSM `way/260637176` (`-21.543205, -42.177210`, `ODbL 1.0`) | Polígono | `4.272,0 m²` (área geodésica do polígono OSM) | **`493,0 m²` (`11,54%`)** · penetração máx. **`11,35 m`** | **`529,2 m²` (`12,39%`)** | Atinge a borda sudoeste voltada ao Rio Pomba / Av. Senar Frederico Rocha |
| **Av. Senar Frederico Rocha** | OSM `way/254402825` (`source=Bing;IBGE`, `ODbL 1.0`) | Linha (`highway`) | `374,0 m` (extensão UTM 23S do `way/254402825`) | **`251,6 m` (`67,3%`)** | **`260,2 m` (`69,6%`)** | Eixo viário paralelo ao cais da margem esquerda |
| **Ilha da Convivência** *(contorno colaborativo)* | OSM `way/445129454` (`-21.543518, -42.178546`, `ODbL 1.0`) | Polígono | `10.745,4 m²` (área geodésica do polígono OSM) | **`3.936,3 m²` (`36,63%`)** | **`4.222,3 m²` (`39,29%`)** | Sobreposição em bordas periféricas; porção central permanece seca |
| **Ilha da Convivência** *(contorno oficial `1:25.000`)* | IBGE / SEA-RJ / INEA `BC25_RJ` (`hid_ilha_a`, `-21.543554, -42.178531`) | Polígono | `9.822,1 m²` (área geodésica do polígono `hid_ilha_a`) | **`3.017,0 m²` (`30,68%`)** | — | Confirma independentemente do OSM a interseção apenas periférica |
| **Rua Coronel Olivier** (`RJ-116`, face nordeste da praça) | OSM `way/254402829` (`114,8 m`) + `way/1306864131` (`266,3 m`) + `way/232492957` (`120,7 m`, `source=Bing;IBGE`) (`ODbL 1.0`) | Linha (`highway`) | `501,8 m` (soma dos 3 segmentos OSM adjacentes) | **`0,0 m` (`0,0%`)** (`dist. mín. = 20,79 m`) | **`0,0 m` (`0,0%`)** | Totalmente fora da mancha em ambas as cotas |
| **Av. Chaim Elias** (margem direita / São Félix) | OSM `way/232492946` (`522,8 m`) + `way/299559859` (`39,3 m`) + `way/390654390` (`49,7 m`) (`ODbL 1.0`) | Linha (`highway`) | `611,8 m` (soma dos 3 segmentos OSM mapeados) | **`0,0 m` (`0,0%`)** (`dist. mín. = 51,28 m`) | **`0,0 m` (`0,0%`)** | Fora da mancha em ambas as cotas |
| **Ponte Raul Veiga** e **Ponte Alberíades Gabry** | OSM `way/232492952` (`169,1 m`) + `way/876431944` (`29,3 m`); `way/456633979` (`239,1 m`) (`ODbL 1.0`) | Linha (`bridge`) | Comprimento individual de cada `way` OSM | `169,1 m` (`100%`) e `238,9 m` (`99,9%`) | `169,1 m` (`100%`) e `239,1 m` (`100%`) | Projeção 2D: a mancha representa o escoamento no canal sob o tabuleiro elevado das pontes |

### 6.2 Evidências medidas versus hipóteses explicativas para a interseção local em `300 cm`

Na estação de referência **`58790002` (Santo Antônio de Pádua II)**, o estudo do SGB (2024) indica cota de inundação/primeiro dano em **`310 cm`** (`82,81 m`), ao passo que a camada oficial `COTA_300cm` (`82,71 m` na estação) já intercepta `11,54%` da geometria OSM da `Praça Monsenhor Diniz` (penetração máxima `11,35 m`) e `67,3%` do eixo OSM da `Av. Senar Frederico Rocha`.

#### O que foi observado diretamente (evidência medida)
- Nos `359` segmentos de contorno da camada `COTA_300cm` ao redor da praça (`EPSG:31983`), predominam passos de **`0,71 m`** ($|\Delta E| = 0,50\text{ m}, |\Delta N| = 0,50\text{ m}$) e **`1,00 m`**, compatíveis com extração poligonal em grade fina (`~1 m`) a partir da modelagem publicada pelo SGB (MDE seco VANTE originalmente de `10 cm` reamostrado para `10 m` e modelado no HEC-RAS 6.5 Beta).
- Na `BC25_RJ` (`rel_ponto_cotado_altimetrico_p`), constam pontos cotados fotogramétricos do **terreno seco** com valores de **`79,0 m`** próximo ao Clube de Pesca (jusante), **`84,0 m`** em dois pontos próximos à margem esquerda adjacente à praça (`-21.542083, -42.177536` e `-21.545111, -42.175868`) e **`86,0 m`** sobre o topo da `Ilha da Convivência` (`-21.543502, -42.178636`). **Esses pontos cotados representam altimetria de terreno em escala `1:25.000` e não demonstram nem quantificam a declividade da superfície livre da água** — o perfil longitudinal da lâmina d'água (`WSE`) do modelo SGB não está publicado no serviço vetorial.

#### Hipóteses explicativas da intrusão marginal observada (não demonstradas isoladamente sem o MDE/WSE original)
1. **Hipótese de declividade hidráulica longitudinal da superfície d'água:** como a cota `82,71 m` refere-se à régua `58790002` a jusante (`~2,4 km` abaixo da `Ilha da Convivência`), a linha d'água simulada em escoamento fluvial a montante tende a estar mais elevada do que na estação de referência (em concordância qualitativa com o desnível geral do terreno entre jusante e Centro, sem que os pontos cotados da `BC25_RJ` provem o gradiente hidráulico exato).
2. **Hipótese de reamostragem do MDE (`10 cm -> 10 m`) e suavização de barreiras estreitas:** ao reamostrar o levantamento VANTE de `10 cm` para células de `10 m`, muros de contenção, muretas de cais, meios-fios e degraus topográficos entre o leito e o pavimento da `Av. Senar Frederico Rocha` / `Praça Monsenhor Diniz` podem sofrer suavização horizontal da ordem de uma célula (`~10 m`), compatível com a ordem de grandeza da intrusão (`11,35 m`), hipótese que só poderá ser testada obtendo o MDE de `10 cm`.
3. **Hipótese de simplificação hidráulica 1D uniforme em canal bifurcado:** a adoção de modelo HEC-RAS unidimensional retilíneo e uniforme em um trecho com ilha fluvial (`Ilha da Convivência`) e duas pontes próximas pode diferir localmente da distribuição real bidimensional de lâmina d'água nas margens.
4. **Hipótese de deslocamento planimétrico das bases de controle:** o contorno da praça e da avenida no OSM (`source=Bing;IBGE`) possui incerteza planimétrica não calibrada frente aos polígonos ortorretificados do SGB, podendo contribuir com parte da sobreposição observada na borda sudoeste.

### 6.3 Fontes topográficas úteis para avaliar e testar essas hipóteses (`#7` e `#9`)

| Fonte topográfica / batimétrica | Resolução / Escala | Situação de acesso | Utilidade específica para `#7` e `#9` |
|---|---|---|---|
| **MDE VANTE original (`10 cm`) + 60 seções batimétricas ADCP + perfis WSE (SGB 2024)** | `0,10 m` (terreno seco) + canal (`hgeoHNOR_IMBITUBA`) | Não publicado como raster/perfil aberto no RIGeo `doc/25035` (requer solicitação ao SGB) | Permite separar quantitativamente o efeito da declividade da lâmina d'água e da reamostragem `10 cm -> 10 m`. |
| **PMSB SES 2024 — Vol. II (Levantamentos de Campo), Tomo I: Levantamento Topográfico** | Topografia cadastral urbana (Contrato `02/2024`, Fortaleza Ambiental / Fraga Marques Engenharia) | Citado na p. 14 do Diagnóstico 2024, porém não publicado no portal municipal | Fornece cotas de soleira, meios-fios e cais em `SIRGAS 2000 / UTM 23S`; incluído na minuta à Prefeitura. |
| **IBGE / SEA-RJ `BC25_RJ` (`rel_ponto_cotado_altimetrico_p`)** | `1:25.000` (`427` pontos cotados de terreno na AOI urbana) | **Aberto e já auditado** | Controle altimétrico regional de macroescala (`79–86 m`), insuficiente para resolver muretas submétricas. |
| **SGB/CPRM 2015 (`produtos_mde` e `ortofotos`, RIGeo `doc/15089`)** | MDE `30,0 m × 30,0 m`; Ortofoto `1,00 m × 1,00 m` (`EPSG:31983`) | Acesso público no RIGeo; `license.txt` incompleto | Ortofoto de `1 m` auxilia conferência planimétrica visual; MDE de `30 m` é **3× mais grosseiro** que o MDE de `10 m` (2024). |
| **Base topográfica PAE UHE Barra do Braúna (2017)** | Topografia de planície fluvial | Acesso restrito (`not_acquired / authorization_pending`) | Uso condicionado à autorização direta do titular original conforme [`docs/DATA_SOURCES.md`](../DATA_SOURCES.md). |

---

## 7. Minuta de Solicitação Institucional à Prefeitura de Santo Antônio de Pádua

> **AVISO DE GOVERNANÇA:** A minuta abaixo foi apenas preparada para revisão do mantenedor. **Nenhuma mensagem, e-mail ou protocolo administrativo foi enviado nesta etapa.**

### Canais destinatários recomendados
1. **Protocolo Geral / e-SIC — Lei de Acesso à Informação (Lei Federal nº 12.527/2011)** em `http://santoantoniodepadua.rj.gov.br/`;
2. **Secretaria Municipal de Fazenda / Cadastro Imobiliário e Tributos** (guardiã da PGV — Leis nº `3.864/2017` e `4.135/2021`);
3. **Secretaria Municipal de Obras e Infraestrutura Urbana** e **Secretaria Municipal de Planejamento / Meio Ambiente / Defesa Civil** (Comissão de 25/07/2017 e Contrato nº `02/2024` do PMSB).

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

3. Confirmação expressa quanto às condições de uso institucional e licenciamento:
   a) autorização para utilização acadêmica dos limites oficiais dos bairros no cálculo de indicadores territoriais agregados de inundação; e
   b) autorização ou restrição quanto à redistribuição aberta (com atribuição explícita à Prefeitura Municipal de Santo Antônio de Pádua) da camada vetorial de limites dos bairros — ou de vetorização derivada devidamente rotulada — no repositório científico público do projeto.

Ressaltamos que o projeto Pádua FloodSim possui caráter estritamente acadêmico e experimental, não substitui alertas oficiais da Defesa Civil, do INEA ou do SGB, e não utiliza delimitações fictícias ou não autorizadas. Caso ainda não exista delimitação completa para todos os 27 bairros em meio vetorial, eventual disponibilização parcial (incluindo prioritariamente Centro, São Félix, Aeroporto, Cidade Nova, Divinéia, Farol e Mirante) também será de grande valia científica.

Atenciosamente,

[Nome completo do pesquisador / orientador]
[Vínculo institucional / Universidade]
[E-mail institucional e telefone de contato]
[Santo Antônio de Pádua / RJ, data]
```

---

## 8. Viabilidade da Próxima Sprint e Próximos Passos

1. **Painel público de bairros na UI (`#10` -> `#20`): BLOQUEADO (`BLOCKED_DATA_SOURCE`)** no momento (`0/27` polígonos utilizáveis), sem alteração nem ativação pública até a obtenção dos limites oficiais junto à Prefeitura e sua validação topológica.
2. **Domínio e testes de interseção (`#20` integrado ao núcleo da R02-C / `main` `63f191b`):** **CONCLUÍDOS E PRONTOS**, reutilizando diretamente `extractAndDissolvePolygons` e `computeDissolvedAreaMetrics` ([`lib/sgb/area.ts`](../../lib/sgb/area.ts)) em passo único, preparação única do cenário por painel, separação estrita dos estados de limites/modelo/cenário/cálculo, cobertura desconhecida por padrão e proteção contra falsos verdes. Enquanto a R02-C (PR `#54`, `#50`) já integra a `main` aprovada e publicada (`63f191b19e4f12a239520aa5f4ed85ef5d589a0b`), a camada de bairros permanece exclusivamente no domínio/pesquisa sem exposição na interface pública.
3. **Próximos passos imediatos (sem reaquisição desnecessária):**
   - protocolar a solicitação da Seção 7 à Prefeitura (mediante autorização do mantenedor);
   - obter/validar o polígono de domínio efetivo do modelo hidráulico SGB antes de habilitar qualquer classificação `Verde` em produção;
   - solicitar ao SGB acesso técnico ao MDE VANTE de `10 cm`, perfis longitudinais WSE (`doc/25035`) e esclarecimento formal de licença do pacote `doc/15089`;
   - em trilha paralela de pesquisa, avaliar eixos viários OpenStreetMap (`ODbL 1.0`, atribuição explícita) conforme [`docs/FLOOD_MODEL.md`](../FLOOD_MODEL.md#L200-L203), mantendo-os estritamente separados de limites oficiais de bairros.
