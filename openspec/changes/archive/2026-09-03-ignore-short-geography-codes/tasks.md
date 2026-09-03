## 1. Resolver fix

- [x] 1.1 Ignore short country codes during contained-phrase ambiguity detection while preserving exact-code lookup.
- [x] 1.2 Add regressions for the exact Frontier/Sudan and dual-filter/Sudan questions.

## 2. Verification and release

- [x] 2.1 Pass focused resolver and private-chat tests plus the repository-required local gates.
- [x] 2.2 Keep production on the prior healthy deployment and require the exact failed cases plus the complete Blake-only canary after deployment.
