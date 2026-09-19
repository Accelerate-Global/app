## Context

Private Qwen spans the Next.js application, Supabase, Vercel, Cloudflare, and two dedicated Samson guests. The repository surface includes the chat UI and APIs, `src/lib/private-data-chat/**`, semantic-context extensions to the generic reference-resource system, Qwen-specific smoke and verification configuration, Cloudflare Worker source, operational scripts, and current capability specs. Live inspection on 2026-09-19 also found Qwen audit and control rows, a semantic-context resource with four versions and ten Storage objects, dedicated database roles/views, the otherwise-unused `vector` extension, Qwen/private-chat Vercel variable names including `ANALYTICS_DATABASE_URL`, a dedicated Worker/Access/VPC/Tunnel/certificate chain, Samson VM 200, and Samson LXC 105.

The historical implementation is interleaved with unrelated work. In particular, `src/lib/dataset-filtering.ts` imports the null-preserving UUPG predicate from `src/lib/private-data-chat/named-filters.ts`, and Qwen-era changes also improved generic ROP/reference-resource and verification behavior. Reverting PRs or deleting whole shared subsystems would therefore damage supported product behavior.

The release workflow normally applies Supabase migrations before the new Vercel application is live. That order is unsafe if the old deployment can still admit chat requests while its database roles and tables are being removed. The change therefore requires a disabled-first production checkpoint before the destructive release.

## Goals / Non-Goals

**Goals:**

- Reach a durable state with no live or deployable Qwen product surface, runtime, semantic catalog, credential contract, provider resource, model asset, service, or dedicated guest.
- Preserve ordinary authenticated datasets, exact UUPG semantics, Country/ROG and ROP resources, generic reference-resource lifecycle behavior, pipeline resource sets, the separate Samson archive service, and unrelated verification hardening.
- Remove live Qwen data with a forward migration and provider cleanup while retaining immutable engineering history and ordinary backup retention.
- Make the removal testable through application, database, provider, and Samson negative inventories.

**Non-Goals:**

- Replacing Qwen with another model or retaining a dormant chat abstraction.
- Rewriting Git history, editing applied migrations, deleting archived OpenSpec changes, or forcing early expiry of existing encrypted backups or provider audit logs.
- Redesigning dataset access, workspace roles, reference-resource authorization, ROP lifecycle, or the archive system.
- Creating a new backup or snapshot of the dedicated Qwen guests before deletion.

## Decisions

### 1. Use a forward decommission, not a revert

The implementation SHALL delete current Qwen code and add a new forward database migration. Historical migration files, commits, PRs, and archived OpenSpec changes remain immutable.

**Rationale:** Qwen entered through multiple interleaved PRs, including shared reference-resource and verification improvements. A merge revert or history rewrite has a materially larger blast radius and does not clean up live provider state.

**Alternative considered:** Revert the original Qwen PR series. Rejected because it would undo unrelated fixes and cannot safely reverse already-applied database or provider changes.

### 2. Extract the shared UUPG seam before deleting the Qwen namespace

The null-preserving UUPG predicate SHALL move to a product-neutral dataset/filter module with parity tests. `src/lib/dataset-filtering.ts` and any other non-chat consumer SHALL depend on that neutral module before `src/lib/private-data-chat/**` is removed.

Country/region alias data that has a non-chat consumer remains in a neutral location. Chat-only planners, compilers, resolvers, continuation state, view handoff, audit code, semantic retrieval, evaluation suites, and gateway clients are deleted.

**Rationale:** This preserves the one known production dependency that crosses from ordinary dataset filtering into the Qwen namespace without retaining a misleading dormant subsystem.

**Alternative considered:** Keep `named-filters.ts` as a compatibility island. Rejected because the product would still depend on a removed feature namespace and future ownership would remain ambiguous.

### 3. Separate generic reference resources from the semantic-context specialization

The implementation SHALL remove only the `semantic-context-catalog` adapter, route, type, UI card behavior, bootstrap, guiding-document endpoint, retrieval projections, and associated tests. Country/ROG, ROP, pipeline resources, immutable version packages, activation/rollback, downloads, health checks, resource sets, and RLS/role boundaries remain.

The current ROP specification loses its conversational access and chat-only query-binding requirements; its standalone page, API, lifecycle, download, and smoke requirements remain authoritative.

**Rationale:** The semantic catalog reused the generic lifecycle but is not evidence that the lifecycle itself is Qwen-only.

**Alternative considered:** Remove the reference-resource additions from the Qwen-era PR. Rejected because those capabilities now serve supported non-Qwen product behavior.

