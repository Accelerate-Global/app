## Why

Final-58 and Final-Sudan already exist as ordinary Google Sheets connections, but the application only offers workflow linking while creating a new connection. Administrators need a safe way to attach an existing dataset to the reviewed Tier 1 or Tier 2 forming workflow without recreating the dataset, losing run history, or accidentally starting forming, publication, schedules, or identity allocation.

## What Changes

- Add an administrator-only workflow assignment control to an existing Google Sheets connection.
- Reuse the onboarding workflow contract and server validation for unlinked, Tier 1, and Tier 2 assignments.
- Create the requested private binding/profile and update dataset classification in one transaction while preserving the existing connection, dataset, and run history.
- Show the active workflow and make completed assignments read-only; conflicting or incomplete assignments fail without partial state.
- Support reviewed Tier 2 profile fields needed to configure Final-58 and Final-Sudan after their source columns have been profiled and approved.
- Keep assignment separate from ingestion, forming, publication, schedules, and AX identity authority.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `source-profile-connections`: Allow an administrator to attach an existing active Google Sheets connection to one exact workflow atomically, using stable Sheet identity and reviewed fields.
- `tier2-source-forming`: Allow an existing ordinary Google Sheets connection to receive an exact Tier 2 feed profile without recreating or importing the connection.

## Impact

- Affects the existing connection detail UI, its administrator API contract, workflow-assignment validation, and transactional Supabase writes for private Tier 1/Tier 2 profiles and public dataset classification.
- Preserves the current authentication and administrator permission model; no new roles or browser access to private tables are introduced.
- Adds or updates UI smoke coverage for the connection workflow control and focused API/component/database tests.
- Does not change Vercel configuration, enable schedules, publish formed datasets, allocate AX identities, switch identity authority, or shut down legacy writers.
- Brownfield evidence: onboarding assignments currently live in `src/lib/api-connections/onboarding-workflows.ts`; existing Tier 1 binding mutations live in `src/app/api/admin/api-connections/[connectionId]/source-profile/route.ts`; Tier 2 profiles live in `src/lib/tier2-products/profiles.ts` and `src/lib/tier2-products/admin.ts`.
