# Pádua FloodSim — Arquitetura acadêmica e metodologia

**Versão de referência:** 1.0  
**Data:** 03 de setembro de 2026  
**Escopo:** Santo Antônio de Pádua, RJ  
**Natureza:** projeto acadêmico e experimental de computação aplicada

> Este documento incorpora ao repositório a arquitetura acadêmica produzida no planejamento metodológico do projeto. Ele é a referência científica de alto nível do Pádua FloodSim. O inventário de fontes efetivamente verificadas e utilizadas deve permanecer em `docs/DATA_SOURCES.md`, que pode evoluir à medida que novas fontes específicas de Pádua forem confirmadas.

## Decisão metodológica

O Pádua FloodSim deve iniciar como um sistema de visualização de **cenários potenciais de inundação fluvial**, e não como sistema oficial de alerta nem como modelo hidrodinâmico.

O núcleo recomendado é um modelo raster determinístico de **limiar de cota + conectividade hidráulica aproximada**, calibrado com eventos históricos.

Pergunta científica defensável:

> Dada uma cota de superfície d'água de referência e este terreno, quais células topograficamente acessíveis ao rio podem ficar inundadas?

Esse recorte é executável por estudante, explicável, testável e compatível com dados públicos. O resultado deve exibir fonte, data, datum vertical, resolução, parâmetros e incerteza.

**Nível observado** e **área simulada** são objetos diferentes e não devem ser confundidos.

## 1. Escopo científico e perguntas respondíveis

| Pergunta | O que o MVP permite concluir | O que ele não permite concluir |
| --- | --- | --- |
| Cenários espaciais | Quais áreas conectadas ao Rio Pomba ficam abaixo de uma cota testada. | Profundidade real em cada rua, velocidade da água ou dano esperado. |
| Comparação | Como a extensão simulada muda entre cotas calibradas. | Probabilidade meteorológica de a cota ocorrer. |
| Bairros | Quais polígonos de bairro interceptam a mancha e quanto de sua área é atingido. | Quantidade real de moradores atingidos sem camadas demográficas e validação. |
| Dado INEA futuro | Qual cota a estação reporta e qual cenário calibrado ela aciona. | Alerta operacional independente, previsão ou decisão de evacuação. |

## 2. Arquitetura proposta

A arquitetura mantém dados, processamento e visualização desacoplados. A interface não deve calcular a inundação por conta própria; ela solicita um cenário reproduzível.

| Camada | Responsabilidade | Saídas versionadas |
| --- | --- | --- |
| Aquisição | Baixar e registrar licença, data, CRS/datum e checksum de DEM, hidrografia, limites e observações. | `data/raw/` + `data_catalog.csv` |
| Normalização | Reprojetar, recortar, harmonizar unidades/datum vertical e corrigir nodata. | rasters processados e GeoPackages |
| Terreno/hidrografia | Condicionamento mínimo do DEM, máscara de rio, pontos de conexão e grade de análise. | `terrain/` + metadados |
| Simulação | Aplicar cota, conectividade 8-vizinhos e regras de barreira; gerar máscara, polígonos e estatísticas. | `runs/<id>/` |
| Classificação | Interseção com bairros; classes de impacto baseadas em área/percentual, rotuladas como simuladas. | `neighborhood_impact.geojson` |
| Aplicação | API de cenários e mapa; exibir parâmetros, limitações e observação INEA separadamente. | contratos JSON e UI |

Estrutura mínima desejada do repositório:

```text
data/raw/              # não versionar arquivos pesados
data/processed/
data/catalog/
scripts/acquire/
scripts/preprocess/
src/model/
src/classification/
runs/
docs/
app/
```

Cada execução deve registrar, no mínimo:

- `run_id`;
- commit do código;
- IDs das fontes;
- CRS;
- datum vertical;
- resolução;
- cota;
- conectividade;
- máscara-semente;
- data da execução.

## 3. Dados necessários e política geoespacial

