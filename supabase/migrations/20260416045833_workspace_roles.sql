create schema if not exists private;

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('workspace_role', 'admin')
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
      and coalesce(raw_app_meta_data ->> 'workspace_role', 'viewer') = 'admin'
  );
$$;

comment on function private.is_dataset_admin() is
  'Returns true when the current authenticated user is allowed to manage shared datasets.';

revoke all on function private.is_dataset_admin() from public;
grant execute on function private.is_dataset_admin() to authenticated;
