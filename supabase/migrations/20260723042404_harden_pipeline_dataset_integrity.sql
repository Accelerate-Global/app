-- Pipeline-owned datasets are written by the trusted server transaction, but
-- browser-facing Supabase roles must not be able to bypass the application
-- publication/rollback lifecycle with direct table DML.

begin;

create table if not exists private.dataset_storage_path_claims (
  storage_path text not null,
  dataset_id uuid not null,
  first_claimed_at timestamptz not null default now(),
  last_claimed_at timestamptz not null default now(),
  primary key (storage_path, dataset_id)
);

create index if not exists dataset_storage_path_claims_dataset_idx
  on private.dataset_storage_path_claims(dataset_id);

create table if not exists private.dataset_storage_path_owners (
  storage_path text primary key,
  owner_dataset_ids uuid[] not null,
  is_grandfathered boolean not null default false,
  first_claimed_at timestamptz not null default now(),
  last_claimed_at timestamptz not null default now(),
  constraint dataset_storage_path_owners_path_check
    check (is_grandfathered or btrim(storage_path) <> ''),
  constraint dataset_storage_path_owners_nonempty_check
    check (cardinality(owner_dataset_ids) > 0),
  constraint dataset_storage_path_owners_no_null_check
    check (array_position(owner_dataset_ids, null) is null)
);

create table if not exists private.dataset_identity_claims (
  dataset_id uuid primary key,
  first_claimed_at timestamptz not null default now()
);

revoke all on table private.dataset_storage_path_claims
  from public, anon, authenticated, service_role;
revoke all on table private.dataset_storage_path_owners
  from public, anon, authenticated, service_role;
revoke all on table private.dataset_identity_claims
  from public, anon, authenticated, service_role;

-- Keep the current-path preflight, complete historical claim backfill, unique
-- current-path index, and claim-trigger installation in one write-stable
-- snapshot. Historical version aliases are retained exactly as they existed
-- before this migration.
lock table public.datasets in share row exclusive mode;
lock table public.dataset_versions in share row exclusive mode;

do $$
begin
  if exists (
    select 1
    from public.datasets as dataset
    group by dataset.blob_path
    having count(*) > 1
  ) then
    raise exception
      'Current dataset storage paths must be unique before applying the integrity migration.'
      using errcode = '23505';
  end if;
end;
$$;

insert into private.dataset_storage_path_claims (
  storage_path,
  dataset_id
)
select
  historical_path.blob_path,
  historical_path.dataset_id
from (
  select dataset.id as dataset_id, dataset.blob_path
  from public.datasets as dataset
  union all
  select version.dataset_id, version.blob_path
  from public.dataset_versions as version
) as historical_path
group by historical_path.blob_path, historical_path.dataset_id
on conflict (storage_path, dataset_id) do nothing;

insert into private.dataset_storage_path_owners (
  storage_path,
  owner_dataset_ids,
  is_grandfathered
)
select
  historical_path.blob_path,
  pg_catalog.array_agg(
    distinct historical_path.dataset_id
    order by historical_path.dataset_id
  ),
  true
from (
  select dataset.id as dataset_id, dataset.blob_path
  from public.datasets as dataset
  union all
  select version.dataset_id, version.blob_path
  from public.dataset_versions as version
) as historical_path
group by historical_path.blob_path
on conflict (storage_path) do nothing;

insert into private.dataset_identity_claims (dataset_id)
select distinct historical_identity.dataset_id
from (
  select dataset.id as dataset_id
  from public.datasets as dataset
  union all
  select version.dataset_id
  from public.dataset_versions as version
) as historical_identity
on conflict (dataset_id) do nothing;

create unique index if not exists datasets_blob_path_unique_idx
  on public.datasets(blob_path);

create or replace function private.enforce_dataset_id_immutability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception
      'Dataset identifiers are immutable.'
      using
        errcode = '23514',
        constraint = 'datasets_id_immutable';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_dataset_id_immutability()
  from public, anon, authenticated, service_role;

create or replace function private.claim_dataset_storage_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_dataset_id uuid;
  claimed_storage_path text;
begin
  if tg_op = 'UPDATE' and new.blob_path is not distinct from old.blob_path then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into private.dataset_identity_claims as identity_claim (
      dataset_id
    ) values (
      new.id
    )
    on conflict (dataset_id) do nothing
    returning identity_claim.dataset_id
    into claimed_dataset_id;

    if claimed_dataset_id is null then
      raise exception
        'Dataset identifiers with historical storage claims cannot be reused.'
        using
          errcode = '23505',
          constraint = 'dataset_storage_path_claims_pkey';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'dataset-storage-path:' || new.blob_path,
      640217
    )
  );

  insert into private.dataset_storage_path_owners as ownership (
    storage_path,
    owner_dataset_ids,
    is_grandfathered
  ) values (
    new.blob_path,
    array[new.id]::uuid[],
    false
  )
  on conflict (storage_path) do update
    set last_claimed_at = pg_catalog.now()
    where excluded.owner_dataset_ids <@ ownership.owner_dataset_ids
  returning ownership.storage_path
  into claimed_storage_path;

  if claimed_storage_path is null then
    raise exception
      'Dataset storage path is already owned by another dataset.'
      using
        errcode = '23505',
        constraint = 'dataset_storage_path_claims_pkey';
  end if;

  insert into private.dataset_storage_path_claims as claim (
    storage_path,
    dataset_id
  ) values (
    new.blob_path,
    new.id
  )
  on conflict (storage_path, dataset_id)
  do update
    set last_claimed_at = pg_catalog.now();

  return new;
