## Context

Google Sheets onboarding already accepts a discriminated workflow assignment and creates the connection plus Tier 1 binding or Tier 2 profile atomically. Existing connection detail pages expose only the older Tier 1 source-profile control, so already-created ordinary datasets such as Final-58 and Final-Sudan cannot use the same reviewed workflow contract. The connection, imported dataset, and run history are durable product records and must not be replaced merely to add forming configuration.

The change crosses administrator UI/API code and Supabase writes. Private binding/profile tables remain inaccessible to browser roles; the server performs mutations after the existing administrator guard. No Vercel configuration, auth metadata, schedule, identity registry, or publication target changes are required.

## Goals / Non-Goals

**Goals:**

- Reuse one validated workflow-assignment contract for onboarding and existing connections.
- Link an unassigned active Google Sheets connection to Tier 1 or Tier 2 in one database transaction.
- Preserve connection ID, dataset ID, imported rows, and ingestion history.
- Expose enough reviewed fields and owner choices to configure exact Tier 2 feeds.
- Return actionable conflicts without partial writes or implicit processing.

**Non-Goals:**

- Reassigning or deleting an active binding/profile.
- Starting ingestion or forming as a side effect of assignment.
- Publishing formed data, enabling schedules, allocating AX codes, changing identity authority, or disabling legacy writers.
- Guessing Final-58 or Final-Sudan mappings before source profiling and administrator review.

## Decisions

### Use a dedicated existing-connection workflow endpoint

The connection detail page will use an administrator endpoint whose payload is the same discriminated assignment schema used by onboarding. A dedicated endpoint keeps the legacy Tier 1 source-profile route compatible while making the broader Tier 1/Tier 2 behavior explicit. Alternative: overload the Tier 1-only endpoint. Rejected because its name and response shape would become misleading.

### Share validation and transactional persistence

Header membership, profile-key rules, stable row/tracking requirements, active contract lookup, active owner alias lookup, and classification changes will be performed server-side. The transaction will lock or conflict-check the target connection and create exactly one profile/binding. Alternative: sequence existing API calls from the browser. Rejected because a mid-sequence failure could leave classification and private configuration inconsistent.

### Permit only unassigned connections

The first release links an ordinary active connection exactly once. Existing assignments are displayed read-only; attempts to replace them fail atomically. Alternative: support arbitrary relinking. Rejected because changing a profile after candidates or publications exist needs separate lineage and retirement policy.

### Preserve process separation

Saving a workflow changes configuration only. The administrator must separately start ingestion/forming and separately review publication/identity actions. This makes the review gate observable and prevents a configuration click from mutating downstream datasets or identity state.

### Profile production sources read-only before configuring them

Final-58 and Final-Sudan column/value distributions will be inspected without writing source or application data. The proposed mapping—especially stable row key, tracking value, and tracking source—will be presented for consultation before any production assignment or identity/publication action.

### Resolve mixed tracking sources per row without a fallback

Tier 2 profiles may either pin one tracking type for the entire feed or select a reviewed tracking-source column plus an exact value-to-type map. Row-specific profiles do not have a default type: blank and unmapped discriminator values produce blocking findings so the forming engine never guesses identity semantics. The resolved type is written into each formed row and is the value passed to later identity review.

### Store a permanent source-row ID in the source Sheet

Final-58 and Final-Sudan will receive a dedicated `Accelerate source row ID` column. Existing rows receive immutable generated identifiers once; subsequent ingestion reads that column as the durable row key. Names, row numbers, and tracking IDs are not used as substitutes because they can change, be blank, or repeat.

## Risks / Trade-offs

- [A source contains mixed tracking-ID types while the profile contract expects one type] → Report the distribution at the review gate and extend the contract deliberately rather than choosing a misleading fixed type.
- [Concurrent administrators link the same connection or profile] → Enforce uniqueness and perform conflict checks inside one transaction; return no partial result.
- [Reviewed headers changed after a prior import] → Validate assignment columns against the connection's current reviewed header selection before mutation.
- [Classification changes but downstream configuration fails] → Update classification in the same transaction as private profile/binding creation.
- [Users expect assignment to run the pipeline] → Label the control as configuration and explicitly state that no ingestion or publication starts.

## Migration Plan

1. Deploy the endpoint and connection-detail control without creating any assignments.
2. Read-only profile Final-58 and Final-Sudan and obtain administrator approval of exact mappings.
3. Link one reviewed canary connection through the UI/API, then verify IDs and history remain unchanged.
4. Run ingestion/forming only through the existing explicit controls and compare the candidate to retained legacy evidence.
5. Roll back application code if needed; because assignments are not automatically removed, any data rollback requires an explicit reviewed retirement operation rather than destructive migration.

## Approved source contract

- `Tracking ID# (any)` is the tracking identifier column for both feeds.
- `Tracking # Source (from dropdown)` selects the row type using the exact reviewed values `PGID3 (Joshua Project)` → `peopleid3`, `ROP3` → `rop3`, and `Local / Organization code` → `provider-native`.
- Unknown or blank tracking-source values block the affected row.
- `Accelerate source row ID` is the permanent row key for both feeds and is generated once in the source Sheet.
- Country, ROP3, PeopleID3, and PEID columns remain evidence inputs; they do not replace the row-level tracking contract or permanent row identity.

## Read-only source profiling evidence

- Final-58 contains 245 rows. Tracking source is populated on every row and mixes 96 Joshua Project PeopleID3, 100 local/organization codes, and 49 ROP3 values.
- Final-Sudan contains 126 rows. Tracking source is populated on every row and mixes 79 Joshua Project PeopleID3 and 47 local/organization codes.
- Both feeds therefore require row-level tracking-type interpretation; selecting one fixed profile-level type would mis-form valid rows.
- No production connection/profile, dataset row, publication, schedule, or identity state was changed during profiling.
