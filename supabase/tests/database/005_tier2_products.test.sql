begin;

create extension if not exists pgtap with schema extensions;

select plan(52);

select has_table('private', 'tier2_contract_resources', 'Tier 2 contract resources exist');
select has_table('private', 'tier2_contract_resource_versions', 'Tier 2 resource versions exist');
select has_table('private', 'tier2_contract_resource_activations', 'Tier 2 activation history exists');
select has_table('private', 'tier2_partner_profiles', 'Tier 2 partner profiles exist');
select has_table('private', 'tier2_partner_profile_resource_bindings', 'Tier 2 profile resource bindings exist');
select has_table('private', 'tier2_forming_runs', 'Tier 2 forming lineage exists');
select has_table('private', 'tier2_pipeline_run_rows', 'Tier 2 candidate rows exist');
select has_table('private', 'tier2_publication_targets', 'Tier 2 stable publication targets exist');
select has_function(
  'private',
  'lock_tier2_forming_publication_target',
  array['uuid', 'uuid'],
  'Tier 2 formed-source publication has a serialized commit-time CAS guard'
);
select has_column(
  'private',
  'dataset_forming_runs',
  'publication_attempt_id',
  'formed-source publication records an opaque attempt owner'
);
select has_column(
  'private',
  'dataset_forming_runs',
  'publication_blob_path',
  'formed-source publication records its attempt-owned blob'
);

select is(
  (
    select count(*)::bigint
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname = any(array[
        'tier2_contract_resources', 'tier2_contract_resource_versions',
        'tier2_contract_resource_activations', 'tier2_partner_profiles',
        'tier2_partner_profile_resource_bindings', 'tier2_forming_runs',
        'tier2_pipeline_run_rows', 'tier2_publication_targets'
      ])
      and pg_class.relrowsecurity
  ),
  8::bigint,
  'all Tier 2 private tables have RLS enabled'
);

select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name = any(array[
        'tier2_contract_resources', 'tier2_contract_resource_versions',
        'tier2_contract_resource_activations', 'tier2_partner_profiles',
        'tier2_partner_profile_resource_bindings', 'tier2_forming_runs',
        'tier2_pipeline_run_rows', 'tier2_publication_targets'
      ])
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0::bigint,
  'browser-facing roles have no Tier 2 table grants'
);

insert into private.api_connections (
  id, name, description, method, url, request_headers, secret_header_names,
  body_template, response_format, response_data_path, import_mode,
  dataset_name, dataset_classification, provider, provider_config,
  created_by_owner_id, updated_by_owner_id
) values (
  '81000000-0000-4000-8000-000000000001', 'Tier 2 Partner Alpha', '', 'GET',
  'https://docs.google.com/spreadsheets/d/tier2-alpha/edit', '[]'::jsonb, '[]'::jsonb,
  '', 'csv', '', 'create', 'tier2-alpha.csv', 'PGIC', 'google_sheets',
  '{"provider":"google_sheets","spreadsheetId":"tier2-alpha","spreadsheetUrl":"https://docs.google.com/spreadsheets/d/tier2-alpha/edit","spreadsheetTitle":"Alpha","sheetId":42,"sheetTitle":"Engagement","rangeMode":"full_tab"}'::jsonb,
  'tier2-test-admin', 'tier2-test-admin'
);

select lives_ok(
  $$
    insert into private.tier2_partner_profiles (
      id, profile_key, partner_key, display_name, api_connection_id,
      spreadsheet_id, sheet_id, sheet_title, stable_row_key_column,
      tracking_id_column, tracking_id_source, source_rop3_column,
      source_country_column, source_iso3_column, contract_version,
      contract_checksum, created_by_owner_id, updated_by_owner_id
    ) values (
      '82000000-0000-4000-8000-000000000001', 'partner-alpha', 'alpha',
      'Partner Alpha', '81000000-0000-4000-8000-000000000001',
      'tier2-alpha', 42, 'Engagement', 'Partner Row ID', 'PeopleID3',
      'peopleid3', 'ROP3', 'Country', 'ISO3', 'v1', repeat('a', 64),
      'tier2-test-admin', 'tier2-test-admin'
    )
  $$,
  'a profile can bind the exact configured Google Sheet tab'
);

insert into private.api_connections (
  id, name, description, method, url, request_headers, secret_header_names,
  body_template, response_format, response_data_path, import_mode,
  dataset_name, dataset_classification, provider, provider_config,
  created_by_owner_id, updated_by_owner_id
) values (
  '81000000-0000-4000-8000-000000000002', 'Tier 2 Partner Alpha second feed', '', 'GET',
  'https://docs.google.com/spreadsheets/d/tier2-alpha-second/edit', '[]'::jsonb, '[]'::jsonb,
  '', 'csv', '', 'create', 'tier2-alpha-second.csv', 'PGAC', 'google_sheets',
  '{"provider":"google_sheets","spreadsheetId":"tier2-alpha-second","spreadsheetUrl":"https://docs.google.com/spreadsheets/d/tier2-alpha-second/edit","spreadsheetTitle":"Alpha","sheetId":43,"sheetTitle":"Second engagement feed","rangeMode":"full_tab"}'::jsonb,
  'tier2-test-admin', 'tier2-test-admin'
);

select lives_ok(
  $$
    insert into private.tier2_partner_profiles (
      profile_key, partner_key, display_name, api_connection_id,
      spreadsheet_id, sheet_id, sheet_title, stable_row_key_column,
      tracking_id_column, tracking_id_source, contract_version,
      contract_checksum, created_by_owner_id, updated_by_owner_id
    ) values (
      'partner-alpha-second-feed', 'alpha', 'Partner Alpha second feed',
      '81000000-0000-4000-8000-000000000002', 'tier2-alpha-second', 43,
      'Second engagement feed', 'Partner Row ID', 'PeopleID3', 'peopleid3',
      'v1', repeat('a', 64), 'tier2-test-admin', 'tier2-test-admin'
    )
  $$,
  'multiple exact feed profiles can share one partner owner key'
);

create temporary table tier2_profile_display_metadata_before as
select updated_at
from private.tier2_partner_profiles
where id = '82000000-0000-4000-8000-000000000001';

