begin;

create extension if not exists pgtap with schema extensions;

select plan(42);

select has_table('private', 'data_archive_backup_runs', 'archive backup runs table exists');
select has_table('private', 'data_archive_receipts', 'archive receipts table exists');
select has_table('private', 'data_archive_packages', 'archive packages table exists');
select has_table('private', 'data_archive_package_members', 'archive package members table exists');
select has_table('private', 'data_archive_prune_plans', 'archive prune plans table exists');
select has_table('private', 'data_archive_prune_items', 'archive prune items table exists');
select has_table('private', 'data_archive_rehydrations', 'archive rehydrations table exists');

select ok(
  exists(
    select 1
    from pg_roles
    where rolname = 'data_archive_backup_reader'
      and rolcanlogin
      and not rolinherit
      and not rolsuper
      and not rolcreatedb
      and not rolcreaterole
      and not rolreplication
      and rolbypassrls
  ),
  'archive backup login is no-write constrained and may bypass RLS for granted reads'
);

select ok(
  not has_table_privilege('data_archive_backup_reader', 'public.datasets', 'INSERT')
    and not has_table_privilege('data_archive_backup_reader', 'public.datasets', 'UPDATE')
    and not has_table_privilege('data_archive_backup_reader', 'public.datasets', 'DELETE')
    and has_table_privilege('data_archive_backup_reader', 'public.datasets', 'SELECT'),
  'archive backup login can read but cannot mutate application tables'
);

select ok(
  exists(
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname = 'data_archive_export_managed_rows'
      and pg_proc.prosecdef
      and pg_proc.proconfig @> array['search_path=""']
  ),
  'managed-row export is a locked-search-path security definer'
);

select is(
  (
    select count(*)::bigint
    from information_schema.routine_privileges
    where routine_schema = 'private'
      and routine_name = 'data_archive_export_managed_rows'
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ),
  0::bigint,
  'browser and service roles cannot call the managed-row exporter'
);

select ok(
  has_function_privilege(
    'data_archive_backup_reader',
    'private.data_archive_export_managed_rows(text)',
    'EXECUTE'
  ),
  'only the archive backup login receives managed-row export access'
);

select throws_ok(
  $$ select * from private.data_archive_export_managed_rows('auth') limit 1 $$,
  '42501',
  'Archive export access denied.',
  'ordinary database sessions cannot invoke the session-bound exporter'
);

select is(
  (
    select count(*)::bigint
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'data archive reader can select storage objects'
      and cmd = 'SELECT'
      and roles = array['authenticated']::name[]
      and qual like '%data_archive_role%reader%'
  ),
  1::bigint,
  'one app-metadata-scoped Storage reader policy exists'
);

select is(
  (
    select count(*)::bigint
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname like 'data_archive_%'
      and pg_class.relkind = 'r'
      and pg_class.relrowsecurity
  ),
  7::bigint,
  'all archive catalog tables have RLS enabled'
);

select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name like 'data_archive_%'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0::bigint,
  'public-facing roles have no archive catalog table privileges'
);

select lives_ok(
  $$
    insert into private.data_archive_backup_runs (
      id, run_key, status, source_project_ref, source_database_version,
      migration_checksum, started_at
    ) values (
      'da000001-0000-4000-8000-000000000001',
      'backup:2026-08-27:001',
      'running',
      'uuyntfbqksnclyvlpecx',
      '17.6.1.104',
      repeat('a', 64),
      '2026-08-27T09:00:00Z'
    )
  $$,
  'a running backup can be recorded without terminal evidence'
);

select throws_ok(
  $$
    update private.data_archive_backup_runs
    set status = 'verified', completed_at = now()
    where id = 'da000001-0000-4000-8000-000000000001'
  $$,
  '23514',
  null,
  'a backup cannot become verified without manifest, snapshot, and integrity evidence'
);

select lives_ok(
  $$
    update private.data_archive_backup_runs
    set
      status = 'verified',
      manifest_checksum = repeat('b', 64),
      restic_snapshot_id = repeat('c', 64),
      completed_at = '2026-08-27T09:05:00Z',
      integrity_verified_at = '2026-08-27T09:05:00Z'
    where id = 'da000001-0000-4000-8000-000000000001'
  $$,
  'a backup becomes verified with complete terminal evidence'
);