### 4. Use a disabled-first, roll-forward cutover

The production sequence is a state machine with explicit gates:

1. Set `PRIVATE_DATA_CHAT_ENABLED=false` in Production and redeploy the unchanged application.
2. Prove chat admission is closed, Qwen requests have ceased, and `analytics_chat_login` has no active sessions.
3. Ship the application removal and forward database teardown together through the normal verified release path.
4. Verify the Qwen routes are not found and normal datasets/resources are healthy.
5. Remove Qwen variables and Cloudflare resources.
6. Stop, wipe, and delete Samson LXC 105 and VM 200 after immediate identity re-verification and explicit final confirmation.
7. Produce a final negative inventory and archive the change.

**Rationale:** This avoids a window where an old deployment can call database or gateway dependencies that have already been removed.

**Alternative considered:** Delete infrastructure first. Rejected because stale deployments would expose a broken feature and may continue making authenticated requests.

### 5. Split Storage deletion from the transactional SQL teardown

An operator/script step SHALL use the existing authenticated Supabase Storage API to delete only objects under the verified semantic-context resource prefix. It SHALL record keys and counts, re-list the prefix, and stop if unexpected objects are present or deletion is incomplete. The forward SQL migration SHALL then remove the semantic resource manifests/control rows and all Qwen database objects in referentially safe order.

The SQL teardown SHALL:

- clear the semantic resource active pointer and remove its events, findings, entries, versions, and resource row;
- restore generic reference-resource activation and the resource-kind constraint without `semantic-catalog`;
- drop Qwen-only search indexes/generated columns, continuation and binding functions/triggers, embeddings, continuation, binding, and audit tables;
- drop Qwen analytics projections/functions and the now-empty `analytics_ro` schema;
- fail closed if the analytics login still has active sessions, then revoke memberships and drop `analytics_chat_login` and `analytics_chat_reader`;
- drop `vector` only after proving no remaining extension dependency or vector column exists; and
- add pgTAP assertions for Qwen absence plus continued ROP/reference-resource security.

**Rationale:** Supabase Storage object deletion is not a normal Postgres cascade. Keeping object deletion explicit prevents orphaned private artifacts while the migration provides one reviewable database boundary.

**Alternative considered:** Delete only database manifests. Rejected because the private objects would remain in Storage.

### 6. Delete deployment and provider configuration only after the Qwen-free release is healthy

After application/database verification, remove the Qwen/private-chat environment variables from Production, Preview, and Development. Then remove external ingress in this order: dedicated Access service token, Access policy/application, Worker `accelerate-qwen-edge-gateway`, VPC Service `accelerate-qwen-gateway`, Tunnel `accelerate-qwen-samson`, and the dedicated Origin CA certificate for `samson.risencode.org`.

The implementation SHALL verify account/zone ownership at each boundary because the Worker/Tunnel/VPC resources and the Origin CA certificate are not all owned by the same Cloudflare account.

**Rationale:** Removing ingress before origin prevents new access while avoiding an application outage during the earlier cutover.

**Alternative considered:** Leave provider resources disabled for possible reuse. Rejected because they preserve secrets, attack surface, cost, and an inaccurate operating inventory.

### 7. Treat guest deletion as a final destructive checkpoint

VM 200 (`accelerate-llm`) and LXC 105 (`accelerate-qwen-tunnel`) are dedicated to Qwen and excluded from scheduled Proxmox backups. After the provider chain is removed, stop/disable their services, verify ports/connectors are closed, remove credentials/model/runtime/evaluation material, and delete the guests.

Immediately before guest deletion, the implementation SHALL re-read guest ID, name, type, configuration, and running state and request explicit confirmation naming both targets. It SHALL NOT delete LXC 104 or any shared Samson host resource.

**Rationale:** Dedicated powered-off guests are still retained dependencies; deletion is the correct final state, but target confusion at the hypervisor is irreversible.

**Alternative considered:** Keep the guests powered off. Rejected because it leaves the model, credentials, and maintenance burden in place.

### 8. Make absence and preservation equally important verification targets

Repository checks SHALL prove no runtime Qwen/private-chat references remain outside historical migrations, archived OpenSpec, and the sanitized receipt. Browser and route checks SHALL prove retired endpoints return not found. Database tests SHALL prove Qwen objects are absent. Provider/Samson checks SHALL prove named resources and listeners are absent.

