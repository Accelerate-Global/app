## Why

The Resources page currently exposes a card with a separate "Open resource"
link, which makes the primary action feel smaller than the visual component.
The user should be able to click the entire resource card to open the
resource.

## What Changes

- Remove the visible "Open resource" action from built-in resource cards.
- Make each built-in resource card on `/dashboard/resources` a full-card link.
- Preserve the existing authenticated Resources page, back navigation, and
  destination URL.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `reference-resources`: Built-in resource discovery opens resources through
  clickable cards instead of a separate card action link.

## Impact

- Affects `src/app/dashboard/resources/page.tsx` and its direct page test.
- No auth, admin permission, data integrity, Supabase, Vercel deployment, or API
  contract changes.
- UI smoke coverage remains on the existing `/dashboard/resources` route and
  marker.
