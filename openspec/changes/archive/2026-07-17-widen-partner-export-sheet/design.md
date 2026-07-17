## Context

The feature-level width classes were added after the shared Sheet's defaults,
but Tailwind's side-qualified `sm:max-w-sm` selector still caps the rendered
panel. The screenshot confirms the panel is materially narrower than the
intended working area and causes mapping controls to feel cramped.

## Goals / Non-Goals

**Goals:**

- Render the export profile Sheet at two-thirds of the viewport from the `sm`
  breakpoint upward and at full width below it.
- Ensure feature width and max-width values win over shared Sheet defaults.
- Keep existing content flow, smoke hooks, and functionality unchanged.

**Non-Goals:**

- Change the shared Sheet defaults used by other features.
- Change profile fields, mapping behavior, permissions, or exports.

## Decisions

Use Tailwind's trailing important modifier on the feature-specific,
side-qualified width utilities: full width on mobile, two-thirds width and no
maximum-width cap at `sm` and above. This is preferred over changing the shared
primitive because other sheets rely on its compact default, and preferred over
inline styles because responsive behavior should remain declarative.

Update the direct component test to assert the exact important width classes.
The existing smoke surface continues to cover sheet opening and readiness.

## Risks / Trade-offs

- [Risk] Two-thirds width obscures more page content. → The backdrop and close
  controls already communicate modal focus; one-third remains visible.
- [Risk] Important utilities can be overused. → Scope them only to this feature's
  three width/max-width rules needed to defeat the shared cap.

## Migration Plan

Deploy as a CSS-only feature adjustment. Rollback restores the previous
feature-level width classes; there is no data migration.

## Open Questions

None.
