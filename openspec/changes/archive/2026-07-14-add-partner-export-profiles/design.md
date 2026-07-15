## Context

Accelerate Global is a Next.js App Router application backed by Supabase
Postgres and private Storage. Dataset administrators can currently share a
private Google Sheet with the configured app service account, select one or
more tabs, and import each tab as a refreshable raw dataset. The importer
stores normalized string rows and the API Connections feature already queues
longer-running work through `after()` and records private run artifacts.

The existing aggregate field-mapping CSV is intentionally reference metadata:
it can seed field definitions, but it neither reads a dataset nor produces a
partner export. The current dataset download paths return source columns,
making an external spreadsheet transformation necessary for every delivery.

Joshua Project's requested exchange fields give the first concrete partner
contract. Their supplied sample has the following headers (in the intended
export order):

1. `PG_PeopleID3`
2. `PG_ROP3`
3. `Geo_ROG3`
4. `Geo_ISO3`
5. `PG_Name_Main`
6. `PG_Name_Alt`
7. `PG_AX_unique_PG_ID_PGIC`
8. `reporting_group`
9. `implementing_group`
10. `engage_timestamp_of_last_known`
11. `engage_status_of_engagement`
12. `approx_evangelical_believers`
13. `approx_evangelical_churches`

The product must preserve raw source data, keep partner output private, and
avoid introducing a Google Drive integration, OAuth consent flow, or automatic
external delivery. Current Google Sheets connections also store both stable
`sheetId` and mutable `sheetTitle`, but execution fetches values by title and
disconnect deletes the connection row. Because API-connection children cascade
from that row, deletion can destroy run history even though the intended
behavior is to retain it.

## Goals / Non-Goals

**Goals:**

- Let a dataset administrator configure a named, reusable partner export from
  one existing imported dataset.
- Make mappings explicit: source columns, ordered output headers, limited
  deterministic transformations, validation rules, and a reviewable
  crosswalk.
- Offer a Joshua Project starter template with the exact header contract above
  while allowing administrators to adapt mappings to their own source headers.
- Preview output and validation before an administrator explicitly generates a
  downloadable CSV.
- Persist immutable, private output and validation/crosswalk artifacts with a
  source-data fingerprint and profile-revision snapshot for later audit.
- Reuse existing admin authorization, same-origin protections, private Storage,
  error normalization, queued background execution, and CSV formula
  neutralization patterns.
- Make Google Sheet tab identity durable and connection retirement
  non-destructive.

**Non-Goals:**

- OAuth, Google Drive browsing, folder import, personal Google credentials, or
  public-Sheet access. Service-account sharing remains the sole v1 connection
  model.
- Multi-dataset joins, scheduled imports/exports, partner API/email/Drive
  delivery, or contacts/CRM workflow.
- Source-row edits, write-back to a Sheet, or arbitrary formulas/scripts in a
  mapping profile.
- Guessing semantic field mappings from source data. A template may prefill
  exact-name matches, but an administrator remains responsible for confirming
  mappings and any constants.

## Decisions

### 1. Model a partner export as a dataset-scoped profile and immutable runs

Create private database records for `partner_export_profiles`, ordered
`partner_export_profile_columns`, and `partner_export_runs`. A profile belongs
to exactly one source dataset in v1 and has a human name, optional partner key
(`joshua-project` for the starter), status, filename stem, creator/updater, and
timestamps. A profile column has a stable ID, ordinal, target header, an
allow-listed source specification, transformation configuration, and validation
configuration. A generated run stores the profile and source dataset IDs, actor,
status/timing, output row count, validation summary, a serialized profile
revision, and a deterministic fingerprint of the source schema and ordered rows
that were read.

The run also stores private paths for its CSV, validation report, and crosswalk
artifacts. It is the durable audit record; a later profile edit or dataset
refresh cannot alter an already generated output.

**Rationale:** This separates mutable mapping intent from immutable deliverable
evidence and does not overload dataset versions, whose current representation
is optimized for imported-dataset replacement rather than partner exports.