| Conjunto | Uso | Requisito/risco |
| --- | --- | --- |
| DEM primário | Elegibilidade por elevação, drenagem e conectividade. | SRTM 1 arc-second (~30 m) pode ser ponto de partida, mas não é dado urbano fino. Registrar EGM96 e data quando aplicável. |
| DEM alternativo/controle | Teste de sensibilidade e comparação vertical. | TOPODATA/interpolados não criam detalhe novo; usar apenas após avaliação local. |
| Hidrografia e margem | Máscara-semente do Rio Pomba e exclusão de corpos d'água permanentes. | Preferir dado oficial/local; OSM é auxiliar e deve ser conferido. |
| Bairros | Agregação espacial e comunicação. | Prioridade: Prefeitura/Defesa Civil; IBGE geralmente fornece município, não a divisão oficial de bairros. |
| Estações/INEA | Série de nível observado e limiares publicados. | Conservar timestamp, unidade, estação, estado do dado e URL de origem; não raspar sem permissão. |
| Eventos históricos | Calibração e validação. | Fotos geolocalizáveis, marcas d'água, notícias e imagens de satélite têm qualidade desigual e precisam ser qualificadas. |
| Referência vertical | Converter leitura de régua para cota comparável ao DEM. | Maior risco conceitual: leitura da estação não é automaticamente altitude do DEM. |

### Regra de ouro

A análise raster deve usar um **CRS projetado métrico apropriado para a região**, documentado e confirmado. A interface pode servir GeoJSON em WGS84.

Nunca comparar diretamente uma régua local com elevação de DEM em outro referencial vertical sem transformação ou calibração explicitamente documentada.

## 4. Modelo de inundação recomendado: cota + conectividade

Para uma cota de superfície d'água `H`, cada célula `i` é inicialmente elegível quando:

```text
z(i) <= H
```

onde `z` é a elevação do DEM já normalizada.

A mancha final **não** é toda a área elegível. Ela é o componente conectado, por vizinhança de 8 células, às células-semente do Rio Pomba.

A busca pode ser implementada com BFS ou DFS sobre a grade binária.

Esse filtro reduz falsos alagamentos em depressões isoladas.

### Procedimento

1. Preparar o DEM: recortar uma área de estudo fixa, harmonizar CRS/datum, registrar resolução e tratar nodata; manter o raster original imutável.
2. Definir a máscara-semente do rio a partir de hidrografia/margem verificada; dilatar apenas com parâmetro explícito quando a resolução exigir.
3. Para cada `H`, construir a máscara elegível `z <= H`.
4. Aplicar conectividade 8-vizinhos a partir da máscara-semente.
5. Opcionalmente aplicar caminho monotônico controlado: a célula só entra se existir caminho ao rio cujas alturas não excedam `H`; no limiar, isso corresponde à conectividade da máscara elegível.
6. Gerar máscara raster, polígono simplificado para web, área, faixa altimétrica e estatísticas por bairro.
7. Persistir os resultados no diretório da execução; dados e parâmetros iguais devem produzir o mesmo resultado.

### Limitações explícitas

Não usar preenchimento global de depressões como "verdade" sem experimento de sensibilidade, pois isso pode criar conexões artificiais.

Pontes, bueiros, diques, ruas, galerias e obstruções não estarão adequadamente representados em DEM de resolução grosseira. No MVP, a resposta correta é documentar a limitação, e não inventar correções manuais invisíveis.

## 5. Relação estação-rio-terreno: fases

| Fase | Definição | Regra de uso |
| --- | --- | --- |
| A — cota de cenário | `H` é uma cota abstrata/referenciada ao DEM, ajustada manualmente para experimentos. | Pode ser usada no MVP. A régua deve dizer **cota de simulação**, não "nível do INEA". |
| B — curva de tradução | Mapeamento calibrado `h_estacao -> H_dem`, com pares de eventos conhecidos e incerteza. | Só ativar após demonstrar erro aceitável em eventos retidos. |
| C — observação integrada | Cliente lê/apresenta `h_estacao`, timestamp e cenário correspondente pela curva publicada. | Falha ou atraso deve aparecer como indisponível; nunca interpolar silenciosamente. |

Uma primeira curva pode ser:

