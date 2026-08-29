## Why

The first post-prune live rehydration drill failed closed because `src/lib/data-archive/rehydration.ts` imported Supabase's WebAssembly-backed HTTP stack, which cannot start under Samson's required `MemoryDenyWriteExecute=true` and `--jitless` boundary. Rehydration must preserve that hardening while uploading and reconciling exact restored objects.

## What Changes

- Extend the existing hardened archive HTTPS client to support bounded binary request and response bodies.
- Route rehydration upload, conflict verification, and cleanup deletion through that pure-JavaScript HTTPS client.
- Remove the Supabase browser/server client import from the Samson rehydration module.
- Add direct tests for binary transport, authenticated exact-object requests, conflict verification, and cleanup deletion.
- Keep Restic verification, collision-free paths, database transactions, operator approval, and target non-advancement unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `samson-data-archive`: API-package rehydration must run under Samson's writable-executable-memory prohibition using the hardened HTTPS transport.

## Impact

- Affected code: `src/lib/data-archive/http-client.ts`, `src/lib/data-archive/rehydration.ts`, and their direct tests.
- Supabase Storage writes remain exact and service-key authorized; Auth, RLS, admin roles, database schema, Vercel APIs, and UI smoke coverage do not change.
- The production database transaction and immutable recovery audit remain as specified in `openspec/specs/samson-data-archive/spec.md` and `docs/operations/samson-data-archive.md`.
- Non-goals: no weakening of systemd memory protection, no persistent full-access credential on Samson, and no change to dataset or publication targets.
