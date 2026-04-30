## Context

Root `AGENTS.md` already defines a short final footer format with `Verification`,
`Open Items`, `Next Step`, and `Docker / Supabase` sections. It also says
`Open Items` should include only unresolved blockers, failed checks, or
intentionally unfinished work, but it does not explicitly require agents to
resolve agent-actionable items before writing the final response.

The repo also treats `pnpm run verify:change:run` and Docker/Supabase cleanup as
end-of-task responsibilities. The new policy should reinforce those existing
responsibilities instead of adding new tooling or changing verification
selection.

## Goals / Non-Goals

**Goals:**

- Make final summaries a report of completed work and true blockers, not a
  deferred work queue.
- Require agents to perform executable follow-up work before finalizing.
- Preserve the existing concise footer structure.

**Non-Goals:**

- Change verification command selection, CI gates, ship behavior, OpenSpec CLI
  behavior, UI smoke policy, or Docker/Supabase lifecycle commands.
- Require agents to proceed past real blockers, missing access, user-owned
  decisions, or explicitly deferred scope.

## Decisions

- Add a `Completion before summary` subsection in root `AGENTS.md` immediately
  before the footer definitions.
- Keep the existing footer sections, but tighten `Open Items` and `Next Step`
  wording so they cannot be used for agent-executable cleanup, fixes, tests, or
  implementation work.
- Add an OpenSpec delta requirement under `openspec-automation` so the policy is
  durable as repo workflow behavior.

## Risks / Trade-offs

- Agents may spend longer in a turn because they must close executable items
  before finalizing. This is intentional and matches the existing repo
  expectation that required verification and cleanup happen before completion.
- A final response can still contain open items when the agent is blocked by
  failed checks, external access, unavailable services, user decisions, or
  explicit deferral.
