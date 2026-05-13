## Why

The Codex Security scan found four fixable security gaps in the current app: an affected Next.js version range, CSV formula preservation, state-changing admin refreshes over GET, and vulnerable dependency paths through the `shadcn` toolchain. These should be fixed together because they touch the same release gate and security posture.

## What Changes

- Upgrade Next.js and its matching ESLint config out of the high-severity proxy-bypass advisory range.
- Harden repo-owned CSV writers so dataset downloads, saved-table downloads, API connection CSV downloads, and API import snapshots neutralize spreadsheet formula-leading cells while preserving existing CSV encoding behavior.
- **BREAKING** for internal admin APIs: change ISO country-code and ROP-code refresh endpoints from `GET` to `POST`, leaving `GET` as `405 Method Not Allowed`.
- Move and upgrade the `shadcn` package as build/developer tooling and pin vulnerable transitive packages to patched versions so dependency audits no longer report the known high-severity paths.

## Capabilities

### New Capabilities
- `dependency-security`: Dependency security posture and audit-gate expectations for framework and toolchain vulnerabilities.

### Modified Capabilities
- `authenticated-dataset-access`: Dataset and saved-table CSV downloads must neutralize spreadsheet formula cells.
- `api-connection-runs`: API connection CSV output downloads and import snapshots must neutralize spreadsheet formula cells.
- `iso-country-code-resource`: Admin source refresh must use a same-origin protected mutation method.
- `rop-code-resource`: Admin source refresh must use a same-origin protected mutation method.

## Impact

- Affects API contracts for `/api/iso-country-codes/refresh` and `/api/rop-codes/refresh`.
- Affects CSV serialization in `src/lib/csv.ts`, dataset downloads, API connection output downloads, and API import snapshot generation.
- Affects `package.json` and `pnpm-lock.yaml` dependency resolution.
- Does not change admin role eligibility, dataset visibility rules, Supabase schema, RLS policies, Vercel deployment behavior, or UI smoke route coverage.
