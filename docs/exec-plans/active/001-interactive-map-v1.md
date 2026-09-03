# Execution Plan 001 — Interactive georeferenced map

## Status

Active.

## Required context

Before implementation, read:

- `AGENTS.md`;
- `docs/ACADEMIC_METHODOLOGY.md`;
- `docs/ACADEMIC_INTEGRATION_NOTE.md`;
- `docs/ARCHITECTURE.md`;
- `docs/DATA_SOURCES.md`;
- `docs/FLOOD_MODEL.md`.

This milestone is primarily **engineering/product work**. It must preserve the academic methodology, but it does **not** authorize premature implementation of the custom DEM flood model, INEA-to-terrain conversion or definitive neighborhood impact classification.

## Problem

The current production screen is largely demonstrative:

- neighborhood names are absolutely positioned HTML labels instead of georeferenced map features;
- labels do not move with pan/zoom;
- several visible navigation buttons have no real behavior;
- changing the slider mainly changes placeholder label colors;
- successful build/API responses do not prove browser/map behavior is correct.

The next implementation task is to turn the current V0 shell into a genuinely interactive map application before adding more product features.

## Objective

Deliver a coherent map experience where geographic UI behaves as part of the map, the SGB flood layer is visible and controllable, and visible navigation does not pretend to work when it does not.

## In scope

### Map

- MapLibre map renders a stable basemap.
- Pan and zoom work normally.
- Flood polygons from the existing SGB API route render above the basemap.
- Scenario changes request/update the selected official SGB stage.
- Loading, empty and error states are visible and recoverable.

### Neighborhood labels

- Remove absolutely positioned fake labels from the viewport.
- If verified neighborhood coordinates/polygons are not yet available, do not invent authoritative geometry.
- Either use explicitly marked temporary georeferenced point features or hide neighborhood severity until real boundaries are integrated.
- Any temporary points must pan/zoom with MapLibre.
- Do not calculate definitive neighborhood impact percentages in this milestone.

### Navigation

Audit every visible button/tab.

Each visible control must be one of:

1. functional;
2. intentionally disabled with a clear `em breve`/unavailable state;
3. removed from this milestone.

Do not leave dead clickable controls.

### Slider

- Use only SGB-supported scenario stages: 3.00 m through 5.50 m at 0.25 m increments.
- Clearly label the value as an **SGB scenario/reference stage**, not as the current INEA river level and not as the future custom FloodSim DEM simulation cota.
- Updating the slider must update the map layer, loading state and displayed scenario metadata.

## Out of scope

- real INEA-to-SGB gauge conversion;
- INEA-to-DEM translation curve;
- flood depth computation;
- custom DEM flood model;
- definitive neighborhood impact percentages;
- hydrodynamic simulation;
- validation metrics for the future custom model;
- new major product modules.

## Scientific/UI wording constraints

The academic baseline is `docs/ACADEMIC_METHODOLOGY.md`.

For this milestone:

- SGB polygons represent official mapped flood-extent reference scenarios; do not call them custom FloodSim simulation depth.
- Keep SGB reference scenarios distinct from future custom DEM-derived FloodSim simulations.
- The real-time panel remains mock until live data integration is implemented.
- Do not imply that the selected SGB stage equals the INEA live gauge reading.
- Do not claim prediction, street-level real depth, water velocity, damage, casualties or evacuation need.
- Keep the research/non-official warning accessible.

## Acceptance criteria

1. On initial load, a visible basemap appears.
2. A user can pan/zoom and all map-bound features move correctly.
3. No neighborhood label remains fixed to screen coordinates.
4. Selecting at least 3.00 m, 4.25 m and 5.50 m successfully updates the SGB flood geometry.
5. SGB request failures show an understandable error/fallback state rather than endless loading.
6. Every visible nav control has real behavior or a deliberate disabled state.
7. SGB scenario wording is not confused with observed INEA data or the future custom DEM model.
8. `npm run typecheck` passes.
9. `npm run build` passes.
10. The result is checked in a real browser before PR approval.
11. No Vercel preview deployment is required for implementation.

## Suggested ownership

### Antigravity — implementation

Own the browser-facing work:

- `components/map/FloodMap.tsx` and related map components;
- dashboard navigation behavior/state;
- browser validation;
- removal of fake fixed-position map labels.

Do not expand the scientific model during this task.

### Codex — review and hardening

After the first implementation:

- review the entire diff;
- check React/MapLibre lifecycle correctness;
- identify race conditions and stale requests;
- add or improve tests where practical;
- verify API contracts and TypeScript boundaries;
- confirm no misleading data semantics were introduced;
- verify compliance with `docs/ACADEMIC_METHODOLOGY.md`.

## Handoff checklist

Antigravity should report:

- changed files;
- exact browser flows tested;
- stages tested;
- screenshots or concise visual verification notes;
- validation command results;
- remaining limitations;
- confirmation that SGB/INEA/custom-model semantics remain separated.

Codex should report findings grouped as:

- blocking defects;
- correctness/regression risks;
- scientific/semantic risks;
- maintainability improvements;
- optional enhancements.
