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
