begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

select has_column(
  'private',
  'pipeline_runs',
  'publication_attempt_id',
  'pipeline publication attempts carry an opaque recoverable lease token'
);

select has_column(
  'private',
  'pipeline_runs',
  'expected_current_publication_id',
  'reviewed candidates pin the target publication current at build time'
);

select has_index(
  'private',
  'pipeline_runs',
  'pipeline_runs_publishing_lease_idx',
  'stale publishing leases can be found without scanning all pipeline runs'
);

select has_trigger(
  'private',
  'pipeline_runs',
  'pipeline_runs_publication_pin_immutable',
  'the reviewed target publication pin cannot change after candidate creation'
);

select is(
  (
    select count(*)::bigint from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname in (
        'pipeline_definitions', 'pipeline_release_sets', 'pipeline_release_members',
        'pipeline_runs', 'pipeline_run_inputs', 'pipeline_artifacts',
        'pipeline_findings', 'pipeline_publication_inputs'
      ) and pg_class.relkind = 'r'
  ),
  8::bigint,
  'Tier 1 release, run, evidence, and lineage tables exist'
);

select is(
  (
    select count(*)::bigint from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname in (
        'pipeline_definitions', 'pipeline_release_sets', 'pipeline_release_members',
        'pipeline_runs', 'pipeline_run_inputs', 'pipeline_artifacts',
        'pipeline_findings', 'pipeline_publication_inputs'
      ) and pg_class.relrowsecurity
  ),
  8::bigint,
  'all Tier 1 control tables have RLS enabled'
);

