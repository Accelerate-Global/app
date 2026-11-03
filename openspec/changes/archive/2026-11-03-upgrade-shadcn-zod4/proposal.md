## Why

After the same-major security pins, the protected Dependency Audit (`pnpm audit --audit-level=high`) still reported one high advisory, GHSA-mrhx-c7xc-m3w5 (zod <4.6.6, uncontrolled memory use when validating oversized arrays), for the zod 3.25.76 copy required by `shadcn@4.7.0`. No zod 3.x release fixes it, and forcing zod 4 into shadcn 4.7.0 crashes its CLI (`deepPartial is not a function`). shadcn moved to zod 4 (`^4.2.0`) in 4.22.0.

## What Changes

- Upgrade the `shadcn` devDependency from `4.7.0` to `4.23.0` (still pinned exactly). Its zod 4 range is satisfied by the existing `zod@>=4.0.0 <4.6.6 -> 4.6.6` override, so the lockfile resolves only zod 4.6.6.
- Remove the `@modelcontextprotocol/sdk@<1.32.0` override. That package only reached the tree through `shadcn@4.7.0` and is no longer installed. The body-parser and proxy-addr pins stay because `express` is still installed through `@workflow/web`.
- Remove the `hono@>=4.12.0 <4.13.7` override. hono also only reached the tree through `shadcn@4.7.0` and is no longer installed.
- Regenerate `pnpm-lock.yaml` with pnpm 10. `pnpm-workspace.yaml` is untouched.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `dependency-security`: The `shadcn` toolchain path no longer carries an unpatched advisory, so the exception for advisories with no same-major patch is removed.

## Impact

- `src/app/globals.css` imports `shadcn/tailwind.css`. The 4.23.0 stylesheet keeps the 4.7.0 content unchanged and appends two families of utilities added in shadcn 4.22: a text-highlight animation and scroll-edge masks. It also appends their typed custom-property registrations, their theme keyframes, and one unlayered reduced-motion rule.
- The app does not use the new utilities, custom properties, or keyframes. This record deliberately avoids naming them literally, because Tailwind scans repository Markdown for class candidates. Built CSS was compared before and after with `pnpm run build`:
  - Two of three CSS files are byte-identical. The main stylesheet grows by 900 bytes (130,959 -> 131,859), measured after this record was written.
  - The additions are limited to the new typed custom-property registrations, their initial values in Tailwind's `@supports` fallback for browsers without `@property` support, and the unlayered reduced-motion rule for the text-highlight utility.
  - None of the new utilities or keyframes are emitted, and nothing reads the new custom properties, so rendering is unchanged.
- The shadcn CLI (`shadcn --version`, `shadcn info`) works with the repository `components.json`. No repo script or CI workflow invokes it.
- It does not affect auth, admin permissions, data integrity, Supabase, API contracts, Vercel deployment configuration, or UI smoke coverage.

## Non-Goals

- Adding audit waivers or ignore entries.
- Upgrading other direct dependencies or changing `pnpm-workspace.yaml`.
