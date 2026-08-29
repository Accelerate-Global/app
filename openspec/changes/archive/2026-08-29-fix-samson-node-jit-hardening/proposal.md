## Why

The production Samson worker exits before backup work because the systemd unit combines `MemoryDenyWriteExecute=true` with Node's default JIT, which requires executable memory transitions. The archive must remain hardened while using a Node runtime mode that can start reliably under that policy.

## What Changes

- Run both Samson Node entry points with `--jitless` so V8 does not request writable-executable memory.
- Route Samson's outbound HTTP calls through a pinned pure-JavaScript client because JIT-less Node disables the WebAssembly parser used by its built-in fetch implementation.
- Preserve the existing systemd memory hardening and all other sandbox controls.
- Add a regression assertion covering the hardened Node invocation and document the compatibility reason.
- Apply the corrected unit to Samson and prove two production backups before enabling timers.

Non-goals: this change does not relax systemd hardening, alter Supabase/Auth permissions, change archive contents or retention, enable production pruning, or change the Vercel API contract or UI smoke coverage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `samson-data-archive`: Require the scheduled and missed-run Node workers to start successfully under the retained writable-executable-memory prohibition.

## Impact

- Runtime units: `infra/samson-data-archive/ax-data-archive.service` and `infra/samson-data-archive/ax-data-archive-missed.service`.
- Verification: `src/lib/data-archive/config.test.ts` and live Samson systemd startup checks.
- Operations: `docs/operations/samson-data-archive.md` records why JIT is disabled.
- Supabase data, auth/admin permissions, Vercel deployment behavior, API contracts, and UI smoke coverage are unchanged.
