# Arquitetura inicial

## Objetivo

Definir uma arquitetura simples para o MVP e permitir evolução posterior para processamento geoespacial e monitoramento hidrológico real.

## Princípios

1. **Pré-processar antes de calcular no navegador.**
2. Separar claramente dados observados, dados simulados e previsões.
3. Manter a camada de visualização independente do processamento GIS.
4. Preservar metadados de origem e referencial espacial dos datasets.
5. Tratar toda saída como experimental até existir validação suficiente.

## Visão geral

```text
Fontes oficiais / dados GIS
          |
          v
    scripts/gis (Python)
 GeoPandas / Rasterio / GDAL
          |
          v
 Dados processados versionados
 GeoJSON / raster / tiles
          |
          v
      Next.js
          |
   MapLibre GL JS
          |
          v
 Dashboard + simulação
```

## Front-end

Responsável por:

- renderização do mapa;
- slider do nível da água;
- seleção de cenários;
- legenda de profundidade;
- classificação visual dos bairros;
- cards de métricas;
- painel de monitoramento;
- avisos sobre fonte e caráter experimental.

O front-end não deve assumir que um nível observado equivale automaticamente a uma mancha validada. Essa relação deverá ser produzida pela camada de processamento.

## Camada geoespacial

Scripts Python deverão processar:

- Modelo Digital de Elevação;
- área de interesse;
- hidrografia;
- bairros;
- malha viária;
- manchas oficiais, quando disponíveis;
- cenários derivados do modelo experimental.

Saídas esperadas:

```text
data/
├── neighborhoods.geojson
├── river.geojson
├── roads.geojson
├── flood-zones/
│   ├── 3.00.geojson
│   ├── 3.25.geojson
│   ├── 3.50.geojson
│   └── ...
└── metadata/
```

## Monitoramento

Dados observados do rio devem ser tratados separadamente dos cenários simulados.

Modelo conceitual:

```text
ObservedRiverLevel
- source
- stationId
- timestamp
- level
- rainfall1h
- rainfall24h
- quality/status
```

O front-end poderá então mostrar:

- nível atual;
- tendência recente;
- última atualização;
- chuva acumulada;
- limiares publicados pela fonte.

## Backend

O MVP pode funcionar sem backend persistente.

Quando necessário, considerar:

- FastAPI para serviços geoespaciais e ingestão;
- PostgreSQL + PostGIS para dados espaciais e históricos;
- tarefas agendadas para ingestão de leituras.

## Deploy

### MVP

- Vercel para o front-end;
- dados estáticos servidos junto à aplicação ou via storage/CDN.

### Evolução

Processamento pesado deverá ocorrer fora da Vercel, evitando executar GDAL/Rasterio em cada requisição.

## Responsabilidade

A interface deve diferenciar visualmente:

- **Observado**: leitura proveniente de fonte oficial;
- **Simulado**: cenário calculado pelo Pádua FloodSim;
- **Projetado/previsto**: somente quando houver metodologia específica e explicitamente documentada.
