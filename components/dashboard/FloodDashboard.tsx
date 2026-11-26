"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { CompactScenarioControls } from "@/components/dashboard/CompactScenarioControls";
import {
  FloodMap,
  type FloodLayerStatus,
} from "@/components/map/FloodMap";
import {
  LocationQueryCard,
  type LocationPointOrigin,
} from "@/components/dashboard/LocationQueryCard";
import { MethodologyModal } from "@/components/dashboard/MethodologyModal";
import {
  AboutMethodologySection,
  DataSourcesSection,
  MonitoringSection,
} from "@/components/dashboard/PlatformSections";
import { ScenarioAreaChart } from "@/components/dashboard/ScenarioAreaChart";
import { ScenarioComparisonCard } from "@/components/dashboard/ScenarioComparisonCard";
import type { HistoricalMapAssociationSelection } from "@/components/history/EventDetailPanel";
import { FloodHistorySection } from "@/components/history/FloodHistorySection";
import { HydroMonitoringCard } from "@/components/monitoring/HydroMonitoringCard";
import { useHydroMonitoring } from "@/lib/hydro/useHydroMonitoring";
import {
  formatFloodArea,
  type DerivedFloodAreaResult,
  type FloodAreaInput,
} from "@/lib/sgb/area";
import {
  SGB_REFERENCE_STATION_LABEL,
  checkCatalogAreaDivergence,
  type CatalogAreaDivergenceCheck,
} from "@/lib/sgb/areaCatalog";
import type { ScenarioComparisonResult } from "@/lib/sgb/compare";
import {
  evaluatePointAgainstFloodScenario,
  evaluatePointInComparison,
  type GeoPoint,
  type PointComparisonQueryResult,
  type PointScenarioQueryResult,
  type SpatialPointRelation,
} from "@/lib/sgb/location";
import {
  SGB_FLOOD_LEVELS_CM,
  SGB_STAGE_ELEVATIONS,
  type SgbFloodLevelCm,
} from "@/lib/sgb/stages";
import { useCrossStagePointQuery } from "@/lib/sgb/useCrossStagePointQuery";
import type { FloodGeometry } from "@/lib/sgb/useSgbFlood";

export type PlatformSection =
  | "mapa"
  | "historico"
  | "monitoramento"
  | "fontes"
  | "sobre";
export type MapScenarioMode = "single" | "compare";

function formatMetersFromCm(levelCm: number) {
  return (levelCm / 100).toFixed(2).replace(".", ",");
}

function resolveMarkerRelation(
  selectedPoint: GeoPoint | null,
  mapMode: MapScenarioMode,
  singlePointResult: PointScenarioQueryResult | null,
  comparePointResult: PointComparisonQueryResult | null,
): SpatialPointRelation {
  if (!selectedPoint) return "unavailable";
  if (mapMode === "single") {
    return singlePointResult?.relation ?? "unavailable";
  }
  if (comparePointResult?.status !== "valid") {
    return "unavailable";
  }
  if (comparePointResult.combinedRelation === "neither") {
    return "outside";
  }
  if (
    comparePointResult.relationA === "inside" ||
    comparePointResult.relationB === "inside"
  ) {
    return "inside";
  }
  if (
    comparePointResult.relationA === "boundary" ||
    comparePointResult.relationB === "boundary"
  ) {
    return "boundary";
  }
  return "outside";
}

function resolveBadgeVisualState(
  mapMode: MapScenarioMode,
  layerStatus: FloodLayerStatus,
  layerStatusB: FloodLayerStatus | null,
  levelCm: number,
  levelBCm: number,
): FloodLayerStatus["state"] {
  if (mapMode === "single") {
    return layerStatus.levelCm === levelCm ? layerStatus.state : "loading";
  }
  const aCurrent = layerStatus.levelCm === levelCm ? layerStatus.state : "loading";
  const bCurrent =
    layerStatusB?.levelCm === levelBCm ? layerStatusB.state : "loading";

  if (aCurrent === "error" || bCurrent === "error") return "error";
  if (aCurrent === "empty" || bCurrent === "empty") return "empty";
  if (aCurrent === "official" && bCurrent === "official") return "official";
  return "loading";
}

function resolveMapBadgeText(
  mapMode: MapScenarioMode,
  badgeVisualState: FloodLayerStatus["state"],
  layerStatus: FloodLayerStatus,
  ortometricElevation: number | undefined,
  levelCm: number,
  levelBCm: number,
): string {
  if (mapMode === "compare") {
    if (badgeVisualState === "official") {
      return `Comparação A ${formatMetersFromCm(levelCm)} m × B ${formatMetersFromCm(levelBCm)} m`;
    }
    if (badgeVisualState === "error") {
      return "Falha ao carregar camada(s) SGB · comparação pausada";
    }
    if (badgeVisualState === "empty") {
      return "SGB retornou camada vazia · comparação indisponível";
    }
    return `Carregando cenários SGB (${formatMetersFromCm(levelCm)} m e ${formatMetersFromCm(levelBCm)} m)...`;
  }

  if (layerStatus.levelCm !== levelCm) {
    return "Carregando cenário oficial do SGB...";
  }
  if (layerStatus.state === "official") {
    const orthoLabel = ortometricElevation
      ? ` (${ortometricElevation.toFixed(2).replace(".", ",")} m ortométrica)`
      : "";
    return `Cota ${formatMetersFromCm(layerStatus.levelCm)} m${orthoLabel}`;
  }
  if (layerStatus.state === "error") {
    return "Mancha SGB indisponível · nenhuma extensão exibida";
  }
  if (layerStatus.state === "empty") {
    return "SGB retornou camada vazia · nenhuma extensão exibida";
  }
  return "Carregando cenário oficial do SGB...";
}

