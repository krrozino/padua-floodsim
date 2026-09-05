# Pádua FloodSim — Relatório consolidado de evolução e estado do projeto

**Versão do documento:** 1.0  
**Data de corte:** 05 de setembro de 2026  
**Repositório:** `krrozino/padua-floodsim`  
**Commit de produção na data de corte:** `80e70b7ce1a142658908f73650cd727e3b946bff`  
**Aplicação publicada:** https://padua-floodsim.vercel.app  
**Natureza:** projeto acadêmico e experimental de computação aplicada à visualização e ao estudo de enchentes em Santo Antônio de Pádua, RJ.

> Este documento registra a evolução efetivamente implementada no repositório até a data de corte. Ele diferencia o que está em produção, o que foi corrigido ou removido durante a evolução e o que permanece planejado. O Pádua FloodSim não é um sistema oficial de alerta e não substitui INEA, Defesa Civil, Serviço Geológico do Brasil (SGB) ou qualquer outra fonte oficial.

---

## 1. Resumo executivo

O Pádua FloodSim nasceu em 02 de setembro de 2026 como um protótipo acadêmico para representar, em um mapa interativo, cenários de cheia do Rio Pomba na área urbana de Santo Antônio de Pádua. A primeira implementação priorizou a experiência de uso: dashboard, mapa, slider de nível, bairros de referência e painéis demonstrativos.

Ao longo dos primeiros ciclos de desenvolvimento, o projeto passou por uma mudança metodológica importante. Em vez de continuar exibindo profundidade, criticidade ou impacto calculados a partir de regras sem base geoespacial validada, essas saídas foram retiradas. A V1 passou a utilizar como referência espacial os **11 cenários oficiais de mancha de inundação publicados pelo SGB**, entre 3,00 m e 5,50 m, em intervalos de 0,25 m.

Na data de corte, a aplicação em produção permite selecionar uma cota oficial SGB, visualizar a respectiva extensão de inundação no mapa, navegar e interagir com a cartografia, consultar proveniência e metodologia, testar estados de camadas e visualizar sete pontos aproximados e neutros de bairros. O painel INEA existente ainda é explicitamente `MOCK / DEMO`; nenhuma leitura observada é convertida em cenário SGB.

O estado atual é, portanto, melhor descrito como uma **plataforma web de visualização interativa de referências oficiais SGB**, preparada arquitetural e metodologicamente para evoluir depois para agregação espacial por bairros, modelo experimental próprio com DEM/conectividade e monitoramento observado.

---

## 2. Problema e objetivo do projeto

Santo Antônio de Pádua possui histórico de cheias do Rio Pomba. O projeto busca organizar dados geográficos, topográficos e hidrológicos em uma interface que permita explorar cenários espaciais de inundação com rastreabilidade de fonte e sem transformar resultados experimentais em alertas oficiais.

Os objetivos de longo prazo são:

- visualizar Santo Antônio de Pádua em mapa interativo;
- alterar manualmente uma cota/cenário de água;
- observar áreas potencialmente atingidas;
- relacionar manchas a bairros e, futuramente, vias;
- consultar nível observado do rio quando existir integração validada;
- comparar cenários;
- construir e avaliar um modelo experimental simples e reproduzível;
- validar resultados com referências independentes e eventos históricos.

A arquitetura conceitual adotada separa:

`fontes de dados -> aquisição/normalização -> terreno/hidrografia -> simulação -> classificação espacial -> aplicação/API -> visualização`.

---

## 3. Princípios científicos consolidados

A evolução do projeto estabeleceu regras que hoje funcionam como contrato científico:

1. **Dado observado, referência oficial, dado derivado e resultado simulado não são equivalentes.** Cada artefato deve ser classificado e apresentado de forma coerente.
2. **As manchas SGB exibidas na V1 são referência oficial (`official_reference`).** Elas não são calculadas pelo Pádua FloodSim.
3. **Extensão de inundação não é profundidade.** A V1 não calcula lâmina d'água, velocidade, dano, população atingida ou necessidade de evacuação.
4. **Não existe conversão direta INEA -> cenário SGB.** A equivalência entre referências de régua, estações e datums ainda precisa ser identificada e tecnicamente validada.
5. **Bairros não recebem risco ou severidade por aproximação.** Os sete pontos atuais são apenas referências cartográficas neutras; limites territoriais confiáveis ainda são pendência.
6. **O futuro modelo próprio não pode usar apenas `DEM <= H` como resultado final.** A metodologia exige ao menos elegibilidade por elevação e conectividade hidráulica aproximada ao Rio Pomba, com parâmetros reproduzíveis e validação.
7. **Nenhuma saída do projeto substitui órgãos oficiais.** A interface deve manter aviso de caráter acadêmico e experimental.

