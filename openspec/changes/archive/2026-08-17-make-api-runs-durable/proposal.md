## Why

Joshua Project PGIC runs can finish fetching and parsing all upstream pages but lose their serverless invocation while serializing and uploading large output artifacts, leaving a persisted run falsely marked `running`. The run lifecycle needs a lightweight durable execution boundary so long-running source work resumes safely, can be cancelled, and always reaches a truthful terminal state.

## What Changes

- Start Joshua Project PGIC execution as a Vercel Workflow instead of relying on one Next.js `after()` invocation.
- Fetch, normalize, and persist bounded Joshua pages as retry-safe chunks so no step carries or uploads the full response in memory.
- Persist small workflow, progress, heartbeat, deadline, and cancellation metadata on the existing API connection run.
- Add an admin-only stop action and terminal `cancelled` state; page work cooperatively stops before the next bounded request and final publication refuses cancelled runs.
- Reconcile abandoned runs through a small stale-run watchdog so queued or running UI states cannot spin indefinitely.
- Preserve all-or-nothing output publication, existing JSON/CSV download behavior, secret redaction, source parsing, and non-Joshua provider execution.
- Non-goals: replacing the existing pipeline-operations engine, adding a separate queue vendor, parallelizing Joshua requests, changing admin authorization, or changing dataset publication semantics.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `api-connection-runs`: Make Joshua Project runs durable, bounded-memory, cancellable, progress-aware, and self-reconciling while retaining existing output and security contracts.

## Impact

- Runtime and provider code: `src/app/api/admin/api-connections/**`, `src/lib/api-connections/index.ts`, and `src/lib/api-connections/providers/joshua-project.ts`.
- Data model: `src/db/schema.ts` and one Supabase migration for run workflow/progress/cancellation metadata and the `cancelled` status.
- Storage/download behavior: existing API run artifacts gain a versioned chunk-manifest representation while downloads retain their current JSON and CSV media types.
- UI and smoke: the connection detail page gains Stop/Stopping/Cancelled states using its existing run-progress surface and browser journey coverage.
- Dependency and deployment: add the supported Vercel Workflow package and minimal Next.js integration; no new external service.
- Security and permissions: existing dataset-admin authorization, Vault secret isolation, redaction, same-origin mutation guards, and private-schema access remain unchanged.
- Data integrity: page writes and final publication are idempotent; incomplete chunks are never exposed as successful output.
