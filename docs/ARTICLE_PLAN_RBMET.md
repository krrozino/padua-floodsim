# Plano de pesquisa e artigo — Pádua FloodSim

**Alvo editorial em discussão com a orientação:** Revista Brasileira de Meteorologia (RBMET).  
**Status:** planejamento; a submissão e o recorte final dependem dos resultados e da decisão dos autores/orientação.

## Princípio

O artigo não deve ser um texto de divulgação do aplicativo. O software é uma implementação e uma plataforma de exploração; o objeto científico deve ser uma pergunta testável.

Após a reunião de orientação de 05/10/2026, o projeto passa a investigar duas frentes integráveis:

1. monitoramento e tradução espacial do nível observado;
2. previsão estatística de curto prazo e tradução espacial do nível futuro.

## Pergunta integradora candidata

> Em que medida observações hidrológicas a montante e em Santo Antônio de Pádua podem ser integradas a modelos estatísticos de curto prazo e referências geoespaciais de inundação para representar a evolução temporal e espacial de cheias do Rio Pomba?

Essa pergunta ainda poderá ser estreitada. Um único artigo não deve tentar responder mais do que os dados permitem.

## Objetivo geral candidato

Desenvolver e avaliar uma metodologia reproduzível para integrar monitoramento hidrológico, previsão estatística de curto prazo e representação espacial de cenários de inundação do Rio Pomba em Santo Antônio de Pádua.

## Objetivos específicos

1. Inventariar e compatibilizar fontes hidrológicas, pluviométricas e geoespaciais.
2. Determinar as relações válidas entre as referências de nível disponíveis.
3. Implementar monitoramento observado com proveniência e estado de atualização.
4. Construir baselines de previsão de curto prazo.
5. Avaliar a contribuição de dados de montante, com atenção a Barra do Braúna.
6. Avaliar a contribuição de precipitação.
7. Medir desempenho por horizonte temporal.
8. Quantificar e comunicar incerteza.
9. Relacionar níveis compatíveis a cenários espaciais oficiais ou simulados.
10. Avaliar interseção dos cenários com bairros quando houver geometria adequada.
11. Comparar o modelo topográfico experimental com a referência SGB quando essa frente fizer parte do recorte final.
12. Documentar limitações e uso responsável.

## Hipóteses candidatas

### H1 — informação de montante

Dados de estações a montante melhoram a previsão de nível em Pádua em relação aos baselines de persistência e tendência local.

### H2 — Barra do Braúna

A estação UHE Barra do Braúna Jusante contém informação temporal útil para previsão em Santo Antônio de Pádua, devendo o projeto reavaliar essa relação em dados independentes.

### H3 — precipitação

Variáveis de precipitação selecionadas de forma hidrologicamente coerente podem acrescentar informação preditiva a determinados horizontes, mas seu ganho deve ser demonstrado empiricamente.

### H4 — tradução espacial

Quando as referências verticais e de régua são compatíveis, níveis observados ou previstos podem ser traduzidos em cenários espaciais de forma reproduzível, desde que a camada resultante seja corretamente identificada como referência oficial, derivada ou simulada.

## Pacotes de trabalho

### WP0 — governança e proveniência

Documentos, dados, licenças, checksums, versões, decisões e registro de IA.

### WP1 — monitoramento

INEA, SGB/ANA e outras fontes; identificação de estações; ingestão; qualidade; atualização.

### WP2 — previsão

Séries históricas, Barra do Braúna, chuva, baselines, modelos, backtesting e incerteza.

### WP3 — espaço

Manchas SGB, DEM, conectividade hidráulica, bairros e impacto espacial.

### WP4 — integração

Converter observação/previsão em cenário somente após compatibilidade de referência comprovada.

### WP5 — validação

Eventos históricos, métricas temporais, métricas espaciais e análise de falhas.

### WP6 — comunicação

Interface, explicabilidade, limitações e demonstração do sistema.

## Resultados esperados

O artigo deverá priorizar resultados quantitativos, por exemplo:

- tabela de desempenho de previsão por horizonte;
- comparação entre persistência, tendência e modelos com montante;
- contribuição incremental de precipitação;
- gráfico previsto x observado;
- análise por eventos de cheia;
- intervalos de incerteza;
- mapas de cenários correspondentes;
- quando aplicável, métricas espaciais IoU/precisão/recall/F1 para o modelo topográfico.

