begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select results_eq(
  $$
    select tablename
    from pg_tables
    where schemaname = 'private'
      and tablename in ('dataset_forming_runs', 'dataset_forming_findings')
    order by tablename
  $$,
  array['dataset_forming_findings'::name, 'dataset_forming_runs'::name],
  'forming lifecycle tables exist'
);

select is(
  (
    select count(*)::bigint
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname in ('dataset_forming_runs', 'dataset_forming_findings')
      and pg_class.relrowsecurity
  ),
  2::bigint,
  'forming lifecycle tables have RLS enabled'
);

select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name in ('dataset_forming_runs', 'dataset_forming_findings')
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0::bigint,
  'browser-facing roles have no forming table grants'
);

insert into private.api_connections (
  id, name, description, method, url, request_headers, secret_header_names,
  body_template, response_format, response_data_path, import_mode,
  dataset_name, dataset_classification, created_by_owner_id, updated_by_owner_id
) values (
  '83000000-0000-4000-8000-000000000001', 'IMB forming test', '', 'GET',
  'https://example.com/imb', '[]'::jsonb, '[]'::jsonb, '', 'json', 'features',
  'create', 'imb.csv', 'PGIC', 'security-test-admin', 'security-test-admin'
);

insert into private.api_connection_runs (
  id, connection_id, actor_owner_id, actor_email, mode, status, duration_ms,
  row_count, response_preview, started_at, completed_at
) values (
  '83000000-0000-4000-8000-000000000002',
  '83000000-0000-4000-8000-000000000001',
  'security-test-admin', 'admin@example.com', 'import', 'success', 10, 1, '', now(), now()
);

insert into private.reference_resource_sets (
  id, content_checksum, created_by_owner_id, reason
) values (
  '83000000-0000-4000-8000-000000000003', repeat('f', 64),
  'security-test-admin', 'Forming test set'
);

select lives_ok(
  $$
    insert into private.dataset_forming_runs (
      id, connection_id, source_run_id, resource_set_id, actor_owner_id,
      status, source_rows_checksum, source_raw_checksum, field_contract_version,
      field_contract_checksum, transformation_version, transformation_checksum,
      input_row_count, validation_summary
    ) values (
      '83000000-0000-4000-8000-000000000004',
      '83000000-0000-4000-8000-000000000001',
      '83000000-0000-4000-8000-000000000002',
      '83000000-0000-4000-8000-000000000003',
      'security-test-admin', 'building', repeat('a', 64), repeat('b', 64), 1,
      repeat('c', 64), 'imb-forming-v1', repeat('d', 64), 1, '{}'::jsonb
    )
  $$,
  'valid building forming record is accepted'
);

select throws_ok(
  $$
    update private.dataset_forming_runs
    set status = 'unknown'
    where id = '83000000-0000-4000-8000-000000000004'
  $$,
  '23514',
  null,
  'unknown lifecycle states are rejected'
);

select lives_ok(
  $$
    insert into private.dataset_forming_findings (
      forming_run_id, severity, rule_code, source_row_index, message
    ) values (
      '83000000-0000-4000-8000-000000000004', 'warning',
      'unresolved-rop3', 0, 'ROP3 remains unresolved.'
    )
  $$,
  'forming findings can be appended'
);

select throws_ok(
  $$
    update private.dataset_forming_findings
    set message = 'changed'
    where forming_run_id = '83000000-0000-4000-8000-000000000004'
  $$,
  'P0001',
  'Dataset forming findings are append-only.',
  'forming findings cannot be changed'
);

update private.dataset_forming_runs
set
  status = 'valid', output_row_count = 1, warning_count = 1,
  validation_summary = '{"warningCount":1,"errorCount":0}'::jsonb,
  artifact_manifest = '{"rows":"rows.json"}'::jsonb,
  output_checksum = repeat('e', 64), output_size_bytes = 100, completed_at = now()
where id = '83000000-0000-4000-8000-000000000004';

select throws_ok(
  $$
    update private.dataset_forming_runs
    set source_rows_checksum = repeat('9', 64)
    where id = '83000000-0000-4000-8000-000000000004'
  $$,
  'P0001',
  'Finalized dataset forming bindings and payload metadata are immutable.',
  'finalized source bindings are immutable'
);

select throws_ok(
  $$
    delete from private.dataset_forming_runs
    where id = '83000000-0000-4000-8000-000000000004'
  $$,
  'P0001',
  'Dataset forming run history is append-only.',
  'forming run history cannot be deleted'
);

set local role authenticated;

select throws_ok(
  $$ select count(*)::bigint from private.dataset_forming_runs $$,
  '42501',
  null,
  'authenticated browsers cannot read forming runs'
);

reset role;

select * from finish();
rollback;
