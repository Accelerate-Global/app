## ADDED Requirements

### Requirement: Fast validation is advisory

The repository SHALL provide a documented fast local validation command for early inner-loop feedback, and that command MUST NOT replace required terminal verification, CI gates, UI smoke, database security, or release gates.

#### Scenario: Developer runs fast validation while coding

- **WHEN** a developer runs the repo-owned fast validation command
- **THEN** the command performs early TypeScript, lint, and durable test feedback without running slower build, browser, database, or release gates
- **AND** the result is advisory rather than a durable terminal verification receipt

#### Scenario: Developer finalizes a tracked change

- **WHEN** a developer finalizes a tracked change after fast validation passes
- **THEN** the required commands selected by `pnpm run verify:change` and the terminal `pnpm run verify:change:run` gate remain authoritative

### Requirement: Blocked experimental preflight remains non-authoritative

The repository SHALL document when an experimental local preflight command is blocked by tooling reliability, and that command MUST NOT be used as pass/fail evidence until a safe retest exits cleanly.

#### Scenario: Expect.dev run-completion is blocked

- **WHEN** the local Expect.dev preflight is blocked by a run-completion timeout
- **THEN** documentation and agent instructions identify it as local-only experimental tooling rather than reliable validation
- **AND** existing durable tests, local terminal gates, and CI gates remain the source of validation confidence
