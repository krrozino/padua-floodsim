# Estudo Metodológico — Consulta Geográfica, Geocodificação e Exposição Viária (R02-D)

**Projeto:** Pádua FloodSim  
**Governança:** Programations Engineering Standard 2.0 — Research  
**Data da auditoria:** `2026-11-25` (UTC)  
**Branch:** `feat/research-r02-location-query`  
**Issue relacionada:** `#51` (R02-D — Consulta geográfica e exposição viária)  
**Decisão resumida:**
- **Consulta geográfica por clique e coordenadas + consulta sob demanda nas 11 cotas oficiais SGB:** **`GO`** (implementada na interface pública com rotulagem `derived`, falha fechada e salvaguardas semânticas explícitas).
- **Busca pública de endereços (geocodificação externa):** **`NO-GO`** para habilitação pública nesta etapa (restrições de termos de uso / taxa global compartilhada / proibição de autocomplete + cobertura OSM local de apenas `25` números prediais e `40,9%` de vias nomeadas).
- **Métricas de exposição viária OSM na interface pública:** **`NO-GO`** para exibição pública nesta etapa (motor GIS implementado, validado numericamente e testado em `lib/sgb/roads.ts` com `publicUiEligible: false`; mantido fora da UI pública por cobertura nominal insuficiente, 5 pontes elevadas interceptando o canal 2D sem altimetria de tabuleiro e pendência de compatibilidade legal ODbL 1.0 × Lei Municipal nº 4.135/2021).

---

## 1. Consulta Geográfica e Análise Entre Cotas (`lib/sgb/location.ts`, `lib/sgb/crossStageQuery.ts`)

### 1.1 Método geométrico e semântica científica

- **Identificador de método:** `wgs84-point-in-polygon-boundary-v1` (classificação: `derived`, CRS `EPSG:4326`, fonte das manchas: `Serviço Geológico do Brasil (SGB, 2024)`, estação de referência `Santo Antônio de Pádua II — RHN 58790002`).
- **Reaproveitamento do núcleo GIS existente:** reutiliza `extractValidatedPolygons` e `isFiniteWgs84Position` de `lib/sgb/area.ts`, preservando a política de **falha fechada** (qualquer feição, parte de `MultiPolygon`, anel externo ou anel interno/buraco inválido ou degenerado retorna `unavailable`, nunca `outside`).
- **Suporte topológico completo:** suporta `Polygon`, `MultiPolygon`, `FeatureCollection` e anéis internos (ilhas secas / buracos) com semântica de união:
  - estritamente interior a qualquer polígono (e fora de seus buracos) → `inside`;
  - sobre a fronteira (anel externo ou contorno de buraco) dentro da tolerância métrica e não interior a outro polígono → `boundary`;
  - fora de todos os polígonos (ou dentro de um buraco/ilha seca) → `outside`;
  - geometria ausente, vazia, carregando, com erro de rede ou inválida → `unavailable`.
- **Tratamento de fronteira:** projeção métrica local no plano tangente do elipsoide WGS84 (raios meridional $M(\phi)$ e primeiro vertical $N(\phi)$) com tolerância padrão de **`±0,5 m`** (`DEFAULT_BOUNDARY_TOLERANCE_METERS = 0.5`), escolhida bem abaixo da grade reamostrada do MDE do SGB (`10 m`) e do passo vetorial exportado (`~1 m`), garantindo robustez frente a arredondamento IEEE-754 em arestas diagonais.
- **Distinção de cobertura do modelo:** usa a extensão publicada pelo serviço oficial SGB (`EPSG:4674` / `EPSG:4326`, registrada em `data/metadata/sources.json`):
  - `minLon = -42.20900097927306`, `minLat = -21.553311556725685`
  - `maxLon = -42.14556243623249`, `maxLat = -21.51245633890636`
  - Fora dessa extensão (`outside_model_coverage`), a interface declara explicitamente que **ausência de interseção não indica ausência de possibilidade de inundação**. Dentro da cobertura, declara explicitamente que **ausência de interseção não declara imóvel seguro**.
