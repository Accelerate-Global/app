## MODIFIED Requirements

### Requirement: Admin can download outputs as JSON or CSV
The system SHALL allow dataset admins to download a run output as JSON or CSV while preserving the configured encoding behavior and neutralizing spreadsheet formulas in CSV output.

#### Scenario: JSON download
- **WHEN** a dataset admin downloads a run output as JSON
- **THEN** the response uses `application/json; charset=utf-8` and contains the redacted raw response artifact without a UTF-8 BOM

#### Scenario: CSV download
- **WHEN** a dataset admin downloads a run output as CSV
- **THEN** the response uses `text/csv; charset=utf-8`, includes a UTF-8 BOM, uses CRLF line endings, serializes the normalized rows and columns, and prefixes formula-leading cells so spreadsheet software treats them as text

#### Scenario: Non-admin cannot download output
- **WHEN** an unauthenticated user or non-admin user attempts to download an API connection run output
- **THEN** the system rejects the request and does not expose the artifact

## ADDED Requirements

### Requirement: API connection import snapshots neutralize spreadsheet formulas
The system SHALL store API connection import snapshots as CSV files that do not
preserve executable spreadsheet formula cells.

#### Scenario: Imported rows contain formula-leading values
- **WHEN** an API connection import creates or replaces a dataset from upstream
  rows containing a value whose first non-space character is `=`, `+`, `-`,
  `@`, tab, carriage return, or newline
- **THEN** the stored import snapshot CSV prefixes that value with an
  apostrophe before dataset storage

#### Scenario: Imported rows contain ordinary values
- **WHEN** an API connection import creates or replaces a dataset from ordinary
  row values
- **THEN** the stored import snapshot preserves the existing column order and
  CSV row structure
