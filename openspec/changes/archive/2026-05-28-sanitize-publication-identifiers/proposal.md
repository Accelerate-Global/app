## Why

The pre-publication audit found that current tracked files expose real
environment-specific admin identity details in tests, docs, archived OpenSpec
artifacts, and historical Supabase migrations. The repo should be safe to make
public without publishing personal/admin email identifiers or implying that a
tracked migration owns production first-admin bootstrap.

## What Changes

- Replace real personal/admin email identifiers in current tracked files with
  neutral example addresses.
- Update workspace-role documentation and specs so first-admin bootstrap is an
  environment/provider-owned operation, not a named-person migration contract.
- Keep current runtime role semantics unchanged: `super_admin` remains
  admin-capable, only super admins can grant protected super-admin changes, and
  the last active super-admin protections remain intact.
- Record that reachable Git history still requires explicit history-rewrite
  approval before the repository is made public if the owner wants the previous
  identifiers purged from history.

## Impact

- Affects auth/admin bootstrap privacy posture and current-tree publication
  readiness.
- Affects Supabase migration fixture content and tests that assert historical
  migration text.
- Does not rotate provider secrets, rewrite Git history, change remote Supabase
  data, or change current app authorization rules.