**Alternatives considered:**

- Store a mapping JSON blob on `datasets`: rejected because profiles need to be
  reusable, named, independently auditable, and partner-specific.
- Reuse API connection runs: rejected because a profile transforms local
  dataset data and has a different lifecycle from an upstream ingestion.
- Only generate an in-memory download: rejected because it cannot be audited or
  reproduced after a source or profile changes.

### 2. Use a constrained declarative mapping engine

The server-side transformation module will accept normalized dataset rows and a
validated profile revision. A mapping binds to a normalized `CsvColumn.key`
(with the original source label retained as a diagnostic snapshot), never to a
spreadsheet letter, source position, or a nearby field-source registry entry.
It will produce ordered output rows, a crosswalk, and structured per-row
validation findings. The initial allow-list is purpose-built rather than
expression based:

- copy/trim one source column;
- coalesce a declared ordered list of source columns;
- emit an administrator-entered literal;
- normalize a lossless whole-number string (for identifiers or counts);
- normalize an ISO-8601 timestamp when the input can be unambiguously parsed;
- normalize a non-negative whole-number value; and
- preserve blank values where the profile permits them.

Each operation has typed configuration validated at profile save time. No
JavaScript, SQL, user-authored formula, remote lookup, or arbitrary template
language is executed. Identifier values remain strings; normalizing an input
such as `12989.0` is permitted only when it is lossless, and no zero-padding or
identifier inference is performed.

The engine will reuse the import/download CSV escaping and spreadsheet-formula
neutralization rules so a generated CSV cannot become executable when opened in
a spreadsheet application.

**Rationale:** Mapping is understandable to administrators, testable, and safe
for sensitive partner data. It is broad enough to map the known exchange
contract without becoming a general ETL product.

**Alternatives considered:**

- Arbitrary formulas: rejected for injection, review, support, and
  reproducibility risks.
- Automatic AI mapping: deferred. Exact header suggestions can improve setup,
  but silent semantic matching would be unsafe for partner data.
- One-off Joshua Project code path: rejected because it would recreate manual
  work for the next partner and hide the crosswalk.

### 3. Treat validation as a profile contract with blocking errors and explicit warnings

Profile validation has two stages:

1. **Configuration validation** runs before a profile can be saved: unique,
   non-empty target headers; contiguous order; source columns that still exist;
   valid transform settings; and, for a partner template, the exact required
   output header set and order.
2. **Data validation** runs during preview and generation. It reports row
   number, target header, rule, and a redacted value diagnostic. Errors block
   CSV artifact generation. Warnings appear in preview and require an explicit
   administrator acknowledgement to generate.

The Joshua Project starter requires all 13 contract headers in the stated
order. Its initial rules require a stable `PG_AX_unique_PG_ID_PGIC`, a main
name, and at least one of `PG_PeopleID3`/`PG_ROP3` plus at least one of
`Geo_ROG3`/`Geo_ISO3` for each exported row. Timestamp and approximate-count
values are validated when non-blank; their missingness is surfaced rather than
invented. Reporting/implementing group and engagement status are profile
configurable because source completeness and partner policy must be confirmed
by an administrator.

**Rationale:** It distinguishes missing schema from imperfect source data,
protects core identifiers, and avoids silently replacing unknown values with
assumptions.

**Alternatives considered:**

- Treat every blank as an error: rejected because partner fields can be
  intentionally unknown and would make valid reviews impossible.
- Let warnings generate without acknowledgement: rejected because delivery
  should be a deliberate action with an audit trail.

### 4. Generate preview and artifacts from a pinned read snapshot