A referência científica detalhada permanece em [`ACADEMIC_METHODOLOGY.md`](ACADEMIC_METHODOLOGY.md).

---

## 4. Linha do tempo de implementação

### 4.1. 02/09/2026 — Fundação documental e conceitual

O repositório foi iniciado com documentação antes da expansão técnica. Os primeiros commits criaram:

- `README.md` inicial;
- arquitetura de MVP;
- inventário preliminar de fontes;
- fundação do modelo de inundação;
- roadmap por versões.

Marcos de rastreabilidade:

| Commit | Entrega |
| --- | --- |
| `d0e4220` | README inicial do projeto |
| `77dcc07` | arquitetura inicial |
| `b316b98` | fontes de dados candidatas |
| `1af363b` | fundação do modelo de inundação |
| `71dea5d` | roadmap inicial |

Essa fase definiu a intenção original de combinar mapa, topografia, nível do rio e classificação espacial, mas ainda continha ideias que posteriormente foram refinadas, principalmente profundidade e criticidade visual sem modelo validado.

### 4.2. 02/09/2026 — Bootstrap da aplicação V0

O commit `394437b` criou a primeira aplicação interativa com Next.js, TypeScript, Tailwind CSS e MapLibre. A V0 estabeleceu:

- dashboard responsivo;
- header e sidebar;
- mapa principal;
- controles de navegação;
- slider de nível;
- painéis demonstrativos;
- base visual para cenários de inundação.

Logo depois, o commit `f99552b` adicionou CI para typecheck e build, tornando a validação automática parte do fluxo de engenharia desde o início.

### 4.3. 02/09/2026 — Mudança para uma base geoespacial real

A partir de `8b84478`, o projeto deixou de tratar a parte geoespacial apenas como mock conceitual e passou a documentar fontes específicas de Santo Antônio de Pádua. Foram incorporadas ao inventário técnico informações sobre:

- estudo SGB de 2024 sobre a mancha de inundação do Rio Pomba;
- serviço público ArcGIS/MapServer do SGB;
- carta de suscetibilidade SGB/CPRM de 2015;
- fontes municipais de bairros e planejamento urbano;
- INEA, IBGE, ANA e OpenStreetMap como fontes oficiais ou complementares conforme o caso.

Também foram criadas convenções para workspace GIS e para não versionar dados brutos pesados diretamente no Git (`9179fba`, `b1d6995`, `cbbbf19`).

O commit `ac28d0a` alinhou a documentação do modelo à decisão de usar as manchas oficiais SGB como baseline externo, em vez de apresentar uma mancha experimental própria com aparência de mesma autoridade.

### 4.4. 02/09/2026 — Integração das manchas oficiais SGB

A integração foi implementada em pequenos passos rastreáveis:

| Commit | Entrega |
| --- | --- |
| `594d051` | adaptador para o serviço de manchas do SGB |
| `d705099` | proxy/API para GeoJSON oficial SGB |
| `aeb5e52` | primeira renderização das manchas no mapa |
| `56fc3e5` | conexão do dashboard aos cenários oficiais |
| `976a541` | estados visuais da camada SGB |
| `e673a9b` | smoke test contra o serviço GeoJSON ao vivo |
| `5054d19` | validação do serviço no CI |
| `80ec4d8` | teste de todas as 11 cotas oficiais |
| `28b67f2` | registro dos IDs das camadas verificadas |

Os cenários consumidos são:

`300, 325, 350, 375, 400, 425, 450, 475, 500, 525 e 550 cm`.

O serviço oficial expõe GeoJSON em SIRGAS 2000 (`EPSG:4674`). O relatório SGB de 2024 documenta a estação Santo Antônio de Pádua II, RHN `58790002`, zero da régua em 79,709 m de altitude ortométrica e datum vertical `hgeoHNOR_IMBITUBA`.

### 4.5. 02/09/2026 — Baseline de engenharia

O projeto também ganhou mecanismos de qualidade e segurança. O marco `a77436e` consolidou:

- Dependabot;
- template de Pull Request;
- workflow de secret scanning;
- permissões necessárias para o scan em PRs.

A partir desse ponto, as mudanças relevantes passaram a ser avaliadas por build/CI e segurança, posteriormente complementados por SonarCloud e testes de navegador.