```text
H_dem = a + b * h_estacao
```

estimada por regressão robusta ou tabela de pares calibrados.

Se não existirem pares confiáveis, manter a integração INEA somente como **painel de observação**, sem conversão automática para inundação.

A calibração deve possuir versão própria e intervalo de confiança.

## 6. Bairros: agregação, não verdade hidrológica

Obter polígonos oficiais de bairros com Prefeitura/Defesa Civil quando possível.

Se não existirem em formato digital, uma camada de trabalho pode ser vetorizada, desde que registre fonte, autor, data, escala e status **provisório**, com validação dos nomes e limites junto ao órgão local.

Não deduzir bairro por ponto central ou por texto de notícias.

| Métrica por bairro | Cálculo | Uso seguro |
| --- | --- | --- |
| Área simulada | `area(mancha ∩ bairro)` | Comparar cenários. |
| Percentual territorial | `area(mancha ∩ bairro) / area(bairro)` | Classificação relativa de impacto espacial. |
| Células/edificações | Somente se houver camada adequada e autorização. | Nunca inferir pessoas ou danos diretamente. |
| Classe visual | Limiar documentado sobre percentual e/ou área. | Rotular como **impacto espacial simulado**, não risco oficial. |

## 7. Validação histórica: protocolo objetivo

A validação é a ponte entre uma demonstração visual e uma contribuição acadêmica.

Selecionar, idealmente, pelo menos **três eventos fluviais históricos** com data, nível/estágio observado ou evidência temporal, e referências espaciais independentes.

Quando possível:

- um evento para ajuste inicial;
- dois eventos retidos para teste.

| Evidência | Como usar | Critério de aceitação inicial |
| --- | --- | --- |
| Fotos/vídeos verificáveis | Geolocalizar ponto ou faixa; codificar água presente/ausente e qualidade da evidência. | A maioria dos pontos "água presente" deve cair na mancha; reportar recall e intervalo de confiança. |
| Mancha de referência | Digitalizar somente com origem, escala e incerteza; comparar raster/polígono. | Reportar IoU, precisão, recall e F1; não usar um único número como prova. |
| Pontos secos | Criar amostra fora da água conhecida para detectar superestimação. | Reportar taxa de falsos positivos e distância ao limite observado. |
| Nível de estação | Associar ao evento e testar a curva de tradução. | Reportar erro absoluto em `H_dem`; aceitar somente dentro de tolerância previamente fixada. |

### Critérios de conclusão por experimento

1. Dados e metadados reproduzíveis.
2. Cenário gerado sem intervenção manual.
3. Métricas calculadas contra referência independente.
4. Comparação com baseline **toda área abaixo da cota**.
5. Análise de sensibilidade.

O modelo conectado deve demonstrar menos falsos positivos que o baseline, sem perda inaceitável de recall.

As metas numéricas finais devem ser definidas após o primeiro evento piloto, pois dependem da qualidade real das referências. Fixar as metas antes da inspeção dos eventos retidos ajuda a evitar ajuste oportunista.

## 8. Experimentos e roadmap acadêmico

| Prioridade | Experimento/entrega | Conclusão objetiva |
| --- | --- | --- |
| P0 | Inventário de fontes + área de estudo + CRS/datum + DEM baseline. | Catálogo completo; script reproduz processado; inspeção de qualidade aprovada. |
| P1 | Simulador de cota com conectividade e exportação por execução. | Mesmo `run_id`/dados/parâmetros produzem a mesma máscara e métricas. |
| P2 | Comparação com baseline abaixo-da-cota em um evento piloto. | Tabela de FP/FN/IoU/recall e mapa de discordâncias publicados. |
| P3 | Dois eventos retidos + sensibilidade de `H`, resolução e semente do rio. | Relatório de generalização e faixas de incerteza. |
| P4 | Bairros oficiais/provisórios validados + regras de agregação. | GeoPackage com proveniência e tabelas por cenário. |
| P5 | Conector INEA somente leitura e curva estação-terreno, se calibrável. | Teste de contrato, timestamp, estado de falha e validação histórica da curva. |
| P6 | Interface comparativa e documentação acadêmica. | Mapa apresenta fonte, parâmetros, limitações e separa observado/processado/simulado. |

