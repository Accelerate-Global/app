# Data pipeline documentation

This directory is the AX Online source of truth for porting AX Data behavior.

- [Flow inventory](flow-inventory.md) records every discovered legacy source,
  transform, identity rule, merge, aggregate, resource, and publication path.
- [Decision log](decision-log.md) separates approved online replacements from
  rules that still block a future source or product publication.
- [Operator runbook](operator-runbook.md) describes the shared online lifecycle,
  resource declarations, retries, deployment, and rollback.
- [AX identity registry operations](identity-registry.md) covers candidate review,
  conflict remediation, explicit legacy import, cutover, and forward-only recovery.
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

Import the five complete retained AX Data resource snapshots with
`pnpm run pipeline-resources:import:local` for the local database or
`pnpm run pipeline-resources:import:remote` for the linked environment. The
importer uses a fixed path/checksum manifest and fails closed on drift; see the
[operator runbook](operator-runbook.md#import-the-complete-retained-snapshots)
before using either command.