const NAV_ITEMS: readonly { readonly id: PlatformSection; readonly label: string }[] = [
  { id: "mapa", label: "Mapa e cenários" },
  { id: "historico", label: "Histórico" },
  { id: "monitoramento", label: "Monitoramento" },
  { id: "fontes", label: "Dados e fontes" },
  { id: "sobre", label: "Sobre e metodologia" },
];

export function FloodDashboard() {
  const [activeSection, setActiveSection] = useState<PlatformSection>("mapa");
  const [mapMode, setMapMode] = useState<MapScenarioMode>("single");
  const [level, setLevel] = useState(4.25);
  const [compareLevelB, setCompareLevelB] = useState(5.5);
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);
  const [historicalMapContext, setHistoricalMapContext] =
    useState<HistoricalMapAssociationSelection | null>(null);
  const [isScenarioCollapsed, setIsScenarioCollapsed] = useState(false);
  const [isMapFocus, setIsMapFocus] = useState(false);

  const handleToggleMapFocus = useCallback(() => {
    if (!isMapFocus) setIsScenarioCollapsed(true);
    setIsMapFocus(!isMapFocus);
  }, [isMapFocus]);

  useEffect(() => {
    if (!isMapFocus || isMethodologyOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        setIsMapFocus(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isMapFocus, isMethodologyOpen]);

  const [layerStatus, setLayerStatus] = useState<FloodLayerStatus>({
    state: "loading",
    levelCm: 425,
  });
  const [layerStatusB, setLayerStatusB] = useState<FloodLayerStatus | null>(
    null,
  );
  const [derivedArea, setDerivedArea] = useState<DerivedFloodAreaResult | null>(
    null,
  );
  const [derivedAreaB, setDerivedAreaB] =
    useState<DerivedFloodAreaResult | null>(null);
  const [comparison, setComparison] =
    useState<ScenarioComparisonResult | null>(null);

  const [retryToken, setRetryToken] = useState(0);
  const [retryTokenB, setRetryTokenB] = useState(0);

  const [selectedPoint, setSelectedPoint] = useState<GeoPoint | null>(null);
  const [pointOrigin, setPointOrigin] = useState<LocationPointOrigin | null>(
    null,
  );
  const [flyToPointToken, setFlyToPointToken] = useState(0);
  const [scenarioAGeom, setScenarioAGeom] = useState<{
    readonly levelCm: number;
    readonly geojson: FloodGeometry | null;
  }>({ levelCm: 425, geojson: null });
  const [scenarioBGeom, setScenarioBGeom] = useState<{
    readonly levelCm: number;
    readonly geojson: FloodGeometry | null;
  }>({ levelCm: 550, geojson: null });

  const monitoring = useHydroMonitoring();
  const mapPanelRef = useRef<HTMLElement | null>(null);
  const realtimeCardRef = useRef<HTMLElement | null>(null);

  const levelCm = Math.round(level * 100);
  const levelBCm = Math.round(compareLevelB * 100);
  const ortometricElevation = SGB_STAGE_ELEVATIONS[levelCm as SgbFloodLevelCm];
  const ortometricElevationB =
    SGB_STAGE_ELEVATIONS[levelBCm as SgbFloodLevelCm];
  const minLevel = SGB_FLOOD_LEVELS_CM[0] / 100;
  const maxLevel = SGB_FLOOD_LEVELS_CM[SGB_FLOOD_LEVELS_CM.length - 1] / 100;

  const handleScenarioAGeometryChange = useCallback(
    (geojson: FloodGeometry | null, geomLevelCm: number) => {
      setScenarioAGeom({ levelCm: geomLevelCm, geojson });
    },
    [],
  );

  const handleScenarioBGeometryChange = useCallback(
    (geojson: FloodGeometry | null, geomLevelCm: number) => {
      setScenarioBGeom({ levelCm: geomLevelCm, geojson });
    },
    [],
  );

  const handleMapPointSelect = useCallback((point: GeoPoint) => {
    setSelectedPoint(point);
    setPointOrigin("map_click");
  }, []);

  const handleSubmitCoordinates = useCallback((point: GeoPoint) => {
    setSelectedPoint(point);
    setPointOrigin("coordinates");
    setFlyToPointToken((prev) => prev + 1);
  }, []);

  const handleClearPoint = useCallback(() => {
    setSelectedPoint(null);
    setPointOrigin(null);
  }, []);

  const handleFocusPoint = useCallback(() => {
    setFlyToPointToken((prev) => prev + 1);
  }, []);

  const handleSelectStageFromMatrix = useCallback((nextLevel: number) => {
    setMapMode("single");
    setLevel(nextLevel);
  }, []);

  const activeScenarioAGeojson =
    layerStatus.state === "official" &&
    layerStatus.levelCm === levelCm &&
    scenarioAGeom.levelCm === levelCm
      ? scenarioAGeom.geojson
      : null;

  const activeScenarioBGeojson =
    mapMode === "compare" &&
    layerStatusB?.state === "official" &&
    layerStatusB.levelCm === levelBCm &&
    scenarioBGeom.levelCm === levelBCm
      ? scenarioBGeom.geojson
      : null;

  const singlePointResult = useMemo(() => {
    if (!selectedPoint || mapMode !== "single") return null;
    return evaluatePointAgainstFloodScenario(
      selectedPoint,
      activeScenarioAGeojson,
      levelCm,
    );
  }, [selectedPoint, mapMode, activeScenarioAGeojson, levelCm]);

  const comparePointResult = useMemo(() => {
    if (!selectedPoint || mapMode !== "compare") return null;
    return evaluatePointInComparison(
      selectedPoint,
      activeScenarioAGeojson,
      levelCm,
      activeScenarioBGeojson,
      levelBCm,
    );
  }, [
    selectedPoint,
    mapMode,
    activeScenarioAGeojson,
    levelCm,
    activeScenarioBGeojson,
    levelBCm,
  ]);

  const markerRelation: SpatialPointRelation = useMemo(
    () =>
      resolveMarkerRelation(
        selectedPoint,
        mapMode,
        singlePointResult,
        comparePointResult,
      ),
    [selectedPoint, mapMode, singlePointResult, comparePointResult],
  );

  const preloadedStagesForCrossQuery = useMemo(() => {
    const map: Partial<Record<SgbFloodLevelCm, FloodAreaInput>> = {};
    if (activeScenarioAGeojson) {
      map[levelCm as SgbFloodLevelCm] = activeScenarioAGeojson;
    }
    if (activeScenarioBGeojson) {
      map[levelBCm as SgbFloodLevelCm] = activeScenarioBGeojson;
    }
    return map;
  }, [activeScenarioAGeojson, levelCm, activeScenarioBGeojson, levelBCm]);

  const crossStage = useCrossStagePointQuery(
    selectedPoint,
    preloadedStagesForCrossQuery,
  );

  const handleRetry = useCallback(() => {
    setRetryToken((prev) => prev + 1);
  }, []);

  const handleRetryB = useCallback(() => {
    setRetryTokenB((prev) => prev + 1);
  }, []);

  const handleRetryActive = useCallback(() => {
    if (mapMode === "compare") {
      if (layerStatus.state === "error" || layerStatus.state === "empty") {
        setRetryToken((prev) => prev + 1);
      }
      if (layerStatusB?.state === "error" || layerStatusB?.state === "empty") {
        setRetryTokenB((prev) => prev + 1);
      }
    } else {
      setRetryToken((prev) => prev + 1);
    }
  }, [mapMode, layerStatus.state, layerStatusB?.state]);

  const handleOpenMethodology = useCallback(() => {
    setIsMethodologyOpen(true);
  }, []);

  const handleCloseMethodology = useCallback(() => {
    setIsMethodologyOpen(false);
  }, []);

  const handleGoToMap = useCallback(() => {
    setActiveSection("mapa");
  }, []);

  const handleGoToSources = useCallback(() => {
    setActiveSection("fontes");
  }, []);

  const handleSelectStageAndOpenMap = useCallback((nextLevel: number) => {
    setHistoricalMapContext(null);
    setLevel(nextLevel);
    setMapMode("single");
    setActiveSection("mapa");
  }, []);

  const handleSelectHistoricalMapScenario = useCallback(
    (selection: HistoricalMapAssociationSelection) => {
      setHistoricalMapContext(selection);
      setLevel(selection.stageACm / 100);
      if (selection.mode === "compare" && selection.stageBCm !== null) {
        setCompareLevelB(selection.stageBCm / 100);
        setMapMode("compare");
      } else {
        setMapMode("single");
      }
      setActiveSection("mapa");
    },
    [],
  );

  const handleInspectCoordinateFromHistory = useCallback((point: GeoPoint) => {
    setSelectedPoint(point);
    setPointOrigin("coordinates");
    setActiveSection("mapa");
    setFlyToPointToken((prev) => prev + 1);
  }, []);

  const activeHistoricalContext = useMemo(() => {
    if (!historicalMapContext) return null;
    if (historicalMapContext.mode !== mapMode) return null;
    if (historicalMapContext.stageACm !== levelCm) return null;
    if (
      mapMode === "compare" &&
      historicalMapContext.stageBCm !== levelBCm
    ) {
      return null;
    }
    return historicalMapContext;
  }, [historicalMapContext, mapMode, levelCm, levelBCm]);

  const handleStepLevel = useCallback(
    (deltaMeters: number) => {
      setLevel((prev) => {
        const next = Math.round((prev + deltaMeters) * 100) / 100;
        if (next < minLevel) return minLevel;
        if (next > maxLevel) return maxLevel;
        return next;
      });
    },
    [minLevel, maxLevel],
  );

  const handleStepLevelB = useCallback(
    (deltaMeters: number) => {
      setCompareLevelB((prev) => {
        const next = Math.round((prev + deltaMeters) * 100) / 100;
        if (next < minLevel) return minLevel;
        if (next > maxLevel) return maxLevel;
        return next;
      });
    },
    [minLevel, maxLevel],
  );

  const handleSwapLevels = useCallback(() => {
    setLevel(compareLevelB);
    setCompareLevelB(level);
  }, [level, compareLevelB]);

  const handleChartSelectCompare = useCallback(
    (target: "A" | "B", levelMeters: number) => {
      if (target === "A") {
        setLevel(levelMeters);
      } else {
        setCompareLevelB(levelMeters);
      }
    },
    [],
  );

  const badgeVisualState = useMemo(
    () =>
      resolveBadgeVisualState(
        mapMode,
        layerStatus,
        layerStatusB,
        levelCm,
        levelBCm,
      ),
    [mapMode, layerStatus, layerStatusB, levelCm, levelBCm],
  );

  const mapBadge = useMemo(
    () =>
      resolveMapBadgeText(
        mapMode,
        badgeVisualState,
        layerStatus,
        ortometricElevation,
        levelCm,
        levelBCm,
      ),
    [
      mapMode,
      badgeVisualState,
      layerStatus,
      ortometricElevation,
      levelCm,
      levelBCm,
    ],
  );

  const validDerivedArea =
    layerStatus.state === "official" &&
    layerStatus.levelCm === levelCm &&
    derivedArea?.status === "valid" &&
    derivedArea.levelCm === levelCm
      ? derivedArea
      : null;

  const validDerivedAreaB =
    mapMode === "compare" &&
    layerStatusB?.state === "official" &&
    layerStatusB.levelCm === levelBCm &&
    derivedAreaB?.status === "valid" &&
    derivedAreaB.levelCm === levelBCm
      ? derivedAreaB
      : null;

  const formattedArea = validDerivedArea
    ? formatFloodArea(validDerivedArea.areaSquareMeters)
    : null;

  const catalogAreaDivergences: readonly CatalogAreaDivergenceCheck[] = useMemo(() => {
    const checks: CatalogAreaDivergenceCheck[] = [];
    if (validDerivedArea) {
      checks.push(
        checkCatalogAreaDivergence(
          validDerivedArea.levelCm as SgbFloodLevelCm,
          validDerivedArea.areaSquareMeters,
        ),
      );
    }
    if (validDerivedAreaB && validDerivedAreaB.levelCm !== validDerivedArea?.levelCm) {
      checks.push(
        checkCatalogAreaDivergence(
          validDerivedAreaB.levelCm as SgbFloodLevelCm,
          validDerivedAreaB.areaSquareMeters,
        ),
      );
    }
    return checks;
  }, [validDerivedArea, validDerivedAreaB]);

  return (
    <div className={`platform-root ${isMapFocus && activeSection === "mapa" ? "is-map-focused" : ""}`}>
      {/* Top Navigation Bar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            ≈
          </div>
          <div>
            <h1>Pádua FloodSim</h1>
            <span>Santo Antônio de Pádua, RJ · Rio Pomba</span>
          </div>
        </div>

        <nav className="topnav" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-btn ${activeSection === item.id ? "active" : ""}`}
              aria-current={activeSection === item.id ? "page" : undefined}
              onClick={() => setActiveSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="platform-main">
        {/* View A: Interactive Map & Official SGB Scenarios */}
        <div
          className={`map-workspace ${activeSection === "mapa" ? "" : "is-hidden"}`}
          aria-hidden={activeSection !== "mapa"}
        >
          <section
            className="map-panel"
            ref={mapPanelRef}
            tabIndex={-1}
            aria-label="Mapa e cenários de inundação"
          >
            <FloodMap
              level={level}
              mode={mapMode}
              compareLevelB={compareLevelB}
              selectedPoint={selectedPoint}
              selectedPointRelation={markerRelation}
              flyToPointToken={flyToPointToken}
              onMapPointSelect={handleMapPointSelect}
              onScenarioAGeometryChange={handleScenarioAGeometryChange}
              onScenarioBGeometryChange={handleScenarioBGeometryChange}
              onStatusChange={setLayerStatus}
              onStatusBChange={setLayerStatusB}
              onDerivedAreaChange={setDerivedArea}
              onDerivedAreaBChange={setDerivedAreaB}
              onComparisonChange={setComparison}
              retryToken={retryToken}
              retryTokenB={retryTokenB}
              isVisible={activeSection === "mapa"}
              isMapFocus={isMapFocus}
              onToggleMapFocus={handleToggleMapFocus}
            />

            {/* Bottom Scenario Controls */}
            <div className={`slider-card ${mapMode === "compare" ? "is-compare" : ""} ${isScenarioCollapsed ? "is-collapsed" : ""}`}>
              <div className="scenario-panel-heading">
                <strong>Controles de cota SGB</strong>
                <button
                  type="button"
                  className="scenario-collapse-btn"
                  aria-expanded={!isScenarioCollapsed}
                  aria-controls="scenario-expanded-controls"
                  onClick={() => setIsScenarioCollapsed((value) => !value)}
                >
                  {isScenarioCollapsed ? "Expandir controles" : "Recolher controles"}
                </button>
              </div>
              {isScenarioCollapsed && (
                <CompactScenarioControls
                  mode={mapMode}
                  levelCm={levelCm}
                  levelBCm={levelBCm}
                  onChangeLevel={setLevel}
                  onChangeLevelB={setCompareLevelB}
                  onStepLevel={handleStepLevel}
                  onModeChange={setMapMode}
                  onSwapLevels={handleSwapLevels}
                  mapBadge={mapBadge}
                  badgeState={badgeVisualState}
                  onRetry={handleRetryActive}
                />
              )}
              <div id="scenario-expanded-controls" hidden={isScenarioCollapsed}>
              <div className="slider-status-bar">
                <div className={`scenario-status-badge ${badgeVisualState}`}>
                  <span
                    className="data-origin-badge official"
                    data-classification="official_reference"
                  >
                    Cenário oficial SGB
                  </span>
                  <span role="status" aria-live="polite">
                    {mapBadge}
                  </span>
                  {(badgeVisualState === "error" ||
                    badgeVisualState === "empty") && (
                    <button
                      type="button"
                      className="badge-retry-btn"
                      onClick={handleRetryActive}
                      title="Tentar carregar novamente a mancha do SGB"
                    >
                      Tentar novamente
                    </button>
                  )}
                </div>

                <div className="slider-status-actions">
                  <div
                    className="mode-toggle-group"
                    role="group"
                    aria-label="Modo de visualização de cenários"
                  >
                    <button
                      type="button"
                      className={`mode-toggle-btn ${
                        mapMode === "single" ? "active" : ""
                      }`}
                      aria-pressed={mapMode === "single"}
                      onClick={() => setMapMode("single")}
                    >
                      Cenário único
                    </button>
                    <button
                      type="button"
                      className={`mode-toggle-btn ${
                        mapMode === "compare" ? "active" : ""
                      }`}
                      aria-pressed={mapMode === "compare"}
                      onClick={() => setMapMode("compare")}
                    >
                      Comparar cenários
                    </button>
                  </div>

                  <button
                    type="button"
                    className="methodology-trigger-btn"
                    onClick={handleOpenMethodology}
                    title="Ver detalhes de fonte, estação e metodologia do SGB (2024)"
                  >
                    Fonte e metodologia
                  </button>
                </div>
              </div>

              {mapMode === "single" ? (
                <>
                  <div className="slider-title">
                    <div>
                      <strong>{SGB_REFERENCE_STATION_LABEL}</strong>
                      <span>
                        Cenário estático de referência (não indica a extensão
                        atual do rio nem profundidade). Não confundir com a
                        leitura da estação INEA.
                      </span>
                    </div>
                    <div className="slider-value-group">
                      <b>{level.toFixed(2).replace(".", ",")} m</b>
                      {Number.isFinite(ortometricElevation) && (
                        <span className="elev-label">
                          Alt. ortométrica:{" "}
                          {ortometricElevation.toFixed(2).replace(".", ",")} m
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="slider-control-row">
                    <button
                      type="button"
                      className="stage-step-btn"
                      onClick={() => handleStepLevel(-0.25)}
                      disabled={level <= minLevel}
                      aria-label="Diminuir cota em 25 centímetros"
                      title="Diminuir 0,25 m"
                    >
                      −
                    </button>
                    <input
                      aria-label="Cota da mancha oficial do SGB"
                      type="range"
                      min={minLevel}
                      max={maxLevel}
                      step="0.25"
                      value={level}
                      aria-valuetext={`${level.toFixed(2).replace(".", ",")} metros, cenário oficial SGB`}
                      onChange={(event) => setLevel(Number(event.target.value))}
                    />
                    <button
                      type="button"
                      className="stage-step-btn"
                      onClick={() => handleStepLevel(0.25)}
                      disabled={level >= maxLevel}
                      aria-label="Aumentar cota em 25 centímetros"
                      title="Aumentar 0,25 m"
                    >
                      +
                    </button>
                  </div>

                  <div className="slider-scale">
                    <span>3,00 m</span>
                    <span>4,25 m</span>
                    <span>5,50 m</span>
                  </div>

                  {/* Quick Stage Shortcuts */}
                  <div
                    className="quick-stages"
                    role="group"
                    aria-label="Atalhos de cotas SGB"
                  >
                    <span className="quick-stages-label">Atalhos:</span>
                    {[3.0, 4.25, 5.5].map((stage) => {
                      const label = `${stage.toFixed(2).replace(".", ",")} m`;
                      return (
                        <button
                          key={stage}
                          type="button"
                          className={`stage-chip ${level === stage ? "active" : ""}`}
                          aria-pressed={level === stage}
                          onClick={() => setLevel(stage)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="compare-controls-wrap">
                  <div className="compare-controls-header">
                    <div>
                      <strong>{SGB_REFERENCE_STATION_LABEL}</strong>
                      <span>
                        Selecione duas cotas independentes (A e B) para sobrepor
                        topologicamente A ∩ B, A \ B e B \ A. Não confundir com a
                        estação INEA.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="compare-swap-btn"
                      onClick={handleSwapLevels}
                      title="Inverter cota A com cota B"
                    >
                      Inverter A ⇄ B
                    </button>
                  </div>

                  <div className="compare-selectors-grid">
                    {/* Selector A */}
                    <div className="compare-selector-box selector-a">
                      <div className="compare-selector-head">
                        <label htmlFor="compare-select-a">
                          <i className="legend-swatch-only-a" aria-hidden="true" />
                          Cenário A (base)
                        </label>
                        {Number.isFinite(ortometricElevation) && (
                          <span className="elev-label">
                            Alt. {ortometricElevation.toFixed(2).replace(".", ",")} m
                          </span>
                        )}
                      </div>
                      <div className="compare-selector-row">
                        <button
                          type="button"
                          className="stage-step-btn"
                          onClick={() => handleStepLevel(-0.25)}
                          disabled={level <= minLevel}
                          aria-label="Diminuir cota A em 25 centímetros"
                        >
                          −
                        </button>
                        <select
                          id="compare-select-a"
                          aria-label="Cota A de referência SGB"
                          className="compare-stage-select"
                          value={levelCm}
                          onChange={(e) => setLevel(Number(e.target.value) / 100)}
                        >
                          {SGB_FLOOD_LEVELS_CM.map((cm) => (
                            <option key={cm} value={cm}>
                              {formatMetersFromCm(cm)} m ({cm} cm)
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="stage-step-btn"
                          onClick={() => handleStepLevel(0.25)}
                          disabled={level >= maxLevel}
                          aria-label="Aumentar cota A em 25 centímetros"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Selector B */}
                    <div className="compare-selector-box selector-b">
                      <div className="compare-selector-head">
                        <label htmlFor="compare-select-b">
                          <i className="legend-swatch-only-b" aria-hidden="true" />
                          Cenário B (comparado)
                        </label>
                        {Number.isFinite(ortometricElevationB) && (
                          <span className="elev-label">
                            Alt. {ortometricElevationB.toFixed(2).replace(".", ",")} m
                          </span>
                        )}
                      </div>
                      <div className="compare-selector-row">
                        <button
                          type="button"
                          className="stage-step-btn"
                          onClick={() => handleStepLevelB(-0.25)}
                          disabled={compareLevelB <= minLevel}
                          aria-label="Diminuir cota B em 25 centímetros"
                        >
                          −
                        </button>
                        <select
                          id="compare-select-b"
                          aria-label="Cota B de referência SGB"
                          className="compare-stage-select"
                          value={levelBCm}
                          onChange={(e) =>
                            setCompareLevelB(Number(e.target.value) / 100)
                          }
                        >
                          {SGB_FLOOD_LEVELS_CM.map((cm) => (
                            <option key={cm} value={cm}>
                              {formatMetersFromCm(cm)} m ({cm} cm)
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="stage-step-btn"
                          onClick={() => handleStepLevelB(0.25)}
                          disabled={compareLevelB >= maxLevel}
                          aria-label="Aumentar cota B em 25 centímetros"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick comparison pairs */}
                  <div
                    className="quick-stages"
                    role="group"
                    aria-label="Atalhos de pares para comparação"
                  >
                    <span className="quick-stages-label">Pares rápidos:</span>
                    {[
                      { a: 3.0, b: 4.25, label: "3,00 × 4,25 m" },
                      { a: 3.0, b: 5.5, label: "3,00 × 5,50 m" },
                      { a: 4.25, b: 5.5, label: "4,25 × 5,50 m" },
                    ].map((pair) => {
                      const active = level === pair.a && compareLevelB === pair.b;
                      return (
                        <button
                          key={pair.label}
                          type="button"
                          className={`stage-chip ${active ? "active" : ""}`}
                          aria-pressed={active}
                          onClick={() => {
                            setLevel(pair.a);
                            setCompareLevelB(pair.b);
                          }}
                        >
                          {pair.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              </div>
              {isMapFocus && activeHistoricalContext?.historicalEquivalenceConfirmed === false && (
                <p className="map-focus-exploration-note">
                  Exploração independente de cenário SGB (2024), sem
                  equivalência histórica confirmada. A mancha estática modelada
                  não representa inundação observada.
                </p>
              )}
              {isMapFocus && (
                <p className="map-focus-notice">
                  Esta plataforma não substitui os alertas e as orientações dos órgãos oficiais.
                </p>
              )}
            </div>
          </section>

          {/* Right Contextual Information Panel */}
          <aside
            id="map-information-panel"
            className="right-panel"
            hidden={isMapFocus}
            aria-label="Informações hidrológicas e legenda"
          >
            <p className="official-notice-compact" role="note">
              Esta plataforma não substitui os alertas e as orientações dos
              órgãos oficiais.
            </p>

            {activeHistoricalContext && (
              <article
                className="card historical-map-context-banner"
                aria-labelledby="historical-map-context-title"
              >
                <div className="card-heading">
                  <strong id="historical-map-context-title">
                    {activeHistoricalContext.historicalEquivalenceConfirmed
                      ? `Associação com registro histórico (${activeHistoricalContext.eventId})`
                      : `Exploração independente de cenário SGB (${activeHistoricalContext.eventId})`}
                  </strong>
                  <span
                    className="data-origin-badge derived"
                    data-classification="derived"
                  >
                    {activeHistoricalContext.historicalEquivalenceConfirmed
                      ? "Referência aproximada"
                      : "Sem equivalência confirmada"}
                  </span>
                </div>
                <p className="historical-context-event">
                  <strong>{activeHistoricalContext.eventTitle}</strong> (
                  {activeHistoricalContext.eventPeriodLabel} · pico observado:{" "}
                  {activeHistoricalContext.observedPeakCm
                    .toString()
                    .replace(".", ",")}{" "}
                  cm em RHN 58790002).
                </p>
                <p className="historical-context-rep">
                  <strong>Classificação espacial exibida:</strong>{" "}
                  {activeHistoricalContext.representationLabel}.
                </p>
                <p className="historical-context-disclaimer">
                  {activeHistoricalContext.historicalEquivalenceConfirmed ? (
                    <>
                      Mancha estática modelada pelo SGB (2024):{" "}
                      <strong>não representa inundação observada</strong> nem
                      registro exato da extensão atingida na enchente histórica.
                    </>
                  ) : (
                    <>
                      <strong>
                        Equivalência altimétrica histórica NÃO confirmada:
                      </strong>{" "}
                      a continuidade do zero da régua em RHN 58790002 para este
                      período não possui registro oficial de nivelamento
                      verificado. Camada SGB (2024) exibida apenas para
                      exploração independente (
                      <strong>não representa inundação observada</strong>).
                    </>
                  )}
                </p>
                <div className="historical-context-actions">
                  <button
                    type="button"
                    className="location-inline-btn"
                    onClick={() => setActiveSection("historico")}
                  >
                    Voltar ao Histórico
                  </button>
                  <button
                    type="button"
                    className="location-inline-btn danger"
                    onClick={() => setHistoricalMapContext(null)}
                  >
                    {activeHistoricalContext.historicalEquivalenceConfirmed
                      ? "Desvincular evento"
                      : "Limpar contexto de exploração"}
                  </button>
                </div>
              </article>
            )}

            {/* Derived Spatial Metric: Single Scenario OR Topological Comparison */}
            {mapMode === "compare" ? (
              <ScenarioComparisonCard
                levelACm={levelCm}
                levelBCm={levelBCm}
                statusA={layerStatus}
                statusB={layerStatusB}
                comparison={comparison}
                onRetryA={handleRetry}
                onRetryB={handleRetryB}
              />
            ) : (
              validDerivedArea &&
              formattedArea && (
                <article
                  className="card area-metric-card"
                  data-classification="derived"
                  aria-labelledby="selected-area-title"
                >
                  <div className="card-heading">
                    <strong id="selected-area-title">
                      Área da mancha selecionada
                    </strong>
                    <span
                      className="data-origin-badge derived"
                      data-classification="derived"
                    >
                      Dado derivado
                    </span>
                  </div>
                  <div className="area-metric-values">
                    <b className="area-metric-primary">{formattedArea.primary}</b>
                    <span className="area-metric-secondary">
                      ({formattedArea.secondary})
                    </span>
                  </div>
                  <p className="area-metric-meta">
                    {SGB_REFERENCE_STATION_LABEL} ·{" "}
                    {formatMetersFromCm(validDerivedArea.levelCm)} m (
                    {validDerivedArea.levelCm} cm).
                  </p>
                  <small className="area-metric-note">
                    Cálculo geodésico (WGS84) sobre os polígonos oficiais
                    carregados. Representa apenas a extensão do cenário
                    escolhido, não a área inundada no momento.
                  </small>
                </article>
              )
            )}

            {/* Geographic Point Query & 11-Stage On-Demand Analysis */}
            <LocationQueryCard
              mode={mapMode}
              levelACm={levelCm}
              levelBCm={levelBCm}
              selectedPoint={selectedPoint}
              pointOrigin={pointOrigin}
              singleResult={singlePointResult}
              compareResult={comparePointResult}
              crossStageStatus={crossStage.status}
              crossStageCompleted={crossStage.completed}
              crossStageTotal={crossStage.total}
              crossStageCachedHits={crossStage.cachedHits}
              crossStageSummary={crossStage.summary}
              onSubmitCoordinates={handleSubmitCoordinates}
              onClearPoint={handleClearPoint}
              onFocusPoint={handleFocusPoint}
              onAnalyzeAllStages={crossStage.analyzeAllStages}
              onCancelAllStages={crossStage.cancelAnalysis}
              onSelectStageFromMatrix={handleSelectStageFromMatrix}
            />

            {/* Interactive 11-stage Area Chart (Cataloged Snapshot, 0 extra SGB fetches) */}
            <ScenarioAreaChart
              mode={mapMode}
              selectedLevelACm={levelCm}
              selectedLevelBCm={mapMode === "compare" ? levelBCm : undefined}
              onSelectSingleLevel={setLevel}
              onSelectCompareLevel={handleChartSelectCompare}
              catalogAreaDivergences={catalogAreaDivergences}
            />

            {/* Real INEA Hydro Monitoring Card */}
            <HydroMonitoringCard
              cardRef={realtimeCardRef}
              monitoring={monitoring}
              id="realtime-card"
            />

            {/* Map Legend & Sources Card */}
            <article className="card">
              <div className="card-heading">
                <strong>Legenda do mapa</strong>
              </div>

              <div className="legend-list">
                {mapMode === "compare" ? (
                  <>
                    <div className="official-layer-legend">
                      <i className="legend-swatch-common" aria-hidden="true" />
                      <div>
                        <strong>Área comum (A ∩ B)</strong>
                        <small>
                          Extensão presente simultaneamente nas cotas{" "}
                          {formatMetersFromCm(levelCm)} m e{" "}
                          {formatMetersFromCm(levelBCm)} m (SGB 2024).
                        </small>
                      </div>
                    </div>

                    <div className="official-layer-legend">
                      <i className="legend-swatch-only-a" aria-hidden="true" />
                      <div>
                        <strong>Exclusiva de A (A \ B)</strong>
                        <small>
                          Trechos presentes apenas na cota A (
                          {formatMetersFromCm(levelCm)} m).
                        </small>
                      </div>
                    </div>

                    <div className="official-layer-legend">
                      <i className="legend-swatch-only-b" aria-hidden="true" />
                      <div>
                        <strong>Exclusiva de B (B \ A)</strong>
                        <small>
                          Trechos presentes apenas na cota B (
                          {formatMetersFromCm(levelBCm)} m).
                        </small>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="official-layer-legend">
                    <i className="legend-swatch-flood" aria-hidden="true" />
                    <div>
                      <strong>Cenário oficial SGB (2024)</strong>
                      <small>
                        Extensão horizontal estimada para a cota selecionada.
                        Não indica profundidade, dano, probabilidade ou risco
                        individual.
                      </small>
                    </div>
                  </div>
                )}

                <div className="official-layer-legend">
                  <i className="legend-swatch-query-point" aria-hidden="true" />
                  <div>
                    <strong>Ponto consultado (WGS84)</strong>
                    <small>
                      Marcador georreferenciado selecionado por clique ou
                      coordenadas: vermelho (interior), âmbar (fronteira), azul
                      escuro (sem interseção) ou cinza (indisponível).
                    </small>
                  </div>
                </div>

                <div className="official-layer-legend">
                  <i className="legend-swatch-station" aria-hidden="true" />
                  <div>
                    <strong>Estações hidrológicas (INEA)</strong>
                    <small>
                      Localização oficial de Santo Antônio de Pádua (213042120)
                      e Ponte Paraoquena (58789000). Clique no marcador para ver
                      detalhes.
                    </small>
                  </div>
                </div>
              </div>

              <div className="source-links-group">
                <button
                  type="button"
                  className="methodology-link-btn"
                  onClick={handleOpenMethodology}
                >
                  Metodologia e parâmetros do SGB
                </button>
                <button
                  type="button"
                  className="methodology-link-btn"
                  onClick={handleGoToSources}
                >
                  Consultar todas as fontes e cotas
                </button>
                <a
                  className="source-link"
                  href="https://rigeo.sgb.gov.br/handle/doc/25035"
                  target="_blank"
                  rel="noreferrer"
                >
                  Relatório técnico do SGB (2024) ↗
                </a>
              </div>
            </article>
          </aside>
        </div>

        {/* View Histórico: Histórico hidrológico e acervo de enchentes */}
        {activeSection === "historico" && (
          <FloodHistorySection
            onGoToMap={handleGoToMap}
            onSelectHistoricalMapScenario={handleSelectHistoricalMapScenario}
            onInspectCoordinateOnMap={handleInspectCoordinateFromHistory}
          />
        )}

        {/* View B: Monitoramento do Rio Pomba */}
        {activeSection === "monitoramento" && (
          <MonitoringSection
            monitoring={monitoring}
            onGoToMap={handleGoToMap}
          />
        )}

        {/* View C: Dados e fontes */}
        {activeSection === "fontes" && (
          <DataSourcesSection
            onSelectStageAndOpenMap={handleSelectStageAndOpenMap}
          />
        )}

        {/* View D: Sobre e metodologia */}
        {activeSection === "sobre" && (
          <AboutMethodologySection
            onGoToMap={handleGoToMap}
            onGoToSources={handleGoToSources}
          />
        )}
      </main>

      {/* Official SGB Methodology Modal */}
      <MethodologyModal
        isOpen={isMethodologyOpen}
        onClose={handleCloseMethodology}
      />
    </div>
  );
}