Creating a run first queues background execution using the same Next.js
`after()` pattern as API connection runs. The executor reads the profile and
source dataset, captures the source dataset ID, `blobPath`,
`currentVersionCreatedAt`, row count, normalized schema fingerprint, and a
deterministic content fingerprint over `rowIndex`-ordered rows. It snapshots
the profile configuration, then transforms and validates from that in-memory
snapshot. The run cannot mix rows from two source states. If the profile or
source schema changes after the run is queued, the executor either uses its
captured revision or fails with an actionable stale-source/profile error; it
never silently changes the mapping.

Preview uses the exact same pure transformation/validation code and exposes a
bounded sample plus aggregate findings. Generation writes a complete CSV,
crosswalk, and validation report under a run-specific private Storage prefix in
a dedicated partner-export artifact bucket that permits CSV and JSON objects;
the existing API-connection artifact bucket is JSON-only and is not repurposed.
If an upload succeeds but persistence of run metadata fails, the executor
cleans up the newly written objects rather than leaving orphaned private data.
The download endpoint authenticates an administrator, authorizes the run, sets
`Content-Disposition: attachment`, and streams or signs a short-lived private
response. It never returns a public Storage URL.

Generated artifacts include no secrets. Error logs use normalized details and
avoid raw source rows; validation reports show only the minimum needed to find
a row and field, redacting values that could expose more than the administrator
already needs to correct a mapping.

**Rationale:** The output is reproducible and reviewable, while existing
background-run behavior minimizes request-time limits in the Vercel runtime.

**Alternatives considered:**

- Generate synchronously in the browser request: rejected due to runtime
  limits, repeat-submit risk, and lack of durable audit state.
- Persist a full duplicate source snapshot per export: rejected initially
  because immutable output, profile revision, source fingerprint, and existing
  dataset version history provide provenance without duplicating sensitive data.

### 5. Place the UI on existing dataset administration surfaces

Add an `Exports` section to the existing dataset administration/detail
experience rather than adding a new top-level route. It lists profiles and
recent export runs for that dataset and provides an accessible mapping dialog
or sheet with:

- template choice (`Custom` or `Joshua Project`);
- source dataset context;
- ordered target-header rows with source selectors, transform controls, and
  validation requirement controls;
- an always-visible crosswalk and preview/validation summary; and
- explicit Generate and Download actions with run status.

The Joshua Project template seeds exact target headers and attempts only
case-insensitive exact source-header suggestions. An unresolved suggestion is
shown as unmapped; it is not substituted with a nearby aggregate-field code.

The UI will use literal smoke attributes for the page/surface/trigger contract
and extend the route registry only if a new page is introduced. Existing shared
primitives receive colocated smoke fixtures when changed or newly created.

**Rationale:** It keeps the workflow near the source data and avoids treating a
partner export as a global integration connection.

**Alternatives considered:**

- A dedicated global exports page: deferred until profiles must span multiple
  datasets or an organization-wide export history is needed.
- CSV upload/download-only configuration: rejected because mapping errors
  would remain hard to review and audit.

### 6. Archive Google Sheets connections and resolve tabs by stable ID

Add archival state to `private.api_connections` (for example `archived_at`,
`archived_by_owner_id`, and a reason) and make normal connection list/run paths
operate on active rows only. Disconnecting a Google Sheets connection becomes
an idempotent archive update. Connection details, historical runs, logs,
outputs, and private artifacts remain retrievable through authorized history
views; the imported target dataset is untouched. Reconnecting the same source
reactivates the most recently archived matching connection (including its
target dataset linkage) so there is still exactly one active source and no run
is revived in place.

For Google Sheets sources, add a database-level partial uniqueness constraint
over active provider/config values that identifies the same provider,
spreadsheet ID, and `sheetId`, with a pre-insert query for a friendly UI error.
The SQL migration must account for legacy duplicate active rows before adding
the constraint.

Before a service-account check or import fetches values, fetch spreadsheet
metadata and locate the selected tab by stable `sheetId`. Update display title,
connection name, and safe provider metadata when a rename is detected, then
fetch values using the current title. Check archival state both when queueing a
run and immediately before execution; a queued run that is disconnected before
execution is recorded as a terminal `failed` run and must not fetch, write
artifacts, or replace a dataset. If the stable tab is missing or access has
been revoked, record a redacted failed run without modifying the target
dataset.

