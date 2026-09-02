# Private Qwen data chat

## Scope and safety model

The pilot is an admin-only, disabled-first conversation interface over one
approved current people-groups projection. Qwen 3.6 chooses a typed semantic
plan; it never receives SQL, database credentials, a database tool, arbitrary
URLs, or browser access. The application validates the plan, maps catalog keys
to trusted SQL fragments, binds every value separately, and executes through a
dedicated read-only Postgres role.

The analytical audit stores a pseudonymous user identifier, query/policy/model
versions, redacted SQL template or resource operation, immutable resource and
semantic snapshot identifiers, selected semantic-card keys/checksums, retrieval
tier/timing/context bytes, completeness counts, decision, timing, row count, and
response size. It does not store prompts, filter values, retrieved text, result
rows, credentials, provider errors, or assistant text.
Conversation history is browser-held and bounded to 12 messages/20,000
characters per request; it is not persisted by this feature.

## Semantic-context implementation kickoff

OpenSpec change `add-qwen-semantic-rag-context` owns the private-chat planner,
dataset view handoff, reference-resource adapters, additive analytics migrations,
semantic retrieval, chat UI, and their deterministic/browser/database test
surfaces. The implementation is isolated on the
`codex/plan-qwen-semantic-rag` worktree; unrelated local-main changes are not
part of the change.

The pre-implementation repository planner reported no unrelated dirty files and
no targeted browser subset before product edits. Once code and migrations are
present, `pnpm run verify:change` is authoritative for the required commands and
targeted smoke subset. Local Supabase is required for named-filter parity,
version-bound ROP relationships, grants/RLS, function cost, and database security
tests. The terminal gate is `pnpm run verify:change:run`; the release gate is
`pnpm run verify:ship:local` after OpenSpec verification and archival.

The approved interactive UUPG v1 rule is null-preserving. With both criteria
enabled it means:

```text
(Global Engagement Anywhere is false or blank)
AND
(Frontier Group is true or blank)
```

A blank value is not an affirmative classification. It remains because it does
not record the disqualifying opposite value, so incomplete source data does not
create a false exclusion. Explicit global-engagement `true` and frontier `false`
are excluded when their respective criteria are enabled. This interactive rule
is distinct from the separately versioned Baseline UUPG pipeline, which requires
its own stricter source-qualified conditions.

The owner has approved the frozen retrieval promotion gates recorded in the
OpenSpec research/design artifacts: exact critical Recall@1 and required-set
coverage, held-out Recall@6, material-gain thresholds, six-item/8 KiB context,
lexical/hybrid/rerank latency ceilings, no-swap/10% Samson headroom, and no more
than 5% generative-Qwen p95 degradation. These gates must not be weakened after
the sealed holdout is observed.

## Semantic layer

The component between Qwen and the dataset is the repo-owned semantic catalog in
`src/lib/private-data-chat/catalog.ts`. It is intentionally a small typed layer,
not a second data platform:

- Qwen receives a bounded retrieval result from the active immutable semantic
  package: approved grain, field/metric/filter/resource/relationship meanings,
  aliases, types, units, null behavior, allowed operations, value-domain policy,
  formulas, dependencies, and at most two reviewed train-only plan examples.
- Compiler-only view names, columns, SQL expressions, credentials, mutable field
  definition text, and raw database values are excluded from model context.
- Every query plan must echo the exact checksum-bound catalog revision. A stale
  plan is rejected before compilation or database access.
- The catalog records canonical field-definition keys, IMB source-contract
  fields/version, and versioned reference-resource keys as provenance. Those
  existing sources seed and reconcile the reviewed overlay, but their mere
  presence never makes a field queryable.
- Exact reviewed keys/aliases run first; private PostgreSQL full-text search and
  typed dependency expansion select at most six cards and 8 KiB. The frozen
  human-labeled holdout passes every critical gate. Qwen3 embedding and reranker
  candidates were tested on Samson; both remain undeployed because concurrent
  retrieval caused a generative failure and 396.88% p95 degradation.
- Complete ROP browsing/search/list/lookup/count/continue stays behind the typed
  authenticated `rop-codes` adapter with 25-row pages, one-time signed
  continuation, stable ordering, immutable version labels, and an authenticated
  full-export action. Full ROP values are never put in model context.
- `people_group_to_bound_rop3` is the one approved server-owned many-to-one
  relationship. It normally uses immutable producer resource-set lineage. The
  pre-publication production dataset instead has one private forced-RLS,
  append-only binding for its exact dataset version and the reviewed complete
  ROP version; runtime never derives it from the active pointer, and any later
  producer publication takes precedence. The relationship remains
  left/null-preserving, and Qwen never supplies a physical key or join
  predicate. One-to-many geography uses an `EXISTS`-style filter or explicit
  resource detail grain so it cannot multiply people-group rows. Exact ROP
  geography values resolve first; natural-language country names fall back to
  the reviewed country catalog and become only a verified code present in the
  reviewed ROP package. Both resource versions are retained as internal
  evidence, and an ROP-version mismatch fails closed.