### 4.6. 03/09/2026 — Primeiros ciclos de produção e resiliência do mapa

Os primeiros deploys na Vercel revelaram problemas reais de carregamento de estilo/cartografia. O ciclo de correção incluiu:

- configuração do projeto Next.js na Vercel (`391e294`);
- correção para carregamento resiliente do mapa (`65920bc`);
- revisão da política de deploy para economizar o limite da conta Hobby (`d5d544c`, `8ff10b8`).

A decisão operacional final foi **desabilitar deployments automáticos do Git** e separar sincronização de código de publicação. Pushes e merges não devem gerar produção por si só; a publicação é deliberada após validação.

### 4.7. 03/09/2026 — Arquitetura acadêmica formal

O projeto recebeu uma metodologia acadêmica consolidada em `docs/ACADEMIC_METHODOLOGY.md`, com foco em um modelo futuro executável por estudante e cientificamente defensável.

A metodologia passou a exigir:

- separação entre aquisição, normalização, terreno, simulação, classificação e interface;
- parâmetros explícitos e execuções reproduzíveis;
- modelo inicial de cota + conectividade ao Rio Pomba;
- comparação com baseline ingênuo de toda área abaixo da cota;
- validação histórica com métricas quantitativas;
- tratamento rigoroso de CRS e datum vertical;
- integração INEA apenas após levantamento da referência de estação/régua;
- agregação por bairros somente com polígonos confiáveis.

### 4.8. 03–05/09/2026 — Execution Plan 001 e PR #17: mapa realmente interativo

A revisão do protótipo detectou que alguns elementos ainda tinham comportamento de demonstração: controles sem efeito, labels/pontos com semântica excessiva, fallback artificial de inundação e risco de confundir mock com resultado real.

O PR #17 corrigiu estruturalmente essa fase e foi mergeado em `5a0b09e`.

Principais mudanças efetivamente entregues:

- MapLibre com pan, zoom e recentralização funcionais;
- slider e atalhos para cenários oficiais;
- carregamento da mancha SGB independente do carregamento do estilo do mapa;
- `AbortController` e guarda de requisição ativa para impedir resposta antiga de substituir cenário atual;
- estados `loading`, `official`, `empty` e `error`;
- retry real;
- validação de classificação, cota, camada e geometria recebida;
- remoção do polígono fallback inventado;
- remoção de métricas fictícias de bairros, ruas e área;
- remoção de thresholds arbitrários de risco/severidade de bairros;
- manutenção de sete bairros apenas como pontos aproximados neutros;
- toggles de camadas preservados mesmo quando acionados antes do carregamento completo;
- limpeza de listeners e popups;
- melhorias de acessibilidade, foco, ARIA, contraste e estados vivos;
- centralização dos metadados SGB em `lib/sgb/stages.ts`;
- sincronização reproduzível do worker do MapLibre 6.7.0 via `scripts/sync-maplibre.mjs`;
- testes E2E com Playwright;
- validação por CI, Security e SonarCloud.

Esse ciclo marcou a transição de um protótipo visual para uma V1 interativa com semântica científica mais controlada.

### 4.9. 05/09/2026 — PR #23: refinamento de proveniência, metodologia e UX

Após teste da aplicação publicada, foi identificado que o badge de cenário SGB cobria a região central do mapa. O PR #23, mergeado em `80e70b7`, refinou a experiência sem alterar os dados geográficos.

Foram implementados:

- remoção do badge flutuante do centro cartográfico;
- integração do status ao card do slider;
- exibição explícita da classificação `official_reference`;
- indicação de Serviço Geológico do Brasil — SGB;
- exibição da cota local e altitude ortométrica associada;
- componente `MethodologyModal.tsx`;
- acesso a **Fonte e metodologia** pelo controle do cenário e pelo card da camada;
- conteúdo de proveniência com estudo SGB 2024, estação, RHN, zero da régua, datum vertical e faixa de cenários;
- aviso explícito de que a camada é extensão de inundação, não profundidade, dano, população afetada ou previsão;
- explicação cautelosa de que INEA e SGB não são convertidos entre si sem equivalência tecnicamente validada;
- melhorias de responsividade para desktop e mobile;
- ampliação dos testes Playwright para modal, Escape, backdrop, reabertura e overflow mobile.

