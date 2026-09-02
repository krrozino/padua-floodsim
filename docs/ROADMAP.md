# Roadmap

## V0 — Protótipo visual

Objetivo: reproduzir a experiência central do Pádua FloodSim com dados mockados.

- [ ] Inicializar Next.js + TypeScript + Tailwind.
- [ ] Configurar MapLibre GL JS.
- [ ] Criar layout do dashboard.
- [ ] Criar sidebar de navegação.
- [ ] Criar mapa principal.
- [ ] Criar slider do nível da água.
- [ ] Criar legenda de profundidade.
- [ ] Criar painel de nível em tempo real com dados mockados.
- [ ] Criar métricas de bairros, ruas e área afetada.
- [ ] Criar mock de bairros com criticidade visual.
- [ ] Adicionar aviso de caráter experimental.
- [ ] Garantir responsividade básica.

## V1 — Base geoespacial real

Objetivo: substituir o mapa demonstrativo por dados reais de Santo Antônio de Pádua.

- [ ] Definir área de interesse.
- [ ] Obter e documentar Modelo Digital de Elevação.
- [ ] Obter hidrografia do Rio Pomba.
- [ ] Obter/produzir limites de bairros.
- [ ] Obter malha viária.
- [ ] Normalizar CRS e datums.
- [ ] Criar pipeline Python de pré-processamento.
- [ ] Gerar primeiros cenários experimentais de inundação.
- [ ] Calcular profundidade.
- [ ] Calcular interseções com bairros.
- [ ] Calcular interseções com ruas.
- [ ] Validar contra produtos oficiais disponíveis.

## V2 — Monitoramento real

Objetivo: exibir leituras reais sem misturá-las com resultados simulados.

- [ ] Investigar tecnicamente a fonte do INEA.
- [ ] Registrar metadados da estação.
- [ ] Implementar ingestão segura de nível observado.
- [ ] Implementar pluviometria quando disponível.
- [ ] Calcular tendência recente.
- [ ] Exibir horário da última atualização.
- [ ] Implementar tratamento de fonte indisponível/dado antigo.
- [ ] Associar nível observado ao cenário experimental compatível.

## V3 — Histórico e contexto

- [ ] Persistir série histórica permitida pelas fontes.
- [ ] Gráficos de evolução do nível.
- [ ] Eventos históricos de cheia.
- [ ] Comparação entre eventos.
- [ ] Linha do tempo.
- [ ] Pontos críticos e equipamentos públicos.
- [ ] Localização do usuário com consentimento explícito.

## V4 — Modelagem avançada

- [ ] Avaliar disponibilidade de dados de vazão e seções.
- [ ] Avaliar rugosidade e uso do solo.
- [ ] Estudar HEC-RAS 2D.
- [ ] Comparar modelo topográfico e hidráulico.
- [ ] Modelar propagação temporal.
- [ ] Avaliar previsão com antecedência.
- [ ] Visualização 3D.

## Critério de passagem entre versões

Uma versão só deve promover resultados como tecnicamente mais confiáveis quando:

1. as fontes estiverem documentadas;
2. os referenciais espaciais/verticais forem compatíveis;
3. houver validação mínima contra dados independentes;
4. as limitações estiverem claras na interface e documentação.
