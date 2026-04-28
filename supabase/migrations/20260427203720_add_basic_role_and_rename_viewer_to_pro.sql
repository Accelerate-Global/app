update auth.users
set raw_app_meta_data = jsonb_set(
  coalesce(raw_app_meta_data, '{}'::jsonb),
  '{workspace_role}',
  '"pro"'::jsonb,
  true
)
where raw_app_meta_data ->> 'workspace_role' = 'viewer';

create or replace function private.is_dataset_admin()
returns boolean
language sql
stable
security definer
set search_path = auth, public, pg_temp
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and coalesce(raw_app_meta_data ->> 'workspace_role', 'pro') = 'admin'
  );
$$;

comment on function private.is_dataset_admin() is
  'Returns true when the current authenticated user is allowed to manage shared datasets.';

revoke all on function private.is_dataset_admin() from public;
grant execute on function private.is_dataset_admin() to authenticated;

create or replace function private.prevent_basic_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = auth, pg_temp
as $$
declare
  old_workspace_role text;
  new_workspace_role text;
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

  if (old_workspace_role = 'basic' or new_workspace_role = 'basic')
    and (
      new.email is distinct from old.email
      or new.email_change is distinct from old.email_change
      or new.email_change_sent_at is distinct from old.email_change_sent_at
      or new.raw_user_meta_data is distinct from old.raw_user_meta_data
    )
  then
    raise exception 'Basic users cannot update profile details.';
  end if;

  return new;
end;
$$;

comment on function private.prevent_basic_profile_updates() is
  'Prevents basic workspace users from changing email or user profile metadata through direct Supabase Auth updates.';

revoke all on function private.prevent_basic_profile_updates() from public;
grant execute on function private.prevent_basic_profile_updates() to authenticated;

drop trigger if exists prevent_basic_profile_updates on auth.users;

create trigger prevent_basic_profile_updates
before update of email, email_change, email_change_sent_at, raw_user_meta_data, raw_app_meta_data
on auth.users
for each row
execute function private.prevent_basic_profile_updates();

create or replace function private.is_workspace_basic()
returns boolean
language sql
stable
security definer
set search_path = auth, public, pg_temp
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and coalesce(raw_app_meta_data ->> 'workspace_role', 'pro') = 'basic'
  );
$$;

comment on function private.is_workspace_basic() is
  'Returns true when the current authenticated user has the Basic workspace role.';

revoke all on function private.is_workspace_basic() from public;
grant execute on function private.is_workspace_basic() to authenticated;

drop policy if exists "users can insert own saved dataset tables"
  on public.saved_dataset_tables;

create policy "users can insert own saved dataset tables"
  on public.saved_dataset_tables
  for insert
  to authenticated
  with check (
    owner_id = auth.uid()::text
    and not private.is_workspace_basic()
  );
