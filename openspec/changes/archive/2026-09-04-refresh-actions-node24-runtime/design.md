## Context

The successful UI Smoke run for pull request 59 emitted GitHub's Node.js 20
deprecation warning for all six remote action families used by repository-owned
workflows. Each upstream project now publishes an official Node.js 24-compatible
release. Workflows already pin actions by full SHA and policy tests enforce that
property.

## Goals / Non-Goals

**Goals:**

- Remove repository-owned Node.js 20 action warnings before GitHub disables the
  compatibility fallback.
- Preserve immutable action references and existing workflow behavior.
- Verify both local workflow policy and a clean GitHub-hosted run.

**Non-Goals:**

- Upgrade the application's Node.js, pnpm, or Supabase CLI versions.
- Change workflow permissions, events, selection logic, required checks, or
  artifact content.
- Change application, Supabase, Vercel, auth, or UI behavior.

## Decisions

### Pin current official releases directly

Use the release commit for checkout 7.0.1, cache 6.1.0, setup-node 7.0.0,
upload-artifact 7.0.1, pnpm/action-setup 6.0.10, and Supabase setup-cli 3.0.0.
Every reference remains a 40-character SHA with a human-readable version comment.

Alternative considered: use moving major tags. Rejected because repository and
GitHub policy require immutable action references.

### Keep tool versions stable

Only the action wrapper revisions change. The shared bootstrap continues to
install Node 22 and pnpm 10, and setup-cli continues to install Supabase CLI
2.75.0. This isolates runner-runtime compatibility from application/toolchain
upgrades.

### Prove the hosted result

Local policy and terminal gates validate syntax and behavior. The pull-request
checks provide the final evidence that GitHub-hosted actions execute without the
Node.js 20 annotation. No local Supabase state is required for the focused policy
test; the repository terminal gate may start its normal ephemeral stack.

## Risks / Trade-offs

- **[Upstream major release changes an input contract]** → Use only currently
  documented inputs, review official release notes, and require all hosted checks.
- **[Full-SHA comments drift from their referenced release]** → Resolve each SHA
  from the upstream release tag and include the exact patch version in comments.
- **[A generated GitHub-owned action still warns]** → Distinguish provider-owned
  generated workflows from repository-owned files and verify PR annotations.

## Migration Plan

1. Replace action SHAs and version comments without changing inputs.
2. Run workflow-policy tests, OpenSpec validation, and the repository terminal
   gates.
3. Archive this change, push it to pull request 59, and require a warning-free
   hosted check run before merge.

Rollback is a revert of this pin-only commit, though the previous Node.js 20
revisions are intentionally not a viable long-term state.

## Open Questions

None.
