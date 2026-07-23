alter table private.tier2_forming_runs
  drop constraint if exists tier2_forming_runs_identity_inputs_check,
  add constraint tier2_forming_runs_identity_inputs_check check (
    jsonb_typeof(profile_snapshot -> 'identityInputs') = 'object'
    and coalesce(
      profile_snapshot #>> '{identityInputs,countryVersionId}'
        ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
      false
    )
    and coalesce(
      profile_snapshot #>> '{identityInputs,countryChecksum}'
        ~ '^[0-9a-f]{64}$',
      false
    )
    and coalesce(
      profile_snapshot #>> '{identityInputs,ropVersionId}'
        ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
      false
    )
    and coalesce(
      profile_snapshot #>> '{identityInputs,ropChecksum}'
        ~ '^[0-9a-f]{64}$',
      false
    )
    and coalesce(
      profile_snapshot #>> '{identityInputs,baseRegistryRevisionId}'
        ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
      false
    )
    and coalesce(
      profile_snapshot #>> '{identityInputs,baseRegistryRevisionChecksum}'
        ~ '^[0-9a-f]{64}$',
      false
    )
  ) not valid;

comment on constraint tier2_forming_runs_identity_inputs_check
  on private.tier2_forming_runs is
  'Every Tier 2 candidate snapshots exact Country, ROP, and base AX registry inputs before identity reconciliation.';

create or replace function private.validate_tier2_forming_identity_inputs()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  identity_inputs jsonb := new.profile_snapshot -> 'identityInputs';
begin
  if not exists (
    select 1
    from private.reference_resource_versions as version
    where version.id = (identity_inputs ->> 'countryVersionId')::uuid
      and version.content_checksum = identity_inputs ->> 'countryChecksum'
  ) then
    raise exception 'The pinned Tier 2 Country resource version is unavailable or has the wrong checksum.';
  end if;

  if not exists (
    select 1
    from private.reference_resource_versions as version
    where version.id = (identity_inputs ->> 'ropVersionId')::uuid
      and version.content_checksum = identity_inputs ->> 'ropChecksum'
  ) then
    raise exception 'The pinned Tier 2 ROP resource version is unavailable or has the wrong checksum.';
  end if;

  if not exists (
    select 1
    from private.ax_registry_revisions as revision
    where revision.id = (identity_inputs ->> 'baseRegistryRevisionId')::uuid
      and revision.content_checksum =
        identity_inputs ->> 'baseRegistryRevisionChecksum'
  ) then
    raise exception 'The pinned Tier 2 AX registry revision is unavailable or has the wrong checksum.';
  end if;

  return new;
end;
$$;

drop function if exists private.publish_tier2_pipeline_run(
  uuid, uuid, text, text, text, uuid
);

