# Fontes de dados

Este documento registra as fontes escolhidas/candidatas e os requisitos de rastreabilidade dos dados usados pelo Pádua FloodSim.

Última revisão: **2026-09-02**.

## Regras

Todo dataset incorporado ao projeto deve registrar, quando aplicável:

- instituição responsável;
- nome do dataset/estação;
- URL de origem;
- data de acesso;
- período coberto;
- frequência de atualização;
- sistema de referência de coordenadas (CRS);
- datum vertical, quando houver elevação ou nível d'água;
- unidade de medida;
- licença/condições de uso;
- limitações conhecidas.

Também deve ser classificado como `observed`, `official_reference`, `derived` ou `mock`.

---

## 1. Serviço Geológico do Brasil — manchas oficiais de inundação (fonte primária V1)

### Relatório técnico

**Produto:** Delimitação da mancha de inundação do rio Pomba na zona urbana de Santo Antônio de Pádua - RJ  
**Instituição:** Serviço Geológico do Brasil (SGB)  
**Data:** setembro de 2024  
**Autores:** Marcos Figueiredo Salviano; Luna Gripp Simões Alves  
**URL:** https://rigeo.sgb.gov.br/handle/doc/25035  
**Relatório:** https://rigeo.sgb.gov.br/bitstream/doc/25035/1/relatorio_sa_padua.pdf  
**Classificação:** `official_reference`

O estudo produziu manchas para **11 cotas locais**, entre **300 cm e 550 cm**, em intervalos de **25 cm**:

| Cota local | Altitude ortométrica | Vazão publicada |
|---:|---:|---:|
| 300 cm | 82,71 m | 624 m³/s |
| 325 cm | 82,96 m | 728 m³/s |
| 350 cm | 83,21 m | 839 m³/s |
| 375 cm | 83,46 m | 957 m³/s |
| 400 cm | 83,71 m | 1.080 m³/s |
| 425 cm | 83,96 m | 1.210 m³/s |
| 450 cm | 84,21 m | 1.346 m³/s |
| 475 cm | 84,46 m | 1.488 m³/s |
| 500 cm | 84,71 m | 1.636 m³/s |
| 525 cm | 84,96 m | 1.789 m³/s |
| 550 cm | 85,21 m | 1.948 m³/s |

O relatório também apresenta cenários por tempo de retorno de 2, 5, 10, 15, 20, 50 e 100 anos.

### Referência vertical e estação usada pelo SGB

**Estação fluviométrica:** Santo Antônio de Pádua II  
**Código RHN:** `58790002`  
**Altitude ortométrica do zero da régua:** **79,709 m**  
**Datum vertical:** `hgeoHNOR_IMBITUBA`

Cotas de referência publicadas no relatório:

- atenção: **240 cm**;
- alerta: **275 cm**;
- inundação/primeiro dano: **310 cm**.

A maior cota registrada citada no relatório foi **431 cm em 08/01/2023**.

### MDE/modelagem usada pelo estudo de 2024

O estudo informa:

- levantamento da superfície seca com VANTE;
- resolução original de **10 cm**, posteriormente reamostrada para **10 m**;
- sistema horizontal: **SIRGAS 2000 / UTM zona 23S**;
- datum vertical: **hgeoHNOR_IMBITUBA**;
- topografia do canal construída a partir de **60 seções batimétricas** medidas com ADCP;
- interpolação do canal por IDW;
- modelagem com **HEC-RAS 6.5 Beta**;
- escoamento tratado no estudo como retilíneo, uniforme e unidimensional;
- Manning calibrado em **0,025** no canal principal e **0,050** nas margens.

Essas informações tornam o produto de 2024 nossa principal referência técnica para a V1.

### Geoportal SGB — serviço GIS público

**Serviço:** `hidrologia/mancha_santo_antonio_de_padua`  
**URL base:** https://geoportal.sgb.gov.br/server/rest/services/hidrologia/mancha_santo_antonio_de_padua/MapServer  
**Grupo MODELAGEM:** https://geoportal.sgb.gov.br/server/rest/services/hidrologia/mancha_santo_antonio_de_padua/MapServer/2  
**Classificação:** `official_reference`

O serviço publica as subcamadas:

- `COTA_300cm`;
- `COTA_325cm`;
- `COTA_350cm`;
- `COTA_375cm`;
- `COTA_400cm`;
- `COTA_425cm`;
- `COTA_450cm`;
- `COTA_475cm`;
- `COTA_500cm`;
- `COTA_525cm`;
- `COTA_550cm`;
- camadas por tempo de retorno.

Metadados expostos pelo serviço:

- CRS: **EPSG:4674 — SIRGAS 2000**;
- formatos de consulta suportados: **JSON, GeoJSON e PBF**;
- extensão publicada do grupo:
  - xmin: `-42.20900097927306`;
  - ymin: `-21.553311556725685`;
  - xmax: `-42.14556243623249`;
  - ymax: `-21.51245633890636`.

### Decisão de arquitetura

