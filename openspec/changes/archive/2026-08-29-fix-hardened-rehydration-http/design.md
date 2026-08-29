## Context

Samson runs Node with `--jitless` inside a systemd unit that prohibits writable-executable memory. The backup, receipt, and alert paths already avoid Node's built-in WebAssembly-backed fetch by using `src/lib/data-archive/http-client.ts`. Rehydration still imports `createSupabaseAdminClient`, causing Undici to initialize WebAssembly before the operator workflow can restore or upload an object.

The rehydration data plane needs binary upload, optional exact-object conflict download, and cleanup deletion. The existing hardened client currently accepts only string bodies and caps text responses at 1 MiB.

## Goals / Non-Goals

**Goals:**

- Keep `MemoryDenyWriteExecute=true` and `--jitless` for rehydration.
- Support bounded binary HTTPS request/response bodies without built-in fetch or WebAssembly.
- Preserve Supabase service-key authorization, exact collision-free paths, conflict checksum checks, and best-effort cleanup.
- Prove the rehydration module no longer imports the Supabase HTTP client.

**Non-Goals:**

- Change Restic, database transactions, Auth, RLS, retention, or package eligibility.
- Persist a production database or Storage administration credential on Samson.
- Add a browser or Vercel rehydration route.

## Decisions

Extend the existing `archiveFetch` abstraction with `Uint8Array` request bodies, `arrayBuffer()` responses, and an explicit per-request response-size limit. The default remains 1 MiB for receipts and alerts; conflict downloads opt into a limit equal to the expected restored object size.

Construct exact Supabase Storage REST requests directly from the existing server-only Supabase URL and secret/service-role key. Upload uses the authenticated object endpoint with `x-upsert: false`; conflict verification downloads that exact target; cleanup uses the bucket remove endpoint with a one-path `prefixes` body. Paths are encoded segment by segment.

Inject the hardened fetch dependency into exported Storage helpers for deterministic tests. A separate native-fetch polyfill or disabling the systemd protection was rejected because either would reintroduce the failing runtime boundary or weaken the approved security posture.

## Risks / Trade-offs

- [Binary responses consume memory] → Require an explicit safe response bound and match conflict-download size to the expected object.
- [Storage REST behavior drifts] → Mirror the installed Supabase Storage client's exact endpoints and cover request method, path, headers, and body in tests.
- [Cleanup request fails] → Preserve the existing failed audit state and sanitized alert while attempting exact-path cleanup only.

## Migration Plan

Deploy the client and rehydration changes, run direct and full repository verification, update only the approved worker files on Samson, and retry the same idempotent drill. Rollback restores the prior fail-closed rehydration module; no database migration is required.

## Open Questions

None.
