## ADDED Requirements

### Requirement: Joshua Project PGIC runs retrieve complete output through bounded pagination
The system SHALL retrieve Joshua Project people-group records through ordered, bounded upstream pages while preserving the existing complete output, resource flattening, secret handling, and all-or-nothing run lifecycle.

#### Scenario: Complete paginated run succeeds
- **WHEN** a dataset administrator starts a Joshua Project PGIC test or import run and the upstream service returns one or more valid pages followed by a short terminal page
- **THEN** the system requests pages in ascending page order with bounded page sizes
- **AND** completes the run with every returned record in upstream page order
- **AND** preserves profile text, resource fields, normalized rows, and downloadable raw output

#### Scenario: Page progress is observable
- **WHEN** a Joshua Project PGIC run retrieves an upstream page
- **THEN** the persisted run log records that page's row count and the cumulative row count without exposing the stored API key

#### Scenario: Upstream page fails
- **WHEN** any Joshua Project page times out, returns a non-success status, returns an invalid response shape, repeats a non-empty prior page, or exceeds a configured page, byte, or aggregate bound
- **THEN** the run fails with a normalized error
- **AND** does not publish partial output, resources, formed candidates, or dataset changes

#### Scenario: Other HTTP providers retain existing limits
- **WHEN** a non-Joshua generic HTTP, ArcGIS, or Etnopedia connection runs
- **THEN** the system preserves that provider's existing request, response-size, parsing, and pagination behavior

## MODIFIED Requirements

### Requirement: Joshua Project PGIC runs send the stored key as an upstream query parameter
The system SHALL translate the stored `api_key` secret into the Joshua Project upstream query parameter for every paginated Joshua Project people-groups request while preserving existing API connection safety controls and secret redaction.

#### Scenario: Stored key is appended at run time
- **WHEN** a saved Joshua Project PGIC connection with a stored `api_key` secret runs
- **THEN** every upstream page request includes `api_key` as a query parameter and does not send that secret as a normal request header

#### Scenario: Secret remains redacted
- **WHEN** a Joshua Project PGIC run completes or fails
- **THEN** run logs, response previews, raw output artifacts, and saved connection URLs do not expose the stored API key
