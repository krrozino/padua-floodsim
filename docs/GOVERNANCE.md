# Governança do Pádua FloodSim

## Fonte de verdade

### GitHub

É a fonte oficial para:

- código;
- branches, commits, PRs e issues;
- documentação técnica consolidada;
- metodologia científica consolidada;
- fontes de dados verificadas;
- modelos e algoritmos;
- protocolos de validação;
- experimentos reproduzíveis;
- releases e artefatos associados ao software.

### Notion

É a base de trabalho para:

- Research HQ;
- reuniões com a professora;
- diário de pesquisa;
- ideias ainda não aprovadas;
- planejamento semanal;
- leituras e notas bibliográficas;
- perguntas abertas;
- decisões em discussão;
- acompanhamento do artigo.

Quando uma ideia do Notion se torna decisão técnica/científica, ela deve ser consolidada no GitHub.

Regra resumida:

> **Notion pensa; GitHub consolida, versiona e executa.**

## Chat x Work

### Chat

Usar para:

- dúvidas rápidas;
- decisões entre alternativas já conhecidas;
- revisão de issues/PRs;
- planejamento de sprint;
- interpretação pontual de resultado;
- prompts de implementação;
- mensagens e organização;
- pequenas pesquisas e verificações.

### Work

Usar quando houver investigação extensa, multietapas ou multifuente, como:

- revisão bibliográfica ampla;
- levantamento de séries INEA/ANA/SGB;
- investigação da relação Barra do Braúna -> Pádua;
- auditoria de datasets geoespaciais;
- comparação de DEMs;
- análise de eventos históricos;
- experimentação estatística com datasets;
- definição final de metodologia de previsão;
- preparação de revisão científica substancial.

O auxiliar do projeto deve **avisar explicitamente** quando uma tarefa for candidata a Work antes de sugerir seu uso.

## Fluxo de uma ideia

```text
ideia
  |
  v
Notion / conversa
  |
  v
investigação
  |
  v
decisão
  |
  +--> decisão metodológica -> docs GitHub
  |
  +--> implementação -> Issue -> branch -> PR
  |
  +--> experimento -> protocolo -> run -> resultados
```

## Decisões científicas

Mudanças materiais devem registrar:

- problema;
- alternativas;
- decisão;
- justificativa;
- evidência disponível;
- consequências;
- data.

Decisões de grande impacto podem usar ADRs em `docs/decisions/`.

## Experimentos

Cada experimento científico deverá preservar, conforme aplicável:

- identificador;
- pergunta/hipótese;
- datasets e checksums;
- período temporal;
- código/commit;
- parâmetros;
- ambiente/bibliotecas;
- outputs;
- métricas;
- interpretação;
- limitações;
- status: piloto, calibração, validação ou exploratório.

Resultados manuais que não possam ser reproduzidos não devem sustentar afirmações centrais do artigo.

## Git

Não desenvolver diretamente em `main`.

Fluxo esperado:

```text
issue/objetivo
 -> branch focada
 -> validação
 -> PR
 -> revisão
 -> merge
 -> release/deploy quando aplicável
```

Documentação científica também deve seguir PR quando a mudança for material.

## Reuniões de orientação

Registrar no Notion:

- data;
- participantes;
- pontos discutidos;
- decisões;
- dúvidas;
- próximos passos.

Decisões consolidadas devem depois aparecer no GitHub.

## Artigo

O manuscrito poderá ser escrito em ferramenta própria de colaboração, mas:

- metodologia executada;
- fontes;
- parâmetros;
- scripts;
- resultados reproduzíveis;

devem continuar ligados ao GitHub.

## Regra de segurança

Nenhuma pressão de produto deve fazer a interface afirmar mais do que os dados e a validação suportam.

O Pádua FloodSim permanece acadêmico e experimental e não substitui alertas oficiais.