select is(
  (
    select count(*)::bigint from information_schema.table_privileges
    where table_schema = 'private'
      and table_name in (
        'pipeline_definitions', 'pipeline_release_sets', 'pipeline_release_members',
        'pipeline_runs', 'pipeline_run_inputs', 'pipeline_artifacts',
        'pipeline_findings', 'pipeline_publication_inputs'
      ) and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0::bigint,
  'browser-facing roles cannot access Tier 1 control tables'
);

select is(
  (select count(*)::bigint from private.pipeline_definitions
   where active and definition_key in (
     'tier1-pgic-merge', 'tier1-specific-pg-merge', 'aggregate1-pgac',
     'aggregate1-self-engaged', 'aggregate1-watchlist',
     'aggregate1-baseline-uupg', 'aggregate1-hotspots', 'aggregate1-south-asia'
   )),
  8::bigint,
  'all eight immutable Tier 1 and Aggregate 1 definitions are registered'
);

select ok(
  exists(
    select 1 from private.pipeline_definitions
    where definition_key = 'tier1-pgic-merge'
      and checksum = '732a52ce030ead236c08c2a6810dd54129fb31b2fe0253072fa5177b22097b38'
  ),
  'the database pins the runtime Tier 1 PGIC definition checksum'
);

select is(
  (select count(*)::bigint from private.pipeline_definitions
   where active and is_workspace_visible
     and stage in ('tier1-merge', 'aggregate1')),
  8::bigint,
  'all final Tier 1 and Aggregate 1 products are declared workspace-visible'
);

insert into private.reference_resource_sets (
  id, content_checksum, created_by_owner_id, reason
) values (
  '85000000-0000-4000-8000-000000000001', repeat('a', 64),
  'pipeline-test-admin', 'Pipeline product fixture'
);

insert into private.ax_identity_authority_activation_attempts (
  id, namespace, environment, state_fingerprint, empty_graph_checksum,
  rules_checksum, formatter_checksum, token_hash, actor_owner_id,
  reason, expires_at, consumed_at
) values (
  '85000000-0000-4000-8000-000000000006', 'people-groups', 'test',
  repeat('7', 64), repeat('b', 64), repeat('8', 64), repeat('9', 64),
  repeat('a', 64), 'pipeline-test-admin', 'Fresh authority fixture',
  now() + interval '30 minutes', now()
);
insert into private.ax_registry_revisions (
  id, content_checksum, binding_count, actor_owner_id, reason
) values (
  '85000000-0000-4000-8000-000000000002', repeat('b', 64), 0,
  'pipeline-test-admin', 'Fresh empty authority revision'
);
insert into private.ax_identity_authorities (
  namespace, environment, registry_revision_id, activation_attempt_id,
  state_fingerprint, empty_graph_checksum, rules_checksum,
  formatter_checksum, actor_owner_id, reason
) values (
  'people-groups', 'test', '85000000-0000-4000-8000-000000000002',
  '85000000-0000-4000-8000-000000000006', repeat('7', 64),
  repeat('b', 64), repeat('8', 64), repeat('9', 64),
  'pipeline-test-admin', 'Fresh authority fixture'
);

insert into public.datasets (
  id, owner_id, file_name, blob_url, blob_path, current_version_action,
  current_version_actor_owner_id, is_primary, is_workspace_visible, status,
  row_count, size_bytes, columns, hidden_column_keys, tags
) values (
  '85000000-0000-4000-8000-000000000003', 'pipeline-test-admin', 'input.csv',
  'https://example.invalid/input.csv', 'fixtures/input.csv', 'api_import',
  'pipeline-test-admin', false, false, 'ready', 1, 2,
  '[{"key":"PGIC","label":"PGIC","sourceIndex":0}]'::jsonb,
  '[]'::jsonb, '[]'::jsonb
);

insert into private.pipeline_publications (
  id, producer_kind, producer_run_id, dataset_id, source_profile_key,
  registry_revision_id, output_checksum, row_count, artifact_manifest,
  actor_owner_id, reason, publication_target_key
)
select
  ('85000000-0000-4000-8000-' || lpad(source.position::text, 12, '0'))::uuid,
  'identity',
  ('86000000-0000-4000-8000-' || lpad(source.position::text, 12, '0'))::uuid,
  '85000000-0000-4000-8000-000000000003', source.profile,
  '85000000-0000-4000-8000-000000000002', repeat(source.checksum_digit, 64),
  1, '{}'::jsonb, 'pipeline-test-admin', 'Identity fixture',
  'identity-' || source.profile
from (values
  (10, 'accelerate', '1'),
  (11, 'etnopedia', '2'),
  (12, 'imb', '3'),
  (13, 'joshua-project', '4'),
  (14, 'world-christian-database', '5')
) as source(position, profile, checksum_digit);

insert into private.pipeline_publication_rows (publication_id, row_index, data)
select id, 0, jsonb_build_object('PGIC', right(id::text, 2))
from private.pipeline_publications
where id between '85000000-0000-4000-8000-000000000010' and '85000000-0000-4000-8000-000000000014';

insert into private.pipeline_release_sets (
  id, release_key, resource_set_id, registry_revision_id, rule_version,
  rule_checksum, rule_payload, created_by_owner_id
) values (
  '85000000-0000-4000-8000-000000000020', 'tier1-test-release',
  '85000000-0000-4000-8000-000000000001',
  '85000000-0000-4000-8000-000000000002', 'v1', repeat('c', 64),
  '[]'::jsonb, 'pipeline-test-admin'
);

insert into private.pipeline_release_members (
  release_set_id, position, input_key, publication_id, publication_checksum,
  publication_row_count, registry_revision_id
)
select
  '85000000-0000-4000-8000-000000000020', source.position,
  source.input_key,
  ('85000000-0000-4000-8000-' || lpad((source.position + 10)::text, 12, '0'))::uuid,
  repeat((source.position + 1)::text, 64), 1,
  '85000000-0000-4000-8000-000000000002'
from (values (0, 'ax'), (1, 'etno'), (2, 'imb'), (3, 'jp'), (4, 'wcd'))
  as source(position, input_key);

select lives_ok(
  $$
    update private.pipeline_release_sets
    set status = 'finalized', canonical_checksum = repeat('d', 64),
      finalized_by_owner_id = 'pipeline-test-admin',
      finalization_reason = 'Approved exact release', finalized_at = now()
    where id = '85000000-0000-4000-8000-000000000020'
  $$,
  'a complete draft release can be finalized once'
);

select throws_ok(
  $$
    update private.pipeline_release_sets
    set rule_version = 'changed'
    where id = '85000000-0000-4000-8000-000000000020'
  $$,
  'P0001',
  'Finalized pipeline releases are immutable.',
  'finalized release bindings cannot drift'
);

select throws_ok(
  $$
    update private.pipeline_release_members
    set publication_checksum = repeat('e', 64)
    where release_set_id = '85000000-0000-4000-8000-000000000020' and position = 0
  $$,
  'P0001',
  'Pipeline release members are immutable after insertion.',
  'release members cannot be replaced after review'
);

insert into private.pipeline_runs (
  id, definition_key, definition_version, definition_checksum, release_set_id,
  resource_set_id, registry_revision_id, actor_owner_id, status,
  input_fingerprint, input_row_count, started_at
) values (
  '85000000-0000-4000-8000-000000000030', 'tier1-pgic-merge', 'v1',
  '732a52ce030ead236c08c2a6810dd54129fb31b2fe0253072fa5177b22097b38',
  '85000000-0000-4000-8000-000000000020',
  '85000000-0000-4000-8000-000000000001',
  '85000000-0000-4000-8000-000000000002', 'pipeline-test-admin', 'building',
  repeat('f', 64), 5, now()
);

insert into private.pipeline_run_inputs (
  run_id, position, input_key, publication_id, publication_checksum, publication_row_count
) select
  '85000000-0000-4000-8000-000000000030', position, input_key, publication_id,
  publication_checksum, publication_row_count
from private.pipeline_release_members
where release_set_id = '85000000-0000-4000-8000-000000000020';

select lives_ok(
  $$
    update private.pipeline_runs
    set status = 'valid', output_row_count = 1, output_checksum = repeat('9', 64),
      artifact_manifest = '{"schemaVersion":1,"artifacts":[]}'::jsonb,
      completed_at = now()
    where id = '85000000-0000-4000-8000-000000000030'
  $$,
  'a building candidate can finalize into immutable review state'
);

select throws_ok(
  $$
    update private.pipeline_runs
    set definition_version = 'changed'
    where id = '85000000-0000-4000-8000-000000000030'
  $$,
  'P0001',
  'Finalized pipeline run bindings and artifacts are immutable.',
  'finalized run lineage cannot be rewritten'
);

select throws_ok(
  $$
    update private.pipeline_runs
    set expected_current_publication_id = '85000000-0000-4000-8000-000000000010'
    where id = '85000000-0000-4000-8000-000000000030'
  $$,
  'P0001',
  'The pipeline publication target pin is immutable.',
  'a reviewed candidate cannot be redirected to another stable target state'
);

insert into private.pipeline_artifacts (
  run_id, artifact_kind, storage_path, content_checksum, size_bytes
) values (
  '85000000-0000-4000-8000-000000000030', 'rows-json',
  'pipeline-products/test/rows.json', repeat('8', 64), 10
);

select throws_ok(
  $$
    delete from private.pipeline_artifacts
    where run_id = '85000000-0000-4000-8000-000000000030'
  $$,
  'P0001',
  'Pipeline evidence is append-only.',
  'candidate evidence cannot be deleted'
);

rollback;
