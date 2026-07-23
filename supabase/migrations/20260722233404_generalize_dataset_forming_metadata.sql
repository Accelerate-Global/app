create extension if not exists pgcrypto with schema extensions;

alter table private.dataset_forming_runs
  add column if not exists source_profile_key text,
  add column if not exists engine_key text,
  add column if not exists artifact_schema_version integer,
  add column if not exists input_fingerprint text,
  add column if not exists publication_target_key text;

update private.dataset_forming_runs
set
  source_profile_key = coalesce(source_profile_key, 'imb-people-groups'),
  engine_key = coalesce(engine_key, 'imb'),
  artifact_schema_version = coalesce(artifact_schema_version, 1),
  input_fingerprint = coalesce(
    input_fingerprint,
    encode(
      extensions.digest(
        concat_ws(
          '|',
          'legacy-imb-input-v1',
          source_rows_checksum,
          source_raw_checksum,
          resource_set_id::text,
          field_contract_version::text,
          field_contract_checksum,
          transformation_version,
          transformation_checksum
        ),
        'sha256'
      ),
      'hex'
    )
  ),
  publication_target_key = coalesce(publication_target_key, 'imb-people-groups');

alter table private.dataset_forming_runs
  alter column source_profile_key set not null,
  alter column engine_key set not null,
  alter column artifact_schema_version set not null,
  alter column input_fingerprint set not null,
  alter column publication_target_key set not null,
  drop constraint if exists dataset_forming_runs_source_profile_key_check,
  add constraint dataset_forming_runs_source_profile_key_check
    check (btrim(source_profile_key) <> ''),
  drop constraint if exists dataset_forming_runs_engine_key_check,
  add constraint dataset_forming_runs_engine_key_check
    check (btrim(engine_key) <> ''),
  drop constraint if exists dataset_forming_runs_artifact_schema_version_check,
  add constraint dataset_forming_runs_artifact_schema_version_check
    check (artifact_schema_version > 0),
  drop constraint if exists dataset_forming_runs_input_fingerprint_check,
  add constraint dataset_forming_runs_input_fingerprint_check
    check (input_fingerprint ~ '^[0-9a-f]{64}$'),
  drop constraint if exists dataset_forming_runs_publication_target_key_check,
  add constraint dataset_forming_runs_publication_target_key_check
    check (btrim(publication_target_key) <> '');

comment on column private.dataset_forming_runs.transformation_version is
  'Backward-compatible storage for the generic forming engine version.';
comment on column private.dataset_forming_runs.transformation_checksum is
  'Backward-compatible storage for the generic forming engine checksum.';

create or replace function private.populate_legacy_dataset_forming_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source_profile_key is null
    and new.engine_key is null
    and new.artifact_schema_version is null
    and new.input_fingerprint is null
    and new.publication_target_key is null
  then
    new.source_profile_key := 'imb-people-groups';
    new.engine_key := 'imb';
    new.artifact_schema_version := 1;
    new.input_fingerprint := encode(
      extensions.digest(
        concat_ws(
          '|',
          'legacy-imb-input-v1',
          new.source_rows_checksum,
          new.source_raw_checksum,
          new.resource_set_id::text,
          new.field_contract_version::text,
          new.field_contract_checksum,
          new.transformation_version,
          new.transformation_checksum
        ),
        'sha256'
      ),
      'hex'
    );
    new.publication_target_key := 'imb-people-groups';
  end if;

  return new;
end;
$$;

drop trigger if exists dataset_forming_runs_legacy_metadata on private.dataset_forming_runs;
create trigger dataset_forming_runs_legacy_metadata
before insert on private.dataset_forming_runs
for each row execute function private.populate_legacy_dataset_forming_metadata();

create unique index if not exists reference_resource_sets_id_checksum_idx
  on private.reference_resource_sets(id, content_checksum);
create unique index if not exists reference_resource_set_members_membership_idx
  on private.reference_resource_set_members(set_id, resource_id, version_id);
create unique index if not exists dataset_forming_runs_id_resource_set_idx
  on private.dataset_forming_runs(id, resource_set_id);

create index if not exists dataset_forming_runs_source_profile_idx
  on private.dataset_forming_runs(source_profile_key, created_at desc, id);
create index if not exists dataset_forming_runs_engine_status_idx
  on private.dataset_forming_runs(engine_key, status, created_at desc, id);
create index if not exists dataset_forming_runs_publication_target_idx
  on private.dataset_forming_runs(publication_target_key, created_at desc, id);
