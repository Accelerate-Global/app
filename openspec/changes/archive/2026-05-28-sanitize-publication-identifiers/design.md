## Context

The repository already documents first-admin bootstrap as a manual
environment/provider concern, but older migrations and archived planning text
still name real admin identities. Those identifiers are not secret keys, but
they are personal/admin PII and permission-sensitive when publishing the repo.

## Approach

- Sanitize current tracked files by replacing real email identifiers with
  neutral `example.com` identities.
- Preserve migration shape where old local-reset fixtures need deterministic
  behavior, but use neutral example users instead of real accounts.
- Update current OpenSpec requirements to describe provider-owned bootstrap
  without naming a person or email address.
- Keep the audit report separate under ignored `.tmp/` artifacts and explicitly
  mark history rewrite as an approval-gated follow-up.

## Verification

- Re-run the audit scans for current-tree sensitive identifiers.
- Run same-stem tests touched by migration/spec expectations.
- Run `pnpm run spec:validate` and the repo terminal gate.

## Risks

- Editing old migration contents can alter local reset bootstrap fixtures, but
  remote migration drift in this repo is version-based and current docs already
  treat real first-admin setup as provider-owned. The change is limited to
  current-tree publication safety and does not push remote database changes.
