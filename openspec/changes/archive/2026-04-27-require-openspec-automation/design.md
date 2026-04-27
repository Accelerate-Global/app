## Context

The repo already has local verification and release gates:

- `pnpm run verify:change`
- `pnpm run verify:change:run`
- `pnpm run verify:ship:local`
- `pnpm ship --pr <number>`

OpenSpec should integrate into those gates without relying on machine-local
Codex prompts.

## Design

- Add `spec:validate`, `spec:status`, `spec:archive`, and
  `spec:check-archive` package scripts.
- Pin `@fission-ai/openspec` as a dev dependency so CI can run OpenSpec.
- Add shared OpenSpec helper code under `scripts/lib/openspec.ts`.
- Require `spec:validate` from `resolveChangeImpact` whenever any tracked file
  changes.
- Record `spec:validate` receipts so repeated local gates can reuse a prior pass
  on the same tracked tree.
- Run `spec:check-archive` from `verify:ship:local` and `ship.ts`.
- Add a pull-request `OpenSpec` workflow.
- Add `OpenSpec` to the checks waited on by `pnpm ship`.

## Archive Semantics

Archiving is the step that promotes completed change deltas into
`openspec/specs` and moves the completed change into `openspec/changes/archive`.
It should happen after implementation has passed required verification and
before release/ship work.

`pnpm ship` should not auto-archive because ship expects a clean committed
branch and should not mutate the reviewed tree at release time.

## Proposal Flow

Automatic proposal creation is intentionally not part of this change. Codex
should identify when OpenSpec is required and stop before implementation with an
exact `/opsx:propose` prompt, unless the user explicitly asks Codex to create the
change directly.

## Verification

- OpenSpec validation.
- TypeScript.
- Unit tests for OpenSpec helper behavior and ship-local/ship guards.
- `verify:change` and `verify:change:run` for the final tracked tree.
