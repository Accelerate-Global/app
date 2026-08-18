## 1. Planning and contracts

- [x] 1.1 Run `pnpm run task:kickoff` with the owned OpenSpec, Supabase, heartbeat, shared email, test, and documentation paths.
- [x] 1.2 Run `pnpm run verify:change` and record the required commands, targeted smoke subset, and local Supabase requirement before product-code edits.
- [x] 1.3 Validate the OpenSpec proposal, design, and delta specifications.

## 2. Durable Supabase notification delivery

- [x] 2.1 Create a Supabase migration for the RLS-protected operational notification outbox, constraints, indexes, service-role-only RPCs, free-tier budgets, cooldown suppression, retry state, and retention cleanup.
- [x] 2.2 Add the fail-open `pg_net` insert trigger and one 15-minute `pg_cron` retry job using only named Supabase Vault secrets.
- [x] 2.3 Implement the authenticated `send-operational-alert` Edge Function with bounded claiming, fixed sanitized templates, Resend idempotency, success recording, and retryable failure recording.
- [x] 2.4 Add focused database and Edge Function logic tests for permissions, budgets, deduplication, claiming, retry exhaustion, escaping, authorization, and Resend responses.

## 3. Independent Vercel fallback

- [x] 3.1 Add a server-only Resend operational-email helper with configuration validation, fixed safe templates, deterministic idempotency headers, and request timeouts.
- [x] 3.2 Extend the existing Supabase heartbeat so a failed read attempts direct Resend delivery while preserving its authorization, read-only queries, response contract, and normalized logging.
- [x] 3.3 Update the heartbeat and helper tests for successful checks, successful outage mail, missing configuration, Resend rejection, timeouts, and absence of email on healthy checks.

## 4. Operations and documentation

- [x] 4.1 Document Supabase Edge Function secrets, Vault secret names, Vercel environment variables, sender/recipient setup, quota assumptions, test procedure, rotation, rollback, and the explicit absence of GitHub delivery.
- [x] 4.2 Add or update environment examples without committing secret or recipient values.
- [x] 4.3 Verify local configuration and deployment commands discover current Supabase CLI syntax rather than relying on remembered flags.

## 5. Verification and release readiness

- [x] 5.1 Run focused unit and database tests, `pnpm run verify:fast`, and every command required by `pnpm run verify:change`.
- [x] 5.2 Run `pnpm run verify:change:run` as the terminal local gate and resolve any environment, test-gap, contract/harness, or product failures.
- [x] 5.3 Deploy or configure authorized remote Supabase/Vercel pieces when the required existing credentials are available, then verify one non-sensitive test delivery without exposing recipient or secret values.
- [x] 5.4 Run `/opsx:verify`, mark all tasks complete, archive the OpenSpec change, and confirm no GitHub operational-delivery dependency remains.
