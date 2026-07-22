## MODIFIED Requirements

### Requirement: IMB field formation uses the approved versioned contract
The system SHALL project IMB source rows through an ordered immutable field contract that records its version and checksum and includes the approved written-scripture mapping plus provenance fields. Source rows produced from the current IMB production schema SHALL pass through the approved source adapter whose version and checksum are recorded in the archived rows artifact without changing the version-1 formed output contract.

#### Scenario: Known IMB schema is formed
- **WHEN** all required version-1 source fields are present directly or through the approved replacement-source adapter
- **THEN** the candidate uses the contract's canonical output names and order
- **AND** maps `Bible` to `Resources_Written_Scripture`
- **AND** includes `Data_Source`, `Dataset_ID`, `Dataset_Row_ID`, and `Dataset_Row_Key`

#### Scenario: Required source field is absent
- **WHEN** the source artifact omits a field marked required by the pinned contract
- **THEN** the system records a blocking schema finding and marks the candidate invalid

#### Scenario: Additional source field appears
- **WHEN** IMB supplies a field not included in the pinned output contract
- **THEN** the raw artifact preserves it
- **AND** the formed candidate records schema drift without silently adding an unversioned output field

#### Scenario: Replacement source omits a discontinued optional field
- **WHEN** the replacement IMB schema has no trustworthy equivalent for an optional legacy source field
- **THEN** the adapter leaves that legacy source field blank
- **AND** does not invent or derive an unapproved value
