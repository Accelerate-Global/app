# versioned-reference-resources Specification

## Purpose
Define how built-in reference resources are cataloged, built, validated,
versioned, reviewed, activated, rolled back, packaged, and monitored so every
downstream dataset workflow uses an explicit, reproducible resource set.
## Requirements
### Requirement: Reference resources have a persistent typed catalog
The system SHALL persist stable reference-resource definitions and SHALL require
each definition to use a registered resource kind with a versioned domain schema.

#### Scenario: Registered resource appears in the catalog
- **WHEN** an authenticated user requests the reference-resource catalog
- **THEN** the system returns each registered resource with its stable key,
  label, description, route, kind, and active-version summary
- **AND** the catalog includes Country/ROG and ROP after bootstrap

#### Scenario: Unknown resource kind is registered
- **WHEN** an operation attempts to register a resource kind without a typed
  adapter and supported schema version
- **THEN** the system rejects the registration
- **AND** no activatable resource definition is created

### Requirement: Reference-resource versions are immutable packages
The system SHALL store every reference-resource version as an immutable package
containing source metadata, canonical normalized content, typed projections,
private artifacts, counts, a schema version, and a deterministic checksum.

#### Scenario: Candidate package is finalized
- **WHEN** a candidate build finishes writing artifacts and typed projections
- **THEN** the system verifies artifact existence, expected counts, schema, and
  canonical checksum
- **AND** the system finalizes the version as valid or invalid
- **AND** finalized payload and projection content cannot be changed

#### Scenario: Finalized payload is mutated
- **WHEN** any process attempts to update or delete normalized content or typed
  entries belonging to a finalized version
- **THEN** the database rejects the mutation
- **AND** the finalized checksum and artifacts remain unchanged

#### Scenario: Identical normalized content is refreshed
- **WHEN** a refresh produces the same canonical checksum as an existing
  equivalent version of that resource and schema
- **THEN** the system reports that no content change was found
- **AND** the system does not create a duplicate activatable package

### Requirement: Refresh creates a reviewable candidate
The system SHALL build refreshed resource data as a persistent candidate and
SHALL keep the active version unchanged until a valid candidate is activated.

#### Scenario: Source refresh produces a valid candidate
- **WHEN** an admin refreshes a resource and source parsing, normalization,
  projection, and validation succeed
- **THEN** the system persists a valid inactive candidate
- **AND** the system provides counts, validation results, source evidence, and a
  deterministic added/changed/removed diff from the active version
- **AND** signed-in readers continue to receive the current active version

#### Scenario: Source refresh produces an invalid candidate
- **WHEN** parsing or validation identifies a blocking error
- **THEN** the system preserves the failure and structured findings for admin
  review
- **AND** the candidate cannot be activated
- **AND** the active resource remains unchanged

#### Scenario: Candidate build is interrupted
- **WHEN** a refresh ends before finalization
- **THEN** the incomplete build is never returned as active data
- **AND** an admin can observe its failed or incomplete state and safely retry
  without duplicating finalized content

### Requirement: Activation, rejection, and rollback are explicit and audited
The system SHALL allow admins to activate valid candidates, reject candidates,
and reactivate prior valid versions with atomic active-pointer updates and
append-only audit events.

#### Scenario: Admin activates the expected valid candidate
- **WHEN** an admin supplies a reason and activates a valid candidate against
  the expected current version
- **THEN** the active pointer changes atomically to the candidate
- **AND** the system records the actor, reason, action, previous version,
  selected version, and timestamp
- **AND** subsequent readers receive the selected version

#### Scenario: Admin activation is stale
- **WHEN** another activation changes the current version before an admin's
  request commits
- **THEN** the system returns a conflict
- **AND** it does not overwrite the newer active pointer

#### Scenario: Admin rejects a candidate
- **WHEN** an admin rejects an inactive candidate with a reason
- **THEN** the candidate remains immutable and inactive
- **AND** the rejection actor, reason, and timestamp remain available in history

#### Scenario: Admin rolls back an active resource
- **WHEN** an admin selects a prior valid version and supplies a rollback reason
- **THEN** the system reactivates that version through the same atomic control
- **AND** no version payload is deleted or rewritten
- **AND** the rollback is recorded as a distinct audit event

