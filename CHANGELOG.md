# Changelog

Todas as mudanças relevantes do Pádua FloodSim serão registradas neste arquivo.

## [Unreleased] — Research Phase — 2026-10-05

### Documentação e governança

- formalizada a identidade **Monitorar -> Prever -> Traduzir em impacto espacial**;
- criado `docs/PROJECT_CHARTER.md`;
- criada fundação temporal em `docs/FORECAST_MODEL.md`;
- criado plano científico em `docs/ARTICLE_PLAN_RBMET.md`;
- criado protocolo integrado de validação;
- criado registro de experimentos;
- criado ADR da Research Phase;
- criada política de governança GitHub/Notion/Chat/Work;
- criada política de transparência sobre uso de IA;
- iniciado diário formal de pesquisa.

### Escopo científico

- previsão de curto prazo passa a ser frente central de pesquisa;
- UHE Barra do Braúna Jusante (`58788600`) registrada como candidata prioritária de montante com base em trabalhos prévios do SAH-Pomba;
- o desempenho publicado pelo SAH-Pomba passa a ser tratado apenas como benchmark histórico;
- previsão temporal e modelo espacial permanecem desacoplados até validação do crosswalk de referência;
- novas categorias formais: `processed` e `forecast`.

### Segurança

- reforçada a proibição de apresentar o FloodSim como alerta oficial;
- cenários podem apoiar compreensão/preparação, mas não devem emitir comandos de evacuação ou retirada de bens.

## [0.1.0-academic] — 2026-09-23

Primeira versão acadêmica de referência do Pádua FloodSim.

### Incluído

- dashboard web experimental para Santo Antônio de Pádua, RJ;
- mapa interativo com MapLibre GL JS;
- integração das manchas oficiais de inundação do Serviço Geológico do Brasil (SGB) para cotas de 3,00 m a 5,50 m;
- separação explícita entre referência oficial, observado, derivado, mock e simulado;
- documentação de arquitetura, metodologia e modelo de inundação experimental;
- catálogo de fontes e metadados geoespaciais;
- política de autoria, atribuição e proveniência;
- documentação de trabalhos relacionados;
- arquivo `CITATION.cff` com autoria e ORCID;
- validações automatizadas de CI, segurança e integração das camadas SGB.

### Limitações desta versão

- não calcula profundidade real da água;
- não produz previsão de enchente;
- não é sistema oficial de alerta;
- não classifica oficialmente risco por bairro;
- painel INEA permanece separado/mock enquanto a relação entre referências de régua não for validada;
- modelo experimental próprio de cota + conectividade ainda não substitui as manchas oficiais usadas na V1;
- a base topográfica municipal/PAE citada em trabalhos acadêmicos relacionados não está incorporada e permanece pendente de proveniência/autorização.

### Licença

Nesta versão, o código permanece sem licença open source explícita. Dados e materiais de terceiros continuam sujeitos às condições de suas fontes originais.

### Autoria

**Sérgio Izaque Pinheiro Carrozino**  
ORCID: https://orcid.org/0009-0002-8421-2694