A **primeira versão geográfica real** deve priorizar o consumo/espelhamento controlado dessas manchas oficiais, em vez de apresentar imediatamente uma mancha própria como se tivesse a mesma confiabilidade.

O modelo topográfico experimental do projeto continuará existindo para pesquisa, comparação e geração de profundidade, mas será claramente separado da camada `official_reference`.

### Pendência

O grupo do serviço exibe um nome `TR_055anos`, enquanto o relatório técnico lista tempo de retorno de **5 anos** e não de 55 anos. Antes de expor cenários de tempo de retorno na aplicação, verificar os IDs/metadados das subcamadas individualmente e resolver essa inconsistência nominal.

---

## 2. SGB/CPRM — carta de suscetibilidade de 2015

**Produto:** Carta de suscetibilidade a movimentos gravitacionais de massa e inundação: município de Santo Antônio de Pádua - RJ  
**Instituição:** CPRM / Serviço Geológico do Brasil  
**Ano:** 2015  
**URL:** https://rigeo.sgb.gov.br/handle/doc/15089  
**Acesso:** aberto  
**Escala do mapa:** 1:60.000  
**Classificação:** `official_reference`

Pacote publicado:

- `CS-StoAntonioDePadua.pdf` — 22,7 MB;
- `sig_santoantoniodepadua_rj.zip` — 215,36 MB;
- `bc_santoantoniodepadua_rj.zip` — 8,32 MB;
- `ortofotossantoantoniodepadua_rj.zip` — 139,26 MB;
- `produtos_mde_santoantoniodepadua_rj.zip` — 212,34 MB;
- `license.txt` — licença específica do pacote.

Uso pretendido:

- relevo/topografia complementar;
- base cartográfica;
- hidrografia;
- ortofotos para conferência visual;
- comparação com o produto hidrológico de 2024.

### Pendências antes de incorporar arquivos do pacote

- inspecionar `license.txt` integralmente;
- inventariar arquivos internos;
- registrar CRS de cada camada;
- registrar resolução e tipo exato dos produtos MDE;
- não versionar ZIPs grandes diretamente no Git sem necessidade.

---

## 3. Prefeitura — bairros oficiais

### Lei municipal nº 3.864/2017

**Fonte:** Prefeitura Municipal de Santo Antônio de Pádua  
**Documento:** Lei nº 3.864, de 27 de dezembro de 2017 — Planta Genérica de Valores  
**URL:** https://santoantoniodepadua.itcast.com.br/portal/arquivo/1/2017/12-dezembro/lei_sancionada_no_3.864-17.pdf  
**Classificação:** `official_reference`

O Anexo VI e a ata da comissão registram **27 bairros** e informam que seus limites constam na PGV.

### Margem direita do Rio Pomba

1. Aeroporto
2. Alípio
3. Arraialzinho
4. Café Garoto
5. CEHAB
6. Cidade Nova
7. Dezessete
8. Farol
9. Gabri
10. Glória
11. Monte Líbano
12. Parque das Águas
13. Santa Afra
14. São Félix
15. São Luis
16. Sardemberg

### Margem esquerda do Rio Pomba

17. Alequicis
18. Barro Branco
19. Carvalho
20. Centro
21. Divinéia
22. Ferreira
23. Industrial
24. Jorimpa
25. Mirante
26. Pereira
27. Tavares

> Nota: o texto extraído do Anexo VI contém alguns erros tipográficos (`FERRERIRA`, `PERERIRA`), enquanto a ata posterior apresenta `FERREIRA` e `PEREIRA`. O projeto deve usar a grafia validada na documentação municipal e manter rastreabilidade dessa normalização.

### Situação dos polígonos

A fonte municipal confirma a existência e a nomenclatura oficial dos bairros, mas ainda não foi localizado um download vetorial público dos limites.

Estratégia:

1. procurar arquivo vetorial público da PGV/Plano Diretor;
2. se inexistente, solicitar à Prefeitura/Secretaria responsável;
3. somente em último caso, georreferenciar/digitalizar o mapa oficial e marcar o resultado como `derived`.

Não usar limites de bairros de fontes comerciais como referência oficial.

---

## 4. Prefeitura — Plano Diretor e saneamento

### Plano Diretor 2018

Página pública com mapas M1–M6:

https://santoantoniodepadua.rj.gov.br/portal/arquivo/1/2018/11-novembro

Pode auxiliar na conferência de:

- perímetro urbano;
- sistema viário;
- macrozoneamento;
- núcleos urbanos.

### Plano Municipal de Saneamento Básico

A Prefeitura publica mapas e relatórios técnicos da sede urbana, incluindo setores censitários e redes de infraestrutura.

Exemplo de mapa de setores censitários da sede urbana:

https://www.santoantoniodepadua.rj.gov.br/portal/arquivo/36/2024/volume_1_relatorio_tecnico_preliminar_rtp/tomo_iv_n_desenho/setores_censitarios_-_sede_urbana.pdf

Esses produtos são auxiliares; não substituem os limites oficiais de bairros.

---

## 5. IBGE — limites administrativos

**Produto:** Malha Municipal Digital 2024  
**Instituição:** IBGE  
**URL de referência:** https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/15774-malhas.html  
**Classificação:** `official_reference`

