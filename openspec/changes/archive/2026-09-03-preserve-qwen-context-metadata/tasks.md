## 1. Regression fix

- [x] 1.1 Restore validated retrieval metadata while continuing to omit duplicate serialization.
- [x] 1.2 Update the gateway regression tests for exact forwarded and omitted fields.

## 2. Verification and release

- [x] 2.1 Pass focused tests and the repository-required local gates.
- [x] 2.2 Keep production rolled back while the exact failed single-turn cases pass against the forward context shape on Samson.
- [x] 2.3 Record the rollback and require a complete Blake-only post-deploy canary before release acceptance.
