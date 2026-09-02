# Modelo de inundação — fundação

## Objetivo

Definir como o Pádua FloodSim irá evoluir de uma visualização conceitual para uma simulação espacial tecnicamente defensável.

## Regra principal

O projeto deve separar explicitamente três coisas:

1. **mancha oficial publicada**;
2. **modelo experimental próprio**;
3. **nível observado em tempo real**.

Nenhuma delas deve ser apresentada como equivalente às outras sem uma transformação e validação documentadas.

---

## Descoberta principal da V1

O Serviço Geológico do Brasil publicou em 2024 um estudo específico de Santo Antônio de Pádua e disponibiliza no Geoportal SGB manchas vetoriais oficiais do Rio Pomba por cota.

Referências:

- relatório: https://rigeo.sgb.gov.br/handle/doc/25035
- serviço GIS: https://geoportal.sgb.gov.br/server/rest/services/hidrologia/mancha_santo_antonio_de_padua/MapServer

O produto possui cenários de **300 a 550 cm em intervalos de 25 cm**.

### Consequência arquitetural

A V1 não precisa começar tentando superar uma modelagem já produzida pelo órgão técnico responsável.

Prioridade:

```text
slider
  |
  v
selecionar cota oficial disponível
  |
  v
carregar polígono oficial SGB
  |
  v
cruzar com bairros/ruas
  |
  v
calcular impacto
```

O modelo experimental próprio passa a ser uma camada paralela de pesquisa e comparação.

---

## Referência hidrológica oficial do estudo SGB 2024

### Estação

- nome: Santo Antônio de Pádua II;
- código RHN: `58790002`;
- altitude ortométrica do zero da régua: **79,709 m**;
- datum vertical: **hgeoHNOR_IMBITUBA**.

### Cotas de referência publicadas

- atenção: **240 cm**;
- alerta: **275 cm**;
- inundação/primeiro dano: **310 cm**.

### Cenários oficiais

| Cota local | Elevação ortométrica |
|---:|---:|
| 300 cm | 82,71 m |
| 325 cm | 82,96 m |
| 350 cm | 83,21 m |
| 375 cm | 83,46 m |
| 400 cm | 83,71 m |
| 425 cm | 83,96 m |
| 450 cm | 84,21 m |
| 475 cm | 84,46 m |
| 500 cm | 84,71 m |
| 525 cm | 84,96 m |
| 550 cm | 85,21 m |

Essa relação é aproximadamente:

```text
elevação ortométrica = 79,709 m + cota local em metros
```

A diferença de arredondamento exibida na tabela oficial deve ser preservada quando os valores publicados forem apresentados ao usuário.

---

## Como o SGB produziu as manchas de referência

Segundo o relatório de 2024:

### Terreno seco

- levantamento com VANTE;
- resolução original de 10 cm;
- reamostragem para 10 m.

### Referenciais

- SIRGAS 2000 / UTM 23S;
- datum vertical hgeoHNOR_IMBITUBA.

### Canal

- 60 seções batimétricas;
- levantamento com ADCP;
- interpolação IDW da topografia submersa;
- integração da superfície seca com o MDE do canal.

### Modelo hidráulico

- HEC-RAS 6.5 Beta;
- modelagem descrita como fluxo retilíneo, uniforme e unidimensional;
- Manning calibrado:
  - canal principal: `0.025`;
  - margens: `0.050`.

Essa metodologia deve ser considerada a baseline oficial para comparação de qualquer modelo próprio.

---

## Fase 0 — visualização mockada

Objetivo: validar UX.

- geometria simplificada;
- níveis fictícios claramente identificados;
- profundidade demonstrativa;
- métricas derivadas do mock.

Nenhum resultado desta fase deve ser apresentado como simulação física real.

---

## Fase 1 — manchas oficiais SGB

Objetivo: substituir a geometria fictícia por referência espacial oficial.

### Entrada

Camadas vetoriais do Geoportal SGB:

```text
COTA_300cm
COTA_325cm
COTA_350cm
...
COTA_550cm
```

### Estratégia de front-end

Preferência:

1. consultar/exportar a camada em GeoJSON;
2. armazenar em cache somente se necessário;
3. renderizar no MapLibre;
4. registrar fonte, cota e horário/data de obtenção;
5. identificar visualmente como `Mancha oficial SGB`.

### Discretização do slider

