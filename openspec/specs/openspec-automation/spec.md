# openspec-automation Specification

## Purpose
Define the repository automation contract that makes OpenSpec validation,
archive readiness, CI checks, and ship gates mandatory for tracked changes.
## Requirements
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

### Requirement: Expect.dev preflight is local-only and advisory

The repository SHALL provide a local Expect.dev preflight command for changed browser-facing work, and that command MUST NOT be required by CI, ship, or PR merge gates during the pilot.

#### Scenario: Developer runs local Expect.dev preflight

- **WHEN** a developer runs the repo-owned Expect.dev preflight command
- **THEN** the command runs against the current git changes with Codex as the default agent and a local dev-server URL as the default target
- **AND** the result is advisory local QA rather than a durable test receipt or CI requirement

#### Scenario: Pull request workflows run

- **WHEN** pull request workflows evaluate a change
- **THEN** Expect.dev is not required as a blocking workflow or release-critical check

### Requirement: Expect.dev production auth checks are constrained

The repository SHALL treat Expect.dev authenticated checks as production-sensitive when the connected Supabase project is production, and local preflight defaults MUST avoid cookie extraction unless the developer explicitly opts into read-only authenticated checks.

#### Scenario: Local preflight runs with default settings

- **WHEN** the Expect.dev preflight command runs without explicit cookie opt-in
- **THEN** it skips browser cookie extraction and prefers unauthenticated or read-only checks

#### Scenario: A route requires mutation to verify

- **WHEN** an Expect.dev pilot check would need to create, update, delete, invite, publish, revoke, reset, or otherwise mutate production data
- **THEN** that route or flow is documented as not safe for Expect.dev Phase 1 instead of being exercised

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
