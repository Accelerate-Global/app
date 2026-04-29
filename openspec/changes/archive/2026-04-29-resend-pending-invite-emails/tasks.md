## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before implementation and record required commands.
- [x] 1.2 Run `pnpm run task:kickoff` for the admin/UI/auth owned paths.

## 2. Server Behavior

- [x] 2.1 Tighten invited-account status mapping so confirmed invited users are active.
- [x] 2.2 Add pending invite resend validation and Supabase invite email resend helper.
- [x] 2.3 Add the admin-only invite resend API route and error mapping.

## 3. User Management UI

- [x] 3.1 Add pending-only resend invite action to the detail sheet.
- [x] 3.2 Hide password reset action for pending invite accounts.
- [x] 3.3 Update success/error messaging and analytics tracking.

## 4. Tests and Verification

- [x] 4.1 Add library, route, and component tests for pending resend behavior.
- [x] 4.2 Run direct Vitest coverage for touched files.
- [x] 4.3 Run `pnpm run spec:validate`, `pnpm run smoke:check`, and `pnpm run verify:fast`.
- [x] 4.4 Rerun `pnpm run verify:change` and complete `pnpm run verify:change:run`.
