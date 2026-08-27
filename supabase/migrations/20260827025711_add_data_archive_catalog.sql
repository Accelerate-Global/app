do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'data_archive_backup_reader') then
    create role data_archive_backup_reader
      login
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      bypassrls;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'data_archive_backup_reader'
      and rolcanlogin
      and not rolinherit
      and not rolsuper
      and not rolcreatedb
      and not rolcreaterole
      and not rolreplication
      and rolbypassrls
  ) then
    raise exception 'Existing data_archive_backup_reader role is not safely constrained.';
  end if;
end
$$;

alter role data_archive_backup_reader set default_transaction_read_only = on;
alter role data_archive_backup_reader set statement_timeout = '15min';
alter role data_archive_backup_reader set lock_timeout = '5s';
alter role data_archive_backup_reader set idle_in_transaction_session_timeout = '1min';
alter role data_archive_backup_reader set search_path = 'pg_catalog';

grant connect on database postgres to data_archive_backup_reader;
grant usage on schema public, private, supabase_migrations to data_archive_backup_reader;
grant select on all tables in schema public, private, supabase_migrations to data_archive_backup_reader;
grant usage, select on all sequences in schema public, private, supabase_migrations to data_archive_backup_reader;

alter default privileges for role postgres in schema public
  grant select on tables to data_archive_backup_reader;
alter default privileges for role postgres in schema private
  grant select on tables to data_archive_backup_reader;
alter default privileges for role postgres in schema supabase_migrations
  grant select on tables to data_archive_backup_reader;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to data_archive_backup_reader;
alter default privileges for role postgres in schema private
  grant usage, select on sequences to data_archive_backup_reader;
alter default privileges for role postgres in schema supabase_migrations
  grant usage, select on sequences to data_archive_backup_reader;

create or replace function private.data_archive_export_managed_rows(export_schema text)
returns table(source_table text, source_ordinal bigint, row_data jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  relation_name text;
begin
  if session_user <> 'data_archive_backup_reader' or auth.uid() is not null then
    raise exception 'Archive export access denied.' using errcode = '42501';
  end if;

  if export_schema not in ('auth', 'storage') then
    raise exception 'Archive export schema is not allowed.' using errcode = '22023';
  end if;

  for relation_name in
    select tables.table_name
    from information_schema.tables
    where tables.table_schema = export_schema
      and tables.table_type = 'BASE TABLE'
    order by tables.table_name
  loop
    return query execute format(
      'select %L::text, row_number() over (order by to_jsonb(source_row)::text)::bigint, to_jsonb(source_row) from %I.%I as source_row',
      relation_name,
      export_schema,
      relation_name
    );
  end loop;
end;
$$;

comment on function private.data_archive_export_managed_rows(text) is
  'Read-only, session-bound export of managed Auth or Storage metadata for the Samson archive. Never expose through the Data API.';

revoke all on function private.data_archive_export_managed_rows(text) from public, anon, authenticated, service_role;
grant execute on function private.data_archive_export_managed_rows(text) to data_archive_backup_reader;

drop policy if exists "data archive reader can select storage objects" on storage.objects;
create policy "data archive reader can select storage objects"
on storage.objects
for select
to authenticated
using (
  (select auth.jwt()->'app_metadata'->>'data_archive_role') = 'reader'
);

create table private.data_archive_backup_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  status text not null default 'running',
  source_project_ref text not null,
  source_database_version text not null,
  migration_checksum text not null,
  manifest_checksum text,
  restic_snapshot_id text,
  database_bytes bigint not null default 0,
  storage_bytes bigint not null default 0,
  storage_object_count integer not null default 0,
  database_usage_bytes bigint,
  storage_usage_bytes bigint,
  archive_allocated_bytes bigint,
  unique_bytes_added bigint,
  compression_ratio numeric(12, 4),
  deduplication_ratio numeric(12, 4),
  failure_code text,
  started_at timestamptz not null,
  completed_at timestamptz,
  integrity_verified_at timestamptz,
  receipt_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_archive_backup_runs_key_check
    check (char_length(run_key) between 8 and 160 and run_key ~ '^[a-zA-Z0-9._:-]+$'),
  constraint data_archive_backup_runs_status_check
    check (status in ('running', 'verified', 'failed')),
  constraint data_archive_backup_runs_project_check
    check (char_length(source_project_ref) between 8 and 80 and source_project_ref ~ '^[a-z0-9]+$'),
  constraint data_archive_backup_runs_db_version_check
    check (char_length(source_database_version) between 1 and 80),
  constraint data_archive_backup_runs_migration_checksum_check
    check (migration_checksum ~ '^[0-9a-f]{64}$'),
  constraint data_archive_backup_runs_manifest_checksum_check
    check (manifest_checksum is null or manifest_checksum ~ '^[0-9a-f]{64}$'),
  constraint data_archive_backup_runs_snapshot_check
    check (restic_snapshot_id is null or restic_snapshot_id ~ '^[0-9a-f]{8,64}$'),
  constraint data_archive_backup_runs_sizes_check
    check (
      database_bytes >= 0
      and storage_bytes >= 0
      and storage_object_count >= 0
      and (database_usage_bytes is null or database_usage_bytes >= 0)
      and (storage_usage_bytes is null or storage_usage_bytes >= 0)
      and (archive_allocated_bytes is null or archive_allocated_bytes >= 0)
      and (unique_bytes_added is null or unique_bytes_added >= 0)
      and (compression_ratio is null or compression_ratio > 0)
      and (deduplication_ratio is null or deduplication_ratio > 0)
    ),
  constraint data_archive_backup_runs_failure_code_check
    check (
      failure_code is null
      or (char_length(failure_code) between 2 and 128 and failure_code ~ '^[a-z0-9._-]+$')
    ),
  constraint data_archive_backup_runs_terminal_check
    check (
      (status = 'running' and completed_at is null)
      or (status = 'verified' and completed_at is not null and integrity_verified_at is not null and manifest_checksum is not null and restic_snapshot_id is not null and failure_code is null)
      or (status = 'failed' and completed_at is not null and failure_code is not null)
    )
);

