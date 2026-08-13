begin;

create extension if not exists pgtap with schema extensions;

select plan(40);

select results_eq(
  $$
    select tablename from pg_tables
    where schemaname = 'private' and tablename in (
      'pipeline_publications', 'pipeline_publication_rows',
      'ax_registry_revisions', 'ax_registry_revision_bindings',
      'ax_identity_counters', 'ax_identities', 'ax_identity_codes',
      'ax_identity_source_bindings', 'ax_identity_runs', 'ax_identity_run_rows',
      'ax_identity_findings', 'ax_identity_artifacts',
      'ax_identity_rop3_evidence', 'ax_identity_change_decisions',
      'ax_identity_authority_activation_attempts', 'ax_identity_authorities'
    ) order by tablename
  $$,
  array[
    'ax_identities'::name, 'ax_identity_artifacts'::name,
    'ax_identity_authorities'::name,
    'ax_identity_authority_activation_attempts'::name,
    'ax_identity_change_decisions'::name, 'ax_identity_codes'::name,
    'ax_identity_counters'::name, 'ax_identity_findings'::name,
    'ax_identity_rop3_evidence'::name, 'ax_identity_run_rows'::name,
    'ax_identity_runs'::name, 'ax_identity_source_bindings'::name,
    'ax_registry_revision_bindings'::name, 'ax_registry_revisions'::name,
    'pipeline_publication_rows'::name, 'pipeline_publications'::name
  ],
  'fresh identity authority tables exist'
);

select is(
  (select count(*) from pg_tables where schemaname = 'private' and tablename in (
    'ax_identity_legacy_imports', 'ax_identity_legacy_import_audits',
    'ax_identity_registry_cutovers', 'ax_identity_graph_commit_sessions'
  )),
  0::bigint,
  'legacy identity import and cutover tables do not exist'
);

select is(
  (select count(*) from information_schema.columns
   where table_schema = 'private' and table_name like 'ax_identity%'
     and column_name in ('legacy_import_id', 'created_by_import_id',
       'source_pgac_code', 'source_pgic_code', 'legacy_component')),
  0::bigint,
  'legacy identity ownership and source-code columns do not exist'
);

