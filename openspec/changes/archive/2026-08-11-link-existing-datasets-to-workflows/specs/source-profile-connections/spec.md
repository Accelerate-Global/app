## ADDED Requirements

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
