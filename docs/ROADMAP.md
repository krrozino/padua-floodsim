# Roadmap

Este roadmap separa referência oficial, dado observado, resultado derivado e resultado simulado. Nenhuma etapa transforma o Pádua FloodSim em sistema oficial de alerta.

## V0 — Fundação da aplicação

Objetivo: entregar a base executável e a experiência cartográfica principal.

- [x] Inicializar Next.js + TypeScript + Tailwind.
- [x] Configurar MapLibre GL JS.
- [x] Criar layout do dashboard.
- [x] Criar sidebar/header de navegação.
- [x] Criar mapa principal com pan/zoom/centralização.
- [x] Criar slider discreto de cenários.
- [x] Adicionar aviso de caráter acadêmico/experimental.
- [x] Garantir responsividade básica.
- [x] Remover métricas, profundidade e criticidade espacial mock que poderiam ser confundidas com resultado real.

## V1A — Referência oficial SGB integrada

Objetivo: usar produtos oficiais existentes como baseline geográfico e fonte externa de comparação.

- [x] Integrar as 11 manchas oficiais SGB entre 300 e 550 cm, a cada 25 cm.
- [x] Documentar cota local, altitude ortométrica, estação RHN `58790002` e datum vertical do estudo SGB 2024.
- [x] Distinguir extensão oficial de profundidade, dano, população afetada e previsão.
- [x] Implementar retry, estados de erro/vazio e proteção contra respostas antigas.
- [x] Validar consumo dos 11 cenários publicados.
- [x] Refinar apresentação do status/fonte do cenário sem cobrir o mapa (#19).
- [x] Manter acesso claro à fonte e metodologia na interface (#19).

## V1B — Bairros e impacto espacial derivado

Objetivo: relacionar as manchas oficiais a unidades territoriais confiáveis, sem inventar risco.

- [x] Confirmar em fonte municipal a lista dos 27 bairros oficiais.
- [ ] Obter arquivo vetorial oficial dos limites de bairros ou produzir geometria derivada e documentada a partir da PGV (#10).
- [ ] Validar topologia, nomes, margem do Rio Pomba e CRS dos 27 bairros (#10).
- [ ] Calcular interseção `bairro ∩ mancha SGB` em CRS métrico (#20).
- [ ] Calcular área e percentual territorial sobreposto por bairro (#20).
- [ ] Exibir intensidade de cor proporcional ao percentual territorial calculado (#20).
- [ ] Exibir popup com nome, área total, área sobreposta e percentual, sempre como métrica `derived` (#20).
- [ ] Obter/validar malha viária antes de qualquer métrica de ruas.
- [ ] Calcular interseções com ruas somente a partir de geometria validada.

## V1C — Modelo experimental próprio

Objetivo: construir e avaliar um modelo simples, reproduzível e cientificamente defensável, separado da referência oficial SGB.

- [ ] Inventariar o pacote MDE/SIG do SGB 2015, incluindo licença, CRS, resolução, nodata e datum vertical (#9).
- [ ] Definir área de interesse e CRS métrico de processamento.
- [ ] Preparar DEM e hidrografia do Rio Pomba.
- [ ] Criar pipeline Python de pré-processamento.
- [ ] Implementar elegibilidade por elevação + conectividade hidráulica aproximada a partir do rio (#5).
- [ ] Gerar cenários determinísticos com parâmetros explícitos.
- [ ] Calcular profundidade somente no modelo próprio, quando a relação entre superfície d'água e terreno estiver documentada.
- [ ] Comparar modelo conectado com baseline ingênuo `DEM <= H`.
- [ ] Validar contra manchas SGB e eventos históricos com métricas quantitativas (#7).

## V2 — Monitoramento observado

Objetivo: exibir leituras reais sem misturá-las com referência oficial ou resultados simulados.

- [ ] Investigar tecnicamente a fonte do INEA (#6).
- [ ] Identificar nome/código, coordenadas, zero de régua e datum/referência vertical da estação INEA.
- [ ] Registrar metadados e política de atualização.
- [ ] Implementar ingestão estruturada de nível observado.
- [ ] Implementar pluviometria quando disponível.
- [ ] Calcular tendência recente.
- [ ] Exibir horário da última atualização e estado de dado atrasado/indisponível.
- [ ] Não converter nível INEA diretamente em cenário SGB até existir crosswalk documentado e validado.
- [ ] Associar observação a cenário/modelo apenas quando a compatibilidade de referência estiver demonstrada.

## V3 — Navegação, comparação e histórico

Objetivo: transformar o dashboard em módulos reais sem criar controles mortos ou sugerir alerta oficial.

- [ ] Implementar tela `Dados e fontes` (#21).
- [ ] Implementar tela `Bairros` após #10/#20 (#21).
- [ ] Implementar comparação entre duas cotas/cenários SGB (#21).
- [ ] Implementar módulo `Monitoramento` após #6 (#21).
- [ ] Persistir série histórica permitida pelas fontes.
- [ ] Criar gráficos de evolução do nível.
- [ ] Registrar eventos históricos de cheia espacialmente verificáveis.
- [ ] Comparar eventos e cenários.
- [ ] Criar linha do tempo e contexto histórico.
- [ ] Incluir pontos críticos/equipamentos públicos somente com fonte registrada.
- [ ] Avaliar localização do usuário com consentimento explícito.

## V4 — Modelagem avançada

Objetivo: avaliar métodos hidrodinâmicos somente se dados, pergunta científica e validação justificarem a complexidade.

- [ ] Avaliar disponibilidade de vazão, seções, rugosidade e uso do solo.
- [ ] Estudar HEC-RAS 2D/IBER conforme necessidade experimental.
- [ ] Comparar modelo topográfico conectado e modelo hidráulico.
- [ ] Modelar propagação temporal somente com dados adequados.
- [ ] Avaliar previsão com antecedência apenas como trabalho futuro validável.
- [ ] Avaliar visualização 3D como camada de apresentação, sem alterar o modelo científico.

## Critério de passagem entre versões

Uma funcionalidade só pode ser promovida como tecnicamente confiável quando:

1. as fontes e a procedência estiverem documentadas;
2. CRS, datum vertical e unidades forem compatíveis ou explicitamente transformados;
3. o resultado estiver classificado como `observed`, `official_reference`, `derived` ou `simulated`;
4. houver validação proporcional à afirmação feita na interface;
5. parâmetros e processamento forem reproduzíveis;
6. limitações e incerteza estiverem claras;
7. nenhum resultado for apresentado como substituto de INEA, Defesa Civil, SGB ou outra fonte oficial.
