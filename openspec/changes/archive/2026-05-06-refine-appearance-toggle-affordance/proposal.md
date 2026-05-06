## Why

The account menu Appearance row currently repeats the selected theme in a
secondary description, which creates noisy text changes as users move between
System, Light, and Dark. The segmented control also needs to follow the ReUI
toggle affordance more closely: hover feedback appears only under the hovered
option, and the selected option keeps the background.

## What Changes

- Remove the dynamic selected-theme description from the Appearance row.
- Keep one System / Light / Dark segmented control, but style each option as an
  independent ReUI-style toggle.
- Ensure unselected options have no persistent background while hovered and
  selected options provide clear visual feedback.

## Capabilities

### Modified Capabilities
- `system-appearance`: account-menu appearance control labeling and visual
  affordance.

## Impact

- Affects `src/components/auth/account-control.tsx` and its focused tests.
- No database, API, or route changes.
