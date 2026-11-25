"use client";

import type { RefObject } from "react";
import {
  INEA_PADUA_PUBLIC_PAGE_URL,
  INEA_PADUA_STATION_ID,
} from "@/lib/hydro/ineaParser";
import {
  useHydroMonitoring,
  type HydroMonitoringState,
  type HydroViewState,
} from "@/lib/hydro/useHydroMonitoring";

export interface HydroMonitoringCardProps {
  readonly cardRef?: RefObject<HTMLElement | null>;
  readonly monitoring?: HydroMonitoringState;
  readonly id?: string;
}

const BRT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatBrazilDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return `${BRT_DATE_FORMATTER.format(new Date(ms)).replace(",", " às")} (BRT)`;
}

function formatMetersFromCm(valueCm: number): string {
  return (valueCm / 100).toFixed(2).replace(".", ",");
}

function formatRainMm(valueMm: number): string {
  return `${valueMm.toFixed(1).replace(".", ",")} mm`;
}

function statusLabel(state: HydroViewState): string {
  switch (state) {
    case "loading":
      return "Consultando...";
    case "fresh":
      return "Atualizado";
    case "stale":
      return "Desatualizado";
    case "unavailable":
      return "Indisponível";
    case "invalid":
      return "Dado inválido";
  }
}