create unique index if not exists dataset_forming_runs_target_publishing_idx
  on private.dataset_forming_runs(publication_target_key)
  where status = 'publishing';

create table if not exists private.dataset_forming_resource_bindings (
  id bigint generated always as identity primary key,
  forming_run_id uuid not null references private.dataset_forming_runs(id) on delete restrict,
  position integer not null,
  binding_key text not null,
  binding_type text not null,
  required boolean not null,
  kind text not null,
  version text not null,
  checksum text not null,
  schema_version integer not null,
  resource_set_id uuid,
  resource_set_checksum text,
  resource_id uuid,
  resource_version_id uuid,
  created_at timestamptz not null default now(),
  constraint dataset_forming_resource_bindings_position_check check (position >= 0),
  constraint dataset_forming_resource_bindings_key_check check (btrim(binding_key) <> ''),
  constraint dataset_forming_resource_bindings_type_check
    check (binding_type in ('catalog', 'code')),
  constraint dataset_forming_resource_bindings_kind_check check (btrim(kind) <> ''),
  constraint dataset_forming_resource_bindings_version_check check (btrim(version) <> ''),
  constraint dataset_forming_resource_bindings_checksum_check
    check (checksum ~ '^[0-9a-f]{64}$'),
  constraint dataset_forming_resource_bindings_schema_version_check
    check (schema_version > 0),
  constraint dataset_forming_resource_bindings_source_check check (
    (
      binding_type = 'catalog'
      and resource_set_id is not null
      and resource_set_checksum is not null
      and resource_id is not null
      and resource_version_id is not null
    )
    or
    (
      binding_type = 'code'
      and resource_set_id is null
      and resource_set_checksum is null
      and resource_id is null
      and resource_version_id is null
    )
  ),
  constraint dataset_forming_resource_bindings_run_set_fk
    foreign key (forming_run_id, resource_set_id)
    references private.dataset_forming_runs(id, resource_set_id)
    on delete restrict,
  constraint dataset_forming_resource_bindings_set_checksum_fk
    foreign key (resource_set_id, resource_set_checksum)
    references private.reference_resource_sets(id, content_checksum)
    on delete restrict,
  constraint dataset_forming_resource_bindings_membership_fk
    foreign key (resource_set_id, resource_id, resource_version_id)
    references private.reference_resource_set_members(set_id, resource_id, version_id)
    on delete restrict
);

create unique index if not exists dataset_forming_resource_bindings_run_position_idx
  on private.dataset_forming_resource_bindings(forming_run_id, position);
create unique index if not exists dataset_forming_resource_bindings_run_key_idx
  on private.dataset_forming_resource_bindings(forming_run_id, binding_key);
create index if not exists dataset_forming_resource_bindings_key_idx
  on private.dataset_forming_resource_bindings(binding_key, created_at desc, id);
create index if not exists dataset_forming_resource_bindings_version_idx
  on private.dataset_forming_resource_bindings(resource_version_id, forming_run_id)
  where resource_version_id is not null;

insert into private.dataset_forming_resource_bindings (
  forming_run_id,
  position,
  binding_key,
  binding_type,
  required,
  kind,
  version,
  checksum,
  schema_version,
  resource_set_id,
  resource_set_checksum,
  resource_id,
  resource_version_id
)
select
  forming_run.id,
  case resource.resource_key
    when 'country-territory-codes' then 0
    when 'rop-codes' then 1
  end,
  resource.resource_key,
  'catalog',
  true,
  resource.resource_kind,
  resource_version.version_number::text,
  resource_version.content_checksum,
  resource_version.schema_version,
  resource_set.id,
  resource_set.content_checksum,
  resource.id,
  resource_version.id
from private.dataset_forming_runs as forming_run
join private.reference_resource_sets as resource_set
  on resource_set.id = forming_run.resource_set_id
join private.reference_resource_set_members as member
  on member.set_id = resource_set.id
join private.reference_resources as resource
  on resource.id = member.resource_id
join private.reference_resource_versions as resource_version
  on resource_version.id = member.version_id
where resource.resource_key in ('country-territory-codes', 'rop-codes')
  and resource_version.content_checksum is not null
on conflict (forming_run_id, binding_key) do nothing;

