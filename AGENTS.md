# Pádua FloodSim — Agent Guide

This repository is the source of truth for the Pádua FloodSim academic project.

## Mission

Build an experimental and reproducible platform to **monitor, forecast and spatially interpret** Rio Pomba flood conditions in Santo Antônio de Pádua, RJ.

Core identity:

```text
MONITOR -> FORECAST -> TRANSLATE TO SPATIAL IMPACT
```

The project is academic and experimental. Never present outputs as official warnings or as substitutes for INEA, Defesa Civil, SGB, ANA or other official sources.

## Read first

Before changing code or scientific behavior, read the relevant docs:

- `README.md`
- `docs/PROJECT_CHARTER.md` — mission, users and product/research scope
- `docs/ACADEMIC_METHODOLOGY.md` — canonical scientific baseline
- `docs/FORECAST_MODEL.md` — temporal prediction research rules
- `docs/FLOOD_MODEL.md` — spatial model and SGB reference rules
- `docs/DATA_SOURCES.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/ARTICLE_PLAN_RBMET.md`
- `docs/GOVERNANCE.md`
- `docs/AI_USAGE.md`
- `docs/AGENT_WORKFLOW.md`
- active execution plans under `docs/exec-plans/active/`

Use this file as a map, not as the entire specification.

## Scientific baseline

The project now has two coupled research tracks:

1. **temporal:** observations and short-term statistical forecasts;
2. **spatial:** official SGB scenarios plus a custom DEM/connectivity research model.

They only become an integrated space-time product when gauge/reference compatibility has been demonstrated.

### Spatial model

Start simple: elevation threshold plus approximate hydraulic connectivity to the Rio Pomba, with reproducible inputs and quantitative validation.

Do not implement `DEM <= water level => flooded` as the final scientific model. It may be implemented only as an explicit baseline.

Official SGB polygons are `official_reference`, never custom FloodSim simulations.

### Forecast model

Forecasting must progress from simple baselines to more complex models.

At minimum compare against:

- persistence;
- recent trend;
- local-history model;
- upstream-enhanced model when data permits.

Barra do Braúna is a research candidate because prior SAH-Pomba work used UHE Barra do Braúna Jusante (`58788600`) for Santo Antônio de Pádua. Do not treat prior reported performance as guaranteed FloodSim performance.

No temporal model may power public future scenarios until it has:

- reproducible data;
- temporal/event holdout validation;
- per-horizon metrics;
- missing-data behavior;
- uncertainty or an explicit uncertainty limitation;
- experimental labeling.

## Information classes

Always distinguish:

- `observed`;
- `processed`;
- `official_reference`;
- `derived`;
- `simulated`;
- `forecast`;
- `mock`.

Never silently convert one category into another.

## Gauge and datum constraints

Do not mix:

- station identifiers;
- gauge zeros;
- vertical datums;
- stage values;
- DEM elevations;
- CRS values;

without explicit documented transformation.

The INEA scale and the SGB/RHN stage reference are **not assumed equivalent**.

A forecast level cannot trigger a spatial scenario until the relevant crosswalk has been validated.

## Claims and safety

The project must not claim, without adequate model/data/validation:

- exact street-level water depth;
- water velocity;
- damage or casualties;
- evacuation need;
- that a property is safe;
- that a forecast is an official warning.

The application may support situational understanding and preparation, but must direct emergency decisions to official authorities.

## Architecture boundaries

Keep these concerns separate:

1. data acquisition;
2. provenance/catalog;
3. temporal/geospatial normalization;
4. terrain/hydrography processing;
5. spatial flood simulation;
6. temporal forecasting;
7. space-time translation;
8. impact classification;
9. API/application;
10. visualization.

Do not couple scientific algorithms to MapLibre components.

Important parameters, model versions and data versions must be explicit and reproducible.

## Frontend rules

- Stack: Next.js + TypeScript + MapLibre.
- Real geographic objects must be georeferenced map sources/layers.
- Do not fake neighborhood movement with absolutely positioned labels.
- Controls must have real behavior or be clearly disabled.
- Mock hydrological values must be labeled mock/demo.
- SGB flood extent must not be labeled as flood depth.
- Observed INEA stage must not be presented as an SGB scenario without a validated transformation.
- Forecasts must show horizon, timestamp, source/model version and uncertainty context.

## Data rules

- Record provenance and retrieval date.
- Record station IDs and measurement units.
- Preserve raw data when practical.
- Keep derived outputs separate.
- Inspect CRS/datum/units/resolution before combining geospatial sources.
- Audit temporal frequency, gaps and quality flags before forecasting.
- `docs/DATA_SOURCES.md` is the evolving verified inventory.

## Research governance

- Notion is for meetings, ideas, reading notes and research management.
- GitHub is the consolidated scientific/technical source of truth.
- Material scientific decisions should be versioned.
- Experiments must be reproducible.
- The research log must be updated at important milestones.

If a task requires broad multi-source investigation, literature synthesis, dataset analysis or many-step research, flag it as a candidate for **Work** before spending Work credits.

## Git workflow

Do not develop directly on `main`.

Use focused branches:

- `feat/...`
- `fix/...`
- `geo/...`
- `forecast/...`
- `research/...`
- `docs/...`
- `chore/...`

Prefer one agent/task per branch.

Expected flow:

```text
task -> branch -> checks -> PR -> review -> merge
```

## Vercel policy

Automatic Git deployments are disabled.

Do not deploy intermediate research/documentation branches.

Production deployment happens only after coherent changes are merged and reviewed.

## Validation

### Web application

Normally run:

```bash
npm install
npm run typecheck
npm run build
```

Interactive/map work must also be checked in a browser.

### Spatial research

Use:

- reproducible inputs;
- SGB/reference comparison;
- naive below-cota baseline;
- IoU/precision/recall/F1 when applicable;
- sensitivity analysis.

### Forecast research

Use:

- temporal/event holdouts;
- persistence/trend baselines;
- MAE/RMSE/bias;
- KGE/correlation when justified;
- metrics per horizon;
- event-level error analysis;
- uncertainty evaluation.

## Agent roles

Antigravity is preferred for UI, browser interaction, MapLibre and multi-file interface work.

Codex is preferred for second-pass engineering, structural refactors, tests, scientific pipeline review and regression analysis.

Avoid overlapping edits to the same worktree.

## Definition of done

A task is not done merely because code was generated.

It should have, as applicable:

- working behavior;
- checks passing;
- reproducible scientific behavior;
- no misleading claims;
- documentation updated;
- source/provenance captured;
- explicit error/fallback state;
- focused PR ready for review.
