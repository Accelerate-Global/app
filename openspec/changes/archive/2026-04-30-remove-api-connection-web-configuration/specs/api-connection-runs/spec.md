## ADDED Requirements

### Requirement: API Connections web dashboard omits saved profile configuration
The system SHALL present the admin API Connections page as an operational dashboard for saved API connection records without exposing saved request configuration or web profile creation controls.

#### Scenario: Admin views saved connection without configuration fields
- **WHEN** a dataset admin opens the API Connections page and saved connections exist
- **THEN** the page shows selectable saved connections and operational run controls without showing URL, method, headers, body, response parsing, import configuration, preset, new, save, delete, or profile editing controls

#### Scenario: Admin views empty saved connection list
- **WHEN** a dataset admin opens the API Connections page and no saved connections exist
- **THEN** the page explains that no API connections are available and does not offer a web control to create one

### Requirement: API connection profile writes are unavailable through web HTTP endpoints
The system SHALL keep API connection profile creation, update, and deletion unavailable through the admin web HTTP API while preserving authorized read, run, history, detail, and download behavior.

#### Scenario: Admin attempts web profile creation
- **WHEN** a dataset admin sends a create request to the admin API connection collection endpoint
- **THEN** the system rejects the request without creating a saved API connection

#### Scenario: Admin attempts web profile update or deletion
- **WHEN** a dataset admin sends an update or delete request to an individual admin API connection endpoint
- **THEN** the system rejects the request without changing or deleting the saved API connection

## MODIFIED Requirements

### Requirement: Existing API connection safety controls remain enforced
The system SHALL preserve API connection security and compatibility controls during async execution while treating saved profile definitions as codebase-managed records outside the web UI.

#### Scenario: Secrets and blocked URLs remain protected
- **WHEN** an async run executes
- **THEN** the system uses stored secret headers, redacts secret values from logs/previews/errors, requires safe HTTPS URLs, blocks disallowed networks, enforces redirect limits, enforces response-size limits, and uses the configured timeout

#### Scenario: Existing run behavior remains compatible
- **WHEN** admins test or import saved API connection profiles through the allowed run endpoints
- **THEN** the system preserves existing profile fields, secret-header behavior, and create-or-replace dataset import semantics

## REMOVED Requirements

### Requirement: Admin can start with the IMB People Groups preset
**Reason**: API connection profile configuration and creation are no longer exposed in the web app.
**Migration**: Maintain IMB saved connection records from the codebase or database maintenance flow, then run them from the API Connections dashboard.

### Requirement: Admin can create a Joshua Project PGIC connection from a preset
**Reason**: API connection profile configuration and creation are no longer exposed in the web app.
**Migration**: Maintain Joshua Project saved connection records and secret header values from the codebase or database maintenance flow, then run them from the API Connections dashboard.

### Requirement: Admin can create an Etnopedia connection from a preset
**Reason**: API connection profile configuration and creation are no longer exposed in the web app.
**Migration**: Maintain Etnopedia saved connection records from the codebase or database maintenance flow, then run them from the API Connections dashboard.
