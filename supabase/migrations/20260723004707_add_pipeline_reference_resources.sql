alter table private.reference_resources
  drop constraint if exists reference_resources_kind_check;

alter table private.reference_resources
  add constraint reference_resources_kind_check check (
    resource_kind in (
      'country-geography',
      'rop-taxonomy',
      'source-registry',
      'people-crosswalk',
      'merge-priority',
      'field-mapping'
    )
  );

create table if not exists private.pipeline_reference_entries (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null
    references private.reference_resource_versions(id) on delete cascade,
  stable_key text not null,
  active boolean not null,
  data jsonb not null,
  search_text text not null,
  created_at timestamptz not null default now(),
  constraint pipeline_reference_entries_key_check
    check (btrim(stable_key) <> ''),
  constraint pipeline_reference_entries_data_check
    check (jsonb_typeof(data) = 'object')
);

create unique index if not exists pipeline_reference_entries_version_key_idx
  on private.pipeline_reference_entries(version_id, stable_key);
create index if not exists pipeline_reference_entries_version_active_idx
  on private.pipeline_reference_entries(version_id, active, stable_key);
create index if not exists pipeline_reference_entries_search_idx
  on private.pipeline_reference_entries
  using gin (to_tsvector('simple', search_text));

drop trigger if exists pipeline_reference_entries_immutable
  on private.pipeline_reference_entries;
create trigger pipeline_reference_entries_immutable
before insert or update or delete on private.pipeline_reference_entries
for each row execute function private.prevent_finalized_reference_projection_mutation();

create or replace function private.prevent_finalized_reference_version_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, private
as $$
begin
  if tg_op = 'DELETE' then
    if old.lifecycle_state <> 'building' then
      raise exception 'Finalized reference-resource versions are immutable.';
    end if;
    return old;
  end if;

  if old.lifecycle_state <> 'building' and (
    new.resource_id is distinct from old.resource_id
    or new.version_number is distinct from old.version_number
    or new.schema_version is distinct from old.schema_version
    or new.content_checksum is distinct from old.content_checksum
    or new.source_retrieved_at is distinct from old.source_retrieved_at
    or new.source_metadata is distinct from old.source_metadata
    or new.normalized_resource is distinct from old.normalized_resource
    or new.artifact_manifest is distinct from old.artifact_manifest
    or new.validation_summary is distinct from old.validation_summary
    or new.diff_summary is distinct from old.diff_summary
    or new.entry_count is distinct from old.entry_count
    or new.created_by_owner_id is distinct from old.created_by_owner_id
    or new.created_at is distinct from old.created_at
    or new.finalized_at is distinct from old.finalized_at
    or new.build_error is distinct from old.build_error
  ) then
    raise exception 'Finalized reference-resource package content is immutable.';
  end if;

  if old.lifecycle_state <> new.lifecycle_state and exists (
    select 1
    from private.reference_resources as resource
    where resource.active_version_id = old.id
  ) then
    raise exception 'Active reference-resource versions are immutable.';
  end if;

  return new;
end;
$$;

create or replace function private.prevent_direct_reference_activation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.active_version_id is distinct from old.active_version_id
     and coalesce(current_setting('app.reference_resource_activation', true), '') <> 'allowed'
  then
    raise exception 'Reference-resource activation must use the guarded activation function.';
  end if;
  return new;
end;
$$;

drop trigger if exists reference_resources_guard_activation
  on private.reference_resources;
create trigger reference_resources_guard_activation
before update of active_version_id on private.reference_resources
for each row execute function private.prevent_direct_reference_activation();

