## ADDED Requirements

### Requirement: Imported country names remain inert after entity decoding
The system SHALL convert imported M49 and legacy FIPS country-name cells to
normalized plain text. It MUST decode at most the intended source entity layer,
MUST decode ampersands last, and MUST remove markup structurally so a sanitizer
cannot reconstruct an active tag.

#### Scenario: Country name contains encoded or nested markup
- **WHEN** a provider cell contains encoded tags, nested delimiters, or an entity encoded through an ampersand
- **THEN** the normalized country name contains no executable markup boundary
- **AND** a multiply encoded entity remains encoded after one decoding pass
