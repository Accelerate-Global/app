## Why

The partner export profile slide-out remains constrained by the shared Sheet
primitive's narrow desktop maximum, leaving its multi-column mapping controls
cramped. It needs a stronger feature-level override and a visibly wider desktop
working area.

## What Changes

- Widen the partner export profile slide-out from one-half to two-thirds of the
  viewport on tablet and desktop screens.
- Keep the slide-out full-width on mobile.
- Use explicit width and maximum-width overrides so the shared Sheet's narrow
  defaults cannot cap this feature.
- Preserve the existing profile fields, smoke markers, scrolling, save controls,
  permissions, and export behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `partner-export-profiles`: Increase the responsive partner export editor width
  while preserving mobile and workflow behavior.

## Impact

- UI and direct test: `src/components/dashboard/dataset-partner-exports.tsx`
  and its same-stem test.
- Durable behavior: `openspec/specs/partner-export-profiles/spec.md`.
- No auth, admin permission, data integrity, Supabase, API, or Vercel workflow
  changes. Existing UI smoke attributes remain unchanged.
