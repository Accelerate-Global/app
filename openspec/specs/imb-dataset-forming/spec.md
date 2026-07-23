# imb-dataset-forming Specification

## Purpose
Define the deterministic, reviewable IMB dataset-forming lifecycle that binds archived ingestion evidence to exact resource and rule versions before an administrator publishes a workspace dataset.
## Requirements
### Requirement: IMB forming candidates bind immutable inputs
The system SHALL create an IMB forming candidate only from a successful archived IMB ingestion run and SHALL bind the candidate to the source connection/run, source artifact checksums, exact immutable reference-resource set, field-contract version/checksum, and transformation version/checksum.

#### Scenario: Admin starts an eligible IMB candidate
- **WHEN** a dataset admin starts forming from a successful IMB ingestion run with complete archived output and a healthy current reference-resource set
- **THEN** the system creates a background forming run with immutable source, resource, field-contract, and transformation bindings
- **AND** later resource activations or source ingestions do not change those bindings

#### Scenario: Source run is ineligible
- **WHEN** an admin requests forming from a non-IMB run, unsuccessful run, test run, missing output, or malformed archived artifact
- **THEN** the system rejects the request or finalizes an inspectable invalid candidate without publishing a dataset

#### Scenario: Required resource is unavailable
- **WHEN** the selected resource set does not contain healthy Country/ROG and ROP versions
- **THEN** the candidate cannot become valid
- **AND** the existing active datasets and reference pointers remain unchanged

### Requirement: IMB forming preserves source evidence and row lineage
The system SHALL leave archived source artifacts unchanged, SHALL retain every parsed source row in the formed candidate unless a blocking structural error invalidates the complete candidate, and SHALL assign deterministic version and source-record lineage identifiers.

#### Scenario: Candidate forms complete source rows
- **WHEN** an eligible source run contains structurally valid rows with unique ArcGIS object identifiers
- **THEN** the formed candidate contains the same number of rows as the source
- **AND** each row records the source run as `Dataset_ID`, the ArcGIS object identifier as `Dataset_Row_ID`, and a stable IMB connection/object identifier key as `Dataset_Row_Key`

#### Scenario: Source object identifier is missing or duplicated
- **WHEN** any source row lacks an ArcGIS object identifier or two rows produce the same stable source-record key
- **THEN** the system records blocking findings and marks the complete candidate invalid
- **AND** it does not silently substitute a row ordinal

#### Scenario: Raw value differs from formed value
- **WHEN** a forming rule canonicalizes or cannot convert a source value
- **THEN** the immutable source artifact retains the original value
- **AND** lineage/findings identify the rule, field, source value, and canonical or unresolved result

### Requirement: IMB field formation uses the approved versioned contract
The system SHALL project IMB source rows through an ordered immutable field contract that records its version and checksum and includes the approved written-scripture mapping plus provenance fields. Source rows produced from the current IMB production schema SHALL pass through the approved source adapter whose version and checksum are recorded in the archived rows artifact without changing the version-1 formed output contract.

#### Scenario: Known IMB schema is formed
- **WHEN** all required version-1 source fields are present directly or through the approved replacement-source adapter
- **THEN** the candidate uses the contract's canonical output names and order
- **AND** maps `Bible` to `Resources_Written_Scripture`
- **AND** includes `Data_Source`, `Dataset_ID`, `Dataset_Row_ID`, and `Dataset_Row_Key`

#### Scenario: Required source field is absent
- **WHEN** the source artifact omits a field marked required by the pinned contract
- **THEN** the system records a blocking schema finding and marks the candidate invalid

#### Scenario: Additional source field appears
- **WHEN** IMB supplies a field not included in the pinned output contract
- **THEN** the raw artifact preserves it
- **AND** the formed candidate records schema drift without silently adding an unversioned output field

