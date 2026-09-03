---
name: verify-floodsim
description: Validate Pádua FloodSim changes before opening or approving a pull request.
---

# Verify Pádua FloodSim

Use this skill before handing off implementation work.

## 1. Inspect repository guidance

Read the root `AGENTS.md` and the active execution plan relevant to the task.

## 2. Static validation

Run:

```bash
npm install
npm run typecheck
npm run build
```

Do not report success if a command failed. Fix the issue or report the exact blocker.

## 3. Browser validation for UI/map changes

When the task changes the map or dashboard, open the app in a browser and verify the changed user journeys rather than relying only on build success.

For map work, verify at minimum:

- basemap is visible;
- pan and zoom work;
- geographic labels/features move with the map;
- SGB layer reaches a terminal success/error state;
- scenario changes update the intended map data;
- no visible button pretends to work if it has no behavior.

## 4. Scientific semantics

Check that the UI does not:

- call SGB extent polygons flood depth;
- imply mock data is observed data;
- equate INEA and SGB gauge references without a documented transformation;
- present the project as an official emergency warning system.

## 5. Report

Return a concise verification report containing:

- commands run and results;
- browser flows tested;
- data scenarios/stages checked;
- unresolved limitations;
- whether the change is ready for PR/review.

Do not deploy to Vercel from a feature branch.
