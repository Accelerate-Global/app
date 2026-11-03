## Why

After the Next.js 16.4.1 upgrade, the protected Dependency Audit (`pnpm audit --audit-level=high`) still reported one critical and twenty-two high advisories in transitive runtime and toolchain paths (devalue, proxy-addr, body-parser, `@modelcontextprotocol/sdk`, undici 6.x and 7.x, zod 4.x, vite, systeminformation, source-map-js). Each one has a patched release in the same major version.

## What Changes

- Update the existing `package.json` `pnpm.overrides` security pins for devalue and undici, and add same-major pins for `@modelcontextprotocol/sdk`, body-parser, proxy-addr, source-map-js, systeminformation, vite, and zod 4.x, each to the lowest patched release.
- Regenerate `pnpm-lock.yaml` with pnpm 10. No direct dependency ranges change, and `pnpm-workspace.yaml` is untouched.
- Record that GHSA-mrhx-c7xc-m3w5 remains open for the zod 3.x copy required by `shadcn@4.7.0`. No zod 3.x patch exists, and forcing zod 4 breaks the shadcn CLI, so clearing it needs a separate decision: either a shadcn upgrade or an audit waiver.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `dependency-security`: Transitive toolchain and runtime paths resolve to patched same-major releases, and an advisory that cannot be patched within its major version is recorded instead of being forced.

## Impact

- Affects dependency resolution only: `package.json`, `pnpm-lock.yaml`, and this specification. It does not change auth, admin permissions, data integrity, Supabase, API contracts, Vercel deployment configuration, or UI smoke coverage.
- The protected Dependency Audit still reports one high advisory (zod 3.25.76 via `shadcn`) until that decision is made.

## Non-Goals

- Upgrading `shadcn` or any other direct dependency.
- Adding audit waivers or ignore entries.
