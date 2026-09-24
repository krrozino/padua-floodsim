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
6. Antes de redistribuir dados de terceiros, conferir licença, atribuição e permissão específica de redistribuição.
7. Preferir sempre a fonte original à cópia recebida por pesquisador, artigo, dissertação ou terceiro.
8. Quando a licença não estiver clara, versionar apenas metadados e instruções de aquisição.
9. Todo derivado deve apontar para a fonte original e para o script/commit que o produziu.

## Primeira fonte oficial priorizada

Serviço de manchas de inundação do Serviço Geológico do Brasil:

`https://geoportal.sgb.gov.br/server/rest/services/hidrologia/mancha_santo_antonio_de_padua/MapServer`

A V1 deverá testar o consumo das camadas oficiais por cota antes de manter cópias locais.


## Bases acadêmicas ou institucionais obtidas indiretamente

A citação de um dataset em dissertação ou artigo não autoriza automaticamente sua cópia ou redistribuição.

Em especial, bases municipais/PAE mencionadas em trabalhos acadêmicos sobre Santo Antônio de Pádua só devem ser incorporadas após identificação do provedor original e confirmação das condições de uso.

Consulte:

- `docs/AUTHORSHIP_AND_DATA_PROVENANCE.md`
- `docs/DATA_SOURCES.md`
- `NOTICE.md`