- **Compatibilidade com comparação A/B:** avalia o ponto independentemente sobre os cenários A e B (`evaluatePointInComparison`), classificando `both` ($A \cap B$), `only_a` ($A \setminus B$), `only_b` ($B \setminus A$), `neither` ou `unavailable` (falha fechada se A ou B falhar), sem pressupor aninhamento e preservando o detalhe `interior` vs. `fronteira` em cada cenário.
- **Consulta sob demanda nas 11 cotas (`300`–`550 cm`):**
  - **Zero requisições adicionais na abertura da aplicação** (apenas a cota ativa inicial é consultada).
  - Executada exclusivamente sob clique explícito do usuário, com **cache em memória por sessão** (reaproveitando os cenários já carregados no mapa), **concorrência limitada a `3` requisições simultâneas**, barra/estado de progresso (`X/11`), cancelamento via `AbortController` e guarda contra respostas fora de ordem (`runIdRef`).
  - **Sem interpolação** entre cotas e **sem pressuposição de aninhamento**: todas as 11 cotas são verificadas independentemente; se um padrão não aninhado for encontrado (cota menor intercepta e cota maior não), ele é destacado explicitamente.
  - **Distinção semântica obrigatória:** a interface distingue explicitamente a *menor cota identificada entre os cenários SGB consultados* do *início real de inundação* (incluindo ressalva especial quando a menor cota identificada é `3,00 m`, limite inferior publicado pelo SGB, ou quando há falhas parciais na consulta).
- **Privacidade no compartilhamento:** a função `formatLocationTechnicalSummary` gera resumo copiável contendo apenas coordenadas WGS84, cota(s) SGB, estação `58790002`, fonte, método, data e aviso legal — sem coletar nem expor endereço residencial ou dados pessoais.

### 1.2 Avaliação de desempenho e necessidade de Web Worker

Benchmark executado em `Node.js v22` diretamente sobre os GeoJSON oficiais reais do Geoportal SGB (`EPSG:4326`, SHA-256 idênticos ao snapshot de `2026-11-25`):

| Cenário SGB | Bytes GeoJSON | SHA-256 | Latência média por ponto (`lib/sgb/location.ts`) | Latência de recorte viário total (`lib/sgb/roads.ts`, `591` vias OSM) |
|---|---:|---|---:|---:|
| `COTA_300cm` | `755.946` | `100cd53b4ca6be2abf33fbefd9c0701c6765cc3bd609dead7e82cf3442be394f` | `4,55 ms` | `11.230,0 ms` |
| `COTA_425cm` | `900.266` | `0f8121a22f2ddda9d91b16c77e27d740a47bbbba7a511186f25e13deceac09d8` | `6,50 ms` | `9.808,6 ms` |
| `COTA_550cm` | `1.437.811` | `b02037c35320dd7e9bbbf00fc3c2c53ef9060987b4a1bb2462c4b86caa39daa4` | `9,17 ms` | `14.251,8 ms` |

**Conclusão de engenharia:** a consulta pontual executa em **`4,5–9,2 ms`** mesmo na maior camada SGB (`1,44 MB`), abaixo do orçamento de um único quadro de `16 ms`. Portanto, **não há bloqueio relevante da interface** e um Web Worker não é necessário para a consulta pontual (evitando custo de clonagem estruturada de payloads multi-megabyte). Em contrapartida, caso o recorte da malha viária completa venha a ser adotado no futuro, seu tempo de execução (`9,8–14,3 s` por cota) exigirá pré-processamento offline em pipeline GIS ou execução isolada em Web Worker.

---

## 2. Investigação de Busca de Locais e Geocodificação

Foram avaliadas cinco alternativas frente aos termos de uso, arquitetura serverless (Vercel, sem limitador global distribuído), cobertura local em Santo Antônio de Pádua e proteção de privacidade:

