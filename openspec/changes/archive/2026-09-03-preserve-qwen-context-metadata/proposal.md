## Why

The Blake-only post-deploy canary for the compact semantic envelope raised an answer-quality risk before pilot expansion: supported questions surfaced clarifications during a contended run. The multi-turn signal was later traced to an invalid synthetic transcript without signed turn state, but the single-turn ambiguity still warranted an immediate rollback to the prior healthy deployment.

## What Changes

- Preserve the validated retrieval status, snapshot and policy identity, controlled retrieval views, exact keys, byte count, and selected items in the model context.
- Continue omitting only the duplicate serialized copy of those same selected items.
- Re-run the focused regressions and complete production canary before accepting the forward fix.

## Capabilities

### Modified Capabilities

- `private-model-gateway`: Planner context retains the established retrieval structure and removes only duplicate semantic-item serialization.

## Impact

- Code and tests: `src/lib/private-data-chat/qwen-gateway.ts` and `src/lib/private-data-chat/qwen-gateway.test.ts`.
- Production remains on the prior healthy deployment until the guarded forward fix passes.
