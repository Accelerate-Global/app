begin;

create extension if not exists pgtap with schema extensions;

select plan(50);

select ok(
  exists(select 1 from pg_roles where rolname = 'analytics_chat_reader'),
  'analytics reader role exists'
);
select ok(
  exists(
    select 1
    from pg_roles
    where rolname = 'analytics_chat_reader'
      and not rolcanlogin
      and not rolsuper
      and not rolcreatedb
      and not rolcreaterole
      and not rolreplication
      and not rolbypassrls
  ),
  'analytics reader cannot login or bypass database controls'
);
select ok(
  exists(
    select 1
    from pg_roles
    where rolname = 'analytics_chat_login'
      and rolcanlogin
      and not rolsuper
      and not rolcreatedb
      and not rolcreaterole
      and not rolreplication
      and not rolbypassrls
      and rolconnlimit = 4
  ),
  'analytics login is bounded and non-privileged'
);
select ok(
  pg_has_role('analytics_chat_login', 'analytics_chat_reader', 'MEMBER'),
  'analytics login can assume only the constrained reader role'
);
select ok(
  (select rolconfig @> array['statement_timeout=10s']
   from pg_roles where rolname = 'analytics_chat_login'),
  'analytics login retains a bounded ten-second statement ceiling'
);
select ok(
  (select rolconfig @> array['statement_timeout=10s']
   from pg_roles where rolname = 'analytics_chat_reader'),
  'analytics reader retains the same bounded ten-second statement ceiling'
);
select is(
  current_setting('default_transaction_read_only', true),
  'off',
  'database test session remains writable before role tests'
);