| Provedor / Abordagem | Termos de uso e limites técnicos | Cobertura local verificada em Pádua | Compatibilidade com Pádua FloodSim (R02-D) |
|---|---|---|---|
| **OSM Nominatim público** (`nominatim.openstreetmap.org`) | Máximo absoluto de **1 req/s somando todos os usuários da aplicação**; **proíbe autocomplete/typeahead**; exige cache e `User-Agent` próprio; instâncias serverless sem controle global de taxa arriscam violação e bloqueio sem aviso prévio. | Base OSM local contém apenas **`25` objetos com `addr:housenumber`** e **`37` com `addr:street`** na AOI urbana do SGB (`< 0,1%` dos `25.749` endereços do CNEFE 2022), além de `55,7%` das vias sem nome. | **`NO-GO` para produção pública** (risco de violação de taxa em ambiente serverless + baixa precisão residencial). |
| **Komoot Photon público** (`photon.komoot.io`) | Uso gratuito apenas em volume "razoável", sem SLA; tráfego extensivo é estrangulado ou bloqueado; mesma base OSM subjacente. | Mesma limitação crítica do OSM em Pádua (`25` números prediais; `55,7%` das vias sem nome). | **`NO-GO` para produção pública** (sem garantia de serviço + baixa precisão de endereços). |
| **IBGE CNEFE 2022 Coordenadas** (`3304706.zip`) | Dados abertos governamentais (atribuição ao IBGE). | Contém `25.749` coordenadas de endereços no município, porém **sem nomes de logradouros nem números prediais** no arquivo público (sigilo estatístico). | **Não aplicável como geocodificador textual** (útil apenas em estudos agregados de exposição). |
| **APIs comerciais** (Google Maps, Mapbox, HERE) | Exigem chave/faturamento; os termos do Google Maps Platform proíbem exibir coordenadas geocodificadas sobre mapas não-Google (incompatível com MapLibre/OSM). | Variável; sujeita a licenciamento proprietário e custo recorrente. | **`NO-GO`** no escopo acadêmico aberto atual. |
| **Instância própria (Photon/Pelias) ou índice municipal autorizado** | Controle total de taxa e privacidade; exige infraestrutura dedicada ou base municipal oficial georreferenciada e licenciada. | Depende de cadastro de logradouros/numeração georreferenciado da Prefeitura (inexistente em acesso público até `2026-11-25`). | **Caminho recomendado para fase futura**, após eventual obtenção de base cadastral ou servidor dedicado. |

**Decisão:** entregar primeiro a consulta por **clique georreferenciado no mapa** e **entrada validada de coordenadas WGS84** (aceitando formatos decimais com ponto ou vírgula e detecção explícita — nunca silenciosa — de inversão lat/lon), mantendo a busca textual por endereço desabilitada na UI pública e explicando a limitação com transparência.

---

## 3. Estudo de Viabilidade da Exposição Viária (OSM × SGB × Lei Municipal nº 4.135/2021)

### 3.1 Proveniência, licença e integridade das fontes auditadas

1. **Malha viária OpenStreetMap (extrato da AOI SGB):**
   - **Fonte:** OpenStreetMap API v0.6 (`https://api.openstreetmap.org/api/0.6/map.json?bbox=-42.209001,-21.553312,-42.145562,-21.512456`)
   - **Data de obtenção (UTC):** `2026-11-25`
   - **Tamanho:** `1.657.243` bytes (`8.328` elementos: `7.616` nós, `685` vias, `27` relações; **`591` vias com tag `highway=*`**)
   - **SHA-256:** `42ad615234c8ca2ddc218825df1a474bb2d1c2aff46939a67b82c6e64c9951ee` *(extrato bruto mantido fora do repositório Git em `/tmp/r02d_audit/osm_sgb_aoi.json`)*
   - **CRS:** `EPSG:4326` (`WGS84`)
   - **Licença e atribuição obrigatória:** **Open Database License (`ODbL 1.0`)**, atribuição obrigatória `© OpenStreetMap contributors`, com cláusula *Share-Alike* para bases derivadas redistribuídas.
