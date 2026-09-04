# Open Questions

- [x] What exact provider procedure creates or restores the first admin in each environment?
  Evidence: `docs/operations/access-governance.md` defines owner approval,
  allowlist ordering, provider invitation, server-only app-metadata promotion,
  fresh-session verification, recovery, and offboarding.

- [x] What are the production Supabase backup, restore, retention, and incident response expectations?
  Evidence: `docs/operations/samson-data-archive.md`, the archive OpenSpec, the
  local backup/prune/rehydration engines, the signed receipt route, and the
  provisioned Samson guest define the policy and implementation.

- [x] What physically separate destination will become the off-site Restic copy?
  Decision: none is currently selected. Samson remains an explicitly accepted
  single-site recovery location; adding an off-site copy is a future resilience
  project that begins only after the owner selects and authorizes a provider.

- [x] Are GitHub branch protection rules enforcing the release checks listed in `docs/release.md`?
  Evidence: the 2026-09-04 readiness cleanup verified strict required checks on
  `main`, administrator enforcement, force-push/deletion protection, and the
  repository security controls listed in `docs/release.md`.

- [x] What is the ownership process for approving signup allowlist additions?
  Evidence: `docs/operations/access-governance.md` assigns approval to a
  `super_admin`, execution to an administrator, least-privilege role selection,
  session refresh, and separate account removal.

- [x] What external API endpoints are approved for admin API connections?
  Evidence: `docs/operations/api-connection-governance.md` names the supported
  code-managed and Google Sheets providers and requires an OpenSpec/code review
  before any new host, credential, method, or purpose reaches production.
