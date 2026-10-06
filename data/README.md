# Dados do Pádua FloodSim

O repositório não deve armazenar datasets brutos grandes sem necessidade ou sem permissão.

## Estrutura alvo

```text
data/
  raw/          # downloads originais; normalmente ignorado pelo Git
  interim/      # recortes, reprojeções, resampling; normalmente ignorado
  cache/        # respostas temporárias; ignorado
  processed/    # datasets normalizados
  metadata/     # manifests e proveniência; versionado
  mock/         # dados fictícios de UI
```

Dados temporais grandes poderão futuramente usar storage/banco apropriado. Git não deve virar banco de séries históricas.

## Categorias

- `observed` — medição recebida;
- `processed` — observação/referência normalizada;
- `official_reference` — produto oficial;
- `derived` — transformação determinística;
- `simulated` — saída do modelo espacial;
- `forecast` — estimativa temporal futura;
- `mock` — dado fictício.

## Regras

1. Nunca editar silenciosamente um arquivo em `raw/`.
2. Todo `processed` deve apontar para origem e script/commit.
3. Registrar checksum quando aplicável.
4. Registrar timestamp/timezone nas séries temporais.
5. Registrar unidade, estação e identificador.
6. Registrar CRS/datum para dados espaciais.
7. Não misturar gauges/zeros/datum sem transformação explícita.
8. Não redistribuir dados de terceiros sem revisar condições.
9. Preferir fonte original a cópias de terceiros.
10. Quando licença estiver incerta, versionar metadados/instruções, não o arquivo.
11. Forecasts devem apontar para versão do modelo e snapshot/versão dos inputs.
12. Resultados de experimentos devem ser regeneráveis.

## Fontes prioritárias atuais

### Espaço

- manchas oficiais SGB 2024;
- pacote cartográfico/MDE SGB 2015;
- Prefeitura para bairros;
- IBGE;
- OSM apenas como complemento rastreável.

### Tempo

- INEA, após auditoria da estação/referência;
- RHN/SGB/ANA para Santo Antônio de Pádua II (`58790002`);
- UHE Barra do Braúna Jusante (`58788600`) como fonte candidata de montante;
- pluviômetros relevantes a identificar.

## Manifests

Cada dataset incorporado à pesquisa deve possuir metadados suficientes para reconstruir:

```text
origem -> aquisição -> normalização -> uso -> experimento/modelo
```

Consulte:

- `docs/DATA_SOURCES.md`
- `docs/GOVERNANCE.md`
- `docs/VALIDATION_PROTOCOL.md`
- `docs/AUTHORSHIP_AND_DATA_PROVENANCE.md`
- `NOTICE.md`
