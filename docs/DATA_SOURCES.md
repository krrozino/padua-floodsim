# Fontes de dados

Este documento registra as fontes escolhidas/candidatas e os requisitos de rastreabilidade dos dados usados pelo Pádua FloodSim.

Última revisão: **2026-11-25**.

## Regras

Todo dataset incorporado ao projeto deve registrar, quando aplicável:

- instituição responsável;
- nome do dataset/estação;
- URL de origem;
- data de acesso;
- período coberto;
- frequência de atualização;
- sistema de referência de coordenadas (CRS);
- datum vertical, quando houver elevação ou nível d'água;
- unidade de medida;
- licença/condições de uso;
- permissão de redistribuição, quando aplicável;
- limitações conhecidas.

Também deve ser classificado, conforme aplicável, como `observed`, `processed`, `official_reference`, `derived`, `simulated`, `forecast` ou `mock`.

### Regra de proveniência e redistribuição

A existência pública de um relatório, artigo, serviço GIS ou dataset não será tratada automaticamente como autorização irrestrita de redistribuição.

Para cada fonte, o projeto deve distinguir:

- **citar/consultar** a fonte;
- **consumir** um serviço ou arquivo conforme seus termos;
- **produzir derivados**;
- **redistribuir** o arquivo original ou derivado.

Quando a licença ou autorização não estiver clara, manter somente metadados, URL e instruções de aquisição até a situação ser resolvida. A fonte original deve ser preferida a cópias recebidas de terceiros.

---

## 1. Serviço Geológico do Brasil — manchas oficiais de inundação (fonte primária V1)

### Relatório técnico

**Produto:** Delimitação da mancha de inundação do rio Pomba na zona urbana de Santo Antônio de Pádua - RJ  
**Instituição:** Serviço Geológico do Brasil (SGB)  
**Data:** setembro de 2024  
**Autores:** Marcos Figueiredo Salviano; Luna Gripp Simões Alves  
**URL:** https://rigeo.sgb.gov.br/handle/doc/25035  
**Relatório:** https://rigeo.sgb.gov.br/bitstream/doc/25035/1/relatorio_sa_padua.pdf  
**Classificação:** `official_reference`  
**Uso no FloodSim:** referência técnica e cenários oficiais da V1  
**Redistribuição:** verificar e registrar separadamente as condições do relatório e do serviço GIS antes de publicar cópias locais; atribuição ao SGB e autores é obrigatória na documentação do projeto.

O estudo produziu manchas para **11 cotas locais**, entre **300 cm e 550 cm**, em intervalos de **25 cm**:

| Cota local | Altitude ortométrica | Vazão publicada |
|---:|---:|---:|
| 300 cm | 82,71 m | 624 m³/s |
| 325 cm | 82,96 m | 728 m³/s |
| 350 cm | 83,21 m | 839 m³/s |
| 375 cm | 83,46 m | 957 m³/s |
| 400 cm | 83,71 m | 1.080 m³/s |
| 425 cm | 83,96 m | 1.210 m³/s |
| 450 cm | 84,21 m | 1.346 m³/s |
| 475 cm | 84,46 m | 1.488 m³/s |
| 500 cm | 84,71 m | 1.636 m³/s |
| 525 cm | 84,96 m | 1.789 m³/s |
| 550 cm | 85,21 m | 1.948 m³/s |

O relatório também apresenta cenários por tempo de retorno de 2, 5, 10, 15, 20, 50 e 100 anos.

### Referência vertical e estação usada pelo SGB

**Estação fluviométrica:** Santo Antônio de Pádua II  
**Código RHN:** `58790002`  
**Altitude ortométrica do zero da régua:** **79,709 m**  
**Datum vertical:** `hgeoHNOR_IMBITUBA`

Cotas de referência publicadas no relatório:

- atenção: **240 cm**;
- alerta: **275 cm**;
- inundação/primeiro dano: **310 cm**.

A maior cota registrada citada no relatório foi **431 cm em 08/01/2023**.

### MDE/modelagem usada pelo estudo de 2024

O estudo informa:

- levantamento da superfície seca com VANTE;
- resolução original de **10 cm**, posteriormente reamostrada para **10 m**;
- sistema horizontal: **SIRGAS 2000 / UTM zona 23S**;
- datum vertical: **hgeoHNOR_IMBITUBA**;
- topografia do canal construída a partir de **60 seções batimétricas** medidas com ADCP;
- interpolação do canal por IDW;
- modelagem com **HEC-RAS 6.5 Beta**;
- escoamento tratado no estudo como retilíneo, uniforme e unidimensional;
- Manning calibrado em **0,025** no canal principal e **0,050** nas margens.

Essas informações tornam o produto de 2024 nossa principal referência técnica para a V1.

### Geoportal SGB — serviço GIS público

**Serviço:** `hidrologia/mancha_santo_antonio_de_padua`  
**URL base:** https://geoportal.sgb.gov.br/server/rest/services/hidrologia/mancha_santo_antonio_de_padua/MapServer  
**Grupo MODELAGEM:** https://geoportal.sgb.gov.br/server/rest/services/hidrologia/mancha_santo_antonio_de_padua/MapServer/2  
**Classificação:** `official_reference`

