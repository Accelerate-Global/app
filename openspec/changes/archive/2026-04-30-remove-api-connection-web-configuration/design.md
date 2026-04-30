## Context

`/dashboard/api-connections` currently combines saved request configuration, preset application, run/import controls, latest output, run history, and output downloads in one client component. The same admin API surface also exposes profile list/create/update/delete plus run/history/download routes. The requested behavior keeps the operational run/output workflow, but removes web UI and web HTTP profile writes so profile definitions can be maintained from the codebase.

## Goals / Non-Goals

**Goals:**
- Present API Connections as a run-only admin dashboard for saved connections.
- Remove visible URL, method, headers, body, response parsing, import target, preset, new, save, and delete controls from the web app.
- Keep Test, Import, latest output, recent run history, imported dataset links, logs, and JSON/CSV downloads for existing saved connections.
- Return an unavailable response for profile create/update/delete HTTP handlers while preserving admin list/run/history/download handlers.
- Keep UI smoke markers and route registry coverage intact.

**Non-Goals:**
- No Supabase schema, RLS, storage, or migration changes.
- No changes to the run executor, safe outbound request checks, secret redaction, dataset import behavior, or provider-specific parsers.
- No removal of library helpers that codebase scripts or migrations may use to maintain saved profiles.

## Decisions

- Keep the route and admin navigation. This preserves the operator workflow for running and inspecting existing API connections, which is distinct from configuring profile internals.
- Replace the configuration form with a compact selected-connection summary and action area. The summary can show name/description and operational status without exposing URL, method, headers, JSON path, or import settings.
- Disable profile write route handlers at the web HTTP boundary instead of only hiding controls. This closes the direct web-app create/update/delete path while keeping server-side library functions available for code-managed maintenance.
- Keep list and run APIs unchanged. The dashboard still needs initial connection data, polling, output details, and downloads.
- Update the existing `api-connection-runs` spec rather than adding a new capability because this changes the observable behavior of the existing API Connections workflow.

## Risks / Trade-offs

- Existing environments with no saved API connection records will show an empty run dashboard until code-managed profile creation is added or run externally. Mitigation: provide an empty state that clearly says connections are managed from the codebase.
- Disabling HTTP writes may break any unpublished automation calling the admin web endpoints for profile maintenance. Mitigation: keep the lower-level library helpers intact for repo-owned scripts or migrations.
- UI tests currently assert configuration and preset behavior. Mitigation: replace them with assertions that configuration fields and create/delete controls are absent, while run/import/output behavior remains covered.
