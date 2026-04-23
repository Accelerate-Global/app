# Verification-First Delivery

Use this as the default repo workflow for feature work, verification-tooling work, and AI-agent tasks.

## Core Rule

Treat verification as part of implementation planning, not as cleanup after coding. The fast loop is:

1. plan the tracked-tree blast radius
2. write the verification intent
3. use only narrow checks while coding
4. run the aggregate local gate once near the end

Do not use repeated `pnpm run verify:change:run` reruns as a debugging loop.

## Five-Stage Method

### 1. Preflight

- prefer a clean branch or separate worktree for the task
- if UI smoke or DB checks may run, stop repo-local Supabase before coding
- run `pnpm run verify:change`
- run `pnpm run task:kickoff -- --scope <owned-path-or-glob>` for AI-agent UI, admin, DB, or verification-tooling work

### 2. Impact Planning

Capture the verification intent before editing:

- changed area
- required commands from `pnpm run verify:change`
- targeted smoke subset from `pnpm run verify:change`
- whether local Supabase is needed

Classify the current diff lane:

- `product-only`
- `product + test`
- `harness / tooling`

If unrelated dirty files inflate verification, move to a clean worktree before broad verification.

### 3. Narrow Inner Loop

- run direct unit or component tests first
- run `pnpm run smoke:check` when smoke contracts changed
- run `pnpm run test:ui:smoke:targeted` only for browser-specific debugging
- if the failing command is a harness problem, stop product iteration and fix the harness first

### 4. Single Aggregate Gate

- use `pnpm run verify:change:run` as the terminal gate for the current candidate tracked tree
- rerun it only after a real fix or tracked-tree change
- use `pnpm run verify:ship:local` only for merge or release readiness

### 5. Close-Out

- record the failure class that actually consumed time
- stop repo-local Supabase or Docker-backed services unless the task explicitly needs them left running
- prune transient Docker cache after repo-local shutdown

## Failure Classes

Before rerunning a failed verification command, classify it as one of:

- `environment`
- `test gap`
- `contract / harness`
- `product`

Use [/Users/blake/Documents/accelerate-global/online/docs/testing/verification-triage.md](/Users/blake/Documents/accelerate-global/online/docs/testing/verification-triage.md) for the narrow next step by class.

## Work-Splitting Rules

- Prefer feature-only diffs over mixed feature-plus-harness diffs.
- If a task touches smoke bootstrap, Playwright auth setup, or verification orchestration, declare it as a `harness / tooling` lane early.
- Do not combine unrelated dirty-tree cleanup with the feature diff unless that cleanup is required to unblock the verification flow.
