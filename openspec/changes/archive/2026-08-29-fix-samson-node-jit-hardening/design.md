## Context

The archive and missed-run services execute TypeScript through Node 22 and `tsx` inside a hardened Debian systemd unit. `MemoryDenyWriteExecute=true` is intentionally present, but default V8 baseline/JIT compilation attempts an executable-memory permission transition and aborts with `Check failed: 12 == errno` before the worker reaches application code. A live transient-unit diagnostic proved Node 22 plus `tsx` starts under the same protection when invoked with `--jitless`.

## Goals / Non-Goals

**Goals:**

- Preserve `MemoryDenyWriteExecute=true` and the rest of the existing sandbox.
- Make both Node-based Samson services start reliably.
- Keep the compatibility choice covered by a direct repository test and operational documentation.
- Validate the fix with two production backup runs before enabling timers.

**Non-Goals:**

- Relaxing systemd protections or changing guest/network topology.
- Changing backup data, receipt schemas, Supabase RLS/Auth, Vercel runtime behavior, retention, or pruning policy.
- Optimizing worker CPU throughput; this is a nightly I/O-heavy workload.

## Decisions

Use Node's supported `--jitless` flag in both unit `ExecStart` commands. This prevents V8 from requiring writable-executable memory while retaining the stronger systemd restriction. Because JIT-less Node disables WebAssembly and Node's built-in fetch path depends on a WebAssembly HTTP parser, the Samson worker uses the pure-JavaScript `node-fetch` implementation for storage authentication, receipt delivery, and direct alerts. Removing `MemoryDenyWriteExecute` was rejected because it weakens the intended service boundary; replacing the worker runtime or precompiling the entire application was rejected as disproportionate for this compatibility fix.

The direct unit-file test SHALL assert both `--jitless` and `MemoryDenyWriteExecute=true`. Live rollout SHALL first reload the units, run the service manually twice, verify signed production receipts and Restic deduplication, and only then enable timers.

## Risks / Trade-offs

- [Risk] JIT-less execution is slower for CPU-heavy JavaScript. → The worker is dominated by provider I/O, hashing, database export, and Restic; measure the production runtime and preserve the six-hour timeout.
- [Risk] A future unit edit removes either side of the compatibility pair. → Test both the Node flag and retained memory protection.
- [Risk] A runtime dependency uses Node's WebAssembly-backed built-in fetch. → Route every Samson outbound HTTP call through the pinned pure-JavaScript client and prove the production backup and alert paths.

## Migration Plan

1. Update and test both unit files and the runbook.
2. Deploy the unit files to Samson and run `systemctl daemon-reload`.
3. Execute two manual backups and verify catalog receipts, integrity, and unique-byte measurements.
4. Enable the 2:00 a.m. and missed-run timers only after both runs pass.
5. Roll back by restoring the prior unit files while keeping timers disabled; do not remove memory hardening as an emergency workaround.

## Open Questions

None.
