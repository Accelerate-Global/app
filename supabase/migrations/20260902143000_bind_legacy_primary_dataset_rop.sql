-- Legacy primary datasets can predate pipeline-publication lineage. Record one
-- explicit, immutable dataset-version-to-resource-version binding rather than
-- fabricating a producer run or consulting the mutable active pointer at query
-- time.
create table if not exists private.analytics_chat_dataset_resource_bindings (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete restrict,
  dataset_version_created_at timestamptz not null,
  resource_id uuid not null references private.reference_resources(id)
    on delete restrict,
  resource_version_id uuid not null
    references private.reference_resource_versions(id) on delete restrict,
  binding_source text not null
    check (binding_source = 'legacy-reviewed-backfill'),
  created_by_owner_id text not null
    check (btrim(created_by_owner_id) <> ''),
  reason text not null check (btrim(reason) <> ''),
  created_at timestamptz not null default now(),
  unique (dataset_id, dataset_version_created_at, resource_id)
);

create or replace function private.guard_analytics_chat_dataset_resource_binding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dataset_record public.datasets%rowtype;
  resource_key text;
  version_resource_id uuid;
  version_state text;
  version_checksum text;
  version_has_people boolean;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Analytics chat dataset resource bindings are immutable.'
      using errcode = '55000';
  end if;

  select * into dataset_record
  from public.datasets
  where id = new.dataset_id;

  if not found
    or not dataset_record.is_primary
    or dataset_record.status <> 'ready'
    or dataset_record.current_version_created_at is distinct from
      new.dataset_version_created_at then
    raise exception 'Binding requires the exact current ready primary dataset version.'
      using errcode = '23514';
  end if;

  select resource.resource_key,
    version.resource_id,
    version.lifecycle_state,
    version.content_checksum,
    exists (
      select 1
      from private.rop_reference_people as person
      where person.version_id = version.id
    )
  into resource_key, version_resource_id, version_state, version_checksum,
    version_has_people
  from private.reference_resources as resource
  join private.reference_resource_versions as version
    on version.id = new.resource_version_id
  where resource.id = new.resource_id;

  if resource_key is distinct from 'rop-codes'
    or version_resource_id is distinct from new.resource_id
    or version_state is distinct from 'valid'
    or version_checksum is null
    or version_has_people is distinct from true then
    raise exception 'Binding requires one complete valid ROP resource version.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists analytics_chat_dataset_resource_bindings_immutable
  on private.analytics_chat_dataset_resource_bindings;
create trigger analytics_chat_dataset_resource_bindings_immutable
before insert or update or delete
on private.analytics_chat_dataset_resource_bindings
for each row execute function
  private.guard_analytics_chat_dataset_resource_binding();

alter table private.analytics_chat_dataset_resource_bindings enable row level security;
alter table private.analytics_chat_dataset_resource_bindings force row level security;

revoke all on private.analytics_chat_dataset_resource_bindings
  from public, anon, authenticated, service_role,
    analytics_chat_login, analytics_chat_reader;
revoke all on function private.guard_analytics_chat_dataset_resource_binding()
  from public, anon, authenticated, service_role,
    analytics_chat_login, analytics_chat_reader;

comment on table private.analytics_chat_dataset_resource_bindings is
  'Explicit immutable legacy dataset-version-to-ROP-version bindings. Runtime queries never derive these from the active resource pointer.';

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
  dataset.id,
  dataset.current_version_created_at,
  resource.id,
  version.id,
  'legacy-reviewed-backfill',
  'system:qwen-semantic-rag-release',
  'Pin the pre-publication primary dataset version to the reviewed ROP version for the Blake-only production canary.'
from public.datasets as dataset
join private.reference_resources as resource
  on resource.resource_key = 'rop-codes'
join private.reference_resource_versions as version
  on version.id = resource.active_version_id
  and version.resource_id = resource.id
  and version.lifecycle_state = 'valid'
  and version.content_checksum is not null
