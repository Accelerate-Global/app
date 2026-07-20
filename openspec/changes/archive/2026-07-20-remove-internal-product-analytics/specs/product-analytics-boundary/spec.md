## ADDED Requirements

### Requirement: Application does not collect custom product analytics
The system SHALL NOT emit, ingest, or persist custom product analytics events
from browser or server workflows.

#### Scenario: User completes an application action
- **WHEN** a user signs in, changes account settings, manages users, browses or
  filters datasets, imports data, or edits definitions
- **THEN** the action completes without submitting a product analytics request
- **AND** no custom product event is persisted

#### Scenario: Application serves API routes
- **WHEN** the deployed application route inventory is inspected
- **THEN** `/api/analytics/events` is absent
- **AND** no replacement product-analytics ingestion endpoint is present

### Requirement: Operational and authentication records remain available
The system SHALL preserve explicit operational records and Supabase Auth sign-in
recency that are required to administer and diagnose the application.

#### Scenario: Administrator reviews user recency
- **WHEN** an administrator opens User Management
- **THEN** Last sign-in continues to reflect Supabase Auth's successful sign-in timestamp
- **AND** the application does not infer broader activity or visit frequency

#### Scenario: Administrator diagnoses a workflow
- **WHEN** an administrator reviews connection runs, imports, or dataset history
- **THEN** domain-owned run logs, statuses, outputs, and dataset versions remain available
- **AND** normalized application errors remain available through runtime logging

### Requirement: Product analytics storage is removed
The system SHALL remove the private product analytics and failure-triage tables
through a forward database migration without rewriting historical migrations.

#### Scenario: Migrations are applied to a current or clean database
- **WHEN** the analytics-removal migration completes
- **THEN** `private.analytics_events` does not exist
- **AND** `private.analytics_failure_triage` does not exist
- **AND** unrelated authentication, dataset, resource, and connection data remains intact

### Requirement: Retired Analytics URL remains compatible
The system SHALL keep the retired Analytics dashboard URL as a redirect without
restoring an analytics navigation destination or analytics runtime.

#### Scenario: Administrator opens an old Analytics bookmark
- **WHEN** an administrator opens `/dashboard/analytics`
- **THEN** the application redirects to `/dashboard/user-management`
- **AND** the account menu does not show an Analytics destination

### Requirement: Vercel product analytics collector remains absent
The system SHALL NOT mount or permit the Vercel Web Analytics browser collector
and SHALL retain runtime logs as the deployment diagnostic source.

#### Scenario: Application shell renders
- **WHEN** the application root layout and Content Security Policy are inspected
- **THEN** no Vercel Web Analytics collector component or script origin is present
- **AND** application failures can still be diagnosed through normalized runtime logs
