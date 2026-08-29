## 1. Plan and Scope

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff` for the hardened HTTPS and rehydration files.

## 2. Hardened Binary Storage Transport

- [x] 2.1 Extend the archive HTTPS client with bounded binary requests and responses while preserving the default response limit.
- [x] 2.2 Replace the rehydration Supabase client with exact authenticated upload, conflict-download, and cleanup-delete requests.
- [x] 2.3 Add direct tests for binary transport, encoded paths, authorization, immutable upload, checksum conflict handling, and cleanup deletion.
- [x] 2.4 Prove the rehydration module imports no Supabase or built-in fetch client.

## 3. Verification and Recovery Drill

- [x] 3.1 Run direct tests, `pnpm run verify:fast`, and `pnpm run verify:change:run`.
- [x] 3.2 Sync and archive the verified OpenSpec change before ship-local.
- [x] 3.3 Prepare the exact idempotent hardened retry, transient-credential cleanup, live-capacity audit, and final-backup checks for post-release execution.
