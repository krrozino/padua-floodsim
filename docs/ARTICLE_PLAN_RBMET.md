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

## Estrutura preliminar do manuscrito

1. Introdução
2. Área de estudo
3. Dados
4. Métodos
   - monitoramento;
   - modelos temporais;
   - validação temporal;
   - tradução espacial;
   - validação espacial, se aplicável.
5. Resultados e Discussão
6. Conclusões
7. Agradecimentos
8. Referências

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
