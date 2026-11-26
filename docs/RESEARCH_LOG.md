# Diário de pesquisa — Pádua FloodSim

Este arquivo registra marcos científicos consolidados. Anotações detalhadas de reuniões e ideias podem permanecer no Notion; decisões formais devem chegar ao GitHub.

## 2026-10-05 — início da Research Phase

### Contexto

Após conversa de orientação, foi discutida a preparação do Pádua FloodSim como base para trabalho científico e possível artigo na Revista Brasileira de Meteorologia.

### Objetivos principais definidos

1. **Monitoramento espacial em tempo próximo do real:** usar dados hidrológicos observados, inicialmente com atenção ao INEA, para permitir que pessoas dentro ou fora de Pádua compreendam visualmente a situação do Rio Pomba por meio de uma referência espacial compatível.

2. **Previsão estatística de curto prazo:** investigar se nível do rio, chuva e dados a montante — especialmente no trecho de Barra do Braúna até Santo Antônio de Pádua — permitem prever subida/descida e níveis futuros em horizontes como 1, 2, 3, 4, 5 e 10 horas.

3. **Tradução em impacto espacial:** depois de validar a cadeia nível -> referência espacial, representar bairros e áreas potencialmente interceptadas pelos cenários.

### Segurança de uso

A motivação social inclui ampliar o tempo disponível para preparação de moradores. Entretanto, o sistema experimental não deverá emitir comandos como "evacue" ou "retire seus móveis". Resultados serão cenários experimentais e deverão apontar para fontes oficiais.

### Nova identidade

```text
MONITORAR -> PREVER -> TRADUZIR EM IMPACTO ESPACIAL
```

### Referência técnica relevante

O SAH-Pomba já avaliou relação entre a estação UHE Barra do Braúna Jusante (58788600) e Santo Antônio de Pádua. Relatório técnico de 2021 documenta, para o modelo preferencial daquele estudo, deslocamento de 8 h, correlação de 0,939, MAE de ±11 cm, PBIAS 0,0% e KGE 0,956.

O FloodSim tratará isso como benchmark e hipótese de pesquisa, não como desempenho transferível automaticamente.

### Governança

Foi estabelecido:

- GitHub = fonte técnica/científica consolidada;
- Notion = Research HQ, reuniões, ideias, leituras e gestão;
- Chat = dúvidas e decisões rápidas;
- Work = investigações extensas/multietapas, com aviso prévio sobre quando vale utilizá-lo.

### Próximos blocos de pesquisa

- identificar e compatibilizar estações/referenciais;
- auditar disponibilidade histórica de séries;
- investigar Barra do Braúna -> Pádua;
- levantar precipitação útil na bacia;
- preparar protocolo de previsão;
- manter modelo espacial e benchmark SGB como frente paralela.

## 2026-11-17 a 25 — R01 e R02-A

