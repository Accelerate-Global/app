## Why

The identity-registry test suite currently reads five large legacy AX production ledgers from the sibling `data` repository. That local-only dependency passed on the development machine but failed GitHub App Quality because the files are intentionally not stored in this repository.

## What Changes

- Move the stable-row-key hashing, redaction, audit checksum, and reconciliation-decision assertions into the checked-in synthetic identity graph so they run in every environment.
- Keep production inventory and reconciliation expectations pinned in the repository manifest; the explicit legacy-import workflow continues to validate the real checksummed ledgers when they are supplied.
- Document the repository test-data boundary so required CI checks never depend on untracked sibling-repository data.
- Do not commit or copy production identity records into this repository.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pipeline-contract-characterization`: Require CI characterization to use committed sanitized fixtures while retaining manifest-pinned production expectations and explicit checksummed import validation.

## Impact

- Affected test: `src/lib/identity-registry/importer.test.ts`.
- Affected contract: `openspec/specs/pipeline-contract-characterization/spec.md` through this delta.
- Auth, admin permissions, runtime APIs, data integrity behavior, Supabase, Vercel runtime behavior, and UI smoke coverage are unchanged.
- The production identity manifest and its fail-closed cutover posture remain unchanged.
