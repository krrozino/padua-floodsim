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

## Estado da candidata — Sprint R01 (25/11/2026)

PR #44 em draft, ainda não integrado à main. R02-A #45 é documentação independente. [Catálogo de pesquisa](research/RESEARCH_CATALOG_2026-11-25.md).

- **Contrato e skills (`docs/OBSERVATION_CONTRACT.md`, `audit-hydro-source`, `verify-hydro-observations`):** integrados na candidata #44.
- **Monitoramento observado INEA (`213042120`):** implementado e testado offline; coleta ao vivo desativada por padrão no servidor (`FLOODSIM_ENABLE_LIVE_INEA=true`) até homologação operacional (smoke CLOUD bloqueado por indisponibilidade de rede) e confirmação institucional das permissões de consumo/armazenamento/redistribuição.
- **Pipeline histórico em Python (`scripts/research/hydrology/`):** implementado com CI determinístico offline; [`EXP-2026-001`](experiments/EXP-2026-001-historical-hydrological-datasets.md) permanece **exploratório** (reprodução com inputs locais originais em `BLOCKED_LOCAL_DATA`); [`EXP-2026-002`](experiments/EXP-2026-002-forecast-protocol.md) pré-registrado e **ainda não executado**.
- **Plataforma pública funcional (R02-B / #21):** navegação real em 4 módulos (*Mapa e cenários*, *Monitoramento*, *Dados e fontes*, *Sobre e metodologia*), remoção de elementos de protótipo e dados mockados, camada real de estações INEA verificadas (com RHN `58790002` omitida do mapa por divergência de coordenadas) e primeira métrica espacial derivada (**Área da mancha selecionada**, método geodésico WGS84 com união topológica).
- **Limites científicos ativos:** nenhum crosswalk validado (`crosswalkValidated: false`); nenhuma previsão temporal autorizada para exposição pública; sem métricas por bairro/rua antes de polígonos municipais validados (#10, #20).

---

## Próxima ordem de execução

1. Integrar #44 e #45 mediante autorização; pre-release #47 separada de deploy.
2. Permissões, metadados e homologação da fonte (#6, #37); recuperar dados locais e reproduzir EXP-001 (#46).
3. Congelar protocolo, executar EXP-002 (#46) e avaliar resultados e incerteza; prever 1–10h somente em pesquisa até validação.
4. Terreno, bairros, crosswalk e validação espacial (#9, #10, #5, #7, #20), UX (#21) e artigo com orientação.

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
