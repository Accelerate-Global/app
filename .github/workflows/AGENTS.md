# Workflow Notes

- Pin `uses:` entries to full commit SHAs, not floating major tags.
- Keep workflow permissions minimal.
- Use Supabase CLI `2.75.0` in repo workflows unless the repo intentionally validates and updates that pin.
- `Dependency Audit` should no-op cleanly when `package.json` and `pnpm-lock.yaml` are unchanged.
- `OpenSpec` should validate specs and archive readiness without requiring machine-local Codex OPSX prompts.