O serviço publica as subcamadas:

- `COTA_300cm`;
- `COTA_325cm`;
- `COTA_350cm`;
- `COTA_375cm`;
- `COTA_400cm`;
- `COTA_425cm`;
- `COTA_450cm`;
- `COTA_475cm`;
- `COTA_500cm`;
- `COTA_525cm`;
- `COTA_550cm`;
- camadas por tempo de retorno.

Metadados expostos pelo serviço:

- CRS: **EPSG:4674 — SIRGAS 2000**;
- formatos de consulta suportados: **JSON, GeoJSON e PBF**;
- extensão publicada do grupo:
  - xmin: `-42.20900097927306`;
  - ymin: `-21.553311556725685`;
  - xmax: `-42.14556243623249`;
  - ymax: `-21.51245633890636`.

### Decisão de arquitetura

A **primeira versão geográfica real** deve priorizar o consumo/espelhamento controlado dessas manchas oficiais, em vez de apresentar imediatamente uma mancha própria como se tivesse a mesma confiabilidade.

O modelo topográfico experimental do projeto continuará existindo para pesquisa, comparação e geração de profundidade, mas será claramente separado da camada `official_reference`.

### Pendência

O grupo do serviço exibe um nome `TR_055anos`, enquanto o relatório técnico lista tempo de retorno de **5 anos** e não de 55 anos. Antes de expor cenários de tempo de retorno na aplicação, verificar os IDs/metadados das subcamadas individualmente e resolver essa inconsistência nominal.

---

## 2. SGB/CPRM — carta de suscetibilidade de 2015

**Produto:** Carta de suscetibilidade a movimentos gravitacionais de massa e inundação: município de Santo Antônio de Pádua - RJ  
**Instituição:** CPRM / Serviço Geológico do Brasil  
**Ano:** 2015  
**URL:** https://rigeo.sgb.gov.br/handle/doc/15089  
**Acesso:** aberto  
**Escala do mapa:** 1:60.000  
**Classificação:** `official_reference`

Pacote publicado:

- `CS-StoAntonioDePadua.pdf` — 22,7 MB;
- `sig_santoantoniodepadua_rj.zip` — 215,36 MB;
- `bc_santoantoniodepadua_rj.zip` — 8,32 MB;
- `ortofotossantoantoniodepadua_rj.zip` — 139,26 MB;
- `produtos_mde_santoantoniodepadua_rj.zip` — 212,34 MB;
- `license.txt` — licença específica do pacote.

Uso pretendido:

- relevo/topografia complementar;
- base cartográfica;
- hidrografia;
- ortofotos para conferência visual;
- comparação com o produto hidrológico de 2024.

### Achados da auditoria técnica e legal (`2026-11-25 — R02-F`)

- **`license.txt` inspecionado:** o arquivo `license.txt` do repositório RIGeo `doc/15089` contém apenas um *template* padrão não preenchido do DSpace (`"NOTE: PLACE YOUR OWN LICENSE HERE ... grants to DSpace University (DSU)"`), enquanto os relatórios PDF trazem permissão institucional de reprodução com citação à CPRM. Por prudência jurídica, nenhum raster ou vetor bruto do pacote `doc/15089` é redistribuído no repositório Git até esclarecimento formal junto ao SGB.
- **`bc_santoantoniodepadua_rj.zip` (`8.728.248` B, `SHA-256: fd3a14323576e591514aff20046b911248a890e0dc22b74a9660f84c47a9abfe`):** contém pontos de sedes distritais/vilas (`Distritos.shp`, `localidade_cartograma.shp`, `EPSG:4674`) e geodatabase `.mdb`; **não possui limites de bairros**.
- **`produtos_mde_santoantoniodepadua_rj.zip` (`222.657.788` B, inspecionado via HTTP Range):** MDE em formato Esri Grid (`MDE/sp_sirgas_utm`) com resolução espacial de **`30,0 m × 30,0 m`** (`EPSG:31983`, `SIRGAS 2000 / UTM 23S`, cotas entre `62,974 m` e `970,586 m`) — **3× mais grosseiro** que o MDE reamostrado de `10 m` do estudo SGB de 2024.
- **`ortofotossantoantoniodepadua_rj.zip` (`146.021.583` B, inspecionado via HTTP Range):** ortofoto ECW com resolução (`GSD`) de **`1,00 m × 1,00 m`** em `EPSG:31983`, útil para conferência visual planimétrica complementar.

---

## 3. Prefeitura — bairros oficiais (`BLOCKED_DATA_SOURCE` para polígonos)

### Lei municipal nº 3.864/2017 e Lei municipal nº 4.135/2021

