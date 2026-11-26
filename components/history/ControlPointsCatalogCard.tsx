"use client";

import type {
  ControlPointCategory,
  ControlPointEvidenceState,
  HistoricalControlPoint,
} from "@/lib/history/contract";
import type { GeoPoint } from "@/lib/sgb/location";

function getCategoryLabel(category: ControlPointCategory): string {
  switch (category) {
    case "urban_square":
      return "Praça urbana";
    case "fluvial_island":
      return "Ilha fluvial";
    case "marginal_avenue":
      return "Via / avenida marginal";
    case "bridge_or_footbridge":
      return "Ponte / passarela";
    case "critical_facility":
      return "Equipamento crítico";
    case "tributary_urban_area":
      return "Área de tributário (Rio Pirapetinga)";
  }
}

export function getControlPointEvidenceLabel(
  state: ControlPointEvidenceState,
): string {
  switch (state) {
    case "water_present":
      return "Água presente documentada";
    case "water_absent":
      return "Água ausente comprovada";
    case "unknown":
      return "Situação desconhecida (sem inferência por falta de foto)";
  }
}

export function ControlPointsCatalogCard({
  controlPoints,
  onInspectCoordinateOnMap,
}: Readonly<{
  controlPoints: readonly HistoricalControlPoint[];
  onInspectCoordinateOnMap: (point: GeoPoint, label: string) => void;
}>) {
  return (
    <article
      className="card history-control-points-card"
      aria-labelledby="control-points-catalog-title"
    >
      <div className="card-heading">
        <div>
          <strong id="control-points-catalog-title">
            Pontos de controle para validação científica futura
          </strong>
          <p className="section-lead history-sublead">
            Estrutura preparada para avaliação das manchas oficiais do SGB e do
            futuro modelo próprio DEM + conectividade. Coordenadas não auditadas
            permanecem nulas e ausência de fotografia nunca é convertida em
            ausência de inundação.
          </p>
        </div>
        <span
          className="data-origin-badge official"
          data-classification="official_reference"
        >
          Protocolo de validação
        </span>
      </div>

      <div className="control-points-grid">
        {controlPoints.map((cp) => (
          <div key={cp.id} className="control-point-item">
            <div className="control-point-head">
              <strong>{cp.name}</strong>
              <span className="control-point-cat">
                {getCategoryLabel(cp.category)}
              </span>
            </div>

            <p className="control-point-sector">{cp.neighborhoodOrSector}</p>

            <div className="control-point-coord-row">
              {cp.coordinatesWgs84 ? (
                <>
                  <span className="coord-verified-pill">
                    WGS84 auditada:{" "}
                    {cp.coordinatesWgs84.lat.toFixed(6).replace(".", ",")},{" "}
                    {cp.coordinatesWgs84.lon.toFixed(6).replace(".", ",")}
                  </span>
                  <button
                    type="button"
                    className="location-inline-btn"
                    onClick={() =>
                      cp.coordinatesWgs84 &&
                      onInspectCoordinateOnMap(cp.coordinatesWgs84, cp.name)
                    }
                  >
                    Consultar ponto no mapa
                  </button>
                </>
              ) : (
                <span className="coord-null-pill">
                  Coordenada pontual mantida nula (sem geocodificação arbitrária)
                </span>
              )}
            </div>

            <p className="control-point-meta">
              <strong>Procedência geométrica:</strong> {cp.coordinateProvenance}
            </p>
            <p className="control-point-meta">
              <strong>Comportamento na referência SGB:</strong>{" "}
              {cp.sgbReferenceBehaviorNote}
            </p>
            <p className="control-point-meta">
              <strong>Função científica:</strong> {cp.validationUsageNote}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
