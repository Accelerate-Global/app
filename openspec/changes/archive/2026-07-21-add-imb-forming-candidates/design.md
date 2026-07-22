## Context

Accelerate Online already archives every successful API connection run as a normalized rows artifact plus a redacted raw-response artifact in private Supabase Storage. It also owns immutable Country/ROG and ROP resource versions and creates a checksum-addressed resource-set snapshot after every activation. IMB currently uses the generic import path, so an import creates a visible dataset immediately and never records which resource versions or forming rules would have governed its values.

The approved IMB rulebook requires raw preservation, exact resource matching, unresolved-row preservation, row/field findings, deterministic checksums, review before publication, and AX-code allocation only after later entity resolution. The first slice must remain specific to the repo-owned IMB connection and must not change Joshua Project, Etnopedia, Google Sheets, or generic HTTP import behavior.

## Goals / Non-Goals

**Goals:**

- Turn one successful IMB ingestion output into an immutable, reviewable formed candidate.
- Pin the candidate to the source run, source artifacts and checksums, resource-set ID, field-contract version/checksum, and transformation version/checksum.
- Preserve all source rows while applying deterministic field, country, ROP, and type rules.
- Make warnings and blocking errors inspectable without silently changing raw evidence.
- Require an explicit dataset-admin publish or reject decision.
- Reuse existing private tables, guarded routes, Storage clients, dataset publication, and UI patterns wherever practical.

**Non-Goals:**

- Cross-source matching, merging, aggregation, fuzzy matching, or AX-code allocation.
- Forming non-IMB sources.
- A browser editor for field rules or reference-resource contents.
- Automatically activating reference-resource candidates or automatically publishing formed candidates.
- Retrofitting historical API runs or datasets.

## Decisions

### Treat the API run output as the immutable raw dataset version

A forming candidate references a successful IMB `api_connection_runs` row and its single archived `api_connection_run_outputs` record. The builder reads both stored artifacts, calculates SHA-256 checksums, and persists those checksums in the forming run. It never fetches IMB again and never uses the mutable current dataset table as input.

For IMB only, import mode archives the ingestion output but does not call the generic dataset create/replace path. The run succeeds with no dataset link and the run detail exposes a **Build formed candidate** action. Non-IMB imports retain current create-or-replace semantics.

Alternative considered: continue importing a raw workspace dataset and form from it. Rejected because mutable dataset rows are not the immutable ingestion boundary and would expose unreviewed data as if it were publishable.

### Persist a private forming lifecycle and immutable artifacts

Add `private.dataset_forming_runs` and `private.dataset_forming_findings`.

The run records source/connection/resource bindings, rule versions, lifecycle state, counts, summaries, artifact paths, checksums, actors, reasons, and publication target. Lifecycle states are `building`, `valid`, `invalid`, `rejected`, `publishing`, `published`, and `failed`. The finding rows record severity, stable rule code, source row index/key, field, source value, canonical value, message, and structured details.

All new private tables enable RLS and revoke browser-role access. Foreign keys are indexed. Finalized payload bindings and findings are append-only; only lifecycle/audit fields may transition through guarded server functions. Formed rows, the complete finding list, and the lineage manifest are uploaded without upsert beneath the existing private API-run artifact bucket. PostgreSQL stores queryable lifecycle metadata and a bounded finding preview; Storage owns the complete immutable payloads.

Alternative considered: put formed rows directly into `dataset_rows`. Rejected because a candidate must be reviewable and rejectable without becoming a workspace dataset.

### Use a checked-in immutable IMB field contract for version 1

`src/lib/imb-forming/field-contract.ts` owns an ordered field contract copied from the proven AX Data mapping. The contract has an explicit version, source provenance, deterministic checksum, source field, output field, semantic type, requiredness, and rule metadata. Version 1 includes the thirty active mapped source fields, restores `Bible` as `Resources_Written_Scripture`, and adds the four provenance fields.

The candidate persists both the version and checksum; any future rule edit must increment the version. This is a versioned input rather than a mutable “latest” spreadsheet. Moving field contracts into the general reference-resource lifecycle is intentionally deferred until more than one source needs admin-managed mapping.

Alternative considered: add a third reference-resource family immediately. Rejected for the first slice because it would expand the resource catalog, projection adapters, refresh UI, bootstrap, and health model before an update source or multi-source contract exists.

### Separate immutable version identity from stable source-record identity

`Dataset_ID` is the source API run ID. `Dataset_Row_ID` is the ArcGIS `OBJECTID`. `Dataset_Row_Key` is `im:<connection-id>:<OBJECTID>`, which stays stable when the same layer record is ingested again. `PG_PEID + accepted ISO3` is recorded as a logical domain key when both parts exist, but it is not used as the physical row key. Missing or duplicate `OBJECTID` values are blocking errors because stable row lineage would be ambiguous.

Alternative considered: preserve AX Data’s Drive-file ID plus row ordinal. Rejected because the same source record receives a different identity after every refresh or ordering change.

### Apply country rules without silent identifier replacement

The builder loads the Country version named by the pinned resource set and creates exact normalized indexes for active ISO3 codes, display names, and aliases.

- A valid exact source ISO3 remains authoritative.
- A country alias fills ISO3 only when ISO3 is blank.
- Canonical country name is derived from the accepted ISO3.
- A recognized country name that conflicts with a valid source ISO3 produces a warning; the ISO3 is retained.
- An unrecognized or missing country/ISO combination preserves the row and source values with an unresolved warning.

