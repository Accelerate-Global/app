## ADDED Requirements

### Requirement: New-dataset onboarding explicitly reviews initial access
The system SHALL show administrators the initial workspace access of every new Google Sheets or CSV dataset before creation while preserving workspace visibility as the authorization source of truth and the current workspace-visible compatibility default.

#### Scenario: Administrator keeps workspace-visible access
- **WHEN** an administrator confirms onboarding with Everyone in the workspace selected
- **THEN** each created dataset is workspace-visible under existing application and RLS access rules
- **AND** its metadata does not contain the system-managed `Private` tag

#### Scenario: Administrator chooses administrators-only access
- **WHEN** an administrator confirms onboarding with Only administrators selected
- **THEN** each created dataset is hidden from non-admin users under existing application and RLS access rules
- **AND** its metadata contains exactly one canonical red `Private` tag

#### Scenario: Legacy creation caller omits access
- **WHEN** an existing authorized creation caller omits initial workspace visibility
- **THEN** the system preserves the existing workspace-visible default

#### Scenario: Non-admin attempts onboarding mutation
- **WHEN** an unauthenticated, `pro`, or `basic` caller attempts to create a dataset or connection through onboarding APIs
- **THEN** the existing `401 Unauthorized` or `403 Forbidden` mutation behavior is preserved
