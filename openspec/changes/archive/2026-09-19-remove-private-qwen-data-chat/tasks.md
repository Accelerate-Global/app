## 1. Planning and live baseline

- [x] 1.1 Run `pnpm run task:kickoff -- --scope 'openspec/changes/remove-private-qwen-data-chat/**,src/lib/private-data-chat/**,src/app/api/chat/**,src/app/dashboard/chat/**,src/components/chat/**,src/lib/dataset-filtering*,src/lib/reference-resources/**,src/app/api/reference-resources/semantic-context-catalog/**,src/components/dashboard/semantic-context-resource-client*,src/db/schema.ts,supabase/migrations/**,supabase/tests/database/**,infra/cloudflare/qwen-edge-gateway/**,scripts/**,tests/ui/**,config/change-impact*,docs/**,package.json,pnpm-lock.yaml,.env.example'` and record owned paths, unrelated dirty paths, required commands, targeted smoke coverage, and local Supabase needs.
- [x] 1.2 Run `pnpm run verify:change` before implementation and record every required command and contract issue in the kickoff brief.
- [x] 1.3 Re-inventory Supabase, Vercel, both owning Cloudflare accounts/zones, and Samson read-only; record exact Qwen resource IDs/names, object/row counts, role sessions, guest identity/configuration, and preservation targets without recording secret values or private chat content.
- [x] 1.4 Confirm the historical-retention boundary: live Qwen data and infrastructure will be removed, while Git/PR history, archived OpenSpec, applied migrations, provider audit history, and existing encrypted backups remain under ordinary retention.

## 2. Close production admission

- [x] 2.1 Set only the Production `PRIVATE_DATA_CHAT_ENABLED` value to `false`, redeploy the otherwise unchanged application, and record the deployment identifier and timestamp.
- [x] 2.2 Verify all roles are denied chat admission, no new Qwen audit activity appears during the observation window, and `analytics_chat_login` has zero active sessions; stop before destructive work if any check fails.

## 3. Preserve shared dataset behavior

- [x] 3.1 Move the null-preserving UUPG predicate and option contract from `src/lib/private-data-chat/named-filters.ts` into a product-neutral dataset/filter module with direct parity tests for each criterion, combined criteria, false values, and blank values.
- [x] 3.2 Update `src/lib/dataset-filtering.ts` and its same-stem tests to use the neutral UUPG module and prove ordinary dataset filtering no longer imports a private-data-chat path.
- [x] 3.3 Move or retain canonical filter-region data and aliases only where a non-chat consumer exists, update those imports, and preserve their direct regression tests before deleting chat geography code.

## 4. Remove the application chat surface and runtime

- [x] 4.1 Delete the `/dashboard/chat` page, `/api/chat` route, view-context route, `src/components/chat/**`, and their same-stem tests so direct requests resolve through normal not-found behavior.
- [x] 4.2 Remove Qwen navigation, the dataset `Ask Qwen about this view` action, signed-view-context creation, browser session-storage state, chat navigation, and Qwen-specific sign-out cleanup; update the affected navigation, dataset action-bar/client, account-control, and route tests.
- [x] 4.3 Delete `src/lib/private-data-chat/**` after the shared seams are extracted and prove no remaining runtime import references that namespace.
- [x] 4.4 Delete the semantic-context guiding-document API, semantic resource client, and their direct tests.
- [x] 4.5 Add or update route-level assertions that the retired chat and semantic-context endpoints are absent and that no model, analytics, retrieval, or audit dependency is contacted.

## 5. Remove semantic-context specialization while preserving generic resources

- [x] 5.1 Remove `semantic-context-catalog` from reference-resource adapters, types, routes, index/refresh logic, catalog metadata, page/card rendering, and their same-stem tests without changing Country/ROG, ROP, or pipeline-resource behavior.
- [x] 5.2 Remove `semantic-catalog` from the Drizzle reference-resource kind type and update schema/type tests for the retained kinds.
- [x] 5.3 Remove semantic-context bootstrap from local/remote database push/reset chains and smoke bootstrap while keeping generic reference-resource bootstrap idempotent.
- [x] 5.4 Extend direct reference-resource tests to prove Country/ROG and ROP discovery, paging, search, download, candidate review, activation, rollback, health, and resource-set behavior remain independent of semantic context.

## 6. Remove repository tooling, dependencies, and current-state references

