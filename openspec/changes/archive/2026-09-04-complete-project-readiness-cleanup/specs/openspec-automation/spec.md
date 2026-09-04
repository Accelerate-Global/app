## ADDED Requirements

### Requirement: CI browser smoke artifacts exclude authenticated diagnostics
The repository SHALL disable trace, screenshot, and video capture for CI UI
smoke and SHALL publish only a bounded sanitized JSON result artifact. Published
results MUST omit browser storage, cookies, page content, request/response
bodies, stdout, stderr, error messages, stack traces, and attachment metadata or
payloads.

#### Scenario: UI smoke runs in CI
- **WHEN** a targeted or full UI smoke suite runs with `CI` set
- **THEN** Playwright disables trace, screenshot, and video capture
- **AND** the workflow uploads only the sanitized JSON result artifact for no more than seven days

#### Scenario: UI smoke runs locally
- **WHEN** a developer runs UI smoke without `CI` set
- **THEN** local HTML, trace, screenshot, and video diagnostics remain available under the repo-owned output paths

#### Scenario: Workflow reintroduces unsafe artifact paths
- **WHEN** repository workflow policy inspects a UI-smoke artifact upload that includes raw Playwright results, HTML output, traces, screenshots, videos, or multiple upload paths
- **THEN** the policy fails with the unsafe workflow and path identified

### Requirement: Sanitized smoke summaries remain diagnostically bounded
The sanitized CI reporter SHALL identify the suite and test title plus bounded
status/count metadata, while treating all runtime messages and attachments as
non-publishable content.

#### Scenario: A browser smoke test fails with errors and attachments
- **WHEN** the reporter receives a failed test containing error details, logs, and diagnostic attachments
- **THEN** the JSON summary records only failure status and numeric error and attachment counts
- **AND** no message, stack, attachment name, path, content type, or body is serialized
