# Access governance

This runbook owns first-administrator bootstrap, role recovery, signup-allowlist
approval, and user offboarding. Authorization comes only from
`auth.users.raw_app_meta_data.workspace_role`; user-editable metadata is never
an authorization source.

## Ownership

- A current `super_admin` approves new workspace access and every
  `super_admin` assignment. The approval record stays in the organization's
  private operating system, not in a public issue.
- An `admin` may execute an approved invite or allowlist change through User
  Management. The allowlist note should contain a short approval reference and
  purpose, not sensitive personal information.
- The Supabase project owner performs first-admin bootstrap or emergency
  recovery when no working `super_admin` session exists.

## First administrator or emergency recovery

Use this procedure separately for each environment. It is a provider operation,
not a migration, seed, or Vercel environment variable.

1. Confirm the exact Supabase project and application environment. Check that
   tracked migrations are current and **Allow new users to sign up** remains
   disabled in Supabase Auth.
2. Record the approved administrator email and intended role in a private
   operator record. Use `super_admin` only for the minimum recovery-capable
   owner set.
3. In Supabase SQL Editor, add the normalized email before creating the Auth
   user so the database signup guard can admit it:

   ```sql
   insert into public.signup_email_allowlist (email, note)
   values (lower(btrim('person@example.com')), 'First-admin approval YYYY-MM-DD')
   on conflict (email) do update
   set note = excluded.note;
   ```

4. In **Authentication → Users**, use **Add user → Send invitation**. Do not
   create Auth rows with SQL. Copy the resulting user UUID from the provider.
5. From a trusted server-only operator environment, call Supabase Auth Admin
   `getUserById` and then `updateUserById`. Merge the existing `app_metadata`
   and set `workspace_role` to `super_admin`; do not overwrite provider keys.
   Use only the project's secret/service-role credential, never a publishable
   or browser key:

   ```ts
   const { data: current, error: readError } =
     await supabase.auth.admin.getUserById(userId);
   if (readError || !current.user) throw readError ?? new Error("User missing");

   const { data: updated, error: updateError } =
     await supabase.auth.admin.updateUserById(userId, {
       app_metadata: {
         ...current.user.app_metadata,
         workspace_role: "super_admin",
       },
     });
   if (updateError) throw updateError;
   ```

6. Have the user accept the invitation, then sign out and back in so the access
   token contains current app metadata. Verify the user can open User Management
   and that a normal `pro` user still cannot open an admin route.
7. Confirm a second recovery-capable owner before removing or demoting the only
   working `super_admin`.

The supported provider operations are documented by Supabase's
[user invitation](https://supabase.com/docs/guides/auth/users#inviting-users)
and [admin metadata update](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid)
references. Never expose the secret key to the browser or paste it into a repo,
issue, log, or shell command argument.

## Normal allowlist and invitation flow

1. A `super_admin` approves the exact lowercase email, role, purpose, and
   expiration/review date when applicable.
2. An administrator opens User Management, adds the email to the allowlist with
   the approval reference, and sends the invitation from the same protected
   flow. Global self-signup remains disabled; an allowlist row alone cannot
   create an account.
3. Assign the least-privilege role: `basic` or `pro` for ordinary use, `admin`
   for operational administration, and `super_admin` only under the ownership
   rule above.
4. After acceptance, verify the displayed email and role. Role changes require
   a new session before JWT-backed policy decisions can be considered current.

## Removal and incident response

- Removing an allowlist row does not disable an existing Auth user. Disable or
  delete the provider user separately, revoke active sessions where available,
  and then remove the allowlist row.
- For a suspected account compromise, disable the account first, rotate any
  user-visible credentials, review Supabase Auth audit evidence, and restore
  access only after a fresh owner approval.
- Never store passwords, invitation links, access tokens, recovery links, or
  provider secrets in the allowlist note.
