## Why

The production Country/ROG and ROP lifecycle surfaces render timestamps in the
server's local timezone and then hydrate them in the browser's local timezone.
Vercel renders in UTC while users may not, causing a React text-mismatch error
on otherwise healthy reference-resource pages.

## What Changes

- Render reference-resource lifecycle timestamps with an explicit, deterministic
  timezone and locale format during server rendering and browser hydration.
- Add regression coverage for the exact rendered timestamp.
- Preserve all resource data, lifecycle operations, permissions, APIs, and UI
  smoke contracts.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `versioned-reference-resources`: Require lifecycle metadata timestamps to
  hydrate without server/client text differences.

## Impact

- Affects
  `src/components/dashboard/reference-resource-lifecycle.tsx` and its colocated
  test.
- Changes user-visible timestamp presentation on the Country/ROG and ROP admin
  lifecycle controls, including Vercel server rendering.
- Does not change authentication, admin authorization, data integrity,
  Supabase schema or data, API contracts, dependencies, or UI smoke coverage.
- Non-goals: changing resource source timestamps, lifecycle semantics, catalog
  attention states, or non-reference-resource date formatting.