function HydroMonitoringCardView({
  cardRef,
  monitoring,
  id = "realtime-card",
}: Readonly<{
  cardRef?: RefObject<HTMLElement | null>;
  monitoring: HydroMonitoringState;
  id?: string;
}>) {
  const {
    viewState,
    data,
    effectiveAgeMinutes,
    isRefreshing,
    refreshNow,
  } = monitoring;

  const hasValidStage =
    (viewState === "fresh" || viewState === "stale") &&
    data?.latestStage !== null &&
    data?.latestStage !== undefined &&
    data.latestStage.stageCm !== null;

  const stageCm = hasValidStage ? data.latestStage!.stageCm! : null;
  const trend = hasValidStage ? data.recentTrend : null;
  const availableRain = hasValidStage
    ? data.rainfall.filter((item) => item.rainMm !== null)
    : [];

  const stationName = data?.station.stationName ?? "Santo Antônio de Pádua";
  const stationCode = data?.station.stationId ?? INEA_PADUA_STATION_ID;
  const publicPageUrl =
    data?.station.publicPageUrl ?? INEA_PADUA_PUBLIC_PAGE_URL;

  const attentionCm = data?.station.gaugeReference.attentionStageCm ?? 400;
  const overflowCm = data?.station.gaugeReference.overflowStageCm ?? 500;

  let trendText = "Não calculável";
  let trendSubtext = "sem par válido na última hora";
  let trendClassName = "";

  if (viewState === "loading") {
    trendText = "Consultando...";
    trendSubtext = "aguardando leitura recente";
  } else if (viewState === "unavailable" || viewState === "invalid") {
    trendText = "Indisponível";
    trendSubtext = "sem leitura válida";
  } else if (trend) {
    const absMeters = formatMetersFromCm(Math.abs(trend.deltaCm));
    if (trend.direction === "rising") {
      trendText = "Subindo ↗";
      trendSubtext = `+${absMeters} m em ${trend.windowMinutes} min`;
      trendClassName = "warning";
    } else if (trend.direction === "falling") {
      trendText = "Descendo ↘";
      trendSubtext = `-${absMeters} m em ${trend.windowMinutes} min`;
      trendClassName = "hydro-trend-falling";
    } else {
      const sign = trend.deltaCm >= 0 ? "+" : "-";
      trendText = "Estável →";
      trendSubtext = `${sign}${absMeters} m em ${trend.windowMinutes} min`;
    }
  }

  const alertMessage =
    viewState === "stale"
      ? "A última medição recebida tem mais de 45 minutos. Consulte também a página oficial do INEA."
      : viewState === "invalid"
        ? "Não foi possível validar a resposta recebida da fonte. Consulte o monitoramento oficial do INEA."
        : "Consulta automática indisponível no momento. Consulte o monitoramento oficial do INEA.";

  return (
    <article
      ref={cardRef}
      id={id}
      tabIndex={-1}
      className="card realtime"
      data-classification="observed"
      aria-labelledby={`${id}-title`}
    >
      <div className="card-heading hydro-heading">
        <div>
          <strong id={`${id}-title`}>Monitoramento do Rio Pomba</strong>
          <div className="hydro-tag-row">
            <span
              className="data-origin-badge observed"
              data-classification="observed"
            >
              Dado observado · INEA
            </span>
            <span
              className={`hydro-status-pill ${viewState}`}
              role="status"
              aria-live="polite"
            >
              <i aria-hidden="true" /> {statusLabel(viewState)}
            </span>
          </div>
        </div>
      </div>

      <h2 className="hydro-station-title">
        Estação {stationName}
      </h2>
      <p className="hydro-station-meta">
        INEA — Alerta de Cheias · Cód. {stationCode} (ANA FLU 58774000)
      </p>

      <div className="river-grid">
        <div>
          <span>Nível do rio</span>
          {viewState === "loading" ? (
            <strong className="hydro-value-muted">Consultando...</strong>
          ) : stageCm !== null ? (
            <>
              <b>{formatMetersFromCm(stageCm)} m</b>
              <em className="hydro-cell-sub">{stageCm} cm na régua INEA</em>
            </>
          ) : (
            <strong className="hydro-value-unavailable">Indisponível</strong>
          )}
        </div>

        <div>
          <span>Tendência observada</span>
          <strong className={trendClassName}>{trendText}</strong>
          <em className="hydro-cell-sub">{trendSubtext}</em>
        </div>

        <div>
          <span>Horário da medição</span>
          <strong className="hydro-time-val">
            <time dateTime={data?.measuredAt ?? undefined}>
              {formatBrazilDateTime(data?.measuredAt)}
            </time>
          </strong>
          <em className="hydro-cell-sub">
            {effectiveAgeMinutes !== null
              ? `há ${effectiveAgeMinutes} min · leituras a cada 15 min`
              : "horário de Brasília"}
          </em>
        </div>

        <div>
          <span>Última consulta</span>
          <strong className="hydro-time-val">
            <time dateTime={data?.retrievedAt ?? undefined}>
              {formatBrazilDateTime(data?.retrievedAt)}
            </time>
          </strong>
          <em className="hydro-cell-sub">
            verificação automática a cada 5 min
          </em>
        </div>
      </div>

      {availableRain.length > 0 && (
        <div className="hydro-rain-box" aria-label="Chuva acumulada observada">
          <span className="hydro-rain-title">
            Chuva acumulada (estação {stationCode})
          </span>
          <div className="hydro-rain-grid">
            {availableRain.map((rain) => (
              <div key={rain.window} className="hydro-rain-chip">
                <span>{rain.label}</span>
                <strong>{formatRainMm(rain.rainMm!)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {(viewState === "stale" ||
        viewState === "unavailable" ||
        viewState === "invalid") && (
        <p className={`hydro-condition-alert ${viewState}`} role="status">
          {alertMessage}
        </p>
      )}

      <p className="hydro-gauge-ref">
        Cotas de referência na régua INEA: atenção {formatMetersFromCm(attentionCm)} m ·
        transbordo {formatMetersFromCm(overflowCm)} m (zero da régua e datum
        vertical ainda não confirmados).
      </p>

      <div className="hydro-actions">
        <button
          type="button"
          className="hydro-refresh-btn"
          onClick={refreshNow}
          disabled={isRefreshing}
          title="Consultar novamente o monitoramento do INEA"
        >
          {isRefreshing ? "Atualizando..." : "Atualizar leitura"}
        </button>
        <a
          className="source-link"
          href={publicPageUrl}
          target="_blank"
          rel="noreferrer"
        >
          Monitoramento oficial INEA ({stationCode}) ↗
        </a>
      </div>

      <small>
        <strong>Separação das referências:</strong> esta medição é feita na
        estação do INEA (~6 km a montante do centro) e não altera
        automaticamente o cenário exibido no mapa (baseado na estação SGB/ANA
        58790002), pois o zero da régua e o datum do INEA ainda não foram
        identificados e a equivalência entre as referências não foi
        estabelecida.
      </small>
    </article>
  );
}

export function HydroMonitoringCard({
  cardRef,
  monitoring,
  id,
}: Readonly<HydroMonitoringCardProps>) {
  if (monitoring) {
    return (
      <HydroMonitoringCardView
        cardRef={cardRef}
        monitoring={monitoring}
        id={id}
      />
    );
  }
  return <StandaloneHydroMonitoringCard cardRef={cardRef} id={id} />;
}

function StandaloneHydroMonitoringCard({
  cardRef,
  id,
}: Readonly<{
  cardRef?: RefObject<HTMLElement | null>;
  id?: string;
}>) {
  const monitoring = useHydroMonitoring();
  return (
    <HydroMonitoringCardView
      cardRef={cardRef}
      monitoring={monitoring}
      id={id}
    />
  );
}
