## Context

The existing menu already stores and applies the `system`, `light`, and `dark`
preferences correctly. This change only refines the menu presentation.

## Decisions

- Keep the Appearance label static and remove the resolved/preference
  description text beside it.
- Keep the three choices as separate `Toggle` primitives so Base UI continues to
  provide pressed state semantics.
- Remove the container-level muted background from the segmented control and let
  each toggle own its hover and selected backgrounds.
- Preserve the existing `theme_toggled` analytics event and storage behavior.

## Risks / Trade-offs

- Without the text description, users rely on the selected toggle state to see
  the active preference. The selected background and `aria-pressed` state make
  that state explicit.
