# Pádua FloodSim

Projeto acadêmico e experimental de computação aplicada à visualização e ao estudo de enchentes em **Santo Antônio de Pádua, RJ**, com foco no **Rio Pomba**.

**Produção:** https://padua-floodsim.vercel.app  
**Estado de referência deste README:** 05 de setembro de 2026  
**Versão publicada:** V1 — visualização interativa de cenários oficiais SGB

> O Pádua FloodSim não é um sistema oficial de alerta, previsão ou evacuação. A aplicação não substitui INEA, Defesa Civil, Serviço Geológico do Brasil (SGB) ou outras fontes oficiais.

## Estado atual

A V1 publicada permite explorar no mapa as **11 manchas de inundação oficiais do SGB** para Santo Antônio de Pádua, entre **3,00 m e 5,50 m**, em intervalos de **0,25 m**.

A aplicação atualmente oferece:

- mapa interativo com MapLibre;
- pan, zoom e recentralização;
- slider discreto para os 11 cenários oficiais SGB;
- atalhos para 3,00 m, 4,25 m e 5,50 m;
- carregamento da extensão oficial correspondente à cota selecionada;
- exibição de cota local e altitude ortométrica documentada;
- estados de loading, sucesso, camada vazia e erro;
- retry e proteção contra respostas antigas;
- botão **Fonte e metodologia** com proveniência científica;
- toggles de camada;
- sete pontos aproximados e neutros de bairros para referência visual;
- painel demonstrativo INEA explicitamente marcado como `MOCK / DEMO`;
- aviso persistente de caráter acadêmico/experimental.

## O que a V1 não faz

A camada SGB integrada representa **extensão de inundação publicada**, não profundidade.

A V1 não calcula:

- profundidade da água;
- velocidade da correnteza;
- risco ou severidade oficial por bairro;
- população afetada;
- dano material;
- ruas afetadas;
- previsão de quando uma cota será atingida;
- necessidade de evacuação;
- conversão automática entre leitura INEA e cota SGB.

Métricas sem dados suficientes são apresentadas como indisponíveis em vez de serem estimadas por regras arbitrárias.

## Referência oficial SGB usada na V1

A principal fonte da interface atual é o estudo:

**Serviço Geológico do Brasil — SGB.** *Delimitação da mancha de inundação do rio Pomba na zona urbana de Santo Antônio de Pádua - RJ*, 2024.

Metadados documentados:

- estação: Santo Antônio de Pádua II;
- RHN: `58790002`;
- zero da régua: 79,709 m de altitude ortométrica;
- datum vertical: `hgeoHNOR_IMBITUBA`;
- cenários: 300 cm a 550 cm, de 25 em 25 cm;
- serviço cartográfico web em SIRGAS 2000 / `EPSG:4674`.

Veja [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) para proveniência, URLs e inventário técnico.

## Classificação dos dados

O projeto separa explicitamente quatro tipos de informação:

| Classe | Significado |
| --- | --- |
| `observed` | medição observada em uma fonte oficial, com timestamp e metadados |
| `official_reference` | produto oficial publicado e apenas visualizado/reutilizado pelo FloodSim |
| `derived` | resultado calculado pelo projeto a partir de dados de origem identificada |
| `simulated` | resultado produzido pelo modelo experimental próprio |

Na V1 atual, as manchas SGB são `official_reference`. Os sete pontos de bairro e o painel INEA ainda são demonstrativos/mocks. Ainda não existe resultado `simulated` do modelo próprio em produção.

## Metodologia acadêmica

O futuro modelo experimental próprio foi deliberadamente mantido simples e validável:

1. preparar um DEM com CRS/datum documentados;
2. definir o Rio Pomba como origem hidráulica;
3. marcar células elegíveis por elevação;
4. manter somente células conectadas hidraulicamente ao rio, usando conectividade de grade;
5. gerar a mancha experimental;
6. comparar com referências independentes;
7. medir falsos positivos, falsos negativos e métricas espaciais;
8. documentar sensibilidade, limitações e incerteza.

A regra `DEM <= nível => inundado` não é aceita como modelo final porque ignora conectividade e barreiras topográficas.

A metodologia completa está em [`docs/ACADEMIC_METHODOLOGY.md`](docs/ACADEMIC_METHODOLOGY.md).

## Bairros

A Lei Municipal nº 3.864/2017 foi usada para confirmar a lista dos **27 bairros oficiais** do município.

Ainda falta obter um arquivo vetorial oficial dos limites ou produzir uma camada derivada e documentada a partir das fontes municipais. Até isso ocorrer:

