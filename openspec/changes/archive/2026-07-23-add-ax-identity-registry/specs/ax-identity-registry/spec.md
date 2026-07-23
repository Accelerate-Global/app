## ADDED Requirements

### Requirement: AX canonical and alias codes are globally collision-free
The system SHALL store PGAC/PGIC canonical and alias codes in one private registry that prevents one code from identifying multiple active subjects.

#### Scenario: Canonical or alias collision is attempted
- **WHEN** a transaction attempts to assign a code already used as canonical or alias by another identity
- **THEN** the database rejects the transaction
- **AND** existing identities and history remain unchanged

### Requirement: ROP3 identity is deterministic and validated
The system SHALL construct ROP3-backed PGAC/PGIC codes from normalized pinned ROP1, registered source initials, exact six-digit ROP3, and canonical ISO3.

#### Scenario: Valid ROP3 identity is requested twice
- **WHEN** the same stable source row and normalized inputs are reconciled repeatedly
- **THEN** the system returns the same PGAC/PGIC identities and source binding
- **AND** creates no duplicate code or revision entry

#### Scenario: Required normalized component is invalid
- **WHEN** source initials, ROP3, or ISO3 cannot be validated against pinned contracts/resources
- **THEN** the identity candidate records a blocking conflict and does not invent fallback canonical text

### Requirement: Six-digit allocation is atomic and non-recycling
The system SHALL allocate no-ROP3 identifiers through a transactionally locked bounded namespace counter and SHALL never derive a value from an unlocked maximum or recycle an allocated value.

#### Scenario: Concurrent requests allocate different rows
- **WHEN** two transactions request new identities in the same namespace concurrently
- **THEN** each receives a unique six-digit value

#### Scenario: Same row retries concurrently
- **WHEN** multiple transactions request identity for the same profile and stable row key
- **THEN** all resolve to one reserved or active binding and one allocated value

### Requirement: Registry revisions are immutable publication anchors
The system SHALL create an append-only checksummed registry revision whenever authoritative bindings activate and SHALL allow downstream runs to bind the exact revision.

#### Scenario: Identity publication succeeds
- **WHEN** an administrator publishes a valid identity candidate
- **THEN** the database activates its bindings, creates one revision and publication anchor, and records actor/reason/time atomically
- **AND** the source candidate remains immutable

### Requirement: Legacy import is a fixed dry-run-first identity graph
The system SHALL inspect only the repository-owned manifest of exact checksummed legacy snapshots, SHALL allow runtime reviewed copies to change only Tier 2 profile keys, SHALL construct deterministic PGAC parent → PGIC child identities plus complete historical binding evidence, SHALL require unique source-identity-matched Tier 2 profile and active connection mapping, and SHALL NOT expose a flat production API import. Positional historical keys SHALL NOT become active bindings. Dry-run evidence SHALL be append-only and bound to the exact target database state. Commit SHALL remain blocked until a repository-reviewed contract pins exact current source snapshots and engine/configuration checksums, recomputes runtime keys with production forming helpers, accounts for every historical row, and selects at most one code-agreeing identity per unique current key. A future enabled commit SHALL require one token-authorized database transaction that verifies the exact staged graph and audit checksums before creating authority.

#### Scenario: Historical snapshots are characterized before a runtime crosswalk exists
- **WHEN** every retained manifest path/checksum and canonical identity relationship validates but the checked-in runtime crosswalk contract remains pending
- **THEN** dry run returns the exact state-bound evidence fingerprint, 296,297-row historical coverage, zero selected active bindings, findings, and checksummed reviewable audit artifacts in service-role-only storage without mutating registry authority
- **AND** returns no commit token

#### Scenario: A runtime crosswalk is proposed outside repository review
- **WHEN** a runtime manifest tries to supply or alter a crosswalk path, checksum, selected count, source snapshot, or engine/configuration binding
- **THEN** manifest validation refuses it and cutover remains blocked

#### Scenario: Future verified commit handshake matches the dry run
- **WHEN** the repository-pinned source/crosswalk implementation is complete and an administrator commits the identical inputs with the matching fingerprint/token and a reason
- **THEN** the system imports the graph idempotently, creates one registry revision and durable cutover marker, and advances the non-ROP3 allocation floor to at least `2055`

#### Scenario: Target state changes after dry run
- **WHEN** a profile is remediated or any token-bound target registry state changes
- **THEN** the old token is rejected and a new append-only dry run can issue a different evidence fingerprint without rewriting prior evidence

#### Scenario: Alias cannot safely activate
- **WHEN** a structurally valid legacy alias collides with a different canonical graph subject
- **THEN** the importer preserves the conflict as quarantined audit evidence and does not activate that alias

#### Scenario: Alias is malformed or identifies multiple intended subjects
- **WHEN** a legacy alias is structurally invalid or resolves to more than one intended identity
- **THEN** dry run reports a blocking graph failure and commit is refused

#### Scenario: Tier 2 binding has no explicit mapping
- **WHEN** a Tier 2 source binding cannot resolve through the declared profile mapping
- **THEN** dry run reports a blocking finding and commit is refused

#### Scenario: Tier 2 mapping points at an unrelated active profile
- **WHEN** one profile is mapped from multiple legacy components, a `spreadsheet:<id>` component does not match the profile's exact spreadsheet ID, or the backing Google Sheets connection is archived or has different source identity
- **THEN** dry run reports a blocking finding and database finalization independently refuses the mapping

#### Scenario: Graph staging bypasses the reviewed handshake
- **WHEN** a caller inserts import-owned identities, codes, bindings, or audits without the authorized transaction session, stages extra non-active rows, activates an import row after authorization is consumed, forges committed status/cutover authority, or stages same-count content whose checksum differs
- **THEN** the database rejects staging or finalization and does not create a revision or cutover marker

#### Scenario: Identical snapshot is imported again
- **WHEN** an administrator repeats an already committed snapshot fingerprint
- **THEN** the importer reports the existing import and creates no duplicate identities, bindings, aliases, or revision

### Requirement: Authoritative identity work requires cutover evidence
The system SHALL require the durable namespace cutover marker before creating authoritative post-legacy allocations or publications.

#### Scenario: Legacy graph has not committed
- **WHEN** an identity allocation or publication is requested without the namespace cutover marker
- **THEN** the system fails closed without minting or activating identity values
