## Why

The resource screens currently treat ordinary usable state and expected ROP hierarchy gaps as warnings, which adds visual noise and makes a failed refresh harder to distinguish from normal data. The ROP refresh also needs to preserve the active usable version when a candidate cannot be built so a transient or upstream failure does not make the resource catalog look broken.

## What Changes

- Keep inactive candidate and build labels off catalog cards whenever an active usable resource exists; administrators retain the detail-page lifecycle review surface.
- Remove the ROP page's partial-page “loaded of total” badge while retaining useful taxonomy counts and retrieval time.
- Treat an intentionally included ROP25 row without a ROP3 child as normal display state and omit its warning icon and warning badge.
- Diagnose and correct the ROP refresh build failure, while preserving the last active resource and providing actionable failure information to administrators.
- Update focused UI and refresh regression tests and keep the existing route smoke coverage intact.

Non-goals:

- Do not remove ROP25-only rows or synthesize missing ROP3 codes.
- Do not change authentication, dataset-admin permissions, public API shapes, Supabase schema, or Vercel deployment behavior.
- Do not hide genuine refresh failures from administrators.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reference-resources`: Refine catalog attention-state presentation and failed-candidate behavior for usable resources.
- `rop-code-resource`: Simplify ROP summary and row presentation for partial pagination and expected ROP25-only rows.

## Impact

- Resource catalog rendering in `src/app/dashboard/resources/page.tsx`.
- ROP table and lifecycle rendering in `src/components/dashboard/rop-codes-client.tsx`.
- ROP refresh/build behavior under `src/lib/reference-resources/` and its HIS adapter if diagnosis confirms a product defect there.
- Existing page/component and refresh tests; no new shared UI primitive or route is expected.
- UI smoke coverage remains on the existing `/dashboard/resources` and `/dashboard/rop-codes` routes.
- No expected auth, permission, database schema, Supabase configuration, Vercel configuration, or API contract changes.
