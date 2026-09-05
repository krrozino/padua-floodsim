# Execution Plan 002 — V1 UX refinement and roadmap sync

Status: active  
Branch: `feat/v1-ux-refinement`  
Issues: #19, #22  

## Objetivo

Refinar a experiência do mapa já aprovado sem alterar a semântica científica atual e sincronizar a documentação com o estado real pós-PR #17.

## Escopo

### 1. Status do cenário SGB

- remover o badge flutuante do centro da área cartográfica;
- integrar a identificação do cenário à região do slider/controles;
- manter sempre visíveis:
  - Serviço Geológico do Brasil — SGB;
  - cota local selecionada;
  - altitude ortométrica publicada para a cota;
  - classificação `official_reference`;
- adicionar acesso discreto a `Fonte e metodologia`.

### 2. Fonte e metodologia

A interface deve conseguir explicar, sem abrir margem para interpretação incorreta:

- que as manchas exibidas são as manchas oficiais publicadas pelo SGB para Santo Antônio de Pádua;
- que existem 11 cenários entre 300 e 550 cm em intervalos de 25 cm;
- que o estudo de referência é `Delimitação da mancha de inundação do rio Pomba na zona urbana de Santo Antônio de Pádua - RJ` (SGB, 2024);
- que a estação usada pelo produto é Santo Antônio de Pádua II, RHN `58790002`;
- que o zero da régua tem altitude ortométrica 79,709 m no datum `hgeoHNOR_IMBITUBA`;
- que a visualização representa extensão de inundação publicada, não profundidade, dano, população afetada ou previsão;
- que o projeto é acadêmico/experimental e não substitui INEA, Defesa Civil ou SGB.

Não duplicar grandes blocos documentais na UI. A interface pode usar um painel/modal curto com link/referência para a documentação interna e fonte primária.

### 3. Layout e controles

- preservar o layout simples e fluido aprovado no teste;
- revisar desktop e mobile;
- manter slider, pan, zoom, centralização, toggles e retry;
- nenhum controle visualmente ativo pode ser morto;
- funções ainda não implementadas devem permanecer claramente desabilitadas ou fora da navegação ativa;
- não introduzir nova página funcional neste plano além do acesso informativo de fonte/metodologia.

### 4. Roadmap

Atualizar `docs/ROADMAP.md` para separar explicitamente:

1. interface/base cartográfica já entregue;
2. referência oficial SGB já integrada;
3. limites oficiais/derivados dos 27 bairros ainda pendentes (#10);
4. sobreposição territorial derivada por bairro ainda pendente (#20);
5. modelo experimental DEM + conectividade ainda pendente (#5/#7/#9);
6. INEA como monitoramento observado futuro, sem equivalência automática com SGB (#6);
7. telas e navegação futuras (#21).

Remover do roadmap qualquer sugestão de que métricas mock, profundidade fake ou criticidade arbitrária sejam entregáveis desejados.

## Fora de escopo

- criar ou alterar a geometria das manchas SGB;
- calcular profundidade;
- calcular risco/dano/impacto por bairro;
- adicionar thresholds manuais de bairro;
- adicionar 20 pontos aproximados apenas para completar a lista de 27 bairros;
- integrar INEA;
- implementar comparação de cenários;
- criar novo modelo DEM;
- mergear ou fazer deploy na Vercel.

## Restrições científicas

- `official_reference`: manchas/cotas/metadados publicados pelo SGB;
- `derived`: somente resultados calculados explicitamente a partir de fontes registradas;
- `observed`: leituras futuras de estações/INEA;
- `mock`: somente demonstração inequívoca, nunca apresentado como resultado espacial real;
- não inferir profundidade a partir das manchas de extensão;
- não converter régua INEA em cota SGB sem crosswalk documentado;
- não atribuir severidade a bairro sem geometria e método validado.

## Critérios de aceite

- status SGB não cobre o centro do mapa;
- fonte, cota local e altitude ortométrica permanecem identificáveis;
- `Fonte e metodologia` é acessível e conciso;
- nenhum dado hidrológico novo é inventado;
- nenhum botão ativo permanece sem ação;
- wording desktop/mobile deixa claro `extensão oficial SGB`, não profundidade/previsão;
- `docs/ROADMAP.md` reflete o estado real e as dependências #10, #19, #20, #21;
- `npm run typecheck` passa;
- `npm run build` passa;
- testes E2E aplicáveis passam;
- Sonar Quality Gate permanece verde.

## Fluxo de agentes

1. Antigravity: implementação UI/UX e validação visual/browser.
2. Codex: revisão independente, regressão, acessibilidade, TypeScript e Sonar.
3. GitHub CI/Security/Sonar.
4. PR permanece draft até revisão concluída.
5. Somente após aprovação: merge em `main` e um deploy manual deliberado.