where dataset.is_primary
  and dataset.status = 'ready'
  and dataset.current_version_created_at is not null
  and not exists (
    select 1
    from private.pipeline_publications as publication
    where publication.dataset_id = coalesce(
      dataset.backing_dataset_id,
      dataset.id
    )
  )
on conflict (dataset_id, dataset_version_created_at, resource_id) do nothing;

create or replace function private.analytics_primary_people_groups_metadata()
returns table (
  dataset_id uuid,
  source_dataset_id uuid,
  dataset_version_created_at timestamptz,
  resource_set_id uuid,
  rop_version_id uuid,
  rop_binding_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    dataset.id as dataset_id,
    coalesce(dataset.backing_dataset_id, dataset.id) as source_dataset_id,
    dataset.current_version_created_at as dataset_version_created_at,
    coalesce(forming_run.resource_set_id, product_run.resource_set_id)
      as resource_set_id,
    coalesce(rop_member.version_id, legacy_binding.resource_version_id)
      as rop_version_id,
    case
      when legacy_binding.id is not null
        and (rop_version.lifecycle_state is distinct from 'valid'
          or rop_version.content_checksum is null)
        then 'invalid_rop_binding'
      when legacy_binding.id is not null then 'bound'
      when publication.id is null then 'missing_publication'
      when coalesce(forming_run.resource_set_id, product_run.resource_set_id)
        is null then 'missing_resource_set'
      when rop_member.version_id is null then 'missing_rop_binding'
      when rop_version.lifecycle_state is distinct from 'valid'
        or rop_version.content_checksum is null
        then 'invalid_rop_binding'
      else 'bound'
    end as rop_binding_status
  from public.datasets as dataset
  left join lateral (
    select candidate.id, candidate.producer_kind, candidate.producer_run_id
    from private.pipeline_publications as candidate
    where candidate.dataset_id = coalesce(
      dataset.backing_dataset_id,
      dataset.id
    )
    order by candidate.created_at desc, candidate.id desc
    limit 1
  ) as publication on true
  left join private.dataset_forming_runs as forming_run
    on publication.producer_kind in ('dataset-forming', 'tier2-forming')
    and forming_run.id = publication.producer_run_id
  left join private.pipeline_runs as product_run
    on publication.producer_kind in (
      'tier1-merge', 'aggregate1', 'tier2-merge', 'aggregate2'
    )
    and product_run.id = publication.producer_run_id
  left join private.reference_resources as rop_resource
    on rop_resource.resource_key = 'rop-codes'
  left join private.reference_resource_set_members as rop_member
    on rop_member.set_id = coalesce(
      forming_run.resource_set_id,
      product_run.resource_set_id
    )
    and rop_member.resource_id = rop_resource.id
  left join private.analytics_chat_dataset_resource_bindings as legacy_binding
    on legacy_binding.dataset_id = dataset.id
    and publication.id is null
    and legacy_binding.dataset_version_created_at =
      dataset.current_version_created_at
    and legacy_binding.resource_id = rop_resource.id
  left join private.reference_resource_versions as rop_version
    on rop_version.id = coalesce(
      rop_member.version_id,
      legacy_binding.resource_version_id
    )
    and rop_version.resource_id = rop_resource.id
  where dataset.is_primary
    and dataset.status = 'ready'
    and exists (
      select 1
      from auth.users as actor
      where actor.id = auth.uid()
        and coalesce(actor.raw_app_meta_data ->> 'workspace_role', 'pro')
          in ('admin', 'super_admin')
    )
  order by dataset.updated_at desc, dataset.id
  limit 1
$$;

comment on function private.analytics_primary_people_groups_metadata() is
  'Returns the approved primary dataset identity and an immutable ROP binding from producer lineage or an explicit reviewed legacy backfill. Runtime lookup never falls back to the active pointer.';
