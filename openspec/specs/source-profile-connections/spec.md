# source-profile-connections Specification

## Purpose
Define stable source-profile bindings that select forming behavior from durable connection identity and configuration rather than mutable names, URLs, or filenames.
## Requirements
### Requirement: Forming behavior is selected by stable source profile
The system SHALL bind each engine-managed connection to a stable source-profile key and SHALL NOT select forming rules from display name, URL text, folder name, filename, or latest-file discovery.

#### Scenario: Code-managed connection materializes
- **WHEN** IMB, Etnopedia, or Joshua Project first executes
- **THEN** its deployed definition materializes with its stable profile and forming-engine keys

#### Scenario: Administrator binds a Sheet profile
- **WHEN** an administrator binds an active readable Google spreadsheet/tab connection to an approved WCD or Accelerate source profile and supplies required stable-key configuration
- **THEN** the system stores the profile against the stable spreadsheet ID and `sheetId`
- **AND** tab renames do not change the binding

#### Scenario: Supported Sheet engine is not configured
- **WHEN** WCD or Accelerate-owned forming is requested without an active profile binding and durable stable-key column
- **THEN** the system reports the profile as unconfigured and rejects the build before ingestion or transformation
- **AND** it does not infer a connection from display metadata or publish an empty dataset

### Requirement: Active source-profile bindings are unique and private
The system SHALL permit at most one active connection per source profile and one active source profile per connection, and SHALL restrict binding lifecycle data and mutations to administrators.

#### Scenario: Conflicting profile binding is attempted
- **WHEN** an administrator attempts to bind an already active profile or an already bound connection
- **THEN** the database and guarded API reject the conflict without altering the existing binding

#### Scenario: Browser role accesses profile controls directly
- **WHEN** an anonymous or authenticated browser role queries or mutates private profile tables
- **THEN** RLS and privileges deny access

### Requirement: Engagement profiles bind stable Sheet identity and mapping
An engagement source profile SHALL persist stable spreadsheet ID, `sheetId`, durable row-key column, partner key, tracking-ID discriminator, and contract version/checksum under administrator control.

#### Scenario: Tab title changes
- **WHEN** a bound partner tab is renamed
- **THEN** the profile continues resolving the same `sheetId` and refreshes safe display metadata without changing identity

#### Scenario: Tier 2 support is deployed without a partner profile
- **WHEN** an administrator attempts partner formation without an active profile carrying every required binding and contract field
- **THEN** the system reports the partner as unconfigured and rejects the run
- **AND** it does not infer a default profile or release member

### Requirement: Tier 1 workflow bindings can be created during onboarding
The system SHALL create a requested WCD or Accelerate-owned source-profile binding in the same transaction as its reviewed Google Sheets connection.

#### Scenario: Onboarding creates a valid Tier 1 binding
- **WHEN** an administrator selects one available Tier 1 profile and a reviewed stable-key column for a Sheet tab
- **THEN** the system creates the connection and private binding atomically
- **AND** the linked connection uses PGIC classification

#### Scenario: Tier 1 profile is already bound
- **WHEN** onboarding requests a Tier 1 profile that is already assigned to another active connection
- **THEN** the database rejects the complete onboarding transaction without replacing the existing binding

### Requirement: Administrators can link an existing connection to one workflow
The system SHALL allow an administrator to attach an unassigned active Google Sheets connection to one reviewed Tier 1 or Tier 2 workflow without recreating the connection or its imported dataset.

#### Scenario: Existing ordinary connection receives a valid workflow
- **WHEN** an administrator submits a valid assignment using the exact connected spreadsheet, Sheet tab, and reviewed columns
- **THEN** the system creates the requested private binding or profile and updates the linked dataset classification atomically
- **AND** it preserves the connection ID, dataset ID, rows, and run history

#### Scenario: Existing connection already has a workflow
- **WHEN** an administrator attempts to assign a connection that already has an active Tier 1 binding or Tier 2 profile
- **THEN** the system rejects the request without replacing or altering the existing assignment

#### Scenario: Assignment validation fails
- **WHEN** a requested assignment references an unreviewed column, unavailable profile, inactive owner, missing contract, or conflicting Sheet identity
- **THEN** the system reports an actionable configuration error
- **AND** no binding, profile, or classification change is committed

### Requirement: Workflow assignment does not start processing
Linking an existing connection SHALL change configuration only and SHALL NOT automatically start ingestion, forming, publication, scheduling, or identity allocation.

#### Scenario: Assignment completes
- **WHEN** an administrator successfully links an existing connection to a workflow
- **THEN** the connection page displays the active workflow
- **AND** the latest ingestion, formed publication, schedule, and AX identity state remain unchanged
