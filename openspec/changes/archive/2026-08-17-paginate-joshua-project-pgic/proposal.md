## Why

The repo-owned Joshua Project PGIC connection requests every profile and resource in one `limit=100000` response, but the upstream service now takes longer than the shared 20-second request timeout and returns far more than the shared 2 MiB response cap. The configured Vault key is valid, so the connection needs bounded provider-specific retrieval rather than a credential change or a global safety-limit increase.

## What Changes

- Fetch Joshua Project PGIC records in bounded pages while preserving profile text, resources, and deterministic row order.
- Record page-level progress and fail the run without publishing partial output when an upstream page fails, repeats, or exceeds bounded safety limits.
- Keep the Joshua Project `api_key` in Supabase Vault, transmit it only as the upstream query parameter, and preserve redaction and pinned-host redirect protections.
- Preserve the existing generic HTTP, ArcGIS, Etnopedia, dataset import, and source-forming behavior.
- Add provider and run-level regression coverage for pagination, termination, failure handling, and secret safety.

Non-goals:

- Changing admin authorization or UI smoke coverage.
- Raising the global HTTP timeout or global response-size cap.
- Changing the Joshua Project exchange fields or Tier 1 forming rules.
- Committing provider credentials to tracked files.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `api-connection-runs`: Joshua Project PGIC test and import runs retrieve the complete upstream result through bounded pagination instead of one oversized request.

## Impact

- Affects the Joshua Project provider path under `src/lib/api-connections/`, its direct tests in `src/lib/api-connections.test.ts` or colocated provider tests, and run progress emitted by `src/lib/api-connections/index.ts`.
- Preserves the existing Supabase Vault integration in `src/lib/api-connections/vault.ts`; no schema or migration change is expected.
- Changes the upstream API interaction contract for the code-managed Joshua Project connection but not public application APIs, auth, admin permissions, or data integrity rules.
- May require an explicit Vercel route duration appropriate for bounded multi-page execution; deployment configuration remains otherwise unchanged.
- Does not add pages, dialogs, menus, tooltips, popovers, or shared UI primitives, so UI smoke coverage is unchanged.
