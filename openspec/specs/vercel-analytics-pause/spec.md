# vercel-analytics-pause Specification

## Purpose
Record that outbound Vercel Web Analytics collection is no longer part of the
application runtime while preserving the app-owned analytics event store.

## Requirements
### Requirement: Client analytics events persist internally
The system SHALL persist client-side product analytics events to the internal
analytics ingestion endpoint and SHALL NOT send those events to Vercel Web
Analytics.

#### Scenario: Client event is tracked
- **WHEN** a client-side product event is tracked
- **THEN** the event is submitted to the internal analytics ingestion endpoint
- **AND** no Vercel Web Analytics event is emitted

### Requirement: Server analytics events persist internally
The system SHALL persist server-side product analytics events to the internal
analytics store and SHALL NOT send those events to Vercel Web Analytics.

#### Scenario: Server event is tracked
- **WHEN** a server-side analytics event is tracked
- **THEN** the event is persisted to the internal analytics store
- **AND** no Vercel Web Analytics event is emitted

### Requirement: Vercel Web Analytics script is not mounted
The system SHALL NOT mount the Vercel Web Analytics browser collector from the
root application layout.

#### Scenario: Application shell renders
- **WHEN** the application root layout renders
- **THEN** it does not include the Vercel Web Analytics collector component