update private.tier2_partner_profiles
set sheet_title = 'Renamed engagement tab'
where id = '82000000-0000-4000-8000-000000000001';

select is(
  (
    select updated_at
    from private.tier2_partner_profiles
    where id = '82000000-0000-4000-8000-000000000001'
  ),
  (select updated_at from tier2_profile_display_metadata_before),
  'refreshing only the Sheet display title does not stale an exact launched profile'
);

select throws_ok(
  $$
    insert into private.tier2_partner_profiles (
      profile_key, partner_key, display_name, api_connection_id,
      spreadsheet_id, sheet_id, sheet_title, stable_row_key_column,
      tracking_id_column, tracking_id_source, contract_version,
      contract_checksum, created_by_owner_id, updated_by_owner_id
    ) values (
      'wrong-sheet', 'wrong-sheet', 'Wrong Sheet',
      '81000000-0000-4000-8000-000000000001', 'tier2-alpha', 7,
      'Wrong', 'Row ID', 'PeopleID3', 'peopleid3', 'v1', repeat('a', 64),
      'tier2-test-admin', 'tier2-test-admin'
    )
  $$,
  'Tier 2 partner profile Sheet identity must match its connection.',
  'a profile cannot silently change the configured tab identity'
);

select throws_ok(
  $$
    insert into private.tier2_partner_profiles (
      profile_key, partner_key, display_name, api_connection_id,
      spreadsheet_id, sheet_id, sheet_title, stable_row_key_column,
      tracking_id_column, tracking_id_source, contract_version,
      contract_checksum, created_by_owner_id, updated_by_owner_id
    ) values (
      'partner-alpha-copy', 'alpha', 'Duplicate Partner',
      '81000000-0000-4000-8000-000000000001', 'tier2-alpha', 42,
      'Engagement', 'Row ID', 'PeopleID3', 'peopleid3', 'v1', repeat('a', 64),
      'tier2-test-admin', 'tier2-test-admin'
    )
  $$,
  '23505',
  null,
  'duplicate Sheet bindings are rejected even when an owner can have multiple feeds'
);

update private.tier2_partner_profiles
set active = false
where profile_key = 'partner-alpha-second-feed';

insert into private.tier2_contract_resource_versions (
  id, resource_id, version_number, lifecycle_state, schema_version,
  content_checksum, normalized_resource, validation_summary, entry_count,
  source_retrieved_at, created_by_owner_id, finalized_at
) values
(
  '83000000-0000-4000-8000-000000000001',
  (select id from private.tier2_contract_resources where resource_key = 'jp-peopleid3'),
  1, 'invalid', 1, repeat('b', 64), '{}'::jsonb,
  '{"errorCount":1}'::jsonb, 0, now(), 'tier2-test-admin', now()
),
(
  '83000000-0000-4000-8000-000000000002',
  (select id from private.tier2_contract_resources where resource_key = 'jp-peopleid3'),
  2, 'valid', 1, repeat('c', 64), '{"entries":[]}'::jsonb,
  '{"errorCount":0}'::jsonb, 0, now(), 'tier2-test-admin', now()
);

select throws_ok(
  $$
    select private.activate_tier2_contract_resource_version(
      '83000000-0000-4000-8000-000000000001', 'tier2-test-admin',
      'admin@example.test', 'attempt invalid activation', 'activate'
    )
  $$,
  'Only a valid error-free Tier 2 resource version can activate.',
  'invalid contract resources cannot activate'
);

select lives_ok(
  $$
    select private.activate_tier2_contract_resource_version(
      '83000000-0000-4000-8000-000000000002', 'tier2-test-admin',
      'admin@example.test', 'validated fixture', 'activate'
    )
  $$,
  'a valid error-free contract resource can activate'
);

select is(
  (
    select active_version_id
    from private.tier2_contract_resources
    where resource_key = 'jp-peopleid3'
  ),
  '83000000-0000-4000-8000-000000000002'::uuid,
  'the active resource pointer records the exact version'
);

select throws_ok(
  $$
    update private.tier2_contract_resource_versions
    set normalized_resource = '{"entries":[{"changed":true}]}'::jsonb
    where id = '83000000-0000-4000-8000-000000000002'
  $$,
  'Finalized Tier 2 contract resource versions are immutable.',
  'an active finalized contract resource version cannot be rewritten'
);

select throws_ok(
  $$ update private.tier2_contract_resource_activations set reason = 'rewrite' $$,
  'Tier 2 evidence is append-only.',
  'resource activation evidence is immutable'
);

insert into private.reference_resource_versions (
  id, resource_id, version_number, lifecycle_state, schema_version,
  content_checksum, source_retrieved_at, source_metadata, normalized_resource,
  artifact_manifest, validation_summary, diff_summary, entry_count,
  created_by_owner_id, finalized_at
) values
(
  '83500000-0000-4000-8000-000000000001',
  (select id from private.reference_resources
   where resource_key = 'country-territory-codes'),
  1, 'valid', 1, repeat('a', 64), now(), '{}'::jsonb, '{}'::jsonb,
  '{}'::jsonb, '{"errorCount":0}'::jsonb, '{}'::jsonb, 0,
  'tier2-test-admin', now()
),
(
  '83500000-0000-4000-8000-000000000002',
  (select id from private.reference_resources where resource_key = 'rop-codes'),
  1, 'valid', 1, repeat('b', 64), now(), '{}'::jsonb, '{}'::jsonb,
  '{}'::jsonb, '{"errorCount":0}'::jsonb, '{}'::jsonb, 0,
  'tier2-test-admin', now()
),
(
  '83500000-0000-4000-8000-000000000003',
  (select id from private.reference_resources
   where resource_key = 'source-aliases'),
  1, 'valid', 1, repeat('c', 64), now(), '{}'::jsonb,
  '{"schemaVersion":1,"resourceKey":"source-aliases","sourceName":"fixture","sourceRetrievedAt":"2026-07-22T00:00:00.000Z","entries":[{"fieldId":"F_1","canonicalSourceKey":"alpha","displayName":"Partner Alpha","initials":"pa","aliases":["alpha"],"active":true}]}'::jsonb,
  '{}'::jsonb, '{"errorCount":0}'::jsonb, '{}'::jsonb, 1,
  'tier2-test-admin', now()
);