Uso pretendido:

- limite municipal;
- distritos/setores quando aplicável;
- recorte e validação espacial.

O IBGE não será presumido como fonte de limites dos 27 bairros municipais sem confirmação específica do produto.

---

## 6. OpenStreetMap — ruas, pontes e pontos de interesse

**Classificação:** `official_reference` não; utilizar como **fonte cartográfica colaborativa complementar**.

Uso pretendido:

- eixos de ruas;
- pontes;
- edificações;
- equipamentos/pontos de interesse.

Requisitos:

- registrar data de extração;
- manter atribuição;
- respeitar a licença ODbL;
- validar manualmente estruturas críticas como pontes e acessos antes de gerar métricas públicas.

---

## 7. INEA — Alerta de Cheias

**Página utilizada localmente:**  
https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.html  
**Classificação pretendida:** `observed`

A página oferece, no mínimo:

- leituras de nível do rio;
- chuva acumulada em 15 min, 1 h, 4 h, 24 h e 96 h;
- histórico recente em passos de aproximadamente 15 minutos;
- exportação para Excel;
- exportação para XML;
- cota de transbordamento apresentada pela página: **5,00 m**.

### Regra crítica: não converter diretamente INEA -> manchas SGB

O produto SGB de 2024 trabalha com a estação `58790002`, cujo zero de régua e datum vertical são documentados, e aponta primeiro dano em 310 cm. A página do INEA apresenta uma cota de transbordamento de 5,00 m.

Esses números **não devem ser tratados como a mesma régua/referência** até que a estação do INEA, seu zero de régua e a relação com a estação SGB sejam identificados e validados.

Portanto, é proibido no código fazer algo equivalente a:

```text
nivel_inea_5_00m -> COTA_500cm_SGB
```

sem uma transformação documentada.

### Pendências técnicas

- identificar nome/código oficial da estação INEA `21304212020`;
- verificar endpoint/XML estruturado;
- registrar datum/referência da régua;
- comparar séries simultâneas INEA x SGB/ANA para determinar se existe relação simples entre as leituras;
- documentar política de atualização e indisponibilidade.

---

## 8. ANA

Uso pretendido:

- metadados de estações da Rede Hidrometeorológica Nacional;
- séries históricas de nível/vazão/chuva quando adequadas;
- curva-chave e informações complementares da estação `58790002`, quando públicas.

A ANA também é citada pelo estudo de 2024 como responsável por viabilizar a operação da estação hidrológica usada pelo SGB.

---

## 9. Referência acadêmica complementar

Uma dissertação de 2024 da UFF analisou inundações do Rio Pomba no trecho de Santo Antônio de Pádua com o software IBER e diferentes MDEs.

**Título/arquivo:** dissertação de Raul Simiqueli (defesa em 29/08/2024)  
**URL:** https://mcct.uff.br/wp-content/uploads/sites/454/2025/04/Dissertacao-Raul-Simiqueli-defendeu-em-29-08-2024.pdf

Informações úteis para pesquisa:

- comparação de diferentes MDEs;
- uso do Copernicus GLO-30;
- modelagem com dados reais de eventos de janeiro de 2022 e 2023;
- dados topográficos municipais/PAE citados como fonte de melhor ajuste em parte da pesquisa.

Esta fonte serve como **referência metodológica**, não como substituição dos produtos oficiais do SGB/Prefeitura.

---

## Área de interesse inicial (AOI)

### AOI hidráulica inicial

Usar inicialmente a extensão publicada pelo serviço oficial de manchas do SGB:

```text
xmin = -42.20900097927306
ymin = -21.553311556725685
xmax = -42.14556243623249
ymax = -21.51245633890636
CRS  = EPSG:4674 (SIRGAS 2000)
```

Essa área cobre o trecho urbano mapeado pelo produto oficial.

### AOI de contexto do mapa

Para interface, ruas, bairros e relevo, trabalhar com um pequeno buffer ao redor da AOI hidráulica. O buffer final deve ser definido no pipeline GIS em unidades métricas após reprojeção para SIRGAS 2000 / UTM 23S.

---

## Estratégia de armazenamento

Evitar colocar dados brutos grandes diretamente no Git.

Estrutura sugerida:

```text
data/
  raw/          # ignorado pelo Git; downloads originais
  interim/      # ignorado pelo Git; reprojeções/recortes
  processed/    # somente artefatos pequenos necessários ao front
  metadata/     # manifests versionados
```

Todo artefato processado deve carregar metadados suficientes para reproduzir sua origem.

---

## Separação dos tipos de dado

### Observado (`observed`)

Leitura recebida de uma estação ou órgão oficial.

### Referência oficial (`official_reference`)

Mapa, mancha ou cenário técnico publicado por instituição responsável.

### Derivado (`derived`)

Resultado de processamento do Pádua FloodSim a partir de dados de origem.

### Mock (`mock`)

Dado fictício usado somente para desenvolvimento da interface.

Essa classificação deve aparecer nos metadados e, quando relevante, na interface.
