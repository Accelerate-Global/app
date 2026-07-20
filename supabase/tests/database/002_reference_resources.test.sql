begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

select results_eq(
  $$
    select tablename
    from pg_tables
    where schemaname = 'private'
      and tablename in (
        'reference_resources',
        'reference_resource_versions',
        'reference_resource_validation_findings',
        'reference_resource_activation_events',
        'reference_resource_sets',
        'reference_resource_set_members',
        'country_reference_entries',
        'rop_reference_terms',
        'rop_reference_people',
        'rop_reference_geographies'
      )
    order by tablename
  $$,
  array[
    'country_reference_entries'::name,
    'reference_resource_activation_events'::name,
    'reference_resource_set_members'::name,
    'reference_resource_sets'::name,
    'reference_resource_validation_findings'::name,
    'reference_resource_versions'::name,
    'reference_resources'::name,
    'rop_reference_geographies'::name,
    'rop_reference_people'::name,
    'rop_reference_terms'::name
  ],
  'all reference-resource control and typed projection tables exist'
);

select is(
  (
    select count(*)::bigint
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname in (
        'reference_resources',
        'reference_resource_versions',
        'reference_resource_validation_findings',
        'reference_resource_activation_events',
        'reference_resource_sets',
        'reference_resource_set_members',
        'country_reference_entries',
        'rop_reference_terms',
        'rop_reference_people',
        'rop_reference_geographies'
      )
      and pg_class.relrowsecurity
  ),
  10::bigint,
  'all reference-resource tables have RLS enabled'
);

select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name like '%reference%'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0::bigint,
  'reference-resource tables grant nothing to public-facing roles'
);

select ok(
  exists(
    select 1 from storage.buckets
    where id = 'reference-resource-artifacts'
      and public = false
      and file_size_limit = 134217728
      and allowed_mime_types @> array['application/json', 'text/csv']::text[]
  ),
  'reference resource artifact bucket is private and bounded'
);

select ok(
  exists(
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname = 'activate_reference_resource'
      and pg_proc.prosecdef
  ),
  'activation is implemented by a private security-definer function'
);

