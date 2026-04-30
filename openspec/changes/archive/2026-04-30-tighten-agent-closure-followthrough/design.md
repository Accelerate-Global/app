## Context

`AGENTS.md` already requires a closure loop before final summaries, and `openspec-automation` already records that executable work must be resolved first. The failure mode is not absence of policy; it is ambiguity around work that looks operational, such as pushing an already-created migration or rerunning a failed verification command.

## Goals / Non-Goals

**Goals:**
- Make executable final-summary items impossible to treat as user-owned next steps.
- Name common executable cases: migration push after user-approved implementation, verification rerun, local service restart, cleanup, and repo changes.
- Preserve space for true blockers that require user decisions, access, or explicitly deferred scope.

**Non-Goals:**
- Do not require agents to perform destructive, production-mutating, or access-requiring actions without user authorization.
- Do not change verification command selection or ship gates.

## Decisions

- Strengthen `AGENTS.md` in the existing footer/closure section because that is the instruction agents read at runtime.
- Add a delta spec under `openspec-automation` so the policy remains durable and testable.
- Treat remote migration push as executable only when the user has requested implementation/release follow-through and credentials/scripts are already available.

## Risks / Trade-offs

- Agents might over-apply the rule to sensitive remote operations. The mitigation is to preserve the user-authorization/access boundary: ask before acting when authorization is not already clear.
- More finalization work may take longer. The trade-off is intentional because the repo definition of done prefers completed checks over summaries of agent-executable work.
