## MODIFIED Requirements

### Requirement: Client analytics events persist internally
The system SHALL persist client-side product analytics events to the internal analytics ingestion endpoint only for authenticated workspace contexts and SHALL NOT send those events to Vercel Web Analytics.

#### Scenario: Authenticated client event is tracked
- **WHEN** a client-side product event is tracked with an authenticated workspace role
- **THEN** the bounded event is submitted to the authenticated internal analytics ingestion endpoint
- **AND** no Vercel Web Analytics event is emitted

#### Scenario: Anonymous client event is tracked
- **WHEN** a client-side product event is produced before authentication
- **THEN** the browser does not submit the event to an analytics write endpoint
- **AND** no Vercel Web Analytics event is emitted

### Requirement: Vercel Web Analytics script is not mounted
The system SHALL NOT mount or permit the Vercel Web Analytics browser collector from the root application layout or browser Content Security Policy.

#### Scenario: Application shell renders
- **WHEN** the application root layout renders
- **THEN** it does not include the Vercel Web Analytics collector component
- **AND** its Content Security Policy does not allow the Vercel collector script origin
