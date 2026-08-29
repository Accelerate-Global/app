## Why

Production Supabase Storage is 1.07 GiB, above AX Online's 900 MiB critical threshold, while the database itself remains healthy. Most usage is recoverable API-run history, but the current 30-day/latest-three hot-retention rules and missing package-level restore proof prevent enough verified history from moving to Samson.

## What Changes

- Add an operator-approved package restore-verification workflow that restores one exact Samson API-run package into private staging, verifies its manifest and every member, records auditable proof, and writes nothing to live Supabase Storage.
- Make API-run archive age and hot-version floors explicit, bounded configuration, retaining the existing 30-day/latest-three defaults while allowing a reviewed capacity profile of 7 days/latest one when the active working set is critical.
- Extend prune planning to report the selected retention profile and projected live Storage usage so an operator can prove a plan reaches the intended capacity band before deletion.
- Keep automatic deletion disabled and preserve all dependency, receipt, checksum, stale-plan, exact-object, and operator-approval gates.
- Keep historical recovery points indefinitely on encrypted, deduplicated Samson storage even when their hot Supabase copies are removed.
- **Non-goals:** no database-row pruning, no Auth/account changes, no dataset-version or pipeline-publication cold transition, no browser access to Samson, no Supabase SQL deletion of Storage objects, and no claim of off-site disaster recovery.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `samson-data-archive`: Add auditable package restore verification, configurable capacity-mode API retention, and capacity-projected prune plans.
- `api-connection-runs`: Permit dependency-free historical API-run artifacts outside the configured hot floor to become cold after verified Samson recovery, while preserving stable cold metadata and rehydration identity.

## Impact

- Supabase Storage lifecycle and the private archive catalog; no public Data API or browser privilege changes.
- Samson backup, package verification, prune planning, and operator runbook under `src/lib/data-archive/`, `scripts/`, `infra/samson/`, and `docs/operations/samson-data-archive.md`.
- A private, RLS-enabled audit table and Drizzle schema update may be required to retain restore-verification provenance.
- API-run artifact behavior changes only after explicit production configuration and operator approval; Vercel deployment, admin permissions, Auth, and UI smoke coverage remain unchanged.