insert into private.reference_resource_sets (
  id, content_checksum, created_by_owner_id, reason
) values (
  '83500000-0000-4000-8000-000000000010', repeat('d', 64),
  'tier2-test-admin', 'Tier 2 pinned reference fixture'
);

insert into private.reference_resource_set_members (
  set_id, resource_id, version_id
)
select '83500000-0000-4000-8000-000000000010'::uuid,
  version.resource_id, version.id
from private.reference_resource_versions as version
where version.id in (
  '83500000-0000-4000-8000-000000000001',
  '83500000-0000-4000-8000-000000000002',
  '83500000-0000-4000-8000-000000000003'
);

insert into private.ax_registry_revisions (
  id, content_checksum, binding_count, actor_owner_id, actor_email, reason
) values (
  '84000000-0000-4000-8000-000000000001', repeat('d', 64), 0,
  'tier2-test-admin', 'admin@example.test', 'Tier 2 pgTAP revision'
);

insert into private.ax_registry_revisions (
  id, previous_revision_id, content_checksum, binding_count,
  actor_owner_id, actor_email, reason
) values
(
  '84000000-0000-4000-8000-000000000002',
  '84000000-0000-4000-8000-000000000001', repeat('1', 64), 1,
  'tier2-test-admin', 'admin@example.test', 'Later compatible Tier 2 revision'
),
(
  '84000000-0000-4000-8000-000000000003',
  '84000000-0000-4000-8000-000000000002', repeat('2', 64), 0,
  'tier2-test-admin', 'admin@example.test', 'Later incompatible Tier 2 revision'
);

insert into private.ax_identity_legacy_imports (
  id, input_fingerprint, snapshot_manifest, status, finding_count,
  registry_revision_id, actor_owner_id, actor_email, reason, committed_at,
  import_kind, state_fingerprint, graph_checksum, report_checksum,
  manifest_checksum, dry_run_token_hash, report, dry_run_completed_at
) values (
  '84500000-0000-4000-8000-000000000001', repeat('3', 64), '{}'::jsonb,
  'dry-run', 0, null,
  'tier2-test-admin', 'admin@example.test', 'Tier 2 pgTAP cutover fixture', null,
  'verified-identity-graph', repeat('4', 64), repeat('5', 64),
  repeat('6', 64), repeat('7', 64), repeat('8', 64),
  '{"blocking":false}'::jsonb, now()
);

insert into private.ax_identity_graph_commit_sessions (
  backend_pid, transaction_id, legacy_import_id, input_fingerprint,
  token_hash, state_fingerprint
) values (
  pg_backend_pid(), txid_current(),
  '84500000-0000-4000-8000-000000000001', repeat('3', 64),
  repeat('8', 64), repeat('4', 64)
);

update private.ax_identity_legacy_imports
set status = 'committed',
  registry_revision_id = '84000000-0000-4000-8000-000000000001',
  committed_at = now()
where id = '84500000-0000-4000-8000-000000000001';

insert into private.ax_identity_registry_cutovers (
  namespace, legacy_import_id, registry_revision_id, input_fingerprint,
  graph_checksum, report_checksum, actor_owner_id, actor_email, reason
) values (
  'people-groups', '84500000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001', repeat('3', 64),
  repeat('5', 64), repeat('6', 64), 'tier2-test-admin',
  'admin@example.test', 'Tier 2 pgTAP cutover fixture'
);

delete from private.ax_identity_graph_commit_sessions
where backend_pid = pg_backend_pid() and transaction_id = txid_current();

insert into public.datasets (
  id, owner_id, file_name, blob_url, blob_path, current_version_action,
  current_version_actor_owner_id, current_version_actor_email,
  current_version_created_at, size_bytes, columns
) values
(
  '85000000-0000-4000-8000-000000000001', 'tier2-test-admin',
  'partner-alpha-identity.csv', 'https://example.test/partner-alpha.csv',
  'datasets/partner-alpha.csv', 'api_import', 'tier2-test-admin',
  'admin@example.test', now(), 1, '[{"key":"AX_PGIC","label":"AX_PGIC","sourceIndex":0}]'::jsonb
),
(
  '85000000-0000-4000-8000-000000000002', 'tier2-test-admin',
  'tier2-output.csv', 'https://example.test/tier2-output.csv',
  'datasets/tier2-output.csv', 'api_import', 'tier2-test-admin',
  'admin@example.test', now(), 1, '[{"key":"AX_PGIC","label":"AX_PGIC","sourceIndex":0}]'::jsonb
);

insert into private.pipeline_publications (
  id, producer_kind, producer_run_id, dataset_id, source_profile_key,
  registry_revision_id, output_checksum, row_count, artifact_manifest,
  actor_owner_id, actor_email, reason, publication_target_key
) values
(
  '86000000-0000-4000-8000-000000000010', 'tier2-forming',
  '87000000-0000-4000-8000-000000000010',
  '85000000-0000-4000-8000-000000000001', 'partner-alpha',
  null, repeat('f', 64), 1, '{}'::jsonb,
  'tier2-test-admin', 'admin@example.test', 'forming fixture',
  'tier2-partner-partner-alpha'
),
(
  '86000000-0000-4000-8000-000000000001', 'identity',
  '87000000-0000-4000-8000-000000000001',
  '85000000-0000-4000-8000-000000000001', 'partner-alpha',
  '84000000-0000-4000-8000-000000000001', repeat('e', 64), 1,
  '{}'::jsonb, 'tier2-test-admin', 'admin@example.test', 'identity fixture', null
);

insert into private.api_connection_runs (
  id, connection_id, actor_owner_id, actor_email, mode, status,
  duration_ms, response_preview
) values
(
  '81500000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001', 'tier2-test-admin',
  'admin@example.test', 'import', 'success', 1, ''
),
(
  '81500000-0000-4000-8000-000000000002',
  '81000000-0000-4000-8000-000000000001', 'tier2-test-admin',
  'admin@example.test', 'import', 'success', 1, ''
);

