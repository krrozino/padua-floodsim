# Contrato de observações hidrológicas — Pádua FloodSim

**Status:** proposta de contrato para pesquisa e integração; sem coletor oficial operacional validado.
**Fase:** Research / monitoramento observado.
**Objetivo:** permitir fontes distintas sem misturar suas réguas, carimbos de tempo e classificações de confiança.

## Pré-condição de qualquer adaptador
Antes de consumir continuamente uma fonte, registrar em `docs/DATA_SOURCES.md`: instituição, URL, identidade oficial da estação, coordenadas se publicadas, unidade, zona temporal, intervalo de coleta, timestamp da medição, referência/zero da régua e datum quando conhecidos, direitos de acesso/armazenamento/redistribuição, documentação do endpoint e exemplo permitido de payload. Campos desconhecidos permanecem `null`/não confirmados. Um identificador extraído de URL não comprova equivalência de estações.

Candidatos para auditoria inicial:
- INEA: página Santo Antônio de Pádua `https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.html`. `21304212020` é, por enquanto, identificador da página/estação a confirmar, não código RHN nem prova de datum.
- SGB/ANA: Santo Antônio de Pádua II, RHN `58790002`, referenciada no estudo de mancha SGB 2024; verificar identidade e estabilidade da régua na série realmente consultada.
- Montante: UHE Barra do Braúna Jusante, RHN `58788600`, apenas candidata para estudo temporal, não variável preditiva já validada.

## Estrutura canônica sugerida
Um registro normalizado de nível deve conter:

| Campo | Regra |
| --- | --- |
| `classification` | `observed` somente para medição efetivamente recebida; `mock` nunca se converte silenciosamente em `observed` |
| `provider`, `stationId`, `stationName` | identificadores com namespace da fonte e procedência |
| `sourceUrl`, `sourceRecordId` (opcional) | trilha verificável até o registro publicado |
| `measuredAt` | ISO 8601 com offset ou UTC após interpretação explícita do fuso original |
| `retrievedAt` | instante de coleta pelo FloodSim, **não** substitui `measuredAt` |
| `stageCm` | número finito em centímetros, ou `null` se ausente/inválido; nunca fabricar zero |
| `unitOriginal`, `rawValue` | valor e unidade originais para auditoria da conversão |
| `gaugeReference` | identificador/zero/datum documentados; desconhecidos ficam `null` |
| `qualityFlags` | marcas explícitas: missing, duplicate, out_of_order, suspect_range, stale, upstream_error etc. |
| `status` | `fresh`, `stale`, `unavailable` ou `invalid` conforme regra documentada da fonte |
| `sourceHashSha256` | hash do registro/payload de origem quando legal e tecnicamente viável |
| `parserVersion` | versão verificável da transformação realizada |

Um registro de chuva é uma observação distinta, com `rainMm`, duração da janela e sensor identificados; não misturar acumulados de janelas diferentes.

## Regras obrigatórias do pipeline
1. **Aquisição** isolada por provedor e estação, com timeout, limite de bytes, retry/backoff limitado, allowlist de host, tratamento de indisponibilidade e respeito aos termos.
2. **Normalização** separada da aquisição; parser determinístico, unitário e testável offline; validar unidade, decimal, timezone, ordem temporal e dados ausentes. Valores zero são válidos apenas se a fonte os publicar como medição.
3. **Qualidade:** `fresh` só após definir política de atraso por frequência real da fonte. Mostrar `measuredAt` e `retrievedAt` separadamente. Não usar horário do fetch como horário da medição. Nunca manter a última medição como atual sem indicar stale.
4. **Histórico:** append-only/idempotente por provedor + estação + instante + tipo, com política para revisões de dados e proveniência. Não commitar séries brutas volumosas no Git; licenças e custos de armazenamento precisam ser verificados antes de agendar coleta contínua.
5. **Interface:** dados observados independentes da régua manual SGB. A camada SGB continua `official_reference`; não a acionar nem interpolar a partir de INEA/SGB/ANA observados sem crosswalk de estação, zero, datum e erro documentado.
6. **Segurança:** jamais incorporar credenciais na UI, PR, fixtures ou logs; falhar fechado para observações inválidas. Não tratar o FloodSim como sistema oficial de alerta.

## Testes mínimos para promover um adaptador
- Fixture real permitida por fonte + fixtures sintéticas rotuladas separadamente.
- Sucesso com unidade/fuso explícitos, vírgula decimal quando aplicável, `0` genuíno, missing/sentinel, timestamp inválido, dado fora de ordem/duplicado, indisponibilidade e timeout.
- Teste de stale com relógio injetável; assegurar que fallback anterior não aparece como leitura nova.
- Idempotência e correção de registros revisados; rastreabilidade de hash e parser versionado.
- Teste negativo: nenhuma leitura da fonte observada atualiza automaticamente a mancha SGB.
- Teste de integração contra provedor **não bloqueante no CI comum** quando indisponibilidade externa não é falha do código; documentar smoke periódico isolado.
- Validar ao menos uma amostra contra o valor e o timestamp publicados pela instituição, registrando data e evidência.

## Gates científicos
**G1 — fonte auditada:** endpoint/caminho de coleta realmente verificado, regras de uso e metadados básicos.
**G2 — observação ingerida:** parser + testes + fonte e timestamps mostrados; sem conversão espacial.
**G3 — histórico para artigo:** período, gaps, revisões, qualidade, hashes/versões e protocolo reproduzível.
**G4 — crosswalk:** prova de compatibilidade ou transformação com erro/estabilidade mensurados antes de mapear observação na mancha.
**G5 — previsão:** somente após treino/teste temporal retido, baselines, métricas por horizonte e incerteza; `forecast` sempre experimental.

Referências internas: `AGENTS.md`, `docs/ACADEMIC_METHODOLOGY.md`, `docs/VALIDATION_PROTOCOL.md`, `docs/FORECAST_MODEL.md`, `docs/ARTICLE_PLAN_RBMET.md`, issues #6/#37/#38.
