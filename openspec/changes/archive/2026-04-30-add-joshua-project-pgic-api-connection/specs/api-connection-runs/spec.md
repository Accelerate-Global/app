## ADDED Requirements

### Requirement: Admin can create a Joshua Project PGIC connection from a preset
The system SHALL provide an admin-only Joshua Project (PGIC) setup option that pre-fills the saved API connection fields needed to fetch Joshua Project people-group data while requiring the API key to be entered as a stored secret.

#### Scenario: Admin applies the preset
- **WHEN** a dataset admin chooses the Joshua Project (PGIC) setup option on the API Connections page
- **THEN** the form uses `GET`, targets the Joshua Project people-groups endpoint with `include_profile_text=Y`, `include_resources=Y`, `page=1`, and `limit=100000`, sets JSON response handling, sets PGIC dataset classification, and includes a secret `api_key` field without a committed value

#### Scenario: Preset key is not exposed in tracked code
- **WHEN** the Joshua Project preset is rendered in the browser
- **THEN** the provided API key is not present in client source, saved connection URLs, or preset defaults, and the admin must save it through the existing secret field flow

### Requirement: Joshua Project PGIC runs send the stored key as an upstream query parameter
The system SHALL translate the stored `api_key` secret into the Joshua Project upstream query parameter for Joshua Project people-groups runs while preserving existing API connection safety controls and secret redaction.

#### Scenario: Stored key is appended at run time
- **WHEN** a saved Joshua Project PGIC connection with a stored `api_key` secret runs
- **THEN** the upstream request includes `api_key` as a query parameter and does not send that secret as a normal request header

#### Scenario: Secret remains redacted
- **WHEN** a Joshua Project PGIC run completes or fails
- **THEN** run logs, response previews, raw output artifacts, and saved connection URLs do not expose the stored API key

### Requirement: Joshua Project PGIC output matches script-compatible resource flattening
The system SHALL parse Joshua Project people-group JSON responses into import rows that preserve top-level fields and flatten `Resources` into indexed resource columns while retaining the raw resource payload.

#### Scenario: Resources are flattened
- **WHEN** the Joshua Project response includes a people-group record with `Resources`
- **THEN** the parsed rows include `Resource_01_ROL3`, `Resource_01_Category`, `Resource_01_WebText`, `Resource_01_URL`, subsequent indexed resource columns as needed, and `Resources_raw`

#### Scenario: Existing generic parsers remain compatible
- **WHEN** a non-Joshua API connection run parses JSON or CSV
- **THEN** the system uses the existing generic parsing behavior and does not apply Joshua Project resource flattening
