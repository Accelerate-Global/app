begin;

create extension if not exists pgtap with schema extensions;

select plan(49);

select has_table(
  'private',
  'dataset_storage_path_claims',
  'dataset storage paths have a permanent ownership ledger'
);

select has_index(
  'public',
  'datasets',
  'datasets_blob_path_unique_idx',
  'current dataset paths are unique'
);

select has_table(
  'private',
  'dataset_storage_path_owners',
  'storage paths have an atomic permanent owner-set gate'
);

select has_table(
  'private',
  'dataset_identity_claims',
  'dataset identifiers have an atomic permanent tombstone ledger'
);

select has_trigger(
  'public',
  'datasets',
  'datasets_enforce_id_immutability',
  'dataset identifiers are database immutable'
);

select has_trigger(
  'public',
  'datasets',
  'datasets_claim_storage_path',
  'current dataset writes claim storage ownership'
);

select has_trigger(
  'public',
  'dataset_versions',
  'dataset_versions_claim_storage_path',
  'archived dataset versions claim storage ownership'
);

select has_trigger(
  'public',
  'datasets',
  'datasets_pipeline_managed_guard',
  'pipeline-owned dataset metadata is database guarded'
);

select has_trigger(
  'public',
  'dataset_rows',
  'dataset_rows_pipeline_managed_guard',
  'pipeline-owned current rows are database guarded'
);

select has_trigger(
  'public',
  'dataset_versions',
  'dataset_versions_pipeline_managed_guard',
  'pipeline-owned version evidence is database guarded'
);

select has_trigger(
  'public',
  'dataset_version_rows',
  'dataset_version_rows_pipeline_managed_guard',
  'pipeline-owned version rows are database guarded'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.authorize_pipeline_dataset_mutation()',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot mint a publication transaction capability'
);

select is(
  has_function_privilege(
    'service_role',
    'private.authorize_pipeline_dataset_mutation()',
    'EXECUTE'
  ),
  false,
  'service-role clients cannot mint a publication transaction capability'
);

insert into public.signup_email_allowlist (email, note)
values (
  'pipeline-integrity-admin@example.com',
  'Dataset integrity pgTAP fixture'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '99000000-0000-4000-8000-000000000099',
  'authenticated',
  'authenticated',
  'pipeline-integrity-admin@example.com',
  '',
  now(),
  '{"provider":"email","providers":["email"],"workspace_role":"admin"}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.datasets (
  id, owner_id, file_name, blob_url, blob_path, current_version_action,
  current_version_actor_owner_id, current_version_actor_email,
  current_version_created_at, is_primary, is_workspace_visible, status,
  row_count, size_bytes, columns, hidden_column_keys, tags
) values
(
  '99000000-0000-4000-8000-000000000001',
  'pipeline-integrity-test',
  'pipeline.csv',
  'https://example.invalid/pipeline.csv',
  'datasets/csv/pipeline-integrity-current.csv',
  'api_import',
  'pipeline-integrity-test',
  'pipeline-integrity-admin@example.com',
  now(),
  false,
  true,
  'ready',
  1,
  10,
  '[{"key":"name","label":"Name","sourceIndex":0}]'::jsonb,
  '[]'::jsonb,
  '[{"id":"classification","label":"PGIC","color":"#078bc9"}]'::jsonb
),
(
  '99000000-0000-4000-8000-000000000002',
  'pipeline-integrity-test',
  'manual.csv',
  'https://example.invalid/manual.csv',
  'datasets/csv/pipeline-integrity-manual.csv',
  'upload',
  'pipeline-integrity-test',
  'pipeline-integrity-admin@example.com',
  now(),
  false,
  true,
  'ready',
  1,
  10,
  '[{"key":"name","label":"Name","sourceIndex":0}]'::jsonb,
  '[]'::jsonb,
  '[{"id":"classification","label":"PGAC","color":"#fcab2a"}]'::jsonb
),
(
  '99000000-0000-4000-8000-000000000007',
  'pipeline-integrity-test',
  'new-owner.csv',
  'https://example.invalid/new-owner.csv',
  'datasets/csv/pipeline-integrity-new-owner.csv',
  'upload',
  'pipeline-integrity-test',
  'pipeline-integrity-admin@example.com',
  now(),
  false,
  true,
  'ready',
  0,
  10,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb
);

