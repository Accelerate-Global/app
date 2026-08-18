## 1. Planning and contracts

- [x] 1.1 Run `pnpm run task:kickoff` for the OpenSpec, alert policy, connection, pipeline, auth, upload, migration, test, and documentation paths.
- [x] 1.2 Run `pnpm run verify:change` and record required commands, targeted smoke, and local Supabase need before product-code edits.
- [x] 1.3 Validate the OpenSpec proposal, design, and delta specifications.

## 2. Shared capture policy and authentication counter

- [x] 2.1 Implement a server-only closed event policy that builds fixed sanitized alert content, stable fingerprints, deterministic idempotency keys, and safe details links.
- [x] 2.2 Create a Supabase migration for the private bounded authentication-failure window and service-role-only record/reset RPCs with RLS, pruning, and capacity controls.
- [x] 2.3 Add focused unit and pgTAP tests for capture policy safety, repeated-failure thresholding, reset behavior, permissions, pruning, and capacity.

## 3. Connection and pipeline boundaries

- [x] 3.1 Capture failed standard and durable API connection runs only after their redacted failed state is persisted.
- [x] 3.2 Capture stale durable source-run reconciliation failures without alerting cancellations.
- [x] 3.3 Capture only terminally failed pipeline runs after database failure handling, leaving retryable attempts non-alerting.
- [x] 3.4 Add or update focused connection and pipeline tests proving event content, ordering, deduplication identity, and fail-open outcomes.

## 4. Authentication boundary

- [x] 4.1 Add a same-origin password sign-in route using the existing Supabase SSR server client and generic safe error responses.
- [x] 4.2 Count invalid credentials through keyed HMAC identifiers, alert at five failures in 15 minutes, reset on success, and alert immediately on authentication-system failures.
- [x] 4.3 Update the sign-in form to use the server route while preserving loading, error, redirect, and session behavior.
- [x] 4.4 Add route, monitor, and form tests for thresholds, privacy, provider errors, cleanup, cookies, and unchanged UX.

## 5. Upload and import boundary

- [x] 5.1 Capture unexpected upload-authorization and dataset persistence failures from existing server routes without alerting validation or permission errors.
- [x] 5.2 Add an admin-only fixed-stage capture relay for signed Storage transfer and parser execution failures, rejecting arbitrary alert content.
- [x] 5.3 Update the upload client to send a random operation ID and report only confirmed transfer/parser failures while preserving cleanup and progress behavior.
- [x] 5.4 Add route and component tests for each eligible upload stage, excluded local validation, sanitized content, and fail-open behavior.

## 6. Operations and verification

- [x] 6.1 Document capture categories, thresholds, privacy rules, Vercel hash-secret configuration, verification, and rollback; update environment examples without secret values.
- [x] 6.2 Run focused tests, `pnpm run verify:fast`, and every command required by `pnpm run verify:change`.
- [x] 6.3 Run `pnpm run verify:change:run`, resolve all failures, verify the OpenSpec implementation, and sync specs.
- [x] 6.4 Configure the production hash secret, apply the migration, and confirm linked migration drift before release work.
- [x] 6.5 Confirm capture code has no GitHub operational-delivery dependency and prepare the verified change for archive and production deployment.