The same verification run SHALL prove UUPG parity, dataset access, Country/ROG and ROP browsing/download/lifecycle, reference-resource health, Auth, and archive receipts remain healthy. The impact planner, direct tests, `smoke:check`, database security, selected browser smoke, `verify:change:run`, OpenSpec verify/archive, `verify:ship:local`, and production Release Health remain blocking gates when selected by repository policy.

**Rationale:** A pure negative search could declare success while silently breaking the shared behavior that was extracted or preserved.

**Alternative considered:** Verify only route and provider absence. Rejected because the highest application risk is collateral damage to shared dataset/reference-resource behavior.

### 9. Keep a sanitized decommission receipt, not private chat content

The repository SHALL retain a compact operational receipt containing resource identifiers, deletion timestamps, command/check outcomes, and final negative inventory. It MUST NOT contain secret values, raw prompts, generated responses, result rows, signed tokens, provider credential payloads, or production database connection strings.

**Rationale:** Future operators need evidence of what was removed without recreating the privacy and credential exposure being eliminated.

**Alternative considered:** Retain full exports of audit or semantic data. Rejected because they are not needed for the removal and would create a new sensitive-data retention surface.

## Risks / Trade-offs

- **[Old deployment reaches removed dependencies]** → Disable admission and verify zero traffic/sessions before the migration or provider teardown.
- **[Shared UUPG behavior changes during extraction]** → Move the predicate first, preserve same-stem tests, add direct parity cases for enabled criteria and blank-value behavior, and run dataset filter regression tests.
- **[Generic reference-resource behavior is deleted with semantic context]** → Delete by registered resource key/type rather than by broad table or directory ownership; keep ROP/Country lifecycle and pgTAP assertions in the same change.
- **[Unexpected Storage or database dependencies make deletion unsafe]** → Re-enumerate objects, foreign keys, role ownership, active sessions, and extension dependencies immediately before mutation; abort on drift.
- **[Environment drift leaves a credential behind]** → Inventory and remove names across Production, Preview, and Development, then perform a name-only negative check.
- **[Cloudflare resources are removed in the wrong account]** → Resolve and record the owning account/zone plus exact resource IDs before each delete.
- **[Wrong Proxmox guest is deleted]** → Re-verify ID/name/type/config and require explicit final confirmation for guest 105 and guest 200.
- **[Rollback becomes impossible after data deletion]** → Treat phase 1 as the reversible rollback window. After the forward teardown begins, use roll-forward remediation; do not create a new Qwen backup solely to enable rollback. Existing encrypted backups expire under normal policy.
- **[Historical searches continue finding Qwen]** → Define success as no live/deployable dependency. Explicitly allow immutable migrations, archived changes, Git history, PR history, ordinary backup history, and the sanitized receipt.

## Migration Plan

1. **Prepare and verify the candidate:** run `task:kickoff` for the owned paths and the `verify:change` planner; extract UUPG behavior; remove application/runtime/reference-resource integration; add the Storage cleanup operator; add the forward SQL migration and absence/preservation tests; update current docs/specs/config; run every required local gate.
2. **Close production admission:** set only `PRIVATE_DATA_CHAT_ENABLED=false`, deploy, and verify the chat UI/API no longer admits work, no new audit rows appear, and no analytics-role sessions remain. Rollback at this phase is limited to restoring the flag if no destructive step has started.
3. **Deploy code and database removal:** execute the scoped semantic Storage cleanup, apply the forward migration, deploy the Qwen-free application, and run Release Health plus route, Auth, dataset, UUPG, ROP, Country/ROG, resource-health, and database negative checks. From this point, recovery is roll-forward.
4. **Remove deployment/provider dependencies:** delete all Qwen variable names from every Vercel environment, then revoke/delete Cloudflare Access, Worker, VPC Service, Tunnel, and Origin CA resources in the defined order. Verify endpoints, bindings, DNS/routes, versions, and tokens are absent.
5. **Remove the dedicated origin:** stop/disable Qwen services, verify closed listeners, scrub Qwen material, re-identify the two dedicated guests, obtain explicit final confirmation, and delete LXC 105 and VM 200. Verify no firewall, monitoring, DHCP, backup-exclusion, or inventory reference remains.
6. **Close out:** write the sanitized receipt, run final repository/Supabase/Vercel/Cloudflare/Samson negative inventories, verify preserved capabilities again, complete OpenSpec verification/archive, and run the local pre-ship/release gates.

## Open Questions

No design decision is currently blocking implementation. Live counts, identifiers, ownership, active sessions, and dependency graphs are intentionally treated as precondition checks and must be re-read at the moment of each destructive phase rather than frozen from the 2026-09-19 assessment.
