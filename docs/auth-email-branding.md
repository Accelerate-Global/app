# Auth Email Branding Runbook

This project uses Supabase Auth for invites, sign-in, password recovery, and
email-change links. The app owns the browser flows, but sender branding,
template content, and auth-link branding are controlled by hosted Supabase Auth.

## Current state

- Project ref: `uuyntfbqksnclyvlpecx`
- Hosted Supabase Auth is configured to send through Resend as
  `Accelerate Global Data <noreply@accelerateglobal.org>`.
- The Resend sending domain is `accelerateglobal.org`.
- Password reset and invite templates should route through
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=<type>`
  so the app verifies the token hash server-side before rendering the password
  setup page. The app passes `{{ .RedirectTo }}` as
  `https://data.accelerateglobal.org/auth/confirm?next=/reset-password`.
- `supabase domains get --project-ref uuyntfbqksnclyvlpecx` currently reports that
  the Custom Domain add-on is not enabled, so hosted link branding cannot be
  activated until billing/add-on setup is complete
- The only repo-owned hosted Auth templates are Invite and Recovery.
- Do not run `supabase config push` against the hosted project from the local
  development config. The local config intentionally contains development auth
  URLs and rate limits. Publish only the email template fields through the
  Dashboard or a targeted Management API patch.

## Branded sender setup with Resend

1. Verify `accelerateglobal.org` inside Resend.
2. Publish the SPF, DKIM, and DMARC records that Resend gives you.
3. Create an SMTP API key in Resend.
4. In Supabase Dashboard -> Authentication -> SMTP Settings, configure:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: your Resend SMTP API key
   - Sender email: `noreply@accelerateglobal.org`
   - Sender name: `Accelerate Global Data`
5. Keep link tracking disabled for auth emails so the password reset URL is not
   rewritten by the email provider.

## Branded auth-link host

1. Enable the Supabase Custom Domain add-on for the project.
2. Create a DNS CNAME:
   - Name: `auth.data`
   - Target: `uuyntfbqksnclyvlpecx.supabase.co.`
3. Register the hostname with Supabase:

   ```bash
   supabase domains create \
     --project-ref uuyntfbqksnclyvlpecx \
     --custom-hostname auth.data.accelerateglobal.org
   ```

4. Add the TXT validation record returned by the command.
5. Re-run verification until Supabase issues the certificate:

   ```bash
   supabase domains reverify --project-ref uuyntfbqksnclyvlpecx
   ```

6. Activate the hostname:

   ```bash
   supabase domains activate --project-ref uuyntfbqksnclyvlpecx
   ```

Supabase documents that the default project URL keeps serving requests after activation,
but Auth immediately starts advertising the custom hostname. If OAuth providers are added
later, add the custom-domain callback URL alongside the default Supabase callback URL
before activation.

## Recovery email template

- The canonical local template for password recovery lives at
  `supabase/templates/recovery.html`
- In hosted Supabase, copy that HTML into Authentication -> Email Templates -> Recovery
  or patch only `mailer_templates_recovery_content` through the Management API
- Use the subject:
  `Reset your Accelerate Global Data password`
- Use the token-hash confirmation URL from `supabase/templates/recovery.html`:
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`
- Do not render `{{ .SiteURL }}` or the sentence
  `This link will open the password reset flow at ...`; the reset CTA should be
  the only primary action link.
- Do not use `{{ .ConfirmationURL }}` for the recovery CTA in this SSR app; the
  app needs `/auth/confirm` to verify the token hash and set session cookies
  before `/reset-password` renders

## Invite email template

- The canonical local template for invites lives at
  `supabase/templates/invite.html`
- In hosted Supabase, copy that HTML into Authentication -> Email Templates -> Invite
  or patch only `mailer_templates_invite_content` through the Management API
- Use the subject:
  `You have been invited to Accelerate Global Data`
- The invite body intentionally does not render `{{ .SiteURL }}` anywhere. This
  avoids email clients auto-linking the site URL and pulling attention away from
  the real CTA:
  `Accept the invite`
- Use the token-hash confirmation URL from `supabase/templates/invite.html`:
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite`

## Template design contract

- Keep Invite and Recovery visually matched. Both templates should use
  email-safe static HTML with inline fallbacks and no component build step.
- Match the dashboard page, not a marketing email:
  - Use the same plain page background as the app shell.
  - Render the real AG logo at top-left from
    `https://data.accelerateglobal.org/ag-logo.svg`.
  - Keep the logo pinned to the page shell's left edge, then offset the message
    body to match the dashboard content column.
  - Use heading typography from the app's serif fallback stack and the same
    compact primary button shape.
  - Do not wrap the message in a decorative centered card, accent stripe,
    radial background, or box shadow.
- Include light and dark app palette fallbacks:
  - Light background/text/button: `#f7f6ef`, `#262531`
  - Dark background/text/button: `#181720`, `#f5f1e8`
  - Muted copy: `rgba(38, 37, 49, 0.68)` and
    `rgba(245, 241, 232, 0.72)`
- Avoid rendering `{{ .Email }}` in the visible recovery copy because email
  clients turn it into a blue mailto-style link.

## Verification checklist

1. Send a fresh invite from the user-management flow and confirm the email only has one
   obvious action link:
   `Accept the invite`
2. Confirm the invite body does not render `data.accelerateglobal.org` as a clickable
   link outside the CTA.
3. Submit a forgot-password request from `https://data.accelerateglobal.org/forgot-password`
4. Confirm the sender shows `Accelerate Global Data <noreply@accelerateglobal.org>`
5. Confirm the reset CTA path is `/auth/confirm` with `token_hash`, `type=recovery`,
   and `next=/reset-password`
6. Confirm the recovery email does not render the removed reset-flow site URL
   sentence.
7. Complete the flow and verify it lands on
   `https://data.accelerateglobal.org/reset-password`
8. Set a new password and verify the browser lands on
   `https://data.accelerateglobal.org/dashboard`