**Fonte:** Prefeitura Municipal de Santo Antônio de Pádua  
**Documento 1:** Lei nº 3.864, de 27 de dezembro de 2017 — Planta Genérica de Valores (`1.962.244` B, `137` pág., `SHA-256: 379a5accce9c37a31ce160cad9dc6b3164a455a540cabfc4a151f8ed6e95a971`)  
**URL ativa verificada em `2026-11-25`:** http://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2017/12-dezembro/lei_sancionada_no_3.864-17.pdf *(o subdomínio legado `santoantoniodepadua.itcast.com.br` encontra-se inativo)*  
**Documento 2:** Lei nº 4.135, de 17 de novembro de 2021 — Atualiza a Planta Genérica de Valores / Tabela I por Logradouro (`934.409` B, `18` pág., `SHA-256: 7d0482d79a0b8cca038b340f51abae42f0448b2ecd93386b355bc17fba9081a2`)  
**URL ativa verificada em `2026-11-25`:** http://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2021/11-novembro/lei_sancionada_no_4.135-21.pdf  
**Classificação:** `official_reference`

O Anexo VI (`p. 34`) e o Anexo XIII (`p. 42`, Ata de `25/07/2017`) da Lei nº 3.864/2017 oficializam **27 bairros** na sede urbana (1º Distrito), confirmados nos códigos `01` a `27` da Tabela I da Lei nº 4.135/2021 (que também enumera separadamente localidades distritais sob os códigos `28` a `44`).

### Margem direita do Rio Pomba

1. Aeroporto *(prioritário)*
2. Alípio
3. Arraialzinho
4. Café Garoto
5. CEHAB
6. Cidade Nova *(prioritário)*
7. Dezessete
8. Farol *(prioritário)*
9. Gabri *(grafado `Gabry` na Lei nº 4.135/2021)*
10. Glória
11. Monte Líbano
12. Parque das Águas
13. Santa Afra
14. São Félix *(prioritário)*
15. São Luis *(grafado `São Luiz` na Lei nº 4.135/2021)*
16. Sardemberg *(grafado `Sardenberg` na Lei nº 4.135/2021)*

### Margem esquerda do Rio Pomba

17. Alequicis
18. Barro Branco
19. Carvalho
20. Centro *(prioritário)*
21. Divinéia *(prioritário)*
22. Ferreira
23. Industrial
24. Jorimpa
25. Mirante *(prioritário)*
26. Pereira
27. Tavares

> Nota de reconciliação ortográfica (`R02-F`): na Lei nº 3.864/2017, o Anexo VI contém os erros tipográficos `22 - FERRERIRA` e `26 - PERERIRA`; o Anexo XIII (Ata) corrige `26 - PEREIRA` (mantendo `22 - FERRERIRA`), e a Tabela I da Lei nº 4.135/2021 retifica ambos para `22 - Ferreira` e `26 - Pereira`. A rastreabilidade literal das três tabelas está versionada em `data/metadata/neighborhoods/neighborhood_registry.json`.

### Situação auditada dos polígonos (`2026-11-25` — `BLOCKED_DATA_SOURCE`)

- O Anexo VI da Lei nº 3.864/2017 remete a `* Vide Mapa em anexo` (`p. 34`), mas **o mapa anexo foi omitido na publicação oficial** e `73` das `137` páginas do PDF estão em branco (apenas cabeçalho).
- A Lei nº 4.135/2021 publica `1.065` entradas de logradouros associados aos bairros, porém sem coordenadas ou pontos de seccionamento para vias que cruzam múltiplos bairros.
- **Condições de uso:** a disponibilidade pública em portal municipal (LAI nº 12.527/2011) não equivale automaticamente a licença aberta irrestrita para redistribuição de arquivos brutos ou bases cartográficas derivadas; por isso, versionam-se apenas metadados e nomenclatura legal, com pedido de confirmação incluído na minuta à Prefeitura.
- **Resultado (`0/27` polígonos utilizáveis):** registrado formalmente como **`BLOCKED_DATA_SOURCE`** em `docs/research/MUNICIPAL_NEIGHBORHOOD_BOUNDARIES.md`, `data/metadata/neighborhoods/neighborhood_registry.json` e `lib/neighborhoods/`. Minuta de solicitação institucional (LAI / Ofício Acadêmico) preparada para revisão do mantenedor, sem envio automático.
- Não usar limites de bairros de fontes comerciais, setores censitários ou diagramas de Voronoi como referência oficial.

---

## 4. Prefeitura — Plano Diretor e saneamento

### Plano Diretor 2018

Página pública com Lei nº 3.922/2018 (`SHA-256: b6ceb430...`) e mapas M1–M6:

http://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2018/11-novembro

Auditado em `2026-11-25`: os mapas M1–M6 (`1:125.000` e `1:35.000`, sem grade de coordenadas) delimitam macrozonas, sistema viário e a Zona de Proteção do Rio Pomba (`ZPROPOMBA`), mas **não contêm limites de bairros**.

### Plano Municipal de Saneamento Básico (2019 e revisão SES 2024)

Exemplo de mapa de setores da sede urbana (`1:3.500`, `EPSG:31983`, `SHA-256: 609e59c3...`):

http://www.santoantoniodepadua.rj.gov.br/portal/arquivo/36/2024/volume_1_relatorio_tecnico_preliminar_rtp/tomo_iv_n_desenho/setores_censitarios_-_sede_urbana.pdf