insert into private.dataset_storage_path_claims (
  storage_path,
  dataset_id
) values
(
  'datasets/csv/pipeline-integrity-grandfathered-alias.csv',
  '99000000-0000-4000-8000-000000000001'
),
(
  'datasets/csv/pipeline-integrity-grandfathered-alias.csv',
  '99000000-0000-4000-8000-000000000002'
);

insert into private.dataset_storage_path_owners (
  storage_path,
  owner_dataset_ids,
  is_grandfathered
) values (
  'datasets/csv/pipeline-integrity-grandfathered-alias.csv',
  array[
    '99000000-0000-4000-8000-000000000001'::uuid,
    '99000000-0000-4000-8000-000000000002'::uuid
  ],
  true
);

select is(
  (
    select count(*)::bigint
    from private.dataset_storage_path_claims
    where storage_path =
      'datasets/csv/pipeline-integrity-grandfathered-alias.csv'
  ),
  2::bigint,
  'the permanent ledger preserves every pre-migration historical owner'
);

select lives_ok(
  $$
    insert into public.datasets (
      id, owner_id, file_name, blob_url, blob_path, current_version_action,
      current_version_actor_owner_id, current_version_actor_email,
      current_version_created_at, is_primary, is_workspace_visible, status,
      row_count, size_bytes, columns, hidden_column_keys, tags
    ) values (
      '99000000-0000-4000-8000-000000000007',
      'pipeline-integrity-test',
      'skipped-insert-arm.csv',
      'https://example.invalid/skipped-insert-arm.csv',
      'datasets/csv/pipeline-integrity-skipped-insert-arm.csv',
      'upload',
      'pipeline-integrity-test',
      'pipeline-integrity-admin@example.com',
      now(),
      false,
      true,
      'ready',
      0,
      10,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    )
    on conflict (id) do update
    set file_name = 'updated-upsert-arm.csv',
        blob_url = 'https://example.invalid/updated-upsert-arm.csv',
        blob_path = 'datasets/csv/pipeline-integrity-updated-upsert-arm.csv'
  $$,
  'an existing dataset ID can use its legitimate upsert update arm'
);

select is(
  (
    select pg_catalog.jsonb_build_object(
      'skipped_insert',
      count(*) filter (
        where storage_path =
          'datasets/csv/pipeline-integrity-skipped-insert-arm.csv'
      ),
      'updated_path',
      count(*) filter (
        where storage_path =
          'datasets/csv/pipeline-integrity-updated-upsert-arm.csv'
      )
    )
    from private.dataset_storage_path_claims
  ),
  '{"skipped_insert":0,"updated_path":1}'::jsonb,
  'the upsert claims only the path committed by its update arm'
);

insert into public.datasets (
  id, owner_id, file_name, blob_url, blob_path, current_version_action,
  current_version_actor_owner_id, current_version_actor_email,
  current_version_created_at, is_primary, is_workspace_visible, status,
  row_count, size_bytes, columns, hidden_column_keys, tags
) values (
  '99000000-0000-4000-8000-000000000005',
  'pipeline-integrity-test',
  'tombstoned.csv',
  'https://example.invalid/tombstoned.csv',
  'datasets/csv/pipeline-integrity-tombstoned.csv',
  'upload',
  'pipeline-integrity-test',
  'pipeline-integrity-admin@example.com',
  now(),
  false,
  true,
  'ready',
  0,
  10,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb
);

delete from public.datasets
where id = '99000000-0000-4000-8000-000000000005';

insert into public.dataset_rows (
  id, dataset_id, row_index, data
) values
(
  '99000000-0000-4000-8000-000000000101',
  '99000000-0000-4000-8000-000000000001',
  0,
  '{"name":"Pipeline"}'::jsonb
),
(
  '99000000-0000-4000-8000-000000000102',
  '99000000-0000-4000-8000-000000000002',
  0,
  '{"name":"Manual"}'::jsonb
);

