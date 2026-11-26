# Roadmap

Este roadmap separa `observed`, `processed`, `official_reference`, `derived`, `simulated`, `forecast` e `mock`.

Nenhuma etapa transforma o Pádua FloodSim em sistema oficial de alerta.

## V0 — Fundação da aplicação — concluída

- [x] Next.js + TypeScript + Tailwind.
- [x] MapLibre GL JS.
- [x] Dashboard e mapa navegável.
- [x] Slider de cenários.
- [x] Aviso acadêmico/experimental.
- [x] Responsividade básica.
- [x] Remoção de métricas mock que poderiam parecer resultados reais.

## V1A — Referência oficial SGB — concluída

- [x] Integrar 11 manchas SGB entre 300 e 550 cm.
- [x] Documentar estação RHN `58790002`.
- [x] Documentar zero de régua e datum do estudo.
- [x] Separar extensão oficial de profundidade, dano e previsão.
- [x] Implementar estados de erro/retry.
- [x] Manter fonte/metodologia acessíveis.

## Marco 05/10/2026 — Research Phase

Nova identidade:

```text
MONITORAR -> PREVER -> TRADUZIR EM IMPACTO ESPACIAL
```

A partir deste marco, previsão deixa de ser "feature avançada eventual" e passa a ser uma das frentes centrais de pesquisa, sem antecipar afirmações operacionais.

## Estado consolidado na `main` — `63f191b` (25/11/2026)

PRs #41–#45, #48, #49 (`7e2c4e6`) e **#54 (R02-C, `63f191b19e4f12a239520aa5f4ed85ef5d589a0b`)** integrados na `main` aprovada e publicada em produção. Criação de tag acadêmica, depósito Zenodo e ativação automática de deploy (`vercel.json`: `"deploymentEnabled": false`) seguem processos separados e controlados. Ver [Catálogo de pesquisa](research/RESEARCH_CATALOG_2026-11-25.md) e [notas da candidata `v0.2.0-academic`](releases/v0.2.0-academic.md).

