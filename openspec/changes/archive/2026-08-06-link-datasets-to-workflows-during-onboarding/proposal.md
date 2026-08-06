## Why

Google Sheets onboarding currently creates and imports datasets without letting an administrator identify the durable data workflow that should consume each tab. This leaves supported Tier 1 sources and Tier 2 engagement feeds connected but unconfigured, and the current Tier 2 partner model cannot accurately represent multiple feeds managed by the same organization, such as Final-58 and Final-Sudan under Accelerate.

## What Changes

- Add an optional workflow-linking step to Google Sheets dataset onboarding.
- Let administrators link one selected tab to either Accelerate-owned Tier 1 forming, WCD Tier 1 forming, or a named Tier 2 engagement-feed profile before the initial import starts.
- Collect durable key and tracking-column choices from the reviewed Sheet headers instead of asking administrators to enter opaque JSON.
- Resolve the active Tier 2 engagement-mappings contract on the server and fail without creating a partial workflow link when the required contract is unavailable.
- Permit multiple Tier 2 feed profiles to share one partner/owner key while retaining unique profile keys and exact Sheet-tab identities.
- Present Final-58 and Final-Sudan as distinct Accelerate-managed Tier 2 feeds; do not conflate them with the Accelerate-owned Tier 1 people-groups source.
- Preserve onboarding without a workflow link for ordinary datasets and CSV uploads.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dataset-onboarding`: Google Sheets onboarding can capture and review an optional workflow assignment per selected tab.
- `source-profile-connections`: Tier 1 source-profile bindings can be created as part of connection onboarding using a reviewed stable-key column.
- `tier2-source-forming`: Tier 2 feed profiles can be created during onboarding, and multiple feed profiles may share one partner/owner identity.

## Impact

- UI and API contract: `src/components/dashboard/dataset-onboarding/`, `src/app/api/admin/api-connections/google-sheets/connect/route.ts`, and `src/lib/api-types.ts`.
- Pipeline configuration: `src/lib/api-connections/`, `src/lib/source-profiles/`, and `src/lib/tier2-products/`.
- Supabase: a private-schema migration removes the one-profile-per-partner uniqueness rule while preserving unique profile keys and Sheet-tab identities; browser roles retain no direct access.
- Data integrity: connection and workflow configuration must be committed atomically, with duplicate assignments and invalid columns rejected before import.
- Admin permissions: existing administrator-only onboarding and guarded APIs remain authoritative; no permission expansion is introduced.
- UI smoke: the existing dataset-onboarding page remains registered and its workflow controls require smoke coverage.
- Vercel deployment and authentication behavior are unchanged.
- Brownfield evidence: current contracts are documented in `openspec/specs/dataset-onboarding/spec.md`, `openspec/specs/source-profile-connections/spec.md`, `openspec/specs/tier2-source-forming/spec.md`, and `docs/data-pipeline/operator-runbook.md`.

Non-goals: automatically guessing a workflow from dataset names; automatically publishing formed, identity, or release products; changing CSV onboarding; or storing provider credentials in source code or browser-visible configuration.
