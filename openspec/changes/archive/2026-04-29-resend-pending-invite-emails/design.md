## Context

User Management already lists Supabase Auth users and exposes admin actions from
the detail sheet. Invites are created through the trusted server route
`/api/admin/users`, which calls Supabase Auth Admin with a `/reset-password`
redirect. Pending invited users are recognizable from Auth timestamps, but the
current sheet offers password reset instead of resending the invite email.

## Goals / Non-Goals

**Goals:**
- Add an admin-only resend action for users whose invite remains pending.
- Keep the action server-side so the Supabase service role never reaches the
  browser.
- Return the refreshed user record so the sheet reflects the new invite sent
  timestamp.
- Preserve existing role, allowlist, disabled-account, and password reset flows.

**Non-Goals:**
- Do not generate or expose raw invite links in the admin UI.
- Do not introduce a custom email provider.
- Do not add migrations or change RLS policies.
- Do not alter Vercel deployment behavior.

## Decisions

- Use `admin.auth.admin.inviteUserByEmail` for resend instead of
  `generateLink`.
  - Rationale: the accepted behavior is email delivery through the existing
    Supabase invite template. `generateLink` is for custom delivery and would
    require a new manual copy/send flow.
  - Alternative considered: generate a raw invite link and copy it. Rejected
    because the requested default is email resend.
- Gate resend by Auth timestamps rather than client-only status.
  - Rationale: server enforcement must ensure the target has an email, has an
    invite timestamp, and has not confirmed, accepted, or signed in.
  - Alternative considered: trust `accountStatus === "pending_invite"` only.
    Rejected because the helper should produce a precise action error if status
    derivation changes.
- Reuse the existing User Management sheet smoke surface.
  - Rationale: the page and detail sheet already have smoke markers, and this
    feature adds an action inside that surface rather than a new dialog or route.

## Risks / Trade-offs

- Supabase invite resend rate limits or provider failures could return an admin
  API error. Mitigation: surface a generic `500` to users and log normalized
  error details through existing route error handling.
- Existing dirty DB/auth work inflates verification requirements. Mitigation:
  keep this diff scoped and run the required aggregate gate for the candidate
  tracked tree.
- If Supabase changes invite semantics, pending checks still prevent resends to
  confirmed accounts before any provider call. Mitigation: direct unit coverage
  for the action-state checks and route errors.
