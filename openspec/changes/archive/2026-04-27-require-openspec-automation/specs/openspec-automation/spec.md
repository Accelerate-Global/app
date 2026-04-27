## ADDED Requirements

### Requirement: OpenSpec validation is required for tracked changes

Every non-empty repo-tracked change set MUST require OpenSpec validation as part
of local verification planning.

#### Scenario: A developer changes a tracked file

- **WHEN** `pnpm run verify:change` analyzes a non-empty tracked change set
- **THEN** the required commands include `pnpm run spec:validate`

### Requirement: OpenSpec helper commands are repo-owned

The repository MUST provide package scripts for OpenSpec validation, status,
archive, and archive-readiness checks.

#### Scenario: A developer validates OpenSpec

- **WHEN** a developer runs `pnpm run spec:validate`
- **THEN** all OpenSpec changes and durable specs are validated in strict
  noninteractive mode

#### Scenario: A developer archives a completed change

- **WHEN** a developer runs `pnpm run spec:archive -- <change-id>`
- **THEN** the OpenSpec CLI archives that change and validates the resulting
  OpenSpec tree

### Requirement: Active OpenSpec changes block ship

Release gates MUST fail when active unarchived OpenSpec changes remain under
`openspec/changes/*`.

#### Scenario: Ship-local runs with an active OpenSpec change

- **WHEN** `pnpm run verify:ship:local` runs and an active OpenSpec change exists
- **THEN** the command fails before recording a ship-local receipt

#### Scenario: Ship runs with an active OpenSpec change

- **WHEN** `pnpm ship --pr <number>` starts and an active OpenSpec change exists
- **THEN** ship fails before merge work begins

### Requirement: OpenSpec is checked in CI

Pull requests MUST run an OpenSpec workflow that validates OpenSpec artifacts and
fails when completed changes have not been archived.

#### Scenario: A pull request has an unarchived OpenSpec change

- **WHEN** the `OpenSpec` workflow runs
- **THEN** archive readiness fails and the pull request is not release-ready

### Requirement: Ship waits for OpenSpec

The ship workflow MUST wait for the pull request `OpenSpec` check before merging.

#### Scenario: Ship waits for pull-request checks

- **WHEN** `pnpm ship --pr <number>` waits for required checks
- **THEN** `OpenSpec` is included with the release-critical workflow names