insert into private.dataset_forming_runs (
  id, connection_id, source_run_id, resource_set_id, source_profile_key,
  engine_key, artifact_schema_version, input_fingerprint,
  publication_target_key, expected_current_publication_id,
  actor_owner_id, actor_email, status, source_rows_checksum,
  source_raw_checksum, field_contract_version, field_contract_checksum,
  transformation_version, transformation_checksum, input_row_count,
  output_row_count, warning_count, error_count, validation_summary,
  artifact_manifest, output_checksum, output_size_bytes, started_at,
  completed_at
) values
(
  '82500000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  '81500000-0000-4000-8000-000000000001',
  (select id from private.reference_resource_sets
   order by sequence_number desc limit 1),
  'partner-alpha', 'tier2-partner-forming', 1, repeat('5', 64),
  'tier2-partner-partner-alpha',
  '86000000-0000-4000-8000-000000000010',
  'tier2-test-admin', 'admin@example.test', 'valid', repeat('6', 64),
  repeat('7', 64), 1, repeat('a', 64), 'tier2-partner-forming-v1',
  repeat('8', 64), 1, 1, 0, 0, '{}'::jsonb, '{}'::jsonb,
  repeat('9', 64), 1, now(), now()
),
(
  '82500000-0000-4000-8000-000000000002',
  '81000000-0000-4000-8000-000000000001',
  '81500000-0000-4000-8000-000000000002',
  (select id from private.reference_resource_sets
   order by sequence_number desc limit 1),
  'partner-alpha', 'tier2-partner-forming', 1, repeat('a', 64),
  'tier2-partner-partner-alpha',
  '86000000-0000-4000-8000-000000000010',
  'tier2-test-admin', 'admin@example.test', 'valid', repeat('b', 64),
  repeat('c', 64), 1, repeat('d', 64), 'tier2-partner-forming-v1',
  repeat('e', 64), 1, 1, 0, 0, '{}'::jsonb, '{}'::jsonb,
  repeat('f', 64), 1, now(), now()
);

select lives_ok(
  $$
    insert into private.tier2_forming_runs (
      forming_run_id, profile_id, profile_snapshot, profile_checksum
    )
    select candidate.forming_run_id,
      '82000000-0000-4000-8000-000000000001'::uuid,
      jsonb_build_object(
        'profile', '{}'::jsonb,
        'resourceLineage', '{}'::jsonb,
        'identityInputs', jsonb_build_object(
          'countryVersionId', country.version_id::text,
          'countryChecksum', country.content_checksum,
          'ropVersionId', rop.version_id::text,
          'ropChecksum', rop.content_checksum,
          'sourceAliasesVersionId', source_alias.version_id::text,
          'sourceAliasesChecksum', source_alias.content_checksum,
          'sourceAliasKey', 'alpha',
          'sourceInitials', 'pa',
          'baseRegistryRevisionId',
            '84000000-0000-4000-8000-000000000001',
          'baseRegistryRevisionChecksum', repeat('d', 64)
        )
      ),
      repeat('a', 64)
    from (
      values
        ('82500000-0000-4000-8000-000000000001'::uuid),
        ('82500000-0000-4000-8000-000000000002'::uuid)
    ) as candidate(forming_run_id)
    cross join lateral (
      select version.id as version_id, version.content_checksum
      from private.reference_resource_sets as resource_set
      join private.reference_resource_set_members as member
        on member.set_id = resource_set.id
      join private.reference_resources as resource
        on resource.id = member.resource_id
      join private.reference_resource_versions as version
        on version.id = member.version_id
      where resource.resource_key = 'country-territory-codes'
      order by resource_set.sequence_number desc
      limit 1
    ) as country
    cross join lateral (
      select version.id as version_id, version.content_checksum
      from private.reference_resource_sets as resource_set
      join private.reference_resource_set_members as member
        on member.set_id = resource_set.id
      join private.reference_resources as resource
        on resource.id = member.resource_id
      join private.reference_resource_versions as version
        on version.id = member.version_id
      where resource.resource_key = 'rop-codes'
      order by resource_set.sequence_number desc
      limit 1
    ) as rop
    cross join lateral (
      select version.id as version_id, version.content_checksum
      from private.reference_resource_sets as resource_set
      join private.reference_resource_set_members as member
        on member.set_id = resource_set.id
      join private.reference_resources as resource
        on resource.id = member.resource_id
      join private.reference_resource_versions as version
        on version.id = member.version_id
      where resource.resource_key = 'source-aliases'
      order by resource_set.sequence_number desc
      limit 1
    ) as source_alias
  $$,
  'Tier 2 forming candidates persist exact Country, ROP, source-alias, and registry pins'
);

select throws_ok(
  $$
    update private.tier2_forming_runs
    set profile_snapshot = jsonb_set(
      profile_snapshot,
      '{identityInputs,baseRegistryRevisionId}',
      '"84000000-0000-4000-8000-000000000002"'::jsonb
    )
    where forming_run_id = '82500000-0000-4000-8000-000000000001'
  $$,
  'Tier 2 forming lineage is immutable after binding.',
  'captured Tier 2 identity inputs cannot be rewritten'
);

select throws_ok(
  $$
    update private.dataset_forming_runs
    set expected_current_publication_id = null
    where id = '82500000-0000-4000-8000-000000000001'
  $$,
  'Finalized dataset forming bindings and payload metadata are immutable.',
  'the formed-source expected-current pin is immutable after build'
);

update private.dataset_forming_runs
set status = 'publishing', publishing_started_at = now(),
  publication_attempt_id = '82600000-0000-4000-8000-000000000001',
  publication_blob_path = 'datasets/csv/tier2-attempt-1.csv'
where id = '82500000-0000-4000-8000-000000000001';

select throws_ok(
  $$
    select private.lock_tier2_forming_publication_target(
      '82500000-0000-4000-8000-000000000001',
      '82600000-0000-4000-8000-000000000099'
    )
  $$,
  'This Tier 2 formed-source publication attempt no longer owns the candidate lease.',
  'commit-time CAS rejects a stale publication attempt token'
);

