# rop-code-resource Specification

## Purpose
Define the authenticated HIS Registry of Peoples code reference resource,
including flattened ROP1/ROP2/ROP25/ROP3 lookup behavior, source refresh,
detail geography, validation, download behavior, and UI smoke coverage.
## Requirements
### Requirement: ROP code resource is available in the app
The system SHALL provide the active persisted HIS Registry of Peoples resource
for ROP1, ROP2, ROP25, ROP3, and associated geography values.

#### Scenario: Authenticated user opens ROP code resource
- **WHEN** an authenticated user opens `/dashboard/rop-codes`
- **THEN** the page shows the active persisted ROP version
- **AND** the page provides a back link to `/dashboard/resources`
- **AND** the resource shows its active version number, source metadata, row
  counts, retrieval time, and deterministic checksum

#### Scenario: Active ROP version is unavailable
- **WHEN** the catalog is initialized but has no healthy active ROP version
- **THEN** the page reports an operational resource error
- **AND** the system does not silently substitute the checked-in generated file

#### Scenario: Anonymous user opens ROP code resource
- **WHEN** an anonymous user opens `/dashboard/rop-codes`
- **THEN** the system redirects the user to the sign-in page

### Requirement: ROP code resource flattens the hierarchy into one table
The system SHALL render a single searchable table with one matched field each
for ROP1, ROP2, ROP25, and ROP3.

#### Scenario: User views flattened ROP rows
- **WHEN** a signed-in user views the ROP resource table
- **THEN** each visible row shows one ROP1 field, one ROP2 field, one ROP25
  field, and one ROP3 field
- **AND** each populated field combines the code and name for that ROP term
- **AND** the row set includes ROP3 people and ROP25 parent-only rows with no
  ROP3 child
- **AND** a ROP25 parent-only row shows `Not listed` for ROP3 without a warning
  icon or join-issue badge

#### Scenario: Source parent links are imperfect
- **WHEN** a ROP3 row has a missing ROP25 parent or a conflicting direct ROP2
  value
- **THEN** the row remains visible
- **AND** the system uses the registry-chain match when available
- **AND** the row exposes a join issue label for inspection and download
- **AND** the table retains a warning icon for the genuine join issue

### Requirement: ROP code resource is searchable, downloadable, and inspectable
The system SHALL allow signed-in users to search, download, page through, and
inspect the complete active ROP version without changing workspace data.

#### Scenario: User searches the ROP resource
- **WHEN** a signed-in user searches by ROP code, ROP name, source fields,
  place, language, status, geography, or join issue text
- **THEN** matching rows from the complete active version remain visible in a
  deterministic cursor-paged result

#### Scenario: User views ROP resource summary
- **WHEN** a signed-in user views the ROP resource
- **THEN** the summary shows ROP1, ROP2, ROP25, and ROP3 source counts and the
  source retrieval time
- **AND** the summary does not show a browser-page “loaded of total” badge

#### Scenario: User downloads matching ROP rows
- **WHEN** a signed-in user downloads the current ROP query
- **THEN** the system streams a CSV containing every matching row from the
  active version, including rows not loaded in the current browser page
- **AND** the CSV contains the four matched ROP term fields plus source, status,
  geography, and join issue metadata

#### Scenario: User opens a ROP detail sheet
- **WHEN** a signed-in user selects a visible ROP row
- **THEN** a right-side detail sheet opens for that row
- **AND** the sheet shows code, name, description, status, source metadata, and
  actionable join issue details
- **AND** ROP3 geography rows from the same active version are shown when
  available

### Requirement: ROP code resource can refresh from HIS
The system SHALL support admin-only creation of a persistent ROP candidate from
HIS ArcGIS source data, and lifecycle mutations MUST use same-origin protected
methods.

#### Scenario: Admin refreshes ROP source data
- **WHEN** a dataset admin requests a live refresh from the web UI
- **THEN** the page sends the refresh as a `POST` request
- **AND** the page shows persisted build progress
- **AND** the system fetches and normalizes the HIS ROP layers
- **AND** a successful build produces candidate metadata, validation results,
  and an active-version diff rather than replacing the visible resource