- A signed current-view handoff can carry only supported country, UUPG, and sort
  semantics. Counts remain server-derived, and client summaries are bounded,
  same-origin, versioned display data.

Country filter names, aliases, alpha codes, FIPS values, and ROG3 values are
resolved by application code against the active `country-territory-codes`
resource after planning. One exact normalized match becomes the canonical display
name, multiple matches ask a clarification, and no match remains an inert
parameter that may return zero rows. The country resource itself is never sent to
Qwen, and the application does not discover unrestricted values with database
`DISTINCT` queries.

Final narration receives only the semantic definitions selected by the compiled
query, completeness/evidence state, and bounded rows. Internal provenance remains
auditable and signed but is intentionally not rendered in each chat response. In
particular, null values keep their catalog meaning and are not silently treated
as zero or false.

### Catalog promotion checklist

1. Update the reviewed catalog metadata and compiler mapping together.
2. Recompute the SHA-256 catalog checksum and revision suffix; the catalog unit
   test fails until they agree.
3. Reconcile cited canonical field/source contracts and confirm no mutable field
   definition or uploaded column became queryable implicitly.
4. Add or update sanitized golden decisions, compiled selected keys, positional
   parameters, ambiguity cases, and adversarial cases.
5. Run deterministic repository verification, then generate a new three-run
   temperature-zero Samson receipt for the exact model/runtime/prompt/schema/
   catalog/compiler/fixture hashes before release.

## Configuration

Keep `PRIVATE_DATA_CHAT_ENABLED=false` until every gate below passes. Configure
server-only values:

- `PRIVATE_DATA_CHAT_CANARY_EMAILS`: comma-separated exact administrator email
  identities. An admin not on this list is denied; an empty list fails closed.
- `ANALYTICS_DATABASE_URL`: pooled TLS URL for `analytics_chat_login`; never use
  the normal application connection or Supabase service role.
- `PRIVATE_DATA_CHAT_AUDIT_HMAC_KEY`: random value of at least 32 characters.
- `PRIVATE_DATA_CHAT_SEMANTIC_CONTEXT_ENABLED`: keep false until the active
  semantic package, signed-state keys, gateway contract, and canary gates pass.
- `PRIVATE_DATA_CHAT_TURN_STATE_HMAC_KEY`,
  `PRIVATE_DATA_CHAT_VIEW_CONTEXT_HMAC_KEY`, and
  `PRIVATE_DATA_CHAT_CONTINUATION_HMAC_KEY`: independent random server-only
  values of at least 32 characters.
- `PRIVATE_QWEN_GATEWAY_URL`: Access-protected HTTPS `workers.dev` URL for the
  narrow Cloudflare edge relay; never the Samson address.
- `PRIVATE_QWEN_GATEWAY_HMAC_KEY`: random value of at least 32 characters,
  installed independently in Vercel and the gateway credential store.
- `PRIVATE_QWEN_CF_ACCESS_CLIENT_ID` and
  `PRIVATE_QWEN_CF_ACCESS_CLIENT_SECRET`: Cloudflare Access service-token pair.
- `PRIVATE_QWEN_FAKE=true`: local/UI-test only. It must be absent or false in
  deployed environments.

The Samson gateway separately pins the current and rolling-previous planner and
answer prompt hashes plus one aggregate runtime-contract checksum. That checksum
covers the response schemas, query/compiler policy, catalog, named-filter
registry, retrieval policy, resource-operation allowlist, and relationship
registry. The gateway recomputes both the aggregate checksum and the endpoint's
schema checksum before inference; the previous contract is removed after the
strict production canary.

The production analytics login password is provider-owned secret material. Do
not commit it, place it in build logs, give it to Qwen/Samson, or reuse the local
test password.

## Deployment sequence

1. Pass `pnpm run db:security` locally and review the migration grants/RLS tests.
2. Pass the frozen Samson benchmark receipt and verify its model, runtime,
   planner/answer prompts, response schemas, aggregate runtime contract,
   catalog, and fixture hashes.
3. Choose and document either a separate non-production Vercel/Supabase stack
   or an explicitly approved one-user production canary.
4. Apply the reviewed migration to that environment and set a unique password
   for `analytics_chat_login`. Verify positive admin and negative non-admin
   identities with non-mutating queries.
5. Install the gateway unit and credentials from the Samson project. Keep
   llama.cpp on `127.0.0.1:8080`; expose only the gateway listener to the
   connector host.
