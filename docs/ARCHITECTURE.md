# Arquitetura — Research Phase

## Estado atual

A V1 implementada continua centrada na visualização das manchas oficiais SGB.

`lib/sgb/useSgbFlood.ts` consulta o cenário e `FloodMap` renderiza as camadas no MapLibre. Metadados de cotas oficiais ficam em `lib/sgb/stages.ts`.

Os pontos atuais de bairros são referências aproximadas/mock e não representam limites territoriais nem risco.

Esta documentação descreve também a **arquitetura alvo de pesquisa**, que ainda não está toda implementada.

## Princípios

1. Dados brutos são preservados.
2. Proveniência acompanha cada transformação.
3. Modelos temporais e espaciais são independentes.
4. A interface não contém a lógica científica principal.
5. Observação, processamento, referência, simulação e previsão são categorias distintas.
6. Falha de dado nunca deve ser convertida silenciosamente em valor estimado.
7. Modelos e parâmetros importantes são versionados.
8. A tradução nível -> mapa só ocorre após compatibilidade de referência validada.

## Visão geral

```text
                  FONTES
        +-----------+-----------+
        |                       |
        v                       v
hidrologia/chuva           GIS/topografia
        |                       |
        +-----------+-----------+
                    |
                    v
           aquisição + catálogo
                    |
                    v
              normalização
          temporal + espacial
             /             \
            v               v
   modelo temporal      modelo espacial
      forecast          flood scenario
            \               /
             \             /
              v           v
          tradução espaço-temporal
                    |
                    v
           impacto/classificação
                    |
                    v
               API/camada
                    |
                    v
               Next.js
                    |
                    v
              MapLibre/UI
```

## 1. Aquisição

Responsável por:

- baixar/consultar fontes;
- registrar URL e instituição;
- registrar data de acesso;
- registrar licença/condições;
- checksum quando aplicável;
- guardar identificadores de estação;
- preservar arquivos brutos quando permitido.

Não contém lógica de previsão ou simulação.

## 2. Catálogo e proveniência

Cada fonte deve informar, conforme aplicável:

- `source_id`;
- instituição;
- estação/dataset;
- unidade;
- frequência;
- timezone;
- CRS;
- datum vertical;
- gauge zero;
- resolução;
- período;
- licença;
- qualidade/status.

## 3. Normalização temporal

Responsável por:

- timezone;
- unidades;
- frequência/amostragem;
- gaps;
- flags de qualidade;
- resampling quando metodologicamente permitido;
- construção de defasagens/features.

Saída é `processed`, nunca `forecast`.

## 4. Normalização geoespacial

Responsável por:

- reprojeção;
- recorte;
- nodata;
- resolução;
- alinhamento de grades;
- transformação de datum quando explicitamente suportada.

## 5. Modelo temporal

Implementação científica separada da aplicação.

Entradas possíveis:

- nível em Pádua;
- histórico recente;
- montante;
- Barra do Braúna;
- precipitação;
- outras variáveis validadas.

Saída conceitual:

```text
Forecast
- issuedAt
- targetTime
- horizon
- targetStation
- predictedLevel
- intervalLow
- intervalHigh
- modelVersion
- inputSnapshotId
- metricsReference
```

O módulo deve permitir backtesting offline e reprodução das previsões.

## 6. Modelo espacial

Duas famílias devem permanecer separadas.

### Official reference

Manchas publicadas pelo SGB.

### Experimental simulation

Modelo FloodSim de cota + conectividade e futuros experimentos.

Saída deve incluir:

- tipo da camada;
- cota/referência;
- fonte/modelo;
- versão;
- parâmetros;
- geometria/raster;
- métricas quando aplicável.

## 7. Crosswalk hidrológico/geodésico

Componente crítico entre nível e espaço.

Responsável por responder:

> Este valor de nível pode ser comparado ou transformado para a referência usada pela camada espacial?

Não deve existir fallback implícito.

Estados possíveis:

- `validated`;
- `provisional`;
- `unsupported`;
- `unknown`.

Somente `validated` pode alimentar automaticamente cenário futuro de usuário.

## 8. Tradução espaço-temporal

Recebe:

- observação ou forecast;
- crosswalk validado;
- catálogo de cenários.

Produz uma representação espacial identificando claramente se é:

- `official_reference`;
- `derived`;
- `simulated`.

Se a previsão tiver faixa de incerteza, o tradutor deve preservar essa informação.

## 9. Impacto espacial

Responsável por:

- interseção com bairros;
- área/percentual territorial;
- vias;
- equipamentos públicos, quando confiáveis;
- consulta de ponto.

Não deve inferir pessoas, danos ou necessidade de evacuação sem dados/modelos próprios para isso.

## 10. API/aplicação

Responsável por contratos de leitura e apresentação.

Não executa treinamento científico no request.

Endpoints futuros devem expor metadados suficientes para a UI apresentar:

- fonte;
- timestamp;
- estado stale;
- categoria;
- modelo/versão;
- horizonte;
- incerteza.

## 11. Front-end

Responsável por:

- mapa;
- linha temporal;
- cards de nível/tendência;
- visualização da chuva;
- seleção de cenário;
- bairros;
- comparação;
- histórico;
- explicabilidade;
- avisos de responsabilidade.

O front-end não decide cientificamente qual mancha corresponde a uma régua incompatível.

## Persistência

O MVP pode continuar sem backend persistente para a referência SGB.

A Research Phase provavelmente exigirá persistência para:

- séries históricas;
- snapshots de inputs;
- previsões emitidas;
- avaliações previsto x observado;
- registros de experimentos.

Tecnologias candidatas só serão escolhidas quando houver necessidade concreta.

## Processamento pesado

GDAL/Rasterio, treinamento de modelos e backtesting não devem ocorrer em cada request da Vercel.

Preferir jobs/pipelines offline ou serviço dedicado.

## Observabilidade científica

Além de logs de software, registrar:

- versão do modelo;
- versão dos dados;
- atraso da fonte;
- percentual de dados ausentes;
- erros de ingestão;
- métricas do modelo;
- divergência previsto x observado.

## Segurança

A interface deve diferenciar visualmente:

- observado;
- previsto;
- oficial;
- derivado;
- simulado;
- mock.

Nenhum módulo técnico transforma o projeto em serviço oficial de alerta.
