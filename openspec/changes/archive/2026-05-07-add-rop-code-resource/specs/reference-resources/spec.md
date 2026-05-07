## MODIFIED Requirements

### Requirement: Authenticated users can discover built-in reference resources
The system SHALL provide logged-in users with discoverable built-in reference
resources without exposing admin-only API connection run resources.

#### Scenario: Resources page includes ROP codes
- **WHEN** a signed-in user views the Resources page
- **THEN** the built-in resource list includes the ROP Codes resource
- **AND** the ROP Codes card links to `/dashboard/rop-codes`
- **AND** the card is a direct link without a separate Open resource action
