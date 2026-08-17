## Context

API connection runs are created in Postgres and then executed inside a Next.js `after()` callback. Joshua Project now fetches 165 bounded pages successfully, but the same invocation subsequently constructs a roughly 126 MB raw artifact plus a normalized rows artifact and uploads both through Supabase Storage standard uploads. Production evidence showed the fetch and parse completed before the Vercel invocation ended without reaching either the success or catch path, leaving the database row `running`.

The repository already treats Postgres as the authoritative run ledger and Supabase Storage as the private artifact store. The lightest durable extension is therefore to keep those boundaries and use Vercel Workflow only to resume small, idempotent source steps across invocations. The stable Workflow package is preferred; beta-only in-flight cancellation is not required because each upstream request remains bounded to 20 seconds.

## Goals / Non-Goals

**Goals:**

- Ensure every Joshua run reaches `success`, `failed`, or `cancelled` even across function termination and deployment replacement.
- Bound each execution step and storage object so the full source response is never held or uploaded as one large buffer.
- Preserve current run history, logs, downloads, resource flattening, secret redaction, and all-or-nothing publication.
- Give admins a truthful Stop action with bounded cancellation latency and visible progress.
- Keep the change provider-scoped and small enough to adopt without replacing the repository's pipeline coordinator.

**Non-Goals:**

- Migrating Google Sheets, ArcGIS, Etnopedia, pipeline-product, or forming execution to Workflow.
- Introducing Redis, another queue vendor, or a continuously running worker.
- Depending on Workflow SDK beta cancellation APIs.
- Parallelizing Joshua requests or relaxing existing page, byte, redirect, DNS, and secret controls.
- Publishing partially fetched or partially normalized data.

## Decisions

### Use one durable workflow with small page steps

The start route will create the existing API run row and start a Joshua-specific workflow with only the run ID. The workflow will claim the queued row, run one idempotent page step at a time, and finalize after a short terminal page. Non-Joshua providers retain the current `after()` path.

Each page step will load the pinned connection and Vault secret, check cancellation and the overall deadline, fetch one bounded page, validate and normalize it, write deterministic raw and rows chunk objects, and persist a checkpoint/heartbeat. Step return values contain only small metadata such as counts, sizes, and checksums; provider records and secrets never enter Workflow history.

Alternative considered: increase `maxDuration`. Rejected because a hard function kill can still bypass error finalization and the large in-memory artifacts remain unsafe.

Alternative considered: extend the custom pipeline-operations worker. Rejected for this thin slice because API paging is dynamic, the existing stage graph is fixed, and its daily continuation schedule would require a broader coordinator change.

### Store immutable chunks plus a versioned manifest

Joshua raw pages and normalized row chunks will use deterministic paths under the run prefix. The output row will continue to point at `rowsStoragePath` and `rawStoragePath`, but those objects will be small versioned manifests listing ordered chunks and their checksums. Download code will detect the manifest version and stream the chunks into the existing JSON or CSV representation. Legacy single-object artifacts remain readable.

Retries use create-only deterministic paths. If a path already exists, the step verifies its checksum before accepting it. A final output row is inserted only after every expected chunk exists and matches the checkpoint metadata, preserving all-or-nothing visibility.

Alternative considered: one resumable 126 MB upload. Rejected because it still requires building large aggregate artifacts and complicates server-side resume state; source pages are already natural chunks below the existing 4 MB bound.

### Keep Postgres authoritative for product state

The run row gains workflow ID, stage, heartbeat, deadline, progress counts, and cancellation timestamps. Workflow execution metadata aids operations, but the UI and API continue reading Postgres. Status adds `cancelled`; `cancel_requested_at` represents cooperative cancellation without requiring an externally visible intermediate status.

Run claiming and finalization use conditional updates. Success requires the same attempt to own a `running` row with no cancellation request. Cancellation or failure cannot race into successful publication.

### Make cancellation cooperative and bounded

An admin-only cancel route atomically records `cancel_requested_at`, the terminal `cancelled` status, completion timestamps, and a redacted log before making a best-effort stable Workflow runtime cancellation call. The UI presents `Stopping` while that request is in flight and then renders `Cancelled`. Every page checkpoint and finalization step also checks the database state, so correctness does not depend on runtime cancellation. An in-flight page request has at most the existing 20-second request timeout. Partial chunks remain private and are eligible for later cleanup.

### Reconcile stale state without mutating on normal reads

A small authenticated internal watchdog route, invoked by Vercel Cron at a modest interval, reconciles queued/running runs whose heartbeat or deadline is stale. It marks definitively abandoned rows failed or cancelled and records a normalized log. Detail reads can display `Stalled` from heartbeat age immediately, but do not mutate state.

The watchdog is a safety net rather than the primary executor; Workflow retries and resumes normal failures.

## Risks / Trade-offs

- **Workflow adds one runtime dependency and deployment integration** → Pin the stable package, keep workflow inputs minimal, and verify build plus a deployed preview before release.
- **Chunk manifests change internal artifact representation** → Version manifests and retain legacy download parsing; keep public JSON/CSV responses unchanged.
- **A retry may observe an existing storage chunk** → Deterministic paths and checksum verification make the operation idempotent and detect mismatches.
- **Cancellation is not instantaneous during an active fetch** → Retain the 20-second page timeout and show `Stopping`; final publication always checks cancellation again.
- **Partial chunks consume storage after failure** → Keep them inaccessible without a successful output manifest; retention cleanup can be added separately once an operational retention period is chosen.
- **Cron can be delayed** → UI derives `Stalled` from heartbeat age, and Workflow remains the primary durable recovery mechanism.

## Migration Plan

1. Add nullable run metadata and the `cancelled` status so the migration is backward compatible.
2. Deploy manifest readers before or with manifest writers; legacy artifacts remain supported.
3. Enable Workflow only for Joshua Project while all other providers retain the existing executor.
4. Add the cancel route, UI action, and watchdog after the new metadata is available.
5. Verify a complete Joshua test, forced step retry, cancellation, simulated stale run, manifest downloads, and secret redaction.
6. Roll back by disabling Joshua Workflow dispatch; new nullable metadata and manifest readers can remain, and already-created manifests stay downloadable.

## Open Questions

- None blocking. Garbage collection can initially be conservative and delete only manifest-less failed/cancelled run prefixes older than the retention window.
