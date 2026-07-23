begin;

create extension if not exists pgtap with schema extensions;

select plan(45);

select results_eq(
  $$
    select tablename from pg_tables
    where schemaname = 'private' and tablename in (
      'pipeline_publications', 'pipeline_publication_rows',
      'ax_registry_revisions', 'ax_registry_revision_bindings',
      'ax_identity_counters', 'ax_identities', 'ax_identity_codes',
      'ax_identity_source_bindings', 'ax_identity_runs', 'ax_identity_run_rows',
      'ax_identity_findings', 'ax_identity_artifacts', 'ax_identity_legacy_imports',
      'ax_identity_legacy_import_audits', 'ax_identity_registry_cutovers',
      'ax_identity_graph_commit_sessions'
    ) order by tablename
  $$,
  array[
    'ax_identities'::name, 'ax_identity_artifacts'::name, 'ax_identity_codes'::name,
    'ax_identity_counters'::name, 'ax_identity_findings'::name,
    'ax_identity_graph_commit_sessions'::name,
    'ax_identity_legacy_import_audits'::name,
    'ax_identity_legacy_imports'::name,
    'ax_identity_registry_cutovers'::name, 'ax_identity_run_rows'::name,
    'ax_identity_runs'::name,
    'ax_identity_source_bindings'::name,
    'ax_registry_revision_bindings'::name, 'ax_registry_revisions'::name,
    'pipeline_publication_rows'::name, 'pipeline_publications'::name
  ],
  'identity registry and publication tables exist'
);

select is(
  (
    select count(*)::bigint from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname like 'ax\_%' escape '\'
      and pg_class.relkind = 'r' and pg_class.relrowsecurity
  ),
  14::bigint,
  'all AX identity tables have RLS enabled'
);

