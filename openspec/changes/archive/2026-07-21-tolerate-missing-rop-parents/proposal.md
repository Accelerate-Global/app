## Why

A single missing HIS ROP2 parent currently invalidates the entire ROP refresh, preventing unrelated valid upstream changes from reaching the reviewable candidate. The refresh should preserve the affected child data as an explicitly unresolved relationship while retaining strict protection against widespread hierarchy corruption.

## What Changes

- Treat a small, bounded number of ROP25 references to absent ROP2 codes as validation warnings instead of fatal source-build errors.
- Preserve affected ROP25, ROP3, and geography data with the referenced ROP2 code displayed as unresolved and without inventing a ROP1 parent.
- Generate structured candidate warnings for each affected visible hierarchy row so administrators can inspect the exact codes before activation.
- Keep duplicate codes, missing ROP1 parents, excessive missing-parent relationships, count-floor failures, and package-integrity failures blocking.
- Preserve the existing manual candidate activation requirement; a warning-bearing candidate never replaces the active version automatically.
- Include the previously completed resource-label and ROP table cleanup in the same release.

Non-goals:

- Do not silently reuse the prior `C0328` mapping for Kabirpanthi or otherwise invent a replacement parent.
- Do not remove the affected Kabirpanthi ROP25, ROP3, or geography records.
- Do not change authentication, dataset-admin permissions, Supabase schema or RLS, public mutation methods, or Vercel project configuration.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `rop-code-resource`: Allow bounded unresolved ROP2 parent references to produce valid candidates with warnings while preserving hierarchy safety limits.

## Impact

- HIS normalization and validation in `src/lib/rop-codes.ts`.
- Persistent candidate warning construction in `src/lib/reference-resources/refresh.ts`.
- ROP package validation and projections in `src/lib/reference-resources/adapters.ts`.
- ROP UI warning coverage in `src/components/dashboard/rop-codes-client.tsx` and focused tests.
- Existing `/dashboard/rop-codes` smoke coverage remains applicable; no new page or UI primitive is introduced.
- Data integrity behavior changes in a bounded way, but auth, permissions, API request contracts, Supabase schema, and Vercel configuration do not change.
