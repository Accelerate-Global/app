## Context

API route handlers have been refactored toward `withRoute`, a centralized guard that resolves the current identity, applies user/admin authorization, and catches unexpected failures. The current implementation resolves identity before the catch block, so an identity-provider failure can bypass the normalized JSON error behavior the guard is meant to own.

Dataset filtering has also been centralized behind `applyDatasetFilterSections`. Saved-table downloads now use that shared pipeline, which fixes the previous drift where saved-table CSV export could rank hotspot countries without the same UUPG criteria as the dashboard view.

## Goals / Non-Goals

**Goals:**
- Make `withRoute` own identity-resolution failure normalization as well as handler failure normalization.
- Keep protected API route access behavior centralized while preserving route-specific payload validation and domain errors.
- Specify saved-table download filter behavior so the server export and UI use the same saved-filter semantics.
- Satisfy the current same-stem test-delta gate without weakening verification policy.

**Non-Goals:**
- No Supabase RLS or database migration changes.
- No new route exemption beyond the existing anonymous analytics and Google OAuth callback cases.
- No changes to API-connection provider behavior beyond test/spec coverage required for the current refactor.

## Decisions

- Keep `withRoute` as the route security boundary. Alternatives considered: per-route try/catch blocks or middleware-only handling. Centralizing in `withRoute` keeps API route access behavior testable and avoids duplicating identity/admin checks.
- Catch identity lookup and handler execution in the same guard-level try/catch. This makes unexpected auth-provider/runtime failures return one normalized 500 response and preserves the existing explicit 401/403 responses for normal unauthenticated/non-admin cases.
- Keep payload parsing and domain error mapping inside handlers. Route payloads and domain failures differ too much to centralize without hiding useful route-specific responses.
- Keep `verify:test-delta` unchanged. The broad route refactor will update same-stem tests with meaningful assertions rather than adding a sweep-test exception.

## Risks / Trade-offs

- Broad route formatting changes can create noisy diffs. Mitigation: make only indentation/signature cleanup and leave behavior unchanged.
- Same-stem test updates add churn. Mitigation: keep assertions minimal and tied to the behavior each route or component owns.
- A new cross-cutting spec could overreach into domain APIs. Mitigation: describe only shared identity/admin/error/exemption behavior; domain-specific API contracts remain in existing specs.
