## Why

Adding a source dataset is split between a dense Google Sheets form on the API Connections page and a separate one-step CSV uploader, so administrators must infer the sequence, privacy outcome, and post-connection import step. A unified guided workflow is needed now that service-account Sheets, header detection, editable dataset visibility, and partner exports are all available but do not form a coherent first-use journey.

## What Changes

- Add an administrator-only `/dashboard/datasets/new` workflow that guides source choice, source access or file selection, structure review, dataset details, import, and completion.
- Support Google Sheets and CSV as the initial source choices while keeping generic API profiles code-managed.
- Reuse automatic Google Sheets header detection and require expanded review only for low-confidence results or explicit administrator review, including one-to-three combined header rows.
- Let administrators review and edit each new dataset name, classification, and workspace visibility before creation.
- Connect selected Google Sheet tabs and start their first imports in one journey, with independent progress, success links, redacted failures, and import-only retries.
- Refocus `/dashboard/api-connections` as a Data sources operations surface instead of combining creation, connection inventory, and captured resources.
- Keep CSV replacement at `/dashboard/upload?replace=...` while redirecting new CSV uploads into the guided workflow.
- Simplify Google Sheets connection detail hierarchy so real source state and actions precede diagnostics; remove the disabled pipeline-stage skeleton from the primary experience.
- Add funnel analytics that exclude Sheet URLs, tab names, dataset names, headers, row values, and file contents.
- Extend browser-smoke coverage for the new route, guided Sheet flow, CSV flow, privacy review, and redirects.

### Non-goals

- Google user OAuth, Drive browsing, or changing source-Sheet sharing from Accelerate.
- Generic user-configurable API profile creation.
- Scheduled refresh or export delivery.
- Partner-export mapping inside onboarding; it remains a post-import dataset workflow.
- Per-tab classification or visibility in a multi-tab Sheet action; shared settings remain the current contract.
- Changing CSV replacement/version history behavior.

## Capabilities

### New Capabilities

- `dataset-onboarding`: Guided administrator workflow for choosing a supported source, reviewing structure and dataset metadata, importing, recovering from partial failures, and reaching created datasets.

### Modified Capabilities

- `api-connection-runs`: Google Sheets creation moves into onboarding, accepts reviewed per-tab dataset names, starts first imports in the same journey, and presents source operations without the disabled pipeline skeleton.
- `authenticated-dataset-access`: New CSV uploads and Google Sheets imports explicitly review workspace visibility before creation while preserving existing authorization and private-tag invariants.
- `dashboard-layout`: Administrators receive one Add dataset entry point, API Connections becomes Data sources management, and legacy upload URLs preserve replacement behavior.

## Impact

- UI routes and components: `src/app/dashboard/datasets/new`, dashboard dataset controls, Google Sheets setup, CSV upload presentation, API connection index/detail pages, and user documentation.
- API/domain contracts: the Google Sheets connect request gains optional backward-compatible per-tab dataset names; CSV dataset creation carries reviewed visibility; existing run endpoints remain the ingestion engine.
- Data integrity: no schema migration is expected because connection `name`/`datasetName`, dataset `fileName`, classification, and visibility already exist. Existing stable `sheetId`, duplicate-source, header-fingerprint, and private-tag behavior remains authoritative.
- Auth/security: all onboarding mutations remain administrator-only and behind the centralized same-origin guard; service-account credentials remain server-side and provider errors remain normalized/redacted.
- Supabase/Vercel: no new service, provider, or deployment behavior is introduced. The already-completed private-tag migration remains part of the combined branch and must pass database security and migration-drift checks.
- UI smoke: the new page requires route-registry entries and literal page/surface/ready markers; existing API Connections and upload route coverage changes to match the new information architecture.
- Brownfield evidence: `src/components/dashboard/api-connections-client.tsx` currently combines creation, connection inventory, and resources; `src/components/dashboard/dataset-upload-client.tsx` begins processing immediately after file selection; `src/components/dashboard/api-connection-detail-client.tsx` currently renders five disabled pipeline cards.
