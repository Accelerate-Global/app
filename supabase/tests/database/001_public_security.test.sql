begin;

create extension if not exists pgtap with schema extensions;

select plan(91);

select results_eq(
  $$
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  $$,
  array[
    'dataset_rows'::name,
    'dataset_version_rows'::name,
    'dataset_versions'::name,
    'datasets'::name,
    'field_definition_sources'::name,
    'field_definitions'::name,
    'field_source_types'::name,
    'filter_region_countries'::name,
    'filter_regions'::name,
    'saved_dataset_tables'::name,
    'signup_email_allowlist'::name
  ],
  'all app-owned public tables are explicitly covered by the security suite'
);

select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'public' and pg_class.relname = 'datasets' and pg_class.relkind = 'r'), 'datasets has row level security enabled');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'public' and pg_class.relname = 'dataset_rows' and pg_class.relkind = 'r'), 'dataset_rows has row level security enabled');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'public' and pg_class.relname = 'dataset_versions' and pg_class.relkind = 'r'), 'dataset_versions has row level security enabled');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'public' and pg_class.relname = 'dataset_version_rows' and pg_class.relkind = 'r'), 'dataset_version_rows has row level security enabled');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'public' and pg_class.relname = 'filter_regions' and pg_class.relkind = 'r'), 'filter_regions has row level security enabled');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'public' and pg_class.relname = 'filter_region_countries' and pg_class.relkind = 'r'), 'filter_region_countries has row level security enabled');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'public' and pg_class.relname = 'field_definitions' and pg_class.relkind = 'r'), 'field_definitions has row level security enabled');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'public' and pg_class.relname = 'field_source_types' and pg_class.relkind = 'r'), 'field_source_types has row level security enabled');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'public' and pg_class.relname = 'field_definition_sources' and pg_class.relkind = 'r'), 'field_definition_sources has row level security enabled');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'public' and pg_class.relname = 'saved_dataset_tables' and pg_class.relkind = 'r'), 'saved_dataset_tables has row level security enabled');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'public' and pg_class.relname = 'signup_email_allowlist' and pg_class.relkind = 'r'), 'signup_email_allowlist has row level security enabled');

select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'datasets' and policyname = 'authenticated users can read shared datasets' and cmd = 'SELECT'), 'datasets has authenticated read policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'datasets' and policyname = 'dataset admin can insert shared datasets' and cmd = 'INSERT'), 'datasets has admin insert policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'datasets' and policyname = 'dataset admin can update shared datasets' and cmd = 'UPDATE'), 'datasets has admin update policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'datasets' and policyname = 'dataset admin can delete shared datasets' and cmd = 'DELETE'), 'datasets has admin delete policy');

select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'dataset_rows' and policyname = 'authenticated users can read shared dataset rows' and cmd = 'SELECT'), 'dataset_rows has authenticated read policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'dataset_rows' and policyname = 'dataset admin can insert shared dataset rows' and cmd = 'INSERT'), 'dataset_rows has admin insert policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'dataset_rows' and policyname = 'dataset admin can update shared dataset rows' and cmd = 'UPDATE'), 'dataset_rows has admin update policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'dataset_rows' and policyname = 'dataset admin can delete shared dataset rows' and cmd = 'DELETE'), 'dataset_rows has admin delete policy');

select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'dataset_versions' and policyname = 'dataset admin can read dataset versions' and cmd = 'SELECT'), 'dataset_versions has admin read policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'dataset_versions' and policyname = 'dataset admin can insert dataset versions' and cmd = 'INSERT'), 'dataset_versions has admin insert policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'dataset_versions' and policyname = 'dataset admin can update dataset versions' and cmd = 'UPDATE'), 'dataset_versions has admin update policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'dataset_versions' and policyname = 'dataset admin can delete dataset versions' and cmd = 'DELETE'), 'dataset_versions has admin delete policy');

