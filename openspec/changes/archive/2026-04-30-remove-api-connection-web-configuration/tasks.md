## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before editing and record the initial verification plan.
- [x] 1.2 Run `pnpm run task:kickoff -- --scope src/components/dashboard/api-connections-client.tsx --scope src/components/dashboard/api-connections-client.test.tsx --scope src/app/dashboard/api-connections/page.tsx --scope src/app/dashboard/api-connections/page.test.tsx --scope 'src/app/api/admin/api-connections/**' --scope openspec/changes/remove-api-connection-web-configuration/** --scope openspec/specs/api-connection-runs/spec.md`.

## 2. Run-Only Dashboard

- [x] 2.1 Remove presets, new connection, save, delete, and editable request/import configuration controls from the API Connections client.
- [x] 2.2 Keep saved connection selection, Test, Import, latest output, run history, logs, imported dataset links, and output downloads for selected saved connections.
- [x] 2.3 Update the API Connections page copy to describe running code-managed saved connections instead of configuring reusable requests.

## 3. Web Write API Removal

- [x] 3.1 Disable `POST /api/admin/api-connections` so it rejects profile creation without calling `createApiConnection`.
- [x] 3.2 Disable `PATCH` and `DELETE /api/admin/api-connections/[connectionId]` so they reject profile updates/deletions without calling write helpers.
- [x] 3.3 Preserve list, run, history, detail, and download route behavior.

## 4. Tests and Specs

- [x] 4.1 Update component/page tests to assert configuration controls are absent and run/output behavior remains available.
- [x] 4.2 Update route tests for create/update/delete rejection and unchanged list/run behavior.
- [x] 4.3 Run `pnpm run spec:validate`, direct changed tests, and `pnpm run smoke:check` during implementation.
- [x] 4.4 Run `pnpm run verify:change` again and complete every required command through `pnpm run verify:change:run`.
