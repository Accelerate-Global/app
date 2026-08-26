## ADDED Requirements

### Requirement: Every official ISO3 is representable

The system MUST include exactly one same-origin visual feature for every official ISO3 code in the repository country catalog. A feature MAY be a country polygon or, when the lightweight polygon source omits that code, a point marker. ISO3 MUST remain authoritative over conflicting country-name text.

#### Scenario: Dataset row contains an official ISO3

- **WHEN** a filtered row contains any official ISO3 from the repository country catalog
- **THEN** the row resolves to the bundled feature with that exact ISO3
- **AND** a conflicting country-name value does not redirect it to another feature

#### Scenario: Official ISO3 has no lightweight polygon

- **WHEN** the 1:110m polygon source omits an official ISO3
- **THEN** the bundled asset contains a labeled point marker for that ISO3
- **AND** the marker uses the same matching-record count, selection, search, and accessible keyboard behavior as a polygon

#### Scenario: Maintainer verifies boundary coverage

- **WHEN** the checked-in map asset is validated against the repository country catalog
- **THEN** all official ISO3 codes are present exactly once
- **AND** no runtime third-party request is required to render either polygons or points
