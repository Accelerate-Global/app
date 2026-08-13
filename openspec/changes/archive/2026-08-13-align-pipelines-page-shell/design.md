## Context

`src/app/admin/pipeline-operations/page.tsx` renders its content directly inside `DashboardPageShell`, unlike its peer administrator pages, which wrap the page in a full-height `<main>` and render `SiteHeader` before the shared content shell. The route already resolves the authenticated administrator identity needed by `SiteHeader`. The page is registered in the UI smoke route registry and already exposes literal page and ready markers.

## Goals / Non-Goals

**Goals:**

- Restore the standard authenticated header and account navigation on the pipeline administrator page.
- Use `Pipelines` as the canonical visible destination name in both the account menu and page heading.
- Preserve the existing content width, smoke identity, authorization, and pipeline functionality.

**Non-Goals:**

- Introduce an admin layout or refactor all administrator pages.
- Rename internal `pipeline-operations` routes, APIs, modules, smoke identifiers, or workflow definitions.
- Change Supabase data, RLS, auth metadata, Vercel runtime behavior, or pipeline execution.

## Decisions

1. **Compose the page with the existing `SiteHeader`.** Render `SiteHeader` with the already-authorized `identity`, following the exact structural pattern used by the other `/admin/*` pages. This avoids a new navigation component and preserves shared account-menu behavior. A new admin layout was considered but rejected as unnecessary cross-route refactoring for a one-page inconsistency.
2. **Keep the internal route identity and change only user-facing copy.** The heading becomes `Pipelines`, matching the existing account menu. The `/admin/pipeline-operations` path, smoke ID, APIs, and code identifiers stay stable to avoid compatibility churn.
3. **Extend the direct same-stem page test.** The test will assert the canonical heading and the rendered account-menu trigger while retaining the smoke-marker assertion. Existing route-registry coverage requires no semantic change because the route and page ID are unchanged.

## Risks / Trade-offs

- **[Risk] `SiteHeader` is a client boundary with navigation dependencies that complicate the page unit test.** → Use the existing rendering setup and assert the stable smoke trigger exposed by `AccountControl`; add only narrowly scoped mocks if the current test environment requires them.
- **[Risk] A copy-only heading change could accidentally be extended to internal identifiers.** → Limit the change to rendered heading text and test expectations.
- **[Trade-off] Other admin pages still duplicate the header composition.** → Preserve the established pattern; a shared admin layout can be proposed independently if broader refactoring becomes worthwhile.

## Migration Plan

Deploy as a normal Next.js UI change. Rollback is a direct revert of the page composition and heading. No database, Supabase, API, or persistent-data migration is required, and local Supabase services are not needed for verification.

## Open Questions

None.
