# ax-identity-authority-initialization Specification

## Purpose
Define the one-time, state-bound procedure that establishes AX Online's empty
people-groups identity registry as the sole authority while keeping AX Data
outside every execution and identity-decision boundary.

## Requirements
### Requirement: AX Online authority initializes from a verified empty state
The system SHALL initialize the people-groups identity authority only when identities, codes, bindings, aliases, revisions, and legacy authority records are absent and the non-ROP3 counter equals `1`.

#### Scenario: Empty authority is initialized
- **WHEN** a super-admin operator commits the exact CLI dry-run fingerprint and single-use token with a reason
- **THEN** one atomic transaction creates empty registry revision 1 and one immutable authority marker
- **AND** creates no identity, code, binding, or alias and leaves the counter at `000001`

#### Scenario: Unexpected authority data exists
- **WHEN** initialization finds any identity, code, binding, revision, committed legacy cutover, or changed counter state
- **THEN** initialization fails without deleting, adopting, or mutating that data

### Requirement: Authority activation is state-bound and CLI-only
The system SHALL bind activation authorization to the exact environment, zero-state fingerprint, empty graph checksum, rules checksum, formatter checksum, actor, and one single-use token, and SHALL expose no browser or HTTP mutation endpoint for activation.

#### Scenario: State changes after dry run
- **WHEN** any token-bound registry or contract state changes before commit
- **THEN** the activation token is rejected and a new dry run is required

#### Scenario: Browser user inspects authority
- **WHEN** an authorized administrator opens the identity registry
- **THEN** the UI reports inactive or initialized status without presenting an activation control

### Requirement: AX Data is outside the AX Online execution boundary
The system SHALL NOT read AX Data files, manifests, environment roots, identity evidence, codes, or runtime state and SHALL NOT retain executable legacy identity import or cutover paths.

#### Scenario: AX Online runs without AX Data
- **WHEN** build, test, deploy, source processing, identity assignment, and authority activation execute
- **THEN** they complete without the AX Data repository or any filesystem path outside AX Online

#### Scenario: Legacy identity influence is attempted
- **WHEN** a caller supplies a historical AX code, manifest, path, binding, or alias
- **THEN** it cannot participate in matching, allocation, conflicts, registry storage, or publication
