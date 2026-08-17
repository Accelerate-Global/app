## Context

The code-managed Joshua Project definition in `src/lib/api-connections/index.ts` currently points at the v1 people-groups endpoint with `page=1&limit=100000`. `genericHttpProvider` applies the shared 20-second timeout and 2 MiB body limit to that single response. A live authenticated probe on 2026-08-17 returned HTTP 200 but needed about 24 seconds for headers and produced about 133 MiB. By contrast, 100-row pages returned in under one second and remained near 1 MiB. The key stored in Supabase Vault matches the legacy Accelerate Data key and is accepted upstream.

The provider registry already gives ArcGIS and Etnopedia specialized bounded fetch flows while the run orchestrator owns status, output artifacts, resource extraction, and publication. Joshua Project can use the same seam without changing the database schema, RLS, auth metadata, or admin authorization.

## Goals / Non-Goals

**Goals:**

- Retrieve the complete Joshua Project PGIC result in deterministic upstream page order.
- Bound each request, total pages, and aggregate response bytes while retaining the complete successful response for existing artifacts and parsing.
- Preserve SSRF protection, same-origin redirect enforcement, secret redaction, resource flattening, and all-or-nothing run publication.
- Emit useful progress and normalized failures.
- Allow the asynchronous Vercel route enough declared duration for a bounded multi-page run.

**Non-Goals:**

- Changing the upstream API version, exchange fields, source-forming rules, or dataset publication model.
- Raising generic HTTP limits or weakening outbound request protections.
- Introducing database migrations, new credentials, UI changes, or local Supabase requirements.

## Decisions

### Add a Joshua Project provider before the generic fallback

The registry will recognize the exact Joshua Project people-groups URL using the existing host/path predicate. The specialized provider will own paging and return one aggregate JSON array to the unchanged parser and artifact lifecycle.

Alternative: increase `REQUEST_TIMEOUT_MS` and `MAX_RESPONSE_BYTES` globally. Rejected because it weakens safety for every generic connection and still makes one slow, oversized upstream request.

### Use fixed-size v1 pages and terminate on a short page

Each request will preserve the configured filters and Vault-injected `api_key`, replace `page`, and replace the oversized `limit` with a bounded provider page size. Pages are appended in page-number order. A page shorter than the configured size, including an empty terminal page, ends retrieval.

The provider will reject non-array page shapes, non-object records, repeated non-empty page payloads, excessive page counts, and aggregate bytes above a Joshua-specific ceiling. A repeated-page guard prevents an upstream service that ignores `page` from looping or silently duplicating data.

Alternative: migrate to the v2 endpoint and its pagination metadata. Rejected for this fix because it could change field names or response semantics beyond the proven v1 exchange contract.

### Keep request and aggregate limits provider-specific

Each page uses the existing 20-second request timeout, a small per-page byte ceiling, and the existing safe pinned HTTPS requester. The aggregate ceiling accommodates the observed complete payload but remains finite. No partial rows or artifacts are persisted when any page fails.

Alternative: stream rows directly into final artifacts. Deferred because the current run output contract calculates checksums and uploads complete JSON artifacts; changing that storage contract is substantially broader.

### Preserve the existing parser and artifact shape

The provider will serialize the ordered aggregate records as a JSON array and return `parsed: null`, allowing `parseApiResponseRows` to continue performing Joshua resource flattening. The raw-response and normalized-rows artifacts therefore retain their existing formats.

### Declare the admin run route duration

The run route will export the same 300-second maximum used by other long-running pipeline routes so its `after()` execution has an explicit bounded window. This changes no public route contract.

## Risks / Trade-offs

- [The complete result still consumes substantial memory] → Keep provider-specific aggregate byte and page ceilings, preserve the 300-second execution bound, and fail before persistence when limits are exceeded.
- [Upstream data can change between pages] → Preserve deterministic page order and fail on repeated pages; a provider snapshot token is unavailable in v1, so cross-page source mutation remains an upstream limitation.
- [A single unusually large page may exceed its cap] → Choose a page size supported by live measurements and report a normalized size failure rather than weakening generic limits.
- [Many requests increase rate-limit exposure] → Use a moderate fixed page size, sequential fetching, and explicit progress; do not retry non-success responses invisibly.

## Migration Plan

1. Add and unit-test the specialized provider and registry precedence.
2. Replace the code-managed URL's oversized limit with the provider page size for clarity; execution still normalizes every page parameter.
3. Add the route duration export and direct route test coverage.
4. Deploy without a database migration. Existing materialized rows continue to be overlaid by the code-managed definition and keep their Vault identifier.
5. Roll back by reverting the provider registration, URL, and route-duration change; no stored data migration is required.

## Open Questions

None.
