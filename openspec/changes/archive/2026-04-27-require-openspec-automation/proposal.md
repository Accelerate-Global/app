## Summary

Require OpenSpec validation and archive readiness throughout local verification,
CI, and ship workflows.

## Why

OpenSpec should be a reliable repo contract, not a best-effort agent habit. The
local and release workflows need enforceable checks so every tracked change
validates specs and release candidates cannot ship with active unarchived
changes.

## What Changes

- Add repo-owned OpenSpec package scripts and helper scripts.
- Add OpenSpec validation to every non-empty local change plan.
- Add archive-readiness guards to ship-local and ship.
- Add a pull-request OpenSpec workflow.
- Add `OpenSpec` to the release-critical checks waited on by `pnpm ship`.

## Problem Statement

OpenSpec is now part of the repository, but enforcement currently depends on
agent discipline and manual commands. A behavior or workflow-policy change can
be implemented, verified, and shipped without proving that OpenSpec artifacts are
valid or that completed changes have been archived into durable specs.

## Goals

- Require OpenSpec validation for every repo-tracked change.
- Provide repo-owned OpenSpec helper commands that work without machine-local
  OPSX prompts.
- Block ship-local and ship workflows when active OpenSpec changes remain
  unarchived.
- Add CI coverage for OpenSpec validation and archive readiness.
- Keep `/opsx:propose` as a human/agent planning step instead of automatically
  creating proposals during normal implementation.

## Non-Goals

- Auto-create OpenSpec proposals from every Codex plan.
- Auto-archive changes inside `pnpm ship`.
- Change the app runtime behavior.
- Backfill broad specs for untouched legacy behavior.

## Proposed Behavior

- `pnpm run verify:change` includes `pnpm run spec:validate` for any non-empty
  tracked change set.
- `pnpm run verify:change:run` executes and records OpenSpec validation like
  other local verification commands.
- `pnpm run verify:ship:local` fails when active changes exist under
  `openspec/changes/*` outside the archive directory.
- `pnpm ship --pr <number>` fails early when active OpenSpec changes remain
  unarchived.
- The `OpenSpec` GitHub workflow runs on pull requests and validates both
  OpenSpec syntax and archive readiness.
- Developers can archive with `pnpm run spec:archive -- <change-id>`, then
  validate with `pnpm run spec:validate`.

## Open Questions

- None.

## Impact

- Adds repo-owned OpenSpec helper scripts and CI workflow.
- Updates release and contributor docs.
- Makes OpenSpec validation part of normal verification for all tracked changes.
- Makes unarchived OpenSpec changes a release blocker.
