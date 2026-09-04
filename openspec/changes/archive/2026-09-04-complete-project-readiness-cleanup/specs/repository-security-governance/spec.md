## ADDED Requirements

### Requirement: Public repository security reporting is explicit
The canonical public repository SHALL publish its usage-rights notice and a
security policy that directs vulnerability reports through a private provider
channel without requesting public disclosure or secrets in issues.

#### Scenario: External reviewer finds a vulnerability
- **WHEN** a reviewer opens the repository security guidance
- **THEN** the reviewer is directed to GitHub private vulnerability reporting or the authorized organization contact
- **AND** the guidance prohibits placing credentials, private data, or exploit details in a public issue

### Requirement: Available repository security controls are enabled
The canonical repository SHALL enable secret scanning, push protection, private
vulnerability reporting, CodeQL default setup, SHA-pinned Actions enforcement, and strict required
checks on `main`. Administrators MUST be subject to the required checks and
force-push or deletion protection.

#### Scenario: A maintainer proposes a change to main
- **WHEN** the change is eligible to merge
- **THEN** all release-critical checks are current and successful
- **AND** admin status does not bypass those checks

#### Scenario: A pushed commit contains a recognized secret
- **WHEN** GitHub push protection identifies supported credential material
- **THEN** the push is blocked or requires the provider's explicit audited bypass flow

### Requirement: Published automation artifacts have bounded retention
Repository Actions settings SHALL retain artifacts and logs for no more than
seven days, and workflows that need a shorter period MUST declare it explicitly.

#### Scenario: Workflow publishes a permitted result artifact
- **WHEN** an Actions run uploads its sanitized result
- **THEN** the artifact expires within seven days

### Requirement: Historical repository state is read-only
The former private repository SHALL remain available only as an archived
historical record and MUST NOT continue accepting dependency updates, branches,
pull requests, or releases for the supported product.

#### Scenario: Automation targets the former repository
- **WHEN** a bot or contributor attempts to create supported project work there
- **THEN** the archived repository rejects mutation and directs current work to the canonical repository

### Requirement: Merged development refs are retired automatically
The canonical repository SHALL delete merged head branches automatically, and
local cleanup SHALL remove only refs whose content is merged, patch-equivalent,
superseded by a merged revision, or explicitly preserved elsewhere.

#### Scenario: A pull request is merged
- **WHEN** GitHub completes the merge
- **THEN** the remote head branch is deleted automatically

#### Scenario: Local cleanup encounters unique work
- **WHEN** a branch, worktree, or stash contains content not represented by canonical history
- **THEN** that content is preserved in a recoverable commit before the original ref is removed
