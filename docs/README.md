# Documentação do Pádua FloodSim

Este diretório concentra a documentação técnica e acadêmica do projeto.

A documentação deve refletir o estado real do repositório e distinguir claramente **implementação atual**, **metodologia experimental**, **dados oficiais/referências externas** e **trabalhos futuros**.

## Ordem recomendada de leitura

### 1. Estado e histórico do projeto

[`PROJECT_REPORT.md`](PROJECT_REPORT.md)

Relatório consolidado da evolução do projeto, desde a criação do repositório até o estado de produção em 05/09/2026. Registra funcionalidades implementadas, correções metodológicas, qualidade, releases, limitações e próximos ciclos.

### 2. Metodologia científica

[`ACADEMIC_METHODOLOGY.md`](ACADEMIC_METHODOLOGY.md)

Documento de referência para o desenho experimental do futuro modelo próprio do FloodSim. Define separação entre observado/processado/derivado/simulado, política de CRS/datum, modelo de cota + conectividade, validação histórica e critérios de conclusão.

### 3. Fontes e proveniência

[`DATA_SOURCES.md`](DATA_SOURCES.md)

Inventário técnico das fontes investigadas ou verificadas para Santo Antônio de Pádua. Contém referências do SGB, INEA, Prefeitura, IBGE, ANA, OSM e literatura acadêmica, além de metadados necessários para uso seguro.

### 4. Arquitetura

[`ARCHITECTURE.md`](ARCHITECTURE.md)

Descreve a arquitetura implementada na V1 e a separação prevista entre aquisição, processamento geoespacial, modelo, classificação, API e visualização.

### 5. Fundação do modelo de inundação

[`FLOOD_MODEL.md`](FLOOD_MODEL.md)

Registra as decisões de modelagem e a relação entre a referência oficial SGB da V1 e o futuro modelo experimental próprio.

### 6. Roadmap

[`ROADMAP.md`](ROADMAP.md)

Mantém as entregas concluídas e as próximas fases: bairros, agregação espacial, DEM/conectividade, validação, INEA e módulos de aplicação.

## Revisões e planos de execução

- [`PR17_REVIEW.md`](PR17_REVIEW.md) — revisão técnica do marco do mapa interativo;
- [`PR17_SONAR_RELIABILITY.md`](PR17_SONAR_RELIABILITY.md) — diagnóstico de Quality Gate do ciclo PR #17;
- [`exec-plans/`](exec-plans/) — planos executáveis usados para conduzir ciclos de implementação.

## Hierarquia de autoridade documental

Quando documentos tratarem do mesmo assunto, usar a seguinte regra:

1. **metodologia científica:** `ACADEMIC_METHODOLOGY.md`;
2. **fonte/proveniência efetivamente verificada:** `DATA_SOURCES.md`;
3. **estado histórico e funcionalidades entregues:** `PROJECT_REPORT.md`;
4. **arquitetura técnica:** `ARCHITECTURE.md`;
5. **planejamento futuro:** `ROADMAP.md`;
6. **documentos de execução/revisão:** `exec-plans/` e relatórios de PR.

Se houver conflito entre conveniência de implementação e a metodologia acadêmica, a restrição científica deve prevalecer ou a divergência deve ser explicitamente documentada.

## Política de manutenção

Ao concluir um marco relevante:

1. atualizar `ROADMAP.md` somente para itens realmente concluídos;
2. atualizar `DATA_SOURCES.md` se uma fonte ou metadado novo foi verificado;
3. atualizar `ARCHITECTURE.md` quando a estrutura implementada mudar;
4. acrescentar o marco ao `PROJECT_REPORT.md` quando houver mudança material de produto, metodologia, dados, qualidade ou release;
5. nunca transformar um plano futuro em fato consumado na documentação;
6. registrar o PR/commit que torna a mudança rastreável.

## Responsabilidade

O Pádua FloodSim é acadêmico e experimental. A documentação não deve apresentar suas simulações ou derivados como substitutos de alertas e orientações emitidos por INEA, Defesa Civil, SGB ou outros órgãos oficiais.
