# Trabalhos relacionados e delimitação da contribuição

Última revisão: **2026-10-05**.

Este documento registra trabalhos anteriores relevantes para o Pádua FloodSim e delimita o que o projeto reivindica como contribuição própria.

## Princípio de originalidade

O Pádua FloodSim **não reivindica originalidade sobre a ideia genérica de estudar, modelar ou mapear inundações em Santo Antônio de Pádua**.

Já existem estudos técnicos e acadêmicos sobre enchentes do Rio Pomba no município. A contribuição do projeto deve ser descrita de forma mais específica: desenvolvimento de uma plataforma computacional interativa, rastreável e reproduzível para integrar fontes geoespaciais, visualizar cenários, comparar resultados e experimentar metodologias simples de inundação.

## Serviço Geológico do Brasil — 2024

**Produto:** Delimitação da mancha de inundação do rio Pomba na zona urbana de Santo Antônio de Pádua - RJ  
**Autores:** Marcos Figueiredo Salviano; Luna Gripp Simões Alves  
**Instituição:** Serviço Geológico do Brasil (SGB)  
**Ano:** 2024  
**URL:** https://rigeo.sgb.gov.br/handle/doc/25035

O produto do SGB é a principal referência oficial da V1 e publica cenários de inundação por cotas locais.

### Relação com o FloodSim

Na V1, o FloodSim atua principalmente como camada computacional e de visualização sobre cenários oficiais, sem apresentar essas manchas como resultado próprio.

Qualquer modelo experimental desenvolvido posteriormente deve permanecer claramente separado das camadas `official_reference`.

## SAH-Pomba — modelos de previsão para Santo Antônio de Pádua

Relatórios técnicos do Serviço Geológico do Brasil/CPRM documentam modelos operacionais/experimentais de previsão no Sistema de Alerta Hidrológico da bacia do Rio Pomba.

### Relatório técnico 2021

O relatório compara dois modelos para Santo Antônio de Pádua. O Modelo 2 utiliza **UHE Barra do Braúna Jusante (58788600)** como variável de entrada e reporta:

- deslocamento de 8 h;
- correlação 0,939;
- MAE ±11 cm;
- PBIAS 0,0%;
- KGE 0,956.

O documento indica esse modelo como preferencial no conjunto avaliado.

Fonte:

https://rigeo.sgb.gov.br/server/api/core/bitstreams/59c0e2b1-8a9e-4898-9c3b-1737d6f71256/content

### Relação com o FloodSim

Isso demonstra que a conexão hidrológica/informacional entre Barra do Braúna e Pádua possui precedente técnico relevante.

O FloodSim **não reivindicará novidade pela simples ideia de usar Barra do Braúna**, nem copiará o desempenho publicado como se fosse próprio.

A contribuição deverá estar em reavaliar, com dados e protocolo reproduzíveis:

- desempenho por múltiplos horizontes;
- baselines modernos e transparentes;
- contribuição incremental de precipitação;
- incerteza;
- integração com representação espacial;
- comunicação pública experimental com rastreabilidade.


## Dissertação de Raul Simiqueli — UFF, 2024

**Autor:** Raul Simiqueli  
**Instituição:** Universidade Federal Fluminense  
**Defesa:** 29/08/2024  
**URL registrada:** https://mcct.uff.br/wp-content/uploads/sites/454/2025/04/Dissertacao-Raul-Simiqueli-defendeu-em-29-08-2024.pdf

A dissertação estudou inundações do Rio Pomba no trecho de Santo Antônio de Pádua com o software IBER, comparação de MDEs e eventos reais.

### Relação com o FloodSim

O trabalho deve ser tratado como **referência acadêmica e metodológica**, não como fonte automática de arquivos de dados.

Quando a dissertação mencionar bases fornecidas pela Prefeitura, PAE ou outra instituição, o FloodSim não deve copiar uma eventual cópia recebida do pesquisador sem esclarecer a origem e as condições de uso. A preferência é obter a mesma base diretamente do provedor original ou mediante autorização documentada.

## Contribuição específica do Pádua FloodSim

A contribuição pretendida inclui:

- arquitetura de software para separar aquisição, processamento, simulação, classificação e visualização;
- rastreabilidade de fonte, CRS, datum, unidade, data de acesso e transformações;
- interface web interativa para exploração de cenários;
- separação explícita entre observado, referência oficial, derivado, mock e simulado;
- experimentação de modelo simples de cota + conectividade hidráulica aproximada;
- futura análise espacial por bairros;
- integração de nível observado sem equivalência indevida entre réguas;
- experimentação de previsão estatística de curto prazo com baselines e informação de montante;
- tradução espaço-temporal de previsões somente após compatibilização de referência;
- protocolo de validação histórica, temporal, espacial e análise de incerteza;
- documentação reproduzível do processo computacional.

## Como apresentar academicamente

Formulação recomendada:

> Trabalhos anteriores já investigaram as inundações e a previsão hidrológica do Rio Pomba em Santo Antônio de Pádua por meio de produtos técnicos oficiais, equações de previsão e modelagem hidrodinâmica. O Pádua FloodSim propõe uma abordagem complementar, centrada na integração reproduzível de monitoramento, previsão estatística, tradução espacial, rastreabilidade e visualização interativa.

Essa delimitação evita alegações excessivas de novidade e torna explícita a contribuição própria do software.
