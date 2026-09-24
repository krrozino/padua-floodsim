# Política de autoria, atribuição e proveniência

Última revisão: **2026-09-23**.

## Objetivo

Estabelecer uma trilha verificável para autoria do software e para a origem de todos os dados empregados pelo Pádua FloodSim.

## Autoria do software

A autoria deve ser demonstrável por artefatos versionados, especialmente:

- histórico Git;
- commits;
- pull requests;
- issues;
- documentos metodológicos;
- tags/releases;
- `CITATION.cff`.

Contribuições futuras de terceiros devem ser registradas no Git e creditadas de acordo com sua participação efetiva.

## Unidade mínima de proveniência

Todo dataset ou artefato derivado incorporado ao projeto deve registrar, quando aplicável:

- identificador interno;
- título;
- instituição/provedor original;
- autores, quando houver;
- URL de origem;
- data de acesso;
- versão/data da fonte;
- classificação: `observed`, `official_reference`, `derived` ou `mock`;
- CRS horizontal;
- datum vertical;
- unidade;
- resolução/escala;
- licença ou condição de uso;
- permissão de redistribuição;
- checksum do arquivo bruto, quando armazenado localmente;
- script/commit que produziu o derivado;
- limitações conhecidas.

## Regra de aquisição

A fonte original deve ser preferida à cópia intermediária.

Exemplo: se uma dissertação utilizou uma base fornecida pela Prefeitura, a dissertação pode ser citada como referência metodológica, mas a base deve ser solicitada à Prefeitura ou utilizada apenas após confirmação explícita das condições aplicáveis.

## Regra de redistribuição

Um dataset só pode ser colocado em área pública do repositório quando sua licença ou autorização permitir essa forma de redistribuição.

Quando a situação for incerta:

- manter apenas metadados, URL e instruções de aquisição;
- não versionar o arquivo bruto;
- marcar o estado como `license_pending` ou equivalente;
- resolver a pendência antes de release acadêmica que inclua o dado.

## Derivados

Transformar um dado não apaga sua origem.

Todo derivado deve apontar para:

`fonte original -> etapa(s) de processamento -> artefato derivado`.

Quando a licença da fonte impuser atribuição ou condições sobre obras derivadas, essas condições devem acompanhar o artefato.

## Publicações e apresentações

Ao apresentar resultados:

- creditar as fontes próximas ao mapa/tabela quando materialmente relevantes;
- não chamar mancha oficial do SGB de "simulação do FloodSim";
- não apresentar dado de estação como resultado próprio;
- identificar resultados calculados pelo projeto como simulados/derivados;
- citar trabalhos acadêmicos utilizados na metodologia;
- informar versão/tag/commit do FloodSim usado para gerar o resultado.

## Release acadêmica

Antes de criar uma release destinada a apresentação, evento ou publicação, confirmar:

1. `CITATION.cff` atualizado;
2. autoria acadêmica completa, se disponível;
3. fontes e licenças registradas;
4. nenhum dataset de redistribuição incerta incluído;
5. versão/tag definida;
6. documentação de limitações atualizada;
7. separação entre oficial, observado e simulado preservada.
