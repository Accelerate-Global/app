## ADDED Requirements

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
