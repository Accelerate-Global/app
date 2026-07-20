## 1. Remove runtime analytics

- [x] 1.1 Remove analytics event calls and analytics-only properties from auth and account components
- [x] 1.2 Remove analytics event calls and analytics-only properties from dashboard, dataset, onboarding, definitions, and user-management components and pages
- [x] 1.3 Remove the analytics ingestion route and analytics client/server/domain libraries

## 2. Remove analytics storage

- [x] 2.1 Remove analytics schema and validation definitions plus their direct tests
- [x] 2.2 Generate a forward Supabase migration that drops the analytics and failure-triage tables without altering historical migrations
- [x] 2.3 Update database security coverage for the resulting private schema

## 3. Update contracts and tests

- [x] 3.1 Remove analytics mocks and event-payload assertions while preserving functional behavior assertions in affected same-stem tests
- [x] 3.2 Update route security, smoke selection, current architecture, repository map, and user documentation
- [x] 3.3 Prove active source contains no product analytics runtime outside the retired compatibility redirect and historical records

## 4. Verify and release

- [x] 4.1 Run planning, focused tests, local migration reset, database security, smoke contract, and every command required by `pnpm run verify:change`
- [x] 4.2 Run `pnpm run verify:change:run`, verify Last sign-in and retired-route behavior, and prepare the completed change for archive
- [x] 4.3 Prepare the verified change for archive and confirm production migration readiness
