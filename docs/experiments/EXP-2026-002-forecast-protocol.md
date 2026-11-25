# EXP-2026-002 — Protocolo de Preparação para Modelagem Preditiva de Curto Prazo (M1 / M2 / M3)

**Status:** `Protocolo / Pré-registro` (nenhum modelo novo treinado; piloto `B0/B1` do `EXP-2026-001` permanece estritamente `exploratory`; nenhum modelo validado para uso público).  
**Base empírica:** `EXP-2026-001` (`data/metadata/hydrology/`).  
**Referências normativas:** `docs/FORECAST_MODEL.md`, `docs/VALIDATION_PROTOCOL.md`, `docs/OBSERVATION_CONTRACT.md` (PR `#41`), `docs/ARTICLE_PLAN_RBMET.md`.

---

## 1. Objetivo

Definir regras reprodutíveis e à prova de vazamento temporal (*anti-leakage*) antes de treinar ou comparar modelos estatísticos de curto prazo (`M1`, `M2`, `M3`) contra os baselines (`B0`, `B1`) nos horizontes `+1 h` a `+10 h` em Santo Antônio de Pádua (`58790002`).

---

## 2. Separação por Eventos Inteiros e Fronteira de `EVT-20221231-27`

1. **Proibição de corte no meio de evento:** no piloto exploratório do `EXP-2026-001`, a fronteira fixa `<= 2022-12-31T23:59:59Z` vs `>= 2023-01-01T00:00:00Z` dividiu o evento **`EVT-20221231-27`** (início em `2022-12-31T19:45:00Z`, pico de `428,0 cm` em `2023-01-08T12:45:00Z`, término em `2023-01-16T06:30:00Z`).
2. **Regra obrigatória para `EXP-2026-002`:**
   - Todo evento hidrológico sustentado (incluindo sua janela de pré-evento `-24 h` e recessão `+24 h`) deve pertencer integralmente a **um único conjunto** (calibração, validação ou teste final).
   - O corte entre calibração e teste deverá ser deslocado para fora de qualquer evento ativo (ex.: incluir `EVT-20221231-27` integralmente na partição de validação/teste, iniciando a partição em `2022-12-28T00:00:00Z` ou após o encerramento de eventos de 2022 em período de estiagem).
3. **Preservação do conjunto de teste final independente:**
   - Separar três blocos cronológicos disjuntos (ou *walk-forward* por ano hidrológico) mantendo um **conjunto de teste final intocado** durante seleção de variáveis, hiperparâmetros e escolha de família de modelo.
   - Registrar o recorte exato antes de ajustar qualquer modelo.

---

## 3. Prevenção de Vazamento Temporal (*Zero Future Leakage*)

1. **Alinhamento estritamente causal:** qualquer feature usada no instante de emissão `t` só pode utilizar observações com `timestamp_utc <= t`.
2. **Transformações e estatísticas:** padronização, imputação, seleção de lags e calibração de intervalos de incerteza devem ser ajustados **exclusivamente** no conjunto de calibração.
3. **Proibição de flags retrospectivas de *flatline* no instante `t`:**
   - A flag `suspect_flatline` do `EXP-2026-001` marca todo o episódio de `>= 24 h` retrospectivamente (inclusive a 1ª hora do travamento, usando informação das 23 horas futuras).
   - Em modelagem preditiva, **é proibido** usar a flag retrospectiva como feature ou máscara em `t`.
   - Deve-se utilizar apenas um indicador causal online, calculado exclusivamente com o passado até `t` (ex.: `hours_unchanged_up_to_t`), acionando fallback/máscara somente quando o limiar causal (ex.: `>= 6 h` ou `>= 24 h` acumulados *até* `t`) for atingido.

---

## 4. Latência, Disponibilidade, Chuva, Unidades e Timezone

1. **Latência e disponibilidade operacional:** auditar e documentar o atraso real de publicação de cada estação (`58790002`, `58788600`, `58770000`) antes de assumir que a leitura de instante `t` estaria disponível exatamente em `t` em operação real.
2. **Cobertura dos acumulados horários de chuva:**
   - Validar quantos passos de `15 min` compõem cada acumulado horário `rain_1h_mm` em `(H-1h, H]`.
   - Não tratar uma hora com `3/4` dos passos ausentes e `1` passo igual a `0,0 mm` como acumulado completo válido `0,0 mm`; registrar `rain_1h_coverage_count` (0..4) e definir política explícita de ausência.
3. **Unidades e timezone por fonte:**
   - Garantir explicitamente `stage_cm` em `cm`, `rainfall_mm` em `mm`, `discharge_m3s` em `m³/s` e fuso original `America/Sao_Paulo` convertido de forma verificável para UTC (`YYYY-MM-DDTHH:MM:SSZ`), preservando `measured_at` separado de `retrieved_at`.
   - Não misturar `INEA-213042120` com `58790002` sem crosswalk validado.

---

## 5. Comparação Justa, Regime de Cheia e Incerteza

1. **Amostras estritamente equivalentes:** `B0`, `B1`, `M1`, `M2` e `M3` devem ser avaliados sobre **exatamente o mesmo conjunto de pares `(t, t+h)` válidos** em cada horizonte `h in {+1h, +2h, +3h, +4h, +5h, +10h}` (reportando separadamente a fração de instantes em que `M2` cai em fallback por ausência/suspeita de *flatline* em `58788600`).
2. **Métricas obrigatórias por horizonte:** `MAE`, `RMSE`, `viés`, `correlação` e `KGE`.
3. **Desempenho em regime crítico:** reportar métricas separadas para:
   - conjunto global;
   - cheias (`H >= 240 cm` e `H >= 310 cm`);
   - subidas rápidas (ex.: `ΔH_1h >= +5 cm` ou `ΔH_3h >= +15 cm`);
   - erro de pico e erro de tempo de pico por evento retido.
4. **Avaliação de incerteza:** produzir intervalos preditivos (ex.: *split conformal* ou resíduos por horizonte/regime calibrados em janela de calibração separada) e reportar cobertura empírica (ex.: nominal 80% / 90%) e largura média por horizonte.
5. **Regra contra viés de confirmação:** se `M1`, `M2` ou `M3` não superarem `B0`/`B1` de forma consistente fora da amostra, registrar o resultado negativo integralmente sem alterar critérios retrospectivamente.

---

## 6. Condição de Execução

A execução empírica deste protocolo depende do acesso aos arquivos originais verificados em `data/raw/hydrology/` e `data/processed/hydrology/` (`BLOCKED_LOCAL_DATA` em ambiente Cloud). Nenhum resultado preditivo poderá ser promovido à interface pública sem cumprir os 8 critérios de promoção de `docs/FORECAST_MODEL.md`.
