## 1. Planning and Change Contract

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff` with the Worker, runbook, durable spec, and change-artifact paths owned by this task.
- [x] 1.2 Create and validate the OpenSpec proposal, design, and `private-model-gateway` delta requirement before application edits.

## 2. Samson Origin Identity

- [x] 2.1 Generate and retain the RSA key on Samson, issue the two-year Cloudflare Origin CA certificate for only `samson.risencode.org`, and validate SAN, dates, CA chain, hostname, and key match.
- [x] 2.2 Retain a root-only rollback pair, install the new certificate atomically, restart the gateway, and verify local plus connector-side HTTPS health with the new SNI.

## 3. Worker and VPC Strict Verification

- [x] 3.1 Change the Worker origin URL to `https://samson.risencode.org` and update the same-stem tests to assert planning and health requests use the strict origin identity.
- [x] 3.2 Run Worker types, focused tests, and deployment dry-run; deploy to the existing personal-account Worker; verify unauthenticated Access denial; and leave the provider-owned Production service token unchanged and unexported.
- [x] 3.3 Change VPC Service `01a04934-2091-7de1-9f7c-6c686698cbd8` to `verify_full`; prove strict VPC success with a randomized health-only Worker; delete and confirm removal of that probe; and confirm no public DNS record or public Tunnel route was added for `samson.risencode.org`.

## 4. Operations Documentation

- [x] 4.1 Replace the temporary verification exception in both Qwen runbooks with the strict-TLS topology, cross-account resource ownership, certificate expiry and renewal window, verification commands, and ordered rollback procedure.

## 5. Repository Verification and Completion

- [x] 5.1 Run `pnpm run spec:validate`, `pnpm run typecheck`, `pnpm run verify:test-delta`, the direct Worker tests, and every additional required command reported by `pnpm run verify:change`.
- [x] 5.2 Pass `pnpm run verify:change:run` on the combined candidate tree, classify and fix any product, test-gap, contract/harness, or environment failure, and rerun `pnpm run verify:change` to confirm the required list is complete.
- [x] 5.3 Verify the implementation against this change and leave the production chatbot feature flag unchanged; archive the verified change as the workflow completion action.
