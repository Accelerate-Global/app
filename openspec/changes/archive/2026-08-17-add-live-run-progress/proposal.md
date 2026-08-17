## Why

User-triggered connection tests and dataset ingestions can spend meaningful time queued or running while the current UI shows only a static status label. Users need continuous, truthful feedback that work is still active, how long it has been active, and whether the application is still checking for completion, without fabricated percentage estimates when the backend does not expose measurable progress.

## What Changes

- Add a consistent live-progress presentation for asynchronous API connection tests and source-to-dataset ingestion runs, including queued/running phase text, animated activity, live elapsed time, and automatic-refresh feedback.
- Apply the behavior to every provider using the shared API connection run lifecycle, including Etnopedia, ArcGIS/IMB, generic HTTP APIs, and Google Sheets.
- Keep direct CSV dataset creation and replacement ingestion visibly active through their existing measurable upload, parse, and persistence stages, and align their accessible status semantics with the background-run presentation.
- Distinguish determinate progress from indeterminate activity: show measured percentages only when the application has real progress data and use an indeterminate indicator otherwise.
- Surface completion, failure, and apparent lack of status updates clearly while preserving the durable run history as the source of truth.
- Add component and targeted UI smoke coverage for active test and ingestion states.
- Preserve existing authorization, run execution, dataset mutation, artifact persistence, and polling API contracts.
- Non-goals: estimating completion percentages from elapsed time; changing provider execution or ingestion semantics; adding cancellation; broad redesign of pipeline-product, identity, or reference-resource workflows; changing Supabase schema or Vercel deployment behavior.

## Capabilities

### New Capabilities

- `live-run-progress`: Defines truthful, accessible progress feedback shared by user-triggered tests and dataset ingestion operations.

### Modified Capabilities

- `api-connection-runs`: Requires queued and running connection tests and source-to-dataset ingestion runs to remain visibly active and automatically update through terminal status.
- `dataset-onboarding`: Requires direct CSV dataset creation and replacement ingestion to expose measurable stage progress and accessible live status until completion or failure.

## Impact

- Primary UI: `src/components/dashboard/api-connection-detail-client.tsx` and its direct component tests.
- Dataset ingestion UI: `src/components/dashboard/dataset-upload-client.tsx`, `src/components/dashboard/dataset-onboarding/dataset-onboarding-client.tsx`, and their direct tests where the existing progress contract needs alignment.
- Shared UI may reuse `src/components/ui/progress.tsx`; any new shared primitive would require a colocated smoke fixture.
- UI smoke selectors and journeys under `tests/ui/` will cover active progress behavior without mutating production data.
- API contracts remain unchanged unless implementation discovery proves a small read-only freshness field is necessary; any such change must be reflected in the design and tests before implementation.
- Auth and admin permissions: unchanged. Data integrity and Supabase schema: unchanged. Vercel deployment behavior: unchanged. UI smoke coverage: expanded.
