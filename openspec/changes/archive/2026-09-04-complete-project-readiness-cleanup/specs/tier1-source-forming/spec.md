## ADDED Requirements

### Requirement: Etnopedia prose extraction is structurally plain text
The system SHALL treat Etnopedia wikitext and embedded HTML as untrusted source
content and SHALL emit inert plain text for imported prose fields. Entity
decoding and markup removal MUST NOT allow encoded, nested, or overlapping
delimiters to reconstruct executable HTML.

#### Scenario: Source prose contains encoded or overlapping markup
- **WHEN** an Etnopedia field contains an encoded tag, HTML comment, or overlapping markup delimiter
- **THEN** the parsed value contains no active markup boundary
- **AND** surrounding human-readable text remains normalized for deterministic import
