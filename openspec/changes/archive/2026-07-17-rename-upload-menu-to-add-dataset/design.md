## Context

`src/components/auth/account-control.tsx` renders the administrator menu item for `/dashboard/upload` as `Upload`, even though the product’s current creation terminology is `Add Dataset`. The route itself is a compatibility boundary: new uploads redirect into dataset onboarding, while replacement URLs retain the existing replacement interface.

## Goals / Non-Goals

**Goals:**

- Display `Add Dataset` for the existing admin-only account-menu item.
- Keep the direct account-control test aligned with the visible menu structure.

**Non-Goals:**

- Renaming or removing `/dashboard/upload`.
- Changing redirects, source selection, CSV upload, dataset replacement, permissions, analytics, smoke markers, Supabase, or Vercel configuration.

## Decisions

1. Change only the menu item’s text node. This satisfies the requested naming change while preserving the existing `MenuNavigationItem`, `UploadIcon`, href, prefetch behavior, and admin-only conditional.
2. Update the existing menu-structure assertion and the non-admin absence assertion to use `Add Dataset`. No new smoke surface is introduced, so the existing account-menu smoke contract remains unchanged.

## Risks / Trade-offs

- [Risk] The label could imply a broader flow than the legacy URL. → Mitigation: preserve current route behavior, which already redirects new uploads into the guided CSV onboarding flow.
- [Risk] Non-admin tests could continue checking the stale label. → Mitigation: update both admin structure and non-admin absence assertions in the same direct test file.

## Migration Plan

Deploy as a UI-only application change with no data migration. Rollback is a one-line label revert.

## Open Questions

None.
