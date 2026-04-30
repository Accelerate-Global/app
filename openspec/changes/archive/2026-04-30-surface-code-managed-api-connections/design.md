## Context

`/dashboard/api-connections` is now a run-only admin dashboard. The current implementation reads saved profiles from `private.api_connections`, while the provider-specific behavior for IMB ArcGIS, Joshua Project PGIC, and Etnopedia lives in `src/lib/api-connections.ts`. The old UI presets contained the correct profile fields but were removed when web configuration was disabled, leaving fresh or unseeded environments with no visible connections.

## Goals / Non-Goals

**Goals:**

- Surface repo-owned API connection definitions on the admin dashboard without requiring web profile creation.
- Reuse the existing async run tables, run history, output downloads, and dataset import flow.
- Preserve database referential integrity by creating a private profile row before the first run of a built-in definition.
- Keep provider secrets out of tracked source and client defaults.

**Non-Goals:**

- Reopen web create, update, delete, preset, or request-configuration controls.
- Add a Supabase migration, RLS policy, or new profile table.
- Backfill or merge any manually created legacy profile rows.
- Add scheduled refreshes or automatic imports.

## Decisions

1. **Add a source registry for built-in definitions.** Define stable built-in connection records in server-owned code using the same fields as `private.api_connections`. This keeps the old preset data out of the client component and makes code-managed profiles explicit.

2. **Use deterministic IDs for built-ins.** Stable IDs let the list API de-duplicate a materialized database row and let the dashboard select/run a built-in before its row exists. Alternative considered: name-based matching, but names are user-visible and less reliable as durable identifiers.

3. **Materialize on run start.** The list API can show built-ins without mutating the database. When an admin starts a run for a built-in ID, the server upserts the corresponding `private.api_connections` row with the current admin as owner/updater before inserting the queued run. This preserves the existing foreign keys and keeps all run/history/output queries unchanged after materialization.

4. **Keep secret handling out-of-band.** The Joshua Project built-in records the required `api_key` secret name but stores no value. Successful Joshua Project runs continue to depend on a secret supplied outside tracked code, while failures remain redacted through existing error handling.

## Risks / Trade-offs

- Existing environments may contain manually created duplicates with different IDs -> They will continue to appear as separate saved connections; this change only de-duplicates deterministic built-in IDs.
- First run of a built-in writes a profile row -> This is an intentional admin action and uses the existing private table, RLS posture, and run lifecycle.
- Joshua Project remains unavailable without a secret -> The dashboard can show the connection, but the run fails with the existing missing-key error until the secret is configured outside tracked code.
- Rollback removes virtual built-ins from the list, but any materialized rows remain ordinary private API connection records and can still be listed by the previous code.