O SonarCloud inicialmente apontou quatro ocorrências no novo modal, incluindo uma regra de Reliability relacionada a click handler em elemento `dialog`. O código foi corrigido com propriedades readonly, simplificação de fluxo e listeners nativos controlados para `cancel`/click do diálogo. O Quality Gate final ficou com **0 novos issues** e ratings A de Reliability, Security e Maintainability.

### 4.10. 05/09/2026 — Publicação da V1 refinada

Após merge do PR #23, foi realizado exatamente um deploy deliberado de produção.

Registro da release:

| Campo | Valor |
| --- | --- |
| Commit | `80e70b7ce1a142658908f73650cd727e3b946bff` |
| Deployment Vercel | `dpl_E9id232r8XHXdu2pLB7YVKMBB6Ny` |
| Target | `production` |
| Estado | `READY` |
| Alias | `https://padua-floodsim.vercel.app` |
| Origem | Vercel CLI |

O smoke test de produção confirmou carregamento da página, mapa MapLibre, manchas SGB, slider, atalhos de 3,00/4,25/5,50 m, modal de metodologia e ausência de erros JavaScript críticos no navegador.

---

## 5. Estado funcional atual

Na data de corte, a V1 em produção possui:

### 5.1. Mapa e navegação

- mapa MapLibre georreferenciado;
- pan e zoom;
- controle de recentralização;
- camada cartográfica base;
- interação de popup com os pontos de bairro;
- toggles para exibir/ocultar a mancha SGB e referências de bairros.

### 5.2. Cenários oficiais SGB

- 11 cenários discretos entre 3,00 m e 5,50 m;
- intervalo de 0,25 m;
- sem interpolação silenciosa entre cenários;
- extensão oficial carregada via serviço do SGB;
- cota local e altitude ortométrica exibidas;
- estados de carregamento, sucesso, camada vazia e erro;
- retry e proteção contra respostas antigas;
- proveniência `official_reference` visível.

### 5.3. Fonte e metodologia

O modal de metodologia informa, de forma acessível:

- produto SGB de 2024 utilizado;
- estação Santo Antônio de Pádua II;
- RHN `58790002`;
- zero da régua: 79,709 m de altitude ortométrica;
- datum vertical `hgeoHNOR_IMBITUBA`;
- 11 cenários oficiais;
- distinção entre extensão, profundidade e previsão;
- caráter acadêmico/experimental;
- não equivalência automática entre INEA e SGB.

### 5.4. Bairros

A fonte municipal já confirmou a lista dos 27 bairros oficiais. Contudo, a aplicação **ainda não possui os 27 polígonos territoriais**.

A V1 mostra somente sete pontos aproximados de referência. Eles:

- têm nomes pertencentes à lista oficial;
- são classificados como mock/referência temporária;
- não definem fronteiras;
- não permitem concluir se um bairro inteiro está ou não na mancha;
- não possuem risco calculado.

### 5.5. Monitoramento INEA

O painel atual é `MOCK / DEMO` e usa valores fictícios para demonstrar a futura experiência de monitoramento.

Ainda não existem na aplicação:

- ingestão automática de leitura observada;
- timestamp real;
- tendência calculada sobre série oficial;
- associação de leitura INEA a cenário SGB;
- alerta operacional.

---

## 6. Arquitetura implementada na V1

### Aplicação web

- Next.js 16.3.4;
- React 19.2.8;
- TypeScript 5.9;
- Tailwind CSS 4.3.3;
- MapLibre GL JS 6.7.0;
- Playwright para testes E2E.

### Fluxo SGB atual

```text
SGB ArcGIS MapServer
        |
        v
adaptador/proxy SGB no Next.js
        |
        v
hook de aquisição do cenário
        |
        v
estado React do dashboard
        |
        v
source/layers do MapLibre
        |
        v
mapa + status + metadados
```

O carregamento da referência SGB é desacoplado do ciclo de carregamento do estilo do mapa. O componente de mapa recebe o cenário atual e aplica os dados quando as sources/layers estão prontas.

### Arquitetura geoespacial futura já definida, mas ainda não implementada

```text
fontes -> aquisição -> normalização -> DEM/hidrografia
       -> modelo de conectividade -> polígonos simulados
       -> interseção com bairros -> aplicação
```

Essa separação é intencional para evitar que o algoritmo científico fique acoplado à interface MapLibre.

---

## 7. Fontes oficiais e dados verificados

A principal referência da V1 é:

**Serviço Geológico do Brasil — SGB.** *Delimitação da mancha de inundação do rio Pomba na zona urbana de Santo Antônio de Pádua - RJ*, 2024.

