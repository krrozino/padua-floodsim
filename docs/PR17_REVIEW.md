# Revisão independente — PR #17

Data: 05/09/2026. Branch: `fix/interactive-map-v1-agents`.
HEAD revisado: `0fbd97ca29d5c9b61f9c08e979c09b16e848f02c`.

Revisão do diff completo contra `main`: componentes, CSS, documentação, guia/skill,
plano de execução, lockfile, arquivos gerados Next.js e módulos distribuídos MapLibre.
Também foram inspecionados a API SGB, os workflows CI e a política Vercel.
Os documentos exigidos foram lidos antes das alterações.

## 1. BLOCKING

- **Classificação arbitrária de bairros** (`lib/map/neighborhoods.ts`): thresholds por
  bairro geravam cores e afirmações de segurança/risco sem polígonos ou cálculo GIS.
  Removidos thresholds, severidade, rótulos e cores hidrológicas. Os sete pontos
  permanecem neutros, `classification: mock`, `status: temporary_reference_point`.
- **Métricas inventadas** (`FloodDashboard.tsx`, `impactFor`): números variavam com
  a cota sem relação espacial com o SGB. Substituídos por **Indisponível**, com os
  requisitos específicos de limites, ruas e cálculo de área.
- **Mancha artificial** (`FloodMap.tsx`, `buildFallbackFloodData`): usada na primeira
  carga e em falhas; poderia parecer oficial durante loading. Removida. A source
  começa vazia, é limpa a cada consulta e continua vazia em erro ou resposta vazia.
- **Regressão na consulta** (`FloodMap.tsx`, espera por `load`): falhas de tiles/
  recursos impediam até o início do fetch SGB. A consulta agora vive num hook
  independente; `style.load` governa somente a criação das camadas.

## 2. CORRECTNESS / SCIENTIFIC RISK

- **3,00 m não é primeiro dano/atenção.** Texto corrigido para primeiro cenário SGB
  disponível. Grade de 300–550 cm a cada 25 cm preservada, sem interpolação.
- **Cobertura de bairros exagerada.** Agora informa sete nomes pertencentes à lista
  dos 27 oficiais e posições aproximadas, sem pretensão de limites territoriais.
- **Toggles anteriores ao load eram descartados.** Visibilidade começa desativada
  na criação das camadas e é aplicada com o estado React atual após readiness.
- **Respostas antigas e dados ainda em processamento.** AbortController + flag de
  execução ativa protegem mudanças de cota/retry/unmount, inclusive se uma resposta
  não respeitar abort. O cliente valida classificação, cota, nome de camada e
  estrutura de geometria. A camada só aparece após `setData` concluir para os dados
  atuais. O badge não combina a cota anterior com a altitude da seleção nova.
- **Loading sem limite/empty sem distinção.** Timeout de 45 s no cliente e de 30 s
  em cada chamada upstream; estados de erro e vazio oferecem retry. Falhas de
  recursos do mapa têm aviso e botão para recriar o mapa, independentemente do SGB.
- **Popup e listeners.** Callbacks nomeados removidos no cleanup; popup removido ao
  ocultar bairros, recriar ou desmontar o mapa. `setDOMContent` + `textContent`
  substituem HTML interpolado. Não havia entrada hostil conhecida nos nomes locais,
  mas a interpolação era desnecessária.
- **Controles e acessibilidade.** Botões Mapa agora deslocam/focam a seção; foco no
  painel INEA, grupos rotulados, live status, estado dos atalhos, labels de zoom em
  português, texto alternativo dos bairros, heading principal e contraste corrigidos.
  Wording SGB/INEA continua visível em tela móvel; aviso acadêmico está disponível.

## 3. MAINTAINABILITY

- `window._paduaMap` removido. Testes observam mensagens reais de Worker em seu
  próprio contexto, sem um acesso global ao mapa no produto.
- `SGB_STAGE_ELEVATIONS` e a grade de cotas movidos para `lib/sgb/stages.ts`, módulo
  compartilhável sem trazer a aquisição server-side para a UI.
- Workers e shared module do PR correspondiam ao pacote 6.7.0 após normalizar LF/
  CRLF. Removidos do versionamento: `scripts/sync-maplibre.mjs` copia os dois módulos
  e a licença do pacote instalado durante install/dev/build e verifica a versão.
- `next-env.d.ts` é produzido pelo Next 16.3.4; imports gerados preservados. A mudança
  de `tsconfig.json` no PR acrescenta tipos de desenvolvimento, além de formatação;
  foi mantida. `typecheck` executa `next typegen` antes de `tsc`, também em checkout limpo.
- Lockfile conferido: versões de runtime fixadas e resoluções no registry npm.
  Playwright adicionado apenas como dependência de desenvolvimento.

