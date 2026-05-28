# Open Questions

- [ ] What exact provider procedure creates or restores the first admin in each environment?
  Evidence: README and AGENTS state first-admin bootstrap is manual/provider-owned, but no tracked runbook defines the steps.

- [ ] What are the production Supabase backup, restore, retention, and incident response expectations?
  Evidence: Supabase config, migrations, and DB tests are tracked; production operational policy is not.

- [ ] Are GitHub branch protection rules enforcing the release checks listed in `docs/release.md`?
  Evidence: Release docs call this out as manual follow-up; repository settings are not represented in tracked files.

- [ ] What is the ownership process for approving signup allowlist additions?
  Evidence: README documents the table and SQL shape, but not who approves access.

- [ ] What external API endpoints are approved for admin API connections?
  Evidence: API connection code exists and validates requests, but no policy document defines allowed providers or data governance rules.

- [ ] Should Google Sheets OAuth be supported in production after the repository move?
  Evidence: `.env.example` documents Google OAuth env vars, but the latest Vercel
  env inventory did not show those keys in the project.
