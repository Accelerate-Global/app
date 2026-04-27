## Context

`src/lib/api-connections.ts` currently fetches the upstream API, optionally imports rows, and inserts one final `private.api_connection_runs` record inside the same admin HTTP request. The admin page can show only that completed run and its truncated preview. The new workflow needs an immediate start response, persisted progress logs, and durable output downloads while keeping the existing admin-only API boundary and Supabase private-table posture.

## Goals / Non-Goals

**Goals:**
- Start API connection runs without blocking the browser on the upstream fetch/import work.
- Persist run lifecycle, logs, parsed output metadata, and redacted raw output artifacts.
- Keep dataset import/create/replace behavior compatible with the current implementation.
- Keep all API connection management, execution, history, and downloads admin-only.
- Use existing Next.js/Vercel runtime capabilities instead of introducing a separate worker service.

**Non-Goals:**
- Scheduled runs, retries, cancellation, queue concurrency controls, and viewer execution.
- Retention policy or background cleanup of old output artifacts.
- Reworking dataset download behavior outside API connection output downloads.

## Decisions

1. **Use Next.js `after()` for v1 async execution.** The run endpoint will create a queued run and return `202`, then schedule execution in `after()`. This matches the Next.js App Router/Vercel Functions stack and avoids adding queue infrastructure. Alternative considered: a durable queue worker, which is better for retries and very long jobs but unnecessary for the current 20-second upstream timeout and existing Vercel deployment.

2. **Keep run state in private Postgres tables and artifacts in Supabase Storage.** `private.api_connection_runs` gains lifecycle timestamps; logs and outputs are separate private tables keyed by run. The full redacted raw JSON and normalized rows JSON are stored as Storage objects so the database stores metadata and remains small. Alternative considered: storing all output JSON in Postgres JSONB, which simplifies reads but risks bloating private tables as outputs grow.

3. **Persist parsed rows for every successful run.** Test and import modes both parse the upstream response using the configured response format/path. Import mode then also persists rows to the existing dataset system. This makes archived test outputs downloadable and gives future dataset workflow steps a consistent normalized representation.

4. **Download conversion happens server-side.** JSON downloads read the stored redacted raw output. CSV downloads read normalized rows and columns, serialize with CRLF rows, and prefix a UTF-8 BOM for Excel-compatible `utf-8-sig` behavior. JSON stays standard UTF-8 without BOM for parser compatibility.

5. **Admin authorization remains centralized at route boundaries.** New routes use `getCurrentIdentity()` and `identity.isDatasetAdmin`, matching existing admin API connection routes. Private tables remain RLS-enabled with privileges revoked from public, anon, and authenticated roles; app code accesses them through the server database connection.

## Risks / Trade-offs

- **Background work can still be bounded by function lifetime** -> Keep the existing request timeout and response-size cap, record failed runs when execution errors, and avoid promising durable queue semantics in v1.
- **Storage artifact upload can fail after parsing succeeds** -> Mark the run failed with a log entry and do not expose incomplete output metadata.
- **CSV/JSON artifacts can outlive deleted Storage objects** -> Download routes return a clear error if the artifact cannot be read; connection deletion cascades database rows but v1 does not delete Storage objects.
- **Polling can create avoidable load** -> Poll only while selected latest run is queued/running and stop once terminal.
- **Supabase migration rollback requires schema/data care** -> The migration is additive except status checks. Rollback would drop the new output/log tables and lifecycle columns after no active async runs depend on them.
