# Registro consolidado — R01 e R02-A (25/11/2026)

Estado de referência: main `054ff6f`; candidata R01 #44 (baseline testada `a636be70d76c9a5549e3257b2f31aeffa7413253`); auditoria R02-A #45 (`6012952f63c4fe14b0875edcb88f92b254fb815c`). Este registro é uma síntese dos relatórios dos executores e dos documentos versionados, não uma reexecução independente. Nenhuma integração, publicação ou autorização institucional é inferida.

## Rastreabilidade

| Entrega | PR / SHA de evidência | Situação |
|---|---|---|
| Contrato e skills | #41 / 719aba22f99abf005b679eec1efb7790afea2e87 | Incluído na candidata |
| Observações INEA | #42 / 77f09b9c509ee334c7b76c92d570d66e3bdfa820 | Incluído; coleta bloqueada por flag |
| Pipeline histórico | #43 / 382abf5e55ea6814e60017ec4ed70d3f8922fe05 | Incluído; reprodução pendente |
| Integração | #44 / a636be70d76c9a5549e3257b2f31aeffa7413253 | Draft; build, Python CI, Secret Scan, Sonar verdes no baseline |
| Acervo INEA | #45 / 6012952f63c4fe14b0875edcb88f92b254fb815c | Draft documental independente; checks verdes |

