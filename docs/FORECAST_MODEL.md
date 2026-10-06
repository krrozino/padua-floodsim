# Previsão hidrológica de curto prazo — fundação de pesquisa

**Status:** protocolo de pesquisa; nenhum modelo temporal do Pádua FloodSim está validado para uso operacional.

## Objetivo

Definir a linha de pesquisa temporal do Pádua FloodSim: estimar o nível futuro do Rio Pomba em Santo Antônio de Pádua e, posteriormente, traduzir previsões validadas em cenários espaciais.

A variável-alvo pode ser representada por:

```text
H_Padua(t + h)
```

onde `h` representa o horizonte de previsão.

## Horizontes iniciais candidatos

Avaliar separadamente:

- 1 h;
- 2 h;
- 3 h;
- 4 h;
- 5 h;
- 10 h.

O fato de um horizonte existir na interface não implica que o modelo tenha desempenho aceitável nele. Cada horizonte deve ter métricas próprias.

## Variáveis candidatas

### Santo Antônio de Pádua

- nível atual;
- defasagens do nível;
- taxa recente de subida/descida;
- chuva recente/acumulada;
- horário e qualidade das observações.

### Montante

Investigar séries hidrológicas de estações a montante, com atenção especial à **UHE Barra do Braúna Jusante (58788600)** por existir referência técnica prévia do SGB para previsão em Santo Antônio de Pádua.

### Precipitação

Avaliar:

- precipitação local;
- precipitação a montante;
- acumulados em diferentes janelas;
- previsão de precipitação apenas se a fonte, resolução e desempenho justificarem seu uso.

Não incluir variáveis somente porque estão disponíveis. Cada variável deve demonstrar valor preditivo fora do conjunto de treinamento.

## Benchmark técnico existente — SAH-Pomba

Relatório técnico do SGB/CPRM de 2021 avaliou dois modelos de previsão para Santo Antônio de Pádua. No chamado Modelo 2, a entrada a montante foi a estação **UHE Barra do Braúna Jusante (58788600)**.

O relatório registra:

- tempo de deslocamento: **8 horas**;
- correlação montante-jusante: **0,939**;
- MAE reportado: aproximadamente **±11 cm**;
- PBIAS: **0,0%**;
- KGE: **0,956**;
- indicação do Modelo 2 como preferencial naquele estudo.

Fonte:

- https://rigeo.sgb.gov.br/server/api/core/bitstreams/59c0e2b1-8a9e-4898-9c3b-1737d6f71256/content

Relatório anual do SAH-Pomba de 2022 também registra equação para Santo Antônio de Pádua com previsão de **8 horas**.

Esses números são **benchmark histórico**, não desempenho do Pádua FloodSim. O projeto deverá obter séries, reproduzir o problema com protocolo próprio e avaliar generalização em períodos/eventos independentes.

## Modelos a comparar

A pesquisa deverá avançar do simples para o complexo.

### B0 — persistência

```text
H(t+h) = H(t)
```

É o baseline mínimo. Um modelo novo só é útil se superar baselines simples de forma consistente.

### B1 — tendência recente

Extrapolação simples a partir da variação recente do nível.

### M1 — regressão com histórico de Pádua

Usar defasagens do próprio nível e, quando justificadas, variáveis pluviométricas locais.

### M2 — Pádua + montante

Adicionar observações de Barra do Braúna e/ou outras estações selecionadas.

### M3 — Pádua + montante + precipitação

Adicionar precipitação somente após demonstrar benefício fora da amostra.

### Modelos mais complexos

Árvores, ensembles, modelos de séries temporais e redes neurais poderão ser avaliados posteriormente. Complexidade não será objetivo por si só.

## Separação de treino e teste

Evitar divisão aleatória ingênua que misture observações adjacentes no tempo.

Preferir:

- validação temporal;
- eventos de cheia separados;
- períodos retidos;
- backtesting por janelas.

Quando possível, manter eventos inteiros fora do treinamento.

## Métricas

Reportar por horizonte, no mínimo:

- MAE;
- RMSE;
- viés;
- correlação, como medida complementar;
- KGE quando metodologicamente aplicável.

Outras métricas podem ser acrescentadas com justificativa.

Além de métricas médias, investigar desempenho especificamente durante subidas rápidas e eventos de cheia.

## Incerteza

A saída de produção futura não deve ser apenas:

```text
+5 h = 3,90 m
```

O objetivo é chegar a algo como:

```text
previsão central + intervalo/faixa + versão do modelo + desempenho histórico
```

O método de quantificação de incerteza deverá ser escolhido e validado experimentalmente.

## Tradução temporal -> espacial

Uma previsão de nível não pode ser convertida automaticamente em mancha de inundação se o referencial hidrológico não estiver compatível com a referência espacial.

A cadeia só poderá ser habilitada após validação:

```text
previsão H_Padua
      |
      v
referência de régua identificada
      |
      v
transformação/crosswalk validado
      |
      v
cota espacial
      |
      v
official_reference ou simulated
```

O sistema deve informar qual camada está sendo usada:

- mancha oficial SGB;
- cenário derivado;
- modelo espacial próprio.

## Chuva e causalidade

A chuva poderá melhorar a previsão, mas o projeto não deverá assumir que um acumulado pluviométrico isolado explica diretamente a subida em Pádua.

A seleção de estações, janelas de precipitação e defasagens deve considerar a bacia, tempo de resposta e validação estatística.

## Critério de promoção

Um modelo só poderá alimentar uma funcionalidade pública de previsão experimental quando:

1. houver fonte e pipeline reproduzíveis;
2. treino e teste estiverem temporalmente separados;
3. o modelo superar baselines relevantes;
4. métricas forem publicadas por horizonte;
5. houver política de dados faltantes;
6. houver estimativa de incerteza ou limitação explícita;
7. previsões forem rotuladas como experimentais;
8. não houver linguagem de alerta oficial ou recomendação de evacuação.

## Próxima investigação científica

Antes da implementação do forecast, levantar de forma sistemática:

- disponibilidade histórica da estação 58788600;
- disponibilidade histórica de Santo Antônio de Pádua II (58790002);
- frequência e qualidade das séries;
- dados INEA e relação entre estações;
- pluviômetros úteis na bacia;
- eventos de cheia adequados a treino e teste;
- lacunas, mudanças de régua e inconsistências.

Essa investigação é candidata clara a uma tarefa em **Work**, pois exige pesquisa multifuente e análise de séries.
