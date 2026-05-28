## Context

The repo release runbook, ship script, and Release Health workflow already define production deployment as a merge to `main`. The Vercel project still has a custom `staging` environment whose latest deployment metadata points at the old `accelerate-core` repository and `preview` branch, with no custom environment variables or custom domains.

## Goals / Non-Goals

**Goals:**

- Remove stale Vercel staging provider state for the `online` project.
- Make Vercel automatic builds main-only so an old `preview` branch cannot act as a staging target.
- Document the supported deployment workflow as PR validation followed by production deployment from `main`.

**Non-Goals:**

- Do not remove GitHub PR checks or `pnpm ship --pr`.
- Do not change the production domain, production branch, Supabase configuration, or runtime app code.
- Do not disable ordinary local verification or release-health checks.

## Decisions

- Delete the custom environment instead of repurposing it. The existing environment has no current repo branch matcher, domains, or environment variables, so retaining it would keep an unsupported path alive without adding safety.
- Keep PR checks as the validation layer. This preserves the current low-friction workflow without reintroducing a paid or manually promoted staging environment.
- Update the Vercel ignored-build-step command rather than adding repo deployment scripts. Vercel Git integration remains the production deploy mechanism, and the repo already verifies production after merge.

## Risks / Trade-offs

- Manual `vercel deploy --target=staging` or `vercel pull --environment=staging` will stop working. This is intended because staging is no longer a supported deployment target.
- If the Vercel API update fails, the same main-only ignored-build-step change must be applied in the Vercel dashboard and verified through the API afterward.
- Rollback is provider-level: recreate a `staging` custom environment and restore the previous ignored-build-step command if staging is needed again.
