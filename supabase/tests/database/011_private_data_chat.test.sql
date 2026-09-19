begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

select ok(
  not exists(select 1 from pg_roles where rolname = 'analytics_chat_reader'),
  'retired analytics reader role is absent'
);
select ok(
  not exists(select 1 from pg_roles where rolname = 'analytics_chat_login'),
  'retired analytics login role is absent'
);
select ok(
  not exists(select 1 from pg_namespace where nspname = 'analytics_ro'),
  'retired analytics schema is absent'
);
select is(
  (
    select count(*)::bigint
    from information_schema.views
    where table_schema = 'analytics_ro'
       or table_name in ('primary_people_groups', 'primary_people_groups_metadata')
  ),
  0::bigint,
  'retired analytics views are absent'
);
select is(
  (
    select count(*)::bigint
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname in (
        'analytics_primary_people_groups_rows',
        'analytics_primary_people_groups_metadata',
        'consume_analytics_chat_continuation_token',
        'guard_analytics_chat_dataset_resource_binding'
      )
  ),
  0::bigint,
  'retired analytics functions are absent'
);
select is(
  (
    select count(*)::bigint
    from information_schema.tables
    where table_schema = 'private'
      and table_name in (
        'analytics_chat_audit',
        'analytics_chat_continuation_uses',
        'analytics_chat_dataset_resource_bindings',
        'analytics_semantic_context_embeddings'
      )
  ),
  0::bigint,
  'retired analytics tables are absent'
);
select ok(
  not exists(
    select 1 from private.reference_resources
    where resource_key = 'semantic-context-catalog'
       or resource_kind = 'semantic-catalog'
  ),
  'retired semantic resource and kind are absent'
);
select ok(
  not exists(
    select 1 from information_schema.columns
    where table_schema = 'private'
      and table_name = 'pipeline_reference_entries'
      and column_name = 'search_document'
  ),
  'retired semantic search projection is absent'
);
select ok(
  not exists(
    select 1 from pg_indexes
    where schemaname = 'private'
      and indexname = 'pipeline_reference_entries_search_document_idx'
  ),
  'retired semantic search index is absent'
);
select ok(
  not exists(select 1 from pg_extension where extname = 'vector'),
  'Qwen-only vector extension is absent'
);

select ok(
  exists(select 1 from pg_namespace where nspname = 'auth'),
  'Supabase Auth schema is preserved'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'auth' and pg_class.relname = 'users'
  ),
  'Auth users remain row-level secured'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public' and pg_class.relname = 'datasets'
  ),
  'datasets retain row-level security'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public' and pg_class.relname = 'dataset_rows'
  ),
  'dataset rows retain row-level security'
);
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'datasets'
  ),
  'dataset access policies are preserved'
);

select ok(to_regclass('private.country_reference_entries') is not null,
  'Country/ROG reference projection is preserved');
select ok(
  exists(
    select 1 from information_schema.columns
    where table_schema = 'private'
      and table_name = 'country_reference_entries'
      and column_name = 'rog3'
  ),
  'Country/ROG code data is preserved'
);
select ok(to_regclass('private.rop_reference_terms') is not null,
  'ROP taxonomy terms are preserved');
select ok(to_regclass('private.rop_reference_people') is not null,
  'ROP people projection is preserved');
select ok(to_regclass('private.rop_reference_geographies') is not null,
  'ROP geography projection is preserved');
select ok(to_regclass('private.pipeline_reference_entries') is not null,
  'generic pipeline reference entries are preserved');

select ok(
  exists(
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname = 'activate_reference_resource'
      and pg_proc.prosecdef
  ),
  'guarded generic reference-resource activation is preserved'
);
select ok(
  exists(
    select 1
    from pg_trigger
    join pg_class on pg_class.oid = pg_trigger.tgrelid
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname = 'reference_resources'
      and pg_trigger.tgname = 'reference_resources_guard_activation'
      and not pg_trigger.tgisinternal
  ),
  'direct active-pointer mutation remains guarded'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.activate_reference_resource(text,uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  'browser users cannot activate reference resources'
);
select throws_ok(
  $$
    insert into private.reference_resources (
      resource_key, resource_kind, label, description, route_path, sort_order
    ) values (
      'test-retired-semantic-kind', 'semantic-catalog', 'Retired',
      'Retired kind must stay rejected.', '/dashboard/resources/retired', 999
    )
  $$,
  '23514',
  null,
  'the restored kind constraint rejects semantic-catalog'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname = 'reference_resource_sets'
  ),
  'reference-resource sets retain row-level security'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname = 'reference_resource_set_members'
  ),
  'reference-resource set members retain row-level security'
);
select ok(
  exists(
    select 1
    from pg_trigger
    join pg_class on pg_class.oid = pg_trigger.tgrelid
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname = 'reference_resource_sets'
      and pg_trigger.tgname = 'reference_resource_sets_append_only'
      and not pg_trigger.tgisinternal
  ),
  'reference-resource sets remain append-only'
);
select ok(
  exists(
    select 1
    from pg_trigger
    join pg_class on pg_class.oid = pg_trigger.tgrelid
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname = 'reference_resource_set_members'
      and pg_trigger.tgname = 'reference_resource_set_members_append_only'
      and not pg_trigger.tgisinternal
  ),
  'reference-resource set members remain append-only'
);
select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name in ('reference_resource_sets', 'reference_resource_set_members')
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0::bigint,
  'browser-facing roles have no direct resource-set table grants'
);
select ok(
  exists(
    select 1
    from pg_constraint
    where conrelid = 'private.reference_resource_set_members'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) ilike '%version_id%reference_resource_versions%'
  ),
  'resource-set members retain version referential integrity'
);

select * from finish();
rollback;