- não existe cálculo territorial por bairro;
- não existe índice de cor proporcional à área atingida;
- os sete pontos exibidos no mapa não representam polígonos ou fronteiras;
- nenhum bairro recebe classificação de risco.

A próxima fase relevante é a issue #10, seguida da #20, para calcular a interseção real entre bairros e manchas SGB.

## Monitoramento INEA

O painel de monitoramento da interface atual é **fictício e demonstrativo**.

A integração real só será implementada após identificar e documentar:

- estação exata;
- coordenadas;
- referência/zero da régua;
- datum ou referência vertical;
- política de atualização;
- relação, se existir, com a referência usada pelo SGB.

Não é assumido que `5,00 m` no INEA seja equivalente a `500 cm` na referência dos cenários SGB.

## Arquitetura

A arquitetura conceitual separa:

```text
fontes de dados
    -> aquisição
    -> normalização
    -> terreno/hidrografia
    -> simulação
    -> classificação espacial
    -> aplicação/API
    -> visualização
```

Na V1 atual, o fluxo implementado é principalmente:

```text
SGB ArcGIS MapServer
    -> adaptador/proxy Next.js
    -> aquisição do cenário
    -> estado da aplicação
    -> source/layers MapLibre
    -> mapa + status + proveniência
```

O algoritmo científico futuro permanecerá fora dos componentes de visualização.

Veja [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack atual

- Next.js 16.3.4;
- React 19.2.8;
- TypeScript 5.9;
- Tailwind CSS 4.3.3;
- MapLibre GL JS 6.7.0;
- Playwright para testes E2E;
- GitHub Actions;
- SonarCloud;
- Vercel para produção.

Para o pipeline geoespacial futuro estão previstos Python, GeoPandas, Rasterio, GDAL, Shapely e PyProj, conforme necessidade experimental.

## Qualidade e segurança

O repositório possui mecanismos de validação que incluem:

- typecheck e build em GitHub Actions;
- secret scanning;
- Dependabot;
- validação do serviço oficial SGB;
- smoke test dos 11 cenários oficiais;
- testes E2E com Playwright;
- SonarCloud como Quality Gate.

Os marcos recentes de V1 passaram por CI, Security e SonarCloud antes do merge.

## Deploy

Deploys automáticos por push estão desabilitados para evitar publicações intermediárias e consumo desnecessário do limite da Vercel.

Fluxo de produção:

```text
feature branch
    -> testes/CI
    -> Pull Request
    -> revisão
    -> merge em main
    -> um deploy deliberado de produção
    -> smoke test
```

A release publicada em 05/09/2026 corresponde ao commit:

`80e70b7ce1a142658908f73650cd727e3b946bff`

Deployment Vercel:

`dpl_E9id232r8XHXdu2pLB7YVKMBB6Ny`

## Documentação

A documentação principal está organizada em [`docs/`](docs/README.md).

Documentos de referência:

- [`docs/PROJECT_REPORT.md`](docs/PROJECT_REPORT.md) — histórico consolidado e relatório de tudo implementado até a data de corte;
- [`docs/ACADEMIC_METHODOLOGY.md`](docs/ACADEMIC_METHODOLOGY.md) — metodologia científica;
- [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) — fontes e proveniência;
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitetura;
- [`docs/FLOOD_MODEL.md`](docs/FLOOD_MODEL.md) — fundação do modelo experimental;
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — próximos ciclos e critérios de passagem;
- [`docs/PR17_REVIEW.md`](docs/PR17_REVIEW.md) — revisão do marco de interatividade.

## Roadmap resumido

- **V0 — concluída:** fundação da aplicação e mapa interativo.
- **V1A — concluída:** 11 referências oficiais SGB integradas e UI refinada.
- **V1B — próxima:** limites dos 27 bairros e sobreposição territorial real.
- **V1C — planejada:** modelo experimental próprio com DEM + conectividade.
- **V2 — planejada:** monitoramento observado INEA, sem mistura de referenciais.
- **V3 — planejada:** telas de dados, bairros, comparação e histórico.
- **V4 — futura:** modelagem hidrodinâmica avançada apenas se os dados justificarem.

Consulte [`docs/ROADMAP.md`](docs/ROADMAP.md) para os critérios completos.

## Responsabilidade de uso

O Pádua FloodSim é uma ferramenta de pesquisa, experimentação e visualização científica. Nenhum mapa, painel ou cálculo produzido pelo projeto deve ser interpretado como alerta operacional oficial.

Em eventos reais, consulte sempre os canais oficiais da Defesa Civil, INEA, SGB e demais órgãos competentes.