select ok(
  exists(
    select 1
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'analytics_ro'
      and pg_class.relname = 'primary_people_groups'
      and pg_class.relkind = 'v'
      and pg_class.reloptions @> array['security_invoker=true', 'security_barrier=true']
  ),
  'approved analytics view is security invoker and security barrier'
);
select ok(
  exists(
    select 1
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'analytics_ro'
      and pg_class.relname = 'primary_people_groups_metadata'
      and pg_class.relkind = 'v'
      and pg_class.reloptions @> array['security_invoker=true', 'security_barrier=true']
  ),
  'analytics metadata view is also a security-invoker barrier'
);
select ok(
  has_schema_privilege('analytics_chat_reader', 'analytics_ro', 'USAGE')
    and has_table_privilege(
      'analytics_chat_reader',
      'analytics_ro.primary_people_groups',
      'SELECT'
    )
    and has_table_privilege(
      'analytics_chat_reader',
      'analytics_ro.primary_people_groups_metadata',
      'SELECT'
    ),
  'analytics reader can use only the approved projection entrypoint'
);
select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where grantee = 'analytics_chat_reader'
      and table_schema = 'public'
  ),
  0::bigint,
  'analytics reader has no direct public table privileges'
);
select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
      and table_schema = 'analytics_ro'
  ),
  0::bigint,
  'browser and provider-facing roles have no analytics view grants'
);
select ok(
  exists(
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname = 'analytics_primary_people_groups_rows'
      and pg_proc.prosecdef
      and pg_proc.proconfig @> array['search_path=""']
  ),
  'projection function is a locked-search-path security definer'
);
select ok(
  exists(
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname = 'analytics_primary_people_groups_metadata'
      and pg_proc.prosecdef
      and pg_proc.proconfig @> array['search_path=""']
  ),
  'dataset and ROP binding metadata function has a locked search path'
);
select is(
  (
    select count(*)::bigint
    from information_schema.routine_privileges
    where routine_schema = 'private'
      and routine_name in (
        'analytics_primary_people_groups_rows',
        'analytics_primary_people_groups_metadata'
      )
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ),
  0::bigint,
  'public-facing roles cannot execute the projection function'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   join pg_namespace on pg_namespace.oid = pg_class.relnamespace
   where pg_namespace.nspname = 'private'
     and pg_class.relname = 'analytics_chat_audit'),
  'analytics audit table has forced RLS'
);
select ok(
  exists(
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'analytics_chat_audit'
      and column_name = 'model_sha256'
  ) and exists(
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'analytics_chat_audit'
      and column_name = 'runtime_revision'
  ) and not exists(
    select required.column_name
    from (values
      ('matching_count'),
      ('requested_limit'),
      ('query_mode'),
      ('named_filter_keys'),
      ('resource_key'),
      ('resource_operation'),
      ('resource_version_id'),
      ('retrieval_audience'),
      ('semantic_snapshot_checksum'),
      ('retrieval_policy_checksum'),
      ('retrieval_tier'),
      ('retrieved_card_keys'),
      ('retrieved_card_checksums'),
      ('retrieval_latency_ms'),
      ('context_bytes')
    ) as required(column_name)
    where not exists (
      select 1
      from information_schema.columns as available
      where table_schema = 'private'
        and table_name = 'analytics_chat_audit'
        and available.column_name = required.column_name
    )
  ),
  'analytics audit records pinned runtime and result-completeness identifiers'
);
select ok(
  exists(
    select 1 from private.reference_resources
    where resource_key = 'semantic-context-catalog'
      and resource_kind = 'semantic-catalog'
  ),
  'semantic context is registered in the immutable reference-resource lifecycle'
);
select ok(
  exists(
    select 1
    from pg_indexes
    where schemaname = 'private'
      and tablename = 'pipeline_reference_entries'
      and indexname = 'pipeline_reference_entries_search_document_idx'
      and indexdef ilike '%using gin%search_document%'
  ),
  'semantic contextual text has a private PostgreSQL full-text GIN index'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   join pg_namespace on pg_namespace.oid = pg_class.relnamespace
   where pg_namespace.nspname = 'private'
     and pg_class.relname = 'analytics_semantic_context_embeddings')
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'analytics_semantic_context_embeddings'
      and column_name = 'embedding'
      and udt_name = 'vector'
  ),
  'optional semantic embeddings are private, forced-RLS, and fixed-vector typed'
);
select ok(
  not exists (
    select 1
    from pg_indexes
    where schemaname = 'private'
      and tablename = 'analytics_semantic_context_embeddings'
      and indexdef ~* '(hnsw|ivfflat)'
  ) and (
    select count(*)
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name = 'analytics_semantic_context_embeddings'
      and grantee in (
        'PUBLIC', 'anon', 'authenticated', 'service_role',
        'analytics_chat_reader', 'analytics_chat_login'
      )
  ) = 0,
  'embedding candidate has no approximate index or provider-facing grant'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   join pg_namespace on pg_namespace.oid = pg_class.relnamespace
   where pg_namespace.nspname = 'private'
     and pg_class.relname = 'analytics_chat_continuation_uses'),
  'continuation replay ledger has forced RLS'
);
select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name = 'analytics_chat_continuation_uses'
      and grantee in (
        'PUBLIC', 'anon', 'authenticated', 'service_role',
        'analytics_chat_reader', 'analytics_chat_login'
      )
  ),
  0::bigint,
  'continuation replay ledger exposes no direct table grants'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   join pg_namespace on pg_namespace.oid = pg_class.relnamespace
   where pg_namespace.nspname = 'private'
     and pg_class.relname = 'analytics_chat_dataset_resource_bindings'),
  'legacy dataset resource bindings have forced RLS'
);
select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name = 'analytics_chat_dataset_resource_bindings'
      and grantee in (
        'PUBLIC', 'anon', 'authenticated', 'service_role',
        'analytics_chat_reader', 'analytics_chat_login'
      )
  ),
  0::bigint,
  'legacy dataset resource bindings expose no provider or analytics grants'
);
select ok(
  exists(
    select 1
    from pg_trigger
    join pg_class on pg_class.oid = pg_trigger.tgrelid
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname = 'analytics_chat_dataset_resource_bindings'
      and pg_trigger.tgname =
        'analytics_chat_dataset_resource_bindings_immutable'
      and not pg_trigger.tgisinternal
  ),
  'legacy dataset resource bindings are guarded as append-only evidence'
);
select ok(
  exists(
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname = 'consume_analytics_chat_continuation_token'
      and pg_proc.prosecdef
      and pg_proc.proconfig @> array['search_path=""']
  ),
  'continuation consumption is a locked-search-path security definer'
);
select ok(
  has_function_privilege(
    'analytics_chat_reader',
    'private.consume_analytics_chat_continuation_token(text,timestamptz)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'private.consume_analytics_chat_continuation_token(text,timestamptz)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.consume_analytics_chat_continuation_token(text,timestamptz)',
    'EXECUTE'
  ),
  'only server and constrained analytics roles can consume continuation state'
);
select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name = 'analytics_chat_audit'
      and grantee in (
        'PUBLIC', 'anon', 'authenticated', 'service_role',
        'analytics_chat_reader', 'analytics_chat_login'
      )
  ),
  0::bigint,
  'analytics audit table has no browser, service-role, or analytics grants'
);

