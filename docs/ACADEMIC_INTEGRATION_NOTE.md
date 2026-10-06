# Academic integration note

## Historical baseline

The academic planning document produced on **03 September 2026** established the original defensible spatial baseline:

- scenario visualization rather than official warning;
- DEM elevation threshold + approximate hydraulic connectivity;
- strict separation between observed and simulated data;
- vertical datum constraints;
- neighborhood aggregation semantics;
- quantitative historical validation.

Its principles remain valid and are incorporated into `docs/ACADEMIC_METHODOLOGY.md`.

## Research Phase — 05 October 2026

After academic orientation, the project scope was formally expanded to three connected pillars:

```text
MONITOR -> FORECAST -> TRANSLATE TO SPATIAL IMPACT
```

The canonical documents are now:

- `PROJECT_CHARTER.md` — mission and product/research objectives;
- `ACADEMIC_METHODOLOGY.md` — integrated scientific methodology;
- `FORECAST_MODEL.md` — temporal forecasting research;
- `FLOOD_MODEL.md` — spatial model/reference;
- `DATA_SOURCES.md` — verified source inventory;
- `ARTICLE_PLAN_RBMET.md` — article/research plan;
- `GOVERNANCE.md` — research workflow.

## Current application versus research target

The deployed/current V1 remains primarily an interactive viewer of SGB official flood extents.

The following are research targets, not current validated features:

- automatic synchronization of INEA stage with SGB scenarios;
- statistical forecasts;
- forecast uncertainty;
- future spatial scenarios;
- neighborhood impact;
- property/address impact;
- automated preparation notifications.

## Non-negotiable integration rule

Temporal observation/forecast and spatial inundation layers must remain separate until their reference relationship is validated.

In particular:

```text
INEA stage != SGB stage
```

unless station identity, gauge zero, datum/reference and transformation are documented.

## Research direction

Prior SAH-Pomba work involving UHE Barra do Braúna Jusante (`58788600`) is a benchmark and research lead, not a result that can be copied into the FloodSim.

The project must independently audit data availability, reproduce baselines and validate performance before exposing forecasts.
