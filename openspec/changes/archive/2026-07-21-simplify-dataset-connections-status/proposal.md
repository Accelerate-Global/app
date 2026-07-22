## Why

The Connections page currently uses source-oriented language and exposes an onboarding action that is not needed in the operational dataset list. The connection detail badge also says `Success`, which describes a past run rather than reassuring the user about the dataset's current displayed state.

## What Changes

- Rename the Connections page card from `Dataset sources` to `Datasets`.
- Remove the `Add connection` action from that card and remove onboarding language from its empty state.
- Display the latest successful run as `Up to date` on connection detail pages while preserving the underlying `success` run state and all other run-state labels.
- Update focused component tests and existing UI smoke expectations for the revised labels.
- Non-goals: remove the underlying Google Sheets connection workflow, change run persistence, add live health monitoring, alter auth or admin permissions, change Supabase data, or change APIs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `api-connection-runs`: Simplify the operational Connections catalog and present successful latest-run state as `Up to date` on connection detail pages.

## Impact

- UI: `src/components/dashboard/api-connections-client.tsx` and `src/app/dashboard/api-connections/[connectionId]/page.tsx`.
- Tests: corresponding same-stem tests and any matching smoke assertions under `tests/ui`.
- Specifications: `openspec/specs/api-connection-runs/spec.md` after the delta is verified and archived.
- No auth, permission, data-integrity, Supabase, Vercel, dependency, or API-contract changes. Existing smoke-tracked routes remain in place; only their visible labels change.