insert into public.dataset_versions (
  id, dataset_id, file_name, blob_url, blob_path, action, actor_owner_id,
  actor_email, status, row_count, size_bytes, columns, version_created_at
) values
(
  '99000000-0000-4000-8000-000000000201',
  '99000000-0000-4000-8000-000000000001',
  'pipeline-archive.csv',
  'https://example.invalid/pipeline-archive.csv',
  'datasets/csv/pipeline-integrity-archive.csv',
  'replace',
  'pipeline-integrity-test',
  'pipeline-integrity-admin@example.com',
  'ready',
  1,
  10,
  '[{"key":"name","label":"Name","sourceIndex":0}]'::jsonb,
  now()
),
(
  '99000000-0000-4000-8000-000000000202',
  '99000000-0000-4000-8000-000000000002',
  'manual-archive.csv',
  'https://example.invalid/manual-archive.csv',
  'datasets/csv/pipeline-integrity-manual-archive.csv',
  'replace',
  'pipeline-integrity-test',
  'pipeline-integrity-admin@example.com',
  'ready',
  1,
  10,
  '[{"key":"name","label":"Name","sourceIndex":0}]'::jsonb,
  now()
);

insert into public.dataset_versions (
  id, dataset_id, file_name, blob_url, blob_path, action, actor_owner_id,
  actor_email, status, row_count, size_bytes, columns, version_created_at
) values (
  '99000000-0000-4000-8000-000000000202',
  '99000000-0000-4000-8000-000000000002',
  'skipped-version.csv',
  'https://example.invalid/skipped-version.csv',
  'datasets/csv/pipeline-integrity-skipped-version.csv',
  'replace',
  'pipeline-integrity-test',
  'pipeline-integrity-admin@example.com',
  'ready',
  0,
  10,
  '[]'::jsonb,
  now()
)
on conflict (id) do nothing;

select is(
  (
    select count(*)::bigint
    from private.dataset_storage_path_claims
    where storage_path = 'datasets/csv/pipeline-integrity-skipped-version.csv'
  ),
  0::bigint,
  'a skipped dataset-version insert cannot leave a permanent ghost claim'
);

insert into public.dataset_version_rows (
  id, version_id, row_index, data
) values
(
  '99000000-0000-4000-8000-000000000301',
  '99000000-0000-4000-8000-000000000201',
  0,
  '{"name":"Pipeline archive"}'::jsonb
),
(
  '99000000-0000-4000-8000-000000000302',
  '99000000-0000-4000-8000-000000000202',
  0,
  '{"name":"Manual archive"}'::jsonb
);

insert into private.pipeline_publications (
  id, producer_kind, producer_run_id, dataset_id, output_checksum, row_count,
  artifact_manifest, actor_owner_id, reason, publication_target_key
) values (
  '99000000-0000-4000-8000-000000000401',
  'tier1-merge',
  '99000000-0000-4000-8000-000000000402',
  '99000000-0000-4000-8000-000000000001',
  repeat('a', 64),
  1,
  '{}'::jsonb,
  'pipeline-integrity-test',
  'Pipeline integrity fixture',
  'tier1-integrity'
);

select set_config(
  'request.jwt.claim.sub',
  '99000000-0000-4000-8000-000000000099',
  true
);
set local role authenticated;

select lives_ok(
  $$
    update public.datasets
    set file_name = 'manual-renamed.csv'
    where id = '99000000-0000-4000-8000-000000000002'
  $$,
  'dataset-admin RLS permits ordinary dataset metadata updates'
);

select throws_ok(
  $$
    update public.datasets
    set id = '99000000-0000-4000-8000-000000000006'
    where id = '99000000-0000-4000-8000-000000000002'
  $$,
  '23514',
  'Dataset identifiers are immutable.',
  'an authenticated admin cannot replace a manual dataset identity'
);

select throws_ok(
  $$
    update public.datasets
    set id = '99000000-0000-4000-8000-000000000005',
        blob_path = 'datasets/csv/pipeline-integrity-tombstoned.csv'
    where id = '99000000-0000-4000-8000-000000000002'
  $$,
  '23514',
  'Dataset identifiers are immutable.',
  'a manual dataset cannot assume a deleted identity and its tombstoned path'
);