#### Scenario: Admin activates a valid ROP candidate
- **WHEN** a dataset admin reviews a valid ROP candidate, including any warning
  findings, and confirms activation with a reason
- **THEN** the candidate becomes the active persisted ROP version
- **AND** later page loads, searches, details, and downloads use that version

#### Scenario: Non-admin views resource controls
- **WHEN** a signed-in non-admin views the ROP resource controls
- **THEN** refresh, candidate, history, activation, rejection, and rollback
  controls are not shown

#### Scenario: Source refresh fails
- **WHEN** HIS source data is unavailable or invalid beyond the documented
  tolerance limits
- **THEN** the page keeps the active persisted ROP version visible
- **AND** the admin can inspect the normalized failure or validation findings
- **AND** no invalid candidate can be activated

#### Scenario: Refresh endpoint receives GET
- **WHEN** a request calls the ROP refresh endpoint with `GET`
- **THEN** the system returns `405 Method Not Allowed`
- **AND** the response identifies `POST` as the allowed method

### Requirement: ROP code resource validates source shape
The system SHALL mark a ROP candidate invalid when it has malformed rows,
duplicate codes, suspiciously low table counts, invalid required hierarchy
links beyond documented tolerance limits, or inconsistent package artifacts,
projections, counts, or checksum. The persisted typed projection SHALL accept
every structured join-warning value produced by valid bounded-tolerance builds.

#### Scenario: HIS candidate is valid
- **WHEN** all required HIS layers return valid rows above their completeness
  safety floors, any missing ROP2 parents remain within the bounded tolerance,
  and package integrity checks pass
- **THEN** the system produces sorted typed ROP term, people, and geography
  projections
- **AND** the candidate becomes eligible for explicit activation

#### Scenario: HIS ROP25 count changes within the safety buffer
- **WHEN** the complete HIS ROP25 layer contains 8,991 valid unique rows
- **THEN** the source-count safeguard accepts the layer for candidate building
- **AND** the remaining hierarchy and package validations still run

#### Scenario: Bounded ROP2 parent reference is missing
- **WHEN** no more than 10 distinct ROP25 records and no more than 0.1% of the
  ROP25 layer reference ROP2 codes absent from the ROP2 layer
- **THEN** affected rows retain the referenced ROP2 code as `Not listed`, their
  ROP25, ROP3, and geography data, and no invented ROP1 value
- **AND** each visible affected row produces a structured warning finding
- **AND** each affected typed projection row persists the recognized warning state
- **AND** the warning-only candidate remains eligible for explicit activation

#### Scenario: Missing ROP2 parents exceed tolerance
- **WHEN** more than 10 distinct ROP25 records or more than 0.1% of the ROP25
  layer reference absent ROP2 codes
- **THEN** the source build fails hierarchy validation
- **AND** no invalid candidate can replace the active version

#### Scenario: HIS candidate is invalid
- **WHEN** a required layer returns malformed rows, duplicate codes, a row count
  below its completeness safety floor, an untolerated hierarchy error, or
  inconsistent package content
- **THEN** the system persists structured validation findings
- **AND** the candidate cannot replace the active version

#### Scenario: ROP version is bootstrapped
- **WHEN** the existing generated ROP resource is imported into typed
  projections and private artifacts
- **THEN** validation proves exact entry, term, geography, join-issue count, and
  canonical checksum parity before activation

#### Scenario: Unknown join-warning value is rejected
- **WHEN** a typed ROP projection attempts to persist an unrecognized join-warning value
- **THEN** the database rejects the row

### Requirement: ROP code resource has UI smoke coverage
The system SHALL register the ROP code page in the UI smoke route registry and
expose required smoke markers.

#### Scenario: UI smoke route sweep visits the resource
- **WHEN** UI smoke route coverage is checked
- **THEN** the ROP code page has route-registry entries for signed-in roles
- **AND** the page exposes a matching `data-smoke-page` marker

#### Scenario: UI smoke opens the ROP detail sheet
- **WHEN** UI smoke exercises the ROP detail sheet trigger
- **THEN** the detail sheet exposes matching `data-smoke-surface` and
  `data-smoke-ready` markers