6. In the selected personal Cloudflare account, enable Zero Trust Free; create the
   remotely managed `accelerate-qwen-samson` Tunnel and the exact
   `10.77.0.30:8443` Workers VPC Service; deploy
   `accelerate-qwen-edge-gateway` to `workers.dev`; and protect the Worker with
   a Service Auth policy containing only the Vercel service token. Do not
   create a public tunnel hostname or publish llama.cpp.
7. Configure the Vercel server-only values with the Worker URL and one-time
   Access service-token pair while the feature remains disabled.
8. Verify health, signed-request rejection/replay behavior, one-user data flow,
   empty results, unavailable/timeout/busy states, audit redaction, and role
   denial.
9. Set `PRIVATE_DATA_CHAT_ENABLED=true` only after the exact approved canary is
   present in `PRIVATE_DATA_CHAT_CANARY_EMAILS`, then monitor
   latency, queue pressure, gateway failures, database timeouts, and audit
   insert failures before expanding to administrators.

## Routine verification

- `pnpm vitest run src/lib/private-data-chat src/app/api/chat/route.test.ts`
- `pnpm run verify:fast`
- `pnpm run smoke:check`
- `pnpm run db:security`
- `pnpm run verify:change:run`
- `pnpm run verify:ship:local` before a release request

The 450-case v5 suite covers supported aggregates and records, every approved
ROP dimension/record/filter operator/null boundary, resource operations, UUPG
options, signed current-view and continuation boundaries, completeness, aliases,
ambiguous and unsupported requests, multi-turn resolution, empty results,
mutations, prompt exfiltration, and SQL-looking inert values. Regenerate the
real-Qwen receipt whenever the model artifact,
llama.cpp runtime, planner or answer prompt, response schema, semantic catalog,
compiler policy, or sanitized fixtures change. Live model inference is a release
receipt, not a public CI dependency.

The retrieval decision and pinned candidate receipts are summarized in
`docs/operations/private-data-chat-retrieval-benchmark-v1.md`; the pinned v5
generative and production-canary record is
`docs/operations/private-data-chat-evaluation-v5.md`.

## Failure behavior

- Missing/invalid configuration: page is hidden from navigation and the direct
  admin page shows a disabled state; the API returns unavailable.
- Qwen busy/unavailable/timeout: no query runs unless a valid plan was already
  obtained. If only the explanation call fails, the verified bounded rows are
  returned through the deterministic fallback. A single Samson model call is
  bounded at 195 seconds and the application call at 210 seconds, leaving
  margin inside the verified 300-second Vercel function window; an origin 504
  is exposed only as a normalized retryable timeout.
- Database denial/offline/timeout/cost/size limit: fail closed and return a
  normalized query error; no broader database credential is attempted.
- Empty result: report that the bounded query found no matching records; do not
  claim that none exist outside the approved projection.
- Cancellation: abort the in-flight model request and leave existing transcript
  content intact.

## Rollback

1. Set `PRIVATE_DATA_CHAT_ENABLED=false` and redeploy.
2. Revoke/rotate the Cloudflare Access service token and gateway HMAC.
3. Stop and disable the tunnel and private gateway units; leave llama.cpp
   loopback-only.
4. Revoke or rotate `analytics_chat_login` connectivity.
5. Remove the application variables if the feature is retired.

The typed view and redacted audit rows may remain because existing application
behavior does not depend on them. Avoid destructive database rollback unless a
reviewed follow-up migration is required.

## Provider state and remaining decisions

- Personal Cloudflare account `06281b845d00a5b3857bf215dec00782` is enrolled
  in Zero Trust Free. Its Workers subdomain is `blake-062.workers.dev` and its
  Zero Trust team name is `little-feather-aed2`.
- Tunnel `accelerate-qwen-samson`
  (`3587b7cf-e928-4f57-9e98-d6e74547c0b6`), VPC Service
  `accelerate-qwen-gateway` (`01a04934-2091-7de1-9f7c-6c686698cbd8`), and
  Access-protected Worker
  `https://accelerate-qwen-edge-gateway.blake-062.workers.dev` are live.
- The Samson origin uses a Cloudflare Origin CA certificate for its exact
  configured origin identity, and the VPC Service uses `verify_full`.
  The independent application HMAC, fresh timestamp, and one-time nonce remain
  required in addition to Access service authentication.
- The Vercel Production environment contains the Worker URL and replacement
  Access service-token values as sensitive variables. The feature is enabled
  only for the exact canary stored in provider-side sensitive configuration.
  Production acceptance completed on 2026-09-02 with 114/114 frozen
  end-to-end results across the complete Vercel, Cloudflare Access, Worker, VPC
  Service, Samson Qwen, reviewed semantic/resource layer, and read-only
  analytics path. The first expanded result passed after a controlled Qwen
  restart with an empty prompt cache. All other users continue to fail closed.
- Exact production primary dataset/catalog revision approved for the pilot.
- Acceptable queue depth, p95 latency, availability target, and support owner
  for the single-slot Samson service.
