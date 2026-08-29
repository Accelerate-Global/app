# partner-export-profiles Specification

## Purpose

Define dataset-scoped, administrator-managed partner export profiles that map
existing dataset columns into validated, auditable, private download artifacts
without mutating the source dataset or delivering data to an external system.
## Requirements
### Requirement: Dataset administrators manage dataset-scoped partner export profiles
The system SHALL let a dataset administrator create, view, update, archive, and
reuse named partner export profiles for one existing source dataset at a time.
The system SHALL retain the source dataset association, profile revision,
creator, updater, and timestamps, and it SHALL not alter source dataset rows,
columns, hidden-column settings, or default views when a profile is managed.

#### Scenario: Admin creates a profile for a source dataset
- **WHEN** a dataset administrator opens a source dataset and creates a named partner export profile
- **THEN** the system saves the profile as scoped to that dataset
- **AND** the profile can be listed with that dataset for later preview or generation
- **AND** the source dataset remains unchanged

#### Scenario: Profile cannot span multiple source datasets
- **WHEN** a dataset administrator attempts to add columns from a second dataset to a profile
- **THEN** the system rejects the configuration
- **AND** the profile continues to reference exactly one source dataset

#### Scenario: Non-admin attempts to manage a profile
- **WHEN** an unauthenticated user or non-admin user requests profile list, create, update, archive, preview, run, or download behavior
- **THEN** the system rejects the request using the existing dataset-administrator authorization behavior
- **AND** the system does not expose profile configuration, source values, or export artifacts

### Requirement: Profiles define an explicit safe column crosswalk
The system SHALL let a profile define an ordered set of unique output headers,
each mapped to normalized source column keys from its source dataset or to an
explicit administrator-entered literal. The system SHALL retain a source-label
snapshot for review but MUST resolve row values by source column key rather than
by spreadsheet letter, source position, or label alone.

The system SHALL support only an allow-listed, deterministic transformation
configuration: copy/trim, ordered coalesce, literal, lossless whole-number
normalization, ISO-8601 timestamp normalization, and non-negative
whole-number normalization. The system MUST reject arbitrary expressions,
scripts, SQL, remote lookups, spreadsheet formulas, and inferred semantic
substitutions.

#### Scenario: Admin maps and orders columns
- **WHEN** a dataset administrator selects source columns, enters target headers, chooses supported transformations, and orders the mappings
- **THEN** the system saves a reviewable crosswalk with that exact output order
- **AND** generated rows contain only the configured target columns in that order

#### Scenario: Invalid mapping configuration is rejected
- **WHEN** a profile has an empty or duplicate target header, duplicate position, unsupported transform, missing source key, or invalid transform setting
- **THEN** the system rejects the profile save or preview request with actionable field-level validation
- **AND** the system does not alter the existing saved profile revision or source dataset

#### Scenario: Source schema changes after a profile is saved
- **WHEN** a source dataset refresh removes or changes a mapped source column key
- **THEN** the system marks the mapping unresolved for preview and generation
- **AND** the system does not silently rebind the mapping to a similarly named column

### Requirement: Joshua Project starter profiles preserve the exchange contract
The system SHALL provide a Joshua Project starter profile that produces exactly
these ordered output headers: `PG_PeopleID3`, `PG_ROP3`, `Geo_ROG3`,
`Geo_ISO3`, `PG_Name_Main`, `PG_Name_Alt`, `PG_AX_unique_PG_ID_PGIC`,
`reporting_group`, `implementing_group`,
`engage_timestamp_of_last_known`, `engage_status_of_engagement`,
`approx_evangelical_believers`, and `approx_evangelical_churches`.

The starter SHALL make only case-insensitive exact source-header suggestions.
It MUST leave an unmatched header visibly unresolved and MUST NOT substitute a
nearby aggregate field, spreadsheet position, or source `index`/`Row number`
helper column. It SHALL expose its field-level validation policy for an
administrator to review before generation.

#### Scenario: Admin creates a Joshua Project starter profile
- **WHEN** a dataset administrator chooses the Joshua Project starter profile
- **THEN** the system creates an editable crosswalk with the exact 13 target headers in the required order
- **AND** it preselects only exact source-header matches
- **AND** it does not include a source `index` or application `Row number` column in the output contract

#### Scenario: Joshua Project header is not present in the source schema
- **WHEN** the starter cannot find an exact source-header match for a Joshua Project target header
- **THEN** the system displays that mapping as unresolved
- **AND** it requires the administrator to map a source, use an allowed literal where permitted, or remove the profile before a compliant export can be generated

### Requirement: Profiles provide deterministic preview and validation
The system SHALL provide an administrator preview that runs the same mapping
and validation logic used for generation against the current source dataset.
The preview SHALL show the configured crosswalk, a bounded ordered sample of
output rows, aggregate validation counts, and row/field references for
findings without writing a generated CSV artifact.

The system SHALL distinguish blocking errors from warnings. Blocking errors
MUST prevent generation; warnings MUST require an explicit administrator
acknowledgement before generation. Identifier values SHALL remain strings, and
numeric/date normalizers MUST reject lossy or ambiguous values rather than
inventing a replacement.

