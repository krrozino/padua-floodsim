"use client";

import type { RefObject } from "react";
import {
  INEA_PADUA_PUBLIC_PAGE_URL,
  INEA_PADUA_STATION_ID,
} from "@/lib/hydro/ineaParser";
import {
  useHydroMonitoring,
  type HydroViewState,
} from "@/lib/hydro/useHydroMonitoring";

export interface HydroMonitoringCardProps {
  readonly cardRef?: RefObject<HTMLElement | null>;
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
      return "Carregando...";
    case "fresh":
      return "Atualizado";
    case "stale":
      return "Desatualizado";
    case "unavailable":
      return "Fonte indisponível";
    case "invalid":
      return "Dado inválido";
  }
}

export function HydroMonitoringCard({
  cardRef,
}: Readonly<HydroMonitoringCardProps>) {
  const {
    viewState,
    data,
    effectiveAgeMinutes,
    isRefreshing,
    errorMessage,
    refreshNow,
  } = useHydroMonitoring();

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
  let trendSubtext = "sem par válido ~1 h";
  let trendClassName = "";

  if (viewState === "loading") {
    trendText = "Consultando...";
    trendSubtext = "aguardando série recente";
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

  return (
    <article
      ref={cardRef}
      id="realtime-card"
      tabIndex={-1}
      className="card realtime"
      aria-labelledby="hydro-card-title"
    >
      <div className="card-heading hydro-heading">
        <div>
          <strong id="hydro-card-title">Monitoramento hidrológico</strong>
          <div className="hydro-tag-row">
            <span
              className="classification-pill"
              title="Classificação de proveniência: leitura observada em estação oficial"
            >
              observed
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
        Rio Pomba · Estação {stationName}
      </h2>
      <p className="hydro-station-meta">
        INEA — Alerta de Cheias · Cód. {stationCode}
      </p>

      <div className="river-grid">
        <div>
          <span>Nível observado</span>
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
          <span>Tendência recente</span>
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
              ? `há ${effectiveAgeMinutes} min · cadência 15 min`
              : "fuso America/Sao_Paulo"}
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
            atualização automática a cada 5 min
          </em>
        </div>
      </div>

      {availableRain.length > 0 && (
        <div className="hydro-rain-box" aria-label="Chuva acumulada observada">
          <span className="hydro-rain-title">Chuva observada (estação {stationCode})</span>
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
          {viewState === "stale"
            ? data?.message ||
              "Leitura fora da janela recente de atualização (acima de 45 min)."
            : errorMessage ||
              data?.message ||
              "Leitura observada indisponível no momento."}
        </p>
      )}

      <p className="hydro-gauge-ref">
        Referência local INEA: atenção (80%) {formatMetersFromCm(attentionCm)} m ·
        transbordo {formatMetersFromCm(overflowCm)} m (zero da régua e datum
        ainda não identificados).
      </p>

      <div className="hydro-actions">
        <button
          type="button"
          className="hydro-refresh-btn"
          onClick={refreshNow}
          disabled={isRefreshing}
          title="Consultar novamente o serviço de monitoramento observado"
        >
          {isRefreshing ? "Atualizando..." : "Atualizar leitura"}
        </button>
        <a
          className="source-link"
          href={publicPageUrl}
          target="_blank"
          rel="noreferrer"
        >
          Fonte oficial INEA ({stationCode}) ↗
        </a>
      </div>

      <small>
        <strong>Independência científica:</strong> Leitura observada na estação
        INEA {stationCode} (-21,5111°, -42,2075°). Não altera automaticamente a
        mancha oficial SGB (estação RHN 58790002): as estações possuem
        localizações físicas distintas, o zero da régua e o datum do INEA ainda
        não foram identificados e a equivalência entre as referências não foi
        estabelecida (crosswalk não validado).
      </small>
    </article>
  );
}