#### Scenario: Replacement source omits a discontinued optional field
- **WHEN** the replacement IMB schema has no trustworthy equivalent for an optional legacy source field
- **THEN** the adapter leaves that legacy source field blank
- **AND** does not invent or derive an unapproved value

### Requirement: IMB country formation preserves valid ISO3 authority
The system SHALL resolve country data against the Country/ROG version in the pinned resource set using exact normalized identifiers and aliases without fuzzy matching or silent replacement of a valid source ISO3.

#### Scenario: Source ISO3 is valid
- **WHEN** a source row contains an exact active ISO3 in the pinned resource
- **THEN** the system retains that ISO3 and derives the canonical country name from it

#### Scenario: ISO3 is blank and country alias is recognized
- **WHEN** source ISO3 is blank and the normalized source country name exactly matches a resource display name or alias
- **THEN** the system fills ISO3 and canonical country name from that resource entry

#### Scenario: Country text conflicts with valid ISO3
- **WHEN** source ISO3 is valid but the recognized source country name resolves to a different ISO3
- **THEN** the system retains the valid source ISO3
- **AND** records a warning containing both interpretations

#### Scenario: Country cannot be resolved
- **WHEN** neither source ISO3 nor country text resolves exactly
- **THEN** the system preserves the row and source values with an unresolved warning
- **AND** does not invent an identifier

### Requirement: IMB ROP formation uses exact ROP3 hierarchy resolution
The system SHALL resolve ROP hierarchy values from the ROP version in the pinned resource set using exact ROP3 matches and SHALL preserve unresolved rows without fuzzy matching or AX-code allocation.

#### Scenario: ROP3 resolves exactly
- **WHEN** a source ROP3 exactly matches a ROP person entry in the pinned resource
- **THEN** the candidate derives canonical ROP1, ROP2, and ROP25 from that entry
- **AND** records warnings for source parent disagreements, inactive terms, or resource join issues

#### Scenario: ROP3 is absent from the resource
- **WHEN** a nonblank source ROP3 has no exact match in the pinned resource
- **THEN** the candidate preserves the row and source ROP3 as unresolved
- **AND** does not invent canonical parents or an AX code

#### Scenario: ROP3 is blank
- **WHEN** a source row has no ROP3
- **THEN** the candidate preserves the row with an unresolved warning
- **AND** does not merge it with another unresolved row

### Requirement: IMB type formation is deterministic and explainable
The system SHALL canonicalize supported string, boolean, integer, and finite decimal values according to the pinned field contract while distinguishing blank values from invalid nonblank values.

#### Scenario: Value converts successfully
- **WHEN** a nonblank source value matches the configured semantic type
- **THEN** the formed value uses the canonical string representation

#### Scenario: Optional value is invalid
- **WHEN** a nonblank optional source value cannot be converted
- **THEN** the formed value is blank
- **AND** a warning preserves the original value and conversion rule

#### Scenario: Identifier-like code is formed
- **WHEN** the source field is an ISO, ROP, PEID, or lineage identifier
- **THEN** the system treats it as an identifier string rather than a numeric measurement

### Requirement: IMB candidates expose structured validation and immutable artifacts
The system SHALL finalize each forming attempt as a valid, invalid, or failed inspectable candidate with deterministic counts, summaries, complete private JSON and CSV artifacts, and output checksum. Artifact persistence failures SHALL retain a safe user-facing message and produce normalized operator diagnostics without exposing credentials or raw provider objects.

#### Scenario: Candidate has warnings only
- **WHEN** formation completes with preserved row counts, valid lineage, complete artifacts, and only domain/conversion warnings
- **THEN** the candidate becomes valid and reviewable
- **AND** warnings do not publish or reject it automatically

#### Scenario: Candidate has blocking errors
- **WHEN** formation detects a structural error or cannot verify artifact/count/checksum integrity
- **THEN** the candidate becomes invalid or failed with normalized findings/error details
- **AND** it cannot be published

