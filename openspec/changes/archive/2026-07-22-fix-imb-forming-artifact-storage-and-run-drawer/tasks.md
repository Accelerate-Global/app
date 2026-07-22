## 1. Artifact Storage

- [x] 1.1 Add an idempotent Supabase migration that keeps the artifact bucket private, restores the 128 MiB limit, and permits JSON and CSV artifacts
- [x] 1.2 Extend database security coverage for the artifact bucket policy
- [x] 1.3 Log normalized Supabase upload failures while preserving the safe forming error shown to users
- [x] 1.4 Add focused storage tests for CSV uploads and upload failures

## 2. Run Detail Drawer

- [x] 2.1 Make the run detail drawer half the viewport width on desktop and full width on narrow screens
- [x] 2.2 Contain and wrap long forming identifiers within their metadata cells
- [x] 2.3 Update component coverage for the drawer width and forming metadata presentation

## 3. Verification and Completion

- [x] 3.1 Run the focused unit, database, and UI smoke checks required by the change plan
- [x] 3.2 Run the repository terminal verification gate and resolve any failures
- [x] 3.3 Sync the accepted behavior into main specs and verify the OpenSpec change against its implementation
