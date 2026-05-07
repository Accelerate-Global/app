## Context

`src/app/dashboard/resources/page.tsx` renders built-in resources as cards with
a nested "Open resource" link. The card is already the visual target on the
page, and the existing direct page test covers the destination link.

## Goals / Non-Goals

**Goals:**
- Make the whole built-in resource card clickable and keyboard-accessible.
- Remove the visible "Open resource" text action.
- Preserve the existing `/dashboard/country-codes` destination.

**Non-Goals:**
- No changes to auth, permissions, data loading, API routes, Supabase, or the
  resources route smoke marker.
- No changes to the country-code resource page.

## Decisions

- Render each built-in resource as a Next `Link` wrapping the card content so
  the entire component is the native link target.
- Keep the resource title and description as the accessible link text rather
  than adding a hidden duplicate label.
- Use hover/focus card styling only; do not add another visible action label.

## Risks / Trade-offs

- Wider clickable targets can make accidental navigation easier, so the card
  uses normal link semantics and focus styling instead of click handlers.
