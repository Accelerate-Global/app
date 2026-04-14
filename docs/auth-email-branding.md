# Auth Email Branding Runbook

This project uses Supabase Auth for sign-in, password recovery, and email-change
links. The password reset UI lives in the app, but sender branding and link-host
branding are controlled by hosted Supabase Auth.

## Current state

- Project ref: `uuyntfbqksnclyvlpecx`
- Password reset requests already route back through
  `https://data.accelerateglobal.org/auth/confirm?next=/reset-password`
- The project is currently using Supabase's default email sender
  (`noreply@mail.app.supabase.io`)
- `supabase domains get --project-ref uuyntfbqksnclyvlpecx` currently reports that
  the Custom Domain add-on is not enabled, so hosted link branding cannot be
  activated until billing/add-on setup is complete

## Branded sender setup with Resend

1. Verify `accelerateglobal.org` inside Resend.
2. Publish the SPF, DKIM, and DMARC records that Resend gives you.
3. Create an SMTP API key in Resend.
4. In Supabase Dashboard -> Authentication -> SMTP Settings, configure:
   - Host: `smtp.resend.com`
   - Port: `587`
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
- Use the subject:
  `Reset your Accelerate Global Data password`
- Keep the CTA link based on `{{ .ConfirmationURL }}` so Supabase continues to generate
  the signed recovery link; once the custom domain is active, that URL will use the
  branded host automatically

## Verification checklist

1. Submit a forgot-password request from `https://data.accelerateglobal.org/forgot-password`
2. Confirm the sender shows `Accelerate Global Data <noreply@accelerateglobal.org>`
3. Confirm the reset CTA host is `auth.data.accelerateglobal.org`
4. Complete the flow and verify it lands on
   `https://data.accelerateglobal.org/reset-password`
5. Set a new password and sign in successfully