insert into public.signup_email_allowlist (email, note)
values
  ('chat-admin@example.com', 'private data chat test'),
  ('chat-pro@example.com', 'private data chat test')
on conflict do nothing;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    'ca000001-1337-403d-8eb5-b7c44a1be131',
    'authenticated', 'authenticated', 'chat-admin@example.com', '', now(),
    '{"provider":"email","providers":["email"],"workspace_role":"admin"}'::jsonb,
    '{}'::jsonb, now(), now()
  ),
  (
    'ca000002-1337-403d-8eb5-b7c44a1be131',
    'authenticated', 'authenticated', 'chat-pro@example.com', '', now(),
    '{"provider":"email","providers":["email"],"workspace_role":"pro"}'::jsonb,
    '{}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

update public.datasets
set is_primary = false
where is_primary;

insert into public.datasets (
  id, owner_id, file_name, blob_url, blob_path, current_version_action,
  current_version_actor_owner_id, current_version_actor_email,
  current_version_created_at, is_primary, is_workspace_visible, status,
  row_count, size_bytes, columns, hidden_column_keys, tags
) values (
  'ca100001-1337-403d-8eb5-b7c44a1be131',
  'private-data-chat-test',
  'Private Data Chat Fixture',
  'https://example.invalid/private-data-chat.csv',
  'datasets/csv/private-data-chat.csv',
  'upload',
  'private-data-chat-test',
  'chat-admin@example.com',
  '2026-08-26T00:00:00Z',
  true,
  true,
  'ready',
  3,
  1024,
  '[
    {"key":"pg_peopleid1","label":"PG_PeopleID1","sourceIndex":0},
    {"key":"people_name","label":"People Name","sourceIndex":1},
    {"key":"geo_country_name","label":"Country","sourceIndex":2},
    {"key":"pg_population","label":"Population","sourceIndex":3}
  ]'::jsonb,
  '[]'::jsonb,
  '[{"id":"dataset-classification-pgac","label":"PGAC","color":"#fcab2a"}]'::jsonb
);

insert into public.dataset_rows (dataset_id, row_index, data) values
  (
    'ca100001-1337-403d-8eb5-b7c44a1be131', 0,
    '{"pg_peopleid1":"PG-1","people_name":"Rana","geo_country_name":"India","christianity_gsec":"1","christianity_frontier_group":"true","pg_population":"4000","percent_evangelical_pgac":"2","engage_8_phases_of_engagement":"6","engage_global_engagement_anywhere":"false"}'::jsonb
  ),
  (
    'ca100001-1337-403d-8eb5-b7c44a1be131', 1,
    '{"pg_peopleid1":"PG-2","people_name":"Tamang","geo_country_name":"Nepal","christianity_gsec":"3","christianity_frontier_group":"false","pg_population":"9000","percent_evangelical_pgac":"1","engage_8_phases_of_engagement":"5","engage_global_engagement_anywhere":"true"}'::jsonb
  ),
  (
    'ca100001-1337-403d-8eb5-b7c44a1be131', 2,
    '{"pg_peopleid1":"PG-3","people_name":"Malformed","geo_country_name":"India","christianity_gsec":"not-a-number","christianity_frontier_group":"unknown","pg_population":"not-a-number","percent_evangelical_pgac":"","engage_8_phases_of_engagement":"","engage_global_engagement_anywhere":"unknown"}'::jsonb
  );

-- Test-only pgTAP access. The transaction rollback removes this grant.
grant usage on schema extensions to analytics_chat_reader;

select set_config(
  'request.jwt.claims',
  '{"sub":"ca000001-1337-403d-8eb5-b7c44a1be131","role":"authenticated"}',
  true
);
set local role analytics_chat_reader;