### Requirement: ROP lifecycle surfaces have UI smoke coverage
The system SHALL register every new ROP candidate, validation, version history,
activation, rejection, and rollback sheet or dialog for UI smoke.

#### Scenario: UI smoke opens ROP lifecycle controls
- **WHEN** UI smoke exercises an admin ROP lifecycle control
- **THEN** its trigger, surface, and ready markers match the registered smoke
  fixture or targeted route interaction

### Requirement: Conversational ROP access reuses the complete persisted resource
The system SHALL serve conversational ROP browsing from the same persisted typed projection, authorization policy, active-version pointer, deterministic search semantics, stable ordering, detail records, geography records, and streamed-download behavior used by `/dashboard/rop-codes`. Chat MUST NOT maintain a second mutable ROP copy or silently substitute checked-in generated data.

#### Scenario: Chat searches or pages the active ROP resource
- **WHEN** an authenticated user runs a standalone ROP resource query through chat
- **THEN** results come from the complete active persisted version under the same user access policy as the ROP resource page and label that exact version

#### Scenario: Chat opens a ROP detail result
- **WHEN** a typed lookup selects one ROP entry
- **THEN** the bounded result may include its reviewed hierarchy terms, descriptions, status, source metadata, join issue, and geography from the same version

#### Scenario: Chat offers complete export
- **WHEN** a user needs all rows matching the current ROP query
- **THEN** chat links to the same authenticated streamed CSV behavior used by the resource page and does not reconstruct or embed the complete export in a model request

#### Scenario: Active ROP resource is unavailable
- **WHEN** no healthy active persisted ROP version can serve a standalone conversational query
- **THEN** chat returns a bounded resource-unavailable state and does not substitute another ROP version or generated artifact

### Requirement: Dataset use preserves immutable ROP version binding
Standalone ROP resource queries SHALL use the labeled active ROP version, while any query combining ROP classification with a primary dataset SHALL resolve the exact immutable ROP version recorded in that dataset's producer/forming-run reference-resource set. An independently reviewed dataset version that predates publication lineage MAY use one exact private append-only legacy binding to a complete valid ROP version only while no producer publication exists. Runtime lookup MUST NOT derive that record from the active pointer. Active-version changes MUST NOT alter historical dataset query meaning.

#### Scenario: Dataset and active resource use different versions
- **WHEN** the active ROP pointer advances after a primary dataset was produced
- **THEN** standalone browsing uses the new labeled active version and dataset classification queries continue to use the older bound version

#### Scenario: Dataset lineage cannot identify one ROP version
- **WHEN** the producer/forming run has no ROP member, multiple inconsistent members, or unverifiable resource-set lineage and no eligible exact reviewed legacy binding exists
- **THEN** dataset ROP filtering/relationships fail closed while standalone active-version browsing remains independently available

#### Scenario: Reviewed pre-publication dataset uses an exact legacy binding
- **WHEN** no producer publication exists and a private immutable review record binds the exact current dataset version to one complete valid ROP version
- **THEN** dataset classification queries use that exact version, the active pointer remains irrelevant, and a later producer publication disables the legacy resolution path

### Requirement: Conversational access does not widen ROP lifecycle mutation authority
The conversational ROP adapter SHALL be read-only. Search, list, lookup, count, continuation, and authenticated export MAY be exposed to eligible chat users, but candidate building, refresh, activation, rejection, rollback, and all resource writes MUST remain on the existing admin-only, same-origin-protected lifecycle surfaces.

#### Scenario: Non-admin conversational request asks for a lifecycle mutation
- **WHEN** a user asks Qwen to refresh, activate, reject, roll back, or edit ROP data
- **THEN** no mutation endpoint is invoked and chat explains that the requested operation is outside its read-only capability

#### Scenario: Admin asks through chat for a lifecycle mutation
- **WHEN** an administrator asks the read-only chat path to perform a ROP lifecycle action
- **THEN** chat still does not mutate the resource and may direct the administrator to the existing reviewed lifecycle UI