select lives_ok(
  $$
    select private.lock_tier2_forming_publication_target(
      '82500000-0000-4000-8000-000000000001',
      '82600000-0000-4000-8000-000000000001'
    )
  $$,
  'commit-time CAS accepts the exact publication captured at candidate build'
);

update private.dataset_forming_runs
set status = 'valid', publishing_started_at = null,
  publication_attempt_id = null, publication_blob_path = null
where id = '82500000-0000-4000-8000-000000000001';

insert into private.pipeline_publications (
  id, producer_kind, producer_run_id, dataset_id, source_profile_key,
  registry_revision_id, output_checksum, row_count, artifact_manifest,
  actor_owner_id, actor_email, reason, publication_target_key,
  producer_definition_key
) values (
  '86000000-0000-4000-8000-000000000011', 'tier2-forming',
  '87000000-0000-4000-8000-000000000011',
  '85000000-0000-4000-8000-000000000001', 'partner-alpha', null,
  repeat('0', 64), 1, '{}'::jsonb, 'tier2-test-admin',
  'admin@example.test', 'competing formed-source publication',
  'tier2-partner-partner-alpha', 'tier2-partner-forming'
);

update private.dataset_forming_runs
set status = 'publishing', publishing_started_at = now(),
  publication_attempt_id = '82600000-0000-4000-8000-000000000002',
  publication_blob_path = 'datasets/csv/tier2-attempt-2.csv'
where id = '82500000-0000-4000-8000-000000000002';

select throws_ok(
  $$
    select private.lock_tier2_forming_publication_target(
      '82500000-0000-4000-8000-000000000002',
      '82600000-0000-4000-8000-000000000002'
    )
  $$,
  'The Tier 2 formed-source publication target changed after this candidate was built.',
  'a competing candidate cannot overwrite a formed-source publication that won first'
);

insert into private.ax_identity_runs (
  id, source_publication_id, base_revision_id, source_profile_key,
  rules_version, rules_checksum, resource_bindings, input_fingerprint,
  publication_target_key,
  actor_owner_id, actor_email, status, input_row_count, output_row_count,
  retained_count, output_checksum, artifact_manifest, started_at, completed_at
) values (
  '87000000-0000-4000-8000-000000000001',
  '86000000-0000-4000-8000-000000000010', null, 'partner-alpha',
  'v1', repeat('3', 64), '{}'::jsonb, repeat('4', 64),
  'identity-partner-alpha',
  'tier2-test-admin', 'admin@example.test', 'valid', 1, 1, 1,
  repeat('e', 64), '{}'::jsonb, now(), now()
);

insert into private.ax_identities (
  id, namespace, identity_kind, normalized_iso3, rop3_component,
  lifecycle_state, created_by_run_id, activated_revision_id, activated_at
) values (
  '8a000000-0000-4000-8000-000000000001', 'people-groups', 'pgac',
  null, '100001', 'active', '87000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001', now()
);

insert into private.ax_identities (
  id, namespace, identity_kind, parent_identity_id, normalized_iso3,
  rop3_component, lifecycle_state, created_by_run_id,
  activated_revision_id, activated_at
) values (
  '8a000000-0000-4000-8000-000000000002', 'people-groups', 'pgic',
  '8a000000-0000-4000-8000-000000000001', 'LAO', '100001', 'active',
  '87000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001', now()
);

insert into private.ax_identity_source_bindings (
  id, source_profile_key, stable_row_key, identity_id, identity_run_id,
  binding_state, source_pgac_code, source_pgic_code,
  activated_revision_id, activated_at
) values (
  '8b000000-0000-4000-8000-000000000001', 'partner-alpha', 'alpha:1',
  '8a000000-0000-4000-8000-000000000002',
  '87000000-0000-4000-8000-000000000001', 'active',
  '10-jp-100001', '10-jp-100001-LAO',
  '84000000-0000-4000-8000-000000000001', now()
);

insert into private.ax_identity_run_rows (
  identity_run_id, source_row_index, stable_row_key, assignment_status,
  binding_id, pgac_code, pgic_code, enriched_row
) values (
  '87000000-0000-4000-8000-000000000001', 0, 'alpha:1', 'retained',
  '8b000000-0000-4000-8000-000000000001',
  '10-jp-100001', '10-jp-100001-LAO',
  '{"AX_PGIC":"10-jp-100001-LAO","PG_Name_Main":"Alpha"}'::jsonb
);

insert into private.ax_registry_revision_bindings (revision_id, binding_id)
values
  ('84000000-0000-4000-8000-000000000001', '8b000000-0000-4000-8000-000000000001'),
  ('84000000-0000-4000-8000-000000000002', '8b000000-0000-4000-8000-000000000001');

insert into private.pipeline_publication_rows (publication_id, row_index, data)
values (
  '86000000-0000-4000-8000-000000000001', 0,
  '{"AX_PGIC":"10-jp-100001-LAO","PG_Name_Main":"Alpha"}'::jsonb
);

insert into private.pipeline_release_sets (
  id, release_key, resource_set_id, registry_revision_id, rule_version,
  rule_checksum, rule_payload, created_by_owner_id, created_by_email
) values
(
  '88000000-0000-4000-8000-000000000001', 'tier2-complete-partners',
  (select id from private.reference_resource_sets order by created_at desc limit 1),
  '84000000-0000-4000-8000-000000000001', 'v1', repeat('9', 64),
  '[]'::jsonb, 'tier2-test-admin', 'admin@example.test'
),
(
  '88000000-0000-4000-8000-000000000002', 'tier2-complete-partners',
  (select id from private.reference_resource_sets order by created_at desc limit 1),
  '84000000-0000-4000-8000-000000000002', 'v1',
  '1641ad4635a3a7dc4b18102538bef5f046caecd51348fa9a1145f0324a3fd315',
  '[]'::jsonb, 'tier2-test-admin', 'admin@example.test'
),
(
  '88000000-0000-4000-8000-000000000003', 'tier2-complete-partners',
  (select id from private.reference_resource_sets order by created_at desc limit 1),
  '84000000-0000-4000-8000-000000000003', 'v1',
  '1641ad4635a3a7dc4b18102538bef5f046caecd51348fa9a1145f0324a3fd315',
  '[]'::jsonb, 'tier2-test-admin', 'admin@example.test'
);

