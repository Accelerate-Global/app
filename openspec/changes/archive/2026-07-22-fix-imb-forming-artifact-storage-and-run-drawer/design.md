## Context

IMB forming serializes four private artifacts in sequence: rows JSON, findings JSON, lineage manifest JSON, and formed CSV. Production inspection shows that the `api-connection-artifacts` bucket currently has a 50 MiB limit and permits only `application/json`. The first three uploads therefore succeed, the `text/csv` upload is rejected, and the existing failure handler deletes the partial objects and records a failed candidate. The provider error is intentionally replaced by a normalized user message but is not currently logged, which hid the policy mismatch from runtime logs.

The same candidate is reviewed in a right-side sheet capped at `sm:max-w-2xl`. At the current desktop viewport this leaves insufficient width for the two-column binding grid and long checksums.

## Goals / Non-Goals

**Goals:**

- Allow the existing private bucket to accept both forming JSON and CSV artifacts with the repo-defined 128 MiB bound.
- Preserve atomic cleanup and guarded downloads.
- Log a normalized Supabase upload error for operators while keeping the user-facing error safe.
- Give the run-detail sheet half of the desktop viewport and keep candidate metadata within its layout cells.
- Verify the migration, storage behavior, component layout, and existing browser-smoke surface.

**Non-Goals:**

- Automatically retry historical candidates or publish a dataset.
- Add or change reference resources, forming rules, field contracts, or source adapters.
- Change Storage RLS, bucket visibility, authentication, or admin authorization.
- Make the desktop sheet larger than half the viewport or reduce mobile usability.

## Decisions

### Correct the existing bucket contract through a migration

A new Supabase migration will update `api-connection-artifacts` to remain private, permit `application/json` and `text/csv`, and use the 128 MiB limit already declared by the bucket's original migration. This fixes production drift and makes a fresh environment correct. Creating a separate CSV bucket was rejected because the artifacts share one guarded lifecycle, cleanup path, and download authorization boundary.

### Keep forming artifact persistence all-or-nothing

The existing ordered upload and cleanup behavior remains. If any artifact fails, previously uploaded artifacts are removed and the candidate becomes failed. Streaming or omitting the CSV was rejected because the specification promises complete immutable candidate artifacts and CSV is part of the review/export contract.

### Add normalized provider diagnostics at the storage boundary

On upload failure, the storage helper will use the shared error logger before throwing the existing safe domain error. This records provider name/message/status/code without logging credentials, request headers, or raw provider objects. Returning the raw Supabase message to the UI was rejected because provider details are operational evidence, not a user-facing contract.

### Use a responsive half-viewport sheet

The run-detail sheet remains `w-full` on narrow screens and uses `sm:max-w-[50vw]` at desktop breakpoints. Long monospaced bindings use wrapping or safe truncation within `min-w-0` cells. A fixed pixel width was rejected because the user explicitly needs half of the available page and desktop widths vary.

## Risks / Trade-offs

- [Risk] Formed CSV files can consume more storage than JSON-only policy allowed. → Retain the private bucket, explicit MIME allowlist, 128 MiB per-object limit, and existing cleanup.
- [Risk] Half-width may still be tight at the smallest `sm` viewport. → Keep full viewport width as the base style and constrain only at the existing responsive breakpoint.
- [Risk] Provider messages could contain unexpected detail. → Use the existing normalized logger, which selects only name, message, status, and code.
- [Risk] The failed production candidate remains failed after the policy fix. → The existing “Build with current resources” action creates a new attempt after deployment; no audit record is rewritten.

## Migration Plan

1. Apply the migration locally and verify the bucket is private, permits only JSON/CSV, and has the expected size limit.
2. Deploy the migration before or alongside the application change.
3. Verify the half-width sheet and initiate a new forming candidate from the existing successful ingestion.
4. Confirm the candidate reaches valid/invalid rather than failed and exposes all four artifacts.

Rollback can restore the prior JSON-only allowlist, but only after confirming no active forming job needs CSV persistence. Existing stored CSV objects remain private; removing a MIME type does not make them public.

## Open Questions

None.
