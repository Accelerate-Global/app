## ADDED Requirements

### Requirement: ISO3 country-code resource appears in API Connections Resources
The system SHALL show the ISO3 country-code lookup as a built-in reference
resource in the API Connections Resources area.

#### Scenario: Admin views API Connections resources
- **WHEN** a dataset admin opens the API Connections page
- **THEN** the Resources area includes the ISO3 country-code lookup with a link
  to the authenticated country-code resource page

#### Scenario: No API-run resources exist
- **WHEN** the API Connections page has no captured API-run resources
- **THEN** the ISO3 country-code lookup remains visible and the empty state only
  describes missing captured resources