**Marco para expansão científica:** P3.

Antes desse marco, a interface deve permanecer uma ferramenta experimental de exploração de cenários.

## 9. Riscos principais e controles

| Risco | Impacto | Controle |
| --- | --- | --- |
| Datum vertical incompatível | Desloca toda a mancha. | Bloquear conversão INEA -> DEM até levantar o datum/zero da régua e calibrar. |
| DEM ~30 m | Não representa microdrenagem, muros e ruas. | Apresentar escala apropriada; testar sensibilidade; buscar levantamento de maior resolução futuramente. |
| Fotos seletivas | Validação enviesada. | Registrar qualidade, incluir pontos secos e separar ajuste de teste. |
| Limites de bairro ruins | Ranking social enganoso. | Fonte oficial; status provisório explícito; validação local. |
| Integração frágil | Dado desatualizado ou silenciosamente errado. | Contrato, cache datado, monitoramento e estado "indisponível". |
| Uso indevido | Usuário interpreta como alerta. | Aviso persistente, sem linguagem operacional e com referência a fontes oficiais. |

## 10. Afirmações permitidas e proibidas

| Permitido após validação | Não permitido sem outro modelo/dados |
| --- | --- |
| "Este cenário simula células topograficamente conectadas ao Rio Pomba abaixo da cota X, usando DEM Y." | "A água chegará a esta rua/hora." |
| "Para os eventos avaliados, o modelo obteve estas métricas sob estas referências." | "O aplicativo prevê enchentes." |
| "A estação reportou nível observado de Z às T; o mapa mostra cenário inferido pela calibração V." | "O nível da estação equivale diretamente à altitude do mapa" sem calibração. |
| "Bairro com maior percentual territorial potencialmente interceptado no cenário." | Número de vítimas, dano ou necessidade de evacuação. |

## 11. Fontes iniciais e trilha de aquisição do planejamento acadêmico

As fontes abaixo são **pontos de partida do documento metodológico original**. Cada download efetivamente utilizado deve entrar no catálogo do projeto com data de acesso, versão, licença, CRS e checksum.

- INEA — página de estação fornecida pelo projeto: `https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.html`
- Sistema de Alerta de Cheias — mapa de estações: `https://alertadecheias.com.br/`
- USGS — SRTM 1 Arc-Second Global: `https://www.usgs.gov/centers/eros/science/usgs-eros-archive-digital-elevation-shuttle-radar-topography-mission-srtm-1`
- NASA/USGS — catálogo SRTM 1 arc-second: `https://cmr.earthdata.nasa.gov/search/concepts/C1220567890-USGS_LTA.html`
- IBGE — mapas municipais: `https://www.ibge.gov.br/geociencias/cartas-e-mapas/mapas-municipais.html`
- INPE — TOPODATA: `http://www.dsr.inpe.br/topodata/`
- Avaliação de acurácia vertical de MDEs no RJ: `https://seer.ufu.br/index.php/caminhosdegeografia/article/download/42221/26614/206152`
- USGS — Flood Inundation Mapping: `https://www.usgs.gov/programs/flood-inundation-mapping-science`

### Relação com o inventário técnico atual

Esta seção preserva a trilha inicial do planejamento acadêmico. **Não é o inventário técnico definitivo.**

Fontes específicas de Santo Antônio de Pádua descobertas e verificadas posteriormente — por exemplo produtos e cenários do SGB — devem ser registradas em `docs/DATA_SOURCES.md` com sua proveniência e metadados próprios, sem reescrever silenciosamente o conteúdo histórico desta seção.

## Conclusão

A contribuição científica mais forte do Pádua FloodSim não é "prever a enchente", mas **testar, documentar e avaliar um método simples de mapeamento de cenários conectado à hidrografia para um problema local**.

O marco que autoriza expansão científica é P3: dois eventos históricos retidos, métricas transparentes e análise de incerteza.

Até lá, a interface deve permanecer uma ferramenta experimental de exploração de cenários.