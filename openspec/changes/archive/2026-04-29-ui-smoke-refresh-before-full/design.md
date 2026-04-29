## Context

The UI smoke bootstrap process generates a random allowlisted signup email and
writes it to `tests/ui/.tmp/bootstrap.json`. In `--targeted-and-full` mode, the
smoke runner currently executes targeted suites and then full suites against the
same bootstrap file. If targeted smoke includes the sign-up journey, that email
is registered before full smoke starts.

## Decision

Refresh smoke bootstrap data after targeted suites and before the full suite.
This generates a fresh allowlisted signup email and restores deterministic smoke
fixtures without restarting the Next app or local Supabase stack.

## Risks

- Reseeding fixtures between suites adds a small amount of runtime.
- If a future targeted suite intentionally depends on mutations carrying into
  full smoke, that dependency should be represented as explicit seeded data
  instead of shared suite state.