**Rationale:** Google tab titles are mutable but `sheetId` is stable. Archival
matches the existing specification's promise to retain history and avoids
foreign-key cascade loss.

**Alternatives considered:**

- Continue fetching by saved title: rejected because a harmless rename breaks
  a refresh.
- Delete the parent but copy history elsewhere: rejected because it is more
  complex, risks orphaned Storage artifacts, and still weakens audit linkage.
- Enforce uniqueness only in application code: rejected because concurrent
  requests can still create duplicate active sources.

### 7. Enforce current admin and data-security boundaries

All new mutation and download routes use the existing authenticated dataset
administrator authorization and centralized same-origin guard. The new
database tables live in the private schema and are not exposed through public
Supabase APIs. Storage remains private and paths are generated server-side.
Profile configuration never contains a Google credential, and connection
metadata continues to contain only the service-account share target and safe
Sheet identifiers.

No Vercel environment variable or external provider scope changes are needed:
the existing Google Sheets read-only service-account configuration remains
sufficient. Local Supabase is required for migration and RLS/security
verification during implementation.

## Risks / Trade-offs

- **Large source datasets can exceed a serverless execution or artifact size
  budget** → Reuse existing import/output limits, surface an actionable size
  failure, stream row transformation where practical, and do not create a
  partial downloadable artifact.
- **A profile becomes stale after a dataset refresh changes headers** → Validate
  source headers and profile revision before every preview/generation; present
  unresolved mappings rather than auto-remapping.
- **Sensitive data appears in an error/log/artifact** → Keep artifacts private,
  redact normalized errors and validation samples, do not log raw rows, and
  apply existing formula-neutralization before CSV storage.
- **A database uniqueness migration encounters historical duplicates** → Audit
  and archive/select a canonical active connection in the migration, preserve
  all history, and add an explicit migration test/verification query.
- **`after()` work is interrupted by a deployment or runtime failure** → Store
  queued/running/completed/failed state before work, mark failures with a
  normalized retryable error, and allow a new manual run without changing a
  completed artifact.
- **Partner requirements evolve** → Version/snapshot the profile and keep the
  constrained mapping engine generic, but defer a generalized multi-source ETL
  system until a real requirement warrants it.

## Migration Plan

1. Add private profile, profile-column, and export-run tables with foreign keys,
   indexes, ownership/audit fields, and private Storage conventions in a
   committed Supabase migration. Add archival fields and the active Google
   Sheet source uniqueness enforcement to `private.api_connections`.
2. Before enabling the uniqueness constraint, query existing active Google
   Sheets records, retain one canonical connection per spreadsheet/tab, and
   archive duplicates without deleting their history. Backfill existing rows as
   active.
3. Deploy the transformation/repository layer and API routes with no change to
   source dataset rows or existing download URLs. Seed only the Joshua Project
   template definition/configuration, never partner data or secrets.
4. Deploy the dataset export UI behind normal administrator authorization. An
   administrator creates or confirms a profile, previews it, and explicitly
   generates the first output; no automatic backfill or partner delivery runs.
5. Verify migration/RLS rules, connection archive and rename behavior,
   transformation/validation fixtures, private artifact authorization, and UI
   smoke contracts. Monitor normalized export-run failures after release.

Rollback is additive and safe: hide new UI/routes and stop creating export
runs; existing raw datasets, connection history, and generated private
artifacts remain intact. Do not drop the archival columns or profile/run tables
as a rollback action. If the uniqueness constraint must be relaxed, retain the
application duplicate check and archive conflicting rows rather than deleting
records.

## Open Questions

No blocking product questions remain for v1. The implementation will document
the Joshua Project template's exact field-level rule severities in the visible
profile, so a dataset administrator can adjust optional fields only with an
auditable profile revision rather than through undocumented code changes.
