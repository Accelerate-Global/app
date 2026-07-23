begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

select results_eq(
  $$
    select tablename
    from pg_tables
    where schemaname = 'private'
      and tablename in (
        'dataset_forming_runs',
        'dataset_forming_resource_bindings',
        'dataset_forming_findings'
      )
    order by tablename
  $$,
  array[
    'dataset_forming_findings'::name,
    'dataset_forming_resource_bindings'::name,
    'dataset_forming_runs'::name
  ],
  'forming lifecycle tables exist'
);

select is(
  (
    select count(*)::bigint
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname in (
        'dataset_forming_runs',
        'dataset_forming_resource_bindings',
        'dataset_forming_findings'
      )
      and pg_class.relrowsecurity
  ),
  3::bigint,
  'forming lifecycle tables have RLS enabled'
);

select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name in (
        'dataset_forming_runs',
        'dataset_forming_resource_bindings',
        'dataset_forming_findings'
      )
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

select lives_ok(
  $$
    insert into private.api_connection_runs (
      id, connection_id, source_profile_snapshot, source_profile_checksum,
      actor_owner_id, actor_email, mode, status, duration_ms, response_preview
    ) values (
      '83000000-0000-4000-8000-000000000007',
      '83000000-0000-4000-8000-000000000001',
      '{
        "schemaVersion":1,
        "connectionId":"83000000-0000-4000-8000-000000000001",
        "sourceProfileKey":"imb-people-groups",
        "sourceProfileLabel":"IMB forming",
        "stableKeyColumn":null,
        "configurable":false,
        "engineKey":"imb",
        "engineLabel":"IMB forming",
        "engineVersion":"imb-forming-v1",
        "engineChecksum":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        "artifactSchemaVersion":1,
        "publicationTargetKey":"imb-people-groups"
      }'::jsonb,
      repeat('e', 64),
      'security-test-admin', 'admin@example.com', 'import', 'queued', 0, ''
    )
  $$,
  'API connection runs accept a complete immutable source-profile snapshot'
);

select throws_ok(
  $$
    update private.api_connection_runs
    set source_profile_checksum = repeat('9', 64)
    where id = '83000000-0000-4000-8000-000000000007'
  $$,
  'P0001',
  'API connection run source-profile snapshots are immutable.',
  'API connection run source-profile snapshots cannot be rebound'
);

insert into private.reference_resource_sets (
  id, content_checksum, created_by_owner_id, reason
) values (
  '83000000-0000-4000-8000-000000000003', repeat('f', 64),
  'security-test-admin', 'Forming test set'
);

insert into private.reference_resources (
  id, resource_key, resource_kind, label, description, route_path, sort_order
) values (
  '83000000-0000-4000-8000-000000000005',
  'forming-test-country',
  'country-geography',
  'Forming test country resource',
  'Private fixture used by the forming schema suite.',
  '/dashboard/country-codes',
  999
);

insert into private.reference_resource_versions (
  id, resource_id, version_number, lifecycle_state, schema_version,
  content_checksum, source_retrieved_at, source_metadata, normalized_resource,
  artifact_manifest, validation_summary, diff_summary, entry_count,
  created_by_owner_id, finalized_at
) values (
  '83000000-0000-4000-8000-000000000006',
  '83000000-0000-4000-8000-000000000005',
  1,
  'valid',
  1,
  repeat('7', 64),
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{"errorCount":0,"warningCount":0}'::jsonb,
  '{}'::jsonb,
  0,
  'security-test-admin',
  now()
);

insert into private.reference_resource_set_members (
  set_id, resource_id, version_id
) values (
  '83000000-0000-4000-8000-000000000003',
  '83000000-0000-4000-8000-000000000005',
  '83000000-0000-4000-8000-000000000006'
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

select is(
  (
    select jsonb_build_object(
      'sourceProfileKey', source_profile_key,
      'engineKey', engine_key,
      'artifactSchemaVersion', artifact_schema_version,
      'fingerprintValid', input_fingerprint ~ '^[0-9a-f]{64}$',
      'publicationTargetKey', publication_target_key
    )
    from private.dataset_forming_runs
    where id = '83000000-0000-4000-8000-000000000004'
  ),
  '{
    "sourceProfileKey":"imb-people-groups",
    "engineKey":"imb",
    "artifactSchemaVersion":1,
    "fingerprintValid":true,
    "publicationTargetKey":"imb-people-groups"
  }'::jsonb,
  'legacy IMB inserts receive deterministic generic metadata'
);

select is(
  (
    select attempt_number
    from private.dataset_forming_runs
    where id = '83000000-0000-4000-8000-000000000004'
  ),
  1,
  'the first exact forming fingerprint receives attempt one'
);

select results_eq(
  $$
    with claimed as (
      update private.dataset_forming_runs
      set execution_claimed_at = now(), started_at = now()
      where id = '83000000-0000-4000-8000-000000000004'
        and status = 'building'
        and execution_claimed_at is null
      returning id
    )
    select count(*)::bigint from claimed
  $$,
  array[1::bigint],
  'the first forming callback atomically claims execution'
);

