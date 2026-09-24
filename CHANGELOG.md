# Changelog

Todas as mudanças relevantes do Pádua FloodSim serão registradas neste arquivo.

## [0.1.0-academic] — planejada para 2026-09-23

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
