# Agent workflow

## Goal

Use Antigravity and Codex as complementary engineering agents while GitHub remains the source of truth and Vercel remains a production-only deployment target.

## Responsibilities

### Antigravity

Primary use cases:

- implement interactive UI flows;
- work on MapLibre map behavior;
- inspect browser/runtime behavior;
- execute multi-file frontend tasks;
- iterate on UX without deploying intermediate work.

### Codex

Primary use cases:

- review Antigravity changes;
- identify regressions and dead UI;
- improve TypeScript/API structure;
- add or improve tests;
- refactor boundaries between UI, domain and data layers;
- review geospatial scripts and reproducibility.

## Branch model

`main` is production.

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
2. Antigravity implements the first coherent version in a focused branch.
3. Antigravity runs browser checks plus project validation commands.
4. Open a PR to `main`.
5. Codex reviews the diff and runs/extends tests.
6. Fix review findings on the same task branch.
7. Merge only after CI is green and the behavior has been checked.
8. Vercel deploys `main` once.

For backend, tests or geospatial-only work, Codex may be the implementation agent and Antigravity may be omitted.

## Avoiding conflicts

Never ask both agents to modify the same files concurrently.

If work can be parallelized, divide it by explicit ownership. Example:

- Antigravity: `components/map/**`, interaction behavior and browser validation.
- Codex: tests, API boundaries and review of the resulting diff.

If two tasks depend on each other, finish the upstream branch first instead of creating competing implementations.

## Vercel budget

The repository is configured so automatic deployments are enabled only for `main`.

Do not run manual Vercel deployments for agent branches unless explicitly required for a release investigation.

Normal development validation must happen through local/agent browser testing and GitHub Actions.

## PR expectations

PR descriptions should state:

- problem being solved;
- approach used;
- files/areas changed;
- validation performed;
- known limitations;
- whether observed, processed, inferred or simulated data behavior changed.

For geospatial changes also state:

- source dataset;
- CRS/datum/units;
- transformation steps;
- validation reference.

## Current priority

The current production UI has placeholder behavior that must be replaced before adding new product features. See the active execution plan under `docs/exec-plans/active/`.