create function private.publish_tier2_pipeline_run(
  p_run_id uuid,
  p_dataset_id uuid,
  p_actor_owner_id text,
  p_actor_email text,
  p_reason text
)
returns table (publication_id uuid, version_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.pipeline_runs%rowtype;
  definition_record private.pipeline_definitions%rowtype;
  target_record private.tier2_publication_targets%rowtype;
  new_publication_id uuid;
  new_version integer;
  v_producer_kind text;
  v_product_kind text;
begin
  if btrim(coalesce(p_actor_owner_id, '')) = ''
    or btrim(coalesce(p_reason, '')) = ''
  then
    raise exception 'Actor and reason are required.';
  end if;

  select * into run_record
  from private.pipeline_runs
  where id = p_run_id
  for update;
  if not found then
    raise exception 'Pipeline run not found.';
  end if;

  select * into definition_record
  from private.pipeline_definitions
  where definition_key = run_record.definition_key;
  if definition_record.stage not in ('tier2-union', 'aggregate2') then
    raise exception 'Pipeline run is not a Tier 2 product.';
  end if;
  if definition_record.version is distinct from run_record.definition_version
    or definition_record.checksum is distinct from run_record.definition_checksum
  then
    raise exception 'The Tier 2 product definition changed after candidate review.';
  end if;
  if run_record.status <> 'valid' or run_record.error_count <> 0
    or run_record.output_checksum is null
    or run_record.output_row_count is null
  then
    raise exception 'Only a valid, error-free Tier 2 product candidate can publish.';
  end if;
  if not exists (
    select 1
    from private.pipeline_release_sets
    where id = run_record.release_set_id and status = 'finalized'
  ) then
    raise exception 'Tier 2 publication requires a finalized exact release set.';
  end if;
  if (
    select count(*)
    from private.tier2_pipeline_run_rows
    where run_id = p_run_id
  ) <> run_record.output_row_count then
    raise exception 'Stored Tier 2 candidate rows do not match the finalized row count.';
  end if;

  v_product_kind := case definition_record.stage
    when 'tier2-union' then 'tier2'
    else 'aggregate2'
  end;
  v_producer_kind := case v_product_kind
    when 'tier2' then 'tier2-merge'
    else 'aggregate2'
  end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tier2-product-publication:' || definition_record.publication_target_key,
      391744
    )
  );
  select * into target_record
  from private.tier2_publication_targets as target
  where target.product_kind = v_product_kind
  for update;
  if not found then
    raise exception 'Tier 2 stable publication target not found.';
  end if;
  if target_record.current_publication_id is distinct from
    run_record.expected_current_publication_id
  then
    raise exception 'Stable target changed since the candidate was built.';
  end if;

  update private.pipeline_runs
  set status = 'publishing'
  where id = p_run_id;

  insert into private.pipeline_publications (
    producer_kind, producer_run_id, dataset_id, registry_revision_id,
    output_checksum, row_count, artifact_manifest, actor_owner_id,
    actor_email, reason, publication_target_key, producer_definition_key,
    release_set_id
  ) values (
    v_producer_kind, p_run_id, p_dataset_id, run_record.registry_revision_id,
    run_record.output_checksum, run_record.output_row_count,
    run_record.artifact_manifest, p_actor_owner_id, p_actor_email, p_reason,
    definition_record.publication_target_key, definition_record.definition_key,
    run_record.release_set_id
  ) returning id into new_publication_id;

  insert into private.pipeline_publication_rows (
    publication_id, row_index, data
  )
  select new_publication_id, row_index, data
  from private.tier2_pipeline_run_rows
  where run_id = p_run_id
  order by row_index;

  insert into private.pipeline_publication_inputs (
    publication_id, position, input_key, input_publication_id, input_checksum
  )
  select new_publication_id, run_input.position, run_input.input_key,
    run_input.publication_id, run_input.publication_checksum
  from private.pipeline_run_inputs as run_input
  where run_input.run_id = p_run_id
  order by run_input.position;

  new_version := target_record.version_number + 1;
  update private.tier2_publication_targets
  set current_publication_id = new_publication_id,
    version_number = new_version,
    updated_by_owner_id = p_actor_owner_id,
    update_reason = p_reason,
    updated_at = now()
  where tier2_publication_targets.product_kind = v_product_kind;

  update private.pipeline_runs
  set status = 'published', dataset_id = p_dataset_id,
    publication_id = new_publication_id, publication_reason = p_reason,
    published_by_owner_id = p_actor_owner_id, published_at = now(),
    completed_at = coalesce(completed_at, now())
  where id = p_run_id;

  return query select new_publication_id, new_version;
end;
$$;

drop function if exists private.rollback_tier2_publication_target(
  text, uuid, uuid, text, text
);

create function private.rollback_tier2_publication_target(
  p_product_kind text,
  p_publication_id uuid,
  p_expected_current_publication_id uuid,
  p_dataset_id uuid,
  p_actor_owner_id text,
  p_actor_email text,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_record private.tier2_publication_targets%rowtype;
  current_publication private.pipeline_publications%rowtype;
  selected_publication private.pipeline_publications%rowtype;
  current_dataset public.datasets%rowtype;
  new_version integer;
begin
  if btrim(coalesce(p_actor_owner_id, '')) = ''
    or btrim(coalesce(p_reason, '')) = ''
  then
    raise exception 'Actor and reason are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tier2-product-rollback:' || p_product_kind,
      391745
    )
  );
  select * into target_record
  from private.tier2_publication_targets as target
  where target.product_kind = p_product_kind
  for update;
  if not found or target_record.current_publication_id is distinct from
    p_expected_current_publication_id
  then
    raise exception 'Stable target changed since rollback review.';
  end if;

  select * into current_publication
  from private.pipeline_publications
  where id = target_record.current_publication_id;
  select * into selected_publication
  from private.pipeline_publications
  where id = p_publication_id
    and publication_target_key = target_record.publication_target_key;
  if not found then
    raise exception 'Rollback publication does not belong to this stable target.';
  end if;
  if current_publication.dataset_id is distinct from p_dataset_id
    or selected_publication.dataset_id is distinct from p_dataset_id
  then
    raise exception 'Rollback must restore the existing stable dataset.';
  end if;

  select * into current_dataset
  from public.datasets
  where id = p_dataset_id
  for update;
  if not found or current_dataset.status <> 'ready'
    or current_dataset.row_count <> selected_publication.row_count
    or (
      select count(*)
      from public.dataset_rows
      where dataset_id = p_dataset_id
    ) <> selected_publication.row_count
  then
    raise exception 'Rollback dataset rows do not match the selected publication.';
  end if;
  if exists (
    select 1
    from (
      select row_index, data
      from private.pipeline_publication_rows
      where publication_id = p_publication_id
    ) as publication_row
    full join (
      select row_index, data
      from public.dataset_rows
      where dataset_id = p_dataset_id
    ) as dataset_row using (row_index)
    where publication_row.data is distinct from dataset_row.data
  ) then
    raise exception 'Rollback dataset contents do not match the selected publication.';
  end if;

  update public.datasets
  set current_version_action = 'revert',
    current_version_actor_owner_id = p_actor_owner_id,
    current_version_actor_email = p_actor_email
  where id = p_dataset_id;

  new_version := target_record.version_number + 1;
  update private.tier2_publication_targets as target
  set current_publication_id = p_publication_id,
    version_number = new_version,
    updated_by_owner_id = p_actor_owner_id,
    update_reason = p_reason,
    updated_at = now()
  where target.product_kind = p_product_kind;
  return new_version;