2. **Lei Municipal nº 4.135, de 17/11/2021 (Prefeitura de Santo Antônio de Pádua — RJ):**
   - **URL oficial:** `http://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2021/11-novembro/lei_sancionada_no_4.135-21.pdf`
   - **Data de verificação (UTC):** `2026-11-25`
   - **Tamanho:** `934.409` bytes (`18` páginas digitalizadas em imagem; `17` caracteres de texto embutido — sem camada OCR pesquisável)
   - **SHA-256:** `7d0482d79a0b8cca038b340f51abae42f0448b2ecd93386b355bc17fba9081a2` *(PDF bruto não versionado no Git)*
   - **Conteúdo:** *Tabela I — Valor do m² por Logradouro*, registrando `1.065` entradas tabulares distribuídas nos `27` bairros da sede (`01–27`) e localidades distritais (`28–44`), **sem geometria, sem coordenadas e sem pontos métricos de seccionamento**.
   - **Regime jurídico:** acesso público municipal (transparência administrativa / LAI nº 12.527/2011), **sem licença aberta explícita** para criação/redistribuição de base cartográfica derivada combinada sob `ODbL 1.0`.

### 3.2 Diagnóstico quantitativo de cobertura, categorias e precisão no OSM

Na extensão urbana coberta pelas manchas do SGB (`591` vias `highway=*`, extensão total de **`187,089 km`**, sendo `577` vias veiculares = `185,327 km`):

| Categoria OSM (`highway`) | Total de vias (`ways`) | Com `name` | Apenas `ref` | Sem nome nem `ref` | Pontes (`bridge=yes`) |
|---|---:|---:|---:|---:|---:|
| `residential` | `410` | `194` (`47,3%`) | `0` | `216` (`52,7%`) | `1` |
| `service` | `59` | `0` (`0,0%`) | `0` | `59` (`100,0%`) | `1` |
| `unclassified` | `31` | `1` (`3,2%`) | `0` | `30` (`96,8%`) | `0` |
| `primary` | `27` | `27` (`100,0%`) | `0` | `0` (`0,0%`) | `1` |
| `trunk` | `26` | `2` (`7,7%`) | `20` | `4` (`15,4%`) | `1` |
| `secondary` | `24` | `14` (`58,3%`) | `0` | `10` (`41,7%`) | `2` |
| `footway` | `10` | `4` (`40,0%`) | `0` | `6` (`60,0%`) | `2` |
| `steps` | `2` | `0` (`0,0%`) | `0` | `2` (`100,0%`) | `0` |
| `pedestrian` | `1` | `0` (`0,0%`) | `0` | `1` (`100,0%`) | `0` |
| `track` | `1` | `0` (`0,0%`) | `0` | `1` (`100,0%`) | `0` |
| **Total** | **`591`** | **`242` (`40,9%`)** | **`20` (`3,4%`)** | **`329` (`55,7%`)** | **`8`** |

Achados críticos de cobertura e precisão:

