## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before implementation and record required commands.
- [x] 1.2 Run `pnpm run task:kickoff -- --scope "supabase/templates/** docs/auth-email-branding.md"`.

## 2. Templates and Documentation

- [x] 2.1 Restyle invite and recovery templates with application-aligned inline email styles.
- [x] 2.2 Remove the recovery site URL footer line while preserving the token-hash CTA.
- [x] 2.3 Update the auth email branding runbook with the current SMTP state and template publication steps.

## 3. Hosted Supabase Operations

- [x] 3.1 Delete `removed-user@example.com` from hosted Auth and `signup_email_allowlist`.
- [x] 3.2 Publish the verified invite and recovery HTML to hosted Supabase Auth templates.
- [x] 3.3 Verify hosted deletion readback and trigger a recovery email through hosted Auth.

## 4. Tests and Verification

- [x] 4.1 Add focused Vitest coverage for template tokens, branding values, and removed recovery footer.
- [x] 4.2 Run the direct template test.
- [x] 4.3 Run `pnpm run spec:validate`, rerun `pnpm run verify:change`, and complete `pnpm run verify:change:run`.
