# Pádua FloodSim — Pipeline Científico de Séries Hidrológicas Históricas

Pipeline Python reproduzível, isolado da aplicação web (`app/`, `components/`, `lib/`), para aquisição, normalização, controle de qualidade, extração de eventos candidatos e piloto exploratório (persistência e tendência) das estações do Rio Pomba.

## Ambiente e Dependências

- **Python:** `>= 3.11` (executado originalmente em `Python 3.14.7`; CI validado em `Python 3.12`)
- **Dependências externas:** nenhuma (apenas biblioteca padrão Python — `urllib`, `xml.etree.ElementTree`, `csv`, `json`, `hashlib`, `statistics`, `datetime`, `unittest`) para garantir reprodutibilidade determinística sem conflitos de pacotes.

## Separação em Camadas

1. `acquire.py` — aquisição sequencial via allowlist (`telemetriaws1.ana.gov.br`, `alertadecheias.inea.rj.gov.br`), HTTPS obrigatório, validação de esquema/host antes de cada redirecionamento (máximo de 3 saltos, rejeição de downgrade HTTP), limite efetivo de bytes, timeout, retries limitados, verificação obrigatória de SHA-256 antes de reutilizar arquivos existentes e gravação em `data/raw/hydrology/` (ignorado pelo Git).
2. `parse.py` — parsers determinísticos offline para XML SOAP da ANA (inventário, telemétrica e série convencional de cotas) e XML 10 dias do INEA.
3. `normalize.py` — esquema canônico (`classification`, estação, timestamps local/UTC, valor original e normalizado, unidade, `gauge_reference_id`, `gauge_zero_m`, `vertical_datum`, `quality_flags`, `parser_version`, `source_hash_sha256`), ordenação cronológica e deduplicação idempotente com preferência para registros consistidos (`NivelConsistencia=2`).
4. `qc.py` — frequência observada, lacunas, duplicações, preservação explícita de valores extremos (`extreme_high_preserved`), detecção de episódios constantes (`suspect_flatline` >= 24 h), comparação convencional × telemétrica e matriz de sobreposição temporal.
5. `events.py` — detecção de eventos candidatos (`>= 240 cm` em `58790002`, fusão de lacunas `< 72 h`) com status simultâneo das estações a montante (`58788600` e `58770000`).
6. `pilot.py` — alinhamento horário estritamente causal (`aligned_hourly_rio_pomba.csv`), correlação cruzada por defasagem (`0..16 h`), análise de viabilidade por horizonte (`+1 h .. +10 h`) e piloto exploratório B0/B1 com divisão cronológica.
7. `pipeline.py` — orquestrador CLI, identificador não circular de código (`compute_code_identity` com `git_base_commit`, estado `dirty` e `pipeline_fingerprint_sha256` sobre `scripts/research/hydrology/*.py`) e gerador/verificador de manifestos SHA-256 em `data/metadata/hydrology/`.

## Execução

```bash
# Verificar integridade dos 98 artefatos registrados em run_manifest.json sem sobrescrever o manifesto
python -m scripts.research.hydrology.pipeline --verify-only

# Reprodução offline determinística a partir de data/raw/hydrology/ + verificação SHA-256 (gera manifesto schema v2 com code_identity)
python -m scripts.research.hydrology.pipeline --mode offline --verify-manifest

# Aquisição completa (2020-01-01 a 2026-11-24) + normalização + QC + eventos + piloto + manifesto
python -m scripts.research.hydrology.pipeline --mode full --verify-manifest

# Suíte de testes determinísticos (offline, com fixtures sintéticas rotuladas)
python -m unittest discover -s tests/research -v
```

## Preservação de Dados, Recuperação e Backup Verificável

Os dados volumosos da execução original do `EXP-2026-001` (~`554,67 MB`) permanecem fora do Git conforme política do repositório. Os `98` hashes SHA-256 históricos registrados em `data/metadata/hydrology/run_manifest.json` são preservados sem alteração até que haja acesso ao armazenamento local original (`BLOCKED_LOCAL_DATA` em ambiente Cloud).

### Arquivos esperados e caminhos relativos

1. **Entradas brutas (`88` arquivos XML + índice local, fora do Git):**
   - `data/raw/hydrology/acquisition_index.json`
   - `data/raw/hydrology/ana/inventory/rio_pomba_telemetric.xml`
   - `data/raw/hydrology/ana/inventory/padua_pluviometers.xml`
   - `data/raw/hydrology/ana/telemetric/{58790002,58788600,58770000}/YYYY-MM-DD_YYYY-MM-DD.xml` (`84` blocos de 90 dias, `2020-01-01` a `2026-11-24`)
   - `data/raw/hydrology/ana/conventional/58790002_cotas_2020_2025.xml`
   - `data/raw/hydrology/inea/21304212020_10days_snapshot.xml`
2. **Saídas processadas (`5` CSVs, fora do Git):**
   - `data/processed/hydrology/58790002_normalized.csv`
   - `data/processed/hydrology/58788600_normalized.csv`
   - `data/processed/hydrology/58770000_normalized.csv`
   - `data/processed/hydrology/INEA-213042120_normalized.csv`
   - `data/processed/hydrology/aligned_hourly_rio_pomba.csv`
3. **Metadados e manifestos versionados no Git (`6` arquivos JSON):**
   - `data/metadata/hydrology/run_manifest.json` (âncora histórica de `98` SHA-256)
   - `data/metadata/hydrology/station_inventory.json`
   - `data/metadata/hydrology/source_access_audit.json`
   - `data/metadata/hydrology/quality_report.json`
   - `data/metadata/hydrology/candidate_events.json`
   - `data/metadata/hydrology/feasibility_pilot_report.json`

### Procedimento de verificação e recuperação futura

1. Restaurar `data/raw/hydrology/` e `data/processed/hydrology/` em uma estação com Python `>= 3.11` (apenas stdlib).
2. Executar verificação somente leitura contra o manifesto histórico preservado:
   ```bash
   python -m scripts.research.hydrology.pipeline --verify-only
   ```
3. Somente após confirmar os `88` arquivos brutos intactos, reexecutar em modo offline para validar reprodução integral e gerar manifesto `schema_version: 2` com `code_identity`:
   ```bash
   python -m scripts.research.hydrology.pipeline --mode offline --verify-manifest
   ```

### Procedimento de backup verificável (condicionado às permissões de armazenamento)

- **Pré-condição legal/governança:** confirmar se as permissões de armazenamento e eventual cópia em nuvem/mídia externa são compatíveis com os termos de cada fonte (especialmente o snapshot INEA `213042120`, cujo armazenamento/redistribuição permanece pendente de confirmação formal).
- **Fluxo verificável (sem upload para o Git):**
  1. Validar localmente com `--verify-only` antes da cópia.
  2. Empacotar `data/raw/hydrology/` e `data/processed/hydrology/` junto com uma cópia de `data/metadata/hydrology/run_manifest.json` em armazenamento controlado pelo mantenedor (ex.: mídia local/Drive institucional privado, nunca repositório público).
  3. Registrar o SHA-256 do arquivo de backup após a transferência e validar uma restauração de teste com `--verify-only`.
