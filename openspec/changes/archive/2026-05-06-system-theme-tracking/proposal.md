## Why

The app currently only follows the operating system color scheme until a user clicks the account-menu theme toggle. After that, the saved two-state value prevents the site from tracking system light/dark changes.

## What Changes

- Default the site appearance preference to `system`, resolving to the current `prefers-color-scheme` value before React hydration.
- Add live system-theme tracking so the `.dark` class and `color-scheme` update when the OS appearance changes.
- Replace the account-menu two-state theme toggle with explicit `System`, `Light`, and `Dark` choices.
- Treat legacy `ag-theme` values from the old toggle as stale so existing users return to the new `system` default unless they choose a new explicit preference.
- Preserve the current Tailwind `.dark` token model and current authenticated navigation behavior.

## Capabilities

### New Capabilities

- `system-appearance`: Controls system-aware light/dark appearance preference, manual overrides, and related account-menu behavior.

### Modified Capabilities

- None.

## Impact

- Affected UI code: `src/app/layout.tsx`, `src/components/theme/theme-toggle.tsx`, and `src/components/auth/account-control.tsx`.
- Affected analytics contract: `theme_toggled` event properties in `src/lib/analytics.ts`.
- Affected tests: account-control component tests and analytics helper tests.
- No auth, admin permission, data integrity, Supabase, Vercel deployment, API route, database, or route-registry behavior is changed.
- UI smoke coverage remains on the existing account-menu surface; no new page or shared UI primitive is introduced.
