begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'datasets'
      and c.relkind = 'r'
  ),
  'datasets has row level security enabled'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'dataset_rows'
      and c.relkind = 'r'
  ),
  'dataset_rows has row level security enabled'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'signup_email_allowlist'
      and c.relkind = 'r'
  ),
  'signup_email_allowlist has row level security enabled'
);

select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'datasets'
      and policyname = 'authenticated users can read shared datasets'
      and cmd = 'SELECT'
  ),
  'datasets has authenticated read policy'
);

select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'datasets'
      and policyname = 'dataset admin can insert shared datasets'
      and cmd = 'INSERT'
  ),
  'datasets has admin insert policy'
);

select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'datasets'
      and policyname = 'dataset admin can update shared datasets'
      and cmd = 'UPDATE'
  ),
  'datasets has admin update policy'
);

select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'datasets'
      and policyname = 'dataset admin can delete shared datasets'
      and cmd = 'DELETE'
  ),
  'datasets has admin delete policy'
);

select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dataset_rows'
      and policyname = 'authenticated users can read shared dataset rows'
      and cmd = 'SELECT'
  ),
  'dataset_rows has authenticated read policy'
);

select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dataset_rows'
      and policyname = 'dataset admin can insert shared dataset rows'
      and cmd = 'INSERT'
  ),
  'dataset_rows has admin insert policy'
);

select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dataset_rows'
      and policyname = 'dataset admin can update shared dataset rows'
      and cmd = 'UPDATE'
  ),
  'dataset_rows has admin update policy'
);

select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dataset_rows'
      and policyname = 'dataset admin can delete shared dataset rows'
      and cmd = 'DELETE'
  ),
  'dataset_rows has admin delete policy'
);

select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'signup_email_allowlist'
      and policyname = 'supabase auth admin can read signup allowlist'
      and cmd = 'SELECT'
  ),
  'signup_email_allowlist has supabase auth admin read policy'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '737ef850-1337-403d-beb5-b7c44a1be131',
  'authenticated',
  'authenticated',
  'admin@example.com',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
where not exists (
  select 1
  from auth.users
  where lower(email) = 'admin@example.com'
);

select ok(
  exists(
    select 1
    from auth.users
    where lower(email) = 'admin@example.com'
  ),
  'dataset admin auth user exists for policy behavior test'
);

insert into public.datasets (
  id,
  owner_id,
  file_name,
  blob_url,
  blob_path,
  size_bytes,
  columns
)
values (
  '10000000-0000-4000-8000-000000000001',
  'owner-1',
  'security-test.csv',
  'https://example.com/security-test.csv',
  'datasets/security-test.csv',
  1,
  '[]'::jsonb
);

insert into public.dataset_rows (
  id,
  dataset_id,
  row_index,
  data
)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  0,
  '{"email":"person@example.com"}'::jsonb
);

insert into public.signup_email_allowlist (email, note)
values ('security-test@example.com', 'pgTAP visibility check');

set local role anon;

select results_eq(
  $$ select count(*)::bigint from public.datasets where id = '10000000-0000-4000-8000-000000000001' $$,
  array[0::bigint],
  'anon cannot read datasets'
);

select results_eq(
  $$ select count(*)::bigint from public.dataset_rows where dataset_id = '10000000-0000-4000-8000-000000000001' $$,
  array[0::bigint],
  'anon cannot read dataset_rows'
);

select results_eq(
  $$ select count(*)::bigint from public.signup_email_allowlist where email = 'security-test@example.com' $$,
  array[0::bigint],
  'anon cannot read signup_email_allowlist'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  coalesce(
    (
      select id::text
      from auth.users
      where lower(email) = 'admin@example.com'
      limit 1
    ),
    '00000000-0000-4000-8000-000000000000'
  ),
  true
);
set local role authenticated;

select results_eq(
  $$ select count(*)::bigint from public.datasets where id = '10000000-0000-4000-8000-000000000001' $$,
  array[1::bigint],
  'authenticated users can read datasets'
);

select results_eq(
  $$ select count(*)::bigint from public.dataset_rows where dataset_id = '10000000-0000-4000-8000-000000000001' $$,
  array[1::bigint],
  'authenticated users can read dataset_rows'
);

select results_eq(
  $$ select count(*)::bigint from public.signup_email_allowlist where email = 'security-test@example.com' $$,
  array[0::bigint],
  'authenticated users cannot read signup_email_allowlist'
);

select lives_ok(
  $$
    insert into public.datasets (
      id,
      owner_id,
      file_name,
      blob_url,
      blob_path,
      size_bytes,
      columns
    )
    values (
      '10000000-0000-4000-8000-000000000002',
      'owner-2',
      'admin-insert.csv',
      'https://example.com/admin-insert.csv',
      'datasets/admin-insert.csv',
      1,
      '[]'::jsonb
    )
  $$,
  'dataset admin can insert datasets'
);

select * from finish();

rollback;
