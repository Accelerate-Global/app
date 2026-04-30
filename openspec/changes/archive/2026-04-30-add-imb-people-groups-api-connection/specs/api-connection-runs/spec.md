## ADDED Requirements

### Requirement: API connection runs support ArcGIS FeatureServer features
The system SHALL allow dataset admins to configure a saved JSON API connection for ArcGIS FeatureServer feature query endpoints and run that connection through the existing admin-only API connection lifecycle.

#### Scenario: Admin saves ArcGIS feature connection
- **WHEN** a dataset admin saves an API connection for a FeatureServer query endpoint with JSON response format and `features` response path
- **THEN** the system accepts the connection profile using the existing JSON response format

#### Scenario: Admin runs paged ArcGIS feature connection
- **WHEN** a dataset admin runs a matching ArcGIS FeatureServer JSON `features` API connection
- **THEN** the system fetches all available pages from the FeatureServer query endpoint and records normal run status, logs, row count, output metadata, and archived downloads

#### Scenario: Non-admin cannot run ArcGIS feature connection
- **WHEN** an unauthenticated user or non-admin user attempts to create, update, or run an ArcGIS features API connection
- **THEN** the system rejects the request using the existing API connection admin authorization behavior

### Requirement: ArcGIS feature rows use IMB-compatible flattening
The system SHALL normalize ArcGIS feature rows by preserving all feature attribute keys as columns and flattening geometry keys into `geometry_*` columns in first-seen order.

#### Scenario: Feature attributes and geometry are flattened
- **WHEN** an ArcGIS FeatureServer response contains features with `attributes` and `geometry`
- **THEN** the normalized rows include every attribute key, include geometry values under `geometry_*` column names, and preserve scalar values as strings for dataset import and CSV download

#### Scenario: Raw ArcGIS output remains inspectable
- **WHEN** an ArcGIS features run succeeds
- **THEN** the archived JSON output includes the raw feature list used for normalization without exposing secret header values

### Requirement: Admin can start with the IMB People Groups preset
The system SHALL provide an admin UI preset for the public IMB People Groups ArcGIS layer so admins can create the saved connection without manually translating the working script into app fields.

#### Scenario: Admin applies IMB preset
- **WHEN** a dataset admin applies the `IMB (People Groups)` preset on the API Connections page
- **THEN** the connection form is populated with the public IMB FeatureServer query endpoint, JSON `features` response path, create-dataset import settings, `imb-people-groups.csv`, and PGIC classification
