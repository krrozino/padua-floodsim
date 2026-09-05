# Development workflow — GitHub-first, deploy-conscious

## Goal

Never leave meaningful project work stranded on one computer while avoiding unnecessary Vercel deployments.

GitHub is the source of truth for code and technical documentation. Vercel is a production delivery target, not a synchronization mechanism.

## Core rule

Every coherent development checkpoint must end with:

1. validate the current state;
2. commit on the current feature/fix/docs branch;
3. push the commit to GitHub;
4. confirm the local branch is synchronized with its upstream.

Do not wait until the end of a long work session to push important work.

## Start-of-session protocol

Before editing code on any computer:

```bash
git fetch origin
git status -sb
git pull --ff-only
```

Confirm that:

- you are on the intended task branch;
- the working tree does not contain unexpected local changes;
- the branch is not behind the remote branch;
- work from another computer has already been pulled.

If the branch has diverged, stop and reconcile before writing new code.

## Checkpoint protocol

Create a checkpoint whenever one of these happens:

- a coherent bug fix is complete;
- a feature sub-step works;
- an experiment or refactor reaches a recoverable state;
- you are about to switch computers;
- you are ending the work session;
- an agent reports a meaningful implementation milestone.

Recommended commands:

```bash
git status
git add -A
git commit -m "<type>: <concise description>"
git push -u origin HEAD
npm run repo:sync-check
```

Prefer small, coherent commits over one very large end-of-day commit.

## Work-in-progress safety

If the work is incomplete but important and you need to stop or switch computers, it is acceptable to create a temporary WIP commit on a non-main branch:

```bash
git add -A
git commit -m "wip: checkpoint <short description>"
git push -u origin HEAD
```

WIP commits may be squashed or cleaned before merge.

Do not use WIP commits on `main`.

## End-of-session protocol

Before calling a session complete, run:

```bash
git status -sb
git log --oneline @{u}..HEAD
npm run repo:sync-check
```

Expected result:

- no unexpected uncommitted files;
- no commits listed by `git log @{u}..HEAD`;
- sync check reports local HEAD equal to the upstream HEAD.

A task is not considered handed off until its latest meaningful commit exists on GitHub.

## Multi-computer rule

When moving between home, work, notebook or another machine:

1. finish the previous machine with commit + push;
2. start the next machine with fetch + pull;
3. never continue work from a stale local branch;
4. if uncertain, inspect GitHub before editing.

## Agent rule

Antigravity and Codex must not finish a requested implementation by saying only that a local commit was created.

Unless the user explicitly asks for local-only work, the expected handoff is:

```text
implementation -> validation -> commit -> push -> report remote SHA
```

Before reporting completion, an agent should confirm:

```bash
git status -sb
git push -u origin HEAD
npm run repo:sync-check
```

The completion report must include:

- branch name;
- pushed commit SHA;
- validation performed;
- whether the working tree is clean;
- explicit confirmation that no Vercel deployment was triggered.

## Branch policy

Do not develop directly on `main`.

Use focused branches such as:

- `feat/...`
- `fix/...`
- `geo/...`
- `docs/...`
- `chore/...`

Push these branches freely to GitHub. GitHub synchronization is encouraged; production deployment is separate.

## Vercel policy

Automatic Git deployments are disabled in `vercel.json`.

Therefore:

- pushing feature branches must not create Vercel deployments;
- pushing documentation or checkpoint commits must not create Vercel deployments;
- merging into `main` does not by itself deploy production;
- production deploys are deliberate and manual;
- deploy only an approved, validated `main` commit;
- record the deployed commit SHA when reporting a production release.

Expected delivery flow:

```text
local work
-> feature branch
-> frequent commit + push checkpoints
-> GitHub Actions / review
-> PR
-> merge main
-> one deliberate production deployment when desired
```

## What must not be pushed

The checkpoint rule does not override repository hygiene.

Never push:

- secrets or credentials;
- `.env` files containing credentials;
- private keys;
- large raw DEM/ZIP/raster files that belong in ignored data directories;
- generated build output that is already ignored;
- unrelated personal files.

If a dataset is too large for GitHub, push its metadata, acquisition script and checksum instead.