select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'dataset_version_rows' and policyname = 'dataset admin can read dataset version rows' and cmd = 'SELECT'), 'dataset_version_rows has admin read policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'dataset_version_rows' and policyname = 'dataset admin can insert dataset version rows' and cmd = 'INSERT'), 'dataset_version_rows has admin insert policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'dataset_version_rows' and policyname = 'dataset admin can update dataset version rows' and cmd = 'UPDATE'), 'dataset_version_rows has admin update policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'dataset_version_rows' and policyname = 'dataset admin can delete dataset version rows' and cmd = 'DELETE'), 'dataset_version_rows has admin delete policy');

select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'filter_regions' and policyname = 'authenticated users can read filter regions' and cmd = 'SELECT'), 'filter_regions has authenticated read policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'filter_regions' and policyname = 'dataset admin can insert filter regions' and cmd = 'INSERT'), 'filter_regions has admin insert policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'filter_regions' and policyname = 'dataset admin can update filter regions' and cmd = 'UPDATE'), 'filter_regions has admin update policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'filter_regions' and policyname = 'dataset admin can delete filter regions' and cmd = 'DELETE'), 'filter_regions has admin delete policy');

select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'filter_region_countries' and policyname = 'authenticated users can read filter region countries' and cmd = 'SELECT'), 'filter_region_countries has authenticated read policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'filter_region_countries' and policyname = 'dataset admin can insert filter region countries' and cmd = 'INSERT'), 'filter_region_countries has admin insert policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'filter_region_countries' and policyname = 'dataset admin can update filter region countries' and cmd = 'UPDATE'), 'filter_region_countries has admin update policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'filter_region_countries' and policyname = 'dataset admin can delete filter region countries' and cmd = 'DELETE'), 'filter_region_countries has admin delete policy');

select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'field_definitions' and policyname = 'authenticated users can read field definitions' and cmd = 'SELECT'), 'field_definitions has authenticated read policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'field_definitions' and policyname = 'dataset admin can insert field definitions' and cmd = 'INSERT'), 'field_definitions has admin insert policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'field_definitions' and policyname = 'dataset admin can update field definitions' and cmd = 'UPDATE'), 'field_definitions has admin update policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'field_definitions' and policyname = 'dataset admin can delete field definitions' and cmd = 'DELETE'), 'field_definitions has admin delete policy');

select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'field_source_types' and policyname = 'authenticated users can read field source types' and cmd = 'SELECT'), 'field_source_types has authenticated read policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'field_source_types' and policyname = 'dataset admin can insert field source types' and cmd = 'INSERT'), 'field_source_types has admin insert policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'field_source_types' and policyname = 'dataset admin can update field source types' and cmd = 'UPDATE'), 'field_source_types has admin update policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'field_source_types' and policyname = 'dataset admin can delete field source types' and cmd = 'DELETE'), 'field_source_types has admin delete policy');

select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'field_definition_sources' and policyname = 'authenticated users can read field definition sources' and cmd = 'SELECT'), 'field_definition_sources has authenticated read policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'field_definition_sources' and policyname = 'dataset admin can insert field definition sources' and cmd = 'INSERT'), 'field_definition_sources has admin insert policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'field_definition_sources' and policyname = 'dataset admin can update field definition sources' and cmd = 'UPDATE'), 'field_definition_sources has admin update policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'field_definition_sources' and policyname = 'dataset admin can delete field definition sources' and cmd = 'DELETE'), 'field_definition_sources has admin delete policy');

select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_dataset_tables' and policyname = 'users can read own saved dataset tables' and cmd = 'SELECT'), 'saved_dataset_tables has owner read policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_dataset_tables' and policyname = 'users can insert own saved dataset tables' and cmd = 'INSERT'), 'saved_dataset_tables has owner insert policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_dataset_tables' and policyname = 'users can update own saved dataset tables' and cmd = 'UPDATE'), 'saved_dataset_tables has owner update policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_dataset_tables' and policyname = 'users can delete own saved dataset tables' and cmd = 'DELETE'), 'saved_dataset_tables has owner delete policy');

