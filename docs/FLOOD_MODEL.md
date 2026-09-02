# Modelo de inundação — fundação

## Objetivo

Definir como o Pádua FloodSim irá evoluir de uma visualização conceitual para uma simulação espacial tecnicamente defensável.

## Regra principal

No MVP, o sistema deverá carregar **cenários pré-processados** em vez de tentar executar uma modelagem hidráulica completa no navegador.

Exemplo:

```text
3,00 m -> flood-zones/3.00.geojson
3,25 m -> flood-zones/3.25.geojson
3,50 m -> flood-zones/3.50.geojson
...
```

O slider seleciona ou interpola visualmente os cenários disponíveis.

## Fase 1 — visualização mockada

Objetivo: validar UX.

- geometria simplificada;
- níveis fictícios claramente identificados;
- profundidade demonstrativa;
- métricas derivadas do mock.

Nenhum resultado desta fase deve ser apresentado como simulação física real.

## Fase 2 — modelo topográfico experimental

### Entradas

- Modelo Digital de Elevação (MDE/DEM);
- geometria do Rio Pomba;
- área urbana de interesse;
- relação entre a leitura da régua e um referencial vertical compatível;
- bairros e ruas.

### Abordagem inicial

Uma primeira aproximação poderá utilizar uma superfície d'água associada a cada nível e selecionar células do terreno abaixo dessa superfície **com conectividade hidráulica ao rio**.

Essa conectividade é importante para evitar o erro clássico de um simples `elevação < nível`, que pode inundar digitalmente depressões isoladas sem caminho físico para a água.

Fluxo conceitual:

```text
nível selecionado
      |
      v
converter para elevação de referência
      |
      v
comparar com DEM
      |
      v
filtrar regiões conectadas ao Rio Pomba
      |
      v
profundidade = superfície da água - terreno
      |
      v
gerar raster/mancha de inundação
      |
      v
interseção com bairros e ruas
```

## Profundidade

Para cada célula inundada:

`depth = water_surface_elevation - terrain_elevation`

A interface poderá agrupar o valor em classes, inicialmente:

- 0–0,20 m;
- 0,20–0,50 m;
- 0,50–1,00 m;
- 1,00–2,00 m;
- > 2,00 m.

## Impacto por bairro

A criticidade do bairro não deve ser baseada apenas na existência de um ponto alagado.

Métricas candidatas:

- percentual da área do bairro inundada;
- profundidade média;
- profundidade máxima;
- extensão de ruas afetadas;
- quantidade de pontos críticos;
- peso especial para profundidades perigosas.

A fórmula final deverá ser documentada antes de ser usada como indicador público.

## Validação

Antes de associar o modelo a monitoramento real, comparar resultados com:

- manchas oficiais publicadas;
- registros de enchentes históricas;
- fotografias e relatos georreferenciáveis, quando confiáveis;
- pontos reconhecidamente afetados e não afetados.

Indicadores de validação possíveis:

- interseção espacial entre mancha prevista e referência;
- falso positivo;
- falso negativo;
- erro de profundidade quando houver observações.

## Limitações da aproximação topográfica

Um modelo estático baseado em elevação pode não representar corretamente:

- vazão e velocidade;
- tempo de propagação;
- resistência/atrito;
- drenagem urbana;
- galerias e canais;
- muros, aterros e pequenas barreiras;
- pontes e estrangulamentos;
- rompimentos;
- chuvas locais intensas desconectadas da cheia do rio.

Por isso, essa etapa deverá ser chamada de **modelo topográfico experimental**, não de previsão hidrodinâmica.

## Fase avançada

Estudar integração ou comparação com ferramentas de modelagem hidráulica/hidrodinâmica, como HEC-RAS 2D, caso existam dados suficientes de geometria, vazão, rugosidade e condições de contorno.

## Monitoramento x simulação

A aplicação deve sempre diferenciar:

- **Nível observado:** o que a estação está medindo;
- **Cenário associado:** mancha experimental correspondente a um nível;
- **Previsão:** somente se existir um modelo temporal validado.

Um nível observado não deve ser chamado de previsão de inundação sem essa distinção.
