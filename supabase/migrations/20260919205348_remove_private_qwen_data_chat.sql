-- Remove the retired Private Data Chat database surface without cascading into
-- shared datasets or generic reference resources. Preconditions intentionally
-- fail closed so an operator must investigate any unexpected dependency.

do $$
declare
  semantic_resource_count integer;
  unexpected_vector_columns integer;
begin
  select count(*) into semantic_resource_count
  from private.reference_resources
  where resource_key = 'semantic-context-catalog';

  if semantic_resource_count > 1 then
    raise exception 'Expected at most one semantic-context-catalog resource.';
  end if;

  if exists (
    select 1
    from private.reference_resources
    where resource_key = 'semantic-context-catalog'
      and resource_kind <> 'semantic-catalog'
  ) then
    raise exception 'semantic-context-catalog has an unexpected resource kind.';
  end if;

  if exists (
    select 1
    from private.reference_resource_set_members as member
    join private.reference_resources as resource
      on resource.id = member.resource_id
    where resource.resource_key = 'semantic-context-catalog'
  ) then
    raise exception 'Semantic context is present in a shared resource set.';
  end if;

  if exists (
    select 1
    from pg_stat_activity
    where usename = 'analytics_chat_login'
      and pid <> pg_backend_pid()
  ) then
    raise exception 'analytics_chat_login still has active sessions.';
  end if;

  select count(*) into unexpected_vector_columns
  from pg_attribute as attribute
  join pg_class as relation on relation.oid = attribute.attrelid
  join pg_namespace as namespace on namespace.oid = relation.relnamespace
  where attribute.atttypid = to_regtype('extensions.vector')
    and attribute.attnum > 0
    and not attribute.attisdropped
    and not (
      namespace.nspname = 'private'
      and relation.relname = 'analytics_semantic_context_embeddings'
      and attribute.attname = 'embedding'
    );

  if unexpected_vector_columns > 0 then
    raise exception 'The vector extension has non-Qwen column dependencies.';
  end if;

  if exists (
    select 1
    from pg_shdepend as dependency
    join pg_roles as role
      on role.oid = dependency.refobjid
    where dependency.refclassid = 'pg_authid'::regclass
      and dependency.deptype = 'o'
      and role.rolname in ('analytics_chat_login', 'analytics_chat_reader')
  ) then
    raise exception 'A Qwen database role unexpectedly owns a database object.';
  end if;
end
$$;

drop view if exists analytics_ro.primary_people_groups_metadata;
drop view if exists analytics_ro.primary_people_groups;

drop function if exists private.analytics_primary_people_groups_metadata();
drop function if exists private.analytics_primary_people_groups_rows();
drop function if exists private.consume_analytics_chat_continuation_token(
  text,
  timestamptz
);

drop table if exists private.analytics_chat_dataset_resource_bindings;
drop function if exists private.guard_analytics_chat_dataset_resource_binding();
drop table if exists private.analytics_chat_continuation_uses;
drop table if exists private.analytics_chat_audit;
drop table if exists private.analytics_semantic_context_embeddings;

drop schema if exists analytics_ro;

drop trigger if exists reference_resource_findings_append_only
  on private.reference_resource_validation_findings;
drop trigger if exists reference_resource_events_append_only
  on private.reference_resource_activation_events;
drop trigger if exists pipeline_reference_entries_immutable
  on private.pipeline_reference_entries;
drop trigger if exists reference_resource_versions_immutable
  on private.reference_resource_versions;

select set_config('app.reference_resource_activation', 'allowed', true);
update private.reference_resources
set active_version_id = null,
    updated_at = now()
where resource_key = 'semantic-context-catalog';
select set_config('app.reference_resource_activation', '', true);

delete from private.reference_resource_activation_events as event
using private.reference_resources as resource
where event.resource_id = resource.id
  and resource.resource_key = 'semantic-context-catalog';

delete from private.reference_resource_validation_findings as finding
using private.reference_resource_versions as version,
  private.reference_resources as resource
where finding.version_id = version.id
  and version.resource_id = resource.id
  and resource.resource_key = 'semantic-context-catalog';

delete from private.pipeline_reference_entries as entry
using private.reference_resource_versions as version,
  private.reference_resources as resource
where entry.version_id = version.id
  and version.resource_id = resource.id
  and resource.resource_key = 'semantic-context-catalog';

delete from private.reference_resource_versions as version
using private.reference_resources as resource
where version.resource_id = resource.id
  and resource.resource_key = 'semantic-context-catalog';

delete from private.reference_resources
where resource_key = 'semantic-context-catalog';

create trigger reference_resource_findings_append_only
before update or delete on private.reference_resource_validation_findings
for each row execute function private.prevent_reference_audit_mutation();

create trigger reference_resource_events_append_only
before update or delete on private.reference_resource_activation_events
for each row execute function private.prevent_reference_audit_mutation();

create trigger pipeline_reference_entries_immutable
before insert or update or delete on private.pipeline_reference_entries
for each row execute function private.prevent_finalized_reference_projection_mutation();

create trigger reference_resource_versions_immutable
before update or delete on private.reference_resource_versions
for each row execute function private.prevent_finalized_reference_version_mutation();

drop index if exists private.pipeline_reference_entries_search_document_idx;
alter table private.pipeline_reference_entries
  drop column if exists search_document;

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
  if btrim(coalesce(p_actor_owner_id, '')) = ''
    or btrim(coalesce(p_reason, '')) = '' then
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

  if not found
    or target_version.lifecycle_state <> 'valid'
    or target_version.content_checksum is null then
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
        string_agg(
          resource_key || ':' || active_version_id::text,
          '|'
          order by resource_key
        ),
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

revoke all on function private.activate_reference_resource(
  text,
  uuid,
  uuid,
  text,
  text,
  text
) from public, anon, authenticated;

drop extension if exists vector;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'analytics_chat_login') then
    revoke analytics_chat_reader from analytics_chat_login;
    grant analytics_chat_login to postgres;
    execute 'drop owned by analytics_chat_login';
    revoke analytics_chat_login from postgres;
    drop role analytics_chat_login;
  end if;

  if exists (select 1 from pg_roles where rolname = 'analytics_chat_reader') then
    execute 'drop owned by analytics_chat_reader';
    revoke analytics_chat_reader from postgres;
    drop role analytics_chat_reader;
  end if;
end
$$;
