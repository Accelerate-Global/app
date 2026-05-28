## Why

The pre-publication audit removed real personal/admin identifiers from the
current tracked tree. A lightweight repo guard should prevent that class of
publication-safety regression before the repository is made public.

## What Changes

- Add a tracked test that scans repo-tracked text files for disallowed real
  personal/admin identifier patterns.
- Document the publication-safety rule for contributors.
- Keep public project/domain identifiers and neutral `example.com` fixtures
  allowed.

## Impact

- Affects repo workflow/privacy posture only.
- Does not scan Git history, rewrite history, rotate secrets, or change runtime
  application behavior.