### Requirement: Active resource selections form immutable sets
The system SHALL create an immutable resource-set snapshot after every successful
activation and SHALL provide a stable identifier that resolves the exact active
version of every registered resource at that moment.

#### Scenario: Activation creates a resource set
- **WHEN** a resource activation succeeds
- **THEN** the system creates one resource set containing the newly selected
  version and every other currently active resource version
- **AND** the set has a deterministic checksum and stable identifier

#### Scenario: Historical resource set is resolved
- **WHEN** server-side code resolves a prior resource-set identifier
- **THEN** the system returns exactly the version members originally recorded
- **AND** later resource activations do not alter those members

#### Scenario: Future consumer requests current resources
- **WHEN** an internal consumer requests the current reference-resource set
- **THEN** the system returns the current immutable set identifier and its exact
  version members
- **AND** the contract does not create a loose polymorphic consumer binding

### Requirement: Resource reads are role-aware and scalable
The system SHALL expose active reference data to authenticated users through
server-controlled, stably ordered queries and SHALL restrict inactive lifecycle
data and mutations to dataset admins.

#### Scenario: Signed-in user queries active entries
- **WHEN** a signed-in user searches or pages through a resource
- **THEN** the system queries only the active version
- **AND** results use a deterministic sort and opaque cursor
- **AND** search covers the resource family's specified names, codes, statuses,
  source fields, and issue fields

#### Scenario: Signed-in user downloads matching entries
- **WHEN** a signed-in user downloads a filtered resource
- **THEN** the system streams all entries matching the active-version query
- **AND** the download is not limited to the browser's currently loaded page

#### Scenario: Non-admin requests inactive lifecycle data
- **WHEN** a signed-in non-admin requests a candidate, validation findings,
  detailed version history, or an admin mutation
- **THEN** the system returns `403 Forbidden`
- **AND** no lifecycle state changes

#### Scenario: Anonymous user requests resource data
- **WHEN** an anonymous user requests catalog, entry, download, or lifecycle data
- **THEN** the system returns `401 Unauthorized` or redirects an app page to
  sign-in as appropriate

### Requirement: Resource lifecycle protects private data and concurrent work
The system SHALL keep reference artifacts and control tables private, SHALL use
the existing application security boundaries, and SHALL serialize conflicting
finalization or activation work without holding long data-load transactions.

#### Scenario: Browser requests a private artifact directly
- **WHEN** a browser attempts unauthenticated or direct Data API access to a
  private artifact or control table
- **THEN** Supabase privileges, RLS, or Storage policy denies access

#### Scenario: Two admins build the same resource concurrently
- **WHEN** overlapping refresh operations target the same resource
- **THEN** the system prevents conflicting finalization or clearly records
  independent candidates without mixing their artifacts or entries
- **AND** no long-lived advisory lock spans upstream fetching or batch loading

#### Scenario: Provider fails during refresh
- **WHEN** an upstream provider fails or returns unsafe details
- **THEN** the API returns a normalized error
- **AND** raw provider objects and secrets are not exposed to the client or logs

### Requirement: Existing resources bootstrap deterministically
The system SHALL provide an idempotent bootstrap and reconciliation process that
imports the checked-in Country/ROG and ROP resources, folds in persisted country
aliases, activates validated versions, and verifies parity before cutover.

#### Scenario: Empty environment is bootstrapped
- **WHEN** the bootstrap command runs after the resource schema migration in an
  environment with no active resources
- **THEN** it imports and validates Country/ROG and ROP through their production
  adapters
- **AND** it creates private artifacts, typed projections, active versions, and
  an initial complete resource set
- **AND** counts and canonical content match the checked-in resources plus
  persisted country aliases

#### Scenario: Bootstrap is repeated
- **WHEN** the bootstrap command runs again with unchanged input
- **THEN** it exits successfully without duplicating versions, entries,
  artifacts, activation events, or resource sets

#### Scenario: Bootstrap input fails parity
- **WHEN** imported counts, checksums, required codes, or artifacts do not match
  the expected validated package
