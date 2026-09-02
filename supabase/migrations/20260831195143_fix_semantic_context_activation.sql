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
set search_path = ''
as $$
declare
  target_resource private.reference_resources%rowtype;
  target_version private.reference_resource_versions%rowtype;
  resource_set_id uuid;
  resource_set_checksum text;
begin
  if pg_catalog.btrim(coalesce(p_actor_owner_id, '')) = ''
    or pg_catalog.btrim(coalesce(p_reason, '')) = '' then
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_resource.id::text, 0)
  );

  if target_resource.active_version_id is distinct from p_expected_active_version_id then
    raise exception 'Reference resource active version changed.' using errcode = '40001';
  end if;

  if target_resource.active_version_id = p_version_id then
    raise exception 'Reference resource version is already active.' using errcode = '22023';
  end if;

  select * into target_version
  from private.reference_resource_versions
  where id = p_version_id and resource_id = target_resource.id;

  if not found or target_version.lifecycle_state <> 'valid'
    or target_version.content_checksum is null then
    raise exception 'Only a complete valid version can be activated.' using errcode = '23514';
  end if;

  perform pg_catalog.set_config('app.reference_resource_activation', 'allowed', true);
  update private.reference_resources
  set active_version_id = target_version.id, updated_at = pg_catalog.now()
  where id = target_resource.id;
  perform pg_catalog.set_config('app.reference_resource_activation', '', true);

  insert into private.reference_resource_activation_events (
    resource_id, previous_version_id, selected_version_id, action,
    actor_owner_id, reason
  ) values (
    target_resource.id, target_resource.active_version_id, target_version.id,
    p_action, p_actor_owner_id, pg_catalog.btrim(p_reason)
  );

  if target_resource.resource_kind = 'semantic-catalog' then
    select id into resource_set_id
    from private.reference_resource_sets
    order by sequence_number desc
    limit 1;
    return resource_set_id;
  end if;

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.string_agg(
          resource_key || ':' || active_version_id::text,
          '|' order by resource_key
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) into resource_set_checksum
  from private.reference_resources
  where active_version_id is not null
    and resource_kind <> 'semantic-catalog';

  insert into private.reference_resource_sets (
    content_checksum, created_by_owner_id, reason
  ) values (
    resource_set_checksum, p_actor_owner_id, pg_catalog.btrim(p_reason)
  ) returning id into resource_set_id;

  insert into private.reference_resource_set_members (
    set_id, resource_id, version_id
  )
  select resource_set_id, id, active_version_id
  from private.reference_resources
  where active_version_id is not null
    and resource_kind <> 'semantic-catalog'
  order by resource_key;

  return resource_set_id;
end;
$$;

revoke all on function private.activate_reference_resource(
  text, uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function private.activate_reference_resource(
  text, uuid, uuid, text, text, text
) to service_role;