select extensions.results_eq(
  $$
    select people_id
    from analytics_ro.primary_people_groups
    order by people_id
  $$,
  array['PG-1'::text, 'PG-2'::text, 'PG-3'::text],
  'verified admin can read the approved primary projection'
);
select extensions.results_eq(
  $$
    select people_id, population
    from analytics_ro.primary_people_groups
    order by people_id
  $$,
  $$ values
    ('PG-1'::text, 4000::numeric),
    ('PG-2'::text, 9000::numeric),
    ('PG-3'::text, null::numeric)
  $$,
  'projection returns typed values and fails malformed numeric cells closed'
);
select extensions.results_eq(
  $$
    select rop_binding_status
    from analytics_ro.primary_people_groups_metadata
  $$,
  array['missing_publication'::text],
  'missing dataset-to-ROP production lineage is explicit and never falls back to active ROP'
);
select extensions.results_eq(
  $$
    select people_id, rop_match_status
    from analytics_ro.primary_people_groups
    order by people_id
  $$,
  $$ values
    ('PG-1'::text, 'unbound'::text),
    ('PG-2'::text, 'unbound'::text),
    ('PG-3'::text, 'unbound'::text)
  $$,
  'the left relationship preserves every people-group row when ROP is unbound'
);

reset role;
insert into private.reference_resource_versions (
  id,
  resource_id,
  version_number,
  schema_version,
  source_retrieved_at,
  created_by_owner_id
)
select
  'ca300001-1337-403d-8eb5-b7c44a1be131',
  resource.id,
  coalesce(max(existing.version_number), 0) + 1,
  1,
  now(),
  'system:private-data-chat-test'
from private.reference_resources as resource
left join private.reference_resource_versions as existing
  on existing.resource_id = resource.id
where resource.resource_key = 'rop-codes'
group by resource.id;

insert into private.rop_reference_people (
  version_id,
  stable_key,
  row_type,
  rop3_code,
  status,
  search_text
)
values (
  'ca300001-1337-403d-8eb5-b7c44a1be131',
  'test:rop3:100001',
  'rop3-person',
  '100001',
  'Active',
  'test rop3 person 100001'
);

update private.reference_resource_versions
set
  lifecycle_state = 'valid',
  content_checksum = repeat('c', 64),
  normalized_resource = '{"entries":[{"code":"100001"}]}'::jsonb,
  artifact_manifest = '{"normalized":"test.json"}'::jsonb,
  validation_summary = '{"errorCount":0}'::jsonb,
  diff_summary = '{"added":1,"changed":0,"removed":0}'::jsonb,
  entry_count = 1,
  finalized_at = now()
where id = 'ca300001-1337-403d-8eb5-b7c44a1be131';

insert into private.analytics_chat_dataset_resource_bindings (
  dataset_id,
  dataset_version_created_at,
  resource_id,
  resource_version_id,
  binding_source,
  created_by_owner_id,
  reason
)
select
  'ca100001-1337-403d-8eb5-b7c44a1be131',
  '2026-08-26T00:00:00Z'::timestamptz,
  resource.id,
  'ca300001-1337-403d-8eb5-b7c44a1be131',
  'legacy-reviewed-backfill',
  'system:private-data-chat-test',
  'Test exact immutable legacy binding.'
from private.reference_resources as resource
where resource.resource_key = 'rop-codes';

select ok(
  (select active_version_id is distinct from
      'ca300001-1337-403d-8eb5-b7c44a1be131'::uuid
   from private.reference_resources
   where resource_key = 'rop-codes'),
  'reviewed legacy binding does not consult or mutate the active pointer'
);

select throws_ok(
  $$ update private.analytics_chat_dataset_resource_bindings
     set reason = 'changed' $$,
  '55000',
  null,
  'legacy dataset resource bindings cannot be updated'
);
select throws_ok(
  $$ delete from private.analytics_chat_dataset_resource_bindings $$,
  '55000',
  null,
  'legacy dataset resource bindings cannot be deleted'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"ca000001-1337-403d-8eb5-b7c44a1be131","role":"authenticated"}',
  true
);
set local role analytics_chat_reader;