- **THEN** bootstrap fails before application cutover
- **AND** it does not partially activate the new resources

### Requirement: Resource lifecycle health is observable
The system SHALL expose server-side health information sufficient to detect
missing active versions, incomplete packages, projection/artifact divergence,
and stale interrupted builds.

#### Scenario: Resource package is healthy
- **WHEN** an operator runs the health check
- **THEN** each active resource reports matching catalog pointer, checksum,
  projection counts, required artifacts, and resource-set membership

#### Scenario: Resource package is inconsistent
- **WHEN** an active pointer, projection count, checksum, artifact, or set member
  is missing or inconsistent
- **THEN** the health check fails with the affected resource and invariant
- **AND** the system does not silently substitute checked-in data

### Requirement: Reference-resource lifecycle timestamps hydrate deterministically
The system SHALL render every server-rendered reference-resource metadata
timestamp with an explicit timezone and stable locale format so server-rendered
and browser-hydrated text are identical.

#### Scenario: Browser hydrates a reference-resource page in another timezone
- **WHEN** Vercel renders a Country/ROG or ROP lifecycle or source-retrieval
  timestamp in UTC and a signed-in user's browser hydrates the page in a
  different local timezone
- **THEN** every visible reference-resource metadata timestamp remains unchanged
- **AND** the page does not produce a React text-mismatch hydration error for
  those timestamps

#### Scenario: User views version history
- **WHEN** a dataset admin opens reference-resource version history
- **THEN** every version timestamp uses the same explicit timezone and stable
  locale format as the active-version timestamp

### Requirement: Resource sets satisfy registered engine declarations
The system SHALL validate an immutable resource set against a registered engine's ordered resource requirements before a candidate build starts.

#### Scenario: Resource set is complete for an engine
- **WHEN** every required resource key resolves to a valid active version of a compatible kind and schema with a deterministic checksum
- **THEN** the system returns the exact version bindings for candidate persistence

#### Scenario: Resource set is incomplete for an engine
- **WHEN** any required resource key is missing, invalid, incompatible, or absent from the selected immutable set
- **THEN** the resource set is not usable for that engine build
- **AND** the system reports the missing or incompatible keys

### Requirement: Pipeline resources use typed immutable packages
The resource catalog SHALL support the approved source-alias, JP PeopleID3, PEID, Tier 1 merge-priority, and engagement-mapping families with typed schemas, deterministic checksums, and validation appropriate to their key relationships.

#### Scenario: Valid pipeline resource is built
- **WHEN** a source package conforms to its registered schema, uniqueness rules, active-state rules, and cross-reference requirements
- **THEN** the system persists a valid immutable candidate with typed projections, artifacts, counts, checksum, and diff

#### Scenario: Pipeline resource contains blocking key defects
- **WHEN** a source package contains duplicate canonical keys, invalid identifiers, incompatible schema, or a blocking cross-reference defect
- **THEN** the candidate remains invalid and cannot join an active resource set

#### Scenario: Approved bounded parent is absent
- **WHEN** a resource family permits a documented bounded missing-parent relationship
- **THEN** the candidate records a warning and remains eligible when all other blocking invariants pass

### Requirement: Retained pipeline resources import as exact complete snapshots
The system SHALL import source aliases, JP PeopleID3, PEID, Tier 1 merge priorities, and engagement mappings from an explicit manifest of exact paths, SHA-256 checksums, and retrieval timestamps, SHALL persist each full typed payload and lineage as an immutable version, and SHALL NOT select a latest file.

#### Scenario: All retained snapshots match the manifest
- **WHEN** all five exact files match their declared checksums and pass schema, uniqueness, and cross-resource validation
- **THEN** the system creates all five immutable candidates before activating any of them
- **AND** expected-current activation produces a healthy immutable resource set containing every required family

#### Scenario: One retained snapshot drifts or fails validation
- **WHEN** any declared file is missing, checksum-mismatched, partial, or invalid
- **THEN** the import fails closed before activating any candidate
- **AND** no sanitized fixture is substituted for the retained production snapshot
