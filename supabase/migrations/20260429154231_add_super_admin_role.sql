update auth.users
set raw_app_meta_data = jsonb_set(
  coalesce(raw_app_meta_data, '{}'::jsonb),
  '{workspace_role}',
  '"super_admin"'::jsonb,
  true
)
where lower(email) = 'admin@example.com';

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
      and coalesce(raw_app_meta_data ->> 'workspace_role', 'pro') in ('admin', 'super_admin')
  );
$$;

comment on function private.is_dataset_admin() is
  'Returns true when the current authenticated user is allowed to manage shared datasets.';

revoke all on function private.is_dataset_admin() from public;
grant execute on function private.is_dataset_admin() to authenticated;
