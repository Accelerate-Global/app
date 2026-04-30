## Context

The admin API Connections feature already supports saved request profiles, Vault-backed secret headers, async test/import runs, Supabase Storage output artifacts, and CSV/JSON downloads. The provided Joshua Project PGIC script fetches `people_groups.json` with `include_profile_text=Y`, `include_resources=Y`, `page=1`, and a high `limit`, then flattens the `Resources` array into indexed CSV columns while preserving the raw resource payload.

The Joshua Project API key is a secret. The existing connection model stores secret header values in Supabase Vault and only returns secret header names to the client, so the implementation should reuse that secret boundary and avoid adding a tracked key, public env variable, or client-bundled secret.

## Goals / Non-Goals

**Goals:**

- Make Joshua Project (PGIC) available as a first-class setup option in the API Connections page.
- Keep the API key out of tracked source and saved connection URLs while still sending it as the upstream `api_key` query parameter during Joshua Project runs.
- Match the script's output behavior for top-level JSON rows and `Resources` flattening.
- Preserve existing admin-only API connection permissions, SSRF protections, async run lifecycle, import behavior, and downloadable output artifacts.

**Non-Goals:**

- Do not create a separate ingestion service, new database table, or Supabase migration.
- Do not implement Google Drive mirroring from the Python script.
- Do not normalize Joshua Project data into canonical workspace fields beyond the existing API connection row import flow.
- Do not change auth roles, RLS policy shape, or same-origin mutation guard behavior.

## Decisions

- Use a UI preset instead of a hardcoded seed record. A preset lets each environment/admin create or update the connection through the existing admin API and avoids guessing an actor identity or writing environment-specific data migrations.
- Store `api_key` as an existing secret header name, then translate it to a query parameter only for the Joshua Project people-groups endpoint. This reuses Vault persistence and redaction while matching the upstream API contract. The alternative, placing the key in the URL, would expose it in form state, saved connection lists, logs, and tests.
- Keep the preset URL keyless but complete: `https://api.joshuaproject.net/v1/people_groups.json?include_profile_text=Y&include_resources=Y&page=1&limit=100000`. The executor appends the secret `api_key` value at run time for this known endpoint.
- Add provider-aware row transformation inside the existing API response parser path. The generic parser remains the default for all other connections; Joshua Project rows get first-seen column ordering, nested object JSON serialization, and `Resources` flattening.
- Avoid database schema changes. Provider detection can be derived from the saved URL host/path and secret name, which is sufficient for this one provider-specific behavior.

## Risks / Trade-offs

- API key entry remains a manual admin step -> the preset names the required secret field and tests ensure no key is committed.
- Provider detection by URL is narrower than a dedicated provider column -> keep matching explicit to `api.joshuaproject.net/v1/people_groups.json` so generic connections are not affected.
- A single high-limit request may hit upstream response-size limits -> preserve the existing app response-size guard and report the failure through the run log.
- Resource flattening can create many columns if upstream payload changes -> use first-seen header ordering and the existing column normalization/limits to keep imports compatible.

## Migration Plan

No schema migration is required. Deploying the code adds the UI preset and parser behavior for newly saved or updated Joshua Project connections. Rollback removes the preset and provider-aware parser while leaving any previously created saved connection records as ordinary API connections.
