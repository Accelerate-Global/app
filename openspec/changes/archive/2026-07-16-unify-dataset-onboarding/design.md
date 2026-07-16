## Context

Administrators currently create Google Sheets connections inside `ApiConnectionsClient`, land on a connection detail page, and must separately start the first import. CSV creation uses `DatasetUploadClient`, which begins uploading as soon as a file is selected. The two paths have different language, privacy affordances, and completion behavior. At the same time, the repository already has stable Google `sheetId` handling, automatic and manual header selection, queued import runs, streaming CSV persistence, workspace visibility, and synchronized Private tags.

The change crosses UI routes, client state, provider APIs, dataset creation, analytics, documentation, OpenSpec, and browser smoke. It must preserve the centralized same-origin guard, administrator-only mutations, normalized provider error logging, and Supabase RLS. The completed private-tag migration remains in this branch and makes local database security and linked migration-drift checks part of the release gate.

## Goals / Non-Goals

**Goals:**

- Provide one administrator-only Add dataset route for Google Sheets and CSV.
- Present one decision at a time while preserving state during backward navigation.
- Use compact automatic header confirmation and expand manual review for ambiguous Sheets.
- Review dataset names, classification, and workspace visibility before writes.
- Connect and start first Google Sheets imports in one journey with independent status and retry.
- Preserve CSV replacement and all existing Google Sheets safety/integrity behavior.
- Separate onboarding from data-source operations and reduce nonfunctional detail-page chrome.
- Add deterministic unit, route, domain, and browser-smoke verification.

**Non-Goals:**

- OAuth, Drive browsing, source-Sheet permission mutation, scheduled refresh, or partner delivery.
- Generic API profile creation through the web UI.
- Per-tab classification/visibility or arbitrary CSV header-row selection.
- A new ingestion engine, job table, database schema, or RLS model.
- Moving partner-export mapping into onboarding.

## Decisions

### Add a dedicated route and feature state machine

`/dashboard/datasets/new` will render an administrator-only client with source, connect, structure, details, review, import, and complete stages. A reducer with discriminated state and request tokens will enforce valid transitions and ignore stale access/header responses.

This is preferred over conditionally expanding the API Connections page because onboarding and operations have different user intent, and over separate provider wizards because shared naming, classification, visibility, review, progress, and analytics would diverge again.

### Keep a shared shell with provider-specific source stages

Google Sheets and CSV share source choice, details, review, progress, and completion vocabulary. Google Sheets has access/tab/header stages; CSV has local validation and a detected first-row structure summary. CSV upload does not begin until final confirmation. Replacement continues to use the existing route and component behavior.

This balances a consistent mental model with the providers' real differences and avoids pretending the service-account flow is OAuth.

### Reuse existing provider and ingestion endpoints

The client will create Google Sheets connections through the current provider endpoint, then start one import through each returned connection's current run endpoint and poll the current run-detail endpoint. After a successful connect response, retries target only failed imports and never resubmit connection creation.

This avoids a second ingestion engine. A fully transactional connect-and-run batch was considered, but it would require invasive run creation changes and still could not make external Sheet execution atomic. The UI instead represents per-tab outcomes explicitly.

### Extend Google Sheets names backward-compatibly

The connect request will accept optional `datasetSettings` entries keyed by selected `sheetId`. New callers provide reviewed names; omitted settings retain current derived names. The domain validates one entry per selected tab and case-insensitive uniqueness, then uses the reviewed value for connection and dataset names while preserving provider titles separately.

No migration is required because existing fields already hold these values. Keeping the field optional preserves direct/legacy callers and archived connection reactivation.

### Treat imported access separately from source access

The details stage uses explicit radio cards for workspace-visible versus administrators-only datasets and retains the current workspace-visible default. Source-sharing copy only describes the service account's Viewer access. The private choice previews the canonical Private tag managed by existing application/database invariants.

This is preferred over the current switch because both outcomes are visible and the user must review the selected meaning before import.

### Delay CSV writes until final confirmation

CSV file selection performs only local type, size, and header parsing. The existing signed upload, record creation, row batching, failure marking, and analytics behavior will be extracted behind a reusable upload operation invoked at confirmation. Replacement keeps its current immediate selection-to-upload behavior.

### Refocus operations pages

`/dashboard/api-connections` becomes Data sources with the saved-source table and a link to Add dataset. Captured resources remain secondary. The detail page leads with source state and real actions; the five disabled pipeline cards are removed. Run detail/history remain available as collapsed diagnostics.

### Preserve route compatibility

`/dashboard/upload?replace={id}` remains unchanged. `/dashboard/upload` redirects to `/dashboard/datasets/new?source=csv`. API Connections remains a stable management URL. Pro/basic users keep current dashboard redirect behavior for all admin surfaces.

### Use privacy-safe analytics

Events record source type, stage, counts, confidence category, duration, and normalized failure stage. They MUST NOT include Sheet URLs, spreadsheet/tab/dataset names, filenames, column labels, cell values, or file content. Existing upload events are emitted once by the shared operation.

## Risks / Trade-offs

- [Connection creation succeeds but one import request fails] → Lock the connect result, show each connection independently, and retry only the failed import.
- [Multi-tab setup becomes visually dense] → Use compact tab summaries, expand ambiguous/header-review content only, and keep shared settings outside per-tab cards.
- [Refactoring CSV breaks replacement] → Extract behavior under existing tests first and retain the replacement route/component contract.
- [New names collide or obscure source identity] → Validate batch uniqueness and keep spreadsheet/tab titles in provider configuration and source detail.
- [Privacy copy is confused with Google sharing] → Separate stages, explicit radio choices, Private tag preview, and contract tests for both explanations.
- [Stale asynchronous previews overwrite newer input] → Attach request tokens to reducer events and discard responses for changed URLs/tabs/selections.
- [Browser smoke depends on Google] → Intercept provider endpoints and run-detail polling with deterministic fixtures; no live Google calls.
- [Combined branch increases verification surface] → Use the repository change planner, direct tests, targeted smoke, database security, migration drift, and the terminal gate before PR creation.

## Migration Plan

1. Keep the already-completed private-tag/visibility work in the feature branch and validate it first.
2. Add the onboarding route and APIs without removing old creation UI.
3. Verify Google Sheets and CSV journeys, then remove the old inline Sheet creation card and redirect only new CSV uploads.
4. Update route registry, browser journeys, docs, and analytics.
5. Run the full repository terminal gate, database security suite, and linked migration drift check.
6. Archive this OpenSpec change, run the local ship gate, and publish the combined branch/PR.

Rollback is application-only for onboarding: restore the inline creation card and new-upload route while leaving backward-compatible API fields ignored. The private-tag migration is independently backward-compatible and preserves dataset visibility as the source of truth.

## Open Questions

None. Custom CSV header-row selection and a dedicated Resources route are explicitly deferred until usage evidence warrants them.