1. **Incompletude nominal severa:** **`55,7%` das vias (`329/591`)** não possuem `name` nem `ref`; em extensão linear, apenas `40,8%` (`76,259 km`) têm `name` e `43,5%` (`81,472 km`) têm `name` ou `ref`. Apenas **`186` logradouros/rodovias identificáveis** constam no OSM da AOI, contra `1.065` registros municipais na Lei nº 4.135/2021.
2. **Distorção grave por pontes elevadas em interseção 2D:** `5` pontes (`bridge=yes`) atravessam o polígono do canal do Rio Pomba em todas as cotas (`RJ-186` trunk `145–153 m`, `Ponte Raul Veiga` `169,0 m`, ponte `secondary` sem nome `101–109 m`, passarela `footway` sem nome `199–203 m` e `Ponte Alberíades Gabry` `239 m`). Em `COTA_300cm`, essas 5 pontes correspondem a **`32,6%` (`0,853 km` de `2,618 km`)** de toda a extensão viária interceptada em 2D! Sem levantamento altimétrico dos tabuleiros frente ao perfil da superfície livre da água, contá-las como vias inundadas produz falso positivo severo.
3. **Denominadores truncados na fronteira da AOI:** `34` vias (`5,8%`) ultrapassam a extensão mapeada pelo SGB (ex.: `RJ-186` e `Avenida Sebastião Teixeira de Carvalho`), tornando inválido reportar "% total da via atingida" sem restringir o indicador a vias integralmente contidas na cobertura conhecida.
4. **Eixos duplicados e atributos ausentes:** existem `66` vias com `oneway=yes` (incluindo pistas duplas e rotatória), de modo que a métrica mede estritamente **extensão de eixos viários (centerlines)**, não extensão de corredor viário. Além disso, `0%` das vias possuem tag `lanes` e apenas `19,6%` possuem `surface`.
5. **Cruzamento com a Lei Municipal nº 4.135/2021:** inviável de forma automática e publicável nesta etapa porque (a) o PDF oficial é integralmente digitalizado em imagem (`17` caracteres extraíveis) sem tabela estruturada aberta; (b) os registros fiscais não trazem coordenadas nem pontos de corte para logradouros compartilhados entre bairros; (c) há divergências ortográficas/toponímicas potenciais no OSM colaborativo (ex.: `Ponte Alberíades Gabry`, abreviações variáveis); e (d) fundir registros municipais sem licença aberta explícita com geometrias OSM `ODbL 1.0` exige revisão jurídica de compatibilidade antes de redistribuir qualquer base combinada.

### 3.3 Critérios de identificação, deduplicação e motor implementado (`lib/sgb/roads.ts`)

O motor de cálculo linear foi implementado de forma determinística e desacoplada da UI em `lib/sgb/roads.ts` (`wgs84-geodesic-line-clip-v1`):

- **Distância geodésica:** fórmula inversa de Vincenty sobre o elipsoide WGS84 (`computeGeodesicSegmentLengthMeters`).
- **Recorte linear exato:** interseção paramétrica de cada segmento de `LineString`/`MultiLineString` contra todas as arestas de anéis externos e buracos de `Polygon`/`MultiPolygon`, seguida de classificação do ponto médio de cada subintervalo elementar e fusão de subsegmentos contíguos.
- **Identificação e deduplicação:** normalização determinística (`normalizeRoadName`) com remoção de acentos NFD, caixa baixa, normalização de pontuação/espaços e expansão canônica de abreviações brasileiras (`r.` → `rua`, `av.` → `avenida`, `pça.` → `praca`, `dr.` → `doutor`, `cel.` → `coronel`, `pref.` → `prefeito`, etc.), usando `name` como chave primária (`name:<canon>`) e `ref` como fallback secundário (`ref:<canon>`), preservando `rawNameVariants`. Vias sem `name` e sem `ref` são somadas à extensão total e contabilizadas separadamente em `unnamedInterceptedLengthMeters` / `unnamedInterceptedRatio`, sem inflar `identifiableRoadCount`.
- **Separação de pontes e túneis:** excluídos dos totais de superfície por padrão (`excludeBridgesAndTunnels: true`) e reportados em bloco separado (`elevatedOrSubsurfaceStructures`).
- **Regra de percentual por via:** `interceptedPercent` só é calculado quando `denominatorStatus === "complete_in_coverage"` (todos os vértices da via contidos na cobertura SGB documentada); caso contrário retorna estritamente `null`.
- **Travamento para UI pública (`publicUiEligible`):** exige simultaneamente autorização de licença (`licenseClearedForPublicUi: true`) e razão de extensão sem nome `<= 10%` (`MAX_PUBLIC_UI_UNNAMED_RATIO = 0.10`), além de anexar `semanticGuardrails` obrigatórios proibindo interpretação como bloqueio, dano, profundidade ou impossibilidade de tráfego.

### 3.4 Validação numérica independente (`lib/sgb/roads.ts` vs. `shapely` + `pyproj.Geod`)

Comparação direta sobre os mesmos arquivos reais (`osm_sgb_aoi.json` × `COTA_300cm`, `COTA_425cm`, `COTA_550cm` do SGB):

