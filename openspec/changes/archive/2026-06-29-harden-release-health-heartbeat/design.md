## Context

Release Health currently verifies the production alias serves the expected page
title and deployment id after the GitHub-backed Vercel production deployment is
ready. It does not verify route-level operational endpoints, so an older
production deployment can lack `/api/ops/supabase-heartbeat` while the root page
still appears healthy.

## Goals / Non-Goals

**Goals:**

- Prove the deployed production alias includes the Supabase heartbeat route.
- Prove the route fails closed for unauthenticated requests with HTTP 401.
- Provide distinct failure messages for route missing, missing `CRON_SECRET`,
  and Supabase unavailable/paused.
- Keep the check read-only and unauthenticated.

**Non-Goals:**

- No authenticated heartbeat call from Release Health.
- No change to Vercel Cron schedule or Supabase query behavior.
- No production data mutation.

## Decisions

1. Add the heartbeat assertion inside `smokeCheckDeployment`.
   The function already owns production alias health and is used by the Release
   Health workflow, so adding the assertion there makes the check automatic
   after main deploys.

2. Expect unauthenticated HTTP 401.
   This confirms both deployment and secret configuration without exposing
   `CRON_SECRET` to CI or requiring Release Health to query Supabase directly.

3. Fail with status-specific messages.
   HTTP 404 means the route was not deployed. HTTP 500 means `CRON_SECRET` is
   missing from the runtime. HTTP 503 means Supabase is unreachable or paused.
   Other statuses fail with a generic unexpected-status message.

## Risks / Trade-offs

- A paused Supabase project can make a deploy fail Release Health with 503 ->
  That is intentional because manual unpause is required before the heartbeat
  can succeed.
- The check does not prove Vercel Cron is registered -> The route check catches
  the observed failure mode, while tracked `vercel.json` and Vercel deployment
  registration remain the cron source of truth.