select throws_ok(
  $$
    select private.finalize_tier2_release_set(
      '88000000-0000-4000-8000-000000000001', 'tier2-test-admin',
      'admin@example.test', 'missing member must fail'
    )
  $$,
  'P0001',
  null,
  'a release cannot finalize with a missing required partner'
);

insert into private.pipeline_release_members (
  release_set_id, position, input_key, publication_id, publication_checksum,
  publication_row_count, registry_revision_id
) values (
  '88000000-0000-4000-8000-000000000002', 0, 'partner-alpha',
  '86000000-0000-4000-8000-000000000001', repeat('e', 64), 1,
  '84000000-0000-4000-8000-000000000002'
),
(
  '88000000-0000-4000-8000-000000000003', 0, 'partner-alpha',
  '86000000-0000-4000-8000-000000000001', repeat('e', 64), 1,
  '84000000-0000-4000-8000-000000000003'
);

select lives_ok(
  $$
    select private.finalize_tier2_release_set(
      '88000000-0000-4000-8000-000000000002', 'tier2-test-admin',
      'admin@example.test', 'exact partner release'
    )
  $$,
  'a later registry revision can finalize an earlier partner publication when it retains every exact binding'
);

select throws_ok(
  $$
    select private.finalize_tier2_release_set(
      '88000000-0000-4000-8000-000000000003', 'tier2-test-admin',
      'admin@example.test', 'missing exact identity binding must fail'
    )
  $$,
  'The selected AX registry revision no longer contains every exact identity binding.',
  'a later revision that omits an exact identity binding cannot finalize the release'
);

select is(
  (select status from private.pipeline_release_sets where id = '88000000-0000-4000-8000-000000000002'),
  'finalized',
  'the exact release is durably finalized'
);

insert into private.pipeline_runs (
  id, definition_key, definition_version, definition_checksum, release_set_id,
  resource_set_id, registry_revision_id, actor_owner_id, actor_email, status,
  input_fingerprint, expected_current_publication_id,
  input_row_count, output_row_count, warning_count,
  error_count, validation_summary, artifact_manifest, output_checksum,
  started_at, completed_at
) values (
  '89000000-0000-4000-8000-000000000001', 'tier2-complete-partners', 'v1',
  '1641ad4635a3a7dc4b18102538bef5f046caecd51348fa9a1145f0324a3fd315',
  '88000000-0000-4000-8000-000000000002',
  (select id from private.reference_resource_sets order by created_at desc limit 1),
  '84000000-0000-4000-8000-000000000002', 'tier2-test-admin',
  'admin@example.test', 'valid', repeat('7', 64), null, 1, 1, 0, 0,
  '{"valid":true}'::jsonb, '{}'::jsonb, repeat('8', 64), now(), now()
),
(
  '89000000-0000-4000-8000-000000000002', 'tier2-complete-partners', 'v1',
  '1641ad4635a3a7dc4b18102538bef5f046caecd51348fa9a1145f0324a3fd315',
  '88000000-0000-4000-8000-000000000002',
  (select id from private.reference_resource_sets order by created_at desc limit 1),
  '84000000-0000-4000-8000-000000000002', 'tier2-test-admin',
  'admin@example.test', 'valid', repeat('9', 64), null, 1, 1, 0, 0,
  '{"valid":true}'::jsonb, '{}'::jsonb, repeat('8', 64), now(), now()
);

insert into private.pipeline_run_inputs (
  run_id, position, input_key, publication_id, publication_checksum,
  publication_row_count
) values (
  '89000000-0000-4000-8000-000000000001', 0, 'partner-alpha',
  '86000000-0000-4000-8000-000000000001', repeat('e', 64), 1
),
(
  '89000000-0000-4000-8000-000000000002', 0, 'partner-alpha',
  '86000000-0000-4000-8000-000000000001', repeat('e', 64), 1
);

insert into private.tier2_pipeline_run_rows (run_id, row_index, data)
values (
  '89000000-0000-4000-8000-000000000001', 0,
  '{"AX_PGIC":"10-jp-100001-LAO","Tier2_Profile_Key":"partner-alpha"}'::jsonb
),
(
  '89000000-0000-4000-8000-000000000002', 0,
  '{"AX_PGIC":"10-jp-100001-LAO","Tier2_Profile_Key":"partner-alpha"}'::jsonb
);

create temporary table tier2_published_result (
  publication_id uuid,
  version_number integer
) on commit drop;

update private.pipeline_definitions
set checksum = repeat('5', 64)
where definition_key = 'tier2-complete-partners';

select throws_ok(
  $$
    select * from private.publish_tier2_pipeline_run(
      '89000000-0000-4000-8000-000000000001',
      '85000000-0000-4000-8000-000000000002', 'tier2-test-admin',
      'admin@example.test', 'stale definition must fail'
    )
  $$,
  'The Tier 2 product definition changed after candidate review.',
  'publication blocks when the reviewed product definition is stale'
);

update private.pipeline_definitions
set checksum = '1641ad4635a3a7dc4b18102538bef5f046caecd51348fa9a1145f0324a3fd315'
where definition_key = 'tier2-complete-partners';

select lives_ok(
  $$
    insert into tier2_published_result
    select * from private.publish_tier2_pipeline_run(
      '89000000-0000-4000-8000-000000000001',
      '85000000-0000-4000-8000-000000000002', 'tier2-test-admin',
      'admin@example.test', 'publish exact Tier 2 release'
    )
  $$,
  'a valid exact release publishes atomically'
);

select is(
  (select current_publication_id from private.tier2_publication_targets where product_kind = 'tier2'),
  (select publication_id from tier2_published_result),
  'the stable Tier 2 target advances to the new publication'
);

select is(
  (
    select count(*)::bigint
    from private.pipeline_publication_rows
    where publication_id = (select publication_id from tier2_published_result)
  ),
  1::bigint,
  'the publication contains the exact archived candidate rows'
);

