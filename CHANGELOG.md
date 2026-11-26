# Changelog

Todas as mudanças relevantes do Pádua FloodSim serão registradas neste arquivo.

## [Unreleased] — v0.2.0-academic (candidata — não publicada) — 2026-11-26

Consolidação na `main` dos PRs #41–#45, #48, #49, #54, #55 e #56, e entrega do módulo de histórico hidrológico e acervo de enchentes (**R02-E — #52**). Nenhuma tag, release publicada, depósito Zenodo ou deploy em produção foi executado nesta etapa.

### Histórico hidrológico e acervo de enchentes (R02-E — #52)

- **Domínio histórico desacoplado (`lib/history/contract.ts`, `normalize.ts`, `catalog.ts`, `analysis.ts`, `hydrograph.ts`, `controlPoints.ts`):** cataloga 13 eventos verificados (2012–2026) separando **6 inundações urbanas documentadas** (`HIST-2012-01-04`, `HIST-2020-01-25`, `HIST-2022-01-08`, `HIST-2022-02-04`, `HIST-2023-01-08`, `HIST-2026-02-25`) de **7 eventos hidrológicos elevados** (incluindo `HIST-2020-02-13` `408 cm`, `HIST-2023-01-21` `337 cm` e pulsos de Alerta de fev–mar/2026), preservando independência entre `RHN 58790002`, `INEA 213042120`, `RHN 58788600`, `RHN 58770000` e `INEA 58789000`, sem preencher lacunas com zero.
- **Módulo público `Histórico` (`components/history/`):** linha do tempo filtrável por ano, estação com medição verificada e classe documental; painel detalhado com timestamps originais, notas de fuso/horário de verão (`BRST UTC−2` em jan/2012 e comprovação documental de `GMT = UTC+0` via Decreto nº `025/2026`), divergências (`428` vs. `431 cm` em jan/2023; apagão INEA `01–18/01/2023`; flatlines de Barra do Braúna), comparação controlada na mesma estação e acervo documental/fotográfico com SHA-256 e links externos para imagens protegidas por direitos autorais.
- **Associação ao mapa histórico e pontos de controle (`resolveHistoricalMapAssociation`, `HISTORICAL_CONTROL_POINTS`):** vincula cenários SGB somente para `RHN 58790002` com continuidade altimétrica verificada (`300–550 cm`), distinguindo inundação observada, extensão oficial modelada, representação derivada (`A × B`) e cenário aproximado com banner contextual no mapa; estrutura 10 pontos de controle sem coordenadas inventadas e motor de hidrogramas/replay com preservação de lacunas (`BLOCKED_LOCAL_DATA` explícito no ambiente cloud; ver [`docs/research/HISTORICAL_FLOOD_CATALOG.md`](docs/research/HISTORICAL_FLOOD_CATALOG.md)).

### Comparação interativa de cenários SGB e curva cota × área (R02-C — #50)