select is(
  (
    select count(*)::bigint
    from information_schema.routine_privileges
    where routine_schema = 'private'
      and routine_name = 'activate_reference_resource'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0::bigint,
  'public-facing roles cannot execute the activation function'
);

select is(
  (select count(*)::bigint from private.reference_resources),
  2::bigint,
  'Country/ROG and ROP definitions are registered'
);

select ok(
  (
    select count(*) >= 18
    from pg_indexes
    where schemaname = 'private'
      and indexname in (
        'reference_resources_active_version_idx',
        'reference_resource_versions_number_idx',
        'reference_resource_versions_history_idx',
        'reference_resource_findings_version_idx',
        'reference_resource_events_resource_idx',
        'reference_resource_events_selected_version_idx',
        'reference_resource_set_members_resource_idx',
        'reference_resource_set_members_version_idx',
        'country_reference_entries_version_key_idx',
        'country_reference_entries_version_primary_iso3_idx',
        'country_reference_entries_version_rog3_idx',
        'rop_reference_terms_version_level_code_idx',
        'rop_reference_terms_version_parent_idx',
        'rop_reference_people_version_key_idx',
        'rop_reference_people_version_rop3_idx',
        'rop_reference_geographies_version_geo_idx',
        'rop_reference_geographies_version_rop3_idx',
        'rop_reference_geographies_version_people_id3_idx'
      )
  ),
  'foreign keys and dominant typed lookup paths are indexed'
);

select throws_ok(
  $$
    insert into private.reference_resources (
      resource_key, resource_kind, label, description, route_path
    ) values ('unknown', 'unknown', 'Unknown', '', '/dashboard/unknown')
  $$,
  '23514',
  null,
  'unknown untyped resource kinds are rejected'
);

-- The normal local reset now bootstraps active reference versions before pgTAP.
-- Isolate lifecycle fixtures inside this transaction so the invariants test the
-- same way against a migration-only or fully bootstrapped database; rollback
-- restores the bootstrapped state after the suite.
set local session_replication_role = replica;
update private.reference_resources set active_version_id = null;
delete from private.reference_resource_activation_events;
delete from private.reference_resource_set_members;
delete from private.reference_resource_sets;
delete from private.reference_resource_validation_findings;
delete from private.country_reference_entries;
delete from private.rop_reference_geographies;
delete from private.rop_reference_people;
delete from private.rop_reference_terms;
delete from private.reference_resource_versions;
set local session_replication_role = origin;

insert into private.reference_resource_versions (
  id,
  resource_id,
  version_number,
  schema_version,
  source_retrieved_at,
  created_by_owner_id
)
select
  '71000000-0000-4000-8000-000000000001',
  id,
  1,
  1,
  now(),
  'security-test-admin'
from private.reference_resources
where resource_key = 'country-territory-codes';

insert into private.country_reference_entries (
  version_id,
  stable_key,
  display_name,
  active,
  primary_alpha3,
  alternative_names,
  classification,
  search_text
)
values (
  '71000000-0000-4000-8000-000000000001',
  'iso:code:3166:AF:afghanistan',
  'Afghanistan',
  true,
  'AFG',
  '[]'::jsonb,
  'iso-official',
  'afghanistan afg'
);

select is(
  (select count(*)::bigint from private.country_reference_entries where version_id = '71000000-0000-4000-8000-000000000001'),
  1::bigint,
  'building versions accept typed projection batches'
);

update private.reference_resource_versions
set
  lifecycle_state = 'valid',
  content_checksum = repeat('a', 64),
  normalized_resource = '{"entries":[]}'::jsonb,
  artifact_manifest = '{"raw-manifest":"raw.json","normalized":"normalized.json","csv":"resource.csv","validation":"validation.json","diff":"diff.json"}'::jsonb,
  validation_summary = '{"errorCount":0}'::jsonb,
  diff_summary = '{"added":1,"changed":0,"removed":0}'::jsonb,
  entry_count = 1,
  finalized_at = now()
where id = '71000000-0000-4000-8000-000000000001';

select is(
  (select lifecycle_state from private.reference_resource_versions where id = '71000000-0000-4000-8000-000000000001'),
  'valid',
  'complete building package can be finalized as valid'
);

select lives_ok(
  $$
    select private.activate_reference_resource(
      'country-territory-codes',
      '71000000-0000-4000-8000-000000000001',
      null,
      'security-test-admin',
      'Initial activation',
      'activate'
    )
  $$,
  'valid version activates atomically'
);

select is(
  (select active_version_id from private.reference_resources where resource_key = 'country-territory-codes'),
  '71000000-0000-4000-8000-000000000001'::uuid,
  'activation swaps the catalog pointer'
);

select is(
  (select count(*)::bigint from private.reference_resource_activation_events),
  1::bigint,
  'activation appends an audit event'
);

select is(
  (select count(*)::bigint from private.reference_resource_sets),
  1::bigint,
  'activation creates an immutable resource set'
);

select is(
  (select count(*)::bigint from private.reference_resource_set_members where version_id = '71000000-0000-4000-8000-000000000001'),
  1::bigint,
  'resource set pins the exact activated version'
);

select throws_ok(
  $$
    select private.activate_reference_resource(
      'country-territory-codes',
      '71000000-0000-4000-8000-000000000001',
      null,
      'security-test-admin',
      'Stale activation',
      'activate'
    )
  $$,
  '40001',
  null,
  'stale expected-active pointer is rejected'
);

insert into private.reference_resource_versions (
  id,
  resource_id,
  version_number,
  lifecycle_state,
  schema_version,
  content_checksum,
  source_retrieved_at,
  source_metadata,
  normalized_resource,
  artifact_manifest,
  validation_summary,
  diff_summary,
  entry_count,
  created_by_owner_id,
  finalized_at
)
select
  '71000000-0000-4000-8000-000000000002',
  id,
  2,
  'valid',
  1,
  repeat('b', 64),
  now(),
  '{}'::jsonb,
  '{"entries":[]}'::jsonb,
  '{"raw-manifest":"raw2.json","normalized":"normalized2.json","csv":"resource2.csv","validation":"validation2.json","diff":"diff2.json"}'::jsonb,
  '{"errorCount":0}'::jsonb,
  '{"added":0,"changed":1,"removed":0}'::jsonb,
  1,
  'security-test-admin',
  now()
from private.reference_resources
where resource_key = 'country-territory-codes';

select lives_ok(
  $$
    select private.activate_reference_resource(
      'country-territory-codes',
      '71000000-0000-4000-8000-000000000002',
      '71000000-0000-4000-8000-000000000001',
      'security-test-admin',
      'Rollback fixture',
      'rollback'
    )
  $$,
  'rollback uses the same atomic activation path'
);

select is(
  (select count(*)::bigint from private.reference_resource_activation_events),
  2::bigint,
  'rollback appends a second audit event'
);

select is(
  (
    select version_id
    from private.reference_resource_set_members
    where set_id = (select id from private.reference_resource_sets order by sequence_number desc limit 1)
  ),
  '71000000-0000-4000-8000-000000000002'::uuid,
  'latest immutable set resolves the rolled-back selection'
);

select throws_ok(
  $$
    update private.reference_resource_versions
    set entry_count = 99
    where id = '71000000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'Finalized reference-resource package content is immutable.',
  'finalized version package fields cannot change'
);

select throws_ok(
  $$
    update private.country_reference_entries
    set display_name = 'Changed'
    where version_id = '71000000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'Finalized reference-resource projections are immutable.',
  'finalized typed projections cannot change'
);

select throws_ok(
  $$
    insert into private.country_reference_entries (
      version_id, stable_key, display_name, active, alternative_names, classification, search_text
    ) values (
      '71000000-0000-4000-8000-000000000001', 'late', 'Late', true, '[]', 'csv-only', 'late'
    )
  $$,
  'P0001',
  'Finalized reference-resource projections are immutable.',
  'finalized versions reject late projection inserts'
);

select throws_ok(
  $$
    update private.reference_resource_activation_events set reason = 'changed'
  $$,
  'P0001',
  'Reference-resource audit and set records are append-only.',
  'activation audit events are append-only'
);

select throws_ok(
  $$
    delete from private.reference_resource_set_members
  $$,
  'P0001',
  'Reference-resource audit and set records are append-only.',
  'resource-set members are immutable'
);

insert into private.reference_resource_versions (
  id, resource_id, version_number, schema_version, source_retrieved_at, created_by_owner_id
)
select
  '71000000-0000-4000-8000-000000000003', id, 3, 1, now(), 'security-test-admin'
from private.reference_resources
where resource_key = 'country-territory-codes';

select throws_ok(
  $$
    insert into private.country_reference_entries (
      version_id, stable_key, display_name, active, official_iso_alpha3,
      alternative_names, classification, search_text
    ) values (
      '71000000-0000-4000-8000-000000000003', 'bad', 'Bad', true, 'bad',
      '[]', 'csv-only', 'bad'
    )
  $$,
  '23514',
  null,
  'typed Country projection rejects malformed ISO3 codes'
);

select throws_ok(
  $$
    update private.reference_resource_versions
    set lifecycle_state = 'rejected'
    where id = '71000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  null,
  'rejected versions require actor, reason, and timestamp'
);

set local role anon;

select throws_ok(
  $$ select count(*)::bigint from private.reference_resources $$,
  '42501',
  null,
  'anonymous Data API role cannot read private catalog tables'
);

reset role;

select ok(
  not exists(
    select 1 from private.reference_resource_sets
    where content_checksum !~ '^[0-9a-f]{64}$'
  ),
  'every resource set has a deterministic SHA-256 checksum'
);

select * from finish();

rollback;