## 4. OPTIONAL

- Hospedar glyphs com proveniência/licença e política de atualização próprias. O
  endpoint externo atual foi mantido; sua falha afeta rótulos, exibe aviso e não
  bloqueia a aquisição SGB. Tiles OSM continuam uma dependência externa atribuída.
- Integrar polígonos de bairros e malha viária validados antes de qualquer impacto.
  Área exige cálculo GIS real em CRS métrico. Esses trabalhos permanecem futuros.
- Ampliar cobertura de navegador para Firefox/WebKit e auditoria manual com leitor
  de tela. Os testes desta revisão usam Chrome/Chromium com WebGL real.

## Semântica final

SGB representa **extensão oficial por cenário**, não profundidade nem previsão.
Nenhum modelo DEM é executado nesta versão. O painel INEA é **MOCK / DEMO**,
com nível, tendência e chuva fictícios, independente do slider SGB. Não há conversão
INEA→SGB, risco de bairro calculado, contagem inventada ou área estimada por fórmula.
As posições de referência não permitem concluir que um bairro está dentro/fora da
mancha. Dados futuros observados e simulados continuam separados da referência oficial.

## Reprodução da validação

```sh
npm install
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
node scripts/validate-sgb.mjs
```

Para usar Chrome instalado: definir `PLAYWRIGHT_CHANNEL=chrome`. Os testes iniciam
`next start` local se necessário. O smoke SGB e o teste de cenários reais precisam
de acesso ao Geoportal. Geometrias sintéticas estão somente nas respostas
interceptadas dos testes de regressão e nunca são servidas pelo aplicativo.

## Resultados da validação

- `npm install`: passou, 73 pacotes auditados, nenhuma vulnerabilidade reportada.
- `npm run typecheck`: passou, incluindo geração de tipos Next antes de `tsc`.
- `npm run build`: passou com Next 16.3.4 / Turbopack.
- Smoke direto SGB: os 11 cenários retornaram uma feição `MultiPolygon` cada.
- Navegador Chrome, build de produção local: carga inicial, 3,00 / 4,25 / 5,50 m,
  pan, zoom, centralização, toggles individuais, popup/fechamento, foco dos botões
  Mapa/Nível do rio e viewport móvel 390 × 844 verificados.
- Quatro testes Playwright cobrem resposta antiga que ignora abort, troca rápida
  3,00 → 4,25 → 5,50, falha de rede, timeout, offline/retry, resposta vazia ou
  incompatível, tiles/glyphs bloqueados, toggles antes dos workers prontos e
  recriação do mapa. Inspeção das mensagens do Worker confirma as geometrias
  aplicadas à source, sem depender apenas do texto do badge.
- Auditoria axe via agent-browser: **zero violações automáticas**; um grupo de
  contraste ficou inconclusivo por sobrepor o canvas/imagem. Capturas desktop e
  móvel foram inspecionadas visualmente; isso não substitui auditoria com leitor
  de tela. Nenhum erro JavaScript reportado no fluxo normal.
- `git diff --check`: passou. Worker/shared gerados idênticos byte a byte ao pacote.

Uma primeira asserção comparava o PNG inteiro do mapa após zoom; ela capturava
mudanças de overlays/antialiasing, e não um defeito de centralização. A verificação
foi corrigida para observar separadamente as camadas e confirmar a volta de um
ponto geográfico distante à sua posição original. Esse teste usa movimento reduzido
para que seus próprios cliques não interrompam a animação de centralização.
O teste de timeout também espera o fetch real antes de avançar o relógio: o estado
loading renderizado no servidor ainda não garante que a hidratação instalou o timer.
As falhas artificiais permanecem restritas ao contexto dos testes.

## Arquivos alterados nas correções

| Área | Arquivos |
| --- | --- |
| Mapa e interface | `components/map/FloodMap.tsx`, `components/dashboard/FloodDashboard.tsx`, `app/globals.css` |
| Domínio e aquisição | `lib/map/neighborhoods.ts`, `lib/sgb/flood.ts`, `lib/sgb/stages.ts`, `lib/sgb/useSgbFlood.ts` |
| Instalação e testes | `package.json`, `package-lock.json`, `.gitignore`, `scripts/sync-maplibre.mjs`, `playwright.config.ts`, `tests/map.spec.ts` |
| Documentação | `README.md`, `docs/ARCHITECTURE.md`, `docs/PR17_REVIEW.md` |
| Removidos do Git; gerados localmente | `public/maplibre/maplibre-gl-worker.mjs`, `public/maplibre/maplibre-gl-shared.mjs` |

Não houve merge nem deploy Vercel; `deploymentEnabled: false` permanece vigente.