create index data_archive_backup_runs_started_idx
  on private.data_archive_backup_runs(started_at desc, id);
create index data_archive_backup_runs_status_idx
  on private.data_archive_backup_runs(status, started_at desc);

comment on table private.data_archive_backup_runs is
  'Compact, sanitized Samson backup run receipts. Contains no payload bodies, credentials, local paths, recipient addresses, or recovery keys.';

create table private.data_archive_receipts (
  id uuid primary key default gen_random_uuid(),
  backup_run_id uuid not null references private.data_archive_backup_runs(id) on delete restrict,
  receipt_key text not null unique,
  nonce text not null unique,
  issued_at timestamptz not null,
  signature_digest text not null,
  payload_checksum text not null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint data_archive_receipts_key_check
    check (char_length(receipt_key) between 8 and 160 and receipt_key ~ '^[a-zA-Z0-9._:-]+$'),
  constraint data_archive_receipts_nonce_check
    check (char_length(nonce) between 16 and 128 and nonce ~ '^[a-zA-Z0-9._:-]+$'),
  constraint data_archive_receipts_signature_check
    check (signature_digest ~ '^[0-9a-f]{64}$'),
  constraint data_archive_receipts_payload_checksum_check
    check (payload_checksum ~ '^[0-9a-f]{64}$'),
  constraint data_archive_receipts_time_check
    check (issued_at <= received_at + interval '1 minute')
);

create index data_archive_receipts_run_idx
  on private.data_archive_receipts(backup_run_id, received_at desc);

create table private.data_archive_packages (
  id uuid primary key default gen_random_uuid(),
  backup_run_id uuid not null references private.data_archive_backup_runs(id) on delete restrict,
  package_key text not null unique,
  package_kind text not null,
  source_identifier text not null,
  source_checksum text not null,
  manifest_checksum text not null,
  status text not null default 'verified',
  row_count bigint not null default 0,
  object_count integer not null default 0,
  size_bytes bigint not null default 0,
  archive_snapshot_id text not null,
  source_created_at timestamptz not null,
  integrity_verified_at timestamptz not null,
  restore_verified_at timestamptz,
  pruned_at timestamptz,
  rehydrated_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_archive_packages_key_check
    check (char_length(package_key) between 8 and 240 and package_key ~ '^[a-zA-Z0-9._:/-]+$'),
  constraint data_archive_packages_kind_check
    check (package_kind in ('api-run', 'dataset-version', 'tier1-publication', 'tier2-publication', 'project-snapshot')),
  constraint data_archive_packages_source_identifier_check
    check (char_length(source_identifier) between 1 and 240),
  constraint data_archive_packages_source_checksum_check
    check (source_checksum ~ '^[0-9a-f]{64}$'),
  constraint data_archive_packages_manifest_checksum_check
    check (manifest_checksum ~ '^[0-9a-f]{64}$'),
  constraint data_archive_packages_status_check
    check (status in ('verified', 'cold', 'rehydrating', 'rehydrated', 'failed')),
  constraint data_archive_packages_counts_check
    check (row_count >= 0 and object_count >= 0 and size_bytes >= 0),
  constraint data_archive_packages_snapshot_check
    check (archive_snapshot_id ~ '^[0-9a-f]{8,64}$'),
  constraint data_archive_packages_failure_code_check
    check (
      failure_code is null
      or (char_length(failure_code) between 2 and 128 and failure_code ~ '^[a-z0-9._-]+$')
    ),
  constraint data_archive_packages_state_check
    check (
      (status = 'verified' and pruned_at is null and rehydrated_at is null and failure_code is null)
      or (status = 'cold' and restore_verified_at is not null and pruned_at is not null and rehydrated_at is null and failure_code is null)
      or (status = 'rehydrating' and restore_verified_at is not null and pruned_at is not null and rehydrated_at is null and failure_code is null)
      or (status = 'rehydrated' and restore_verified_at is not null and pruned_at is not null and rehydrated_at is not null and failure_code is null)
      or (status = 'failed' and failure_code is not null)
    )
);