select is(
  (select publication_id from private.pipeline_runs where id = '89000000-0000-4000-8000-000000000001'),
  (select publication_id from tier2_published_result),
  'the published run is linked to its immutable publication'
);

select is(
  (select status from private.pipeline_runs where id = '89000000-0000-4000-8000-000000000001'),
  'published',
  'the candidate transitions to published only after the atomic copy'
);

select throws_ok(
  $$
    select private.publish_tier2_pipeline_run(
      '89000000-0000-4000-8000-000000000002',
      '85000000-0000-4000-8000-000000000002', 'tier2-test-admin',
      'admin@example.test', 'stale second Tier 2 candidate'
    )
  $$,
  'Stable target changed since the candidate was built.',
  'the second Tier 2 candidate cannot publish over the first candidate that won'
);

select throws_ok(
  $$
    select private.publish_tier2_pipeline_run(
      '89000000-0000-4000-8000-000000000001',
      '85000000-0000-4000-8000-000000000002', 'tier2-test-admin',
      'admin@example.test', 'duplicate publish'
    )
  $$,
  'Only a valid, error-free Tier 2 product candidate can publish.',
  'a published candidate cannot publish a second time'
);

insert into public.datasets (
  id, owner_id, file_name, blob_url, blob_path, current_version_action,
  current_version_actor_owner_id, current_version_actor_email,
  current_version_created_at, size_bytes, columns
) values (
  '85000000-0000-4000-8000-000000000003', 'tier2-test-admin',
  'aggregate2-output.csv', 'https://example.test/aggregate2-output.csv',
  'datasets/aggregate2-output.csv', 'api_import', 'tier2-test-admin',
  'admin@example.test', now(), 1,
  '[{"key":"AX_PGIC","label":"AX_PGIC","sourceIndex":0}]'::jsonb
);

insert into private.pipeline_release_sets (
  id, release_key, resource_set_id, registry_revision_id, rule_version,
  rule_checksum, rule_payload, status, canonical_checksum,
  created_by_owner_id, created_by_email, finalized_by_owner_id,
  finalized_by_email, finalization_reason, finalized_at
) values (
  '88000000-0000-4000-8000-000000000004', 'aggregate2-exact-union',
  (select id from private.reference_resource_sets order by created_at desc limit 1),
  '84000000-0000-4000-8000-000000000002', 'v1',
  '278dee49fd8a6a4b678b24bbb5c97350a479a05d042d8c175d4870d00f9a0be9',
  '[]'::jsonb, 'finalized', repeat('4', 64), 'tier2-test-admin',
  'admin@example.test', 'tier2-test-admin', 'admin@example.test',
  'Aggregate 2 CAS fixture', now()
);

insert into private.pipeline_runs (
  id, definition_key, definition_version, definition_checksum, release_set_id,
  resource_set_id, registry_revision_id, actor_owner_id, actor_email, status,
  input_fingerprint, expected_current_publication_id, input_row_count,
  output_row_count, warning_count, error_count, validation_summary,
  artifact_manifest, output_checksum, started_at, completed_at
) values
(
  '89000000-0000-4000-8000-000000000003', 'aggregate2-exact-union', 'v1',
  '278dee49fd8a6a4b678b24bbb5c97350a479a05d042d8c175d4870d00f9a0be9',
  '88000000-0000-4000-8000-000000000004',
  (select id from private.reference_resource_sets order by created_at desc limit 1),
  '84000000-0000-4000-8000-000000000002', 'tier2-test-admin',
  'admin@example.test', 'valid', repeat('1', 64), null, 1, 1, 0, 0,
  '{"valid":true}'::jsonb, '{}'::jsonb, repeat('2', 64), now(), now()
),
(
  '89000000-0000-4000-8000-000000000004', 'aggregate2-exact-union', 'v1',
  '278dee49fd8a6a4b678b24bbb5c97350a479a05d042d8c175d4870d00f9a0be9',
  '88000000-0000-4000-8000-000000000004',
  (select id from private.reference_resource_sets order by created_at desc limit 1),
  '84000000-0000-4000-8000-000000000002', 'tier2-test-admin',
  'admin@example.test', 'valid', repeat('3', 64), null, 1, 1, 0, 0,
  '{"valid":true}'::jsonb, '{}'::jsonb, repeat('2', 64), now(), now()
);

insert into private.tier2_pipeline_run_rows (run_id, row_index, data)
values
(
  '89000000-0000-4000-8000-000000000003', 0,
  '{"AX_PGIC":"10-jp-100001-LAO","Aggregate2_Input_Key":"tier2"}'::jsonb
),
(
  '89000000-0000-4000-8000-000000000004', 0,
  '{"AX_PGIC":"10-jp-100001-LAO","Aggregate2_Input_Key":"tier2"}'::jsonb
);

create temporary table aggregate2_published_result (
  publication_id uuid,
  version_number integer
) on commit drop;

select lives_ok(
  $$
    insert into aggregate2_published_result
    select * from private.publish_tier2_pipeline_run(
      '89000000-0000-4000-8000-000000000003',
      '85000000-0000-4000-8000-000000000003', 'tier2-test-admin',
      'admin@example.test', 'publish first Aggregate 2 candidate'
    )
  $$,
  'the first Aggregate 2 candidate publishes with its empty-target pin'
);

select throws_ok(
  $$
    select private.publish_tier2_pipeline_run(
      '89000000-0000-4000-8000-000000000004',
      '85000000-0000-4000-8000-000000000003', 'tier2-test-admin',
      'admin@example.test', 'stale second Aggregate 2 candidate'
    )
  $$,
  'Stable target changed since the candidate was built.',
  'the second Aggregate 2 candidate cannot overwrite the first candidate that won'
);

