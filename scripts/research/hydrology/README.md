# Pádua FloodSim — Pipeline Científico de Séries Hidrológicas Históricas

Pipeline Python reproduzível, isolado da aplicação web (`app/`, `components/`, `lib/`), para aquisição, normalização, controle de qualidade, extração de eventos candidatos e piloto exploratório (persistência e tendência) das estações do Rio Pomba.

## Ambiente e Dependências

- **Python:** `>= 3.11` (executado e validado em `Python 3.14.7`)
- **Dependências externas:** nenhuma (apenas biblioteca padrão Python — `urllib`, `xml.etree.ElementTree`, `csv`, `json`, `hashlib`, `statistics`, `datetime`, `unittest`) para garantir reprodutibilidade determinística sem conflitos de pacotes.

## Separação em Camadas

1. `acquire.py` — aquisição sequencial via allowlist (`telemetriaws1.ana.gov.br`, `alertadecheias.inea.rj.gov.br`), HTTPS obrigatório, limite de bytes, timeout, retries limitados e gravação imutável em `data/raw/hydrology/` (ignorado pelo Git).
2. `parse.py` — parsers determinísticos offline para XML SOAP da ANA (inventário, telemétrica e série convencional de cotas) e XML 10 dias do INEA.
3. `normalize.py` — esquema canônico (`classification`, estação, timestamps local/UTC, valor original e normalizado, unidade, `gauge_reference_id`, `gauge_zero_m`, `vertical_datum`, `quality_flags`, `parser_version`, `source_hash_sha256`), ordenação cronológica e deduplicação idempotente com preferência para registros consistidos (`NivelConsistencia=2`).
4. `qc.py` — frequência observada, lacunas, duplicações, preservação explícita de valores extremos (`extreme_high_preserved`), detecção de sensores travados (`suspect_flatline` >= 24 h), comparação convencional × telemétrica e matriz de sobreposição temporal.
5. `events.py` — detecção de eventos candidatos (`>= 240 cm` em `58790002`, fusão de lacunas `< 72 h`) com status simultâneo das estações a montante (`58788600` e `58770000`).
6. `pilot.py` — alinhamento horário estritamente causal (`aligned_hourly_rio_pomba.csv`), correlação cruzada por defasagem (`0..16 h`), análise de viabilidade por horizonte (`+1 h .. +10 h`) e piloto exploratório B0/B1 com divisão cronológica (`<= 2022-12-31` calibração / `>= 2023-01-01` avaliação retida).
7. `pipeline.py` — orquestrador CLI e gerador de manifestos SHA-256 em `data/metadata/hydrology/`.

## Execução

```bash
# Aquisição completa (2020-01-01 a 2026-11-24) + normalização + QC + eventos + piloto + manifesto
python -m scripts.research.hydrology.pipeline --mode full --verify-manifest

# Reprodução offline determinística a partir de data/raw/hydrology/ + verificação SHA-256
python -m scripts.research.hydrology.pipeline --mode offline --verify-manifest

# Suíte de testes determinísticos (offline, com fixtures sintéticas rotuladas)
python -m unittest discover -s tests/research -v
```