select throws_ok(
  $$
    update public.datasets
    set tags = '[{"id":"classification","label":"PGAC","color":"#fcab2a"}]'::jsonb
    where id = '99000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'Pipeline-managed datasets can only be changed through the trusted dataset server.',
  'authenticated admins cannot change pipeline classification or tags directly'
);

select throws_ok(
  $$
    update public.datasets
    set is_public = false
    where id = '99000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'Pipeline-managed datasets can only be changed through the trusted dataset server.',
  'legacy visibility cannot bypass the pipeline dataset guard'
);

select throws_ok(
  $$ delete from public.datasets where id = '99000000-0000-4000-8000-000000000001' $$,
  '42501',
  'Pipeline-managed datasets can only be changed through the trusted dataset server.',
  'authenticated admins cannot delete pipeline datasets directly'
);

select throws_ok(
  $$
    insert into public.dataset_rows (dataset_id, row_index, data)
    values (
      '99000000-0000-4000-8000-000000000001',
      1,
      '{"name":"Forged"}'::jsonb
    )
  $$,
  '42501',
  'Pipeline-managed dataset rows can only be changed through the trusted publication or rollback service.',
  'authenticated admins cannot append pipeline rows directly'
);

select throws_ok(
  $$
    update public.dataset_rows
    set dataset_id = '99000000-0000-4000-8000-000000000002'
    where id = '99000000-0000-4000-8000-000000000101'
  $$,
  '42501',
  'Pipeline-managed dataset rows can only be changed through the trusted publication or rollback service.',
  'pipeline rows cannot escape protection by moving to a manual parent'
);

select throws_ok(
  $$ delete from public.dataset_rows where id = '99000000-0000-4000-8000-000000000101' $$,
  '42501',
  'Pipeline-managed dataset rows can only be changed through the trusted publication or rollback service.',
  'authenticated admins cannot delete pipeline rows directly'
);

select throws_ok(
  $$
    insert into public.dataset_versions (
      dataset_id, file_name, blob_url, blob_path, action, actor_owner_id,
      status, row_count, size_bytes, columns, version_created_at
    ) values (
      '99000000-0000-4000-8000-000000000001',
      'forged.csv',
      'https://example.invalid/forged.csv',
      'datasets/csv/pipeline-integrity-forged-version.csv',
      'replace',
      'pipeline-integrity-test',
      'ready',
      1,
      10,
      '[{"key":"name","label":"Name","sourceIndex":0}]'::jsonb,
      now()
    )
  $$,
  '42501',
  'Pipeline-managed dataset version evidence is immutable outside the trusted publication or rollback service.',
  'authenticated admins cannot append pipeline versions directly'
);

select throws_ok(
  $$
    update public.dataset_versions
    set dataset_id = '99000000-0000-4000-8000-000000000002',
        blob_path = 'datasets/csv/pipeline-integrity-manual.csv'
    where id = '99000000-0000-4000-8000-000000000201'
  $$,
  '42501',
  'Pipeline-managed dataset version evidence is immutable outside the trusted publication or rollback service.',
  'pipeline versions cannot escape protection by moving to a manual parent'
);

select throws_ok(
  $$ delete from public.dataset_versions where id = '99000000-0000-4000-8000-000000000201' $$,
  '42501',
  'Pipeline-managed dataset version evidence is immutable outside the trusted publication or rollback service.',
  'authenticated admins cannot delete pipeline versions directly'
);

select throws_ok(
  $$
    insert into public.dataset_version_rows (version_id, row_index, data)
    values (
      '99000000-0000-4000-8000-000000000201',
      1,
      '{"name":"Forged archive row"}'::jsonb
    )
  $$,
  '42501',
  'Pipeline-managed dataset version rows are immutable outside the trusted publication or rollback service.',
  'authenticated admins cannot append pipeline version rows directly'
);

select throws_ok(
  $$
    update public.dataset_version_rows
    set version_id = '99000000-0000-4000-8000-000000000202'
    where id = '99000000-0000-4000-8000-000000000301'
  $$,
  '42501',
  'Pipeline-managed dataset version rows are immutable outside the trusted publication or rollback service.',
  'pipeline version rows cannot escape protection by moving to a manual version'
);

