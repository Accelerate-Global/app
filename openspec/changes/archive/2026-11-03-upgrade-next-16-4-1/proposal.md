## Why

Next.js 16.3.8, the currently installed framework release, is inside the vulnerable ranges of three critical advisories: GHSA-673q-mjm6-r5xr (remote code execution through `use cache` typed-array deserialization), GHSA-2464-fhr4-w9xw (remote code execution in Image Optimization with SVG input), and GHSA-p3m5-59mp-jv5r (Server Actions denial of service). All three are patched in Next.js 16.4.1, the approved target release.

## What Changes

- Pin `next` to exactly `16.4.1` and move `eslint-config-next` (and therefore `@next/eslint-plugin-next`) to the matching `16.4.1` release.
- Regenerate `pnpm-lock.yaml` with pnpm 10, limited to the Next.js package family and the transitive resolutions it requires (for example `sharp` 0.35.5 required by Next.js 16.4.1).
- Keep the existing dependency override semantics in `package.json` and `pnpm-workspace.yaml` unchanged, so the lockfile `overrides` block still matches the configuration and `pnpm install --frozen-lockfile` passes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `dependency-security`: The installed Next.js framework must resolve outside the November 2026 critical advisory ranges.

## Impact

- Affects dependency resolution only: `package.json`, `pnpm-lock.yaml`, and this specification. It does not change auth, admin permissions, data integrity, Supabase schema or RLS, API contracts, Vercel deployment configuration, or UI smoke coverage.
- Existing dependency policy is documented in `openspec/specs/dependency-security/spec.md`; the GitHub Dependency Audit workflow (`.github/workflows/dependency-audit.yml`) is the release evidence source.

## Non-Goals

- Upgrading to a newer Next.js patch than the approved 16.4.1, or a broad dependency refresh.
- Changing or consolidating the pnpm override definitions.
