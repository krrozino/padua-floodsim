# Próxima pre-release acadêmica — candidata R01 (Unreleased)

**Status:** notas preparadas, não publicada. Nome de trabalho R01; tag/versão/DOI novos ainda não definidos. Última release publicada: [v0.1.0-academic](https://github.com/krrozino/padua-floodsim/releases/tag/v0.1.0-academic), DOI 10.5281/zenodo.22928810 (conceito 10.5281/zenodo.22928809).

## Escopo da candidata
- Contrato, skills e integração de observações INEA com falha fechada, cache, fonte e timestamps; flag desativada por padrão.
- Pipeline histórico Python e testes determinísticos, inventário/QC/manifestos; EXP-001 exploratório e protocolo EXP-002 sem execução.
- PRs #41–#43 consolidados em #44, baseline a636be70d76c9a5549e3257b2f31aeffa7413253; auditoria adicional #45 pendente de integração.
- 20 testes web unitários, 12 Python, 4 E2E focados, typecheck/build reportados; checks verdes no baseline #44. Revalidar SHA final.
- Nenhuma previsão pública, nenhuma conversão automática INEA–SGB, nenhum cálculo de profundidade real.

## Limitações
Smoke cloud timeout; termos de uso pendentes; inputs locais ausentes; divergências de metadados e picos; sem validação científica final. Manchas SGB oficiais são cenários de referência, não extensão de cheia observada. Sem licença nova implícita para software ou dados.

## Checklist de publicação (#47)
- [ ] Merge autorizado; SHA final e checks.
- [ ] Definir versão, atualizar CITATION.cff e release notes; revisar direitos de artefatos/fixture histórica, sem dados brutos não autorizados.
- [ ] Publicar pre-release autorizada (não equivale a deploy).
- [ ] Depositar versão efetiva em Zenodo quando autorizado; registrar DOI somente após emissão.
- [ ] Homologação operacional separada: permissão, TLS e cache/CDN, estados e smoke; não ativar INEA até aprovação.