select is(
  (
    select count(*)::bigint from information_schema.table_privileges
    where table_schema = 'private'
      and (table_name like 'ax\_%' escape '\' or table_name like 'pipeline_publication%')
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0::bigint,
  'browser roles have no identity or publication table grants'
);

select ok(
  not has_function_privilege('anon', 'private.allocate_ax_identity_value(text,text,text,uuid,text,text,text,timestamptz)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.allocate_ax_identity_value(text,text,text,uuid,text,text,text,timestamptz)', 'EXECUTE'),
  'browser roles cannot execute the allocator'
);

select has_column('private', 'ax_identity_runs', 'publication_target_key',
  'identity candidates store a stable publication target');
select has_column('private', 'ax_identity_runs', 'expected_current_publication_id',
  'identity candidates pin the target publication seen at build time');
select has_column('private', 'ax_identity_runs', 'publication_attempt_id',
  'identity publication claims use opaque attempt tokens');
select has_column('private', 'ax_identity_runs', 'attempt_number',
  'identity candidates retain one immutable build-attempt number');
select has_index('private', 'ax_identity_runs', 'ax_identity_runs_publishing_target_idx',
  'only one candidate can publish a source target at a time');
select has_index('private', 'ax_identity_runs', 'ax_identity_runs_reusable_input_idx',
  'only one reusable candidate can own one exact identity input');
select has_trigger('private', 'ax_identity_runs', 'ax_identity_runs_publication_pin_immutable',
  'identity publication target pins are immutable');
select has_trigger('private', 'ax_identity_runs', 'ax_identity_runs_attempt_number_immutable',
  'identity candidate attempt lineage is immutable');
select has_function('private', 'finalize_ax_identity_publication',
  array['uuid', 'uuid', 'uuid', 'boolean', 'text', 'text', 'text'],
  'identity publication finalization has a target-aware transaction boundary');
select ok(
  has_function_privilege('service_role',
    'private.finalize_ax_identity_publication(uuid,uuid,uuid,boolean,text,text,text)', 'EXECUTE')
  and not has_function_privilege('service_role',
    'private.activate_ax_identity_run(uuid,text,text,text,text,text,text,integer,jsonb)', 'EXECUTE'),
  'service publication can use only the target-safe finalizer'
);

insert into public.datasets (
  id, owner_id, file_name, blob_url, blob_path, current_version_action,
  current_version_actor_owner_id, is_primary, is_workspace_visible,
  status, row_count, size_bytes, columns, hidden_column_keys, tags
) values (
  '84000000-0000-4000-8000-000000000001', 'security-admin', 'formed.csv',
  'https://example.com/formed.csv', 'datasets/formed.csv', 'api_import',
  'security-admin', false, false, 'ready', 2, 20,
  '[{"key":"Dataset_Row_Key","label":"Dataset_Row_Key","sourceIndex":0}]'::jsonb,
  '[]'::jsonb, '[]'::jsonb
);

insert into private.pipeline_publications (
  id, producer_kind, producer_run_id, dataset_id, source_profile_key,
  output_checksum, row_count, artifact_manifest, actor_owner_id, reason
) values (
  '84000000-0000-4000-8000-000000000002', 'dataset-forming',
  '84000000-0000-4000-8000-000000000003',
  '84000000-0000-4000-8000-000000000001', 'jp', repeat('a', 64), 2,
  '{}'::jsonb, 'security-admin', 'Identity registry test publication'
);

insert into private.pipeline_publication_rows (publication_id, row_index, data) values
  ('84000000-0000-4000-8000-000000000002', 0, '{"Dataset_Row_Key":"jp:1"}'::jsonb),
  ('84000000-0000-4000-8000-000000000002', 1, '{"Dataset_Row_Key":"jp:2"}'::jsonb);

insert into private.ax_identity_runs (
  id, source_publication_id, source_profile_key, rules_version, rules_checksum,
  resource_bindings, input_fingerprint, publication_target_key,
  actor_owner_id, status, input_row_count,
  reservation_expires_at, started_at
) values (
  '84000000-0000-4000-8000-000000000004',
  '84000000-0000-4000-8000-000000000002', 'jp', 'v1', repeat('b', 64),
  '{}'::jsonb, repeat('c', 64), 'identity-jp', 'security-admin', 'building', 1,
  now() + interval '1 day', now()
);

select throws_ok(
  $$
    insert into private.ax_identity_runs (
      id, source_publication_id, source_profile_key, rules_version,
      rules_checksum, resource_bindings, input_fingerprint, attempt_number,
      publication_target_key, actor_owner_id, status, input_row_count,
      reservation_expires_at, started_at
    ) values (
      '84000000-0000-4000-8000-000000000014',
      '84000000-0000-4000-8000-000000000002', 'jp', 'v1',
      repeat('b', 64), '{}'::jsonb, repeat('c', 64), 2,
      'identity-jp', 'security-admin', 'building', 1,
      now() + interval '1 day', now()
    )
  $$,
  '23505',
  null,
  'parallel exact-input builds cannot create two reusable candidates'
);

select throws_ok(
  $flat_import_cannot_unlock$
    do $test$
    declare
      flat_revision_id uuid;
    begin
      insert into private.ax_registry_revisions (
        content_checksum, binding_count, actor_owner_id, reason
      ) values (
        repeat('7', 64), 0, 'security-admin', 'Unsafe flat import revision'
      ) returning id into flat_revision_id;

      insert into private.ax_identity_legacy_imports (
        input_fingerprint, snapshot_manifest, status, registry_revision_id,
        actor_owner_id, reason, committed_at
      ) values (
        repeat('8', 64), '{}'::jsonb, 'committed', flat_revision_id,
        'security-admin', 'Unsafe flat import', now()
      );

      perform * from private.allocate_ax_identity_value(
        'people-groups', 'jp', 'jp:flat-import',
        '84000000-0000-4000-8000-000000000004', 'A010', 'jp', 'LAO',
        now() + interval '1 day'
      );
    end
    $test$
  $flat_import_cannot_unlock$,
  '23514',
  'Verified legacy AX registry cutover is required before identity allocation.',
  'a committed flat snapshot cannot unlock identity allocation'
);

insert into private.ax_registry_revisions (
  id, content_checksum, binding_count, actor_owner_id, reason
) values (
  '84000000-0000-4000-8000-000000000100', repeat('9', 64), 0,
  'security-admin', 'Verified legacy cutover test revision'
);

insert into private.ax_identity_legacy_imports (
  id, input_fingerprint, snapshot_manifest, status, registry_revision_id,
  actor_owner_id, reason, committed_at, import_kind, state_fingerprint,
  graph_checksum, report_checksum, manifest_checksum, dry_run_token_hash,
  report, dry_run_completed_at
) values (
  '84000000-0000-4000-8000-000000000101', repeat('a', 64), '{}'::jsonb,
  'dry-run', null, 'security-admin',
  'Verified legacy cutover test import', null, 'verified-identity-graph',
  repeat('b', 64), repeat('c', 64), repeat('d', 64), repeat('e', 64),
  repeat('f', 64), '{"blocking":false}'::jsonb, now()
);

-- The finalizer itself is exhaustively exercised in 008. This downstream
-- registry fixture uses the same transaction-bound authorization shape without
-- duplicating the full historical graph evidence payload.
insert into private.ax_identity_graph_commit_sessions (
  backend_pid, transaction_id, legacy_import_id, input_fingerprint,
  token_hash, state_fingerprint
) values (
  pg_backend_pid(), txid_current(),
  '84000000-0000-4000-8000-000000000101', repeat('a', 64),
  repeat('f', 64), repeat('b', 64)
);

update private.ax_identity_legacy_imports
set status = 'committed',
  registry_revision_id = '84000000-0000-4000-8000-000000000100',
  committed_at = now()
where id = '84000000-0000-4000-8000-000000000101';

insert into private.ax_identity_registry_cutovers (
  namespace, legacy_import_id, registry_revision_id, input_fingerprint,
  graph_checksum, report_checksum, actor_owner_id, reason
) values (
  'people-groups', '84000000-0000-4000-8000-000000000101',
  '84000000-0000-4000-8000-000000000100', repeat('a', 64),
  repeat('c', 64), repeat('d', 64), 'security-admin',
  'Verified legacy cutover test marker'
);

delete from private.ax_identity_graph_commit_sessions
where backend_pid = pg_backend_pid() and transaction_id = txid_current();

select is(
  (
    select count(*)::integer
    from private.ax_identity_registry_cutovers as cutover
    join private.ax_identity_legacy_imports as legacy
      on legacy.id = cutover.legacy_import_id
     and legacy.import_kind = 'verified-identity-graph'
     and legacy.status = 'committed'
     and legacy.registry_revision_id = cutover.registry_revision_id
    where cutover.namespace = 'people-groups'
  ),
  1,
  'only a verified identity graph cutover marker unlocks the registry'
);

select lives_ok(
  $$
    select * from private.allocate_ax_identity_value(
      'people-groups', 'jp', 'jp:1',
      '84000000-0000-4000-8000-000000000004', 'A010', 'jp', 'LAO',
      now() + interval '1 day'
    )
  $$,
  'valid allocation succeeds'
);

select is(
  (
    select allocated_value from private.allocate_ax_identity_value(
      'people-groups', 'jp', 'jp:1',
      '84000000-0000-4000-8000-000000000004', 'A010', 'jp', 'LAO',
      now() + interval '1 day'
    )
  ),
  1,
  'same stable row retry reuses its allocated value'
);

select is(
  (select count(*)::integer from private.ax_identity_source_bindings where source_profile_key = 'jp' and stable_row_key = 'jp:1'),
  1,
  'same stable row retry creates one binding'
);

select throws_ok(
  $$
    select * from private.allocate_ax_identity_value(
      'people-groups', '', 'jp:bad',
      '84000000-0000-4000-8000-000000000004', 'bad', 'XX', 'xxx', now()
    )
  $$,
  '22023',
  'AX identity allocation inputs are invalid.',
  'invalid allocation input is rejected'
);

select throws_ok(
  $$ update private.ax_identity_counters set next_value = 0 where namespace = 'people-groups' $$,
  'P0001',
  'AX identity counter values cannot be deleted, renumbered, or recycled.',
  'allocated numbers cannot be recycled'
);

select throws_ok(
  $$
    insert into private.ax_identity_codes (
      identity_id, code, code_kind, lifecycle_state, created_by_run_id
    ) select identity_id, '10-jp-000001-LAO', 'alias', 'reserved',
      '84000000-0000-4000-8000-000000000004'
    from private.ax_identity_source_bindings where stable_row_key = 'jp:1'
  $$,
  '23505',
  null,
  'canonical and alias codes share one collision-free namespace'
);

select is(
  private.cancel_ax_identity_run_reservations('84000000-0000-4000-8000-000000000004'),
  1,
  'candidate cancellation reports cancelled reservations'
);

select is(
  (select binding_state from private.ax_identity_source_bindings where stable_row_key = 'jp:1'),
  'cancelled',
  'candidate cancellation preserves an auditable cancelled binding'
);

select is(
  (select next_value from private.ax_identity_counters where namespace = 'people-groups'),
  2,
  'candidate cancellation does not recycle the allocated value'
);

update private.ax_identity_runs
set status = 'failed', error_message = 'Transient artifact failure',
  completed_at = now()
where id = '84000000-0000-4000-8000-000000000004';

select lives_ok(
  $$
    insert into private.ax_identity_runs (
      id, source_publication_id, source_profile_key, rules_version,
      rules_checksum, resource_bindings, input_fingerprint, attempt_number,
      publication_target_key, actor_owner_id, status, input_row_count,
      reservation_expires_at, started_at
    ) values (
      '84000000-0000-4000-8000-000000000014',
      '84000000-0000-4000-8000-000000000002', 'jp', 'v1',
      repeat('b', 64), '{}'::jsonb, repeat('c', 64), 2,
      'identity-jp', 'security-admin', 'building', 1,
      now() + interval '1 day', now()
    )
  $$,
  'a failed exact-input candidate can be retried as a new immutable attempt'
);

select is(
  (
    select attempt_number
    from private.ax_identity_runs
    where id = '84000000-0000-4000-8000-000000000014'
  ),
  2,
  'the retry advances the exact-input attempt number'
);

select throws_ok(
  $$
    update private.ax_identity_runs
    set attempt_number = 3
    where id = '84000000-0000-4000-8000-000000000014'
  $$,
  'P0001',
  'AX identity candidate attempt lineage is immutable.',
  'an identity build attempt cannot be renumbered'
);

select throws_ok(
  $$ update private.ax_identity_source_bindings set binding_state = 'reserved' where stable_row_key = 'jp:1' $$,
  'P0001',
  'Final AX binding records are immutable.',
  'cancelled bindings cannot reactivate'
);

insert into private.ax_identity_runs (
  id, source_publication_id, source_profile_key, rules_version, rules_checksum,
  resource_bindings, input_fingerprint, publication_target_key,
  actor_owner_id, status, input_row_count,
  reservation_expires_at, started_at
) values (
  '84000000-0000-4000-8000-000000000005',
  '84000000-0000-4000-8000-000000000002', 'jp', 'v1', repeat('b', 64),
  '{}'::jsonb, repeat('d', 64), 'identity-jp', 'security-admin', 'building', 1,
  now() + interval '1 day', now()
);

select lives_ok(
  $$
    select * from private.allocate_ax_identity_value(
      'people-groups', 'jp', 'jp:2',
      '84000000-0000-4000-8000-000000000005', 'A010', 'jp', 'LAO',
      now() + interval '1 day'
    )
  $$,
  'a later row receives a fresh non-recycled value'
);

insert into private.ax_identity_run_rows (
  identity_run_id, source_row_index, stable_row_key, assignment_status,
  binding_id, pgac_code, pgic_code, enriched_row
)
select
  '84000000-0000-4000-8000-000000000005', 0, 'jp:2', 'reserved', id,
  '10-jp-000002', '10-jp-000002-LAO',
  '{"Dataset_Row_Key":"jp:2","AX_PGAC":"10-jp-000002","AX_PGIC":"10-jp-000002-LAO"}'::jsonb
from private.ax_identity_source_bindings where stable_row_key = 'jp:2';

update private.ax_identity_runs
set status = 'valid', output_row_count = 1, reserved_count = 1,
  output_checksum = repeat('e', 64), artifact_manifest = '{"csv":"identity-registry-runs/test/csv.csv"}'::jsonb,
  row_evidence_checksum = (
    select encode(extensions.digest(
      jsonb_agg(jsonb_build_object(
        'sourceRowIndex', source_row_index,
        'data', enriched_row
      ) order by source_row_index)::text,
      'sha256'
    ), 'hex')
    from private.ax_identity_run_rows
    where identity_run_id = '84000000-0000-4000-8000-000000000005'
  ),
  completed_at = now()
where id = '84000000-0000-4000-8000-000000000005';

select has_trigger(
  'private', 'ax_identity_run_rows', 'ax_identity_run_rows_immutable',
  'identity candidate rows are append-only'
);

select has_trigger(
  'private', 'ax_identity_findings', 'ax_identity_findings_immutable',
  'identity findings are append-only'
);

select has_trigger(
  'private', 'ax_identity_artifacts', 'ax_identity_artifacts_immutable',
  'identity artifact evidence is append-only'
);

insert into public.datasets (
  id, owner_id, file_name, blob_url, blob_path, current_version_action,
  current_version_actor_owner_id, current_version_actor_email,
  is_primary, is_workspace_visible, status, row_count, size_bytes,
  columns, hidden_column_keys, tags
) values (
  '84000000-0000-4000-8000-000000000006', 'security-admin', 'jp-identity.csv',
  'https://example.com/jp-identity.csv', 'datasets/csv/jp-identity.csv', 'upload',
  'security-admin', 'admin@example.com', false, false, 'ready', 1, 100,
  '[{"key":"Dataset_Row_Key","label":"Dataset_Row_Key","sourceIndex":0}]'::jsonb,
  '[]'::jsonb, '[]'::jsonb
);

insert into public.dataset_rows (dataset_id, row_index, data)
select '84000000-0000-4000-8000-000000000006', source_row_index, enriched_row
from private.ax_identity_run_rows
where identity_run_id = '84000000-0000-4000-8000-000000000005';

update private.ax_identity_runs
set status = 'publishing',
  publication_attempt_id = '84000000-0000-4000-8000-000000000007',
  publishing_started_at = now(),
  publication_blob_path = 'datasets/csv/jp-identity.csv'
where id = '84000000-0000-4000-8000-000000000005';

select lives_ok(
  $$
    select * from private.finalize_ax_identity_publication(
      '84000000-0000-4000-8000-000000000005',
      '84000000-0000-4000-8000-000000000006',
      '84000000-0000-4000-8000-000000000007', true,
      'security-admin', 'admin@example.com', 'Publish tested identity'
    )
  $$,
  'valid candidate publication activates registry against one prepared dataset atomically'
);

select is(
  (select publication_target_key from private.pipeline_publications where producer_kind = 'identity'),
  'identity-jp',
  'identity publication records its stable per-source target'
);

select is(
  (select status from private.ax_identity_runs where id = '84000000-0000-4000-8000-000000000005'),
  'published',
  'published candidate reaches final lifecycle state'
);

select is(
  (select count(*)::integer from private.pipeline_publications where producer_kind = 'identity'),
  1,
  'identity publication creates one immutable publication anchor'
);

select is(
  (
    select count(*)::integer from public.dataset_rows
    where dataset_id = (
      select dataset_id from private.ax_identity_runs where id = '84000000-0000-4000-8000-000000000005'
    )
  ),
  1,
  'identity dataset rows publish in the activation transaction'
);

select is(
  (select binding_state from private.ax_identity_source_bindings where stable_row_key = 'jp:2'),
  'active',
  'published reservation becomes active'
);

select is(
  (select count(*)::integer from private.ax_registry_revision_bindings),
  1,
  'registry revision snapshots active bindings'
);

select throws_ok(
  $$ update private.ax_registry_revisions set reason = 'changed' $$,
  'P0001',
  'AX identity history is append-only.',
  'registry revisions are immutable'
);

select throws_ok(
  $$ update private.pipeline_publications set reason = 'changed' where producer_kind = 'identity' $$,
  'P0001',
  'AX identity history is append-only.',
  'publication anchors are immutable'
);

select throws_ok(
  $$ set local role authenticated; select count(*) from private.ax_identities $$,
  '42501',
  null,
  'authenticated browser role cannot read registry tables'
);

select is(
  private.expire_ax_identity_run(
    '84000000-0000-4000-8000-000000000099'::uuid,
    now()
  ),
  false,
  'serialized identity expiry is a safe no-op for a missing run'
);

select * from finish();
rollback;
