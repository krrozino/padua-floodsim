---
name: audit-hydro-source
description: Verificar legal e tecnicamente uma fonte hidrológica oficial antes da ingestão do Pádua FloodSim.
---

# Auditoria de fonte hidrológica — FloodSim

**Quando usar:** investigar INEA, SGB/SACE ou ANA/HidroWeb, identificar estações e verificar coleta estruturada, séries ou metadados. Não usar para afirmar que uma API funciona sem requisição comprovada.

1. Ler `AGENTS.md`, `docs/OBSERVATION_CONTRACT.md`, `docs/DATA_SOURCES.md` e issue correspondente (#6 ou #37). Selecionar a fonte específica para a tarefa; não auditar todas por rotina.
2. Acessar **fonte institucional original** e verificar: identificadores, coordenadas, rio, gauge zero, datum, unidade, timestamp e zona temporal da medição, frequência, lacunas, termos/licença, versão e endpoint/exportação realmente existente.
3. Preferir API/documento autorizado e estruturado. Se HTML for única alternativa, registrar fragilidade, frequência tolerada, riscos, fallback e eventual necessidade de autorização. Página/URL não comprova correspondência com outra estação.
4. Realizar uma requisição de baixo volume e segura quando permitido. Guardar somente evidência mínima sanitizada; não inventar payload, datum, nível atual ou histórico. Se houver 403, timeout ou autenticação exigida, marcar **BLOQUEADO** e indicar solicitação oficial.
5. Documentar `source->record->normalization`, risco, critérios de stale, licença de guarda/redistribuição e como reproduzir. Atualizar apenas a issue e a documentação pertinente; não acrescentar mapas automáticos nem previsão.
6. Entrega curta: **FONTE | ID/REFERÊNCIA | ACESSO TESTADO | EVIDÊNCIA | LIMITAÇÕES | PRÓXIMA AÇÃO**.

**STOP:** não coletar em escala/cron sem consentimento e análise de custo/permissão; não ultrapassar rate limits; não tentar burlar acesso autenticado; não misturar INEA e RHN/SGB sem crosswalk; não fazer merge/deploy.