| Cenário SGB | Métrica | Referência Python (`shapely 2.2` + `pyproj 3.8` WGS84) | Motor TypeScript (`lib/sgb/roads.ts`) | Diferença |
|---|---|---:|---:|---:|
| **`COTA_300cm`** | Extensão interceptada (excl. pontes) | `1,765 km` (`29` ways) | `1,765 km` (`29` feições / `76` subsegmentos) | `0,000 km` |
| **`COTA_300cm`** | Pontes separadas (`bridge=yes`) | `0,853 km` (`5` ways) | `0,853 km` (`5` ways) | `0,000 km` |
| **`COTA_300cm`** | Vias identificáveis (excl. pontes) | `17` | `17` | `0` |
| **`COTA_300cm`** | Razão sem identificação (excl. pontes) | — | `61,0%` (`publicUiEligible: false`) | — |
| **`COTA_300cm`** | *Av. Senar Frederico Rocha* (denominador completo) | `251,4 m / 373,8 m (67,3%)` | `251,4 m / 373,8 m (67,3%)` | `0,0 m` |
| **`COTA_425cm`** | Extensão interceptada (excl. pontes) | `3,386 km` (`43` ways) | `3,386 km` (`43` feições / `101` subsegmentos) | `0,000 km` |
| **`COTA_425cm`** | Pontes separadas (`bridge=yes`) | `0,868 km` (`5` ways) | `0,868 km` (`5` ways) | `0,000 km` |
| **`COTA_425cm`** | Vias identificáveis (excl. pontes) | `23` | `23` | `0` |
| **`COTA_425cm`** | Razão sem identificação (excl. pontes) | — | `53,4%` (`publicUiEligible: false`) | — |
| **`COTA_425cm`** | *Rua Amilca R. Perlingeiro* (denominador completo) | `325,6 m / 544,4 m (59,8%)` | `325,6 m / 544,4 m (59,8%)` | `0,0 m` |
| **`COTA_550cm`** | Extensão interceptada (excl. pontes) | `16,683 km` (`148` ways) | `16,683 km` (`148` feições / `320` subsegmentos) | `0,000 km` |
| **`COTA_550cm`** | Pontes separadas (`bridge=yes`) | `0,873 km` (`5` ways) | `0,873 km` (`5` ways) | `0,000 km` |
| **`COTA_550cm`** | Vias identificáveis (excl. pontes) | `70` | `70` | `0` |
| **`COTA_550cm`** | Razão sem identificação (excl. pontes) | — | `38,2%` (`publicUiEligible: false`) | — |
| **`COTA_550cm`** | *Av. Getúlio Vargas* (denominador completo) | `673,3 m / 792,3 m (85,0%)` | `673,3 m / 792,3 m (85,0%)` | `0,0 m` |
| **`COTA_550cm`** | *RJ-186* (ultrapassa limite da AOI) | `1.336,0 m` (denominador incompleto) | `1.336,0 m` (`interceptedPercent: null`) | `0,0 m` |

> **Nota semântica obrigatória:** os números acima constituem evidência metodológica de pesquisa sobre interseção geométrica 2D entre eixos viários colaborativos e cenários estáticos SGB (2024). **Não representam bloqueio viário, dano estrutural, profundidade da lâmina d'água nem impossibilidade de tráfego.**

### 3.5 Pré-requisitos para futura promoção de métricas viárias à UI pública

1. Completar auditoria/saneamento nominal dos eixos viários na AOI urbana (reduzindo a parcela sem identificação para `<= 10%`), com validação local de pontes, viadutos e acessos.
2. Obter confirmação institucional da Prefeitura sobre uso/redistribuição da relação de logradouros (`Lei nº 4.135/2021`) e resolver a compatibilidade com `ODbL 1.0` (ou manter a camada viária estritamente sob `ODbL 1.0` sem fusão proprietária).
3. Pré-processar offline os recortes por cota (com hashes SHA-256) ou executá-los em Web Worker dedicado, dado o tempo de `9,8–14,3 s` por cota na thread principal.
