## ADDED Requirements

### Requirement: Repository-owned actions use a supported runner runtime

Repository-owned GitHub workflows and composite actions MUST reference official
remote action releases that declare a GitHub-supported JavaScript runtime, and
every remote reference MUST remain pinned to its immutable full commit SHA.

#### Scenario: GitHub retires an action runtime

- **WHEN** GitHub warns that a pinned remote action declares a deprecated runner
  runtime
- **THEN** the repository refreshes that action to an official supported-runtime
  release before the compatibility fallback is removed
- **AND** the updated reference remains pinned to a full commit SHA

#### Scenario: Workflow behavior is unchanged by a runtime pin refresh

- **WHEN** an action wrapper is refreshed solely for runner-runtime compatibility
- **THEN** existing workflow inputs, permissions, triggers, tool versions, and
  published artifact boundaries remain unchanged

#### Scenario: Refreshed actions run on GitHub-hosted runners

- **WHEN** the pull-request workflows execute after a runtime pin refresh
- **THEN** every required repository-owned check passes without a deprecated
  action-runtime annotation
