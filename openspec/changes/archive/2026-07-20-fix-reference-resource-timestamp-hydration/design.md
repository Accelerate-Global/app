## Context

`ReferenceResourceLifecycle` is a Client Component that is also pre-rendered on
the server. Its visible active-version timestamp currently calls
`Date.prototype.toLocaleString()` without a timezone. Vercel renders that text
in UTC, while hydration repeats the call in the user's local timezone. The
resulting text difference produces React hydration error 418 even though the
resource data and later client interactions remain functional.

The Country/ROG and ROP pages share this lifecycle component, so one narrow
formatting correction covers both production surfaces. No Supabase, RLS, auth,
API, or migration behavior participates in the failure.

## Goals / Non-Goals

**Goals:**

- Produce identical lifecycle timestamp text during Vercel server rendering and
  browser hydration.
- Preserve an understandable English date-and-time display with an explicit UTC
  label.
- Add a regression assertion that fails if formatting returns to an implicit
  runtime timezone.

**Non-Goals:**

- Changing stored timestamps or resource lifecycle state.
- Reformatting dates throughout unrelated dashboard features.
- Changing resource refresh, validation, activation, rejection, or rollback.

## Decisions

- Format lifecycle timestamps with `Intl.DateTimeFormat("en-US", ...)` and an
  explicit `timeZone: "UTC"` plus `timeZoneName: "short"`. This preserves a
  readable presentation while making server and client output deterministic.
- Use the same helper for the visible active timestamp and version-history
  timestamps. The history is client-loaded, but sharing one rule prevents later
  inconsistency.
- Assert the rendered UTC text in the existing colocated component test. A
  separate shared date utility is not introduced because the bug and behavior
  boundary are confined to this component.

## Risks / Trade-offs

- [Users see UTC rather than their local timezone] → Include the `UTC` label so
  the displayed meaning is explicit and reproducible.
- [Locale implementation differences] → Fix both locale and individual date/time
  fields instead of relying on an environment-selected locale or `dateStyle`.

## Migration Plan

Deploy as an application-only hotfix through the normal PR and Vercel workflow.
No data migration or local Supabase stack is required. Rollback is the normal
Vercel/Git revert path if the presentation change causes an unexpected issue.

## Open Questions

None.