insert into private.pipeline_publications (
  id, producer_kind, producer_run_id, dataset_id, registry_revision_id,
  output_checksum, row_count, artifact_manifest, actor_owner_id, actor_email,
  reason, publication_target_key, producer_definition_key
) values (
  '86000000-0000-4000-8000-000000000002', 'tier2-merge',
  '87000000-0000-4000-8000-000000000002',
  '85000000-0000-4000-8000-000000000002',
  '84000000-0000-4000-8000-000000000001', repeat('6', 64), 1,
  '{}'::jsonb, 'tier2-test-admin', 'admin@example.test', 'prior release fixture',
  'tier2-pgic', 'tier2-complete-partners'
);

insert into private.pipeline_publication_rows (publication_id, row_index, data)
values (
  '86000000-0000-4000-8000-000000000002', 0,
  '{"AX_PGIC":"10-jp-000999-LAO","Tier2_Profile_Key":"partner-alpha"}'::jsonb
);

select private.authorize_pipeline_dataset_mutation();

update public.datasets
set blob_url = 'https://example.test/tier2-incident.csv',
  blob_path = 'datasets/tier2-incident.csv', row_count = 1,
  size_bytes = 1, status = 'ready',
  columns = '[{"key":"AX_PGIC","label":"AX_PGIC","sourceIndex":0},{"key":"Tier2_Profile_Key","label":"Tier2_Profile_Key","sourceIndex":1}]'::jsonb
where id = '85000000-0000-4000-8000-000000000002';

insert into public.dataset_rows (dataset_id, row_index, data)
values (
  '85000000-0000-4000-8000-000000000002', 0,
  '{"AX_PGIC":"10-jp-100001-LAO","Tier2_Profile_Key":"partner-alpha"}'::jsonb
);

insert into public.dataset_versions (
  id, dataset_id, file_name, blob_url, blob_path, action, actor_owner_id,
  actor_email, status, row_count, size_bytes, columns, version_created_at
) select
  '85500000-0000-4000-8000-000000000001', id, file_name, blob_url,
  blob_path, current_version_action, current_version_actor_owner_id,
  current_version_actor_email, status, row_count, size_bytes, columns,
  current_version_created_at
from public.datasets
where id = '85000000-0000-4000-8000-000000000002';

insert into public.dataset_version_rows (version_id, row_index, data)
select '85500000-0000-4000-8000-000000000001', row_index, data
from public.dataset_rows
where dataset_id = '85000000-0000-4000-8000-000000000002';

delete from public.dataset_rows
where dataset_id = '85000000-0000-4000-8000-000000000002';
insert into public.dataset_rows (dataset_id, row_index, data)
select '85000000-0000-4000-8000-000000000002', row_index, data
from private.pipeline_publication_rows
where publication_id = '86000000-0000-4000-8000-000000000002';
update public.datasets
set blob_url = 'https://example.test/tier2-restored.csv',
  blob_path = 'datasets/tier2-restored.csv', current_version_action = 'replace',
  current_version_actor_owner_id = 'tier2-test-admin',
  current_version_actor_email = 'admin@example.test',
  current_version_created_at = now(), row_count = 1, size_bytes = 1,
  updated_at = now()
where id = '85000000-0000-4000-8000-000000000002';

select lives_ok(
  $$
    select private.rollback_tier2_publication_target(
      'tier2', '86000000-0000-4000-8000-000000000002',
      (select publication_id from tier2_published_result),
      '85000000-0000-4000-8000-000000000002', 'tier2-test-admin',
      'admin@example.test', 'rollback after verified incident'
    )
  $$,
  'an audited rollback can repoint the stable target to a prior publication'
);

select set_config('app.pipeline_dataset_mutation_txid', '', true);

select ok(
  (select current_publication_id from private.tier2_publication_targets where product_kind = 'tier2')
    = '86000000-0000-4000-8000-000000000002'::uuid
  and (
    select data
    from public.dataset_rows
    where dataset_id = '85000000-0000-4000-8000-000000000002'
      and row_index = 0
  ) = '{"AX_PGIC":"10-jp-000999-LAO","Tier2_Profile_Key":"partner-alpha"}'::jsonb
  and (
    select current_version_action
    from public.datasets
    where id = '85000000-0000-4000-8000-000000000002'
  ) = 'revert',
  'rollback advances the target only with restored consumer rows'
);

select is(
  (
    select publication.output_checksum
    from private.tier2_publication_targets as target
    join private.pipeline_publications as publication
      on publication.id = target.current_publication_id
    where target.product_kind = 'tier2'
  ),
  repeat('6', 64),
  'the restored stable target exposes the selected publication checksum'
);

select ok(
  exists (
    select 1
    from public.dataset_versions as version
    join public.dataset_version_rows as row on row.version_id = version.id
    where version.id = '85500000-0000-4000-8000-000000000001'
      and row.data = '{"AX_PGIC":"10-jp-100001-LAO","Tier2_Profile_Key":"partner-alpha"}'::jsonb
  ),
  'rollback preserves the incident consumer dataset in version history'
);

select throws_ok(
  $$
    select private.rollback_tier2_publication_target(
      'tier2', (select publication_id from tier2_published_result),
      (select publication_id from tier2_published_result),
      '85000000-0000-4000-8000-000000000002', 'tier2-test-admin',
      'admin@example.test', 'stale rollback must fail'
    )
  $$,
  'Stable target changed since rollback review.',
  'stale rollback CAS cannot replace the restored consumer dataset'
);

select is(
  (select version_number from private.tier2_publication_targets where product_kind = 'tier2'),
  2,
  'publication and rollback each advance the target version'
);

select is(
  (select display_name from private.pipeline_definitions where definition_key = 'aggregate2-exact-union'),
  'Aggregate 2 Combined Release',
  'Aggregate 2 uses the approved combined-release display name'
);

select is(
  (select checksum from private.pipeline_definitions where definition_key = 'tier2-complete-partners'),
  '1641ad4635a3a7dc4b18102538bef5f046caecd51348fa9a1145f0324a3fd315',
  'Tier 2 stores the deterministic semantic definition checksum'
);

select is(
  (select checksum from private.pipeline_definitions where definition_key = 'aggregate2-exact-union'),
  '278dee49fd8a6a4b678b24bbb5c97350a479a05d042d8c175d4870d00f9a0be9',
  'Aggregate 2 stores the deterministic semantic definition checksum'
);

select * from finish();
rollback;
