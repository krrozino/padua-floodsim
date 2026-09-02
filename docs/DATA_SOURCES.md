# Fontes de dados

Este documento registra as fontes candidatas e os requisitos de rastreabilidade dos dados usados pelo Pádua FloodSim.

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

## INEA — Alerta de Cheias

Fonte operacional já utilizada localmente para acompanhamento de enchentes.

Página de referência da estação informada para Santo Antônio de Pádua:

`https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.html`

Uso pretendido:

- nível observado do Rio Pomba;
- precipitação disponibilizada pela estação/rede;
- estado/limiares publicados pelo sistema;
- histórico recente, quando disponibilizado.

### Pendências técnicas

- identificar oficialmente o nome e código da estação;
- verificar formato de exportação/endpoint disponível;
- confirmar unidade, datum/referência da régua e metadados;
- documentar política de atualização e uso dos dados;
- não depender de scraping frágil caso exista fonte estruturada.

## Serviço Geológico do Brasil — SGB

Uso pretendido:

- modelos digitais de elevação;
- bases cartográficas;
- produtos de suscetibilidade/inundação existentes;
- relatórios técnicos e cenários publicados para Santo Antônio de Pádua e Rio Pomba.

Esses produtos também poderão servir como referência para validação do modelo experimental.

## ANA

Uso pretendido:

- séries hidrológicas oficiais quando adequadas;
- metadados de estações;
- dados complementares de nível, vazão e precipitação.

## IBGE

Uso pretendido:

- limites administrativos;
- malhas territoriais;
- dados cartográficos auxiliares.

## OpenStreetMap

Pode ser utilizado como fonte complementar para:

- ruas;
- pontes;
- edificações;
- pontos de interesse.

Antes de distribuir derivados, documentar as obrigações da licença ODbL e atribuição.

## Prefeitura / Defesa Civil

Dados locais poderão enriquecer o projeto, por exemplo:

- limites oficiais de bairros;
- registros de ruas alagadas;
- pontos críticos;
- abrigos e equipamentos públicos;
- registros históricos de eventos.

Somente dados obtidos por canal público ou com autorização devem ser versionados/publicados.

## Separação dos tipos de dado

O sistema deve identificar claramente:

### Observado

Leitura recebida de uma estação ou órgão oficial.

### Referência oficial

Mapa, mancha ou cenário técnico publicado por uma instituição.

### Derivado

Resultado de processamento do Pádua FloodSim a partir de dados de origem.

### Mock

Dado fictício usado somente para desenvolvimento da interface.

Essa classificação deve aparecer nos metadados e, quando relevante, na interface.
