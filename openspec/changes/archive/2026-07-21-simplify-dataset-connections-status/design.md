## Context

The Connections index renders its catalog in `ApiConnectionsClient`, while the detail route maps the persisted latest run status to a user-facing header badge. The persisted status enum is operationally meaningful and must remain unchanged; only the presentation is being simplified.

## Goals / Non-Goals

**Goals:**

- Make the catalog title describe what users are browsing.
- Remove the catalog-level onboarding action without deleting the underlying workflow.
- Use a present-state label for a connection whose latest run succeeded.
- Preserve accessible row navigation and all existing run operations.

**Non-Goals:**

- Add continuous connectivity monitoring or claim a live provider health check.
- Change run status values, database records, APIs, Supabase configuration, permissions, or deployment behavior.
- Remove the Google Sheets connection route.

## Decisions

- Map persisted `success` to `Up to date` only in the connection detail header. This reassures users about the currently displayed dataset state without falsely claiming that the external provider is continuously healthy. `Healthy` was considered but rejected because no live health probe exists.
- Remove the Add connection link and its now-unused icon/button imports from the index component. Preserve the underlying onboarding route for other flows.
- Change an empty catalog to the neutral text `No datasets are connected.` so it does not direct users toward the removed action.
- Keep the existing smoke page markers and route registry entries because no route or interactive smoke surface is added or removed.

## Risks / Trade-offs

- [Risk] A source can become unavailable after its last successful run while the badge still says `Up to date`. → Mitigation: the badge explicitly represents the latest persisted run, and run history remains visible for timing and failures.
- [Risk] Removing the index action reduces discoverability of connection onboarding. → Mitigation: this is intentional product simplification; the underlying workflow remains available to existing entry points and can be restored without data migration.