select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'signup_email_allowlist' and policyname = 'supabase auth admin can read signup allowlist' and cmd = 'SELECT'), 'signup_email_allowlist has supabase auth admin read policy');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'storage' and pg_class.relname = 'objects' and pg_class.relkind = 'r'), 'storage.objects has row level security enabled');
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'dataset admin can read dataset storage objects' and cmd = 'SELECT'), 'storage.objects has dataset bucket read policy');
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'dataset admin can insert dataset storage objects' and cmd = 'INSERT'), 'storage.objects has dataset bucket insert policy');
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'dataset admin can update dataset storage objects' and cmd = 'UPDATE'), 'storage.objects has dataset bucket update policy');
select ok(exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'dataset admin can delete dataset storage objects' and cmd = 'DELETE'), 'storage.objects has dataset bucket delete policy');
select ok((select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace where pg_namespace.nspname = 'private' and pg_class.relname = 'analytics_events' and pg_class.relkind = 'r'), 'private.analytics_events has row level security enabled');
select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name = 'analytics_events'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0::bigint,
  'private.analytics_events has no grants for public-facing roles'
);

select throws_ok(
  $$
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
    values (
      'bbbbbbbb-1337-403d-beb5-b7c44a1be131',
      'authenticated',
      'authenticated',
      'blocked@example.com',
      '',
      now(),
      '{"provider":"email","providers":["email"],"workspace_role":"viewer"}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )
  $$,
  'P0001',
  'This email is not approved for access.',
  'non-allowlisted auth.users inserts are rejected by the signup trigger'
);

insert into public.signup_email_allowlist (email, note)
select
  'admin@example.com',
  'pgTAP admin fixture'
where not exists (
  select 1
  from public.signup_email_allowlist
  where email = 'admin@example.com'
);

insert into public.signup_email_allowlist (email, note)
select
  'viewer@example.com',
  'pgTAP viewer fixture'
where not exists (
  select 1
  from public.signup_email_allowlist
  where email = 'viewer@example.com'
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
  '{"provider":"email","providers":["email"],"workspace_role":"admin"}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
where not exists (
  select 1
  from auth.users
  where lower(email) = 'admin@example.com'
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
  'aaaaaaaa-1337-403d-beb5-b7c44a1be131',
  'authenticated',
  'authenticated',
  'viewer@example.com',
  '',
  now(),
  '{"provider":"email","providers":["email"],"workspace_role":"viewer"}'::jsonb,
  '{"workspace_role":"admin"}'::jsonb,
  now(),
  now()
where not exists (
  select 1
  from auth.users
  where lower(email) = 'viewer@example.com'
);

insert into public.datasets (
  id,
  owner_id,
  file_name,
  blob_url,
  blob_path,
  current_version_action,
  current_version_actor_owner_id,
  current_version_actor_email,
  current_version_created_at,
  size_bytes,
  columns
)
values (
  '10000000-0000-4000-8000-000000000001',
  'owner-1',
  'security-test.csv',
  'https://example.com/security-test.csv',
  'datasets/security-test.csv',
  'upload',
  'owner-1',
  'security-admin@example.com',
  now(),
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

insert into public.dataset_versions (
  id,
  dataset_id,
  file_name,
  blob_url,
  blob_path,
  action,
  actor_owner_id,
  actor_email,
  status,
  row_count,
  size_bytes,
  columns,
  error,
  version_created_at,
  archived_at
)
values (
  '21000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'security-test-previous.csv',
  'https://example.com/security-test-previous.csv',
  'datasets/security-test-previous.csv',
  'upload',
  'owner-1',
  'security-admin@example.com',
  'ready',
  1,
  1,
  '[]'::jsonb,
  null,
  now() - interval '1 day',
  now()
);

insert into public.dataset_version_rows (
  id,
  version_id,
  row_index,
  data
)
values (
  '22000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001',
  0,
  '{"email":"previous@example.com"}'::jsonb
);

insert into public.filter_regions (
  id,
  name,
  description,
  sort_order
)
values (
  '30000000-0000-4000-8000-000000000001',
  'South Asia',
  'Security fixture region',
  1
);

insert into public.filter_region_countries (
  id,
  region_id,
  country_name
)
values (
  '31000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'India'
);

insert into public.field_definitions (
  id,
  canonical_key,
  label,
  definition
)
values (
  '40000000-0000-4000-8000-000000000001',
  'security_fixture_pg_rop3',
  'PG_ROP3',
  'Security fixture definition'
);

insert into public.field_source_types (
  id,
  key,
  label,
  sort_order
)
values (
  '41000000-0000-4000-8000-000000000001',
  'security_fixture_joshua_project',
  'Security Fixture Joshua Project',
  1
);

insert into public.field_definition_sources (
  id,
  field_definition_id,
  source_type_id,
  source_field_name
)
values (
  '42000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000001',
  'ROP3'
);

insert into public.signup_email_allowlist (email, note)
values ('security-test@example.com', 'pgTAP visibility check');

set local role anon;

select results_eq($$ select count(*)::bigint from public.datasets where id = '10000000-0000-4000-8000-000000000001' $$, array[0::bigint], 'anon cannot read datasets');
select results_eq($$ select count(*)::bigint from public.dataset_rows where dataset_id = '10000000-0000-4000-8000-000000000001' $$, array[0::bigint], 'anon cannot read dataset_rows');
select results_eq($$ select count(*)::bigint from public.dataset_versions where dataset_id = '10000000-0000-4000-8000-000000000001' $$, array[0::bigint], 'anon cannot read dataset_versions');
select results_eq($$ select count(*)::bigint from public.dataset_version_rows where version_id = '21000000-0000-4000-8000-000000000001' $$, array[0::bigint], 'anon cannot read dataset_version_rows');
select results_eq($$ select count(*)::bigint from public.filter_regions where id = '30000000-0000-4000-8000-000000000001' $$, array[0::bigint], 'anon cannot read filter_regions');
select results_eq($$ select count(*)::bigint from public.filter_region_countries where region_id = '30000000-0000-4000-8000-000000000001' $$, array[0::bigint], 'anon cannot read filter_region_countries');
select results_eq($$ select count(*)::bigint from public.field_definitions where id = '40000000-0000-4000-8000-000000000001' $$, array[0::bigint], 'anon cannot read field_definitions');
select results_eq($$ select count(*)::bigint from public.field_source_types where id = '41000000-0000-4000-8000-000000000001' $$, array[0::bigint], 'anon cannot read field_source_types');
select results_eq($$ select count(*)::bigint from public.field_definition_sources where id = '42000000-0000-4000-8000-000000000001' $$, array[0::bigint], 'anon cannot read field_definition_sources');
select results_eq($$ select count(*)::bigint from public.signup_email_allowlist where email = 'security-test@example.com' $$, array[0::bigint], 'anon cannot read signup_email_allowlist');

reset role;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-1337-403d-beb5-b7c44a1be131', true);
set local role authenticated;

select results_eq($$ select count(*)::bigint from public.datasets where id = '10000000-0000-4000-8000-000000000001' $$, array[1::bigint], 'authenticated users can read datasets');
select results_eq($$ select count(*)::bigint from public.dataset_rows where dataset_id = '10000000-0000-4000-8000-000000000001' $$, array[1::bigint], 'authenticated users can read dataset_rows');
select results_eq($$ select count(*)::bigint from public.dataset_versions where dataset_id = '10000000-0000-4000-8000-000000000001' $$, array[0::bigint], 'non-admin authenticated users cannot read dataset_versions');
select results_eq($$ select count(*)::bigint from public.dataset_version_rows where version_id = '21000000-0000-4000-8000-000000000001' $$, array[0::bigint], 'non-admin authenticated users cannot read dataset_version_rows');
select results_eq($$ select count(*)::bigint from public.filter_regions where id = '30000000-0000-4000-8000-000000000001' $$, array[1::bigint], 'authenticated users can read filter_regions');
select results_eq($$ select count(*)::bigint from public.filter_region_countries where region_id = '30000000-0000-4000-8000-000000000001' $$, array[1::bigint], 'authenticated users can read filter_region_countries');
select results_eq($$ select count(*)::bigint from public.field_definitions where id = '40000000-0000-4000-8000-000000000001' $$, array[1::bigint], 'authenticated users can read field_definitions');
select results_eq($$ select count(*)::bigint from public.field_source_types where id = '41000000-0000-4000-8000-000000000001' $$, array[1::bigint], 'authenticated users can read field_source_types');
select results_eq($$ select count(*)::bigint from public.field_definition_sources where id = '42000000-0000-4000-8000-000000000001' $$, array[1::bigint], 'authenticated users can read field_definition_sources');
select results_eq($$ select count(*)::bigint from public.signup_email_allowlist where email = 'security-test@example.com' $$, array[0::bigint], 'authenticated users cannot read signup_email_allowlist');
select is(private.is_dataset_admin(), false, 'raw_user_meta_data workspace_role does not grant dataset admin access');

select throws_ok(
  $$
    insert into public.field_definitions (id, canonical_key, label)
    values (
      '40000000-0000-4000-8000-000000000002',
      'security_fixture_viewer_insert_field',
      'Viewer Insert Field'
    )
  $$,
  '42501',
  null,
  'non-admin authenticated users cannot insert field_definitions'
);

select throws_ok(
  $$
    insert into public.field_source_types (id, key, label, sort_order)
    values (
      '41000000-0000-4000-8000-000000000002',
      'security_fixture_viewer_source_type',
      'Viewer Source Type',
      2
    )
  $$,
  '42501',
  null,
  'non-admin authenticated users cannot insert field_source_types'
);

select throws_ok(
  $$
    insert into public.field_definition_sources (id, field_definition_id, source_type_id, source_field_name)
    values (
      '42000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000001',
      '41000000-0000-4000-8000-000000000001',
      'Viewer Source Value'
    )
  $$,
  '42501',
  null,
  'non-admin authenticated users cannot insert field_definition_sources'
);

reset role;

select set_config('request.jwt.claim.sub', '737ef850-1337-403d-beb5-b7c44a1be131', true);
set local role authenticated;

select lives_ok(
  $$
    insert into public.datasets (
      id,
      owner_id,
      file_name,
      blob_url,
      blob_path,
      current_version_action,
      current_version_actor_owner_id,
      current_version_actor_email,
      current_version_created_at,
      size_bytes,
      columns
    )
    values (
      '10000000-0000-4000-8000-000000000002',
      'owner-2',
      'admin-insert.csv',
      'https://example.com/admin-insert.csv',
      'datasets/admin-insert.csv',
      'upload',
      'owner-2',
      'admin@example.com',
      now(),
      1,
      '[]'::jsonb
    )
  $$,
  'dataset admin can insert datasets'
);

select lives_ok(
  $$
    insert into public.dataset_versions (
      id,
      dataset_id,
      file_name,
      blob_url,
      blob_path,
      action,
      actor_owner_id,
      actor_email,
      status,
      row_count,
      size_bytes,
      columns,
      version_created_at
    )
    values (
      '21000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001',
      'admin-version.csv',
      'https://example.com/admin-version.csv',
      'datasets/admin-version.csv',
      'replace',
      'owner-2',
      'admin@example.com',
      'ready',
      0,
      1,
      '[]'::jsonb,
      now()
    )
  $$,
  'dataset admin can insert dataset_versions'
);

select lives_ok(
  $$
    insert into public.dataset_version_rows (
      id,
      version_id,
      row_index,
      data
    )
    values (
      '22000000-0000-4000-8000-000000000002',
      '21000000-0000-4000-8000-000000000002',
      0,
      '{"email":"admin-version@example.com"}'::jsonb
    )
  $$,
  'dataset admin can insert dataset_version_rows'
);

select lives_ok(
  $$
    insert into public.field_definitions (id, canonical_key, label)
    values (
      '40000000-0000-4000-8000-000000000003',
      'security_fixture_admin_insert_field',
      'Admin Insert Field'
    )
  $$,
  'dataset admin can insert field_definitions'
);

select lives_ok(
  $$
    insert into public.field_source_types (id, key, label, sort_order)
    values (
      '41000000-0000-4000-8000-000000000003',
      'security_fixture_admin_source_type',
      'Admin Source Type',
      3
    )
  $$,
  'dataset admin can insert field_source_types'
);

select lives_ok(
  $$
    insert into public.field_definition_sources (
      id,
      field_definition_id,
      source_type_id,
      source_field_name
    )
    values (
      '42000000-0000-4000-8000-000000000003',
      '40000000-0000-4000-8000-000000000003',
      '41000000-0000-4000-8000-000000000003',
      'Admin Source Value'
    )
  $$,
  'dataset admin can insert field_definition_sources'
);

select * from finish();

rollback;
