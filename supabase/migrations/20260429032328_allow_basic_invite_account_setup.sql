create or replace function private.prevent_basic_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = auth, pg_temp
as $$
declare
  old_workspace_role text;
  new_workspace_role text;
  is_basic_profile_update boolean;
  is_basic_initial_setup boolean;
begin
  old_workspace_role := case coalesce(old.raw_app_meta_data ->> 'workspace_role', 'pro')
    when 'admin' then 'admin'
    when 'basic' then 'basic'
    else 'pro'
  end;
  new_workspace_role := case coalesce(new.raw_app_meta_data ->> 'workspace_role', 'pro')
    when 'admin' then 'admin'
    when 'basic' then 'basic'
    else 'pro'
  end;

  is_basic_profile_update :=
    (old_workspace_role = 'basic' or new_workspace_role = 'basic')
    and (
      new.email is distinct from old.email
      or new.email_change is distinct from old.email_change
      or new.email_change_sent_at is distinct from old.email_change_sent_at
      or new.raw_user_meta_data is distinct from old.raw_user_meta_data
    );

  is_basic_initial_setup :=
    old_workspace_role = 'basic'
    and new_workspace_role = 'basic'
    and old.invited_at is not null
    and old.last_sign_in_at is null
    and old.email_confirmed_at is null
    and new.email is not distinct from old.email
    and new.email_change is not distinct from old.email_change
    and new.email_change_sent_at is not distinct from old.email_change_sent_at
    and (
      new.encrypted_password is distinct from old.encrypted_password
      or new.email_confirmed_at is distinct from old.email_confirmed_at
      or new.last_sign_in_at is distinct from old.last_sign_in_at
    );

  if is_basic_profile_update and not is_basic_initial_setup then
    raise exception 'Basic users cannot update profile details.';
  end if;

  return new;
end;
$$;

comment on function private.prevent_basic_profile_updates() is
  'Prevents basic workspace users from changing email or user profile metadata after initial invite setup.';

revoke all on function private.prevent_basic_profile_updates() from public;
grant execute on function private.prevent_basic_profile_updates() to authenticated;