## Duas linhas que podem virar artigos separados

Se a pesquisa crescer demais, separar:

### Artigo A — previsão hidrológica de curto prazo

Pádua + Barra do Braúna + precipitação + horizontes + incerteza.

### Artigo B — tradução/modelagem espacial

DEM + conectividade + manchas SGB + bairros + validação espacial.

A decisão deverá ser tomada com a professora após a auditoria real de dados.

## Estrutura editorial do manuscrito

Conforme o roteiro fornecido pela professora e as [instruções da RBMET](https://www.scielo.br/journal/rbmet/about/) consultadas em 27/11/2026:

- Página 1: título em inglês, Abstract e Keywords.
- Página 2: título em português, Resumo e Palavras-chave. Resumen em espanhol conforme roteiro complementar da professora.
- 1. Introdução — contextualização, literatura, problema e objetivos.
- 2. Material e Métodos — área de estudo, fontes, normalização, qualidade, modelos, validação, representação espacial, conforme recorte.
- 3. Resultados e Discussão — evidências documentadas e limitações, sem converter hipóteses em resultados.
- 4. Conclusões — limitadas às evidências e ao recorte executado.
- 5. Agradecimentos.
- 6. Referências Bibliográficas.

### Formatação

A4, Times New Roman 11, espaço duplo, margens laterais de 3 cm e superior/inferior de 2,5 cm, numeração superior direita desde a primeira página, resumos de até 200 palavras e 1–6 palavras-chave. Adotar o limite conservador de 20 páginas no total (incluindo referências, tabelas e figuras) solicitado pela professora. Referências ABNT em ordem alfabética; tabelas editáveis e indicação de posição no texto; figuras separadas com resolução adequada (300 dpi). Antes de submissão, conferir requisitos vigentes de anonimização, declaração de IA, contribuições, financiamento, conflitos e Ciência Aberta.

## Organização editorial — 27/11/2026

- **Prévia para a professora:** Avaliação de Dados Hidrológicos e Visualização de Cenários de Inundação do Rio Pomba em Santo Antônio de Pádua, RJ. Versão de 27/11/2026, 12 páginas, 9 referências e 2 tabelas. DOCX e PDF entregues ao mantenedor no chat; importação nativa no Google Docs ainda não concluída.
- **Manuscrito único:** Google Docs quando importado e conferido pelo mantenedor; não sobrescrever o relatório de fundamentação existente nem manter versões concorrentes.
- **ChatGPT do projeto:** estruturação acadêmica, redação e revisão com autorização humana. **Sauron:** coordenação operacional, acompanhamento de experimentos e publicação de evidências com fonte, versão, parâmetros, validação e limitações; não reescrever o manuscrito autonomamente.
- **Notion:** planejamento editorial e registro de decisões. **GitHub:** fonte de verdade técnica para código, metodologia e evidências. Autoria, recorte definitivo e submissão dependem de decisão humana e orientação.
- **Evidência atual:** EXP-2026-001 é exploratório, com reprodução independente condicionada aos dados originais; EXP-2026-002 não executado. A [verificação das áreas SGB](research/SGB_AREA_VALIDATION_2026-11-25.md) valida numericamente o cálculo de área dos polígonos de referência, não sua acurácia hidráulica. Sem crosswalk INEA–SGB, sem previsão pública. Não tratar período de 2026 já explorado como holdout intocado. A [issue #46](https://github.com/krrozino/padua-floodsim/issues/46) permanece como tarefa científica de reprodução e validação; não duplicar.
- A prévia não é submissão nem conclusão definitiva; não incluir campos vazios ou notas editoriais internas no documento encaminhado, mantendo as limitações científicas reais.

## Regra contra viés de confirmação

O experimento não existe para provar que o FloodSim funciona.

Resultados como:

- Braúna não melhora determinado horizonte;
- chuva não acrescenta ganho;
- o modelo espacial simples falha em regiões urbanas;
- a incerteza torna um horizonte impraticável;

continuam sendo resultados científicos relevantes quando o protocolo é adequado e reproduzível.

## Critério de maturidade para redação final

Antes de redigir conclusões:

- dados catalogados;
- referenciais compreendidos;
- pipeline reproduzível;
- baselines executados;
- modelos testados fora da amostra;
- métricas produzidas;
- incerteza analisada;
- limitações registradas;
- figuras/tabelas geradas por pipeline;
- decisões metodológicas versionadas.
