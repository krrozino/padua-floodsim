# Pádua FloodSim

Plataforma experimental de simulação e monitoramento de enchentes para **Santo Antônio de Pádua - RJ**, com foco no **Rio Pomba**.

## Visão do projeto

O Pádua FloodSim pretende transformar dados topográficos e hidrológicos em uma visualização simples e interativa dos impactos de uma cheia na área urbana.

O usuário poderá alterar manualmente o nível do Rio Pomba em uma régua e observar, no mapa, como diferentes cenários podem afetar bairros, ruas e áreas da cidade. O projeto também prevê uma área separada para acompanhamento do nível observado do rio em tempo real.

## Experiência principal

- Mapa topográfico de Santo Antônio de Pádua.
- Rio Pomba destacado no mapa.
- Slider para alterar o nível simulado da água.
- Mancha de inundação correspondente ao cenário selecionado.
- Profundidade representada por diferentes tons de azul.
- Nomes dos bairros com classificação visual de criticidade.
- Painel com bairros, ruas e área potencialmente afetados.
- Painel separado de monitoramento do nível observado do rio.
- Tendência de subida, estabilidade ou descida.
- Dados pluviométricos quando disponíveis.

## Escala visual inicial de profundidade

| Profundidade | Classificação |
| --- | --- |
| 0 a 0,20 m | Muito raso |
| 0,20 a 0,50 m | Raso |
| 0,50 a 1,00 m | Moderado |
| 1,00 a 2,00 m | Profundo |
| acima de 2,00 m | Muito profundo |

A classificação de bairros será uma métrica própria do sistema e poderá variar de azul a vermelho conforme a severidade do cenário.

## MVP

A primeira versão deve provar o conceito com o menor número possível de dependências:

1. dashboard responsivo;
2. mapa navegável;
3. bairros e Rio Pomba representados;
4. slider de nível da água;
5. cenários de inundação pré-processados;
6. legenda de profundidade;
7. painel de impacto;
8. dados hidrológicos mockados;
9. aviso claro de caráter experimental.

No MVP, o navegador não precisa calcular toda a hidráulica em tempo real. Os cenários podem ser gerados previamente e carregados conforme o nível selecionado.

## Evolução planejada

### V0 — Protótipo visual

Interface, mapa e dados mockados para validar a experiência.

### V1 — Simulação geográfica

Integração com topografia real, bairros, ruas e manchas de inundação derivadas de dados geoespaciais.

### V2 — Monitoramento

Integração com fontes oficiais para exibir nível observado do Rio Pomba e pluviometria.

### V3 — Histórico e alertas

Histórico de leituras, comparação de eventos e mecanismos de aviso.

### V4 — Modelagem avançada

Estudo de modelos hidráulicos/hidrodinâmicos, previsão e visualização 3D.

## Stack inicial

### Front-end

- Next.js
- TypeScript
- Tailwind CSS
- MapLibre GL JS

### Processamento geoespacial

- Python
- GeoPandas
- Rasterio
- GDAL

### Formatos de dados

- GeoJSON
- GeoTIFF / raster de elevação
- tiles quando necessário

### Infraestrutura futura

- FastAPI ou Node.js
- PostgreSQL + PostGIS

## Estrutura planejada

```text
padua-floodsim/
├── app/
├── components/
│   ├── dashboard/
│   ├── map/
│   ├── monitoring/
│   └── simulation/
├── data/
│   ├── flood-zones/
│   └── mock/
├── docs/
├── lib/
├── public/
└── scripts/
    └── gis/
```

## Fontes de dados candidatas

O projeto deve priorizar dados públicos e oficiais, como os disponibilizados por:

- INEA;
- Serviço Geológico do Brasil (SGB);
- ANA;
- IBGE;
- Prefeitura e Defesa Civil, quando houver dados públicos adequados.

Cada integração deverá ser documentada, incluindo origem, datum/referencial, frequência de atualização, licença e limitações.

## Segurança e responsabilidade

O Pádua FloodSim é inicialmente uma ferramenta **experimental, educacional e de pesquisa**. Simulações e estimativas não substituem avisos oficiais de órgãos como INEA e Defesa Civil.

Até que os modelos sejam devidamente calibrados e validados, nenhuma visualização deve ser apresentada como previsão oficial ou garantia de segurança.

## Status

🟡 Planejamento e fundação do projeto.
