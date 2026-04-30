## MODIFIED Requirements

### Requirement: Agent final summaries close executable work first
The repository SHALL require agents to resolve their own agent-executable open
items and next steps before finalizing a work session, and SHALL treat a draft
final summary containing available executable work as an incomplete closure loop.

#### Scenario: Agent can perform a listed open item
- **WHEN** an agent's draft final summary includes an `Open Items` entry that
  describes work the agent can complete without new user input
- **THEN** the agent performs that work before finalizing
- **AND** omits that entry from the final `Open Items` section

#### Scenario: Agent can perform a listed next step
- **WHEN** an agent's draft final summary includes a `Next Step` entry for an
  executable command, fix, cleanup, verification rerun, repo change, migration
  push authorized by the user's implementation or release request, or local
  service restart
- **THEN** the agent performs that work before finalizing
- **AND** omits that entry from the final `Next Step` section

#### Scenario: Work is genuinely blocked
- **WHEN** a remaining item requires user input, external access, unavailable
  services, failed verification resolution, destructive or production-mutating
  authorization that the user has not already granted, or scope that the user
  explicitly deferred
- **THEN** the agent may include that item as an `Open Items` blocker or as a
  single user-owned `Next Step`

#### Scenario: No user-owned action remains
- **WHEN** no immediate user-owned action or decision remains after the closure
  loop
- **THEN** the agent omits the `Next Step` section
