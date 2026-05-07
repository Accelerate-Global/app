## ADDED Requirements

### Requirement: Country-code resource includes official UN names linked to ISO3
The system SHALL enrich country and territory resource entries with official
UNTERM English short names and any provided formal names when those names can
be linked to an ISO-alpha3 code through UNSD M49.

#### Scenario: Refresh links UNTERM names through M49
- **WHEN** an admin refreshes the country and territory resource and UNTERM and
  M49 sources return valid data
- **THEN** entries whose ISO3 code matches the M49 bridge include the UNTERM
  English short name, any provided UNTERM English formal name, and a UNTERM/M49
  source marker
- **AND** entries without a bridgeable UNTERM row keep null official-name fields

#### Scenario: Official names remain separate from curated aliases
- **WHEN** a refreshed entry has official UNTERM names and curated alternate
  names
- **THEN** the official UNTERM names are exposed in dedicated fields
- **AND** the curated alternate-name list remains editable only through the
  existing admin alternate-name workflow

#### Scenario: Official-name source is unavailable
- **WHEN** UNTERM or M49 returns malformed data or cannot be parsed
- **THEN** the refresh fails without replacing the currently visible generated
  resource

### Requirement: Country-code UI exposes official UN names
The system SHALL show official UNTERM English short names and any provided
formal names as read-only source fields in the country and territory resource.

#### Scenario: User opens a bridged entry
- **WHEN** a signed-in user opens a country or territory detail sheet for an
  entry with bridged UNTERM names
- **THEN** the sheet shows the official UN short name and official UN formal
  name separately from alternate names

#### Scenario: User searches official names
- **WHEN** a signed-in user searches by an official UNTERM short or formal name
- **THEN** matching country and territory rows remain visible in the resource
  table

#### Scenario: User downloads resource rows
- **WHEN** a signed-in user downloads visible country and territory rows
- **THEN** the CSV includes the official UN short name, official UN formal name,
  and official-name source fields
