## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before implementation and capture required commands.
- [x] 1.2 Run `pnpm run task:kickoff -- --scope src/lib/api-connections.ts --scope src/lib/api-types.ts --scope src/lib/validation.ts --scope src/components/dashboard/api-connections-client.tsx --scope openspec/changes/add-imb-people-groups-api-connection/** --scope openspec/specs/api-connection-runs/spec.md`.

## 2. Core Implementation

- [x] 2.1 Add ArcGIS FeatureServer detection for existing JSON `features` API connection profiles without changing DB response-format constraints.
- [x] 2.2 Implement ArcGIS FeatureServer paged fetching with safe URL checks, existing timeout/size limits, page progress logs, and object ID ordering when available.
- [x] 2.3 Implement IMB-compatible ArcGIS feature row normalization that preserves attributes and flattens geometry into `geometry_*` columns.
- [x] 2.4 Persist ArcGIS run outputs through the existing archived output and dataset import paths.
- [x] 2.5 Add the `IMB (People Groups)` preset to the API Connections admin UI.

## 3. Tests

- [x] 3.1 Update `src/lib/api-connections.test.ts` for ArcGIS flattening and paged fetch behavior.
- [x] 3.2 Update API route tests for the IMB preset payload.
- [x] 3.3 Update `src/components/dashboard/api-connections-client.test.tsx` for the IMB preset form behavior.
- [x] 3.4 Confirm no DB schema test changes are needed because the existing JSON response format is reused.

## 4. Verification

- [x] 4.1 Run focused direct tests for touched units/components.
- [x] 4.2 Run `pnpm run spec:validate`.
- [x] 4.3 Run `pnpm run typecheck`.
- [x] 4.4 Run `pnpm run verify:test-delta`.
- [x] 4.5 Run `pnpm run verify:app`.
- [x] 4.6 Run `pnpm run db:security`.
- [x] 4.7 Run terminal gate `pnpm run verify:change:run`.
