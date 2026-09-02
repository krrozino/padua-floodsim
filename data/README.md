# Dados geoespaciais

O repositório não deve armazenar datasets brutos grandes sem necessidade.

## Estrutura

```text
data/
  raw/          # downloads originais; ignorado pelo Git
  interim/      # recortes/reprojeções; ignorado pelo Git
  cache/        # respostas temporárias de APIs; ignorado pelo Git
  metadata/     # manifests e rastreabilidade; versionado
  processed/    # artefatos pequenos necessários ao front; versionado com critério
```

## Regras

1. Nunca editar um arquivo em `raw/`.
2. Todo dado em `processed/` deve indicar a fonte de origem e o script que o produziu.
3. Geometrias oficiais devem ser identificadas como `official_reference`.
4. Resultados próprios devem ser identificados como `derived`.
5. Dados fictícios devem permanecer em `data/mock` e ser identificados como `mock`.
6. Antes de redistribuir dados de terceiros, conferir licença e atribuição.

## Primeira fonte oficial priorizada

Serviço de manchas de inundação do Serviço Geológico do Brasil:

`https://geoportal.sgb.gov.br/server/rest/services/hidrologia/mancha_santo_antonio_de_padua/MapServer`

A V1 deverá testar o consumo das camadas oficiais por cota antes de manter cópias locais.