select throws_ok(
  $$ delete from public.dataset_version_rows where id = '99000000-0000-4000-8000-000000000301' $$,
  '42501',
  'Pipeline-managed dataset version rows are immutable outside the trusted publication or rollback service.',
  'authenticated admins cannot delete pipeline version rows directly'
);

reset role;
set local role service_role;

select throws_ok(
  $$
    update public.datasets
    set status = 'failed'
    where id = '99000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'Pipeline-managed datasets can only be changed through the trusted dataset server.',
  'service-role clients cannot bypass pipeline dataset protection'
);

select throws_ok(
  $$
    update public.dataset_rows
    set dataset_id = '99000000-0000-4000-8000-000000000002'
    where id = '99000000-0000-4000-8000-000000000101'
  $$,
  '42501',
  'Pipeline-managed dataset rows can only be changed through the trusted publication or rollback service.',
  'service-role clients cannot reparent protected rows'
);

reset role;

select set_config('app.pipeline_dataset_mutation_txid', '', true);

select is(
  private.is_pipeline_dataset_mutation_authorized(),
  false,
  'the trusted server starts fail-closed without a transaction capability'
);

select throws_ok(
  $$
    update public.datasets
    set status = 'failed'
    where id = '99000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'Pipeline-managed dataset content, classification, visibility, and lineage can only be changed through an authorized publication or rollback transaction.',
  'trusted server writes still require explicit transaction authorization'
);

select lives_ok(
  $$ select private.authorize_pipeline_dataset_mutation() $$,
  'the direct trusted server can authorize the current publication transaction'
);

select lives_ok(
  $$
    update public.datasets
    set tags = '[{"id":"classification","label":"PGAC","color":"#fcab2a"}]'::jsonb
    where id = '99000000-0000-4000-8000-000000000001'
  $$,
  'an authorized publication transaction can update protected dataset metadata'
);

select lives_ok(
  $$
    update public.dataset_rows
    set data = '{"name":"Published replacement"}'::jsonb
    where id = '99000000-0000-4000-8000-000000000101'
  $$,
  'an authorized publication transaction can update protected rows'
);

select set_config('app.pipeline_dataset_mutation_txid', '', true);

select throws_ok(
  $$
    update public.dataset_rows
    set data = '{"name":"Unauthorized"}'::jsonb
    where id = '99000000-0000-4000-8000-000000000101'
  $$,
  '42501',
  'Pipeline-managed dataset rows can only be changed through the trusted publication or rollback service.',
  'clearing the transaction capability immediately restores fail-closed guards'
);