Parâmetros documentados no projeto:

- estação: Santo Antônio de Pádua II;
- RHN: `58790002`;
- zero da régua: 79,709 m de altitude ortométrica;
- datum vertical: `hgeoHNOR_IMBITUBA`;
- modelagem oficial com cenários de 300 a 550 cm;
- serviço web em SIRGAS 2000 / `EPSG:4674`.

Outras fontes já investigadas/documentadas:

- SGB/CPRM — carta de suscetibilidade de 2015 e pacote MDE/SIG;
- Prefeitura — Lei nº 3.864/2017, com confirmação dos 27 bairros;
- Prefeitura — Plano Diretor e produtos de saneamento;
- IBGE — limites administrativos;
- INEA — Alerta de Cheias, ainda sem crosswalk validado com SGB;
- ANA — fonte prevista para metadados/séries da rede hidrometeorológica;
- OpenStreetMap — fonte cartográfica colaborativa complementar;
- UFF — referência acadêmica complementar sobre modelagem de inundação no município.

O inventário técnico detalhado e URLs devem ser mantidos em [`DATA_SOURCES.md`](DATA_SOURCES.md).

---

## 8. Qualidade, testes e segurança

O projeto adotou progressivamente uma base de engenharia com:

- GitHub Actions para typecheck e build;
- validação automática do serviço SGB;
- smoke test das 11 cotas oficiais;
- secret scanning;
- Dependabot;
- template de Pull Request;
- SonarCloud como Quality Gate;
- Playwright para comportamento real no navegador;
- validações de responsividade e acessibilidade nos ciclos recentes.

No PR #23, a entrega final passou por:

- `npm run typecheck`;
- `npm run build`;
- `npm run test:e2e` — 5/5 testes;
- `git diff --check`;
- CI verde;
- Secret scan verde;
- SonarCloud Quality Gate aprovado, 0 novos issues.

---

## 9. Correções metodológicas importantes feitas ao longo da evolução

Algumas ideias presentes no protótipo inicial foram deliberadamente retiradas ou reclassificadas porque poderiam gerar interpretação científica incorreta.

### Removido: profundidade aparente sem modelo

O protótipo previa uma escala visual de profundidade por tons. Como a referência SGB integrada fornece **extensão de inundação** e não uma superfície de profundidade calculada pelo FloodSim, essa visualização não faz parte da V1 atual.

Profundidade só poderá retornar no futuro modelo próprio se existir relação documentada entre superfície d'água e terreno.

### Removido: severidade/criticidade arbitrária de bairros

A primeira experiência utilizava cores/thresholds de bairro sem polígonos oficiais e sem interseção GIS real. Isso foi removido.

A futura intensidade visual será derivada de geometria territorial validada, por exemplo:

`área(mancha ∩ bairro) / área(bairro)`.

Mesmo nesse caso, a métrica será apresentada como **sobreposição/impacto espacial derivado**, não como risco oficial, dano ou população afetada.

### Removido: métricas fictícias

Contagens de bairros, ruas e área afetada passaram a ser exibidas como `Indisponível` quando o dado necessário ainda não existe.

### Removido: fallback de geometria inventada

Quando o serviço SGB falha ou retorna vazio, a aplicação não desenha uma mancha substituta fictícia. O erro é comunicado ao usuário e o retry fica disponível.

### Corrigido: relação INEA x SGB

A interface não deve dizer nem que as referências são iguais nem que são diferentes sem evidência. A regra atual é simplesmente: a equivalência entre referências de régua, estações e datums **ainda não foi identificada e tecnicamente validada**, portanto não existe conversão automática.

---

## 10. Limitações atuais

A V1 não deve ser interpretada além do que os dados e a implementação suportam.

Limitações principais:

- as manchas mostradas são cenários oficiais SGB, não previsão de uma cheia futura;
- não há cálculo de profundidade na V1;
- não há modelo próprio do FloodSim em produção;
- não há polígonos validados dos 27 bairros;
- não há cálculo de área/percentual por bairro;
- não há integração de malha viária para métricas de ruas;
- não há população afetada calculada;
- o painel INEA é demonstrativo e fictício;
- não há alerta, recomendação de evacuação ou previsão meteorológica;
- dependência do serviço externo SGB pode causar indisponibilidade temporária;
- o futuro modelo DEM ainda exigirá compatibilização de CRS/datum e validação histórica.

---

## 11. Próximas etapas oficiais

Conforme o roadmap atual:

