## Context

The shared lifecycle component was corrected to use UTC, but the Country/ROG
and ROP page clients each retain a separate `formatTimestamp` helper with an
implicit runtime timezone. Vercel server rendering and a user's browser can
therefore produce different text from the same ISO timestamp.

## Goals / Non-Goals

**Goals:**

- Produce identical resource source-timestamp text on the server and browser.
- Keep source and lifecycle timestamps explicit and consistent.
- Cover both independently implemented page clients with exact assertions.

**Non-Goals:**

- Changing stored timestamps, resource lifecycle state, or refresh behavior.
- Introducing an application-wide date-formatting refactor.

## Decisions

- Use explicit `Intl.DateTimeFormat("en-US", ...)` fields with `timeZone: "UTC"`
  and `timeZoneName: "short"` in both existing page-local helpers.
- Match the already released lifecycle formatter. This keeps the follow-up
  narrow while eliminating every known implicit timezone on these two pages.
- Assert exact UTC text in both existing colocated component suites.

## Risks / Trade-offs

- [Users see UTC rather than local time] -> Label UTC explicitly so the meaning
  is clear and server/client output is reproducible.
- [Two helpers remain duplicated] -> Keep the hotfix narrow; a shared utility
  would add unrelated surface area for only two small functions.

## Migration Plan

Deploy through the normal PR and Vercel workflow. No data migration or local
Supabase stack is required.

## Open Questions

None.