#### Scenario: Admin previews a valid profile
- **WHEN** a dataset administrator requests a preview for a valid profile and compatible source schema
- **THEN** the system returns the crosswalk, ordered output sample, and validation summary calculated by the generation logic
- **AND** the system does not create an export run or modify source data

#### Scenario: Blocking data validation prevents generation
- **WHEN** mapped rows violate a profile rule classified as an error
- **THEN** the system identifies the affected row and target header in the validation result
- **AND** the system does not create a downloadable CSV artifact

#### Scenario: Warnings require explicit acknowledgement
- **WHEN** a profile preview contains warnings but no blocking errors
- **THEN** the system displays the warnings before generation
- **AND** the system refuses a generation request that does not explicitly acknowledge them

### Requirement: Partner export runs create private auditable local downloads
The system SHALL let a dataset administrator explicitly request a partner export
run after validation. A run SHALL snapshot the profile revision and source
provenance, including the source dataset ID, `blobPath`, current-version time,
ordered schema/row fingerprint, row count, actor, and output checksum. The
system SHALL persist an immutable CSV, crosswalk/manifest, and validation
report in private Storage and SHALL retain run status, timing, and validation
counts for audit.

The system SHALL provide an administrator-authorized local download for a
completed CSV artifact. It MUST not return a public object URL, email the file,
write to Google Drive, call a partner API, or mutate source data. CSV values
MUST use the application's spreadsheet-formula neutralization behavior before
the artifact is stored or downloaded.

#### Scenario: Admin generates a compliant export
- **WHEN** a dataset administrator explicitly generates a valid, acknowledged profile
- **THEN** the system records a queued and then terminal export run with immutable source and profile provenance
- **AND** the completed run exposes a private CSV download plus its crosswalk and validation report to dataset administrators
- **AND** subsequent source refreshes or profile edits do not change that run's artifacts

#### Scenario: Artifact persistence fails
- **WHEN** CSV or report artifact persistence fails during generation
- **THEN** the system records a normalized failed run without exposing source data or credentials
- **AND** it does not expose a partial download
- **AND** it cleans up newly written run objects that were not durably linked to the run

#### Scenario: Unauthorized user requests an export artifact
- **WHEN** an unauthenticated user or non-admin user requests a partner export CSV, crosswalk, validation report, or run detail
- **THEN** the system denies access
- **AND** it does not disclose a public Storage URL or artifact contents

### Requirement: Partner export editing and download naming are traceable
The system SHALL render the partner export profile editor at full viewport width
on mobile and two-thirds of the viewport width on tablet and desktop screens.
The feature width SHALL override the shared Sheet maximum-width default. For
each authorized artifact download, the system SHALL return a filesystem-safe
filename containing the source dataset name, the profile filename stem, and the
UTC timestamp of that download request, followed by the artifact-specific suffix
and extension.

#### Scenario: Administrator opens the profile editor on mobile
- **WHEN** a dataset administrator opens a partner export profile editor on a mobile viewport
- **THEN** the editor uses the full viewport width
- **AND** its existing scrollable content and save controls remain usable

#### Scenario: Administrator opens the profile editor on a wider viewport
- **WHEN** a dataset administrator opens a partner export profile editor at the tablet breakpoint or wider
- **THEN** the editor uses two-thirds of the viewport width without a narrow shared maximum-width cap
- **AND** the source dataset page remains visible beside it

#### Scenario: Administrator downloads a completed artifact
- **WHEN** a dataset administrator downloads a completed CSV, crosswalk, or validation artifact
- **THEN** the response filename includes sanitized source dataset and profile filename fragments
- **AND** it includes the UTC timestamp of that download request
- **AND** it ends with `.csv`, `-crosswalk.json`, or `-validation.json` according to the requested artifact
- **AND** the immutable stored artifact, authorization, and file contents remain unchanged

### Requirement: Partner export management begins from a compact dataset action

The system SHALL expose Partner exports inside one administrator-only Dataset actions menu on the dataset page instead of rendering a standalone export button or expanded export-management card. Selecting Partner exports SHALL open a slide-out that explains the workflow and exposes the current dataset's profile, preview, run, download, and new-profile entry behavior before the administrator enters the existing profile editor.

#### Scenario: Administrator opens partner export management

- **WHEN** a dataset administrator opens a source dataset and opens Dataset actions
- **THEN** the menu displays Partner exports
- **AND** selecting it opens an accessible export-management slide-out for that dataset
- **AND** no standalone Partner exports button or expanded profile details appear on the page

#### Scenario: Administrator begins a new profile

- **WHEN** the administrator selects New export profile from the export-management slide-out
- **THEN** the management slide-out hands off to the existing wide profile editor without leaving two active modal surfaces
- **AND** closing or saving the editor returns the administrator to export management

#### Scenario: Administrator reviews existing export activity

- **WHEN** the administrator opens export management for a dataset with saved profiles or runs
- **THEN** the slide-out exposes the existing preview, generation, status, and authorized artifact-download behavior
- **AND** the source dataset and export API behavior remain unchanged

#### Scenario: Non-admin opens a dataset

- **WHEN** an authenticated non-admin opens a dataset they may read
- **THEN** Dataset actions, Partner exports, and export-management details are not rendered
- **AND** existing server authorization continues to deny partner-export access
