## Context

The app already uses a custom class-based theme system. `src/app/layout.tsx` runs an inline script before hydration, `src/app/globals.css` defines light tokens on `:root` and dark tokens under `.dark`, and `src/components/auth/account-control.tsx` exposes the current two-state menu toggle.

## Goals / Non-Goals

**Goals:**

- Make `system` the default persisted appearance preference.
- Resolve `system` before hydration and react to later OS appearance changes.
- Keep explicit `light` and `dark` overrides available in the account menu.
- Remove or ignore legacy two-state storage so old toggles do not prevent the new default.

**Non-Goals:**

- No new theme dependency.
- No token redesign, route changes, authentication changes, Supabase changes, or Vercel deployment changes.
- No new shared UI primitive.

## Decisions

- Keep the existing `.dark` class and `color-scheme` data flow. This preserves Tailwind/shadcn styling and avoids a broad CSS rewrite.
- Introduce a new storage key, `ag-theme-preference`, with values `system`, `light`, and `dark`. The old `ag-theme` key will be removed during bootstrap/client theme application so existing users follow the new default.
- Track both preference and resolved theme in client state. Analytics can then report the user-facing preference change and the actual light/dark outcome.
- Subscribe to `matchMedia("(prefers-color-scheme: dark)")` only on the client. When preference is `system`, OS changes update the document theme immediately; explicit `light` or `dark` preferences ignore system changes.

## Risks / Trade-offs

- Legacy overrides are intentionally reset. Users who wanted a persistent override must choose `Light` or `Dark` once in the new menu.
- Older browser APIs differ between `addEventListener` and `addListener` on `MediaQueryList`. The helper should support both to keep the listener resilient.
- JSDOM has no real `matchMedia`; tests must mock it to cover system resolution and live updates.