Achados `R02-F`:
- mapeia `37` setores de projeto (`CS01–CS37`, `706,39 ha`) cujas linhas descritivas listam apenas ruas de referência, não bairros oficiais;
- o Anexo VIII do PMSB (Programa `A.PI-1`) confirma documentalmente a inexistência de Cadastro Técnico Multifinalitário / SIG na Prefeitura;
- o Diagnóstico de agosto/2024 (`pmsb2024_diagnostico.pdf`, p. 14) identifica a existência do **`Volume II — Levantamentos de Campo, Tomo I — Levantamento Topográfico`** (Contrato nº `02/2024`), não publicado no portal web e incluído como alvo prioritário para validação altimétrica local (`#7` e `#9`).

---

## 5. IBGE e Base Cartográfica Estadual (`BC25_RJ`)

**Produtos auditados em `2026-11-25` (`EPSG:4674 — SIRGAS 2000`, `official_reference`):**

1. **Malha Municipal Digital 2024:** https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/15774-malhas.html — limite municipal (`3304706`) e distrital.
2. **Malha Territorial de Bairros — Censo 2022 (`RJ_bairros_CD2022.zip`, `SHA-256: 8eb963e5...`):** contém `1.509` bairros em 31 municípios do RJ, mas **`0` registros para Santo Antônio de Pádua (`3304706`)**.
3. **Malhas de Setores Censitários — Censos 2022 (`RJ_setores_CD2022.zip`, `154` setores, `SHA-256: 88dc4a6c...`) e 2010 (`71` setores, `SHA-256: 1a794c55...`):** `CD_BAIRRO` e `NM_BAIRRO` vazios em **100% dos setores**; descritivos de perímetro (`Descrição_RJ.xlsx`) demonstram incompatibilidade entre setores e bairros.
4. **Base Cartográfica Contínua `BC25_RJ` 1:25.000 (IBGE / SEA-RJ / INEA, EDGV 3.0):** https://geoftp.ibge.gov.br/cartas_e_mapas/bases_cartograficas_continuas/bc25/rj/versao2018_edgv_3.0/ — `0` limites intramunicipais de bairros (`lml_outros_limites_oficiais_l`), porém fornece **`427` pontos cotados altimétricos de terreno seco (`rel_ponto_cotado_altimetrico_p`)** e **`48` ilhas fluviais (`hid_ilha_a`)** na AOI urbana (`Ilha da Convivência` com ponto cotado de terreno de `86,0 m` e margens adjacentes à `Praça Monsenhor Diniz` de `84,0 m`, que não demonstram declividade da lâmina d'água), detalhados em `docs/research/MUNICIPAL_NEIGHBORHOOD_BOUNDARIES.md`.

---

## 6. OpenStreetMap — ruas, pontes e pontos de interesse

**Classificação:** `official_reference` não; utilizar como **fonte cartográfica colaborativa complementar** sob licença **ODbL 1.0** (atribuição `© OpenStreetMap contributors` + obrigação *share-alike* para derivados).

Auditoria na AOI urbana (`2026-11-25`, API v0.6 `bbox=-42.22,-21.56,-42.15,-21.51`, `9.516` elementos, `SHA-256: 16794b21...`):
- **`0` polígonos de bairros** (apenas `admin_level=8` município e `admin_level=9` distritos);
- **`13` nós pontuais `place=suburb`**, dos quais `11` correspondem a bairros da PGV e `2` são denominações populares sem correspondência na Lei nº 3.864/2017 (`Gerador` e `São José`), estando ausentes até mesmo como ponto `Centro`, `Farol` e `Mirante`;
- eixos viários, praças e pontes apresentam incerteza planimétrica não aferida localmente (típica de digitalização sobre imagens orbitais `Bing/IBGE`), exigindo validação manual em estruturas críticas (ex.: projeção 2D de manchas sobre tabuleiros elevados das pontes Raul Veiga e Alberíades Gabry).

---

## 7. INEA — Alerta de Cheias

**Página pública oficial:**  
https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.html  
**Exportação estruturada oficial (XML):**  
https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.xml  
**Classificação:** `observed`  
**Status de auditoria:** implementado e testado offline (evidência original coletada em **2026-11-24 / 2026-11-25 UTC**; smoke test em ambiente CLOUD bloqueado por indisponibilidade/egresso de rede; coletor ao vivo desativado por padrão via `FLOODSIM_ENABLE_LIVE_INEA=true` até homologação operacional e confirmação institucional de permissões de consumo)

### Identidade e metadados auditados

