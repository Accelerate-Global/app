create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

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
      and lower(email) = 'admin@example.com'
  );
$$;

comment on function private.is_dataset_admin() is
  'Returns true when the current authenticated user is allowed to manage shared datasets.';

revoke all on function private.is_dataset_admin() from public;
grant execute on function private.is_dataset_admin() to authenticated;

alter table if exists public.datasets enable row level security;
alter table if exists public.dataset_rows enable row level security;
alter table if exists public.signup_email_allowlist enable row level security;

drop policy if exists "authenticated users can read shared datasets"
  on public.datasets;
drop policy if exists "dataset admin can insert shared datasets"
  on public.datasets;
drop policy if exists "dataset admin can update shared datasets"
  on public.datasets;
drop policy if exists "dataset admin can delete shared datasets"
  on public.datasets;

create policy "authenticated users can read shared datasets"
  on public.datasets
  for select
  to authenticated
  using (true);

create policy "dataset admin can insert shared datasets"
  on public.datasets
  for insert
  to authenticated
  with check (private.is_dataset_admin());

create policy "dataset admin can update shared datasets"
  on public.datasets
  for update
  to authenticated
  using (private.is_dataset_admin())
  with check (private.is_dataset_admin());

create policy "dataset admin can delete shared datasets"
  on public.datasets
  for delete
  to authenticated
  using (private.is_dataset_admin());

drop policy if exists "authenticated users can read shared dataset rows"
  on public.dataset_rows;
drop policy if exists "dataset admin can insert shared dataset rows"
  on public.dataset_rows;
drop policy if exists "dataset admin can update shared dataset rows"
  on public.dataset_rows;
drop policy if exists "dataset admin can delete shared dataset rows"
  on public.dataset_rows;

create policy "authenticated users can read shared dataset rows"
  on public.dataset_rows
  for select
  to authenticated
  using (true);

create policy "dataset admin can insert shared dataset rows"
  on public.dataset_rows
  for insert
  to authenticated
  with check (private.is_dataset_admin());

create policy "dataset admin can update shared dataset rows"
  on public.dataset_rows
  for update
  to authenticated
  using (private.is_dataset_admin())
  with check (private.is_dataset_admin());

create policy "dataset admin can delete shared dataset rows"
  on public.dataset_rows
  for delete
  to authenticated
  using (private.is_dataset_admin());

drop policy if exists "supabase auth admin can read signup allowlist"
  on public.signup_email_allowlist;

create policy "supabase auth admin can read signup allowlist"
  on public.signup_email_allowlist
  for select
  to supabase_auth_admin
  using (true);
