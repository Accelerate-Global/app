## Context

The release branch passed application, browser, database, and local ship verification, but GitHub rejected it when the current registry advisory set reported high-severity paths through Next.js 16.2.6, brace-expansion 1.1.14, fast-uri 3.1.2, and sharp 0.34.5. `pnpm-workspace.yaml` is the repository source of truth for transitive overrides, while `package.json` pins the framework and matching ESLint configuration.

## Goals / Non-Goals

**Goals:**

- Clear all high-severity findings from the installed graph used by CI.
- Patch compatible moderate and low transitive findings when they can be verified without changing product behavior.
- Keep framework and ESLint integration versions aligned.
- Preserve the existing application, Supabase, Vercel, and UI behavior.

**Non-Goals:**

- Broadly update unrelated dependencies.
- Change application APIs, authentication, permissions, data models, or pipeline behavior.
- Suppress, waive, or lower the audit threshold.

## Decisions

- Upgrade `next` and `eslint-config-next` together to 16.2.11, the first release outside the reported framework advisory range. A patch update is lower risk than an audit waiver or unrelated framework upgrade.
- Update existing workspace overrides to patched releases and add narrowly scoped overrides for newly vulnerable transitives. This keeps transitive resolution explicit and reproducible instead of adding implementation-only packages as direct dependencies.
- Allow the patched Sharp and Hono server releases through overrides only after the production build and developer CLI entry point pass. These dependencies are reached through Next.js image support and the shadcn developer toolchain respectively.
- Regenerate the lockfile with pnpm, run `pnpm audit --audit-level=high`, exercise `pnpm exec shadcn --help`, and return to the repository terminal and ship gates. The GitHub Dependency Audit check remains the authoritative merge gate.

## Risks / Trade-offs

- [A patched 0.x Sharp release is semver-major relative to Next.js declared range] → Verify the complete production build and UI smoke suite before merge.
- [The patched Hono server release crosses a major version in a developer-only path] → Verify the shadcn CLI loads successfully and retain it only if the installed graph and application verification pass.
- [Transitive overrides can outlive the parent package need] → Keep exact versions centralized in `pnpm-workspace.yaml` and remove them during a later parent dependency upgrade when the lockfile resolves safely without overrides.
- [A new registry advisory can appear after local verification] → Keep the protected GitHub audit mandatory and rerun shipping against the updated commit.

## Migration Plan

1. Update direct framework pins and transitive overrides.
2. Regenerate the lockfile and install the resolved graph.
3. Run the focused dependency audit and developer CLI check.
4. Run the full repository verification and ship gates.
5. Push the security patch to the existing PR and let all protected checks rerun.

Rollback is a normal commit revert of the dependency and OpenSpec patch if verification exposes incompatibility; no database or production-data rollback is required.

## Open Questions

None.