- **Instituição:** Instituto Estadual do Ambiente (INEA) — Sistema de Alerta de Cheias;
- **Código da estação (XML `<estacao codigo="...">`):** `213042120` (`tipo="Plu/Flu"`);
- **Nome oficial publicado:** Santo Antônio de Pádua (Rio Pomba, conforme `hidro213042120.html`);
- **Coordenadas oficiais publicadas em `mapa.php`:** latitude `-21.511110305786`, longitude `-42.207527160645` (WGS84 / `EPSG:4326`);
- **Frequência de medição:** 15 minutos (`data_hora` nos últimos 10 dias; ~961 registros por arquivo XML);
- **Frequência de atualização da página/exportação:** meta-refresh de 300 s (5 min); servidor suporta `ETag` e `Last-Modified` (`HTTP 304`);
- **Unidades originais:** nível do rio (`nivel_rio_ultimo`) em **metros (`m`)** com separador decimal `.`; chuva (`chuva_ultimo`, `chuva_1h`, `chuva_4h`, `chuva_24h`, `chuva_96h`, `chuva_30d`) em **milímetros (`mm`)**;
- **Fuso horário original:** `America/Sao_Paulo` (`UTC-03:00`), exibido na página como `"Hora Local"` no formato `DD/MM/YYYY HH:mm`;
- **Sentinela de dado ausente observada:** `"Dado Nulo"`;
- **Limiares locais publicados pela estação:** Cota de 80% = **4,00 m** (`400 cm`); Cota de transbordamento = **5,00 m** (`500 cm`);
- **Não confirmados (mantidos `null` no contrato):** código RHN equivalente (`rhnCode: null`), zero da régua (`gaugeZeroMeters: null`), datum vertical (`verticalDatum: null`).

### Condições de acesso, termos de uso e proveniência

- Acesso público HTTPS sem autenticação e sem bloqueio em `robots.txt` (`/robots.txt` retorna `404`).
- **Termos de uso e redistribuição (PENDENTE):** a existência pública da página e do XML em `alertadecheias.inea.rj.gov.br` **não comprova autorização irrestrita** para consumo automatizado contínuo, armazenamento histórico ou redistribuição de registros. Não foi localizada licença aberta explícita publicada no portal Alerta de Cheias; além disso, o serviço estadual de séries históricas hidrometeorológicas do INEA (`https://www.rj.gov.br/servico/monitoramento-hidrometeorologico-dados-historicos39`) exige requerimento formal com justificativa (`geseg@inea.rj.gov.br` / `alertadecheias@gmail.com`).
- **Política adotada enquanto a autorização formal estiver pendente:**
  - não armazenar séries brutas nem redistribuir dumps ou trechos reais do XML no repositório Git;
  - manter atribuição explícita ao INEA e link direto para a página oficial da estação;
  - utilizar apenas fixture **sintética** explicitamente rotulada nos testes automatizados (`tests/fixtures/hydro/inea-213042120-synthetic.xml`);
  - preservar metadados e hash SHA-256 da evidência original coletada na auditoria para rastreabilidade científica, sem redistribuir o conteúdo XML original.

### Política de cache, proteção à fonte e segurança TLS

- Consumo implementado exclusivamente **server-side** em `lib/hydro/providers/ineaAdapter.ts` com:
  - HTTPS obrigatório (`rejectUnauthorized: true`), validação padrão de hostname e allowlist estrita de host (`alertadecheias.inea.rj.gov.br`);
  - limite de 2 MiB por resposta, máximo de 3 redirecionamentos (cada salto revalidado na allowlist), timeout por tentativa de 8 s, orçamento total máximo de aquisição de **12 s** e no máximo **1 retry** (apenas para erros transitórios, nunca para timeout, 4xx ou erro TLS);
  - ausência de bypass público de cache em `/api/hydro/observations` (parâmetros arbitrários como `refresh=1` são rejeitados com HTTP `400`);
  - deduplicação de consultas concorrentes em voo (`inFlight`), cache em memória de **5 minutos (300 s)** com validação condicional (`If-None-Match` / `If-Modified-Since`) e falha fechada (`unavailable` / `invalid` sem fallback fictício).
- **Cache HTTP/CDN compartilhado (Vercel serverless):** respostas `200` válidas recebem `Cache-Control: public, max-age=0, s-maxage=<N>` onde `<N>` é limitado tanto pelo TTL restante de 300 s quanto (quando `status: "fresh"`) pelo tempo restante até a janela de obsolescência (`measuredAt + 45 min`), sem `stale-while-revalidate`. Respostas de erro (`400`, `502`, `503`) usam sempre `Cache-Control: no-store`.
- **Limitação do cache distribuído:** caches em memória em funções serverless são por instância e o cache HTTP/CDN (`s-maxage`) atua em regime *best-effort* por região/PoP. Essa arquitetura reduz carga proporcionalmente à cadência do INEA sem introduzir Redis ou serviços pagos, mas **não constitui limitação global de taxa nem proteção global contra abuso**.
- **Auditoria e manutenção TLS (`lib/hydro/providers/ineaTlsChain.ts`):**
  - o servidor `alertadecheias.inea.rj.gov.br` omite o certificado intermediário público `Sectigo Public Server Authentication CA DV R36` no handshake TLS;
  - **origem oficial:** `http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt` (`crt.sh/?d=4267304690`), serial `397A66CC2756362E0DAA87CA6EABE3B1`;
  - **fingerprint SHA-256:** `8C:54:C3:34:B6:6B:A4:E4:26:77:2A:F4:A3:F9:13:6C:19:A1:AE:C7:29:FD:B2:8C:53:5C:07:A5:A4:EF:22:E0`;
  - **validade:** `2021-03-22T00:00:00Z` a `2036-03-21T23:59:59Z`;
  - **cadeia de confiança:** o intermediário **nunca** é confiado como raiz; em tempo de execução, `verifyIneaIntermediateCertificate()` verifica a flag CA, o fingerprint SHA-256, a janela de validade e a assinatura criptográfica contra a raiz `Sectigo Public Server Authentication Root R46` embutida em `tls.rootCertificates` do Node.js;
  - **manutenção em caso de renovação institucional:** se o INEA renovar o certificado sob o mesmo intermediário R36, nenhuma alteração é necessária; se o servidor passar a enviar a cadeia completa, o intermediário auxiliar pode ser removido após validar `npm run smoke:hydro`; se o INEA migrar para outro intermediário também omitido, obter o certificado exclusivamente no repositório oficial da AC emissora, validar sua assinatura contra `tls.rootCertificates`, atualizar o PEM e o fingerprint auditado em `ineaTlsChain.ts` e registrar a rotação neste documento.