#### Scenario: Candidate artifacts are persisted
- **WHEN** formation successfully generates rows, findings, lineage manifest, and CSV content within the configured object-size bound
- **THEN** all four artifacts are stored privately with their expected content types
- **AND** the candidate can finalize as valid or invalid instead of failing because CSV is disallowed

#### Scenario: Candidate artifact upload fails
- **WHEN** private artifact storage rejects an upload
- **THEN** previously uploaded artifacts for that forming attempt are removed
- **AND** the candidate shows a safe normalized failure while operators receive normalized provider diagnostics

#### Scenario: Candidate artifacts are requested
- **WHEN** a dataset admin downloads formed rows, findings, or lineage manifest for a finalized candidate
- **THEN** the server streams the immutable private artifact through a guarded endpoint
- **AND** browser roles cannot access Storage or control tables directly

### Requirement: Dataset admins review and decide IMB candidates explicitly
The system SHALL allow dataset admins to inspect candidate bindings, lifecycle, counts, checksums, findings, and artifacts from the IMB connection run detail and SHALL require explicit publish or reject actions with audit context.

#### Scenario: Admin reviews a valid warning-bearing candidate
- **WHEN** a dataset admin opens the source run detail
- **THEN** the UI shows the pinned resource set, rule versions, source/output counts, warning/error totals, a bounded finding list, and complete artifact downloads
- **AND** publication requires warning acknowledgement and a nonblank reason

#### Scenario: Admin rejects a candidate
- **WHEN** a dataset admin supplies a reason and rejects a valid or invalid inactive candidate
- **THEN** the system records the actor, reason, and timestamp
- **AND** preserves the candidate bindings, findings, checksums, and artifacts

#### Scenario: Non-admin attempts candidate access or mutation
- **WHEN** an unauthenticated or non-admin user lists, builds, downloads, publishes, or rejects a forming candidate
- **THEN** the centralized route guard rejects the request
- **AND** no private data or lifecycle state is exposed or changed

### Requirement: Valid IMB candidates publish through existing dataset versioning
The system SHALL publish only a valid explicitly approved IMB candidate, SHALL create or replace the connection's target dataset using existing dataset version history, and SHALL bind the published dataset to the candidate audit record.

#### Scenario: First valid candidate is published
- **WHEN** a dataset admin publishes the first valid candidate with any warnings acknowledged and a reason
- **THEN** the system creates one workspace dataset from the formed rows
- **AND** binds the IMB connection target and records the candidate, actor, dataset, checksum, and publication time

#### Scenario: Later candidate is published
- **WHEN** the IMB connection already targets a dataset and an admin publishes a later valid candidate
- **THEN** the system archives the prior dataset version and replaces current rows through existing version behavior
- **AND** prior candidate and dataset history remain inspectable

#### Scenario: Invalid, stale, or already decided candidate is published
- **WHEN** an admin attempts to publish an invalid, rejected, failed, publishing, or published candidate
- **THEN** the system rejects the request without changing the target dataset

#### Scenario: Publication fails after candidate validation
- **WHEN** dataset creation or replacement fails
- **THEN** the candidate remains retryable and its immutable formed artifacts remain unchanged
- **AND** the error is normalized for the admin

### Requirement: IMB executes through the shared forming platform
The IMB forming workflow SHALL register as a source-specific engine on the generic forming platform while preserving the approved version-1 output contract and decision behavior.

#### Scenario: IMB fixture is formed through the adapter
- **WHEN** the approved IMB golden source fixture is built through the registered IMB engine
- **THEN** its columns, rows, findings, validation totals, lineage fields, and output checksum equal the pre-generalization expectation
- **AND** the candidate records the IMB engine metadata plus exact Country/ROG and ROP bindings

#### Scenario: Existing IMB route starts a build
- **WHEN** an administrator uses an existing IMB forming API or run-detail action
- **THEN** the request delegates to the shared lifecycle
- **AND** returns a backward-compatible response with the generic engine metadata available to the UI
