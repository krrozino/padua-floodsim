# ADR-001 — Escopo da Research Phase

**Data:** 2026-10-05  
**Status:** accepted

## Contexto

O Pádua FloodSim começou com foco em visualização e modelagem espacial simplificada de inundação.

Após orientação acadêmica, foram definidos dois objetivos principais de produto/pesquisa:

1. monitorar espacialmente a condição atual do Rio Pomba;
2. prever estatisticamente sua evolução de curto prazo usando nível, chuva e informação de montante.

Esses objetivos exigem integrar pesquisa temporal e espacial sem confundir observação, previsão e referência oficial.

## Decisão

Adotar três pilares:

```text
MONITORAR -> PREVER -> TRADUZIR EM IMPACTO ESPACIAL
```

Manter dois modelos independentes:

- modelo temporal;
- modelo espacial.

Criar uma camada explícita de crosswalk/referência antes de integrá-los.

## Consequências

### Positivas

- escopo científico mais claro;
- possibilidade de validar módulos separadamente;
- reduz risco de equivalência errada entre réguas;
- permite artigo focado em forecast, espaço ou integração;
- melhora explicabilidade.

### Custos

- maior necessidade de dados históricos;
- validação temporal adicional;
- necessidade de persistir previsões;
- aumento da complexidade de governança.

## Não decidido neste ADR

- algoritmo final de previsão;
- banco de dados;
- fonte final em tempo real;
- método de incerteza;
- se haverá um ou dois artigos.

Esses itens dependem da auditoria de dados e dos experimentos.