### V1B — bairros e impacto espacial derivado

1. obter ou produzir, com proveniência, os limites dos 27 bairros (#10);
2. validar topologia, nomes e CRS;
3. calcular interseção entre bairro e mancha SGB em CRS métrico (#20);
4. calcular área e percentual territorial sobreposto;
5. recuperar intensidade visual de cor baseada em cálculo real, não em threshold inventado.

### V1C — modelo experimental próprio

1. inventariar MDE/SIG SGB 2015 (#9);
2. preparar DEM e hidrografia;
3. implementar pipeline Python;
4. aplicar elevação + conectividade hidráulica aproximada (#5);
5. comparar com baseline `DEM <= H`;
6. validar contra SGB e eventos históricos (#7).

### V2 — monitoramento observado

- investigar e documentar tecnicamente a estação INEA (#6);
- obter metadados de régua/datum;
- implementar leitura observada com timestamp e estado de qualidade;
- somente criar relação com cenários quando existir crosswalk validado.

### V3 — módulos de aplicação

- Dados e fontes;
- Bairros;
- Comparação de cenários;
- Monitoramento;
- Histórico.

### V4 — modelagem avançada

HEC-RAS 2D, IBER, propagação temporal, previsão e 3D permanecem trabalhos futuros condicionados a pergunta científica e dados adequados.

---

## 12. Registro de releases e marcos principais

| Data | Marco | Referência |
| --- | --- | --- |
| 02/09/2026 | início formal do repositório/documentação | `d0e4220` |
| 02/09/2026 | aplicação V0 interativa | `394437b` |
| 02/09/2026 | baseline geoespacial real | `8b84478` |
| 02/09/2026 | integração inicial SGB | `594d051` a `56fc3e5` |
| 02/09/2026 | 11 cenários SGB validados | `80ec4d8` / `28b67f2` |
| 02/09/2026 | baseline de engenharia | `a77436e` / PR #11 |
| 03/09/2026 | primeiro ciclo Vercel e resiliência do mapa | `391e294` / `65920bc` |
| 03/09/2026 | deployments automáticos desabilitados | `8ff10b8` |
| 03/09/2026 | metodologia acadêmica consolidada | `docs/ACADEMIC_METHODOLOGY.md` |
| 05/09/2026 | mapa interativo/hardening V1 | PR #17 / `5a0b09e` |
| 05/09/2026 | refinamento UX + fonte/metodologia | PR #23 / `80e70b7` |
| 05/09/2026 | V1 refinada publicada | `dpl_E9id232r8XHXdu2pLB7YVKMBB6Ny` |

---

## 13. Documentação canônica

Este relatório é histórico e deve ser lido em conjunto com:

- [`README.md`](../README.md) — entrada rápida e estado atual;
- [`ACADEMIC_METHODOLOGY.md`](ACADEMIC_METHODOLOGY.md) — metodologia e limites científicos;
- [`DATA_SOURCES.md`](DATA_SOURCES.md) — inventário e proveniência dos datasets/fontes;
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — arquitetura implementada e evolução planejada;
- [`FLOOD_MODEL.md`](FLOOD_MODEL.md) — fundação do modelo experimental;
- [`ROADMAP.md`](ROADMAP.md) — entregas concluídas e próximas etapas;
- [`PR17_REVIEW.md`](PR17_REVIEW.md) — revisão técnica do marco interativo;
- `docs/exec-plans/` — planos de execução por ciclo.

## 14. Política de atualização deste relatório

Este documento deve preservar a história do projeto. Novos marcos devem ser acrescentados com:

- data;
- problema/objetivo;
- implementação;
- fonte ou mudança metodológica, quando aplicável;
- testes e critérios de validação;
- PR/commit de referência;
- release/deployment, quando houver;
- limitações introduzidas ou resolvidas.

Não reescrever retrospectivamente um protótipo antigo como se ele já tivesse a metodologia atual. Quando uma decisão for abandonada, registrar **o que existia, por que foi corrigido e qual regra a substituiu**.

---

## 15. Declaração de responsabilidade

O Pádua FloodSim é um projeto acadêmico e experimental. A V1 disponibiliza uma interface própria para explorar referências oficiais publicadas pelo SGB e preparar experimentos futuros. A aplicação não deve ser usada como fonte exclusiva para decisões de segurança, deslocamento, evacuação ou resposta a desastres.

Em situações reais de cheia, devem ser consultados os canais oficiais da Defesa Civil, INEA, SGB e demais órgãos competentes.