select extensions.results_eq(
  $$
    select rop_binding_status
    from analytics_ro.primary_people_groups_metadata
  $$,
  array['bound'::text],
  'an explicit reviewed legacy binding resolves without an active-pointer fallback'
);
select extensions.results_eq(
  $$
    select people_id, rop_match_status
    from analytics_ro.primary_people_groups
    order by people_id
  $$,
  $$ values
    ('PG-1'::text, 'blank'::text),
    ('PG-2'::text, 'blank'::text),
    ('PG-3'::text, 'blank'::text)
  $$,
  'the bound left relationship preserves rows whose source ROP3 value is blank'
);
select extensions.results_eq(
  $$
    select people_id, frontier_group_is_missing, globally_engaged_is_missing
    from analytics_ro.primary_people_groups
    order by people_id
  $$,
  $$ values
    ('PG-1'::text, false, false),
    ('PG-2'::text, false, false),
    ('PG-3'::text, false, false)
  $$,
  'nonblank invalid booleans remain distinct from source blanks'
);
select extensions.results_eq(
  $$
    select private.consume_analytics_chat_continuation_token(
      repeat('a', 64), now() + interval '5 minutes'
    )
    union all
    select private.consume_analytics_chat_continuation_token(
      repeat('a', 64), now() + interval '5 minutes'
    )
  $$,
  array[true, false],
  'ROP continuation state is one-time and replay is rejected'
);
select extensions.results_eq(
  $$
    select people_id
    from analytics_ro.primary_people_groups
    where country = 'Antarctica'
  $$,
  array[]::text[],
  'valid empty-result filters execute and return zero rows'
);
select extensions.throws_ok(
  $$ insert into public.dataset_rows (dataset_id, row_index, data)
     values ('ca100001-1337-403d-8eb5-b7c44a1be131', 99, '{}'::jsonb) $$,
  '42501',
  null,
  'analytics reader cannot write dataset rows'
);
select extensions.throws_ok(
  $$ select email from auth.users $$,
  '42501',
  null,
  'analytics reader cannot inspect auth users directly'
);
select extensions.throws_ok(
  $$ select * from private.analytics_chat_audit $$,
  '42501',
  null,
  'analytics reader cannot inspect audit records'
);

reset role;
insert into private.pipeline_publications (
  id,
  producer_kind,
  producer_run_id,
  dataset_id,
  output_checksum,
  row_count,
  artifact_manifest,
  actor_owner_id,
  reason,
  publication_target_key
)
values (
  'ca400001-1337-403d-8eb5-b7c44a1be131',
  'dataset-forming',
  'ca400002-1337-403d-8eb5-b7c44a1be131',
  'ca100001-1337-403d-8eb5-b7c44a1be131',
  repeat('d', 64),
  3,
  '{}'::jsonb,
  'system:private-data-chat-test',
  'Producer publication precedence fixture.',
  'private-data-chat-test'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"ca000001-1337-403d-8eb5-b7c44a1be131","role":"authenticated"}',
  true
);
set local role analytics_chat_reader;

select extensions.results_eq(
  $$
    select rop_binding_status
    from analytics_ro.primary_people_groups_metadata
  $$,
  array['missing_resource_set'::text],
  'producer publication takes precedence and cannot fall back to a legacy binding'
);
select extensions.results_eq(
  $$
    select people_id, rop_match_status
    from analytics_ro.primary_people_groups
    order by people_id
  $$,
  $$ values
    ('PG-1'::text, 'unbound'::text),
    ('PG-2'::text, 'unbound'::text),
    ('PG-3'::text, 'unbound'::text)
  $$,
  'producer publication without a resource set fails the relationship closed'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"ca000002-1337-403d-8eb5-b7c44a1be131","role":"authenticated"}',
  true
);
set local role analytics_chat_reader;

select extensions.is(
  (select count(*) from analytics_ro.primary_people_groups),
  0::bigint,
  'non-pilot pro identity receives no analytical rows'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role analytics_chat_reader;

select extensions.is(
  (select count(*) from analytics_ro.primary_people_groups),
  0::bigint,
  'missing identity receives no analytical rows'
);

reset role;

select throws_ok(
  $$ insert into private.analytics_chat_audit (
       query_id, pseudonymous_user_id, catalog_version, policy_version,
       decision, reason_code
     ) values (
       gen_random_uuid(), 'raw-user-id', 'v1', 'v1', 'executed', 'test'
     ) $$,
  '23514',
  null,
  'audit rejects short raw identity references'
);

select throws_ok(
  $$ insert into private.analytics_chat_audit (
       query_id, pseudonymous_user_id, catalog_version, policy_version,
       decision, reason_code, query_mode
     ) values (
       gen_random_uuid(), repeat('a', 64), 'v1', 'v1', 'executed',
       'resource_query_executed', 'resource'
     ) $$,
  '23514',
  null,
  'resource audit rows require structural resource identifiers'
);

select * from finish();
rollback;
