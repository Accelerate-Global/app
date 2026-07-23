begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select has_table(
  'private',
  'source_profile_bindings',
  'source profile binding table exists'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname = 'source_profile_bindings'
  ),
  'source profile bindings have RLS enabled'
);

select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name = 'source_profile_bindings'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0::bigint,
  'browser-facing roles have no source profile binding grants'
);

insert into private.api_connections (
  id, name, description, method, url, request_headers, secret_header_names,
  body_template, response_format, response_data_path, import_mode,
  dataset_name, dataset_classification, provider, provider_config,
  created_by_owner_id, updated_by_owner_id
) values
(
  '84000000-0000-4000-8000-000000000001', 'WCD Sheet', '', 'GET',
  'https://docs.google.com/spreadsheets/d/source/edit', '[]'::jsonb, '[]'::jsonb,
  '', 'csv', '', 'create', 'wcd.csv', 'PGIC', 'google_sheets',
  '{"provider":"google_sheets","spreadsheetId":"source","spreadsheetUrl":"https://docs.google.com/spreadsheets/d/source/edit","spreadsheetTitle":"WCD","sheetId":0,"sheetTitle":"People","rangeMode":"full_tab"}'::jsonb,
  'security-test-admin', 'security-test-admin'
),
(
  '84000000-0000-4000-8000-000000000003', 'Second WCD Sheet', '', 'GET',
  'https://docs.google.com/spreadsheets/d/source-two/edit', '[]'::jsonb, '[]'::jsonb,
  '', 'csv', '', 'create', 'wcd-two.csv', 'PGIC', 'google_sheets',
  '{"provider":"google_sheets","spreadsheetId":"source-two","spreadsheetUrl":"https://docs.google.com/spreadsheets/d/source-two/edit","spreadsheetTitle":"WCD 2","sheetId":0,"sheetTitle":"People","rangeMode":"full_tab"}'::jsonb,
  'security-test-admin', 'security-test-admin'
),
(
  '84000000-0000-4000-8000-000000000002', 'HTTP source', '', 'GET',
  'https://example.test/source', '[]'::jsonb, '[]'::jsonb, '', 'json', '',
  'create', 'http.csv', 'PGIC', 'http_api', '{"provider":"http_api"}'::jsonb,
  'security-test-admin', 'security-test-admin'
);

select lives_ok(
  $$
    insert into private.source_profile_bindings (
      connection_id, source_profile_key, stable_key_column,
      configured_by_owner_id
    ) values (
      '84000000-0000-4000-8000-000000000001',
      'wcd-people-groups', ' Record ID ', ' security-test-admin '
    )
  $$,
  'active Google Sheets source can be configured'
);

select is(
  (
    select stable_key_column
    from private.source_profile_bindings
    where connection_id = '84000000-0000-4000-8000-000000000001'
  ),
  'Record ID',
  'stable key column is normalized'
);

select throws_ok(
  $$
    insert into private.source_profile_bindings (
      connection_id, source_profile_key, stable_key_column,
      configured_by_owner_id
    ) values (
      '84000000-0000-4000-8000-000000000003',
      'wcd-people-groups', 'Record ID', 'security-test-admin'
    )
  $$,
  '23505',
  null,
  'a source profile cannot be assigned to a second connection'
);

select is(
  (
    select connection_id::text
    from private.source_profile_bindings
    where source_profile_key = 'wcd-people-groups'
  ),
  '84000000-0000-4000-8000-000000000001',
  'the original source profile binding remains unchanged after conflict'
);

select throws_ok(
  $$
    insert into private.source_profile_bindings (
      connection_id, source_profile_key, stable_key_column,
      configured_by_owner_id
    ) values (
      '84000000-0000-4000-8000-000000000002',
      'wcd-people-groups', 'Record ID', 'security-test-admin'
    )
  $$,
  'Only Google Sheets connections can use configurable source profiles.',
  'HTTP connections cannot receive configurable profiles'
);

select throws_ok(
  $$
    update private.source_profile_bindings
    set source_profile_key = 'unsupported-profile'
    where connection_id = '84000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  null,
  'unsupported source profiles are rejected'
);

select throws_ok(
  $$
    update private.source_profile_bindings
    set stable_key_column = '  '
    where connection_id = '84000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  null,
  'blank stable keys are rejected'
);

select * from finish();
rollback;