create or replace function private.activate_reference_resource(
  p_resource_key text,
  p_version_id uuid,
  p_expected_active_version_id uuid,
  p_actor_owner_id text,
  p_reason text,
  p_action text default 'activate'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, private, extensions
as $$
declare
  target_resource private.reference_resources%rowtype;
  target_version private.reference_resource_versions%rowtype;
  resource_set_id uuid;
  resource_set_checksum text;
begin
  if btrim(coalesce(p_actor_owner_id, '')) = '' or btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Activation actor and reason are required.' using errcode = '22023';
  end if;

  if p_action not in ('activate', 'rollback', 'alias-edit') then
    raise exception 'Unsupported activation action.' using errcode = '22023';
  end if;

  select * into target_resource
  from private.reference_resources
  where resource_key = p_resource_key
  for update;

  if not found then
    raise exception 'Reference resource not found.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_resource.id::text, 0));

  if target_resource.active_version_id is distinct from p_expected_active_version_id then
    raise exception 'Reference resource active version changed.' using errcode = '40001';
  end if;

  if target_resource.active_version_id = p_version_id then
    raise exception 'Reference resource version is already active.' using errcode = '22023';
  end if;

  select * into target_version
  from private.reference_resource_versions
  where id = p_version_id and resource_id = target_resource.id;

  if not found or target_version.lifecycle_state <> 'valid' or target_version.content_checksum is null then
    raise exception 'Only a complete valid version can be activated.' using errcode = '23514';
  end if;

  perform set_config('app.reference_resource_activation', 'allowed', true);
  update private.reference_resources
  set active_version_id = target_version.id, updated_at = now()
  where id = target_resource.id;
  perform set_config('app.reference_resource_activation', '', true);

  insert into private.reference_resource_activation_events (
    resource_id,
    previous_version_id,
    selected_version_id,
    action,
    actor_owner_id,
    reason
  ) values (
    target_resource.id,
    target_resource.active_version_id,
    target_version.id,
    p_action,
    p_actor_owner_id,
    btrim(p_reason)
  );

  select encode(
    digest(
      convert_to(
        string_agg(resource_key || ':' || active_version_id::text, '|' order by resource_key),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) into resource_set_checksum
  from private.reference_resources
  where active_version_id is not null;

  insert into private.reference_resource_sets (
    content_checksum,
    created_by_owner_id,
    reason
  ) values (
    resource_set_checksum,
    p_actor_owner_id,
    btrim(p_reason)
  ) returning id into resource_set_id;

  insert into private.reference_resource_set_members (set_id, resource_id, version_id)
  select resource_set_id, id, active_version_id
  from private.reference_resources
  where active_version_id is not null
  order by resource_key;

  return resource_set_id;
end;
$$;

revoke all on function private.activate_reference_resource(text, uuid, uuid, text, text, text)
  from public, anon, authenticated;

insert into private.reference_resources (
  resource_key,
  resource_kind,
  label,
  description,
  route_path,
  sort_order
)
values
  (
    'source-aliases',
    'source-registry',
    'Dataset source aliases',
    'Canonical source keys and accepted dataset source names used during forming and merge work.',
    '/dashboard/resources',
    30
  ),
  (
    'jp-peopleid3',
    'people-crosswalk',
    'Joshua Project PeopleID3 crosswalk',
    'PeopleID3 relationships used to resolve engagement records to ROP3 and country evidence.',
    '/dashboard/resources',
    40
  ),
  (
    'peid',
    'people-crosswalk',
    'PEID crosswalk',
    'PEID relationships used to resolve engagement records to ROP3, ROP1, and country evidence.',
    '/dashboard/resources',
    50
  ),
  (
    'tier1-merge-priorities',
    'merge-priority',
    'Tier 1 field priorities',
    'Ordered dataset-source preferences used to select field winners in Tier 1 merge products.',
    '/dashboard/resources',
    60
  ),
  (
    'engagement-mappings',
    'field-mapping',
    'Engagement field mappings',
    'Source-to-canonical field and semantic type mappings used for engagement partner forming.',
    '/dashboard/resources',
    70
  )
on conflict (resource_key) do update
set
  resource_kind = excluded.resource_kind,
  label = excluded.label,
  description = excluded.description,
  route_path = excluded.route_path,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table private.pipeline_reference_entries enable row level security;
revoke all on private.pipeline_reference_entries from public, anon, authenticated;
grant all on private.pipeline_reference_entries to service_role;