- [x] 6.1 Delete `infra/cloudflare/qwen-edge-gateway/**`, Qwen evaluation/retrieval/latency/resource scripts, generated review documents, and active Private Data Chat operations documentation.
- [x] 6.2 Remove Qwen package scripts, semantic bootstrap hooks, the private-chat database-security lane, and the direct `wrangler`/`@cloudflare/workers-types` dependencies; regenerate `pnpm-lock.yaml` and prove no independent consumer requires them.
- [x] 6.3 Remove all Qwen/private-chat variables from `.env.example`, UI-smoke environment construction/tests, fake-gateway configuration, and current deployment documentation without printing any live value.
- [x] 6.4 Remove Qwen routes and journeys from `tests/ui/route-registry.ts` and smoke tests, regenerate the shared fixture manifest with `pnpm run smoke:check`, and preserve coverage for every remaining page and surface.
- [x] 6.5 Remove the Qwen impact domain and commands from `config/change-impact.ts` plus its generated/tested contracts while preserving unrelated migration, database-security, smoke, and verification rules.
- [x] 6.6 Update README, current-state architecture, operations, testing strategy, and open-question documents to describe the Qwen-free product and retain only a sanitized decommission runbook/receipt template.

## 7. Implement the Supabase teardown

- [x] 7.1 Add a dry-run-first semantic Storage cleanup operator with tests that resolves the exact `semantic-context-catalog` resource and prefix, lists expected objects, rejects drift, deletes through the authenticated Storage API, and verifies the target prefix is empty without touching other resource artifacts.
- [x] 7.2 Add one forward migration that clears the semantic active pointer; removes its activation events, findings, entries, versions, manifests, and resource row in safe order; restores generic reference-resource activation; and restores the resource-kind constraint without `semantic-catalog`.
- [x] 7.3 In the same migration, remove the Qwen-only search index/generated column, continuation/binding triggers and functions, embeddings/continuation/binding/audit tables, analytics views/functions/schema, grants/memberships/roles, and the `vector` extension only after fail-closed session and dependency checks.
- [x] 7.4 Replace `supabase/tests/database/011_private_data_chat.test.sql` presence expectations with exhaustive Qwen-absence assertions plus preserved Auth, dataset RLS, Country/ROG, ROP, generic activation, and resource-set security assertions.
- [x] 7.5 Update schema, migration, bootstrap, and database-security tests so clean local reset/push succeeds without Qwen roles, passwords, environment variables, semantic data, or analytics connection setup.

## 8. Verify the repository candidate

- [x] 8.1 Run the touched unit/integration tests and `pnpm run verify:fast`; resolve every product, test-gap, contract/harness, or environment failure before broader gates.
- [x] 8.2 Run `pnpm run smoke:check` and every targeted/full browser-smoke command selected by `pnpm run verify:change`, including explicit not-found checks for retired routes and healthy checks for retained dataset/resource routes.
- [x] 8.3 Run the required local Supabase reset/push, pgTAP, database-security, and migration checks selected by the impact planner; stop repo-local Supabase/Docker afterward, prune transient builder cache, and preserve named persistent data.
- [x] 8.4 Run `pnpm run spec:validate`, rerun `pnpm run verify:change`, and pass every listed command through the single terminal gate `pnpm run verify:change:run` on the final tracked tree.
- [x] 8.5 Perform a repository negative inventory proving no live/deployable Qwen, private-data-chat, semantic-context, gateway, credential, route, or package reference remains outside immutable migrations, archived OpenSpec/Git history, and the sanitized decommission material.

## 9. Verify and archive the implementation

- [x] 9.1 Verify implementation completeness, correctness, and coherence against the proposal, design, and all six delta specifications; resolve every mismatch and mark every implementation task complete.
- [x] 9.2 Sync the verified deltas and archive `remove-private-qwen-data-chat` with the repository OpenSpec archive workflow, then rerun strict OpenSpec validation before any ship-local or release action.

## Post-archive release follow-through

Repository policy requires archival before release. After archival, run `pnpm run verify:ship:local`; reconfirm the disabled-admission and zero-session gate; execute and verify the exact semantic Storage cleanup; ship the application and forward migration through every required PR/release gate; verify Release Health, retired-route not-found behavior, and retained dataset/UUPG/Country/ROP/reference-resource behavior; remove all Qwen variable names from Production, Preview, and Development; delete the dedicated Cloudflare Access token/application/policy, Worker, VPC Service, Tunnel, and Origin CA certificate in order; stop and scrub the Qwen services/assets; immediately re-verify Samson LXC 105 and VM 200 and obtain explicit confirmation naming both guests before deletion; then record the sanitized receipt and pass final negative inventories across the repository, Supabase, Vercel, Cloudflare, and Samson. Do not delete LXC 104, rewrite history, edit applied migrations, or prune existing backup snapshots.
