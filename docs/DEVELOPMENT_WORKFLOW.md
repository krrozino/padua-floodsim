# Development workflow — agent-operated, GitHub-first

## Goal

The user should not need to operate routine Git, test or Vercel commands during normal Pádua FloodSim development.

Antigravity and Codex are expected to operate the repository end-to-end for the task they receive, while GitHub remains the source of truth and production deployment remains deliberate.

## Core rule

For routine development, the agent — not the user — owns the mechanical workflow:

`sync -> inspect -> implement -> validate -> commit -> push -> PR/checks -> report`

When production publication is explicitly authorized, the agent also owns:

`approved PR -> merge -> sync main -> one production deploy -> verify -> report`

The user should normally only need to provide the task/prompt and review the result.

## Start-of-task protocol

Before editing anything, the agent must:

1. inspect `git status` and the current branch;
2. fetch `origin`;
3. determine the intended task branch from the prompt/issue/PR;
4. switch to it or create it from the correct current base;
5. fast-forward from the remote when safe;
6. stop and diagnose rather than overwrite unexpected local-only work;
7. read `AGENTS.md`, the relevant project docs and active execution plan.

The agent must not ask the user to run `git fetch`, `git pull`, `git checkout` or equivalent routine commands when it has terminal access itself.

## Development mode — default

Unless publication is explicitly authorized, every implementation/review prompt runs in development mode.

The agent must:

- synchronize the repository itself;
- install/update dependencies when needed;
- implement the requested work;
- run all relevant validation commands;
- perform browser validation for interactive/map work;
- inspect `git diff` and `git diff --check`;
- avoid committing temporary screenshots, logs, test reports or unrelated files;
- create coherent commits;
- push the branch to GitHub;
- create or update the task PR when appropriate;
- inspect CI/Security/Sonar results when available;
- report the remote branch and final SHA.

Development mode must NOT deploy to Vercel.

## Production publication mode

Production publication requires explicit authorization in the current task, for example:

- `faça o deploy`;
- `publique na Vercel`;
- `pode fazer merge e colocar em produção`;
- an equivalent explicit release instruction.

When authorized, the agent must perform the release mechanically instead of asking the user for terminal commands.

Release sequence:

1. confirm the exact PR/head SHA being approved;
2. confirm required CI/Security/Sonar checks are green;
3. confirm scientific/academic blockers are resolved;
4. merge using the repository's intended merge method;
5. fetch/switch/update local `main` to the merged remote state;
6. confirm the intended merge SHA is the production source;
7. trigger exactly one deliberate Vercel production deployment;
8. wait for the deployment result;
9. verify that production corresponds to the intended commit;
10. perform a focused production smoke check when practical;
11. report deployment ID/URL, commit SHA and status.

Never deploy a feature branch as production.

## Vercel budget rule

Automatic Git deployments remain disabled.

A Git push is synchronization, not publication.

Agents must not create exploratory or intermediate Vercel deployments. Diagnose failures before retrying. Do not use `--force` or repeated redeploys merely to test whether a problem disappears.

Expected cadence:

`many GitHub checkpoints -> one approved merge -> one deliberate production deployment`

## Authentication exception

Agents should execute commands themselves whenever they have terminal access.

If GitHub/Vercel authentication requires a one-time interactive browser/OAuth approval that the agent cannot complete autonomously, it may ask the user only for that approval. It should not convert the whole workflow into a list of terminal commands for the user.

After authentication is available on that machine/environment, routine fetch/pull/push/deploy operations return to agent ownership.

Never request that credentials, tokens or secrets be pasted into chat or committed to the repository.

## Multi-computer safety

The repository may be used from home, work or other machines.

At the beginning of every task, the agent must assume the local clone may be stale and synchronize it safely before editing.

At the end of every meaningful task, the agent must leave recoverable work on GitHub rather than only on the local machine.

If unexpected uncommitted work exists, the agent must inspect and preserve it. It must not blindly reset, clean or overwrite it.

## Handoff between Antigravity and Codex

Do not run both agents concurrently against the same worktree/files.

Typical flow:

1. Antigravity synchronizes, implements, tests, commits and pushes.
2. Codex synchronizes the same remote branch, reviews/hardens, tests, commits and pushes.
3. ChatGPT/user reviews the remote result.
4. Only after explicit approval does the chosen agent or connected GitHub/Vercel tooling merge/deploy.

Each agent must treat the current remote branch as the handoff boundary.

## Required completion report

For development tasks, report at minimum:

- branch;
- final pushed SHA;
- files/areas changed;
- validations run and results;
- CI/Security/Sonar state if checked;
- working-tree/sync state;
- explicit confirmation that no production deployment was made.

For release tasks, additionally report:

- merged PR;
- merge SHA on `main`;
- Vercel deployment ID/URL;
- production status;
- smoke-check result;
- confirmation that only the intended production deployment was created.

## Human decisions vs mechanical operations

The user should still decide product/scientific questions such as:

- scope and priorities;
- whether a scientific claim is acceptable;
- whether a PR is approved for production;
- whether a major methodology change should proceed.

The agent should handle mechanical operations such as Git synchronization, branch switching, tests, commit/push, CI inspection and authorized deployment.
