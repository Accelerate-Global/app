## MODIFIED Requirements

### Requirement: Resource changes expose pipeline impact
The system SHALL identify pipeline definitions and recent candidates or publications that bind a superseded resource or contract version without automatically rebuilding or republishing them, and SHALL expose that impact on the exact selected resource’s detail view.

#### Scenario: New resource version activates
- **WHEN** an administrator activates a valid resource version
- **THEN** the resource detail can report registered engines that require that resource and recent outputs built with older bindings
- **AND** existing candidates and publications remain unchanged until an administrator starts and approves a new build

#### Scenario: User opens a resource impact summary
- **WHEN** an authenticated user selects a catalog-backed resource from Connections or the Resources index
- **THEN** the system opens that resource’s canonical detail view
- **AND** displays the engines affected by its active version without changing any pipeline binding
