# Private Qwen data chat

## Scope and safety model

The pilot is an admin-only, disabled-first conversation interface over one
approved current people-groups projection. Qwen 3.6 chooses a typed semantic
plan; it never receives SQL, database credentials, a database tool, arbitrary
URLs, or browser access. The application validates the plan, maps catalog keys
to trusted SQL fragments, binds every value separately, and executes through a
dedicated read-only Postgres role.

The analytical audit stores a pseudonymous user identifier, query/policy
versions, SQL template, approved view, decision, timing, row count, and response
size. It does not store prompts, filter values, result rows, or assistant text.
Conversation history is browser-held and bounded to 12 messages/20,000
characters per request; it is not persisted by this feature.

## Configuration

Keep `PRIVATE_DATA_CHAT_ENABLED=false` until every gate below passes. Configure
server-only values:

- `PRIVATE_DATA_CHAT_CANARY_EMAILS`: comma-separated exact administrator email
  identities. An admin not on this list is denied; an empty list fails closed.
- `ANALYTICS_DATABASE_URL`: pooled TLS URL for `analytics_chat_login`; never use
  the normal application connection or Supabase service role.
- `PRIVATE_DATA_CHAT_AUDIT_HMAC_KEY`: random value of at least 32 characters.
- `PRIVATE_QWEN_GATEWAY_URL`: Access-protected HTTPS `workers.dev` URL for the
  narrow Cloudflare edge relay; never the Samson address.
- `PRIVATE_QWEN_GATEWAY_HMAC_KEY`: random value of at least 32 characters,
  installed independently in Vercel and the gateway credential store.
- `PRIVATE_QWEN_CF_ACCESS_CLIENT_ID` and
  `PRIVATE_QWEN_CF_ACCESS_CLIENT_SECRET`: Cloudflare Access service-token pair.
- `PRIVATE_QWEN_FAKE=true`: local/UI-test only. It must be absent or false in
  deployed environments.

The production analytics login password is provider-owned secret material. Do
not commit it, place it in build logs, give it to Qwen/Samson, or reuse the local
test password.

## Deployment sequence

1. Pass `pnpm run db:security` locally and review the migration grants/RLS tests.
2. Pass the frozen Samson benchmark receipt and verify its model, runtime,
   planner-prompt, response-schema, catalog, and fixture hashes.
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

- `pnpm run verify:fast`
- `pnpm run smoke:check`
- `pnpm run db:security`
- `pnpm run verify:change:run`
- `pnpm run verify:ship:local` before a release request

Regenerate the real-Qwen receipt whenever the model artifact, llama.cpp
runtime, planner prompt, response schema, semantic catalog, compiler, or
sanitized fixtures change. Live model inference is a release receipt, not a
public CI dependency.

## Failure behavior

- Missing/invalid configuration: page is hidden from navigation and the direct
  admin page shows a disabled state; the API returns unavailable.
- Qwen busy/unavailable/timeout: no query runs unless a valid plan was already
  obtained. If only the explanation call fails, the verified bounded rows are
  returned through the deterministic fallback.
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
- The temporary HTTPS certificate-verification exception is explicitly
  accepted until the Samson origin can use `verify_full`; encryption and the
  independent application HMAC remain required.
- The Vercel Production environment contains the Worker URL and replacement
  Access service-token values as sensitive variables. The feature remains
  disabled and the exact canary is stored only in that provider-side sensitive
  configuration.
- Exact production primary dataset/catalog revision approved for the pilot.
- Acceptable queue depth, p95 latency, availability target, and support owner
  for the single-slot Samson service.
