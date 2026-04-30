## Context

The prior code-managed API connection work makes IMB, Etnopedia, and Joshua Project visible without web profile creation. The current UI still presents those connections in a sidebar and shows operational controls in the same component. Existing admin APIs already support starting runs, listing runs, getting run detail, polling active runs, and downloading output artifacts.

## Goals / Non-Goals

**Goals:**

- Make `/dashboard/api-connections` a scan-first table of available API connections.
- Add a dedicated connection detail route that owns run initiation, polling, detail, and ingestion history.
- Use the existing DataGrid stack for per-connection ingestion runs.
- Keep pipeline stages as a visual skeleton only for v1.

**Non-Goals:**

- No independent persisted pipeline-stage model.
- No new API connection run modes beyond existing test/import.
- No database migration, storage migration, or new HTTP endpoint.
- No web profile create/update/delete controls.

## Decisions

1. **Use a dynamic detail route.** `/dashboard/api-connections/[connectionId]` keeps the index page focused on discovery and gives each connection a shareable operational URL. Unknown connection IDs return `notFound()`.

2. **Resolve connections server-side.** Add a server helper that looks up a materialized private row first, then falls back to code-managed definitions. This lets detail pages work before first materialization without changing run APIs.

3. **Keep real actions as Test and Import.** The pipeline skeleton communicates the intended flow, but only `Run test` and `Start ingestion` are enabled in v1. Stage buttons are disabled and labeled as coming soon.

4. **Use DataGrid for run history.** The detail client builds a TanStack table over `ApiConnectionRun` rows and renders it through the existing `DataGrid`, `DataGridScrollArea`, and `DataGridTable` components. Row selection drives the run detail panel.

## Risks / Trade-offs

- Pipeline skeleton can imply unavailable functionality -> Label disabled stage controls as coming soon and keep enabled actions visually separate.
- Dynamic route smoke coverage needs a stable ID -> Use the deterministic IMB code-managed connection ID in the route registry.
- Run history has no server pagination -> Keep the existing 50-run limit and DataGrid client-side sorting for v1.
