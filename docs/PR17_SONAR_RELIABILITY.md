# PR #17 — SonarCloud Reliability

Revisão do HEAD `6caa808c8248f6e299396ba8e3f81cbb4464db19`, em 05/09/2026.

## Inventário e diagnóstico

As APIs `issues/search` e `qualitygates/project_status` do projeto
`krrozino_padua-floodsim`, com `pullRequest=17`, identificaram um único issue
aberto de Reliability em código novo. O gate reprovava exclusivamente
`new_reliability_rating=3` (C), exigindo `1` (A).

| Issue | Regra | Local no HEAD revisado | Diagnóstico |
| --- | --- | --- | --- |
| `AaBx7_lr50elM9qDef9g` | `typescript:S6439` | `components/dashboard/FloodDashboard.tsx:206` | Operando numérico em condição JSX com `&&` pode renderizar o próprio número, em vez de ocultar o elemento. |

O inventário completo tinha outros 14 issues abertos, todos de Maintainability,
fora do escopo desta correção. A consulta de Reliability incluindo histórico
retornou também 463 issues já fechados como FIXED, dos módulos MapLibre removidos
do versionamento na revisão anterior; eles não eram bloqueadores ativos.

## Bug potencial versus falso positivo

O padrão apontado é real: React renderiza `0` em `{0 && <span>...</span>}`; o
operador lógico devolve seu operando numérico falsy, não necessariamente `false`.
`NaN` também pode vazar para o conteúdo renderizado. A tabela SGB atual contém
somente valores positivos finitos (82,71–85,21 m), portanto não foi observada
falha nos cenários oficiais atuais. Trata-se de uma fragilidade latente da
condição de apresentação, não de erro nos dados SGB ou de um falso positivo que
justifique suprimir a regra.

## Correção mínima

Substituído `ortometricElevation && (...)` por
`Number.isFinite(ortometricElevation) && (...)`.

A condição passa a retornar sempre um booleano. Valores finitos, inclusive zero,
renderizam o campo formatado; valores indisponíveis ou não finitos não geram
texto numérico solto. Nenhuma altitude, cota, geometria, classificação ou métrica
foi alterada. SGB continua extensão oficial, INEA continua mock/demo e não há
equivalência de régua, cálculo de profundidade ou risco por bairro.

Nenhuma regra, configuração de análise, exclusão ou status de issue foi alterado.
Não foi feito refactor dos issues de Maintainability.

## Verificação

`npm install`, `npm run typecheck`, `npm run build` e `git diff --check` passaram.
`npm run test:e2e`, com `PLAYWRIGHT_CHANNEL=chrome`, passou nos quatro testes.
Uma verificação com `react-dom/server` reproduziu `<div>0</div>` na expressão
original e confirmou a condição corrigida para zero, NaN, undefined e as altitudes
82,71 / 83,96 / 85,21 m. Não foram alterados dados do catálogo para essa verificação.

Após o push, conferir CI, Security e a nova análise do
SonarCloud vinculada ao SHA enviado, incluindo o valor A de Reliability e o
Quality Gate aprovado.

Referência: [SonarCloud — PR #17](https://sonarcloud.io/dashboard?id=krrozino_padua-floodsim&pullRequest=17).
