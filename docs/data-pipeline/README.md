# Data pipeline documentation

This directory is the AX Online source of truth for its current data pipeline.

## Production readiness boundary

As of 2026-09-04, the linked production schema contains the ten supported flow
definitions but no source-profile bindings, flow runs, schedule state,
publications, or release sets. That empty operational state is intentional: the
runtime and contracts are present, but Plan 002 production onboarding/cutover is
a separate P1 delivery program requiring real source ownership, per-flow canary
evidence, review, and rollback approval. It is not hidden repository cleanup and
must not be started by a release or migration check alone.

- [Flow inventory](flow-inventory.md) records every discovered legacy source,
  transform, identity rule, merge, aggregate, resource, and publication path.
- [Decision log](decision-log.md) separates approved online replacements from
  rules that still block a future source or product publication.
- [Operator runbook](operator-runbook.md) describes the shared online lifecycle,
  resource declarations, retries, deployment, and rollback.
- [AX identity registry operations](identity-registry.md) covers empty-authority
  activation, current-evidence allocation, review, and forward-only recovery.
- [Tier 1 product operations](tier1-products.md) covers exact release selection,
  Tier 1/Aggregate 1 run order, review, stable publication targets, and recovery.
- [Tier 2 partner and product operations](tier2-products.md) covers configured
  partner profiles, profile-specific canaries and schedules, exact releases,
  Aggregate 2 publication, and rollback.
- [`tests/fixtures/pipelines/`](../../tests/fixtures/pipelines/) contains the
  sanitized comparison corpus and golden results.

Run `pnpm pipeline:characterize` after changing a fixture or a ported rule. The
command is intentionally offline and fails if the computed result differs from
the checked-in golden output.

Reference resources are versioned inside AX Online. Bootstrap built-in resource
packages or create reviewed immutable versions through their owning admin flow;
see the [operator runbook](operator-runbook.md#reference-resources).