select is(
  (select count(*) from information_schema.table_privileges
   where table_schema = 'private'
     and (table_name like 'ax\_%' escape '\' or table_name like 'pipeline_publication%')
     and grantee in ('PUBLIC', 'anon', 'authenticated')),
  0::bigint,
  'browser roles have no identity authority table grants'
);

select ok(
  not has_function_privilege('anon',
    'private.begin_ax_identity_authority_activation(text,text,text,text,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated',
    'private.commit_ax_identity_authority_activation(uuid,text,text,text,text)', 'EXECUTE'),
  'browser roles cannot activate the authority'
);

select ok(
  has_function_privilege('service_role',
    'private.begin_ax_identity_authority_activation(text,text,text,text,text,text)', 'EXECUTE')
  and has_function_privilege('service_role',
    'private.commit_ax_identity_authority_activation(uuid,text,text,text,text)', 'EXECUTE'),
  'the trusted CLI database role can run the activation handshake'
);

select ok(
  not has_table_privilege('service_role', 'private.ax_identity_authorities', 'INSERT')
  and not has_table_privilege('service_role',
    'private.ax_identity_authority_activation_attempts', 'UPDATE'),
  'service code cannot forge authority markers or consume attempts directly'
);

select has_function('private', 'begin_ax_identity_authority_activation',
  array['text','text','text','text','text','text'],
  'authority activation has an explicit dry-run entry point');
select has_function('private', 'commit_ax_identity_authority_activation',
  array['uuid','text','text','text','text'],
  'authority activation has a state-bound commit entry point');
select has_function('private', 'allocate_ax_identity_value',
  array['text','text','text','uuid','text','text','text','timestamp with time zone','jsonb','text','uuid'],
  'fresh allocator accepts canonical current evidence and optional supersession');

select is((select next_value from private.ax_identity_counters
  where namespace = 'people-groups'), 1, 'fresh counter begins at 000001');
select is((select count(*) from private.ax_registry_revisions), 0::bigint,
  'no registry revision exists before activation');
select is((select count(*) from private.ax_identities), 0::bigint,
  'no identities exist before activation');
select is((select count(*) from private.ax_identity_codes), 0::bigint,
  'no codes exist before activation');
select is((select count(*) from private.ax_identity_source_bindings), 0::bigint,
  'no bindings exist before activation');

select throws_ok(
  $$ insert into private.ax_identities (
       namespace, identity_kind, allocated_value, lifecycle_state
     ) values ('people-groups', 'pgac', 1, 'reserved') $$,
  '23514', 'Initialized AX Online identity authority is required.',
  'identity rows cannot be created before authority activation'
);

create temporary table authority_attempt as
select * from private.begin_ax_identity_authority_activation(
  'test', repeat('a', 64), repeat('b', 64),
  'database-test', 'database-test@example.org', 'Initialize empty test authority'
);

select is((select count(*) from authority_attempt), 1::bigint,
  'dry run creates one state-bound activation attempt');
select matches((select state_fingerprint from authority_attempt), '^[0-9a-f]{64}$',
  'dry run records the exact empty-state fingerprint');
select matches((select empty_graph_checksum from authority_attempt), '^[0-9a-f]{64}$',
  'dry run records the empty graph checksum');
select ok((select expires_at > now() from authority_attempt),
  'activation attempt is short lived');

create temporary table authority_result as
select committed.*
from authority_attempt as attempt
cross join lateral private.commit_ax_identity_authority_activation(
  attempt.activation_attempt_id, attempt.activation_token,
  attempt.state_fingerprint, repeat('a', 64), repeat('b', 64)
) as committed;

select is((select revision_number from authority_result), 1::bigint,
  'activation creates registry revision 1');
select is((select count(*) from private.ax_identity_authorities), 1::bigint,
  'activation creates one immutable authority marker');
select is((select binding_count from private.ax_registry_revisions), 0,
  'revision 1 contains zero bindings');
select is((select count(*) from private.ax_registry_revision_bindings), 0::bigint,
  'revision 1 has no hidden binding snapshot rows');
select is((select next_value from private.ax_identity_counters
  where namespace = 'people-groups'), 1,
  'activation does not consume the first registry number');
select is((select rules_checksum from private.ax_identity_authorities), repeat('a', 64),
  'authority pins the approved rules checksum');
select is((select formatter_checksum from private.ax_identity_authorities), repeat('b', 64),
  'authority pins the established formatter checksum');

select throws_ok(
  $$ update private.ax_identity_authorities set reason = 'rewrite' $$,
  'AX identity history is append-only.',
  'the authority marker is immutable'
);

insert into public.datasets (
  id, owner_id, file_name, blob_url, blob_path, current_version_action,
  current_version_actor_owner_id, is_primary, is_workspace_visible,
  status, row_count, size_bytes, columns, hidden_column_keys, tags
) values (
  '84000000-0000-4000-8000-000000000001', 'security-admin', 'formed.csv',
  'https://example.com/formed.csv', 'datasets/formed.csv', 'api_import',
  'security-admin', false, false, 'ready', 1, 10,
  '[{"key":"Dataset_Row_Key","label":"Dataset_Row_Key","sourceIndex":0}]'::jsonb,
  '[]'::jsonb, '["PGAC"]'::jsonb
);
insert into private.pipeline_publications (
  id, producer_kind, producer_run_id, dataset_id, source_profile_key,
  output_checksum, row_count, artifact_manifest, actor_owner_id, reason
) values (
  '84000000-0000-4000-8000-000000000002', 'dataset-forming',
  '84000000-0000-4000-8000-000000000003',
  '84000000-0000-4000-8000-000000000001', 'jp', repeat('c', 64), 1,
  '{}'::jsonb, 'security-admin', 'Fresh identity test source'
);
insert into private.ax_identity_runs (
  id, source_publication_id, base_revision_id, source_profile_key,
  rules_version, rules_checksum, resource_bindings, input_fingerprint,
  publication_target_key, actor_owner_id, status, input_row_count,
  reservation_expires_at, started_at
) values (
  '84000000-0000-4000-8000-000000000004',
  '84000000-0000-4000-8000-000000000002',
  (select revision_id from authority_result), 'jp', 'v3', repeat('d', 64),
  '{}'::jsonb, repeat('e', 64), 'identity-jp', 'security-admin',
  'building', 1, now() + interval '1 day', now()
);

create temporary table first_allocation as
select * from private.allocate_ax_identity_value(
  'people-groups', 'jp', 'jp:1',
  '84000000-0000-4000-8000-000000000004', null, 'jp', null,
  now() + interval '1 day',
  '{"classification":"PGAC","rop1":null,"sourceInitials":"jp","rop3":null,"iso3":null}'::jsonb,
  repeat('f', 64), null
);

select is((select allocated_value from first_allocation), 1,
  'first current-source allocation consumes 000001');
select is((select pgac_code from first_allocation), '00-jp-000001',
  'missing ROP1 and ROP3 uses the established 00 PGAC format');
select is((select pgic_code from first_allocation), null,
  'PGAC-only allocation does not fabricate a geography');
select is((select next_value from private.ax_identity_counters
  where namespace = 'people-groups'), 2,
  'allocated numbers are never recycled');
select is((select identity_evidence->>'rop3'
  from private.ax_identity_source_bindings), null,
  'binding evidence contains no fabricated ROP3');
select is((select count(*) from private.ax_identity_codes
  where code like 'AX2%'), 0::bigint,
  'no AX2 namespace exists');
select is((select count(*) from storage.objects
  where bucket_id = 'identity-registry-evidence'), 0::bigint,
  'no historical AX identity evidence is stored');

select private.authorize_pipeline_dataset_mutation();
insert into private.ax_identity_run_rows (
  identity_run_id, source_row_index, stable_row_key, assignment_status,
  binding_id, pgac_code, pgic_code, enriched_row
) select
  '84000000-0000-4000-8000-000000000004', 0, 'jp:1', 'pgac-only',
  binding_id, pgac_code, pgic_code,
  jsonb_build_object('Dataset_Row_Key', 'jp:1', 'AX_Code', pgac_code)
from first_allocation;
insert into public.dataset_rows (dataset_id, row_index, data)
select
  '84000000-0000-4000-8000-000000000001', source_row_index, enriched_row
from private.ax_identity_run_rows
where identity_run_id = '84000000-0000-4000-8000-000000000004';
update private.ax_identity_runs
set status = 'publishing', output_row_count = 1, reserved_count = 1,
  output_checksum = repeat('1', 64),
  row_evidence_checksum = (
    select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_object(
      'sourceRowIndex', source_row_index, 'data', enriched_row
    ) order by source_row_index)::text, '[]'), 'sha256'), 'hex')
    from private.ax_identity_run_rows
    where identity_run_id = '84000000-0000-4000-8000-000000000004'
  ),
  publication_attempt_id = '84000000-0000-4000-8000-000000000005',
  publishing_started_at = now(),
  publication_blob_path = 'datasets/csv/fresh-identity-first.csv',
  completed_at = now()
