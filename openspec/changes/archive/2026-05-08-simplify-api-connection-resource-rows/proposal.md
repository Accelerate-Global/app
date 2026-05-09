## Why

The admin API Connections Resources card currently exposes table headers and visible URLs, making a small reference list feel more technical than useful. The Resources card should stay scan-first and label-only while preserving the existing row-opening behavior.

## What Changes

- Remove the visible Resources table header row from `/dashboard/api-connections`.
- Render built-in and captured Resources rows as label-only rows.
- Keep row click, Enter, and Space behavior unchanged for built-in app resources and captured external resources.
- Keep `resourceUrl` as hidden navigation/opening data only.
- Do not change API resource persistence, extraction, API types, database schema, auth, admin permissions, Supabase behavior, Vercel deployment behavior, or UI smoke route coverage.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `api-connection-runs`: Captured Resources grid presentation changes from visible display-text/URL columns to label-only rows.
- `reference-resources`: Built-in Resources card presentation changes from visible display-text/URL columns to label-only rows.

## Impact

- Affects `src/components/dashboard/api-connections-client.tsx` and its component test.
- Updates existing OpenSpec requirements under `openspec/specs/api-connection-runs/spec.md` and `openspec/specs/reference-resources/spec.md`.
- No API, database, migration, auth, provider, or storage changes are intended.
