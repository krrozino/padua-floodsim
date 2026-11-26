"use client";

import { HydroMonitoringCard } from "@/components/monitoring/HydroMonitoringCard";
import {
  HYDRO_STATIONS,
  formatStationIdentifiers,
} from "@/lib/hydro/stations";
import type { HydroMonitoringState } from "@/lib/hydro/useHydroMonitoring";
import { SGB_AREA_METHOD_ID, formatHectares } from "@/lib/sgb/area";
import {
  SGB_AREA_SNAPSHOT_BY_LEVEL,
  SGB_AREA_SNAPSHOT_DATE,
  SGB_REFERENCE_STATION_LABEL,
} from "@/lib/sgb/areaCatalog";
import { SGB_COMPARISON_METHOD_ID } from "@/lib/sgb/compare";
import {
  SGB_FLOOD_LEVELS_CM,
  SGB_STAGE_DISCHARGES_M3S,
  SGB_STAGE_ELEVATIONS,
} from "@/lib/sgb/stages";

function formatStageMeters(levelCm: number): string {
  return (levelCm / 100).toFixed(2).replace(".", ",");
}

export function MonitoringSection({
  monitoring,
  onGoToMap,
}: Readonly<{
  monitoring: HydroMonitoringState;
  onGoToMap: () => void;
}>) {
  return (
    <section
      className="content-page"
      aria-labelledby="monitoring-page-title"
    >
      <div className="content-container">
        <header className="page-header">
          <div>
            <h2 id="monitoring-page-title">Monitoramento do Rio Pomba</h2>
            <p>
              Acompanhamento hidrológico observado a partir de estação oficial do
              INEA em Santo Antônio de Pádua e inventário das estações catalogadas
              na bacia local.
            </p>
          </div>
          <button
            type="button"
            className="secondary-action-btn"
            onClick={onGoToMap}
          >
            Voltar ao mapa
          </button>
        </header>

        <div className="official-notice-banner" role="note">
          <strong>Aviso importante:</strong> Esta plataforma não substitui os
          alertas e as orientações dos órgãos oficiais. Em caso de emergência,
          consulte a Defesa Civil Municipal, o INEA e o SGB.
        </div>

        <div className="monitoring-layout">
          <div className="monitoring-primary">
            <HydroMonitoringCard
              monitoring={monitoring}
              id="monitoring-section-card"
            />
          </div>

          <div className="monitoring-secondary">
            <article className="card">
              <div className="card-heading">
                <strong>Estações hidrológicas catalogadas</strong>
                <span
                  className="data-origin-badge official"
                  data-classification="official_reference"
                >
                  Cadastro oficial
                </span>
              </div>
              <p className="section-lead">
                Metadados verificados em documentos do INEA, ANA e SGB. Apenas
                estações com coordenadas confirmadas são exibidas como marcadores
                no mapa.
              </p>

              <div className="station-list">
                {HYDRO_STATIONS.map((station) => (
                  <div key={station.id} className="station-item">
                    <div className="station-item-header">
                      <strong>{station.name}</strong>
                      <span
                        className={`station-status-tag ${
                          station.plotOnMap ? "mapped" : "unmapped"
                        }`}
                      >
                        {station.plotOnMap
                          ? "Exibida no mapa"
                          : "Não plotada no mapa"}
                      </span>
                    </div>
                    <p className="station-item-inst">{station.institution}</p>
                    <p className="station-item-codes">
                      {formatStationIdentifiers(station.identifiers)}
                    </p>
                    <p className="station-item-loc">
                      {station.locationDescription}
                    </p>
                    <p className="station-item-note">{station.statusNote}</p>
                    {station.officialUrl && (
                      <a
                        className="source-link"
                        href={station.officialUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {station.officialLinkLabel ?? "Acessar fonte oficial"} ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DataSourcesSection({
  onSelectStageAndOpenMap,
}: Readonly<{
  onSelectStageAndOpenMap: (levelMeters: number) => void;
}>) {
  return (
    <section
      className="content-page"
      aria-labelledby="sources-page-title"
    >
      <div className="content-container">
        <header className="page-header">
          <div>
            <h2 id="sources-page-title">Dados e fontes</h2>
            <p>
              Origem institucional, metadados, classificação dos dados e limites
              de uso de cada camada exibida no Pádua FloodSim.
            </p>
          </div>
        </header>

        <div className="official-notice-banner" role="note">
          <strong>Aviso importante:</strong> Esta plataforma não substitui os
          alertas e as orientações dos órgãos oficiais.
        </div>

        <div className="sources-grid">
          <article className="card">
            <div className="card-heading">
              <strong>1. Manchas de inundação — SGB / CPRM (2024)</strong>
              <span
                className="data-origin-badge official"
                data-classification="official_reference"
              >
                Cenário oficial SGB
              </span>
            </div>
            <p className="section-lead">
              Polígonos vetoriais publicados pelo Serviço Geológico do Brasil no
              estudo{" "}
              <em>
                &ldquo;Delimitação da mancha de inundação do rio Pomba na zona
                urbana de Santo Antônio de Pádua - RJ&rdquo;
              </em>{" "}
              (setembro de 2024).
            </p>
            <dl className="meta-list">
              <div>
                <dt>Estação de referência</dt>
                <dd>Santo Antônio de Pádua II (RHN / ANA 58790002)</dd>
              </div>
              <div>
                <dt>Zero da régua e datum</dt>
                <dd>79,709 m · Datum vertical hgeoHNOR_IMBITUBA</dd>
              </div>
              <div>
                <dt>Sistema de coordenadas</dt>
                <dd>SIRGAS 2000 (EPSG:4674 / UTM 23S) · consulta em EPSG:4326</dd>
              </div>
              <div>
                <dt>Cotas disponíveis</dt>
                <dd>11 cenários, de 3,00 m (300 cm) a 5,50 m (550 cm), a cada 25 cm</dd>
              </div>
            </dl>
            <div className="inline-links">
              <a
                className="source-link"
                href="https://rigeo.sgb.gov.br/handle/doc/25035"
                target="_blank"
                rel="noreferrer"
              >
                Relatório técnico no RiGeo (SGB) ↗
              </a>
              <a
                className="source-link"
                href="https://geoportal.sgb.gov.br/server/rest/services/hidrologia/mancha_santo_antonio_de_padua/MapServer"
                target="_blank"
                rel="noreferrer"
              >
                Geosserviço MapServer (SGB) ↗
              </a>
            </div>
          </article>

          <article className="card">
            <div className="card-heading">
              <strong>2. Monitoramento hidrológico — INEA-RJ</strong>
              <span
                className="data-origin-badge observed"
                data-classification="observed"
              >
                Dado observado
              </span>
            </div>
            <p className="section-lead">
              Leituras telemétricas de nível e chuva publicadas pelo Sistema
              Alerta de Cheias do Instituto Estadual do Ambiente (INEA-RJ).
            </p>
            <dl className="meta-list">
              <div>
                <dt>Estação integrada</dt>
                <dd>
                  Santo Antônio de Pádua — INEA 213042120 · ANA FLU 58774000 ·
                  ANA PLU 2141094
                </dd>
              </div>
              <div>
                <dt>Coordenadas (WGS84)</dt>
                <dd>-21,51122, -42,20767 (~6 km a montante do centro urbano)</dd>
              </div>
              <div>
                <dt>Cadência e atualização</dt>
                <dd>
                  Medições a cada 15 min; leituras com mais de 45 min são
                  sinalizadas como desatualizadas.
                </dd>
              </div>
              <div>
                <dt>Limitação de referência</dt>
                <dd>
                  Zero da régua e datum vertical ainda não confirmados
                  institucionalmente; leitura independente das manchas SGB.
                </dd>
              </div>
            </dl>
            <div className="inline-links">
              <a
                className="source-link"
                href="https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.html"
                target="_blank"
                rel="noreferrer"
              >
                Página oficial da estação (INEA) ↗
              </a>
              <a
                className="source-link"
                href="https://alertadecheias.inea.rj.gov.br/"
                target="_blank"
                rel="noreferrer"
              >
                Portal Alerta de Cheias INEA ↗
              </a>
            </div>
          </article>

          <article className="card">
            <div className="card-heading">
              <strong>3. Área derivada e comparação topológica</strong>
              <span
                className="data-origin-badge derived"
                data-classification="derived"
              >
                Dado derivado
              </span>
            </div>
            <p className="section-lead">
              Métricas espaciais calculadas sobre os polígonos oficiais do SGB
              consultados no mapa, acompanhadas do snapshot catalogado (
              {SGB_AREA_SNAPSHOT_DATE}) para o gráfico das 11 cotas.
            </p>
            <dl className="meta-list">
              <div>
                <dt>Métodos registrados</dt>
                <dd>
                  Área individual (<code>{SGB_AREA_METHOD_ID}</code>) e
                  sobreposição topológica A ∩ B, A \ B, B \ A (
                  <code>{SGB_COMPARISON_METHOD_ID}</code>) via{" "}
                  <code>polygon-clipping</code>, com validação de conservação de
                  área (&lt;= 0,01% ou 1 m²).
                </dd>
              </div>
              <div>
                <dt>Snapshot vs. geometria consultada</dt>
                <dd>
                  O gráfico das 11 cotas utiliza o snapshot catalogado com hashes
                  SHA-256 ({SGB_AREA_SNAPSHOT_DATE}) para evitar 11 requisições
                  na abertura. Caso a área total da geometria consultada
                  apresente divergência em relação ao catálogo, o alerta é
                  exibido sem misturar valores (áreas equivalentes não comprovam
                  geometrias idênticas).
                </dd>
              </div>
              <div>
                <dt>Interpretação</dt>
                <dd>
                  Indica apenas a extensão horizontal dos cenários estáticos SGB;
                  não representa área atualmente inundada nem profundidade.
                </dd>
              </div>
            </dl>
          </article>

          <article className="card">
            <div className="card-heading">
              <strong>4. Base cartográfica e estações de referência</strong>
              <span
                className="data-origin-badge official"
                data-classification="official_reference"
              >
                Referência
              </span>
            </div>
            <p className="section-lead">
              Mapa base de ruas e hidrografia fornecido pelos colaboradores do
              OpenStreetMap, combinado às coordenadas oficiais das estações INEA
              auditadas documentalmente.
            </p>
            <dl className="meta-list">
              <div>
                <dt>Ponte Paraoquena (INEA)</dt>
                <dd>
                  ANA FLU 58789000 · ANA PLU 2142083 · WGS84 -21,49539, -42,25336
                  (sem leitura automática integrada).
                </dd>
              </div>
              <div>
                <dt>Santo Antônio de Pádua II (RHN 58790002)</dt>
                <dd>
                  Omitida da camada de pontos por divergência cadastral de ~2,4 km
                  entre ANA (-21,5422, -42,1806) e relatório SGB 2024 (-21,5375,
                  -42,1578).
                </dd>
              </div>
              <div>
                <dt>Consulta geográfica e 11 cotas</dt>
                <dd>
                  Verificação ponto × polígono em WGS84 (com suporte a buracos,
                  <code>MultiPolygon</code>, fronteira de ±0,5 m, comparação A/B
                  e análise sob demanda nas 11 cotas sem interpolação nem
                  pressuposição de aninhamento). Fora da extensão mapeada do
                  SGB, ausência de interseção não indica ausência de
                  possibilidade de inundação.
                </dd>
              </div>
              <div>
                <dt>Bairros, vias OSM e geocodificação</dt>
                <dd>
                  Métricas públicas por bairro e por malha viária OSM (ODbL 1.0)
                  permanecem desativadas nesta etapa: os limites municipais de
                  bairros seguem pendentes e a auditoria viária local mostrou
                  55,7% das vias OSM sem nome, 5 pontes elevadas interceptando o
                  canal 2D e ausência de autorização combinada com a Lei
                  Municipal nº 4.135/2021. Busca por endereço público também não
                  está habilitada pelos limites de uso dos provedores e baixa
                  cobertura de numeração predial.
                </dd>
              </div>
            </dl>
          </article>
        </div>

        <article className="card table-card">
          <div className="card-heading">
            <strong>Tabela dos 11 cenários oficiais SGB (2024)</strong>
            <span
              className="data-origin-badge official"
              data-classification="official_reference"
            >
              Cenário oficial SGB
            </span>
          </div>
          <p className="section-lead">
            {SGB_REFERENCE_STATION_LABEL}. Valores hidráulicos publicados no
            relatório técnico SGB (2024) e área derivada do snapshot catalogado
            ({SGB_AREA_SNAPSHOT_DATE}). Não confundir com a leitura da estação
            INEA.
          </p>
          <div className="table-scroll">
            <table className="stages-table">
              <thead>
                <tr>
                  <th>Cota na régua</th>
                  <th>Altitude ortométrica</th>
                  <th>Vazão publicada (SGB)</th>
                  <th>Área derivada (snapshot)</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {SGB_FLOOD_LEVELS_CM.map((cm) => (
                  <tr key={cm}>
                    <td>
                      <strong>{formatStageMeters(cm)} m</strong> ({cm} cm)
                    </td>
                    <td>
                      {SGB_STAGE_ELEVATIONS[cm].toFixed(2).replace(".", ",")} m
                    </td>
                    <td>
                      {SGB_STAGE_DISCHARGES_M3S[cm].toLocaleString("pt-BR")} m³/s
                    </td>
                    <td>
                      {formatHectares(
                        SGB_AREA_SNAPSHOT_BY_LEVEL[cm].areaHectares,
                        2,
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-action-btn"
                        onClick={() => onSelectStageAndOpenMap(cm / 100)}
                      >
                        Ver no mapa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}

export function AboutMethodologySection({
  onGoToMap,
  onGoToSources,
}: Readonly<{
  onGoToMap: () => void;
  onGoToSources: () => void;
}>) {
  return (
    <section
      className="content-page"
      aria-labelledby="about-page-title"
    >
      <div className="content-container">
        <header className="page-header">
          <div>
            <h2 id="about-page-title">Sobre e metodologia</h2>
            <p>
              Objetivos acadêmicos, fundamentos hidrológicos e limitações
              científicas do Pádua FloodSim.
            </p>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="secondary-action-btn"
              onClick={onGoToMap}
            >
              Abrir mapa
            </button>
            <button
              type="button"
              className="secondary-action-btn"
              onClick={onGoToSources}
            >
              Ver dados e fontes
            </button>
          </div>
        </header>

        <div className="official-notice-banner" role="note">
          <strong>Aviso institucional:</strong> Esta plataforma não substitui os
          alertas e as orientações dos órgãos oficiais. Para decisões em
          situações de cheia ou emergência, consulte sempre a Defesa Civil
          Municipal de Santo Antônio de Pádua, o INEA e o SGB.
        </div>

        <div className="about-grid">
          <article className="card">
            <h3>O que é o Pádua FloodSim</h3>
            <p>
              O <strong>Pádua FloodSim</strong> é uma plataforma acadêmica e
              reprodutível voltada à consulta hidrológica e cartográfica das
              cheias do <strong>Rio Pomba</strong> em{" "}
              <strong>Santo Antônio de Pádua (RJ)</strong>.
            </p>
            <p>
              A plataforma reúne em um único ambiente os cenários oficiais de
              mancha de inundação publicados pelo Serviço Geológico do Brasil
              (SGB/CPRM, 2024), o monitoramento observado da estação do INEA e a
              área geodésica derivada de cada cenário carregado.
            </p>
          </article>

          <article className="card">
            <h3>Como foram produzidos os cenários SGB (2024)</h3>
            <p>
              Os 11 cenários entre 3,00 m e 5,50 m foram modelados pelo SGB com
              levantamento aerofotogramétrico por VANTE (reamostrado para 10 m),
              60 seções batimétricas medidas com ADCP no canal do Rio Pomba e
              modelagem hidráulica unidimensional no software HEC-RAS,
              referenciados ao zero da régua da estação Santo Antônio de Pádua
              II (79,709 m, datum hgeoHNOR_IMBITUBA).
            </p>
          </article>

          <article className="card">
            <h3>Separação entre monitoramento INEA e manchas SGB</h3>
            <p>
              O nível observado do INEA (estação 213042120 / ANA FLU 58774000) é
              exibido de forma estritamente independente da seleção de cenários
              do SGB (estação RHN 58790002).
            </p>
            <p>
              As duas estações ficam em seções físicas distintas do Rio Pomba
              (~6 km de distância) e o zero da régua e o datum vertical da
              estação INEA ainda não foram confirmados institucionalmente. Por
              rigor científico, nenhuma conversão automática é aplicada entre
              elas sem validação comprovada.
            </p>
          </article>

          <article className="card">
            <h3>Limitações científicas explícitas</h3>
            <ul className="plain-list">
              <li>
                <strong>Sem cálculo de profundidade:</strong> a mancha SGB mostra
                extensão horizontal estimada, não lâmina d&apos;água por rua ou
                imóvel.
              </li>
              <li>
                <strong>Sem afirmação de segurança ou evacuação:</strong> estar
                fora da mancha de um cenário não garante que um imóvel esteja
                seguro.
              </li>
              <li>
                <strong>Sem previsão pública de nível:</strong> modelos
                estatísticos de previsão de curto prazo permanecem em pesquisa e
                não alimentam esta interface pública.
              </li>
              <li>
                <strong>Sem contagem de bairros ou ruas:</strong> só serão
                exibidas métricas territoriais quando houver polígonos
                municipais oficiais validados.
              </li>
            </ul>
          </article>

          <article className="card about-full-width">
            <h3>Autoria, transparência e código aberto acadêmico</h3>
            <p>
              Desenvolvido e mantido por{" "}
              <strong>Sérgio Izaque Pinheiro Carrozino</strong> (ORCID:{" "}
              <a
                className="source-link"
                href="https://orcid.org/0009-0002-8421-2694"
                target="_blank"
                rel="noreferrer"
              >
                0009-0002-8421-2694 ↗
              </a>
              ). Referência arquivada:{" "}
              <a
                className="source-link"
                href="https://doi.org/10.5281/zenodo.22928810"
                target="_blank"
                rel="noreferrer"
              >
                DOI 10.5281/zenodo.22928810 ↗
              </a>{" "}
              · Repositório:{" "}
              <a
                className="source-link"
                href="https://github.com/krrozino/padua-floodsim"
                target="_blank"
                rel="noreferrer"
              >
                github.com/krrozino/padua-floodsim ↗
              </a>
              .
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
