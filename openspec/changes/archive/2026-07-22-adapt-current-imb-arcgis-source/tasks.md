## 1. Replacement source contract

- [x] 1.1 Add the versioned and checksummed IMB replacement-source mapping with required-schema validation.
- [x] 1.2 Update the code-managed IMB definition to the public production FeatureServer layer.
- [x] 1.3 Make deployed code-managed request fields authoritative during execution while preserving persisted target linkage.

## 2. Ingestion integration

- [x] 2.1 Apply the adapter only to repo-owned IMB ArcGIS normalized rows and preserve generic ArcGIS parsing.
- [x] 2.2 Record adapter metadata in the normalized artifact and run progress while retaining the untouched raw feature artifact.

## 3. Regression coverage

- [x] 3.1 Add direct adapter tests for the approved mapping, blank discontinued fields, and required-schema failure.
- [x] 3.2 Update connection tests for the replacement URL, stale materialized definitions, artifact metadata, and generic ArcGIS compatibility.
- [x] 3.3 Run focused tests and `pnpm run verify:fast` during implementation.

## 4. Verification and release

- [x] 4.1 Run `pnpm run verify:change`, complete every listed required command, and pass `pnpm run verify:change:run`.
- [x] 4.2 Verify the implementation against the OpenSpec artifacts and prepare the completed change for required pre-ship archival.
