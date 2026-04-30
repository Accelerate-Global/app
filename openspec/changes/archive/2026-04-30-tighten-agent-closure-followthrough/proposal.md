## Why

The existing closure-loop policy says agents must complete executable open items and next steps before finalizing, but a missing remote migration was still summarized as user-owned work after the user had requested implementation. The policy needs an explicit rule that easy, available commands and reruns are action items, not final-summary parking.

## What Changes

- Clarify agent instructions so executable `Open Items` and `Next Step` entries invalidate the draft final summary.
- Explicitly classify available migration pushes, verification reruns, local service restarts, and cleanup as agent-executable when credentials and prior user authorization are present.
- Keep genuinely user-owned decisions, external access blockers, and explicitly deferred scope eligible for final footer sections.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-automation`: Agent final-summary closure rules require available follow-through work to be performed before finalizing.

## Impact

- Affects repo agent instructions in `AGENTS.md`.
- Affects durable repo workflow policy in `openspec/specs/openspec-automation/spec.md`.
- Does not affect application runtime, auth, data model behavior, or UI smoke coverage.
