# Pádua FloodSim — Agent Guide

This repository is the source of truth for the Pádua FloodSim academic project.

## Mission

Build an experimental flood simulation and visualization system for Santo Antônio de Pádua, RJ, focused on the Rio Pomba.

The project is academic and experimental. Never present simulated outputs as official warnings or as substitutes for INEA, Defesa Civil, SGB or other official sources.

## Read first

Before changing code, read the relevant project docs:

- `README.md`
- `docs/ACADEMIC_METHODOLOGY.md` — canonical scientific baseline
- `docs/ACADEMIC_INTEGRATION_NOTE.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_SOURCES.md`
- `docs/FLOOD_MODEL.md`
- `docs/ROADMAP.md`
- `docs/AGENT_WORKFLOW.md`
- `docs/DEVELOPMENT_WORKFLOW.md`
- active execution plans under `docs/exec-plans/active/`

Use this file as a map, not as the entire specification.

If implementation convenience conflicts with `docs/ACADEMIC_METHODOLOGY.md`, preserve the scientific constraint and document the engineering tradeoff instead of silently weakening the methodology.

## Scientific baseline

`docs/ACADEMIC_METHODOLOGY.md` defines the current academic scope, allowed claims, experimental roadmap and validation strategy.

The custom scientific model is intentionally simple at first: elevation threshold plus approximate hydraulic connectivity to the Rio Pomba, with reproducible inputs and historical validation. Do not introduce hydrodynamic complexity unless the project has data and a clear experimental need for it.

Official SGB flood polygons currently used in the web application are reference scenarios. They are not the same artifact as future custom DEM-derived FloodSim simulations and must remain distinguishable in code, metadata and UI wording.

## Scientific constraints

Always distinguish:

- observed data;
- processed data;
- inferred data;
- simulated results.

Do not mix river-stage references, gauge zeros, vertical datums or CRS values without an explicit documented transformation.

The INEA scale and the SGB stage reference are not assumed equivalent.

Do not implement the naive rule `DEM <= water level => flooded` as a scientific flood model. A custom model must at minimum consider hydraulic connectivity to the river and topographic barriers.

Prefer simple, reproducible and validatable methods before adding hydrodynamic complexity.

Official SGB flood polygons are valid reference scenarios and should be kept separate from future custom DEM-derived simulations.

The project must not claim street-level real depth, water velocity, damage, casualties, evacuation need or flood prediction without data and a model that support those claims.

## Architecture boundaries

Keep these concerns separate:

1. data acquisition;
2. normalization and CRS/datum handling;
3. terrain processing;
4. flood simulation;
5. impact classification;
6. application/API;
7. visualization.

Do not couple the flood algorithm to MapLibre components.

Geospatial processing belongs in reusable modules/scripts, not inside UI components.

Important parameters must be explicit and reproducible.

## Frontend rules

- Stack: Next.js + TypeScript + MapLibre.
- Geographic objects and labels must be georeferenced map layers/sources when they represent real locations.
- Do not fake neighborhood movement with absolutely positioned HTML labels.
- Buttons that look interactive must have real behavior, routing, state changes, or be visibly disabled with an explanation.
- Mock hydrological values must be clearly identified as mock/demo data.
- Official SGB flood extent must not be labeled as flood depth unless depth was actually computed.
- A scenario stage must not be presented as an observed INEA level unless a validated translation has been implemented.

## Data rules

- Record source provenance and retrieval date.
- Preserve original source data when practical; keep derived assets separate.
- Do not commit very large raw rasters/ZIPs when a reproducible download/process script is preferable.
- Inspect CRS, datum, units and resolution before combining datasets.
- `docs/DATA_SOURCES.md` is the evolving technical inventory of sources actually verified for Pádua.
- The initial source list inside `docs/ACADEMIC_METHODOLOGY.md` is historical planning context, not a replacement for the verified inventory.

## Git workflow

Do not develop directly on `main`.

Use focused branches such as:

- `feat/...`
- `fix/...`
- `geo/...`
- `docs/...`
- `chore/...`

Prefer one agent/task per branch. Do not let Antigravity and Codex edit the same worktree concurrently.

Open a PR into `main` only after the task is coherent and locally validated.

## Autonomous operator rule

When Antigravity or Codex has terminal access, routine repository operations belong to the agent, not to the user.

The agent must handle its own:

- `git status` / branch inspection;
- fetch/pull and safe branch switching;
- branch creation when the task requires it;
- dependency installation;
- validation commands;
- commit and push;
- PR creation/update when appropriate;
- CI/Security/Sonar inspection when available.

Do not ask the user to run routine Git commands merely because the agent can run them itself.

At task start, assume the local clone may be stale. Synchronize safely before editing and never blindly reset or overwrite unexpected local-only work.

At task end, leave meaningful work pushed to GitHub and report the remote SHA.

Production release is also agent-operated when the current prompt explicitly authorizes publication. In that case the agent should merge the approved PR, synchronize `main`, trigger exactly one Vercel production deployment, verify the deployed commit and report the result.

If a one-time browser/OAuth authentication step cannot be completed autonomously, ask the user only for that approval rather than handing them the terminal workflow.

The full contract is defined in `docs/DEVELOPMENT_WORKFLOW.md`.

## Vercel policy

Automatic Git deployments are disabled.

Do not manually deploy intermediate agent work.

Expected flow:

`feature branch -> tests/CI -> PR -> review -> merge main -> one deliberate Vercel production deploy`

A production deploy is allowed only after explicit publication approval. Once approved, the agent should execute the deployment itself rather than asking the user for CLI commands.

## Validation

Before declaring implementation work complete, run the checks relevant to the change.

For the web app, normally run:

```bash
npm install
npm run typecheck
npm run build
```

Run additional tests or smoke checks when the task touches SGB integration, geospatial processing or browser behavior.

A successful build alone does not prove the map works. Interactive/map work should also be checked in a browser.

For future scientific model work, validation must follow the methodology baseline: reproducible inputs, comparison against an independent reference, comparison with the naive below-cota baseline, quantitative metrics and sensitivity analysis where applicable.

## Agent roles

Antigravity is the primary implementation agent for UI, browser interaction, MapLibre behavior and multi-file feature work.

Codex is the preferred second-pass engineer for code review, structural refactors, TypeScript/API correctness, tests and regression analysis.

Either agent may implement a task when appropriate, but avoid overlapping ownership on the same files at the same time.

## Definition of done

A task is not done merely because code was generated.

It should have, as applicable:

- working behavior;
- tests/checks passing;
- no misleading scientific claims;
- documentation updated when assumptions or data sources change;
- clear fallback/error behavior;
- a focused PR ready for review;
- the latest meaningful commit pushed to GitHub;
- production deployed only when explicitly authorized.