### Evidência auditada (metadados preservados sem redistribuição do XML)

- **Data/hora da coleta original (UTC):** `2026-11-25T02:56:27Z` (`2026-11-24 23:56:27 -03:00`);
- **URL consultada:** `https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.xml`;
- **SHA-256 do recorte sanitizado originalmente auditado (`4111` bytes, substituído na árvore de trabalho por fixture sintética até confirmação de redistribuição):** `073ed554f98a8fc181d81902eb710caffcd00beaca10e2bed1afa2cb384dc048`;
- **Estrutura XML verificada:** elemento raiz `<estacao codigo="213042120" tipo="Plu/Flu">`, `<nome_estacao>`, `<dados_ultimos_10_dias>` com blocos `<registro>` contendo `data_hora`, `chuva_ultimo`, `chuva_1h`, `chuva_4h`, `chuva_24h`, `chuva_96h`, `chuva_30d` e `nivel_rio_ultimo`;
- **Amostra conferida simultaneamente na página HTML e no XML:** `24/11/2026 23:45` (BRT), nível `4.17 m` (`417 cm`), chuva `0.0 mm` (15 min/1 h/4 h), `0.2 mm` (24 h), `4.6 mm` (96 h), `17.0 mm` (30 d) e sentinela `"Dado Nulo"` observada em registro anterior (`14/11/2026 23:45`).

### Regra crítica: não converter diretamente INEA -> manchas SGB

Fatos sustentados pela auditoria atual:

1. **Localizações físicas distintas:** INEA `213042120` está publicada em `(-21.511110, -42.207527)` e SGB/ANA `58790002` (Santo Antônio de Pádua II — Clube de pesca do município) está em `(-21.53786, -42.15778)`, separadas por cerca de **5,9 km** ao longo do Rio Pomba.
2. **Zero da régua e datum do INEA não identificados:** não foi localizado documento institucional que informe o zero da régua e o datum vertical da estação INEA `213042120` (mantidos `null` no contrato).
3. **Equivalência não estabelecida:** a equivalência entre as referências verticais das duas estações não foi estabelecida (como indício empírico da necessidade de crosswalk formal, em `24/11/2026 23:45 BRT` o INEA publicou `4,17 m`, enquanto o SACE/SGB indicou a estação `58790002` na classe qualitativa `"Cota de Atenção"`, sem que isso constitua prova geodésica dos zeros ou datums).
4. **Comparação direta e associação automática não validadas:** é proibido no código (`crosswalkValidated: false`) comparar diretamente os níveis ou acionar manchas SGB a partir de leituras do INEA sem um crosswalk formalmente validado.

```text
nivel_inea_4_17m -> COTA_425cm_SGB   [PROIBIDO SEM CROSSWALK VALIDADO]
```

### Pendências de pesquisa e governança (G3/G4)

