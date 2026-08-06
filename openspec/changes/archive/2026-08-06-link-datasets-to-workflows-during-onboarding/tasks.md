## 1. Configuration model

- [x] 1.1 Add a Supabase migration and schema/profile validation updates that allow distinct Tier 2 feed profiles to share one owner key while preserving unique feed and Sheet identities.
- [x] 1.2 Add typed onboarding workflow-assignment contracts, normalization, header-column validation, active source-alias validation, and active engagement-contract resolution.
- [x] 1.3 Extend Google Sheets connection creation so connections and requested Tier 1 bindings or Tier 2 profiles commit atomically with correct per-workflow classification.

## 2. Guided onboarding

- [x] 2.1 Add per-tab optional workflow state and reducer coverage without changing CSV onboarding.
- [x] 2.2 Add accessible workflow, owner/feed, stable-key, tracking, and optional evidence controls using reviewed Sheet headers.
- [x] 2.3 Show exact workflow assignments in final review and submit them through the guarded connection endpoint before initial imports.

## 3. Tests and documentation

- [x] 3.1 Add focused unit, route, component, and database tests for unlinked, Tier 1, Tier 2, shared-owner, invalid-column, duplicate, and atomic rollback behavior.
- [x] 3.2 Update the operator and Tier 2 runbooks to describe onboarding linkage and the distinction between Accelerate-owned Tier 1 data and Accelerate-managed Tier 2 feeds.
- [x] 3.3 Run `pnpm run verify:change`, every listed required command, `pnpm run smoke:check`, and `pnpm run verify:change:run`; fix all product, test-gap, environment, or harness failures.
- [x] 3.4 Verify the Joshua Project credential is stored only in the AX Online connection Vault and confirm the code-managed connection can authenticate without exposing the secret.
- [x] 3.5 Archive the completed OpenSpec change after implementation and verification; do not merge or deploy without separate authorization.