create index data_archive_packages_kind_source_idx
  on private.data_archive_packages(package_kind, source_identifier, source_created_at desc);
create index data_archive_packages_status_idx
  on private.data_archive_packages(status, source_created_at);
create index data_archive_packages_run_idx
  on private.data_archive_packages(backup_run_id, package_kind);

comment on table private.data_archive_packages is
  'Compact hot/cold catalog for content-addressed Samson packages. Payload bodies and local repository paths are never stored here.';

create table private.data_archive_package_members (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references private.data_archive_packages(id) on delete restrict,
  member_kind text not null,
  source_table text,
  source_identifier text,
  storage_bucket text,
  storage_object_name text,
  content_type text,
  content_checksum text not null,
  size_bytes bigint not null,
  hot_state text not null default 'hot',
  rehydrated_storage_object_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_archive_package_members_kind_check
    check (char_length(member_kind) between 2 and 80 and member_kind ~ '^[a-z0-9._-]+$'),
  constraint data_archive_package_members_source_table_check
    check (source_table is null or source_table ~ '^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$'),
  constraint data_archive_package_members_identity_check
    check (source_identifier is not null or (storage_bucket is not null and storage_object_name is not null)),
  constraint data_archive_package_members_bucket_check
    check (storage_bucket is null or (char_length(storage_bucket) between 1 and 100 and storage_bucket ~ '^[a-z0-9][a-z0-9._-]*$')),
  constraint data_archive_package_members_object_check
    check (storage_object_name is null or char_length(storage_object_name) between 1 and 1024),
  constraint data_archive_package_members_content_type_check
    check (content_type is null or char_length(content_type) <= 160),
  constraint data_archive_package_members_checksum_check
    check (content_checksum ~ '^[0-9a-f]{64}$'),
  constraint data_archive_package_members_size_check
    check (size_bytes >= 0),
  constraint data_archive_package_members_hot_state_check
    check (hot_state in ('hot', 'deleting', 'cold', 'rehydrated', 'failed')),
  constraint data_archive_package_members_rehydrated_path_check
    check (
      (hot_state = 'rehydrated' and rehydrated_storage_object_name is not null)
      or hot_state <> 'rehydrated'
    )
);

create unique index data_archive_package_members_identity_idx
  on private.data_archive_package_members(
    package_id,
    member_kind,
    coalesce(source_identifier, ''),
    coalesce(storage_bucket, ''),
    coalesce(storage_object_name, '')
  );
create index data_archive_package_members_package_idx
  on private.data_archive_package_members(package_id, hot_state, id);

create table private.data_archive_prune_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  plan_checksum text not null unique,
  source_state_checksum text not null,
  status text not null default 'draft',
  item_count integer not null default 0,
  total_bytes bigint not null default 0,
  approved_by_owner_id text,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_archive_prune_plans_key_check
    check (char_length(plan_key) between 8 and 160 and plan_key ~ '^[a-zA-Z0-9._:-]+$'),
  constraint data_archive_prune_plans_checksum_check
    check (plan_checksum ~ '^[0-9a-f]{64}$' and source_state_checksum ~ '^[0-9a-f]{64}$'),
  constraint data_archive_prune_plans_status_check
    check (status in ('draft', 'approved', 'executing', 'completed', 'failed', 'stale')),
  constraint data_archive_prune_plans_counts_check
    check (item_count >= 0 and total_bytes >= 0),
  constraint data_archive_prune_plans_failure_code_check
    check (failure_code is null or (char_length(failure_code) between 2 and 128 and failure_code ~ '^[a-z0-9._-]+$')),
  constraint data_archive_prune_plans_state_check
    check (
      (status = 'draft' and approved_at is null and started_at is null and completed_at is null and failure_code is null)
      or (status = 'approved' and approved_at is not null and approved_by_owner_id is not null and started_at is null and completed_at is null and failure_code is null)
      or (status = 'executing' and approved_at is not null and started_at is not null and completed_at is null and failure_code is null)
      or (status = 'completed' and approved_at is not null and started_at is not null and completed_at is not null and failure_code is null)
      or (status = 'failed' and completed_at is not null and failure_code is not null)
      or (status = 'stale' and completed_at is not null and failure_code is not null)
    )
);