select throws_ok(
  $$
    insert into public.datasets (
      id, owner_id, file_name, blob_url, blob_path, current_version_action,
      current_version_actor_owner_id, is_primary, is_workspace_visible,
      status, row_count, size_bytes, columns, hidden_column_keys, tags
    ) values (
      '99000000-0000-4000-8000-000000000003',
      'pipeline-integrity-test',
      'alias.csv',
      'https://example.invalid/alias.csv',
      'datasets/csv/pipeline-integrity-manual.csv',
      'upload',
      'pipeline-integrity-test',
      false,
      true,
      'ready',
      0,
      10,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "datasets_blob_path_unique_idx"',
  'a current path cannot be aliased by another dataset'
);

select throws_ok(
  $$
    insert into public.dataset_versions (
      dataset_id, file_name, blob_url, blob_path, action, actor_owner_id,
      status, row_count, size_bytes, columns, version_created_at
    ) values (
      '99000000-0000-4000-8000-000000000002',
      'alias-version.csv',
      'https://example.invalid/alias-version.csv',
      'datasets/csv/pipeline-integrity-archive.csv',
      'replace',
      'pipeline-integrity-test',
      'ready',
      0,
      10,
      '[]'::jsonb,
      now()
    )
  $$,
  '23505',
  'Dataset storage path is already owned by another dataset.',
  'an archived path cannot be aliased by another dataset'
);

select lives_ok(
  $$
    insert into public.dataset_versions (
      dataset_id, file_name, blob_url, blob_path, action, actor_owner_id,
      status, row_count, size_bytes, columns, version_created_at
    ) values (
      '99000000-0000-4000-8000-000000000002',
      'same-owner-version.csv',
      'https://example.invalid/same-owner-version.csv',
      'datasets/csv/pipeline-integrity-manual.csv',
      'replace',
      'pipeline-integrity-test',
      'ready',
      0,
      10,
      '[]'::jsonb,
      now()
    )
  $$,
  'a dataset version can retain a path already owned by its current dataset'
);

select lives_ok(
  $$
    insert into public.dataset_versions (
      dataset_id, file_name, blob_url, blob_path, action, actor_owner_id,
      status, row_count, size_bytes, columns, version_created_at
    ) values (
      '99000000-0000-4000-8000-000000000002',
      'grandfathered-owner-version.csv',
      'https://example.invalid/grandfathered-owner-version.csv',
      'datasets/csv/pipeline-integrity-grandfathered-alias.csv',
      'replace',
      'pipeline-integrity-test',
      'ready',
      0,
      10,
      '[]'::jsonb,
      now()
    )
  $$,
  'a grandfathered owner can reuse its own historical alias'
);

select throws_ok(
  $$
    insert into public.dataset_versions (
      dataset_id, file_name, blob_url, blob_path, action, actor_owner_id,
      status, row_count, size_bytes, columns, version_created_at
    ) values (
      '99000000-0000-4000-8000-000000000007',
      'new-alias-owner-version.csv',
      'https://example.invalid/new-alias-owner-version.csv',
      'datasets/csv/pipeline-integrity-grandfathered-alias.csv',
      'replace',
      'pipeline-integrity-test',
      'ready',
      0,
      10,
      '[]'::jsonb,
      now()
    )
  $$,
  '23505',
  'Dataset storage path is already owned by another dataset.',
  'a new dataset cannot join a grandfathered historical alias'
);

delete from public.datasets
where id = '99000000-0000-4000-8000-000000000002';

select is(
  (
    select count(*)::bigint
    from private.dataset_storage_path_claims
    where storage_path =
      'datasets/csv/pipeline-integrity-grandfathered-alias.csv'
  ),
  2::bigint,
  'deleting one historical owner preserves every permanent alias claim'
);

select throws_ok(
  $$
    insert into public.datasets (
      id, owner_id, file_name, blob_url, blob_path, current_version_action,
      current_version_actor_owner_id, is_primary, is_workspace_visible,
      status, row_count, size_bytes, columns, hidden_column_keys, tags
    ) values (
      '99000000-0000-4000-8000-000000000002',
      'pipeline-integrity-test',
      'recreated.csv',
      'https://example.invalid/recreated.csv',
      'datasets/csv/pipeline-integrity-recreated.csv',
      'upload',
      'pipeline-integrity-test',
      false,
      true,
      'ready',
      0,
      10,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    )
  $$,
  '23505',
  'Dataset identifiers with historical storage claims cannot be reused.',
  'a deleted dataset identifier cannot be recreated to revive tombstoned paths'
);

select throws_ok(
  $$
    insert into public.datasets (
      id, owner_id, file_name, blob_url, blob_path, current_version_action,
      current_version_actor_owner_id, is_primary, is_workspace_visible,
      status, row_count, size_bytes, columns, hidden_column_keys, tags
    ) values (
      '99000000-0000-4000-8000-000000000004',
      'pipeline-integrity-test',
      'reused-path.csv',
      'https://example.invalid/reused-path.csv',
      'datasets/csv/pipeline-integrity-manual.csv',
      'upload',
      'pipeline-integrity-test',
      false,
      true,
      'ready',
      0,
      10,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    )
  $$,
  '23505',
  'Dataset storage path is already owned by another dataset.',
  'a deleted dataset path remains permanently claimed'
);

select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name in (
        'dataset_storage_path_claims',
        'dataset_storage_path_owners',
        'dataset_identity_claims'
      )
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ),
  0::bigint,
  'browser and service roles have no direct claim-ledger privileges'
);

select * from finish();
rollback;
