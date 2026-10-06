# Pádua FloodSim

Plataforma acadêmica e experimental de **monitoramento, previsão de curto prazo e visualização espacial de cheias do Rio Pomba** em **Santo Antônio de Pádua - RJ**.

> **Importante:** o Pádua FloodSim não é um sistema oficial de alerta e não substitui INEA, Defesa Civil, Serviço Geológico do Brasil (SGB), ANA ou outras fontes oficiais.

## Estado atual da aplicação

A aplicação V1 disponível hoje usa como referência as **11 manchas oficiais do SGB entre 3,00 m e 5,50 m**, em intervalos de 25 cm.

No estado atual:

- a mancha exibida é `official_reference`, não uma previsão FloodSim;
- não há profundidade real calculada a partir das manchas SGB;
- não há previsão temporal validada;
- os bairros ainda não possuem polígonos oficiais integrados;
- o painel INEA existente é mock/demo e permanece separado das manchas;
- a equivalência entre régua INEA e referência SGB **não está validada**.

Veja [a revisão técnica da V1](docs/PR17_REVIEW.md).

## Research Phase — desde 05/10/2026

A fase científica formal organiza o projeto em três pilares:

```text
MONITORAR -> PREVER -> TRADUZIR EM IMPACTO ESPACIAL
```

### 1. Monitorar

Exibir nível observado do Rio Pomba, tendência, horário, fonte e precipitação relevante, com rastreabilidade.

A meta de produto é permitir que uma pessoa dentro ou fora de Pádua compreenda visualmente a condição do rio.

### 2. Prever

Desenvolver e avaliar modelos estatísticos de curto prazo para estimar a evolução do nível em Santo Antônio de Pádua.

Horizontes iniciais candidatos:

- +1 h;
- +2 h;
- +3 h;
- +4 h;
- +5 h;
- +10 h.

A pesquisa investigará dados locais, precipitação e informações de montante, incluindo a relação com **UHE Barra do Braúna Jusante (58788600)**.

Nenhuma previsão deverá ser publicada como certeza ou alerta operacional.

### 3. Traduzir em impacto espacial

Após compatibilizar e validar as referências de nível, transformar observações/previsões em cenários espaciais e, futuramente, em métricas por bairro.

## Documentos centrais

- [Project Charter](docs/PROJECT_CHARTER.md) — missão, objetivos e escopo do produto/pesquisa;
- [Metodologia acadêmica](docs/ACADEMIC_METHODOLOGY.md) — base científica;
- [Modelo espacial de inundação](docs/FLOOD_MODEL.md) — referência SGB e modelo topográfico experimental;
- [Modelo de previsão](docs/FORECAST_MODEL.md) — linha de pesquisa temporal;
- [Fontes de dados](docs/DATA_SOURCES.md) — proveniência e compatibilidade;
- [Arquitetura](docs/ARCHITECTURE.md) — separação entre aquisição, modelos e interface;
- [Plano do artigo](docs/ARTICLE_PLAN_RBMET.md) — desenho científico em discussão;
- [Roadmap](docs/ROADMAP.md) — ordem de execução;
- [Governança](docs/GOVERNANCE.md) — GitHub, Notion, Chat e Work;
- [Diário de pesquisa](docs/RESEARCH_LOG.md) — marcos consolidados;
- [Uso de IA](docs/AI_USAGE.md) — transparência sobre apoio de IA.

## Autoria e citação

O Pádua FloodSim é desenvolvido e mantido por **Sérgio Izaque Pinheiro Carrozino ([@krrozino](https://github.com/krrozino))**, ORCID **0009-0002-8421-2694**.

Se utilizar o software em trabalho acadêmico, apresentação ou pesquisa, consulte o arquivo [`CITATION.cff`](CITATION.cff) e informe também a versão, tag ou commit utilizado.

- [Aviso de autoria, citação e dados de terceiros](NOTICE.md)
- [Política de autoria e proveniência](docs/AUTHORSHIP_AND_DATA_PROVENANCE.md)
- [Trabalhos relacionados e delimitação da contribuição](docs/RELATED_WORK.md)

### DOI

- **v0.1.0-academic:** https://doi.org/10.5281/zenodo.22928810
- **Todas as versões / conceito:** https://doi.org/10.5281/zenodo.22928809

O projeto não reivindica originalidade sobre a ideia genérica de estudar ou mapear enchentes em Santo Antônio de Pádua. A contribuição pretendida está na integração reproduzível de monitoramento, previsão, processamento geoespacial, validação e visualização interativa.

## Referência espacial oficial

O SGB publicou em 2024 manchas vetoriais para Santo Antônio de Pádua correspondentes às cotas:

```text
300, 325, 350, 375, 400, 425, 450, 475, 500, 525 e 550 cm
```

Essas manchas são usadas como **referência oficial**, e não como resultado próprio do FloodSim.

O estudo SGB utiliza a estação Santo Antônio de Pádua II (`58790002`) e documenta seu referencial vertical. Consulte [`docs/FLOOD_MODEL.md`](docs/FLOOD_MODEL.md).

## Pesquisa de previsão

Relatórios do SAH-Pomba já avaliaram previsões para Santo Antônio de Pádua utilizando dados de montante. Em relatório de 2021, o modelo preferencial usa **UHE Barra do Braúna Jusante (58788600)** com deslocamento de 8 horas.

O FloodSim não herda automaticamente o desempenho desse modelo. Essa relação será tratada como **benchmark e hipótese a ser reavaliada** com dados e protocolo próprios.

Consulte [`docs/FORECAST_MODEL.md`](docs/FORECAST_MODEL.md).

## Arquitetura conceitual

```text
fontes observadas / oficiais
          |
          v
aquisição + catálogo de proveniência
          |
          v
normalização temporal/geoespacial
          |
          +-------------------+
          |                   |
          v                   v
modelo temporal        modelo espacial
(previsão)             (cenários)
          |                   |
          +---------+---------+
                    |
                    v
          tradução espaço-temporal
                    |
                    v
             API / aplicação
                    |
                    v
                MapLibre
```

Modelos científicos não devem ser acoplados aos componentes visuais.

## Stack

### Aplicação

- Next.js;
- TypeScript;
- Tailwind CSS;
- MapLibre GL JS.

### Processamento geoespacial

- Python;
- GeoPandas;
- Rasterio;
- GDAL.

### Pesquisa estatística

A stack será definida de acordo com o protocolo experimental. Bibliotecas e versões deverão ser registradas nas execuções reproduzíveis.

## Tipos de informação

O projeto diferencia:

- `observed`;
- `processed`;
- `official_reference`;
- `derived`;
- `simulated`;
- `forecast`;
- `mock`.

A interface deve deixar claro ao usuário qual categoria está sendo apresentada.

## Responsabilidade

O objetivo social inclui melhorar a compreensão antecipada de cenários de cheia. Entretanto, o sistema não deve emitir ordens como evacuar, retirar móveis ou considerar uma residência segura.

Resultados experimentais devem apresentar fonte, horário, versão, incerteza e direcionamento para autoridades oficiais quando houver decisões de emergência.
