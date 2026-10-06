# Protocolo de validação

## Objetivo

Definir critérios mínimos para que resultados temporais ou espaciais do Pádua FloodSim sustentem afirmações científicas ou funcionalidades públicas experimentais.

## Princípio

Nenhuma saída é validada porque "parece correta".

Validação exige referência independente, baselines, métricas e rastreabilidade.

# 1. Validação temporal

## Unidade de avaliação

Avaliar cada horizonte separadamente.

Exemplos:

- +1 h;
- +2 h;
- +3 h;
- +4 h;
- +5 h;
- +10 h.

## Baselines obrigatórios

### Persistência

`H(t+h) = H(t)`

### Tendência recente

Extrapolação simples da variação recente.

Modelos complexos devem justificar ganho sobre esses baselines.

## Separação de dados

Evitar split aleatório de observações consecutivas.

Preferir:

- treino/teste temporal;
- backtesting walk-forward;
- eventos inteiros retidos;
- períodos futuros em relação ao treino.

Nenhum dado futuro pode vazar para features, normalização ou seleção de hiperparâmetros.

## Métricas mínimas

- MAE;
- RMSE;
- viés.

Complementares:

- correlação;
- KGE;
- métricas específicas de eventos.

## Eventos de cheia

Além da média global, reportar desempenho durante:

- subida rápida;
- proximidade de cotas relevantes;
- picos;
- recessão.

## Incerteza

Avaliar cobertura e utilidade do intervalo/faixa de previsão quando houver método de incerteza.

# 2. Validação espacial

## Baseline

```text
DEM <= H
```

deve existir como baseline explícito.

## Modelo candidato

```text
DEM <= H + conectividade hidráulica aproximada ao Rio Pomba
```

## Referência

Prioridade inicial:

- manchas oficiais SGB;
- eventos históricos independentes;
- pontos água presente/ausente;
- outras referências documentadas.

## Métricas

Quando a grade/referência permitir:

- TP;
- FP;
- FN;
- TN;
- IoU;
- precision;
- recall;
- F1;
- erro de área.

Não usar apenas um único indicador.

## Sensibilidade

Investigar, conforme aplicável:

- H;
- resolução;
- conectividade 4/8;
- máscara-semente;
- incerteza vertical;
- escolha do DEM.

# 3. Validação do crosswalk nível -> espaço

É uma validação própria.

Deve documentar:

- estação de origem;
- gauge zero;
- datum/referência;
- transformação;
- erro;
- período usado;
- estabilidade ao longo do tempo.

Sem isso, uma leitura INEA não deve acionar mancha SGB automaticamente.

# 4. Validação integrada

Depois que os componentes individuais forem validados:

```text
input observado
 -> forecast
 -> crosswalk
 -> cenário espacial
 -> bairro/ponto
```

Avaliar erro acumulado da cadeia.

Uma previsão de nível com erro pequeno pode gerar diferença espacial relevante perto de limiares topográficos.

# 5. Reprodutibilidade

Cada resultado central deve informar:

- commit;
- dataset IDs/checksums;
- período;
- parâmetros;
- versão das bibliotecas;
- seed quando existir;
- métricas;
- artefatos de saída.

# 6. Estados de evidência

### Exploratório

Útil para aprender; não sustenta claim.

### Piloto

Pipeline funcional e primeira referência, sujeito a mudança.

### Calibração

Usado para selecionar parâmetros/modelo.

### Validação

Conjunto retido não usado para ajuste.

### Reproduzido

Resultado reexecutado a partir dos mesmos inputs e versão.

# 7. Critério para UI

Uma previsão futura só pode ser exibida como resultado experimental real se:

1. fonte está operacional e datada;
2. modelo está versionado;
3. horizonte tem métricas conhecidas;
4. input não está stale além da política definida;
5. tratamento de missing data está explícito;
6. incerteza/limitação é apresentada;
7. linguagem não sugere alerta oficial.

# 8. Resultado negativo

Se um modelo não superar baseline, isso deve ser registrado.

Não ajustar retrospectivamente o critério de sucesso apenas para tornar o resultado favorável.