create index data_archive_prune_plans_status_idx
  on private.data_archive_prune_plans(status, created_at desc);

create table private.data_archive_prune_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references private.data_archive_prune_plans(id) on delete cascade,
  package_id uuid not null references private.data_archive_packages(id) on delete restrict,
  package_member_id uuid references private.data_archive_package_members(id) on delete restrict,
  item_kind text not null,
  item_identifier text not null,
  size_bytes bigint not null default 0,
  status text not null default 'planned',
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_archive_prune_items_kind_check
    check (item_kind in ('database-row-set', 'storage-object')),
  constraint data_archive_prune_items_identifier_check
    check (char_length(item_identifier) between 1 and 1200),
  constraint data_archive_prune_items_size_check
    check (size_bytes >= 0),
  constraint data_archive_prune_items_status_check
    check (status in ('planned', 'deleting', 'deleted', 'failed', 'stale')),
  constraint data_archive_prune_items_failure_code_check
    check (failure_code is null or (char_length(failure_code) between 2 and 128 and failure_code ~ '^[a-z0-9._-]+$')),
  constraint data_archive_prune_items_state_check
    check ((status = 'failed' and failure_code is not null) or (status <> 'failed' and failure_code is null))
);

create unique index data_archive_prune_items_plan_identity_idx
  on private.data_archive_prune_items(plan_id, item_kind, item_identifier);
create index data_archive_prune_items_plan_status_idx
  on private.data_archive_prune_items(plan_id, status, id);

create table private.data_archive_rehydrations (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  package_id uuid not null references private.data_archive_packages(id) on delete restrict,
  status text not null default 'restoring',
  target_identifier text not null,
  manifest_checksum text not null,
  requested_by_owner_id text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_archive_rehydrations_key_check
    check (char_length(request_key) between 8 and 160 and request_key ~ '^[a-zA-Z0-9._:-]+$'),
  constraint data_archive_rehydrations_status_check
    check (status in ('restoring', 'verified', 'failed')),
  constraint data_archive_rehydrations_target_check
    check (char_length(target_identifier) between 1 and 240),
  constraint data_archive_rehydrations_manifest_checksum_check
    check (manifest_checksum ~ '^[0-9a-f]{64}$'),
  constraint data_archive_rehydrations_actor_check
    check (char_length(btrim(requested_by_owner_id)) between 1 and 255),
  constraint data_archive_rehydrations_failure_code_check
    check (failure_code is null or (char_length(failure_code) between 2 and 128 and failure_code ~ '^[a-z0-9._-]+$')),
  constraint data_archive_rehydrations_state_check
    check (
      (status = 'restoring' and completed_at is null and failure_code is null)
      or (status = 'verified' and completed_at is not null and failure_code is null)
      or (status = 'failed' and completed_at is not null and failure_code is not null)
    )
);

create index data_archive_rehydrations_package_idx
  on private.data_archive_rehydrations(package_id, started_at desc);

create or replace function private.guard_data_archive_immutable_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Verified data archive evidence is immutable.';
  end if;

  if old.backup_run_id is distinct from new.backup_run_id
    or old.package_key is distinct from new.package_key
    or old.package_kind is distinct from new.package_kind
    or old.source_identifier is distinct from new.source_identifier
    or old.source_checksum is distinct from new.source_checksum
    or old.manifest_checksum is distinct from new.manifest_checksum
    or old.row_count is distinct from new.row_count
    or old.object_count is distinct from new.object_count
    or old.size_bytes is distinct from new.size_bytes
    or old.archive_snapshot_id is distinct from new.archive_snapshot_id
    or old.source_created_at is distinct from new.source_created_at
    or old.integrity_verified_at is distinct from new.integrity_verified_at
  then
    raise exception 'Verified data archive package identity and evidence are immutable.';
  end if;

  if new.status = 'cold' and exists (
    select 1
    from private.data_archive_package_members as member
    where member.package_id = new.id
      and member.hot_state <> 'cold'
  ) then
    raise exception 'A data archive package cannot become cold while a member remains hot or incomplete.';
  end if;

  if new.status = 'rehydrated' and (
    exists (
      select 1
      from private.data_archive_package_members as member
      where member.package_id = new.id
        and member.hot_state <> 'rehydrated'
    )
    or not exists (
      select 1
      from private.data_archive_rehydrations as rehydration
      where rehydration.package_id = new.id
        and rehydration.status = 'verified'
        and rehydration.manifest_checksum = new.manifest_checksum
    )
  ) then
    raise exception 'A data archive package cannot become rehydrated without verified member recovery.';
  end if;

  return new;