- **Contrato e skills (`docs/OBSERVATION_CONTRACT.md`, `audit-hydro-source`, `verify-hydro-observations`):** integrados na `main`.
- **Monitoramento observado INEA (`213042120`):** integrado e testado offline; coleta ao vivo desativada por padrão no servidor (`FLOODSIM_ENABLE_LIVE_INEA=true` para ativação deliberada) até homologação operacional e confirmação institucional das permissões de consumo/armazenamento/redistribuição (#6).
- **Pipeline histórico em Python (`scripts/research/hydrology/`) e auditoria do acervo INEA (`docs/research/INEA_HISTORICAL_ARCHIVE.md`):** integrados na `main` com CI determinístico offline; [`EXP-2026-001`](experiments/EXP-2026-001-historical-hydrological-datasets.md) permanece **exploratório** (`BLOCKED_LOCAL_DATA` em Cloud); [`EXP-2026-002`](experiments/EXP-2026-002-forecast-protocol.md) pré-registrado e **ainda não executado**.
- **Plataforma pública funcional (R02-B / #21):** integrada na `main` — navegação real em 4 módulos (*Mapa e cenários*, *Monitoramento*, *Dados e fontes*, *Sobre e metodologia*), remoção de elementos de protótipo e dados mockados, camada real de estações INEA verificadas (com RHN `58790002` omitida do mapa por divergência de coordenadas) e primeira métrica espacial derivada (**Área da mancha selecionada**, aproximação numérica em latitude autálica WGS84 com união topológica, falha fechada estrita e validação independente nas 11 cotas reais SGB em [`SGB_AREA_VALIDATION_2026-11-25.md`](research/SGB_AREA_VALIDATION_2026-11-25.md)).
- **Comparação interativa de cenários SGB (R02-C / #50, integrada na `main` `63f191b` e publicada em produção):** modo *Comparar cenários* com seleção independente A/B (`Cota de referência SGB — Pádua II (58790002)`), sobreposição topológica real ($A \cap B$, $A \setminus B$, $B \setminus A$) com validação de conservação de área (`lib/sgb/compare.ts`), gráfico interativo de área por cota usando snapshot catalogado com SHA-256 (`lib/sgb/areaCatalog.ts`, alerta de divergência de área em relação ao catálogo para a geometria consultada, sem afirmar identidade geométrica por equivalência de área) e verificação de fidelidade de `COTA_300cm` sem modificação dos limites oficiais (#7, #9). Melhoria futura registrada: descarregar cálculo topológico em Web Worker para dispositivos modestos.
- **Limites dos 27 bairros e contrato territorial (R02-F / #10, #20, PR `#55`):** auditoria documental/geoespacial registra **`BLOCKED_DATA_SOURCE` (`27/27` bairros oficiais identificados em lei, `0/27` polígonos utilizáveis)** em [`MUNICIPAL_NEIGHBORHOOD_BOUNDARIES.md`](research/MUNICIPAL_NEIGHBORHOOD_BOUNDARIES.md); contrato e motor desacoplados da UI integrados diretamente a `extractAndDissolvePolygons`/`computeDissolvedAreaMetrics` (`lib/sgb/area.ts`), com cobertura do modelo `unknown` por padrão e limiares provisórios `5%`/`20%` não calibrados.
- **Hardening de CI / Quality Gate (#38):** `gitleaks/gitleaks-action` fixado em SHA completo e CI Web em `npm ci --ignore-scripts --no-audit --no-fund`.
- **Limites científicos ativos:** nenhum crosswalk validado (`crosswalkValidated: false`); nenhuma previsão temporal autorizada para exposição pública; sem métricas públicas por bairro/rua antes de polígonos municipais validados (#10, #20).

---

## Próxima ordem de execução

1. Integrar PR de correção do Quality Gate (#38) e preparação da candidata `v0.2.0-academic` (#47); confirmar Quality Gate verde na `main` pós-merge antes de criar tag/pre-release (separada de deploy).
2. Permissões, metadados e homologação da fonte (#6, #37); recuperar dados locais e reproduzir EXP-001 (#46).
3. Congelar protocolo, executar EXP-002 (#46) e avaliar resultados e incerteza; prever 1–10h somente em pesquisa até validação.
4. Terreno, bairros, crosswalk e validação espacial (#9, #10, #5, #7, #20) e artigo com orientação.

As listas abaixo são critérios de conclusão científica/operacional, não marcações de merge; evidências parciais constam no catálogo. R02-A identificou a estação INEA/RHN 58774000, sem validar datum ou crosswalk.

## R0 — Governança científica — em andamento

Objetivo: tornar pesquisa e software rastreáveis.

- [x] Project Charter.
- [x] protocolo inicial de forecast.
- [x] plano inicial de artigo.
- [x] governança GitHub/Notion/Chat/Work.
- [x] política de uso de IA.
- [x] diário formal de pesquisa.
- [ ] criar ADRs para decisões metodológicas materiais quando necessário.
- [ ] definir convenção de IDs de experimentos.
- [ ] definir manifest de execução científica.

## R1 — Compatibilidade das observações

Objetivo: saber exatamente o que cada régua/estação mede antes de sincronizar mapa e nível.

- [ ] investigar tecnicamente a fonte INEA (#6).
- [ ] identificar nome/código/coordenadas da estação INEA.
- [ ] identificar zero/referência vertical da régua INEA.
- [ ] auditar Santo Antônio de Pádua II (`58790002`).
- [ ] comparar séries simultâneas INEA x RHN/SGB/ANA.
- [ ] definir se existe crosswalk válido.
- [ ] documentar tolerância/erro da transformação.
- [ ] impedir sincronização automática enquanto o crosswalk não estiver validado.

**Uso de Work recomendado:** sim, para a investigação multifuente das estações e séries.

## R2 — Dataset temporal de pesquisa

Objetivo: construir uma base reproduzível para previsão.

- [ ] auditar disponibilidade histórica de `58790002`.
- [ ] auditar UHE Barra do Braúna Jusante `58788600`.
- [ ] identificar demais estações úteis a montante.
- [ ] levantar pluviômetros relevantes.
- [ ] registrar frequência, gaps e quality flags.
- [ ] harmonizar timestamps/timezone/unidades.
- [ ] identificar eventos de cheia.
- [ ] separar períodos/eventos de treino e teste.

**Uso de Work recomendado:** sim.

## R3 — Baselines de previsão

Objetivo: estabelecer o mínimo que um modelo útil precisa superar.

- [ ] persistência.
- [ ] tendência recente.
- [ ] regressão/local-history simples.
- [ ] backtesting temporal.
- [ ] MAE/RMSE/viés por horizonte.
- [ ] análise durante cheias/subidas rápidas.

Horizontes candidatos:

```text
+1h +2h +3h +4h +5h +10h
```

## R4 — Previsão com informação de montante e chuva

Objetivo: avaliar ganho incremental de novas variáveis.

- [ ] Pádua + Barra do Braúna.
- [ ] testar defasagens de montante.
- [ ] acrescentar precipitação somente após baseline.
- [ ] comparar ganho fora da amostra.
- [ ] avaliar incerteza.
- [ ] publicar model card/protocolo da versão candidata.
- [ ] definir comportamento para dados faltantes.

Benchmark histórico a revalidar: SAH-Pomba usou `58788600` com referência de deslocamento de 8 h.

## V1B — Bairros e impacto espacial

Objetivo: permitir tradução espacial territorial confiável.

- [x] confirmar 27 bairros em fonte municipal.
- [ ] obter limites vetoriais oficiais ou produzir camada derivada documentada (#10).
- [ ] validar topologia/nomenclatura/CRS (#10).
- [ ] calcular `bairro ∩ mancha` em CRS métrico (#20).
- [ ] calcular área e percentual territorial (#20).
- [ ] criar visualização proporcional e popups (#20).
- [ ] validar malha viária antes de métricas de ruas.
- [ ] adicionar equipamentos públicos somente com fonte adequada.

## V1C — Modelo espacial experimental

Objetivo: avaliar modelo simples e reproduzível separado da referência SGB.

- [ ] inventariar pacote MDE/SIG SGB 2015 (#9).
- [ ] definir AOI e CRS métrico.
- [ ] preparar DEM e hidrografia.
- [ ] pipeline Python.
- [ ] implementar baseline `DEM <= H`.
- [ ] implementar cota + conectividade hidráulica (#5).
- [ ] gerar cenários determinísticos.
- [ ] validar contra as 11 manchas SGB (#7).
- [ ] calcular IoU/precision/recall/F1 e erro de área.
- [ ] sensibilidade a H/resolução/semente.
- [ ] validar com eventos históricos independentes.

## R5 — Monitoramento observado

Objetivo: substituir painel demo por observações reais adequadamente rotuladas.

- [ ] ingestão estruturada.
- [ ] nível atual.
- [ ] tendência.
- [ ] chuva.
- [ ] timestamp da última leitura.
- [ ] estado stale/indisponível.
- [ ] painel de estações a montante.
- [ ] nunca esconder falha de atualização.

## R6 — Integração espaço-temporal

Objetivo: ligar previsão e mapa somente depois das etapas anteriores.

- [ ] nível observado -> cenário compatível.
- [ ] previsão por horizonte -> cenário compatível.
- [ ] linha temporal Agora/+1h/.../+10h.
- [ ] faixa de incerteza espacial.
- [ ] bairros potencialmente interceptados.
- [ ] consulta de ponto/endereço com linguagem não determinística.
- [ ] comparação previsto x observado.
- [ ] compartilhamento de cenário.

Critério obrigatório: crosswalk de referência + modelo temporal validados.

## R7 — Validação histórica integrada

- [ ] selecionar eventos verificáveis.
- [ ] replay de eventos.
- [ ] métricas temporais.
- [ ] métricas espaciais.
- [ ] avaliar erros de cadeia completa.
- [ ] analisar falhas e incerteza.

## R8 — Artigo científico

- [ ] decidir com orientação se forecast e espacial cabem em um artigo ou serão separados.
- [ ] revisão bibliográfica.
- [ ] congelar protocolo antes do conjunto de teste final.
- [ ] gerar figuras/tabelas por pipeline.
- [ ] redigir métodos.
- [ ] redigir resultados/discussão somente após resultados.
- [ ] conferir política editorial vigente no momento da submissão.
- [ ] arquivar versão reproduzível no GitHub/Zenodo.

**Uso de Work recomendado:** revisão bibliográfica, síntese multifuente e auditoria científica ampla.

## V4 — Métodos avançados — somente com justificativa

- [ ] avaliar HEC-RAS/IBER apenas se uma pergunta exigir.
- [ ] avaliar ML mais complexo apenas depois dos baselines.
- [ ] avaliar previsão de chuva externa somente com validação.
- [ ] visualização 3D não altera o modelo científico.

## Critério de promoção

Uma funcionalidade só pode ser apresentada como tecnicamente confiável quando:

1. fonte e proveniência estão documentadas;
2. unidades/referenciais são compatíveis;
3. categoria da informação está explícita;
4. validação é proporcional à afirmação;
5. pipeline é reproduzível;
6. incerteza/limitações estão publicadas;
7. falhas de dados são visíveis;
8. nenhuma saída substitui orientação oficial.