select results_eq(
  $$
    with claimed as (
      update private.dataset_forming_runs
      set execution_claimed_at = now(), started_at = now()
      where id = '83000000-0000-4000-8000-000000000004'
        and status = 'building'
        and execution_claimed_at is null
      returning id
    )
    select count(*)::bigint from claimed
  $$,
  array[0::bigint],
  'a duplicate forming callback cannot claim the same execution'
);

select throws_ok(
  $$
    update private.dataset_forming_runs
    set attempt_number = 2
    where id = '83000000-0000-4000-8000-000000000004'
  $$,
  'P0001',
  'Dataset forming attempt numbers are immutable.',
  'forming attempt numbers cannot be rewritten'
);

select throws_ok(
  $$
    insert into private.dataset_forming_runs (
      id, connection_id, source_run_id, resource_set_id, source_profile_key,
      engine_key, artifact_schema_version, input_fingerprint,
      publication_target_key, attempt_number, actor_owner_id, status,
      source_rows_checksum, source_raw_checksum, field_contract_version,
      field_contract_checksum, transformation_version, transformation_checksum,
      input_row_count, validation_summary
    )
    select
      '83000000-0000-4000-8000-000000000008',
      connection_id, source_run_id, resource_set_id, source_profile_key,
      engine_key, artifact_schema_version, input_fingerprint,
      publication_target_key, attempt_number, actor_owner_id, 'building',
      source_rows_checksum, source_raw_checksum, field_contract_version,
      field_contract_checksum, transformation_version, transformation_checksum,
      input_row_count, '{}'::jsonb
    from private.dataset_forming_runs
    where id = '83000000-0000-4000-8000-000000000004'
  $$,
  '23505',
  null,
  'an exact forming fingerprint cannot reuse an attempt number'
);

select throws_ok(
  $$
    update private.dataset_forming_runs
    set engine_key = ''
    where id = '83000000-0000-4000-8000-000000000004'
  $$,
  '23514',
  null,
  'blank forming engine keys are rejected'
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
    insert into private.dataset_forming_resource_bindings (
      forming_run_id, position, binding_key, binding_type, required,
      kind, version, checksum, schema_version
    ) values (
      '83000000-0000-4000-8000-000000000004',
      2,
      'imb-field-contract',
      'code',
      true,
      'field-contract',
      '1',
      repeat('c', 64),
      1
    )
  $$,
  'code-defined forming bindings are accepted while a run is building'
);

select lives_ok(
  $$
    insert into private.dataset_forming_resource_bindings (
      forming_run_id, position, binding_key, binding_type, required,
      kind, version, checksum, schema_version, resource_set_id,
      resource_set_checksum, resource_id, resource_version_id
    ) values (
      '83000000-0000-4000-8000-000000000004',
      0,
      'forming-test-country',
      'catalog',
      true,
      'country-geography',
      '1',
      repeat('7', 64),
      1,
      '83000000-0000-4000-8000-000000000003',
      repeat('f', 64),
      '83000000-0000-4000-8000-000000000005',
      '83000000-0000-4000-8000-000000000006'
    )
  $$,
  'catalog forming bindings match an immutable resource-set member'
);

select throws_ok(
  $$
    insert into private.dataset_forming_resource_bindings (
      forming_run_id, position, binding_key, binding_type, required,
      kind, version, checksum, schema_version, resource_set_id,
      resource_set_checksum, resource_id, resource_version_id
    ) values (
      '83000000-0000-4000-8000-000000000004',
      1,
      'mismatched-catalog-binding',
      'catalog',
      true,
      'wrong-kind',
      '1',
      repeat('7', 64),
      1,
      '83000000-0000-4000-8000-000000000003',
      repeat('f', 64),
      '83000000-0000-4000-8000-000000000005',
      '83000000-0000-4000-8000-000000000006'
    )
  $$,
  'P0001',
  'Catalog forming binding metadata does not match its immutable resource-set member.',
  'catalog bindings cannot misstate their immutable resource metadata'
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
    update private.dataset_forming_resource_bindings
    set version = '2'
    where forming_run_id = '83000000-0000-4000-8000-000000000004'
      and binding_key = 'imb-field-contract'
  $$,
  'P0001',
  'Finalized dataset forming resource bindings are immutable.',
  'finalized normalized resource bindings cannot be changed'
);

select throws_ok(
  $$
    insert into private.dataset_forming_resource_bindings (
      forming_run_id, position, binding_key, binding_type, required,
      kind, version, checksum, schema_version
    ) values (
      '83000000-0000-4000-8000-000000000004',
      3,
      'late-code-contract',
      'code',
      true,
      'field-contract',
      '1',
      repeat('8', 64),
      1
    )
  $$,
  'P0001',
  'Finalized dataset forming resource bindings are immutable.',
  'bindings cannot be appended after candidate finalization'
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

select throws_ok(
  $$ select count(*)::bigint from private.dataset_forming_resource_bindings $$,
  '42501',
  null,
  'authenticated browsers cannot read forming resource bindings'
);

reset role;

select * from finish();
rollback;
