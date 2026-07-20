## Why

The production ROP page still renders its source-retrieval timestamp in the
server's local timezone and hydrates it in the browser's local timezone. The
lifecycle timestamp beside it is now deterministic, but this separate resource
metadata timestamp still produces a React text-mismatch error in production.

## What Changes

- Render Country/ROG and ROP source-retrieval timestamps with the same explicit
  UTC timezone and stable locale fields used by lifecycle metadata.
- Add regression assertions for both resource pages' exact timestamp text.
- Preserve all resource data, lifecycle operations, permissions, APIs, and UI
  smoke contracts.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `versioned-reference-resources`: Clarify that every server-rendered
  reference-resource metadata timestamp must hydrate deterministically.

## Impact

- Affects the Country/ROG and ROP client components and their colocated tests.
- Changes user-visible source timestamp presentation to explicitly labeled UTC.
- Does not change Supabase, data, authentication, APIs, dependencies, or smoke
  coverage.