select lives_ok(
  $$
    insert into private.data_archive_receipts (
      id, backup_run_id, receipt_key, nonce, issued_at,
      signature_digest, payload_checksum
    ) values (
      'da000002-0000-4000-8000-000000000002',
      'da000001-0000-4000-8000-000000000001',
      'receipt:2026-08-27:001',
      'nonce-2026-08-27-000000000001',
      now(),
      repeat('d', 64),
      repeat('e', 64)
    )
  $$,
  'a unique signed receipt can be persisted'
);

select throws_ok(
  $$
    insert into private.data_archive_receipts (
      backup_run_id, receipt_key, nonce, issued_at,
      signature_digest, payload_checksum
    ) values (
      'da000001-0000-4000-8000-000000000001',
      'receipt:2026-08-27:002',
      'nonce-2026-08-27-000000000001',
      now(),
      repeat('f', 64),
      repeat('1', 64)
    )
  $$,
  '23505',
  null,
  'receipt nonces reject replay'
);

select throws_ok(
  $$ delete from private.data_archive_receipts where id = 'da000002-0000-4000-8000-000000000002' $$,
  'P0001',
  'Data archive receipts are immutable.',
  'receipts cannot be deleted'
);

select lives_ok(
  $$
    insert into private.data_archive_packages (
      id, backup_run_id, package_key, package_kind, source_identifier,
      source_checksum, manifest_checksum, row_count, object_count,
      size_bytes, archive_snapshot_id, source_created_at,
      integrity_verified_at
    ) values (
      'da000003-0000-4000-8000-000000000003',
      'da000001-0000-4000-8000-000000000001',
      'api-run/00000000-0000-4000-8000-000000000001/' || repeat('2', 64),
      'api-run',
      '00000000-0000-4000-8000-000000000001',
      repeat('2', 64),
      repeat('3', 64),
      20,
      2,
      2048,
      repeat('c', 64),
      '2026-06-01T00:00:00Z',
      '2026-08-27T09:05:00Z'
    )
  $$,
  'a verified archive package can be cataloged'
);

select throws_ok(
  $$
    update private.data_archive_packages
    set source_checksum = repeat('4', 64)
    where id = 'da000003-0000-4000-8000-000000000003'
  $$,
  'P0001',
  'Verified data archive package identity and evidence are immutable.',
  'package identity evidence cannot be rewritten'
);

select throws_ok(
  $$
    update private.data_archive_packages
    set status = 'cold', pruned_at = now()
    where id = 'da000003-0000-4000-8000-000000000003'
  $$,
  '23514',
  null,
  'a package cannot become cold without restore evidence'
);

select lives_ok(
  $$
    insert into private.data_archive_package_members (
      id, package_id, member_kind, storage_bucket, storage_object_name,
      content_type, content_checksum, size_bytes
    ) values (
      'da000004-0000-4000-8000-000000000004',
      'da000003-0000-4000-8000-000000000003',
      'rows-json',
      'api-connection-artifacts',
      'runs/00000000-0000-4000-8000-000000000001/rows.json',
      'application/json',
      repeat('5', 64),
      2048
    )
  $$,
  'a package member records identity and checksum without a body'
);

select throws_ok(
  $$
    update private.data_archive_package_members
    set content_checksum = repeat('6', 64)
    where id = 'da000004-0000-4000-8000-000000000004'
  $$,
  'P0001',
  'Data archive package member identity and evidence are immutable.',
  'member evidence cannot be rewritten'
);

select lives_ok(
  $$
    update private.data_archive_package_members
    set hot_state = 'deleting', updated_at = now()
    where id = 'da000004-0000-4000-8000-000000000004'
  $$,
  'member lifecycle can advance without rewriting evidence'
);

select throws_ok(
  $$
    insert into private.data_archive_prune_plans (
      plan_key, plan_checksum, source_state_checksum, status,
      approved_by_owner_id, approved_at
    ) values (
      'prune:invalid:001', repeat('7', 64), repeat('8', 64), 'approved', null, now()
    )
  $$,
  '23514',
  null,
  'approved prune plans require an actor'
);