end;
$$;

drop trigger if exists tier2_forming_runs_validate_identity_inputs
  on private.tier2_forming_runs;
create trigger tier2_forming_runs_validate_identity_inputs
before insert or update of profile_snapshot on private.tier2_forming_runs
for each row execute function private.validate_tier2_forming_identity_inputs();

alter table private.dataset_forming_runs
  add column if not exists expected_current_publication_id uuid
    references private.pipeline_publications(id) on delete restrict;

create index if not exists dataset_forming_runs_expected_current_publication_idx
  on private.dataset_forming_runs(expected_current_publication_id)
  where expected_current_publication_id is not null;

comment on column private.dataset_forming_runs.expected_current_publication_id is
  'Immutable publication-target snapshot captured when a forming candidate is created; null means that exact target was empty.';

create or replace function private.guard_dataset_forming_publication_pin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.expected_current_publication_id is distinct from
    old.expected_current_publication_id
  then
    raise exception 'The dataset-forming publication target pin is immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists dataset_forming_runs_publication_pin_immutable
  on private.dataset_forming_runs;
create trigger dataset_forming_runs_publication_pin_immutable
before update of expected_current_publication_id
on private.dataset_forming_runs
for each row execute function private.guard_dataset_forming_publication_pin();

create or replace function private.lock_tier2_forming_publication_target(
  p_forming_run_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate record;
  current_publication_id uuid := null;
begin
  select run.status, run.publication_target_key,
    run.expected_current_publication_id
  into candidate
  from private.dataset_forming_runs as run
  join private.tier2_forming_runs as tier2
    on tier2.forming_run_id = run.id
  where run.id = p_forming_run_id
  for update of run;

  if not found then
    raise exception 'Tier 2 forming candidate not found.';
  end if;
  if candidate.status <> 'publishing' then
    raise exception 'Tier 2 forming publication requires a claimed publishing candidate.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tier2-forming-publication:' || candidate.publication_target_key,
      391743
    )
  );

  select publication.id
  into current_publication_id
  from private.pipeline_publications as publication
  where publication.producer_kind = 'tier2-forming'
    and publication.publication_target_key = candidate.publication_target_key
  order by publication.created_at desc, publication.id desc
  limit 1;

  if current_publication_id is distinct from
    candidate.expected_current_publication_id
  then
    raise exception 'The Tier 2 formed-source publication target changed after this candidate was built.';
  end if;
end;
$$;

revoke execute on function private.validate_tier2_forming_identity_inputs()
  from public, anon, authenticated;
revoke execute on function private.guard_dataset_forming_publication_pin()
  from public, anon, authenticated;
revoke execute on function private.lock_tier2_forming_publication_target(uuid)
  from public, anon, authenticated;
grant execute on function private.lock_tier2_forming_publication_target(uuid)
  to service_role;
revoke execute on function private.publish_tier2_pipeline_run(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function private.publish_tier2_pipeline_run(
  uuid, uuid, text, text, text
) to service_role;
revoke execute on function private.rollback_tier2_publication_target(
  text, uuid, uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function private.rollback_tier2_publication_target(
  text, uuid, uuid, uuid, text, text, text
) to service_role;