- **Motor topológico real (`lib/sgb/compare.ts`, método `wgs84-ellipsoidal-topological-overlay-v1`):** calcula $A \cap B$ (área comum), $A \setminus B$ (exclusiva de A) e $B \setminus A$ (exclusiva de B) via `polygon-clipping@0.15.7` sobre as geometrias reais consultadas, sem pressupor aninhamento perfeito, com validação estrita de conservação de área (`<= 0,01%` ou `1 m²`, falha fechada) e fallback determinístico de snap-rounding submilimétrico (`1e-11`–`1e-9` deg) quando há erro de montagem de anel em ponto flutuante (ex.: `450` vs. `525` cm).
- **Catálogo de snapshot e verificação de divergência de área (`lib/sgb/areaCatalog.ts`):** cataloga as 11 áreas derivadas validadas em `2026-11-25` com hashes SHA-256 (`docs/research/SGB_AREA_VALIDATION_2026-11-25.md`), alimentando o gráfico interativo das 11 cotas (`components/dashboard/ScenarioAreaChart.tsx`) sem disparar 11 requisições ao SGB na abertura e exibindo alerta explícito de divergência de área em relação ao catálogo frente à geometria consultada (com nota explícita de que áreas equivalentes não comprovam geometrias idênticas).
- **Interface de comparação (`FloodDashboard.tsx`, `FloodMap.tsx`, `ScenarioComparisonCard.tsx`):** alternância entre *Cenário único* e *Comparar cenários*, seleção independente de Cota A e Cota B (`Cota de referência SGB — Pádua II (58790002)`), inversão A ⇄ B, visualização simultânea das três regiões topológicas com legenda dedicada, diferença absoluta em hectares e percentual, e tabela de *Dados e fontes* enriquecida com a área derivada do snapshot. Limitação registrada para melhoria futura: a sobreposição topológica executa na thread principal do navegador (~1,3–3,1 s em camadas SGB completas), podendo causar pausa perceptível em dispositivos modestos (migração para Web Worker fora do escopo da R02-C).
- **Verificação cartográfica de `COTA_300cm` (#7, #9):** confirmado que o payload SGB `MapServer/3` (SHA-256 `100cd53b4ca6be2abf33fbefd9c0701c6765cc3bd609dead7e82cf3442be394f`, `755.946` bytes, `18.085` vértices) é transmitido e renderizado integralmente sem suavização, deslocamento ou recorte artificial; limites oficiais preservados intactos.

### Segurança e Quality Gate (#38)

- **CI supply chain (`.github/workflows/ci.yml`):** instalação de dependências travada em `npm ci --ignore-scripts --no-audit --no-fund` e `permissions: contents: read`, resolvendo `githubactions:S6505` e `githubactions:S8543`.
- **Secret scan (`.github/workflows/security.yml`):** `gitleaks/gitleaks-action` fixado no commit SHA completo `ff98106e4c7b2bc287b24eaf42907196329070c7` (`v2.3.9`), resolvendo `githubactions:S7637`.

### Plataforma pública funcional e cartografia (R02-B — #21 / #48)

- **Interface pública funcional:** removidos selos de protótipo (`V1`, `em breve`), menu `Alertas`, rótulos técnicos crus em inglês na apresentação pública e todos os dados/cartões fictícios (7 marcadores mock de bairros e métricas `Indisponível` sem cálculo GIS).
- **Navegação real em quatro módulos:** *Mapa e cenários*, *Monitoramento*, *Dados e fontes* (com tabela interativa dos 11 cenários SGB) e *Sobre e metodologia*, responsivos em desktop e celular sem overflow horizontal.
- **Primeira métrica espacial derivada (`derived`):** aproximação numérica em latitude autálica no elipsoide WGS84 com união topológica prévia (`lib/sgb/area.ts`, `polygon-clipping@0.15.7`, método `wgs84-ellipsoidal-geodesic-union-v1`) exibida como **Área da mancha selecionada**, com falha fechada estrita em coleções/anéis inválidos ou degenerados e validação numérica independente via `pyproj 3.8.0`/`shapely 2.2.0` nas 11 camadas reais SGB (diferença máxima `0,003 m²` vs. Karney WGS84; [`docs/research/SGB_AREA_VALIDATION_2026-11-25.md`](docs/research/SGB_AREA_VALIDATION_2026-11-25.md)).
- **Camada real de estações hidrológicas (`lib/hydro/stations.ts`):** incluídas INEA Santo Antônio de Pádua (`213042120` / `ANA FLU 58774000`) e INEA Ponte Paraoquena (`ANA FLU 58789000`) com popups institucionais; estação `RHN 58790002` documentada e omitida do mapa até resolução da divergência de coordenadas (~2,4 km) entre ANA e SGB.
- **Monitoramento INEA e estabilidade do modal:** linguagem simples em português com mensagem objetiva quando a coleta automática está desativada (`FLOODSIM_ENABLE_LIVE_INEA` preservada desligada); corrigido ciclo de vida do `MethodologyModal` para não fechar em re-renders assíncronos do mapa.

### Pesquisa hidrológica, observações e governança (R01 / R02-A — #41–#45)

- Integrados contrato de observações (`docs/OBSERVATION_CONTRACT.md`), skills (`audit-hydro-source`, `verify-hydro-observations`), adaptador/API INEA (`/api/hydro/observations`, flag desligada por padrão), pipeline científico Python (`scripts/research/hydrology/`) com CI determinístico offline e auditoria documental do acervo histórico INEA (`docs/research/INEA_HISTORICAL_ARCHIVE.md`).
- Manifestos históricos preservados; `EXP-2026-001` exploratório (`BLOCKED_LOCAL_DATA` em Cloud), `EXP-2026-002` pré-registrado e não executado; vínculo `INEA 213042120` / `ANA FLU 58774000` documentado sem confirmação de datum ou crosswalk; sem previsão pública.
- Preparadas notas consolidadas em [`docs/releases/v0.2.0-academic.md`](docs/releases/v0.2.0-academic.md) e atualização de `package.json`, `package-lock.json` e `CITATION.cff` (preservando o DOI `10.5281/zenodo.22928810` exclusivamente para `v0.1.0-academic` e o DOI conceitual `10.5281/zenodo.22928809`).

## [Unreleased] — Research Phase — 2026-10-05

### Documentação e governança

- formalizada a identidade **Monitorar -> Prever -> Traduzir em impacto espacial**;
- criado `docs/PROJECT_CHARTER.md`;
- criada fundação temporal em `docs/FORECAST_MODEL.md`;
- criado plano científico em `docs/ARTICLE_PLAN_RBMET.md`;
- criado protocolo integrado de validação;
- criado registro de experimentos;
- criado ADR da Research Phase;
- criada política de governança GitHub/Notion/Chat/Work;
- criada política de transparência sobre uso de IA;
- iniciado diário formal de pesquisa.

### Escopo científico

- previsão de curto prazo passa a ser frente central de pesquisa;
- UHE Barra do Braúna Jusante (`58788600`) registrada como candidata prioritária de montante com base em trabalhos prévios do SAH-Pomba;
- o desempenho publicado pelo SAH-Pomba passa a ser tratado apenas como benchmark histórico;
- previsão temporal e modelo espacial permanecem desacoplados até validação do crosswalk de referência;
- novas categorias formais: `processed` e `forecast`.

### Segurança

- reforçada a proibição de apresentar o FloodSim como alerta oficial;
- cenários podem apoiar compreensão/preparação, mas não devem emitir comandos de evacuação ou retirada de bens.

## [0.1.0-academic] — 2026-09-23

Primeira versão acadêmica de referência do Pádua FloodSim.

### Incluído

- dashboard web experimental para Santo Antônio de Pádua, RJ;
- mapa interativo com MapLibre GL JS;
- integração das manchas oficiais de inundação do Serviço Geológico do Brasil (SGB) para cotas de 3,00 m a 5,50 m;
- separação explícita entre referência oficial, observado, derivado, mock e simulado;
- documentação de arquitetura, metodologia e modelo de inundação experimental;
- catálogo de fontes e metadados geoespaciais;
- política de autoria, atribuição e proveniência;
- documentação de trabalhos relacionados;
- arquivo `CITATION.cff` com autoria e ORCID;
- validações automatizadas de CI, segurança e integração das camadas SGB.

### Limitações desta versão

- não calcula profundidade real da água;
- não produz previsão de enchente;
- não é sistema oficial de alerta;
- não classifica oficialmente risco por bairro;
- painel INEA permanece separado/mock enquanto a relação entre referências de régua não for validada;
- modelo experimental próprio de cota + conectividade ainda não substitui as manchas oficiais usadas na V1;
- a base topográfica municipal/PAE citada em trabalhos acadêmicos relacionados não está incorporada e permanece pendente de proveniência/autorização.

### Licença

Nesta versão, o código permanece sem licença open source explícita. Dados e materiais de terceiros continuam sujeitos às condições de suas fontes originais.

### Autoria

**Sérgio Izaque Pinheiro Carrozino**  
ORCID: https://orcid.org/0009-0002-8421-2694