end;
$$;

revoke all on function private.claim_dataset_storage_path()
  from public, anon, authenticated, service_role;

create or replace function private.claim_dataset_version_storage_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_storage_path text;
begin
  if tg_op = 'UPDATE'
    and new.blob_path is not distinct from old.blob_path
    and new.dataset_id is not distinct from old.dataset_id
  then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'dataset-storage-path:' || new.blob_path,
      640217
    )
  );

  insert into private.dataset_storage_path_owners as ownership (
    storage_path,
    owner_dataset_ids,
    is_grandfathered
  ) values (
    new.blob_path,
    array[new.dataset_id]::uuid[],
    false
  )
  on conflict (storage_path) do update
    set last_claimed_at = pg_catalog.now()
    where excluded.owner_dataset_ids <@ ownership.owner_dataset_ids
  returning ownership.storage_path
  into claimed_storage_path;

  if claimed_storage_path is null then
    raise exception
      'Dataset storage path is already owned by another dataset.'
      using
        errcode = '23505',
        constraint = 'dataset_storage_path_claims_pkey';
  end if;

  insert into private.dataset_storage_path_claims as claim (
    storage_path,
    dataset_id
  ) values (
    new.blob_path,
    new.dataset_id
  )
  on conflict (storage_path, dataset_id)
  do update
    set last_claimed_at = pg_catalog.now();

  return new;
end;
$$;

revoke all on function private.claim_dataset_version_storage_path()
  from public, anon, authenticated, service_role;

drop trigger if exists datasets_enforce_id_immutability
  on public.datasets;
create trigger datasets_enforce_id_immutability
before update of id on public.datasets
for each row execute function private.enforce_dataset_id_immutability();

drop trigger if exists datasets_claim_storage_path
  on public.datasets;
create trigger datasets_claim_storage_path
after insert or update of blob_path on public.datasets
for each row execute function private.claim_dataset_storage_path();

drop trigger if exists dataset_versions_claim_storage_path
  on public.dataset_versions;
create trigger dataset_versions_claim_storage_path
after insert or update of blob_path, dataset_id on public.dataset_versions
for each row execute function private.claim_dataset_version_storage_path();

create or replace function private.is_pipeline_managed_dataset(
  p_dataset_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.pipeline_publications as publication
    where publication.dataset_id = p_dataset_id
  );
$$;

