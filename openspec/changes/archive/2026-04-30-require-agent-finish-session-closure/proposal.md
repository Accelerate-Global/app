## Why

Agent work sessions currently allow final summaries to list agent-executable
open items and next steps, which forces users to issue follow-up commands for
work that could have been completed before finalization.

## What Changes

- Require agents to run a final closure loop over their own summary before
  ending a work session.
- Restrict `Open Items` to true blockers, failed checks, explicitly deferred
  scope, or external dependencies.
- Restrict `Next Step` to one immediate user-owned action or decision.
- Make agent-executable next steps blocking: if the agent can perform the work
  without new user input, it must do so before finalizing.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `openspec-automation`: Adds a finish-session closure policy for repo agent
  workflow summaries.

## Impact

- Affected files: root `AGENTS.md`,
  `openspec/changes/require-agent-finish-session-closure/**`, and the durable
  `openspec-automation` spec when archived.
- No changes to auth, admin permissions, data integrity, Supabase behavior,
  Vercel deployment behavior, API contracts, UI smoke coverage, app routes, or
  runtime dependencies.