where id = '84000000-0000-4000-8000-000000000004';

create temporary table first_publication as
select * from private.finalize_ax_identity_publication(
  '84000000-0000-4000-8000-000000000004',
  '84000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000005', true,
  'security-admin', null, 'Publish first current-source identity'
);

select is((select revision_number from private.ax_registry_revisions
  where id = (select revision_id from first_publication)), 2::bigint,
  'the first approved current-source identity publication creates revision 2');
select is((select binding_state from private.ax_identity_source_bindings
  where id = (select binding_id from first_allocation)), 'active',
  'the first publication atomically activates its current-source binding');

insert into private.ax_identity_runs (
  id, source_publication_id, base_revision_id, source_profile_key,
  rules_version, rules_checksum, resource_bindings, input_fingerprint,
  publication_target_key, expected_current_publication_id,
  actor_owner_id, status, input_row_count, output_row_count, reused_count,
  output_checksum, row_evidence_checksum, artifact_manifest,
  publication_attempt_id, publishing_started_at, publication_blob_path,
  started_at, completed_at
) values (
  '84000000-0000-4000-8000-000000000006',
  '84000000-0000-4000-8000-000000000002',
  (select revision_id from first_publication), 'jp', 'v3', repeat('d', 64),
  '{}'::jsonb, repeat('2', 64), 'identity-jp',
  (select publication_id from first_publication),
  'security-admin', 'publishing', 1, 1, 1, repeat('1', 64),
  (select row_evidence_checksum from private.ax_identity_runs
    where id = '84000000-0000-4000-8000-000000000004'),
  '{}'::jsonb, '84000000-0000-4000-8000-000000000007', now(),
  'datasets/csv/fresh-identity-repeat.csv', now(), now()
);
insert into private.ax_identity_run_rows (
  identity_run_id, source_row_index, stable_row_key, assignment_status,
  binding_id, pgac_code, pgic_code, enriched_row
) select
  '84000000-0000-4000-8000-000000000006', source_row_index,
  stable_row_key, 'reused', binding_id, pgac_code, pgic_code, enriched_row
from private.ax_identity_run_rows
where identity_run_id = '84000000-0000-4000-8000-000000000004';

create temporary table repeat_publication as
select * from private.finalize_ax_identity_publication(
  '84000000-0000-4000-8000-000000000006',
  '84000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000007', false,
  'security-admin', null, 'Republish unchanged identity graph'
);

select is((select count(*) from private.ax_registry_revisions), 2::bigint,
  'an unchanged identity graph does not create revision 3');
select is((select revision_id from repeat_publication),
  (select revision_id from first_publication),
  'an unchanged publication reuses the exact current registry revision');
select is((select next_value from private.ax_identity_counters
  where namespace = 'people-groups'), 2,
  'an unchanged publication consumes no additional registry number');

select * from finish();
rollback;