select lives_ok(
  $$
    insert into private.data_archive_prune_plans (
      id, plan_key, plan_checksum, source_state_checksum, item_count, total_bytes
    ) values (
      'da000005-0000-4000-8000-000000000005',
      'prune:2026-08-27:001', repeat('9', 64), repeat('a', 64), 1, 2048
    )
  $$,
  'a deterministic draft prune plan can be recorded'
);

select lives_ok(
  $$
    insert into private.data_archive_prune_items (
      plan_id, package_id, package_member_id, item_kind,
      item_identifier, size_bytes
    ) values (
      'da000005-0000-4000-8000-000000000005',
      'da000003-0000-4000-8000-000000000003',
      'da000004-0000-4000-8000-000000000004',
      'storage-object',
      'api-connection-artifacts:runs/00000000-0000-4000-8000-000000000001/rows.json',
      2048
    )
  $$,
  'a prune item is bound to an exact package member'
);

select lives_ok(
  $$
    update private.data_archive_package_members
    set hot_state = 'cold', updated_at = now()
    where id = 'da000004-0000-4000-8000-000000000004'
  $$,
  'all package members can become cold after exact deletion'
);

select lives_ok(
  $$
    update private.data_archive_packages
    set
      status = 'cold',
      restore_verified_at = '2026-08-27T09:10:00Z',
      pruned_at = '2026-08-27T09:11:00Z',
      updated_at = now()
    where id = 'da000003-0000-4000-8000-000000000003'
  $$,
  'a restore-verified package can become cold'
);

select lives_ok(
  $$
    insert into private.data_archive_rehydrations (
      id, request_key, package_id, target_identifier,
      manifest_checksum, requested_by_owner_id
    ) values (
      'da000006-0000-4000-8000-000000000006',
      'rehydrate:2026-08-27:001',
      'da000003-0000-4000-8000-000000000003',
      'api-run:00000000-0000-4000-8000-000000000001:rehydrated',
      repeat('3', 64),
      'test-operator'
    )
  $$,
  'a cold package can begin an explicit rehydration'
);

select throws_ok(
  $$
    update private.data_archive_rehydrations
    set status = 'verified'
    where id = 'da000006-0000-4000-8000-000000000006'
  $$,
  '23514',
  null,
  'rehydration cannot verify without a completion timestamp'
);

select lives_ok(
  $$
    update private.data_archive_rehydrations
    set status = 'verified', completed_at = now(), updated_at = now()
    where id = 'da000006-0000-4000-8000-000000000006'
  $$,
  'rehydration can verify with terminal evidence'
);

select lives_ok(
  $$
    update private.data_archive_package_members
    set
      hot_state = 'rehydrated',
      rehydrated_storage_object_name = 'rehydrated/00000000-0000-4000-8000-000000000001/rows.json',
      updated_at = now()
    where id = 'da000004-0000-4000-8000-000000000004'
  $$,
  'a verified restore records a collision-free member identity'
);

select lives_ok(
  $$
    update private.data_archive_packages
    set status = 'rehydrated', rehydrated_at = now(), updated_at = now()
    where id = 'da000003-0000-4000-8000-000000000003'
  $$,
  'a cold package can record successful rehydration'
);

select ok(
  exists(
    select 1
    from pg_trigger
    where tgrelid = 'private.data_archive_packages'::regclass
      and tgname = 'data_archive_packages_immutable_evidence'
      and not tgisinternal
  ),
  'archive packages have an immutable evidence trigger'
);

select ok(
  exists(
    select 1
    from pg_trigger
    where tgrelid = 'private.data_archive_package_members'::regclass
      and tgname = 'data_archive_package_members_immutable_evidence'
      and not tgisinternal
  ),
  'archive package members have an immutable evidence trigger'
);

select ok(
  exists(
    select 1
    from pg_trigger
    where tgrelid = 'private.dataset_forming_runs'::regclass
      and tgname = 'dataset_forming_runs_require_hot_archive_source'
      and not tgisinternal
  ),
  'new downstream forming work is guarded by archive hot state'
);

select ok(
  exists(
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname = 'guard_data_archive_api_source_dependency'
      and pg_proc.prosecdef
      and pg_proc.proconfig @> array['search_path=""']
  ),
  'archive dependency guard is a locked-search-path security definer'
);

select * from finish();

rollback;
