## Context

The security scan identified vulnerabilities across framework dependency posture, CSV output handling, and admin refresh route semantics. The app already centralizes same-origin mutation checks in `src/proxy.ts` and `src/lib/request-security.ts`, and the affected refresh routes currently bypass that protection only because they mutate through `GET`.

## Goals / Non-Goals

**Goals:**
- Patch framework and transitive dependency advisories with explicit dependency versions and lockfile resolution.
- Enforce spreadsheet formula neutralization at the shared CSV serialization boundary used by dataset downloads, API connection downloads, and import snapshots.
- Move admin refresh endpoints to same-origin protected `POST` requests without changing admin eligibility or refresh data semantics.
- Cover the security invariants with focused tests plus the repo verification gates.

**Non-Goals:**
- No changes to Supabase schema, RLS policy, or remote data.
- No changes to workspace role resolution or first-admin bootstrap.
- No UI layout or smoke-route changes beyond the refresh clients' HTTP method.

## Decisions

- Upgrade `next` and `eslint-config-next` to exact `16.2.6`. This is the minimal current patched release for the incomplete proxy-bypass follow-up and avoids a broader framework upgrade.
- Keep `shadcn` available as developer/build tooling, not runtime app code, and pin vulnerable transitive packages with `pnpm.overrides`. The CI dependency audit checks the installed tree, so patched transitive resolution is required even after moving `shadcn` out of runtime dependencies.
- Put CSV hardening in `src/lib/csv.ts` and reuse it from all repo-owned CSV writers touched by the findings. This prevents future serializers from preserving formula-leading cells while preserving each caller's existing BOM and line-ending conventions.
- Convert source refresh routes to `POST` rather than expanding same-origin mutation protection to include selected `GET` paths. Mutation-over-GET is the unsafe contract; keeping the central guard method-based avoids route-specific exceptions.

## Risks / Trade-offs

- Dependency overrides can mask upstream package lag. Mitigation: use overrides only for patched semver-compatible transitive packages identified by audit and verify with both full and production audit commands.
- Apostrophe-prefix hardening intentionally changes CSV cell bytes for formula-leading values. Mitigation: apply only to cells whose first non-space character can trigger spreadsheet formula interpretation and test normal quoting behavior remains intact.
- `GET` refresh callers will receive `405` after this change. Mitigation: only admin dashboard clients should call these endpoints, and they will be updated to `POST`; route tests will lock the `Allow: POST` fallback.
