# vercel-analytics-pause Specification

## Purpose
Define the environment-controlled pause behavior for outbound Vercel Web
Analytics collection while preserving the app-owned analytics event store.

## Requirements
### Requirement: Vercel analytics can be paused by environment
The system SHALL treat `NEXT_PUBLIC_VERCEL_ANALYTICS_PAUSED=1` as a pause
switch for outbound Vercel Web Analytics collection, and SHALL treat unset or
other values as active analytics mode.

#### Scenario: Pause flag is enabled
- **WHEN** the application is built with `NEXT_PUBLIC_VERCEL_ANALYTICS_PAUSED=1`
- **THEN** the app does not load the Vercel Web Analytics browser script
- **AND** the app does not send custom product events to Vercel Web Analytics

#### Scenario: Pause flag is unset
- **WHEN** the application is built without `NEXT_PUBLIC_VERCEL_ANALYTICS_PAUSED`
- **THEN** the app preserves the existing Vercel Web Analytics page-view and
  custom-event behavior

#### Scenario: Pause flag has another value
- **WHEN** `NEXT_PUBLIC_VERCEL_ANALYTICS_PAUSED` is present with a value other
  than `1`
- **THEN** the app preserves the existing Vercel Web Analytics page-view and
  custom-event behavior

### Requirement: Internal analytics remain active while Vercel is paused
The system SHALL preserve app-owned analytics event persistence while outbound
Vercel Web Analytics collection is paused.

#### Scenario: Client event is tracked while paused
- **WHEN** a client-side product event is tracked while the Vercel analytics
  pause flag is enabled
- **THEN** the event is submitted to the internal analytics ingestion endpoint
- **AND** the event is not submitted to Vercel Web Analytics

#### Scenario: Server event is tracked while paused
- **WHEN** a server-side analytics event is tracked while the Vercel analytics
  pause flag is enabled
- **THEN** the event is persisted to the internal analytics store
- **AND** the event is not submitted to Vercel Web Analytics
