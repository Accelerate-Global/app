## ADDED Requirements

### Requirement: Pipeline administration uses canonical authenticated navigation and naming
The system SHALL present the administrator pipeline destination with the canonical visible name `Pipelines` and SHALL include the shared authenticated site header and account navigation used by peer administrator pages.

#### Scenario: Administrator opens the Pipelines page
- **WHEN** an authenticated administrator opens `/admin/pipeline-operations`
- **THEN** the page heading is `Pipelines`
- **AND** the shared authenticated site header exposes the administrator's account navigation
- **AND** the existing pipeline controls and route-specific smoke identity remain available

#### Scenario: Non-administrator opens the pipeline destination
- **WHEN** an unauthenticated or non-administrator user opens `/admin/pipeline-operations`
- **THEN** the existing authorization redirect behavior remains unchanged
