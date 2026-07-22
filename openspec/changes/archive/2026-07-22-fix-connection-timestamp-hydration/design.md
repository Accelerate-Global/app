## Context

The Connections list and connection run-detail client components format ISO timestamps with `Intl.DateTimeFormat` but do not select a timezone. Next.js first renders those client components on Vercel, where the runtime timezone is UTC, and React then hydrates them in the administrator's browser, where the timezone can differ. The same timestamp can therefore produce different text on the server and client, which React reports as a text hydration error.

The stored timestamp values, ingestion lifecycle, authentication, Supabase data, and Vercel runtime configuration are otherwise correct. The fix is limited to presentation and requires no local Supabase services or data migration.

## Goals / Non-Goals

**Goals:**

- Render connection and run timestamps identically during server rendering and browser hydration.
- Make the displayed timezone explicit to administrators.
- Apply one shared formatting contract to the connection list, resource rows shown there, run history, logs, and run detail.
- Add focused regression coverage for the shared formatter and both affected connection views.

**Non-Goals:**

- Changing stored timestamps or API payloads.
- Adding per-user timezone preferences or detecting the browser timezone after hydration.
- Changing ingestion, dataset publication, permissions, or Supabase behavior.
- Changing the Vercel runtime timezone.

## Decisions

### Use UTC for operational timestamps and label it

All affected timestamps will use an explicit `UTC` timezone and include a visible `UTC` suffix. UTC is stable across Vercel and browser environments, aligns with the existing resource administration views, and is appropriate for comparing operational logs and run history. A fixed application-local timezone was considered, but it would encode an organizational assumption and still require a visible label. Browser-local formatting was rejected because it cannot be identical during server rendering without deferring the timestamp text until after hydration.

### Centralize formatting in a small shared utility

A shared date-formatting utility will own the `Intl.DateTimeFormat` options, invalid-value handling, empty labels, and timezone suffix. Both connection components will use it instead of maintaining separate implicit-timezone functions. Duplicating the option in each component was considered but would allow the two views to drift again.

### Preserve source values and data flow

The formatter receives the existing ISO timestamp strings and changes only their rendered text. Sorting continues to use timestamp values, and no database, API, artifact, or ingestion code is changed. Auth metadata, Supabase RLS, and request-security boundaries are unaffected.

### Verify at utility, component, and production-browser levels

Unit coverage will assert exact UTC output and safe empty/invalid handling. Both component tests will assert visibly labeled UTC timestamps. Existing UI smoke coverage and the repository change gate will catch integration regressions. After deployment, a fresh authenticated Chrome tab will confirm the production page has UTC timestamps and no React hydration error.

## Risks / Trade-offs

- [Risk] Administrators accustomed to local time may initially see a different clock time. → The explicit `UTC` suffix removes ambiguity and provides one consistent operational reference.
- [Risk] A future view could bypass the shared formatter. → Component regression tests cover the two current entry points, and the utility gives future code one reusable contract.
- [Risk] Locale output can vary across runtimes despite a fixed timezone. → The formatter fixes both locale (`en-US`) and timezone (`UTC`) and tests the exact product output.

## Migration Plan

1. Add the shared UTC formatter and regression tests.
2. Replace both connection-view formatters and run the required local verification gates.
3. Deploy through the existing protected GitHub/Vercel release path.
4. Verify the connection list and an authenticated connection detail page in a fresh Chrome tab, including browser error logs.

Rollback is a normal code revert because this change has no stored-data or schema effects. The prior implicit-timezone rendering can be restored without data recovery.

## Open Questions

None.
