## ADDED Requirements

### Requirement: Admin can create an Etnopedia connection from a preset
The system SHALL provide an admin-only Etnopedia setup option that pre-fills the saved API connection fields needed to fetch Etnopedia people-group data.

#### Scenario: Admin applies the preset
- **WHEN** a dataset admin chooses the `Etnopedia` setup option on the API Connections page
- **THEN** the form uses `GET`, targets `https://en.etnopedia.org/api.php`, sets JSON response handling, sets PGIC dataset classification, and uses an Etnopedia dataset filename

#### Scenario: Existing admin authorization remains unchanged
- **WHEN** an unauthenticated user or non-admin user attempts to create, update, or run the saved Etnopedia connection
- **THEN** the system rejects the request using the existing API connection admin authorization behavior

### Requirement: Etnopedia runs execute the MediaWiki export flow
The system SHALL run Etnopedia API connections by listing people-group category members, fetching main and talk page revisions in batches, and recording progress through the existing API connection run lifecycle.

#### Scenario: Admin runs an Etnopedia connection
- **WHEN** a dataset admin starts an Etnopedia API connection run
- **THEN** the system fetches `Category:Peoples_by_name`, retrieves main and `Talk:` revisions for each title, records progress logs, and completes with normal run status, row count, output metadata, and archived downloads

#### Scenario: Etnopedia request fails
- **WHEN** an Etnopedia category or revision request fails, returns invalid JSON, or returns an upstream error
- **THEN** the system records a failed API connection run with an error log and does not create or replace an imported dataset

### Requirement: Etnopedia output matches the proven export shape
The system SHALL normalize Etnopedia people-group data into the script-compatible CSV columns and preserve structured records in the JSON output artifact.

#### Scenario: CSV output uses script columns
- **WHEN** an Etnopedia run succeeds
- **THEN** the normalized rows include the script-compatible fields for provenance, main-page attributes, map data, references, body sections, talk-page IDs, and progress indicators

#### Scenario: Structured JSON remains inspectable
- **WHEN** an Etnopedia run succeeds
- **THEN** the archived JSON output includes structured records with `urls`, `provenance`, `main`, and `talk` objects for each people-group title

#### Scenario: Existing generic parsers remain compatible
- **WHEN** a non-Etnopedia API connection run parses JSON or CSV
- **THEN** the system uses the existing generic parsing behavior and does not apply Etnopedia MediaWiki fetching or wikitext parsing
