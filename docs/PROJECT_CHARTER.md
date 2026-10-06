# Pádua FloodSim — Project Charter

**Status:** Research Phase  
**Marco:** 05 de outubro de 2026  
**Escopo:** Santo Antônio de Pádua, RJ, com foco no Rio Pomba  
**Natureza:** projeto acadêmico e experimental de computação aplicada à hidrometeorologia e geoinformação

## Missão

O Pádua FloodSim é uma plataforma acadêmica e experimental para **monitorar, prever e traduzir espacialmente cheias do Rio Pomba** em Santo Antônio de Pádua.

A identidade do projeto é:

```text
MONITORAR -> PREVER -> TRADUZIR EM IMPACTO ESPACIAL
```

O sistema integra, de forma rastreável:

- observações hidrológicas;
- dados pluviométricos;
- informações de regiões a montante;
- modelos estatísticos de curto prazo;
- topografia e dados geoespaciais;
- cenários oficiais de inundação;
- modelos experimentais próprios;
- interface web interativa.

O Pádua FloodSim **não é um sistema oficial de alerta** e não substitui INEA, Defesa Civil, Serviço Geológico do Brasil (SGB), ANA ou outras instituições responsáveis.

## Problema

Uma leitura como "o Rio Pomba está com X metros" é difícil de interpretar espacialmente por quem não acompanha tecnicamente o rio. Além disso, moradores de áreas historicamente afetadas precisam compreender não apenas a condição atual, mas também a possível evolução de uma cheia nas horas seguintes.

O projeto busca responder três perguntas:

1. **Agora:** como está o Rio Pomba neste momento?
2. **Futuro:** qual é a possível evolução do nível nas próximas horas?
3. **Impacto espacial:** o que esses níveis representam geograficamente?

## Objetivo principal 1 — monitoramento espacial

Representar em mapa a situação observada do Rio Pomba em Santo Antônio de Pádua usando dados hidrológicos atualizados e referências espaciais de inundação.

A experiência deverá apresentar, quando tecnicamente disponível:

- nível observado;
- tendência recente;
- horário da última leitura;
- fonte e estação;
- chuva acumulada relevante;
- cenário espacial compatível;
- limitações e incerteza.

Um público importante são pessoas que estão fora de Santo Antônio de Pádua e desejam compreender visualmente a situação do rio na cidade.

### Regra crítica

Uma leitura do INEA não poderá acionar automaticamente uma mancha SGB enquanto a relação entre as respectivas réguas, zeros, estações e referenciais verticais não estiver documentada e validada.

## Objetivo principal 2 — previsão estatística de curto prazo

Desenvolver e avaliar modelos estatísticos capazes de estimar a evolução do nível do Rio Pomba em Santo Antônio de Pádua.

Entradas candidatas incluem:

- nível atual em Pádua;
- variação recente do nível em Pádua;
- níveis e/ou vazões de estações a montante;
- dados da região de Barra do Braúna;
- precipitação local;
- precipitação a montante;
- acumulados pluviométricos;
- outras variáveis hidrometeorológicas cuja utilidade seja demonstrada experimentalmente.

Horizontes iniciais candidatos:

- +1 h;
- +2 h;
- +3 h;
- +4 h;
- +5 h;
- +10 h.

Horizontes adicionais só devem ser incorporados quando houver dados e validação adequados.

Toda previsão deve ser tratada como **estimativa com incerteza**, não como valor futuro garantido.

## Objetivo 3 — tradução espacial da previsão

Converter níveis observados e previstos, somente após compatibilização dos referenciais, em cenários espaciais compreensíveis.

Fluxo conceitual:

```text
dados hidrológicos + chuva
          |
          v
modelo temporal
          |
          v
nível futuro em Pádua
          |
          v
relação nível <-> cota espacial validada
          |
          v
mancha/cenário correspondente
          |
          v
bairros e áreas potencialmente interceptados
```

## Experiência de produto desejada

### Rio agora

Mostrar nível, tendência, fonte, horário e condição de atualização.

### Linha do Rio Pomba

Representar estações relevantes a montante e em Pádua para ajudar a compreender a progressão de um evento.

### Linha temporal

Permitir explorar:

```text
Agora | +1 h | +2 h | +3 h | +4 h | +5 h | +10 h
```

### Previsão com incerteza

Exibir valor central, intervalo/faixa de previsão e desempenho histórico do modelo aplicável ao horizonte.

### Evolução espacial

Atualizar o cenário espacial conforme o horizonte selecionado, sem apresentar precisão espacial que os dados não suportem.

### Bairros

Identificar bairros potencialmente interceptados e calcular métricas espaciais somente com limites territoriais documentados.

### Consulta de local

Permitir consultar um ponto/endereço e verificar sua relação com os cenários. O sistema não deve declarar uma residência definitivamente segura ou insegura.

### Chuva na bacia

Apresentar precipitação relevante em Pádua e a montante, quando houver fonte confiável e temporalmente compatível.

### Explicabilidade

Quando possível, mostrar fatores que contribuíram para a previsão, sem transformar correlação em causalidade não demonstrada.

### Incerteza espacial e temporal

Representar cenários inferior, central e superior ou outra forma metodologicamente justificável de incerteza.

### Eventos históricos

Permitir estudar e reproduzir eventos passados usados para validação.

### Previsto x observado

Preservar previsões emitidas experimentalmente para comparação posterior com o valor observado.

### Pontos de interesse

Avaliar interseção com escolas, unidades de saúde, pontes e outros equipamentos somente a partir de dados geográficos adequados.

### Compartilhamento

Permitir compartilhar estado do mapa com data, hora, fonte, nível e horizonte.

### Acompanhamento de área

Funcionalidade futura. Qualquer notificação deverá ser apresentada como cenário experimental e apontar para fontes oficiais.

## Tipos de informação

Toda informação deve ser classificada, conforme aplicável, como:

- `observed`: medição recebida de fonte/estação;
- `processed`: dado observado transformado/normalizado;
- `official_reference`: produto técnico publicado por instituição;
- `derived`: resultado de processamento espacial;
- `simulated`: saída de modelo espacial experimental;
- `forecast`: estimativa temporal futura de modelo validado;
- `mock`: dado fictício de desenvolvimento.

Categorias diferentes não devem ser apresentadas como equivalentes.

## Segurança e responsabilidade

O sistema não deverá instruir diretamente usuários a:

- evacuar;
- permanecer em uma área;
- retirar móveis ou bens;
- atravessar áreas inundadas;
- considerar uma residência segura;
- substituir uma orientação oficial.

A aplicação pode apoiar **compreensão e preparação**, mas qualquer decisão de emergência deve remeter às autoridades e fontes oficiais.

## Públicos

### Moradores

Compreender a situação atual, tendências e cenários potenciais na região onde vivem.

### Pessoas fora de Pádua

Acompanhar visualmente a situação da cidade e de familiares.

### Pesquisa

Investigar integração de dados hidrológicos, previsão estatística, modelagem espacial e comunicação de incerteza.

## Critério de sucesso científico

O projeto não será considerado bem-sucedido porque uma tela "parece correta". Cada afirmação relevante deve ser apoiada por:

- fonte rastreável;
- parâmetros explícitos;
- processamento reproduzível;
- validação independente;
- métricas adequadas;
- análise de incerteza;
- limitações publicadas.

## Visão de longo prazo

Transformar o Pádua FloodSim em uma plataforma acadêmica aberta e reproduzível para estudar como observações e previsões hidrológicas podem ser convertidas em informações temporais e espaciais compreensíveis sobre as cheias do Rio Pomba.