O slider pode continuar fluido visualmente, mas a mancha oficial selecionada deve usar os níveis disponíveis.

Possibilidades:

- snap de 25 cm;
- exibir a última mancha oficial abaixo do valor selecionado;
- exibir as duas manchas adjacentes com indicação de que não há cenário oficial intermediário.

Não interpolar geometria e chamá-la de oficial.

---

## Fase 2 — cálculo de impacto sobre bairros e ruas

### Bairros

Usar limites oficiais municipais quando disponíveis.

A criticidade não deve ser baseada apenas na existência de um ponto de interseção.

Métricas candidatas:

- percentual da área do bairro atingida;
- área absoluta atingida;
- extensão de ruas dentro da mancha;
- quantidade de estruturas/pontos críticos dentro da mancha;
- profundidade, somente quando existir uma fonte/modelo que forneça esse valor.

### Ruas

A malha viária pode vir inicialmente do OpenStreetMap, com rastreabilidade e atribuição ODbL.

### Cores dos bairros

O esquema azul -> amarelo -> laranja -> vermelho deverá ser baseado numa fórmula versionada e documentada.

Exemplo inicial, ainda não aprovado para produção:

```text
azul      = < 5% da área atingida
amarelo   = 5–15%
laranja   = 15–35%
vermelho  = > 35%
```

Esses limiares são provisórios até validação com contexto local.

---

## Fase 3 — modelo topográfico experimental próprio

O projeto poderá gerar manchas próprias para:

- pesquisa;
- comparação com a referência oficial;
- exploração de níveis fora da grade oficial;
- cálculo de profundidade;
- experimentos acadêmicos.

### Entradas

- Modelo Digital de Elevação;
- geometria do Rio Pomba;
- área urbana de interesse;
- relação entre leitura da régua e referencial vertical compatível;
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

---

## Profundidade

As manchas oficiais publicadas pelo SGB delimitam extensão por cenário. O projeto não deve inferir automaticamente profundidade apenas pelo polígono.

No modelo experimental com MDE, para cada célula inundada:

```text
depth = water_surface_elevation - terrain_elevation
```

A interface poderá agrupar o valor em classes, inicialmente:

- 0–0,20 m;
- 0,20–0,50 m;
- 0,50–1,00 m;
- 1,00–2,00 m;
- > 2,00 m.

Quando a tela estiver mostrando apenas a mancha oficial e não houver profundidade oficial disponível, a legenda deve dizer **extensão inundada**, e não inventar classes de profundidade.

---

## INEA x SGB: referências de régua diferentes até prova em contrário

A página do INEA usada localmente em Pádua apresenta cota de transbordamento de **5,00 m**.

O estudo do SGB trabalha com a estação `58790002`, com primeiro dano em **3,10 m** e zero da régua georreferenciado a 79,709 m.

Até que sejam identificados:

- código da estação INEA;
- zero da régua INEA;
- datum/referência;
- relação entre as séries;

é proibido associar diretamente:

```text
INEA 5,00 m == SGB COTA_500cm
```

O painel em tempo real do INEA poderá existir independentemente da mancha oficial. A sincronização automática entre leitura INEA e cenário SGB somente entra após validação.

---

## Validação do modelo próprio

Comparar resultados com:

- manchas oficiais SGB;
- registros de enchentes históricas;
- imagens de satélite/fotografias georreferenciáveis quando confiáveis;
- pontos reconhecidamente atingidos e não atingidos.

Indicadores possíveis:

- IoU/interseção espacial;
- falso positivo;
- falso negativo;
- diferença de área;
- erro de profundidade quando houver observação.

---

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

---

## Fase avançada

Estudar modelagem hidráulica/hidrodinâmica própria apenas quando houver justificativa e dados suficientes.

Candidatos:

- HEC-RAS 1D/2D;
- IBER;
- outras ferramentas abertas adequadas.

O objetivo não é apenas reproduzir o SGB, mas permitir estudos adicionais documentados e comparáveis.

---

## Monitoramento x simulação

A aplicação deve sempre diferenciar:

- **Nível observado:** leitura de estação;
- **Mancha oficial:** cenário publicado pelo SGB;
- **Cenário derivado:** resultado do Pádua FloodSim;
- **Previsão:** somente quando existir modelo temporal validado.

Um nível observado não deve ser chamado de previsão de inundação sem essa distinção.
