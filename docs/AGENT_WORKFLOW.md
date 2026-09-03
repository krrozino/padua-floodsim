# Agent workflow

## Goal

Use Antigravity and Codex as complementary engineering agents while GitHub remains the source of truth and Vercel is used only for deliberate production deployments.

All agent work must preserve the scientific baseline defined in `docs/ACADEMIC_METHODOLOGY.md`.

## Responsibilities

### Antigravity

Primary use cases:

- implement interactive UI flows;
- work on MapLibre map behavior;
- inspect browser/runtime behavior;
- execute multi-file frontend tasks;
- iterate on UX without deploying intermediate work.

For UI tasks, Antigravity must preserve scientific semantics: observed, processed, inferred and simulated data must remain visibly distinguishable.

### Codex

Primary use cases:

- review Antigravity changes;
- identify regressions and dead UI;
- improve TypeScript/API structure;
- add or improve tests;
- refactor boundaries between UI, domain and data layers;
- review geospatial scripts and reproducibility;
- challenge misleading claims, hidden assumptions and violations of the academic methodology.

## Required context before implementation

For significant tasks, agents should read:

1. `AGENTS.md`;
2. `docs/ACADEMIC_METHODOLOGY.md`;
3. `docs/ACADEMIC_INTEGRATION_NOTE.md`;
4. relevant architecture/data/model docs;
5. the active execution plan for the task.

`docs/ACADEMIC_METHODOLOGY.md` is the scientific baseline. `docs/DATA_SOURCES.md` is the evolving technical inventory of sources actually verified for Santo Antônio de Pádua.

## Branch model

`main` is production source.

Agents should create or use focused branches, one task per branch whenever practical.

Examples:

- `fix/georeferenced-map-ui`
- `geo/neighborhood-boundaries`
- `feat/inea-monitoring`
- `docs/methodology-validation`

Do not use a long-lived shared branch for unrelated work.

## Handoff pattern

Preferred flow for larger tasks:

1. Define the task and acceptance criteria in an issue or execution plan.
2. Select the appropriate agent/model for the task.
3. Antigravity implements the first coherent version in a focused branch when browser/UI work is primary.
4. Antigravity runs browser checks plus project validation commands.
5. Open or update a PR to `main`.
6. Codex reviews the diff and runs/extends tests.
7. Fix review findings on the same task branch.
8. Merge only after CI is green, behavior has been checked and scientific wording remains valid.
9. Trigger one deliberate Vercel production deployment from the approved `main` state.

For backend, tests or geospatial-only work, Codex may be the implementation agent and Antigravity may be omitted.

## Avoiding conflicts

Never ask both agents to modify the same files concurrently.

If work can be parallelized, divide it by explicit ownership. Example:

- Antigravity: `components/map/**`, interaction behavior and browser validation.
- Codex: tests, API boundaries and review of the resulting diff.

If two tasks depend on each other, finish the upstream branch first instead of creating competing implementations.

## Vercel budget

Automatic Git deployments are disabled for this repository.

Do not run manual Vercel deployments for agent branches.

Normal development validation must happen through local/agent browser testing and GitHub Actions.

Only deploy after an approved change has landed on `main` and a production check is desired.

## PR expectations

PR descriptions should state:

- problem being solved;
- approach used;
- files/areas changed;
- validation performed;
- known limitations;
- whether observed, processed, inferred or simulated data behavior changed.

For geospatial or scientific changes also state:

- source dataset;
- CRS/datum/units;
- transformation steps;
- parameters and reproducibility metadata;
- validation reference;
- relationship to the P0–P6 academic roadmap;
- whether any allowed scientific claim changed.

## Scientific change gate

Changes to the custom flood model, station-to-terrain conversion, neighborhood impact methodology or validation protocol require explicit review against `docs/ACADEMIC_METHODOLOGY.md`.

Do not silently:

- equate INEA and SGB stage references;
- treat all terrain below a threshold as flooded without connectivity;
- infer people, damage or evacuation needs from spatial overlap;
- call SGB extent polygons flood depth;
- claim prediction from a scenario visualization.

## Current priority

The current production UI has placeholder behavior that must be replaced before adding new product features. See the active execution plan under `docs/exec-plans/active/`.

The current interactive-map milestone is an engineering milestone. It should respect the academic methodology but must not prematurely implement the custom DEM model, INEA conversion or definitive neighborhood impact classification.
