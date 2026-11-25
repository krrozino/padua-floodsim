# Pádua FloodSim

Plataforma acadêmica e reprodutível de **consulta hidrológica, pesquisa de previsão de curto prazo e visualização espacial de cheias do Rio Pomba** em **Santo Antônio de Pádua, RJ**.

> **Aviso institucional:** o Pádua FloodSim tem caráter acadêmico e **não substitui os alertas e as orientações dos órgãos oficiais** (Defesa Civil Municipal, INEA, Serviço Geológico do Brasil — SGB e ANA).

[Aplicação em produção](https://padua-floodsim.vercel.app) · [Issues](https://github.com/krrozino/padua-floodsim/issues) · [Pull requests](https://github.com/krrozino/padua-floodsim/pulls) · [Releases](https://github.com/krrozino/padua-floodsim/releases)

---

## Estado atual do projeto — 25/11/2026

O Pádua FloodSim distingue explicitamente o código integrado, a versão candidata à publicação acadêmica e a versão em produção:

| Frente | Estado atual | Referência |
|---|---|---|
| **A. Código integrado na `main` aprovada e publicada** | PRs #41–#45, #48, #49 (`v0.2.0-academic` candidata / Quality Gate) e #54 (**R02-C**, comparação interativa de cenários SGB) integrados e publicados na `main`. Núcleo de bairros (**R02-F**) em revisão no PR `#55` com `BLOCKED_DATA_SOURCE` (`0/27` polígonos) e sem exposição na interface. | `main` (`63f191b`) |
| **B. Versão candidata / tags acadêmicas** | **`v0.2.0-academic` (notas e `CITATION.cff` preparados)**; criação de tag/release e depósito Zenodo permanecem desacoplados do deploy contínuo. | [`docs/releases/v0.2.0-academic.md`](docs/releases/v0.2.0-academic.md) |
| **C. Aplicação em produção** | **`padua-floodsim.vercel.app` atualizada para `63f191b`** (incluindo R02-C; deploy automático na Vercel mantido desabilitado em `vercel.json`: `"deploymentEnabled": false`; última tag acadêmica publicada: [v0.1.0-academic](https://github.com/krrozino/padua-floodsim/releases/tag/v0.1.0-academic) · DOI `10.5281/zenodo.22928810`). | `main` (`63f191b`) |

---

## Funcionalidades implementadas (árvore `main` / produção `63f191b`)

- **Interface pública funcional em quatro módulos reais:** *Mapa e cenários*, *Monitoramento*, *Dados e fontes* (com tabela interativa das 11 cotas oficiais SGB) e *Sobre e metodologia*, sem marcadores mockados de bairros, métricas fictícias ou placeholders de módulos inexistentes.
- **11 cenários oficiais de inundação SGB (`official_reference`):** polígonos oficiais publicados pelo Serviço Geológico do Brasil (2024) entre **3,00 m (300 cm)** e **5,50 m (550 cm)**, em intervalos de **25 cm**, referenciados à estação **Santo Antônio de Pádua II (`RHN 58790002`, zero `79,709 m`, datum `hgeoHNOR_IMBITUBA`)**.
- **Primeira métrica espacial derivada (`derived`):** **Área da mancha selecionada** (`lib/sgb/area.ts`, método `wgs84-ellipsoidal-geodesic-union-v1`), calculada por aproximação numérica em latitude autálica no elipsoide WGS84 após união topológica (`polygon-clipping`), com subtração de anéis internos e **falha fechada estrita** para geometrias ou anéis inválidos. Validada de forma independente com `pyproj 3.8.0` / `shapely 2.2.0` nas 11 camadas reais SGB (diferença máxima `0,003 m²` / `< 0,000001%` vs. área geodésica exata de Karney WGS84; ver [`docs/research/SGB_AREA_VALIDATION_2026-11-25.md`](docs/research/SGB_AREA_VALIDATION_2026-11-25.md)).
- **Comparação interativa de cenários SGB e curva cota × área (R02-C / #50, integrada na `main` `63f191b` e publicada em produção):** modo **Comparar cenários** (`lib/sgb/compare.ts`, método `wgs84-ellipsoidal-topological-overlay-v1`) com seleção independente das cotas A e B (`Cota de referência SGB — Pádua II (58790002)`), visualização simultânea e decomposição topológica real ($A \cap B$, $A \setminus B$, $B \setminus A$) sem pressupor aninhamento, diferença absoluta (ha) e percentual, checagem de conservação de área (falha fechada, tolerância `<= 0,01%` ou `1 m²`) e gráfico interativo das 11 cotas baseado no snapshot catalogado com hashes SHA-256 (`lib/sgb/areaCatalog.ts`, 0 requisições extras na abertura e alerta explícito de divergência de área em relação ao catálogo para a geometria consultada, sem afirmar identidade geométrica por equivalência de área). Melhoria futura registrada: mover o cálculo topológico para Web Worker em dispositivos modestos.
- **Camada real de estações hidrológicas (`lib/hydro/stations.ts`):** exibe os pontos com coordenadas verificadas documentalmente — **INEA Santo Antônio de Pádua** (`213042120` / `ANA FLU 58774000` / `PLU 2141094`) e **INEA Ponte Paraoquena** (`ANA FLU 58789000` / `PLU 2142083`). A estação `RHN 58790002` permanece documentada e omitida da camada de pontos até resolução institucional da divergência de ~2,4 km entre os cadastros ANA e SGB.
- **Monitoramento observado INEA (`observed`, coleta ao vivo desativada por padrão):** adaptador, parser XML determinístico, política stale (`45 min`), cache proporcional (`5 min`), TLS estrito com validação da cadeia Sectigo DV R36 e allowlist de host. A variável server-side `FLOODSIM_ENABLE_LIVE_INEA` permanece **desativada por padrão** até confirmação institucional dos termos de uso e homologação operacional (#6), exibindo mensagem objetiva com link para o monitoramento oficial do INEA. A leitura INEA permanece independente das manchas SGB (`crosswalkValidated: false`).
- **Pipeline científico histórico em Python (`scripts/research/hydrology/`):** aquisição controlada, controle de qualidade, detecção de flatlines, manifestos SHA-256 e suíte determinística offline. O experimento [`EXP-2026-001`](docs/experiments/EXP-2026-001-historical-hydrological-datasets.md) permanece **exploratório** (reprodução em Cloud bloqueada sem os arquivos locais originais, `BLOCKED_LOCAL_DATA`) e [`EXP-2026-002`](docs/experiments/EXP-2026-002-forecast-protocol.md) está pré-registrado e **ainda não executado**.

---

## Research Phase — identidade científica

A pesquisa organiza o projeto em três pilares desacoplados:

```text
MONITORAR -> PREVER -> TRADUZIR EM IMPACTO ESPACIAL
```

1. **Monitorar:** exibir nível observado do Rio Pomba, tendência, chuva, horário da medição e proveniência com transparência de falhas e atrasos.
2. **Prever (em pesquisa):** investigar modelos estatísticos de curto prazo (+1 h a +10 h) para Santo Antônio de Pádua usando histórico local, precipitação e estações de montante (como **UHE Barra do Braúna Jusante `58788600`** e **Cataguases `58770000`**), tratando benchmarks prévios do SAH-Pomba apenas como hipótese a ser reavaliada com protocolo próprio. Nenhuma previsão é exposta na interface pública.
3. **Traduzir em impacto espacial:** somente após validar compatibilidade de réguas/datum (`crosswalk`) e limites municipais oficiais, traduzir níveis em cenários espaciais e métricas territoriais.

---

## Fontes principais e classificação dos dados

O projeto distingue rigorosamente: `observed`, `processed`, `official_reference`, `derived`, `simulated`, `forecast` e `mock` (restrito a fixtures de teste, ausente da interface pública).

- **SGB / CPRM (2024):** *Delimitação da mancha de inundação do rio Pomba na zona urbana de Santo Antônio de Pádua - RJ* ([RiGeo](https://rigeo.sgb.gov.br/handle/doc/25035) e Geoportal MapServer — `official_reference`).
- **INEA-RJ (Alerta de Cheias):** estação Santo Antônio de Pádua (`213042120` / `ANA FLU 58774000`) e auditoria documental do acervo histórico ([`docs/research/INEA_HISTORICAL_ARCHIVE.md`](docs/research/INEA_HISTORICAL_ARCHIVE.md)).
- **ANA / SGB (RHN / SAH-Pomba):** inventário de estações e séries históricas de pesquisa auditadas em [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).
- **OpenStreetMap:** base cartográfica de ruas e hidrografia.

---

## Arquitetura conceitual

```text
fontes observadas / oficiais
          |
          v
aquisição + catálogo de proveniência
          |
          v
normalização temporal / geoespacial
          |
          +-------------------+
          |                   |
          v                   v
modelo temporal        modelo espacial / área derivada
(pesquisa)             (SGB oficial + área WGS84)
          |                   |
          +---------+---------+
                    |
                    v
          tradução espaço-temporal
         (bloqueada até crosswalk)
                    |
                    v
             API / Next.js
                    |
                    v
                MapLibre GL
```

Algoritmos científicos e geoespaciais permanecem desacoplados dos componentes visuais MapLibre.

### Stack técnica
- **Aplicação web:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4, MapLibre GL JS 6.7, `polygon-clipping`.
- **Testes web:** `node --test` (unitários) e Playwright (E2E).
- **Pipeline científico:** Python 3.12 (`unittest` offline determinístico; validação geoespacial independente executada com `pyproj` e `shapely`).

---

## Como executar e reproduzir localmente

Requer Node.js (compatível com `package-lock.json` / CI Node 24) e Python 3.12 para a suíte científica. A coleta automática do INEA permanece desativada por padrão (`FLOODSIM_ENABLE_LIVE_INEA` não definida).

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm run test:unit
npm run build
python3 -m unittest discover -s tests/research -v
```

Para executar a aplicação em desenvolvimento (`predev` sincroniza o worker MapLibre):

```sh
npm run dev
```

Para testes E2E em navegador (com Chromium/Chrome instalado para o Playwright):

```sh
npm run test:e2e
```

Os testes offline não dependem de acesso ao INEA nem comprovam validade de previsão. A árvore versionada contém apenas fixtures sintéticas rotuladas e metadados/hashes (`data/metadata/hydrology/`); nenhum dataset bruto volumoso ou sem autorização de redistribuição está versionado no Git.

---

## Documentação e evidências

- [Notas da candidata `v0.2.0-academic`](docs/releases/v0.2.0-academic.md) e [Changelog](CHANGELOG.md)
- [Catálogo consolidado de pesquisa (25/11/2026)](docs/research/RESEARCH_CATALOG_2026-11-25.md)
- [Validação numérica independente das 11 áreas SGB](docs/research/SGB_AREA_VALIDATION_2026-11-25.md)
- [Auditoria do acervo histórico INEA](docs/research/INEA_HISTORICAL_ARCHIVE.md)
- [Project Charter](docs/PROJECT_CHARTER.md) · [Metodologia acadêmica](docs/ACADEMIC_METHODOLOGY.md) · [Contrato de observações](docs/OBSERVATION_CONTRACT.md)
- [Modelo espacial](docs/FLOOD_MODEL.md) · [Modelo de previsão](docs/FORECAST_MODEL.md) · [Protocolo de validação](docs/VALIDATION_PROTOCOL.md)
- [Fontes de dados](docs/DATA_SOURCES.md) · [Arquitetura](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md)
- [Governança](docs/GOVERNANCE.md) · [Diário de pesquisa](docs/RESEARCH_LOG.md) · [Uso de IA](docs/AI_USAGE.md)
- [EXP-2026-001 (exploratório)](docs/experiments/EXP-2026-001-historical-hydrological-datasets.md) · [EXP-2026-002 (protocolo não executado)](docs/experiments/EXP-2026-002-forecast-protocol.md)

---

## Limitações conhecidas e responsabilidade

- **Não é sistema oficial de alerta** e não deve ser utilizado para orientar evacuação, retirada de bens ou afirmar que um imóvel está seguro.
- As manchas SGB representam **extensão horizontal estimada** para cotas estáticas de referência — não representam área atualmente inundada, profundidade, velocidade da correnteza ou risco individual.
- Nenhum crosswalk entre a régua INEA e a régua SGB/RHN está validado; o zero da régua e o datum vertical do INEA permanecem não confirmados (#37).
- Métricas por bairro ou rua permanecem indisponíveis até obtenção de polígonos municipais validados (#10, #20).
- Nenhuma previsão temporal está autorizada para exposição pública (#46).

---

## Autoria e citação

Desenvolvido e mantido por **Sérgio Izaque Pinheiro Carrozino ([@krrozino](https://github.com/krrozino))**, ORCID **0009-0002-8421-2694**.

Consulte [`CITATION.cff`](CITATION.cff), [`NOTICE.md`](NOTICE.md), [`docs/AUTHORSHIP_AND_DATA_PROVENANCE.md`](docs/AUTHORSHIP_AND_DATA_PROVENANCE.md) e [`docs/RELATED_WORK.md`](docs/RELATED_WORK.md).

### Referências DOI (Zenodo)

- **DOI conceitual (todas as versões):** https://doi.org/10.5281/zenodo.22928809
- **v0.1.0-academic (versão publicada anterior):** https://doi.org/10.5281/zenodo.22928810
- **v0.2.0-academic (candidata):** DOI específico pendente de publicação autorizada e depósito no Zenodo.

O projeto permanece sem licença open source explícita para o código-fonte; dados e materiais de terceiros permanecem sujeitos às condições de suas instituições de origem.