end;
$$;

create trigger data_archive_packages_immutable_evidence
before update or delete on private.data_archive_packages
for each row execute function private.guard_data_archive_immutable_evidence();

create or replace function private.guard_data_archive_member_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Data archive package members are immutable.';
  end if;

  if old.package_id is distinct from new.package_id
    or old.member_kind is distinct from new.member_kind
    or old.source_table is distinct from new.source_table
    or old.source_identifier is distinct from new.source_identifier
    or old.storage_bucket is distinct from new.storage_bucket
    or old.storage_object_name is distinct from new.storage_object_name
    or old.content_type is distinct from new.content_type
    or old.content_checksum is distinct from new.content_checksum
    or old.size_bytes is distinct from new.size_bytes
  then
    raise exception 'Data archive package member identity and evidence are immutable.';
  end if;

  return new;
end;
$$;

create trigger data_archive_package_members_immutable_evidence
before update or delete on private.data_archive_package_members
for each row execute function private.guard_data_archive_member_evidence();

create or replace function private.guard_data_archive_receipts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Data archive receipts are immutable.';
end;
$$;

create trigger data_archive_receipts_immutable
before update or delete on private.data_archive_receipts
for each row execute function private.guard_data_archive_receipts();

create or replace function private.guard_data_archive_api_source_dependency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  archive_package private.data_archive_packages%rowtype;
begin
  select package.* into archive_package
  from private.data_archive_packages as package
  where package.package_kind = 'api-run'
    and package.source_identifier = new.source_run_id::text
  order by package.source_created_at desc, package.created_at desc
  limit 1;

  if archive_package.id is null then
    return new;
  end if;

  if archive_package.status = 'verified' and not exists (
    select 1
    from private.data_archive_package_members as member
    where member.package_id = archive_package.id
      and member.hot_state <> 'hot'
  ) then
    return new;
  end if;

  if archive_package.status = 'rehydrated'
    and exists (
      select 1
      from private.data_archive_rehydrations as rehydration
      where rehydration.package_id = archive_package.id
        and rehydration.status = 'verified'
        and rehydration.manifest_checksum = archive_package.manifest_checksum
    )
    and not exists (
      select 1
      from private.data_archive_package_members as member
      where member.package_id = archive_package.id
        and member.hot_state <> 'rehydrated'
    )
  then
    return new;
  end if;

  raise exception 'The source API run requires operator rehydration before new downstream use.'
    using errcode = '55000';
end;
$$;

drop trigger if exists dataset_forming_runs_require_hot_archive_source
  on private.dataset_forming_runs;
create trigger dataset_forming_runs_require_hot_archive_source
before insert or update of source_run_id on private.dataset_forming_runs
for each row execute function private.guard_data_archive_api_source_dependency();

revoke all on function private.guard_data_archive_api_source_dependency()
  from public, anon, authenticated, service_role;

alter table private.data_archive_backup_runs enable row level security;
alter table private.data_archive_receipts enable row level security;
alter table private.data_archive_packages enable row level security;
alter table private.data_archive_package_members enable row level security;
alter table private.data_archive_prune_plans enable row level security;
alter table private.data_archive_prune_items enable row level security;
alter table private.data_archive_rehydrations enable row level security;

revoke all on private.data_archive_backup_runs from public, anon, authenticated;
revoke all on private.data_archive_receipts from public, anon, authenticated;
revoke all on private.data_archive_packages from public, anon, authenticated;
revoke all on private.data_archive_package_members from public, anon, authenticated;
revoke all on private.data_archive_prune_plans from public, anon, authenticated;
revoke all on private.data_archive_prune_items from public, anon, authenticated;
revoke all on private.data_archive_rehydrations from public, anon, authenticated;

grant select on private.data_archive_backup_runs to data_archive_backup_reader;
grant select on private.data_archive_receipts to data_archive_backup_reader;
grant select on private.data_archive_packages to data_archive_backup_reader;
grant select on private.data_archive_package_members to data_archive_backup_reader;
grant select on private.data_archive_prune_plans to data_archive_backup_reader;
grant select on private.data_archive_prune_items to data_archive_backup_reader;
grant select on private.data_archive_rehydrations to data_archive_backup_reader;
