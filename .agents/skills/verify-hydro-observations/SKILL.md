---
name: verify-hydro-observations
description: Validar dados observados, normalização, atraso e rastreabilidade de coletores hidrológicos no Pádua FloodSim.
---

# Verificação de observações — FloodSim

**Quando usar:** alterações de adapter, parser, estado de atualização, histórico ou interface de medições observadas. Complementa `verify-floodsim` sem duplicar testes.

1. Ler `AGENTS.md`, `docs/OBSERVATION_CONTRACT.md`, `docs/VALIDATION_PROTOCOL.md` e diff/Issue.
2. Verificar de forma direcionada a classificação `observed`, identidade da estação, unidade original e normalizada, `measuredAt` versus `retrievedAt`, qualidade e fuso explícito. Não presumir frescor de um dado apenas porque foi baixado agora.
3. Executar fixtures determinísticas e testes afetados: decimal/unidade, zero legítimo versus missing, timestamps, duplicação, ordem temporal, revisão histórica, payload inválido, timeout, falha da fonte e regra de stale com relógio injetável.
4. Em camada UI, verificar que fonte, estação, leitura e horário aparecem; indisponibilidade e stale são visíveis e que mock/observado/official_reference nunca se misturam.
5. Teste negativo obrigatório: nenhuma leitura altera a camada SGB antes de crosswalk aprovado. Não permitir painéis de risco/evacuação ou forecast sem protocolo.
6. Reaproveitar verificações e checks já válidos; verificar diffs, typecheck/build/testes de escopo, checks obrigatórios. Smoke da fonte real deve ser isolado de suites offline para evitar dependência do uptime externo.
7. Retorno curto: **MUDANÇA | TESTES/EVIDÊNCIA | STATUS DE DADOS | RISCO RESIDUAL | GO/NO-GO**.

**STOP:** ausência de fonte verificável, credencial ou licença; risco a dados; inconsistência referencial; falha essencial sem justificativa. Não dar deploy ou merge por conta própria.