revoke all on function private.is_pipeline_managed_dataset(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.is_trusted_dataset_server_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    session_user = current_user
    and coalesce(pg_catalog.current_setting('role', true), 'none')
      in ('', 'none');
$$;

revoke all on function private.is_trusted_dataset_server_write()
  from public, anon, authenticated, service_role;

create or replace function private.authorize_pipeline_dataset_mutation()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_trusted_dataset_server_write() then
    raise exception
      'Only the trusted dataset server can authorize a pipeline dataset transaction.'
      using errcode = '42501';
  end if;

  perform pg_catalog.set_config(
    'app.pipeline_dataset_mutation_txid',
    pg_catalog.txid_current()::text,
    true
  );
end;
$$;

revoke all on function private.authorize_pipeline_dataset_mutation()
  from public, anon, authenticated, service_role;

create or replace function private.is_pipeline_dataset_mutation_authorized()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_trusted_dataset_server_write()
    and coalesce(
      pg_catalog.current_setting(
        'app.pipeline_dataset_mutation_txid',
        true
      ),
      ''
    ) = pg_catalog.txid_current()::text;
$$;

revoke all on function private.is_pipeline_dataset_mutation_authorized()
  from public, anon, authenticated, service_role;

create or replace function private.guard_pipeline_dataset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_is_guarded boolean := false;
  new_is_guarded boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_is_guarded := private.is_pipeline_managed_dataset(old.id);
  end if;
  if tg_op = 'UPDATE' then
    new_is_guarded := private.is_pipeline_managed_dataset(new.id);
  end if;

  if old_is_guarded or new_is_guarded then
    if not private.is_trusted_dataset_server_write() then
      raise exception
        'Pipeline-managed datasets can only be changed through the trusted dataset server.'
        using errcode = '42501';
    end if;

    if tg_op = 'DELETE'
      and not private.is_pipeline_dataset_mutation_authorized()
    then
      raise exception
        'Pipeline-managed datasets can only be deleted through an authorized publication or rollback transaction.'
        using errcode = '42501';
    end if;

    if tg_op = 'UPDATE'
      and (
        new.id is distinct from old.id
        or new.owner_id is distinct from old.owner_id
        or new.backing_dataset_id is distinct from old.backing_dataset_id
        or new.blob_url is distinct from old.blob_url
        or new.blob_path is distinct from old.blob_path
        or new.current_version_action is distinct from old.current_version_action
        or new.current_version_actor_owner_id is distinct from old.current_version_actor_owner_id
        or new.current_version_actor_email is distinct from old.current_version_actor_email
        or new.current_version_created_at is distinct from old.current_version_created_at
        or new.is_public is distinct from old.is_public
        or new.is_workspace_visible is distinct from old.is_workspace_visible
        or new.status is distinct from old.status
        or new.row_count is distinct from old.row_count
        or new.size_bytes is distinct from old.size_bytes
        or new.columns is distinct from old.columns
        or new.tags is distinct from old.tags
        or new.error is distinct from old.error
        or new.created_at is distinct from old.created_at
      )
      and not private.is_pipeline_dataset_mutation_authorized()
    then
      raise exception
        'Pipeline-managed dataset content, classification, visibility, and lineage can only be changed through an authorized publication or rollback transaction.'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.guard_pipeline_dataset_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_is_guarded boolean := false;
  new_is_guarded boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_is_guarded := private.is_pipeline_managed_dataset(old.dataset_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    new_is_guarded := private.is_pipeline_managed_dataset(new.dataset_id);
  end if;

  if (old_is_guarded or new_is_guarded)
    and not private.is_pipeline_dataset_mutation_authorized()
  then
    raise exception
      'Pipeline-managed dataset rows can only be changed through the trusted publication or rollback service.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.guard_pipeline_dataset_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_is_guarded boolean := false;
  new_is_guarded boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_is_guarded := private.is_pipeline_managed_dataset(old.dataset_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    new_is_guarded := private.is_pipeline_managed_dataset(new.dataset_id);
  end if;

  if (old_is_guarded or new_is_guarded)
    and not private.is_pipeline_dataset_mutation_authorized()
  then
    raise exception
      'Pipeline-managed dataset version evidence is immutable outside the trusted publication or rollback service.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.guard_pipeline_dataset_version_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_dataset_id uuid;
  new_dataset_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select version.dataset_id
    into old_dataset_id
    from public.dataset_versions as version
    where version.id = old.version_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select version.dataset_id
    into new_dataset_id
    from public.dataset_versions as version
    where version.id = new.version_id;
  end if;

  if (
      (old_dataset_id is not null
        and private.is_pipeline_managed_dataset(old_dataset_id))
      or
      (new_dataset_id is not null
        and private.is_pipeline_managed_dataset(new_dataset_id))
    )
    and not private.is_pipeline_dataset_mutation_authorized()
  then
    raise exception
      'Pipeline-managed dataset version rows are immutable outside the trusted publication or rollback service.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_pipeline_dataset()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_pipeline_dataset_row()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_pipeline_dataset_version()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_pipeline_dataset_version_row()
  from public, anon, authenticated, service_role;

drop trigger if exists datasets_pipeline_managed_guard
  on public.datasets;
create trigger datasets_pipeline_managed_guard
before update or delete on public.datasets
for each row execute function private.guard_pipeline_dataset();

drop trigger if exists dataset_rows_pipeline_managed_guard
  on public.dataset_rows;
create trigger dataset_rows_pipeline_managed_guard
before insert or update or delete on public.dataset_rows
for each row execute function private.guard_pipeline_dataset_row();

drop trigger if exists dataset_versions_pipeline_managed_guard
  on public.dataset_versions;
create trigger dataset_versions_pipeline_managed_guard
before insert or update or delete on public.dataset_versions
for each row execute function private.guard_pipeline_dataset_version();

drop trigger if exists dataset_version_rows_pipeline_managed_guard
  on public.dataset_version_rows;
create trigger dataset_version_rows_pipeline_managed_guard
before insert or update or delete on public.dataset_version_rows
for each row execute function private.guard_pipeline_dataset_version_row();

comment on table private.dataset_storage_path_claims is
  'Permanent pairwise audit ledger for every dataset historically entitled to a storage path.';
comment on table private.dataset_storage_path_owners is
  'Atomic path ownership gate. The owner set is established by migration backfill or the first runtime claim and never admits another dataset.';
comment on table private.dataset_identity_claims is
  'Permanent dataset-identifier tombstones created only after successful inserts.';
comment on function private.is_trusted_dataset_server_write() is
  'Identifies the direct database-owner server connection while denying PostgREST anon, authenticated, and service roles.';
comment on function private.authorize_pipeline_dataset_mutation() is
  'Creates a transaction-local, database-owner-only capability for atomic pipeline publication or rollback dataset writes.';

commit;
