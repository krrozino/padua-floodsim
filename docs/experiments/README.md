# Experimentos

Este diretório registra protocolos e resultados resumidos dos experimentos científicos do Pádua FloodSim.

## Convenção de ID

```text
EXP-YYYY-NNN
```

Exemplo:

```text
EXP-2026-001
```

## Template

Cada experimento deve registrar:

### Identificação

- ID;
- título;
- data;
- responsável;
- status.

### Pergunta

Qual pergunta ou hipótese está sendo testada?

### Dados

- fontes;
- período;
- IDs/checksums;
- filtros;
- exclusões justificadas.

### Método

- baseline;
- modelo;
- features;
- parâmetros;
- split;
- métricas.

### Reprodutibilidade

- branch/commit;
- ambiente;
- versões;
- seed;
- comando/script.

### Resultados

Registrar números e caminhos dos artefatos gerados.

### Interpretação

Separar:

- resultado observado;
- interpretação;
- hipótese para investigação futura.

### Limitações

Registrar problemas conhecidos.

## Regra

Exploração informal pode começar em notebook/local, mas resultados usados no artigo devem possuir protocolo e versão reproduzível.