- confirmação institucional junto ao INEA (`geseg@inea.rj.gov.br` / `alertadecheias@gmail.com`) sobre termos de consumo automatizado, frequência tolerada, armazenamento e redistribuição de amostras;
- levantamento documental do zero da régua e datum vertical da estação INEA `213042120`;
- análise histórica pareada INEA `213042120` × SGB/ANA `58790002` (escopo de séries históricas / issue #37).

### Achados de auditoria (2026-11-25 — `EXP-2026-001`)

- O endpoint XML público `https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.xml` identifica `<estacao codigo="213042120" tipo="Plu/Flu">` e expõe janela móvel de ~10 dias (961 registros, passo de 15 min, `"Dado Nulo"` como sentinela ausente); acesso público HTTP 200 não comprova autorização irrestrita de armazenamento ou redistribuição.
- Não há série histórica plurianual pública nem metadados de zero da régua/datum nesse endpoint.
- Em 926 pares simultâneos de 15 min com `58790002` (`2026-11-15..2026-11-25`), com as estações em locais físicos distintos, a diferença `INEA − RHN` variou entre `+88,0 cm` e `+159,0 cm` (média `+111,02 cm`, desvio `13,95 cm`), o que não sustenta conversão direta (sem afirmar diferença de datum comprovada sem os metadados oficiais). **Decisão:** `NO-GO` para associação automática com manchas SGB; solicitação formal de histórico e zero da régua preparada em `docs/experiments/HIDROWEBSERVICE_ACCESS_REQUEST.md`.

---

## 8. ANA

Uso pretendido:

- metadados de estações da Rede Hidrometeorológica Nacional;
- séries históricas de nível/vazão/chuva quando adequadas;
- curva-chave e informações complementares da estação `58790002`, quando públicas.

A ANA também é citada pelo estudo de 2024 como responsável por viabilizar a operação da estação hidrológica usada pelo SGB.

### Achados de auditoria de acesso (2026-11-25 — `EXP-2026-001`)

- **ANA SOAP (`https://telemetriaws1.ana.gov.br/ServiceANA.asmx`):** acessível publicamente via HTTPS para `HidroInventario`, `DadosHidrometeorologicos` (chunks sequenciais de 90 dias, `15 min` em `58790002` e `58770000`, `60 min` em `58788600`) e `HidroSerieHistorica` (`tipoDados=1` diário em `58790002`, consistências `1` e `2`).
- **ANA / SNIRH HidroWebService REST (`https://www.snirh.gov.br/hidroweb/rest/api/*` e `https://www.ana.gov.br/hidrowebservice/`):** retornaram HTTP `401` (token ausente) e HTTP `503` durante a auditoria. O credenciamento oficial exige solicitação formal via `hidro@ana.gov.br` / `telemetria@ana.gov.br` (documentada em `docs/experiments/HIDROWEBSERVICE_ACCESS_REQUEST.md`).
- **SGB / SACE (`https://sace.sgb.gov.br/bacia_pomba/`):** apresentou reset TLS no redirecionamento durante o teste e não expôs API histórica pública verificada.

---

## 9. Referência acadêmica complementar

Uma dissertação de 2024 da UFF analisou inundações do Rio Pomba no trecho de Santo Antônio de Pádua com o software IBER e diferentes MDEs.

**Título/arquivo:** dissertação de Raul Simiqueli (defesa em 29/08/2024)  
**URL:** https://mcct.uff.br/wp-content/uploads/sites/454/2025/04/Dissertacao-Raul-Simiqueli-defendeu-em-29-08-2024.pdf

Informações úteis para pesquisa:

- comparação de diferentes MDEs;
- uso do Copernicus GLO-30;
- modelagem com dados reais de eventos de janeiro de 2022 e 2023;
- dados topográficos municipais/PAE citados como fonte de melhor ajuste em parte da pesquisa.

Esta fonte serve como **referência metodológica**, não como substituição dos produtos oficiais do SGB/Prefeitura.

### Regra para dados citados na dissertação

A dissertação menciona bases topográficas obtidas junto à Prefeitura/PAE. Essas bases **não devem ser tratadas como propriedade do autor da dissertação nem copiadas para o FloodSim apenas por terem sido utilizadas na pesquisa**.

Antes de usar exatamente esses arquivos:

1. identificar o provedor/titular original;
2. preferir solicitação ou download diretamente da Prefeitura/órgão responsável;
3. registrar licença ou autorização;
4. confirmar se derivados podem ser publicados;
5. manter a dissertação como referência metodológica e bibliográfica, independentemente da aquisição dos dados.

**Status de incorporação da base municipal/PAE citada na dissertação:** `not_acquired / authorization_pending`.

---

## 10. SAH-Pomba — referência para previsão em Santo Antônio de Pádua

### Relatório técnico 2021

**Instituição:** CPRM / Serviço Geológico do Brasil  
**Uso:** referência metodológica e benchmark histórico para a linha de previsão  
**URL:** https://rigeo.sgb.gov.br/server/api/core/bitstreams/59c0e2b1-8a9e-4898-9c3b-1737d6f71256/content  
**Classificação:** `official_reference`

O relatório avaliou dois modelos para Santo Antônio de Pádua. O Modelo 2, indicado como preferencial no documento, utiliza como entrada a estação:

**UHE Barra do Braúna Jusante — código 58788600**

Valores reportados naquele estudo:

- tempo de deslocamento: **8 h**;
- correlação montante-jusante: **0,939**;
- MAE: **±11 cm**;
- PBIAS: **0,0%**;
- KGE: **0,956**.

Esses valores serão tratados apenas como **benchmark histórico**. O Pádua FloodSim deverá obter as séries pertinentes, documentar período/qualidade e reavaliar a relação em protocolo independente.

O próprio relatório alerta para a necessidade de acompanhar a qualidade/disponibilidade da estação, pois ela é operada pelo setor elétrico.

### Relatório anual 2022

Relatório do SAH-Pomba de 2022 registra equação para Santo Antônio de Pádua com antecedência de **8 horas**.

Uso pretendido:

- contextualizar a hipótese Barra do Braúna -> Pádua;
- orientar a busca de dados;
- comparar resultados futuros;
- não substituir validação própria.

### Auditoria operacional SGB SACE / SAH-Pomba (2026-11-25)

**Portal:** https://sace.sgb.gov.br/pomba/ (acessado via https://www.sgb.gov.br/sace/)  
**Endpoint REST público auditado:** https://sace.sgb.gov.br/pomba/api/geojson/point

A inspeção ao vivo em **2026-11-25 UTC** confirmou:

- o endpoint GeoJSON retorna 7 pontos de monitoramento da bacia, incluindo **`58790002 - SANTO ANTÔNIO DE PÁDUA`** (`sigla: "PAD"`, `Rio Pomba`, `localizacao: "Clube de pesca do município"`, `latitude: -21.53786`, `longitude: -42.15778`, `altitude: 86.0`, `areaDrenagem: 8235.0`, `fusoHorario: "GMT-3"`, `observacao: "Estação Vaisala com sensor de pressão. Bateria 18 Ah. Estação 58790002 - Santo Antônio de Pádua II"`);
- o endpoint GeoJSON expõe apenas metadados e classe qualitativa de alerta (`tipoAlerta`, `nomeFiltroAlerta`, ex.: `"Cota de Atenção"`), **sem valores numéricos de cota ou chuva**;
- a leitura numérica na interface SACE utiliza chamadas DWR Java com estado de sessão (`GeradorGraficoService`, `ExportacaoDadosService`), menos adequada para monitoramento leve em tempo real do que o XML estruturado do INEA;
- a estação a montante **`58788600` (UHE Barra do Braúna Jusante)** não consta entre os 7 pontos ativos publicados no GeoJSON público do SAH-Pomba.

### Pendências de dados temporais

- obter série histórica de `58788600`;
- confirmar fonte oficial/acesso e termos de uso;
- obter série de `58790002`;
- alinhar timestamps, unidades e frequência;
- identificar gaps e quality flags;
- levantar pluviômetros relevantes;
- definir eventos retidos;
- investigar relação com a estação/página INEA.

Essa auditoria é candidata a **Work**, pois exige investigação multifuente e análise temporal.

### Resultados iniciais da auditoria (`2026-11-25 — EXP-2026-001`)

- Séries de `2020-01-01` a `2026-11-25` adquiridas via `telemetriaws1.ana.gov.br` para `58790002`, `58788600` e estação complementar a montante `58770000` (Cataguases, SGB-CPRM, `15 min`), além de inventário dos 5 pluviômetros em Santo Antônio de Pádua (`2142067`, `2141094`, `2142083`, `2142049`, `2142058`). Acesso público HTTP 200 não é tratado como licença irrestrita de armazenamento ou redistribuição.
- `58788600` apresentou 78 episódios de valor constante (`suspect_flatline >= 24 h`, `6.276 h` no total — suspeita de qualidade que não comprova isoladamente defeito instrumental, sem descarte automático da estação) e pico anômalo em setembro/2025; em `58770000`, `r = 0,9302` em `16 h` ocorreu no limite da janela testada (`0..16 h`) e não define tempo de propagação nem prova ganho preditivo.
- Detalhes, manifestos SHA-256 (com reprodução de inputs locais classificada como `BLOCKED_LOCAL_DATA` em Cloud), eventos candidatos, divergência pendente de jan/2023 (`428 cm` vs `431 cm` SGB), piloto exploratório `B0/B1` e protocolo seguinte registrados em `docs/experiments/EXP-2026-001-historical-hydrological-datasets.md`, `docs/experiments/EXP-2026-002-forecast-protocol.md` e `data/metadata/hydrology/`.

---

## Área de interesse inicial (AOI)

### AOI hidráulica inicial

Usar inicialmente a extensão publicada pelo serviço oficial de manchas do SGB:

```text
xmin = -42.20900097927306
ymin = -21.553311556725685
xmax = -42.14556243623249
ymax = -21.51245633890636
CRS  = EPSG:4674 (SIRGAS 2000)
```

Essa área cobre o trecho urbano mapeado pelo produto oficial.

### AOI de contexto do mapa

Para interface, ruas, bairros e relevo, trabalhar com um pequeno buffer ao redor da AOI hidráulica. O buffer final deve ser definido no pipeline GIS em unidades métricas após reprojeção para SIRGAS 2000 / UTM 23S.

---

## Estratégia de armazenamento

Evitar colocar dados brutos grandes diretamente no Git.

Estrutura sugerida:

```text
data/
  raw/          # ignorado pelo Git; downloads originais
  interim/      # ignorado pelo Git; reprojeções/recortes
  processed/    # somente artefatos pequenos necessários ao front
  metadata/     # manifests versionados
```

Todo artefato processado deve carregar metadados suficientes para reproduzir sua origem.

---

## Separação dos tipos de dado

### Observado (`observed`)

Leitura recebida de uma estação ou órgão oficial.

### Referência oficial (`official_reference`)

Mapa, mancha ou cenário técnico publicado por instituição responsável.

### Processado (`processed`)

Dado observado ou oficial submetido a normalização, sincronização, transformação de unidade/referência ou controle de qualidade, sem se tornar previsão.

### Derivado (`derived`)

Resultado de processamento do Pádua FloodSim a partir de dados de origem.

### Simulado (`simulated`)

Resultado de modelo espacial experimental do Pádua FloodSim.

### Previsto (`forecast`)

Estimativa futura produzida por modelo temporal validado e identificada por horizonte, versão e incerteza.

### Mock (`mock`)

Dado fictício usado somente para desenvolvimento da interface.

Essa classificação deve aparecer nos metadados e, quando relevante, na interface.