Normalization uses Unicode NFKC, trimmed/collapsed whitespace, and locale-independent lowercase comparison. No fuzzy matching occurs.

### Resolve ROP hierarchy by exact ROP3 and preserve disagreements

The builder loads ROP people projections for the ROP version in the same resource set. Exact ROP3 matches supply canonical ROP1, ROP2, and ROP25 values. Source parent values remain available in the raw artifact and are copied into finding details whenever they disagree. Inactive matches and resource join issues produce warnings.

An absent ROP3 lookup preserves the source ROP3 and row, marks its resolution unresolved, and does not invent parent values. These warnings do not invalidate the candidate. No AX code is generated in this slice.

### Represent typed formed values with explicit conversion findings

Dataset rows remain string-valued. Strings are trimmed, booleans canonicalize to `TRUE`/`FALSE`, integers use base-10 whole-number strings, and doubles use finite normalized decimal strings. Identifier fields remain strings even when the legacy mapping labeled them integers. Blank source values stay blank. A nonblank value that cannot be converted stays blank in the formed field and produces a warning containing the original value; the raw artifact remains unchanged.

Structural errors—invalid source artifact, missing required source columns, missing/duplicate `OBJECTID`, row-count divergence, missing resource-set members, artifact/checksum failure, or duplicate output row keys—make the candidate invalid. Domain resolution and optional conversion problems are warnings.

### Build in the background and publish under a connection guard

The start endpoint inserts a `building` run and schedules execution using the existing Next.js `after` pattern. A partial unique index prevents two `building` or `valid` candidates with the same source run, resource set, and transformation checksum. Invalid, rejected, failed, and published history remains append-only and may be retried as a new run.

Publishing requires a valid candidate, a nonblank reason, warning acknowledgement when warnings exist, and a dataset-admin identity. A partial unique index permits only one `publishing` candidate per connection, while the status-guarded update prevents duplicate decisions for the same candidate. The publisher changes state to `publishing`, revalidates the lineage manifest, output checksum, and pinned resource bindings, then uses the existing dataset create/replace and version-archive behavior. On success it binds the connection target, records the dataset and actor, and marks the candidate `published`. A failed publication returns the candidate to `valid` with an inspectable normalized error so the immutable candidate can be retried.

### Correct ArcGIS pagination before retaining page zero

The generic ArcGIS provider may use the first response to discover `objectIdFieldName`, but when ordering was not already known it must discard that discovery response and refetch offset zero with `orderByFields` before retaining any features. All retained pages therefore share one stable order. Tests cover the discovery request, ordered refetch, subsequent offset, invalid responses, and response-size behavior.

### Extend the existing run-detail sheet for review

The IMB run-detail sheet shows candidate lifecycle, pinned resource-set/checksum metadata, input/output counts, warning/error summaries, a bounded finding table, and artifact downloads. Successful IMB source runs without a candidate show **Build formed candidate**. Valid candidates show **Publish dataset** and **Reject candidate**; publishing warnings requires explicit acknowledgement and a reason. Invalid candidates remain inspectable and can be rebuilt. Existing run history and non-IMB details remain unchanged.

New interactive review/confirmation surfaces receive literal smoke attributes and existing route registry/page markers remain unchanged.

## Risks / Trade-offs

- **A Vercel background task may end during a large build** → The `building` record remains observable; a stale build can be retried without exposing partial artifacts or data. Artifact upload cleanup runs on failure.
- **A source `OBJECTID` can change if IMB republishes the ArcGIS layer** → The lineage manifest and formed rows also record source run ID, PEID, ISO3, and checksums; a future source-contract revision can introduce a documented durable provider key without rewriting prior candidates.
- **A checked-in field contract is not editable by administrators** → Version/checksum binding provides reproducibility now; admin-managed field resources remain a later capability once the update workflow is defined.
- **Warning-heavy candidates could produce many finding rows** → Findings are batch inserted and indexed by run/severity/row; the API returns a bounded preview while the complete artifact remains downloadable.
- **Publication writes thousands of dataset rows** → Reuse existing batched writes and a database-enforced one-publication-per-connection lifecycle guard, not a long-held database lock during row writes.
- **Changing IMB import semantics may surprise current operators** → The connection UI explicitly labels ingestion, candidate formation, and publication as separate states; all other connectors retain existing behavior.

## Migration Plan

1. Create the Supabase migration through the CLI, add private tables, constraints, indexes, RLS/revokes, append-only protections, and pgTAP coverage.
2. Deploy schema and application code together. Existing run/output/dataset rows require no backfill.
3. New IMB imports archive source output without creating a dataset. Historical successful IMB outputs remain downloadable but are not automatically enrolled; the first slice forms only runs whose artifacts and required identifiers pass current validation.
4. Build and review one new IMB candidate against the active resource set, compare counts/findings with the 12,375-row AX Data characterization, and publish explicitly.
5. Rollback is a normal application rollback plus leaving the new private tables unused. Published datasets remain ordinary versioned datasets; candidate history and artifacts remain preserved.

## Open Questions

None. The user approved the field, country, ROP, unresolved-row, resource-binding, review, and AX-code deferral decisions before implementation.