Contrato e skills (#41), observação INEA (#42), pipeline/QC/piloto (#43), candidata integrada (#44) e auditoria de acervo (#45). Ver [registro consolidado](research/RESEARCH_CATALOG_2026-11-25.md). Checks da candidata verdes no baseline; dados reais, permissões e reprodução continuam gates separados. Relatório Gemini de 59 páginas catalogado como apoio bibliográfico não validado integralmente. Estratégia proposta: manter INEA independente e investigar referência RHN para ligação espacial; comparar Braúna e Cataguases; nenhuma transformação automática. Próximas ações #6, #37, #38, #46, #47. Não houve merge/deploy nesta rodada.

## 2026-11-25 — R02-B (Plataforma pública funcional, Issue #21)

Interface pública consolidada na branch `feat/research-r02-public-platform` (baseada em `integration/research-r01` / #44): eliminados elementos de protótipo, botões "em breve" e todos os marcadores/métricas mockadas de bairros e ruas. Implementadas quatro seções funcionais (*Mapa e cenários*, *Monitoramento*, *Dados e fontes* e *Sobre e metodologia*), camada real de estações hidrológicas verificadas (INEA Santo Antônio de Pádua `213042120` / `58774000` e Ponte Paraoquena `58789000`, com RHN `58790002` omitida do mapa por divergência cadastral de ~2,4 km) e cálculo derivado da **Área da mancha selecionada** (aproximação numérica em latitude autálica WGS84 com união topológica prévia via `polygon-clipping`, com falha fechada estrita em coleções/anéis inválidos ou degenerados). Validação numérica independente com `pyproj 3.8.0` / `shapely 2.2.0` nas 11 camadas reais SGB (`300`–`550` cm, ver [SGB_AREA_VALIDATION_2026-11-25.md](research/SGB_AREA_VALIDATION_2026-11-25.md)) confirmou diferença máxima de `0,003 m²` (`< 0,000001%`) contra Karney WGS84 e `-0,131%` contra `EPSG:31983` (UTM 23S, explicada pelo fator de escala). Monitoramento INEA preservado independente e desativado por padrão; bug de ciclo de vida do modal de metodologia corrigido e coberto por teste E2E. Sem merge ou deploy.

## 2026-11-25 — Integração na `main`, correção do Quality Gate (#38) e preparação da candidata `v0.2.0-academic` (#47)

Após o merge dos PRs #41–#45 e #48 na `main` (`ced6c02`), a análise SonarCloud da `main` reprovou o Quality Gate em *Security Rating on New Code = C* devido a 3 vulnerabilidades de supply chain em GitHub Actions (`githubactions:S7637` em `.github/workflows/security.yml:25` — `gitleaks/gitleaks-action@v2` sem commit SHA; `githubactions:S6505` e `githubactions:S8543` em `.github/workflows/ci.yml:23` — `npm install` sem travamento por lockfile e sem `--ignore-scripts`). Corrigidas na branch `fix/research-release-quality-gate` fixando `gitleaks/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7` (`v2.3.9`) e migrando o CI para `npm ci --ignore-scripts --no-audit --no-fund` com `permissions: contents: read`. Preparada a candidata `v0.2.0-academic` (`package.json`, `package-lock.json`, `CITATION.cff` com DOI conceitual `10.5281/zenodo.22928809` sem atribuir o DOI da `v0.1.0-academic`, e notas em [`docs/releases/v0.2.0-academic.md`](releases/v0.2.0-academic.md)). Publicação da tag/release permanece condicionada ao Quality Gate verde pós-merge na `main` e autorização explícita; deploy em produção continua separado (`vercel.json`: `"deploymentEnabled": false`) e coleta INEA permanece desativada por padrão.

## 2026-11-25 — R02-C (Comparação interativa de cenários SGB e curva cota × área, Issue #50)

Implementada na branch `feat/research-r02-scenario-comparison` (base `main` `7e2c4e6`) a ferramenta interativa de comparação entre os 11 cenários oficiais SGB (`Cota de referência SGB — Pádua II (58790002)`). O motor topológico (`lib/sgb/compare.ts`, método `wgs84-ellipsoidal-topological-overlay-v1`) calcula $A \cap B$, $A \setminus B$ e $B \setminus A$ via `polygon-clipping@0.15.7` sobre as geometrias reais consultadas, sem pressupor aninhamento, validando as identidades de conservação de área com tolerância justificada (`max(1 m², 0,01% × área)`) e falha fechada. Durante validação sobre camadas reais do SGB, o par `450 × 525` cm (duas camadas com `Ring Self-intersection` bruto) disparou erro de montagem de anel por 1 ULP (`~5e-15` deg) em `polygon-clipping`; adicionado fallback determinístico de snap-rounding (`1e-11`–`1e-9` deg, ~1 µm–0,1 mm), mantendo a verificação de conservação frente às áreas originais sem snap (`erro <= 0,000171 m²` em todos os pares reais testados: `300×300`, `300×425`, `300×550`, `450×525`, `525×550`, `550×300`). O gráfico interativo de área por cota (`ScenarioAreaChart.tsx`) consome o snapshot catalogado em `lib/sgb/areaCatalog.ts` com hashes SHA-256 de `SGB_AREA_VALIDATION_2026-11-25.md` (evitando 11 requisições na abertura) e sinaliza divergência de área em relação ao catálogo frente à geometria consultada (explicitando que áreas equivalentes não comprovam geometrias idênticas). Verificação cartográfica pontual de `COTA_300cm` (#7, #9) confirmou preservação integral do payload oficial (SHA-256 `100cd53b4ca6be2abf33fbefd9c0701c6765cc3bd609dead7e82cf3442be394f`, `755.946` bytes, `18.085` vértices) sem suavização, deslocamento ou recorte artificial; limites oficiais preservados intactos. Limitação registrada como melhoria futura: a sobreposição topológica executa na thread principal do navegador (~1,3–3,1 s em camadas SGB completas), podendo causar pausa perceptível em dispositivos modestos (migração para Web Worker fora do escopo desta rodada). Sem merge, deploy ou ativação INEA.

## 2026-11-25 — R02-D (Consulta geográfica, análise entre cotas e estudo de exposição viária, Issue #51)

Implementada na branch `feat/research-r02-location-query` (PR `#56`, base `main` `63f191b`) a consulta geográfica funcional sobre os cenários oficiais SGB (`lib/sgb/location.ts`, `lib/sgb/crossStageQuery.ts`, `lib/sgb/useCrossStagePointQuery.ts`, `LocationQueryCard.tsx` e marcador georreferenciado em `FloodMap.tsx`). O motor reutiliza a validação com falha fechada de `lib/sgb/area.ts`, suporta `Polygon`, `MultiPolygon` e anéis internos (buracos), distingue ortogonalmente posição frente ao **envelope retangular auxiliar do MapServer SGB** (`within_mapserver_envelope` / `outside_mapserver_envelope`), **domínio hidráulico** (`unknown` por padrão dentro do bbox auxiliar — harmonizado com R02-F / PR `#55`, pois o bbox não comprova cobertura hidráulica integral — ou `outside_model_extent` / `covered` apenas com polígono validado) e relação com a geometria consultada (`interior`, faixa de proximidade geométrica de fronteira `±0,5 m`, `fora` e `indisponível`). A tolerância de `±0,5 m` é explicitada como **faixa de proximidade geométrica** (e não precisão física da inundação) nos resultados individuais, na comparação A/B, na menor cota identificada e no resumo técnico copiado. A análise nas 11 cotas oficiais executa **somente sob demanda** (zero requisições extras na abertura), com cache em memória, concorrência limitada (`<= 3`), progresso e cancelamento contra respostas fora de ordem — sem interpolação, sem pressupor aninhamento e distinguindo a menor cota identificada entre os cenários consultados do início real de inundação. Benchmark sobre camadas reais SGB (`COTA_300cm`..`COTA_550cm`, até `1,44 MB`) registrou `4,55–9,17 ms/ponto`, descartando necessidade de Web Worker para consulta pontual. A investigação de geocodificação pública resultou em **`NO-GO`** para a UI pública (limites de uso de Nominatim/Photon incompatíveis com autocomplete e ambiente serverless + apenas `25` `addr:housenumber` no OSM da AOI), priorizando clique + coordenadas com resumo técnico copiável sem endereço pessoal. Para exposição viária, foi implementado e validado independentemente o motor `lib/sgb/roads.ts` (`wgs84-geodesic-line-clip-v1`, diferença `0,000 km` frente a `shapely 2.2` / `pyproj 3.8` em `COTA_300cm` `1,765 km`, `COTA_425cm` `3,386 km` e `COTA_550cm` `16,683 km` excluindo 5 pontes elevadas de `0,853–0,873 km`), separando **extensão total de eixos interceptados** de **identificação nominal das ruas**, sem presumir denominador viário completo apenas pelo bbox auxiliar (`interceptedPercent: null` em `unverified_bbox_only`) e registrando `10%` sem nome como **critério provisório de governança** (não exigência científica universal). Mantido **`NO-GO` para exposição viária na UI pública** (`55,7%` das `591` vias OSM sem nome, pontes sem altimetria de tabuleiro e pendência de compatibilidade legal `ODbL 1.0` × `Lei Municipal nº 4.135/2021`). Apontamentos do SonarCloud (`typescript:S2871`, acessibilidade, contraste CSS e complexidade cognitiva) corrigidos na causa real sem supressões. Estudo completo em [ROAD_EXPOSURE_AND_GEOCODING_STUDY_2026-11-25.md](research/ROAD_EXPOSURE_AND_GEOCODING_STUDY_2026-11-25.md). Sem alterações em `lib/neighborhoods/`, sem merge, deploy ou ativação INEA.