Relatório R02-A completo: [INEA_HISTORICAL_ARCHIVE.md (SHA fixo)](https://github.com/krrozino/padua-floodsim/blob/6012952f63c4fe14b0875edcb88f92b254fb815c/docs/research/INEA_HISTORICAL_ARCHIVE.md). Deve ser reconciliado ao integrar #45, sem duplicar o inventário.

## Fontes e estações

| Identidade | Papel | Evidência / limite |
|---|---|---|
| INEA 213042120 / ANA FLU 58774000 / PLU 2141094 | Observação local, ~6 km a montante do centro | Vínculo confirmado pelo executor em inventário e ficha; WGS84 -21.51122, -42.20767. Ficha indica zero 83,299 m (grafia 83299); inventário diz Não Possui; datum não confirmado. |
| RHN 58790002 Pádua II | Alvo da pesquisa e referência SGB 2024 | Zero 79,709 m hgeoHNOR_IMBITUBA no estudo; coordenadas ANA -21.5422,-42.1806 vs SGB -21.5375,-42.1578 (~2,415 km); causa pendente. Não assumir continuidade do zero. |
| RHN 58788600 Braúna Jusante | Preditora candidata | 60 min; flatlines suspeitos, não prova de falha. |
| RHN 58770000 Cataguases | Preditora candidata | 15 min; cobertura útil nos 29 eventos do piloto. |
| INEA BE7176FE / FLU 58789000 / PLU 2142083 Ponte Paraoquena | Candidata adicional | -21.49539,-42.25336; inventariada, ainda não avaliada. |

Fontes: [INEA XML](https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.xml), [acervo público INEA](https://drive.google.com/drive/folders/1jOfCAhb8llozzsAOE-KW9NJYC_ivcgNx?usp=share_link), [orientações INEA](https://www.inea.rj.gov.br/wp-content/uploads/2025/07/Orienta%C3%A7%C3%B5es_Drive.pdf), [SGB manchas 2024](https://rigeo.sgb.gov.br/handle/doc/25035), [SAH-Pomba 2024](https://rigeo.sgb.gov.br/bitstream/doc/24903/1/relatorio_anual_2024_sah_pomba.pdf), [SAH-Pomba 2021](https://rigeo.sgb.gov.br/server/api/core/bitstreams/59c0e2b1-8a9e-4898-9c3b-1737d6f71256/content). Acesso público não comprova autorização de automação/redistribuição. Orientações PDF indisponíveis ao executor cloud.

Acervo: [inventário](https://drive.google.com/file/d/1RyN6tno3IlDDe869kWL-dyfPKRTlqiiE/view), [ficha](https://drive.google.com/file/d/1g_gzTOuDMgQLfqDpM_iZgJ1lkzXJEadJ/view), [telemetria](https://drive.google.com/file/d/1z2w1J6BPOXmezGdWF_v4QtupG39kqCs4/view), [descarga](https://drive.google.com/file/d/1oKPJuGUkBLJ9AO92PUz196iApC5veAXX/view). XLSX telemétrico: 29.254.116 bytes; SHA-256 `c5f96d0ee96fc043c11dd0290fcdb8eb7c6c857d48ca2363c2ded085f4d95bdb`; 15 abas 2011–2026, 2013 ausente (aba rotulada 2013 contém 2014). Arquivo não versionado; não presumir persistência do /tmp cloud. Ficha/planilha de descarga têm divergência de código (58790002), não combinar automaticamente.

## Eventos e qualidade — INEA (relatório #45; contagens reportadas, não validadas independentemente)

| Janela | Cobertura | Pico reportado / observação |
|---|---|---|
| Jan/2012 | 2.976/2.976 | 6,91 m em 04/01 01:15 local; resolver horário de verão histórico |
| Jan/2022 | 2.975/2.976 | 6,452 m em 11/01 07:15 GMT |
| Fev/2022 | 2.687/2.688 | 5,516 m em 16/02 15:00 GMT; 7 negativos sinalizados no bimestre |
| Jan/2023 | 1.282/2.976 (43,1%) | Lacuna 01/01 até 18/01 15:15 GMT conforme auditoria; pico de 08/01 ausente; reconciliar contagem vs limites exatos da lacuna |
| Fev/2026 | 2.688/2.688 | 6,314 m em 28/02 17:15 GMT; 1.741 Bruto, 947 Ajustado |
| Mar/2026 | 2.852/2.852 reportados até 30/03 16:45 GMT | 6,201 m em 01/03 02:29 GMT; verificar timestamp fora da grade, cobertura e denominador |

Não interpretar negativos como erro confirmado apenas pelo sinal; investigar flags/referência. Dados locais até 2014 e GMT após 2015 exigem parser específico, com regras históricas de horário de verão. Não subtrair 190 cm, nem misturar picos INEA/RHN.

## Resultados exploratórios — EXP-2026-001 (#43)

ANA SOAP: séries reportadas 2020–25/11/2026; 29 eventos sustentados >=240 cm em Pádua II (9 >=310 cm), 13 picos isolados sinalizados; mediana da diferença frente à série diária de 1 cm em 2.086 dias pareados. Pico 428 cm em 08/01/2023; SGB SAH 2024 também relata 428 cm, estudo de manchas 431 cm; investigar dados brutos. SAH 2024 lista 450 cm em 04/01/2012. Braúna: 78 flatlines >=24h (6.276 h), pico suspeito 1.012 cm; Cataguases utilizável nos 29 eventos. Correlação exploratória Braúna r=0,7945 em 7h; Cataguases r=0,9302 em 16h, limite da janela. Não prova tempo de propagação nem capacidade preditiva.
B0 persistência vs B1 tendência: MAE geral +1h 0,86 vs 0,64 cm; +10h 6,49 vs 10,34 cm; nível inicial >=240 cm +1h 2,80 vs 1,49 cm; +10h 22,71 vs 23,65 cm. Valores arredondados, exploratórios, sujeitos à reprodução e auditoria de latência. Evidência completa nos JSON de `data/metadata/hydrology/`. 98 hashes históricos, 95 arquivos locais ausentes em cloud (~554,67 MB). EXP-002 pré-registrado, não executado. 2026 já examinado no piloto: não é holdout intocado. Nenhuma métrica constitui resultado final/publicável do artigo.

## Engenharia R01

API /api/hydro/observations; parser XML, m→cm, chuva por janela, timestamps, SHA-256, cache 5 min, stale 45 min, TLS estrito, allowlist, timeout total 12s, sem bypass público, erros no-store. Flag server-side `FLOODSIM_ENABLE_LIVE_INEA=true` deliberada; padrão desativado e 503 honesto. SGB independente. Testes reportados na integração: 20 unitários web, 12 Python, 4 E2E focados, build/typecheck PASS. Smoke anterior local 25/11 00h00 4,16 m (amostra histórica); cloud final TIMEOUT, não homologado. Fixture sintética substitui real na árvore atual; histórico Git preservado, verificar direitos antes de qualquer release. Cache regional não garante limitação global.

## Literatura e artigo

Relatório de apoio Gemini Deep Research, *Fundamentação Científica e Protocolo Metodológico do Pádua FloodSim: Hidrologia do Rio Pomba, Previsão de Cheias de Curto Prazo e Representação Espacial em Santo Antônio de Pádua (RJ)*, 59 páginas, recebido 25/11/2026. Arquivo original na conversa: Pádua FloodSim_ Hidrologia e Cheias.pdf (993858 bytes; SHA-256 `91aec29b7541142e49ca3cb4c4c629dace3bb3f161175e3452fd7ecc3d6b1158`). Material auxiliar gerado por IA, não fonte científica primária; referências devem ser conferidas no original; não redistribuído aqui. SAH-Pomba 2021: modelo Braúna 8h, r=0,939, KGE=0,956, MAE 11 cm; Cataguases 24h, r=0,882, KGE=0,896, MAE 68 m³/s (unidades não comparáveis). Recalibrar estrutura institucional; não herdar desempenho. SGB 2024: investigar relação das quatro manchas >450 cm com extrapolação da curva-chave; não declarar exatidão espacial. Recorte RBMET sugerido: previsão 1–10h e incerteza; espacial/usabilidade como frentes separadas a discutir com orientação. Sem recrutamento científico antes de avaliação ética institucional aplicável.

## Próximos gates / backlog

- #6: confirmar termos de uso INEA e smoke autorizado; sem ativar flag antes.
- #37: fichas, datum, coordenadas, séries pareadas, acesso ANA formal, QC acervo; nenhuma transformação validada.
- #38: integridade/segurança; controles de cache e dados, evidência de release.
- #46: recuperar e preservar inputs, reproduzir EXP-001, congelar protocolo e executar EXP-002; comparar B0/B1, histórico, Braúna/Cataguases, chuva causal.
- #47: aprovação da candidata, release acadêmica/tag/citação, separada do deploy e depósito Zenodo.
- #9, #10, #5, #7, #20: terreno, limites oficiais, modelo espacial, validação, sobreposição. #21: usabilidade.
- Solicitações institucionais ainda não enviadas: INEA (zero, datum, permissões, lacunas, códigos), ANA/SGB (metadados e acesso, divergências, curvas e modelo), Prefeitura (bairros e eventos), UHE (manutenção). 

Não é sistema oficial de alerta. Não usar cenários para afirmar segurança de imóveis nem orientar evacuação.
