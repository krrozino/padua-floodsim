# Changelog

Todas as mudanças relevantes do Pádua FloodSim serão registradas neste arquivo.

## [Unreleased] — R02-B (Plataforma pública funcional) — 2026-11-25

- **Interface pública funcional (Issue #21):** removidos selos de protótipo (`V1`, `em breve`), menu `Alertas`, rótulos técnicos crus em inglês na apresentação pública e todos os dados/cartões fictícios (7 marcadores mock de bairros e métricas `Indisponível` sem cálculo GIS).
- **Navegação real em quatro módulos:** *Mapa e cenários*, *Monitoramento*, *Dados e fontes* (com tabela interativa dos 11 cenários SGB) e *Sobre e metodologia*, responsivos em desktop e celular sem overflow horizontal.
- **Primeira métrica espacial derivada (`derived`):** cálculo geodésico WGS84 com união topológica prévia (`lib/sgb/area.ts`, `polygon-clipping`, método `wgs84-ellipsoidal-geodesic-union-v1`) exibido como **Área da mancha selecionada** (com subtração de anéis internos e eliminação de dupla contagem), omitido automaticamente quando inválido ou vazio.
- **Camada real de estações hidrológicas (`lib/hydro/stations.ts`):** incluídas INEA Santo Antônio de Pádua (`213042120` / `ANA FLU 58774000`) e INEA Ponte Paraoquena (`ANA FLU 58789000`) com popups institucionais; estação RHN `58790002` documentada e omitida do mapa até resolução da divergência de coordenadas (~2,4 km) entre ANA e SGB.
- **Monitoramento INEA e estabilidade do modal:** linguagem simples em português com mensagem objetiva quando a coleta automática está desativada (`FLOODSIM_ENABLE_LIVE_INEA` preservada desligada); corrigido ciclo de vida do `MethodologyModal` para não fechar em re-renders assíncronos do mapa.

## [Unreleased] — R01 / R02-A — 2026-11-25

- Candidata #44 integra #41–#43: contrato, skills, monitoramento INEA (flag desligada), pipeline Python, CI e governança Research. #45 audita acervo INEA, ainda independente.
- Manifestos históricos preservados; EXP-001 exploratório, EXP-002 não executado, reprodução BLOCKED_LOCAL_DATA.
- Vínculo INEA 213042120 / RHN 58774000 identificado na auditoria #45; datum e crosswalk não confirmados. Sem previsão pública.
- [Registro consolidado](docs/research/RESEARCH_CATALOG_2026-11-25.md) e [notas de pre-release](docs/releases/research-r01-unreleased.md); nenhuma tag/DOI/deploy novo.

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