insert into private.dataset_forming_resource_bindings (
  forming_run_id,
  position,
  binding_key,
  binding_type,
  required,
  kind,
  version,
  checksum,
  schema_version
)
select
  id,
  2,
  'imb-field-contract',
  'code',
  true,
  'field-contract',
  field_contract_version::text,
  field_contract_checksum,
  1
from private.dataset_forming_runs
where source_profile_key = 'imb-people-groups'
  and engine_key = 'imb'
on conflict (forming_run_id, binding_key) do nothing;

create or replace function private.guard_dataset_forming_resource_binding()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_run_id uuid;
  target_run_status text;
  catalog_record record;
begin
  target_run_id := case when tg_op = 'DELETE' then old.forming_run_id else new.forming_run_id end;

  select status
  into target_run_status
  from private.dataset_forming_runs
  where id = target_run_id;

  if target_run_status is null then
    raise exception 'Dataset forming run does not exist.';
  end if;

  if target_run_status <> 'building' then
    raise exception 'Finalized dataset forming resource bindings are immutable.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.binding_type = 'catalog' then
    select
      resource.resource_kind as kind,
      resource_version.version_number::text as version,
      resource_version.content_checksum as checksum,
      resource_version.schema_version as schema_version,
      resource_set.content_checksum as resource_set_checksum
    into catalog_record
    from private.reference_resource_set_members as member
    join private.reference_resource_sets as resource_set
      on resource_set.id = member.set_id
    join private.reference_resources as resource
      on resource.id = member.resource_id
    join private.reference_resource_versions as resource_version
      on resource_version.id = member.version_id
    where member.set_id = new.resource_set_id
      and member.resource_id = new.resource_id
      and member.version_id = new.resource_version_id;

    if catalog_record is null
      or catalog_record.kind is distinct from new.kind
      or catalog_record.version is distinct from new.version
      or catalog_record.checksum is distinct from new.checksum
      or catalog_record.schema_version is distinct from new.schema_version
      or catalog_record.resource_set_checksum is distinct from new.resource_set_checksum
    then
      raise exception 'Catalog forming binding metadata does not match its immutable resource-set member.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists dataset_forming_resource_bindings_immutable
  on private.dataset_forming_resource_bindings;
create trigger dataset_forming_resource_bindings_immutable
before insert or update or delete on private.dataset_forming_resource_bindings
for each row execute function private.guard_dataset_forming_resource_binding();

create or replace function private.guard_dataset_forming_run_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Dataset forming run history is append-only.';
  end if;

  if old.status <> 'building' and (
    new.connection_id is distinct from old.connection_id
    or new.source_run_id is distinct from old.source_run_id
    or new.resource_set_id is distinct from old.resource_set_id
    or new.source_profile_key is distinct from old.source_profile_key
    or new.engine_key is distinct from old.engine_key
    or new.artifact_schema_version is distinct from old.artifact_schema_version
    or new.input_fingerprint is distinct from old.input_fingerprint
    or new.publication_target_key is distinct from old.publication_target_key
    or new.actor_owner_id is distinct from old.actor_owner_id
    or new.actor_email is distinct from old.actor_email
    or new.source_rows_checksum is distinct from old.source_rows_checksum
    or new.source_raw_checksum is distinct from old.source_raw_checksum
    or new.field_contract_version is distinct from old.field_contract_version
    or new.field_contract_checksum is distinct from old.field_contract_checksum
    or new.transformation_version is distinct from old.transformation_version
    or new.transformation_checksum is distinct from old.transformation_checksum
    or new.input_row_count is distinct from old.input_row_count
    or new.output_row_count is distinct from old.output_row_count
    or new.warning_count is distinct from old.warning_count
    or new.error_count is distinct from old.error_count
    or new.validation_summary is distinct from old.validation_summary
    or new.artifact_manifest is distinct from old.artifact_manifest
    or new.output_checksum is distinct from old.output_checksum
    or new.output_size_bytes is distinct from old.output_size_bytes
    or new.started_at is distinct from old.started_at
    or new.completed_at is distinct from old.completed_at
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Finalized dataset forming bindings and payload metadata are immutable.';
  end if;

  return new;
end;
$$;

alter table private.dataset_forming_resource_bindings enable row level security;

revoke all on private.dataset_forming_resource_bindings from public, anon, authenticated;
revoke all on sequence private.dataset_forming_resource_bindings_id_seq
  from public, anon, authenticated;

grant all on private.dataset_forming_resource_bindings to service_role;
grant usage, select on sequence private.dataset_forming_resource_bindings_id_seq
  to service_role;
