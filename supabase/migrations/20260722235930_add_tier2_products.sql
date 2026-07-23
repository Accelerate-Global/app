create extension if not exists pgcrypto with schema extensions;

alter table private.pipeline_definitions
  drop constraint if exists pipeline_definitions_stage_check,
  add constraint pipeline_definitions_stage_check
    check (stage in ('tier1-merge', 'aggregate1', 'tier2-union', 'aggregate2'));

create table private.tier2_contract_resources (
  id uuid primary key default gen_random_uuid(),
  resource_key text not null unique,
  label text not null,
  active_version_id uuid,
  created_at timestamptz not null default now(),
  constraint tier2_contract_resources_key_check
    check (resource_key in ('jp-peopleid3', 'peid', 'engagement-mappings')),
  constraint tier2_contract_resources_label_check check (btrim(label) <> '')
);

create table private.tier2_contract_resource_versions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references private.tier2_contract_resources(id) on delete restrict,
  version_number integer not null,
  lifecycle_state text not null default 'building',
  schema_version integer not null,
  content_checksum text,
  normalized_resource jsonb not null,
  validation_summary jsonb not null default '{}'::jsonb,
  entry_count integer not null default 0,
  source_retrieved_at timestamptz not null,
  created_by_owner_id text not null,
  finalized_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  constraint tier2_contract_resource_versions_version_check check (version_number > 0),
  constraint tier2_contract_resource_versions_state_check
    check (lifecycle_state in ('building', 'valid', 'invalid', 'rejected')),
  constraint tier2_contract_resource_versions_schema_check check (schema_version > 0),
  constraint tier2_contract_resource_versions_checksum_check
    check (content_checksum is null or content_checksum ~ '^[0-9a-f]{64}$'),
  constraint tier2_contract_resource_versions_payload_check
    check (jsonb_typeof(normalized_resource) = 'object'),
  constraint tier2_contract_resource_versions_validation_check
    check (jsonb_typeof(validation_summary) = 'object'),
  constraint tier2_contract_resource_versions_entry_count_check check (entry_count >= 0),
  constraint tier2_contract_resource_versions_actor_check check (btrim(created_by_owner_id) <> ''),
  constraint tier2_contract_resource_versions_finalized_check check (
    lifecycle_state = 'building'
    or (content_checksum is not null and finalized_at is not null)
  ),
  constraint tier2_contract_resource_versions_rejected_check check (
    lifecycle_state <> 'rejected'
    or (rejection_reason is not null and btrim(rejection_reason) <> '')
  ),
  unique (resource_id, version_number),
  unique (id, resource_id),
  unique (id, content_checksum)
);

alter table private.tier2_contract_resources
  add constraint tier2_contract_resources_active_version_fk
  foreign key (active_version_id, id)
  references private.tier2_contract_resource_versions(id, resource_id)
  on delete restrict;

create table private.tier2_contract_resource_activations (
  id bigint generated always as identity primary key,
  resource_id uuid not null references private.tier2_contract_resources(id) on delete restrict,
  version_id uuid not null references private.tier2_contract_resource_versions(id) on delete restrict,
  previous_version_id uuid references private.tier2_contract_resource_versions(id) on delete restrict,
  action text not null,
  reason text not null,
  actor_owner_id text not null,
  actor_email text,
  created_at timestamptz not null default now(),
  constraint tier2_contract_resource_activations_action_check
    check (action in ('activate', 'rollback')),
  constraint tier2_contract_resource_activations_reason_check check (btrim(reason) <> ''),
  constraint tier2_contract_resource_activations_actor_check check (btrim(actor_owner_id) <> '')
);

create table private.tier2_partner_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_key text not null unique,
  partner_key text not null unique,
  display_name text not null,
  api_connection_id uuid not null references private.api_connections(id) on delete restrict,
  spreadsheet_id text not null,
  sheet_id bigint not null,
  sheet_title text not null,
  stable_row_key_column text not null,
  tracking_id_column text not null,
  tracking_id_source text not null,
  source_rop3_column text,
  source_country_column text,
  source_iso3_column text,
  contract_version text not null,
  contract_checksum text not null,
  active boolean not null default true,
  created_by_owner_id text not null,
  updated_by_owner_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tier2_partner_profiles_profile_key_check
    check (profile_key ~ '^[a-z][a-z0-9-]*$'),
  constraint tier2_partner_profiles_partner_key_check
    check (partner_key ~ '^[a-z][a-z0-9-]*$'),
  constraint tier2_partner_profiles_display_check check (btrim(display_name) <> ''),
  constraint tier2_partner_profiles_sheet_check
    check (btrim(spreadsheet_id) <> '' and sheet_id >= 0 and btrim(sheet_title) <> ''),
  constraint tier2_partner_profiles_columns_check check (
    btrim(stable_row_key_column) <> ''
    and btrim(tracking_id_column) <> ''
    and stable_row_key_column <> tracking_id_column
  ),
  constraint tier2_partner_profiles_tracking_check
    check (tracking_id_source in ('peopleid3', 'peid', 'rop3', 'provider-native')),
  constraint tier2_partner_profiles_rop3_tracking_check check (
    tracking_id_source <> 'rop3'
    or source_rop3_column is null
    or source_rop3_column = tracking_id_column
  ),
  constraint tier2_partner_profiles_contract_check
    check (btrim(contract_version) <> '' and contract_checksum ~ '^[0-9a-f]{64}$'),
  constraint tier2_partner_profiles_actor_check
    check (btrim(created_by_owner_id) <> '' and btrim(updated_by_owner_id) <> ''),
  unique (spreadsheet_id, sheet_id)
);

create table private.tier2_partner_profile_resource_bindings (
  id bigint generated always as identity primary key,
  profile_id uuid not null references private.tier2_partner_profiles(id) on delete restrict,
  binding_key text not null,
  reference_resource_version_id uuid references private.reference_resource_versions(id) on delete restrict,
  contract_resource_version_id uuid references private.tier2_contract_resource_versions(id) on delete restrict,
  content_checksum text not null,
  created_by_owner_id text not null,
  created_at timestamptz not null default now(),
  constraint tier2_profile_resource_bindings_key_check check (
    binding_key in ('country-territory-codes', 'rop-codes', 'jp-peopleid3', 'peid', 'engagement-mappings')
  ),
  constraint tier2_profile_resource_bindings_source_check check (
    (binding_key in ('country-territory-codes', 'rop-codes')
      and reference_resource_version_id is not null
      and contract_resource_version_id is null)
    or
    (binding_key in ('jp-peopleid3', 'peid', 'engagement-mappings')
      and reference_resource_version_id is null
      and contract_resource_version_id is not null)
  ),
  constraint tier2_profile_resource_bindings_checksum_check
    check (content_checksum ~ '^[0-9a-f]{64}$'),
  constraint tier2_profile_resource_bindings_actor_check check (btrim(created_by_owner_id) <> ''),
  unique (profile_id, binding_key)
);

create table private.tier2_forming_runs (
  forming_run_id uuid primary key references private.dataset_forming_runs(id) on delete restrict,
  profile_id uuid not null references private.tier2_partner_profiles(id) on delete restrict,
  profile_snapshot jsonb not null,
  profile_checksum text not null,
  source_publication_id uuid references private.pipeline_publications(id) on delete restrict,
  identity_run_id uuid references private.ax_identity_runs(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint tier2_forming_runs_profile_snapshot_check check (jsonb_typeof(profile_snapshot) = 'object'),
  constraint tier2_forming_runs_profile_checksum_check check (profile_checksum ~ '^[0-9a-f]{64}$'),
  unique (source_publication_id),
  unique (identity_run_id)
);

create table private.tier2_pipeline_run_rows (
  id bigint generated always as identity primary key,
  run_id uuid not null references private.pipeline_runs(id) on delete restrict,
  row_index integer not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  constraint tier2_pipeline_run_rows_index_check check (row_index >= 0),
  constraint tier2_pipeline_run_rows_data_check check (jsonb_typeof(data) = 'object'),
  unique (run_id, row_index)
);

create table private.tier2_publication_targets (
  product_kind text primary key,
  publication_target_key text not null unique,
  current_publication_id uuid references private.pipeline_publications(id) on delete restrict,
  version_number integer not null default 0,
  updated_by_owner_id text,
  update_reason text,
  updated_at timestamptz,
  constraint tier2_publication_targets_kind_check check (product_kind in ('tier2', 'aggregate2')),
  constraint tier2_publication_targets_key_check check (publication_target_key ~ '^[a-z][a-z0-9-]*$'),
  constraint tier2_publication_targets_version_check check (version_number >= 0),
  constraint tier2_publication_targets_audit_check check (
    current_publication_id is null
    or (updated_by_owner_id is not null and btrim(updated_by_owner_id) <> ''
      and update_reason is not null and btrim(update_reason) <> ''
      and updated_at is not null)
  )
);

create index tier2_partner_profiles_active_idx
  on private.tier2_partner_profiles(active, partner_key, id);
create index tier2_profile_bindings_version_idx
  on private.tier2_partner_profile_resource_bindings(contract_resource_version_id, profile_id)
  where contract_resource_version_id is not null;
create index tier2_forming_runs_profile_idx
  on private.tier2_forming_runs(profile_id, created_at desc, forming_run_id);
create index tier2_pipeline_run_rows_run_idx
  on private.tier2_pipeline_run_rows(run_id, row_index);

create or replace function private.validate_tier2_partner_profile_sheet()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  connection_provider text;
  connection_config jsonb;
begin
  select provider, provider_config
  into connection_provider, connection_config
  from private.api_connections
  where id = new.api_connection_id;

  if connection_provider is distinct from 'google_sheets' then
    raise exception 'Tier 2 partner profiles require a Google Sheets connection.';
  end if;
  if connection_config ->> 'spreadsheetId' is distinct from new.spreadsheet_id
    or nullif(connection_config ->> 'sheetId', '')::bigint is distinct from new.sheet_id then
    raise exception 'Tier 2 partner profile Sheet identity must match its connection.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_tier2_partner_profile_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from private.tier2_forming_runs where profile_id = old.id
  ) and (
    new.profile_key is distinct from old.profile_key
    or new.partner_key is distinct from old.partner_key
    or new.api_connection_id is distinct from old.api_connection_id
    or new.spreadsheet_id is distinct from old.spreadsheet_id
    or new.sheet_id is distinct from old.sheet_id
    or new.stable_row_key_column is distinct from old.stable_row_key_column
  ) then
    raise exception 'A used Tier 2 profile cannot change stable identity fields.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.guard_tier2_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Tier 2 evidence is append-only.';
end;
$$;

create or replace function private.guard_tier2_contract_resource_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.lifecycle_state <> 'building'
      or exists (
        select 1 from private.tier2_contract_resources
        where active_version_id = old.id
      ) then
      raise exception 'Finalized Tier 2 contract resource versions are immutable.';
    end if;
    return old;
  end if;
  if old.lifecycle_state <> 'building' then
    raise exception 'Finalized Tier 2 contract resource versions are immutable.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_tier2_forming_run_links()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Tier 2 forming lineage is append-only.';
  end if;
  if new.forming_run_id is distinct from old.forming_run_id
    or new.profile_id is distinct from old.profile_id
    or new.profile_snapshot is distinct from old.profile_snapshot
    or new.profile_checksum is distinct from old.profile_checksum
    or new.created_at is distinct from old.created_at
    or (old.source_publication_id is not null
      and new.source_publication_id is distinct from old.source_publication_id)
    or (old.identity_run_id is not null
      and new.identity_run_id is distinct from old.identity_run_id)
  then
    raise exception 'Tier 2 forming lineage is immutable after binding.';
  end if;
  return new;
end;
$$;

create or replace function private.activate_tier2_contract_resource_version(
  p_version_id uuid,
  p_actor_owner_id text,
  p_actor_email text,
  p_reason text,
  p_action text default 'activate'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_version private.tier2_contract_resource_versions%rowtype;
  previous_version_id uuid;
begin
  if btrim(coalesce(p_actor_owner_id, '')) = '' or btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Actor and reason are required.';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('tier2-contract-resources', 0)
  );
  if p_action not in ('activate', 'rollback') then
    raise exception 'Unsupported activation action.';
  end if;
  select * into target_version
  from private.tier2_contract_resource_versions
  where id = p_version_id
  for update;
  if not found or target_version.lifecycle_state <> 'valid'
    or target_version.content_checksum is null
    or coalesce((target_version.validation_summary ->> 'errorCount')::integer, 0) <> 0 then
    raise exception 'Only a valid error-free Tier 2 resource version can activate.';
  end if;
  select active_version_id into previous_version_id
  from private.tier2_contract_resources
  where id = target_version.resource_id
  for update;
  update private.tier2_contract_resources
  set active_version_id = target_version.id
  where id = target_version.resource_id;
  insert into private.tier2_contract_resource_activations (
    resource_id, version_id, previous_version_id, action, reason,
    actor_owner_id, actor_email
  ) values (
    target_version.resource_id, target_version.id, previous_version_id, p_action,
    p_reason, p_actor_owner_id, p_actor_email
  );
end;
$$;

create or replace function private.finalize_tier2_release_set(
  p_release_set_id uuid,
  p_actor_owner_id text,
  p_actor_email text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  release_record private.pipeline_release_sets%rowtype;
  expected_keys text[];
  selected_keys text[];
  release_checksum text;
begin
  if btrim(coalesce(p_actor_owner_id, '')) = '' or btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Actor and reason are required.';
  end if;
  select * into release_record
  from private.pipeline_release_sets
  where id = p_release_set_id
  for update;
  if not found or release_record.status <> 'draft' then
    raise exception 'Only a draft release set can be finalized.';
  end if;

  if release_record.release_key = 'tier2-complete-partners' then
    select coalesce(array_agg(profile_key order by profile_key), array[]::text[])
    into expected_keys
    from private.tier2_partner_profiles
    where active;
    if cardinality(expected_keys) = 0 then
      raise exception 'Tier 2 has no active required partner profiles.';
    end if;
  elsif release_record.release_key = 'aggregate2-exact-union' then
    expected_keys := array['tier2', 'imb', 'jp']::text[];
  else
    raise exception 'Unsupported Tier 2 release key %.', release_record.release_key;
  end if;

  select coalesce(array_agg(input_key order by position), array[]::text[])
  into selected_keys
  from private.pipeline_release_members
  where release_set_id = p_release_set_id;

  if selected_keys is distinct from expected_keys then
    raise exception 'Release membership is incomplete or unexpected. Expected %, selected %.',
      expected_keys, selected_keys;
  end if;
  if exists (
    select 1
    from private.pipeline_release_members as member
    join private.pipeline_publications as publication on publication.id = member.publication_id
    where member.release_set_id = p_release_set_id
      and member.publication_checksum is distinct from publication.output_checksum
  ) then
    raise exception 'Release member checksum no longer matches its exact publication.';
  end if;
  if not exists (
    select 1 from private.ax_registry_revisions
    where id = release_record.registry_revision_id
  ) then
    raise exception 'The selected AX registry revision no longer exists.';
  end if;
  if exists (
    with recursive publication_lineage (
      publication_id, producer_kind, producer_run_id, registry_revision_id
    ) as (
      select publication.id, publication.producer_kind,
        publication.producer_run_id, publication.registry_revision_id
      from private.pipeline_release_members as member
      join private.pipeline_publications as publication
        on publication.id = member.publication_id
      where member.release_set_id = p_release_set_id
      union
      select input_publication.id, input_publication.producer_kind,
        input_publication.producer_run_id, input_publication.registry_revision_id
      from publication_lineage as parent
      join private.pipeline_publication_inputs as lineage_input
        on lineage_input.publication_id = parent.publication_id
      join private.pipeline_publications as input_publication
        on input_publication.id = lineage_input.input_publication_id
    )
    select 1
    from publication_lineage as lineage
    cross join private.ax_registry_revisions as selected
    left join private.ax_registry_revisions as origin
      on origin.id = lineage.registry_revision_id
    where selected.id = release_record.registry_revision_id
      and (
        origin.id is null
        or selected.revision_number < origin.revision_number
      )
  ) then
    raise exception 'The selected AX registry revision predates an exact release publication.';
  end if;
  if exists (
    with recursive publication_lineage (
      publication_id, producer_kind, producer_run_id
    ) as (
      select publication.id, publication.producer_kind,
        publication.producer_run_id
      from private.pipeline_release_members as member
      join private.pipeline_publications as publication
        on publication.id = member.publication_id
      where member.release_set_id = p_release_set_id
      union
      select input_publication.id, input_publication.producer_kind,
        input_publication.producer_run_id
      from publication_lineage as parent
      join private.pipeline_publication_inputs as lineage_input
        on lineage_input.publication_id = parent.publication_id
      join private.pipeline_publications as input_publication
        on input_publication.id = lineage_input.input_publication_id
    )
    select 1
    from publication_lineage as lineage
    join private.ax_identity_run_rows as run_row
      on lineage.producer_kind = 'identity'
      and run_row.identity_run_id = lineage.producer_run_id
      and run_row.binding_id is not null
    where not exists (
      select 1
      from private.ax_registry_revision_bindings as revision_binding
      where revision_binding.revision_id = release_record.registry_revision_id
        and revision_binding.binding_id = run_row.binding_id
    )
  ) then
    raise exception 'The selected AX registry revision no longer contains every exact identity binding.';
  end if;

  select encode(
    extensions.digest(
      concat_ws(
        '|', release_record.release_key, release_record.resource_set_id::text,
        release_record.registry_revision_id::text, release_record.rule_version,
        release_record.rule_checksum,
        string_agg(
          member.position::text || ':' || member.input_key || ':' ||
          member.publication_id::text || ':' || member.publication_checksum,
          '|' order by member.position
        )
      ),
      'sha256'
    ),
    'hex'
  )
  into release_checksum
  from private.pipeline_release_members as member
  where member.release_set_id = p_release_set_id;

  update private.pipeline_release_sets
  set status = 'finalized', canonical_checksum = release_checksum,
      finalized_by_owner_id = p_actor_owner_id,
      finalized_by_email = p_actor_email, finalization_reason = p_reason,
      finalized_at = now()
  where id = p_release_set_id;
  return release_checksum;
end;
$$;

create or replace function private.publish_tier2_pipeline_run(
  p_run_id uuid,
  p_dataset_id uuid,
  p_actor_owner_id text,
  p_actor_email text,
  p_reason text,
  p_expected_current_publication_id uuid default null
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
  if btrim(coalesce(p_actor_owner_id, '')) = '' or btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Actor and reason are required.';
  end if;
  select * into run_record from private.pipeline_runs where id = p_run_id for update;
  if not found then raise exception 'Pipeline run not found.'; end if;
  select * into definition_record
  from private.pipeline_definitions
  where definition_key = run_record.definition_key;
  if definition_record.stage not in ('tier2-union', 'aggregate2') then
    raise exception 'Pipeline run is not a Tier 2 product.';
  end if;
  if definition_record.version is distinct from run_record.definition_version
    or definition_record.checksum is distinct from run_record.definition_checksum then
    raise exception 'The Tier 2 product definition changed after candidate review.';
  end if;
  if run_record.status <> 'valid' or run_record.error_count <> 0
    or run_record.output_checksum is null or run_record.output_row_count is null then
    raise exception 'Only a valid, error-free Tier 2 product candidate can publish.';
  end if;
  if not exists (
    select 1 from private.pipeline_release_sets
    where id = run_record.release_set_id and status = 'finalized'
  ) then
    raise exception 'Tier 2 publication requires a finalized exact release set.';
  end if;
  if (select count(*) from private.tier2_pipeline_run_rows where run_id = p_run_id)
    <> run_record.output_row_count then
    raise exception 'Stored Tier 2 candidate rows do not match the finalized row count.';
  end if;

  v_product_kind := case definition_record.stage when 'tier2-union' then 'tier2' else 'aggregate2' end;
  v_producer_kind := case v_product_kind when 'tier2' then 'tier2-merge' else 'aggregate2' end;
  select * into target_record
  from private.tier2_publication_targets as target
  where target.product_kind = v_product_kind
  for update;
  if target_record.current_publication_id is distinct from p_expected_current_publication_id then
    raise exception 'Stable target changed since it was reviewed.';
  end if;

  update private.pipeline_runs set status = 'publishing' where id = p_run_id;
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

  insert into private.pipeline_publication_rows (publication_id, row_index, data)
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
  set current_publication_id = new_publication_id, version_number = new_version,
      updated_by_owner_id = p_actor_owner_id, update_reason = p_reason,
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

create or replace function private.rollback_tier2_publication_target(
  p_product_kind text,
  p_publication_id uuid,
  p_expected_current_publication_id uuid,
  p_actor_owner_id text,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_record private.tier2_publication_targets%rowtype;
  new_version integer;
begin
  if btrim(coalesce(p_actor_owner_id, '')) = '' or btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Actor and reason are required.';
  end if;
  select * into target_record from private.tier2_publication_targets as target
  where target.product_kind = p_product_kind for update;
  if not found or target_record.current_publication_id is distinct from p_expected_current_publication_id then
    raise exception 'Stable target changed since rollback review.';
  end if;
  if not exists (
    select 1 from private.pipeline_publications
    where id = p_publication_id
      and publication_target_key = target_record.publication_target_key
  ) then
    raise exception 'Rollback publication does not belong to this stable target.';
  end if;
  new_version := target_record.version_number + 1;
  update private.tier2_publication_targets as target
  set current_publication_id = p_publication_id, version_number = new_version,
      updated_by_owner_id = p_actor_owner_id, update_reason = p_reason,
      updated_at = now()
  where target.product_kind = p_product_kind;
  return new_version;
end;
$$;

create trigger tier2_partner_profiles_validate_sheet
before insert or update on private.tier2_partner_profiles
for each row execute function private.validate_tier2_partner_profile_sheet();
create trigger tier2_partner_profiles_guard_identity
before update on private.tier2_partner_profiles
for each row execute function private.guard_tier2_partner_profile_identity();
create trigger tier2_contract_resource_activations_append_only
before update or delete on private.tier2_contract_resource_activations
for each row execute function private.guard_tier2_append_only();
create trigger tier2_contract_resource_versions_immutable
before update or delete on private.tier2_contract_resource_versions
for each row execute function private.guard_tier2_contract_resource_version();
create trigger tier2_forming_runs_append_only
before update or delete on private.tier2_forming_runs
for each row execute function private.guard_tier2_forming_run_links();
create trigger tier2_pipeline_run_rows_append_only
before update or delete on private.tier2_pipeline_run_rows
for each row execute function private.guard_tier2_append_only();

alter table private.tier2_contract_resources enable row level security;
alter table private.tier2_contract_resource_versions enable row level security;
alter table private.tier2_contract_resource_activations enable row level security;
alter table private.tier2_partner_profiles enable row level security;
alter table private.tier2_partner_profile_resource_bindings enable row level security;
alter table private.tier2_forming_runs enable row level security;
alter table private.tier2_pipeline_run_rows enable row level security;
alter table private.tier2_publication_targets enable row level security;

revoke all on private.tier2_contract_resources from public, anon, authenticated;
revoke all on private.tier2_contract_resource_versions from public, anon, authenticated;
revoke all on private.tier2_contract_resource_activations from public, anon, authenticated;
revoke all on private.tier2_partner_profiles from public, anon, authenticated;
revoke all on private.tier2_partner_profile_resource_bindings from public, anon, authenticated;
revoke all on private.tier2_forming_runs from public, anon, authenticated;
revoke all on private.tier2_pipeline_run_rows from public, anon, authenticated;
revoke all on private.tier2_publication_targets from public, anon, authenticated;
revoke all on sequence private.tier2_contract_resource_activations_id_seq from public, anon, authenticated;
revoke all on sequence private.tier2_partner_profile_resource_bindings_id_seq from public, anon, authenticated;
revoke all on sequence private.tier2_pipeline_run_rows_id_seq from public, anon, authenticated;
revoke execute on function private.validate_tier2_partner_profile_sheet() from public, anon, authenticated;
revoke execute on function private.guard_tier2_partner_profile_identity() from public, anon, authenticated;
revoke execute on function private.guard_tier2_append_only() from public, anon, authenticated;
revoke execute on function private.guard_tier2_contract_resource_version() from public, anon, authenticated;
revoke execute on function private.guard_tier2_forming_run_links() from public, anon, authenticated;
revoke execute on function private.activate_tier2_contract_resource_version(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function private.finalize_tier2_release_set(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function private.publish_tier2_pipeline_run(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function private.rollback_tier2_publication_target(text, uuid, uuid, text, text) from public, anon, authenticated;

grant all on private.tier2_contract_resources to service_role;
grant all on private.tier2_contract_resource_versions to service_role;
grant all on private.tier2_contract_resource_activations to service_role;
grant all on private.tier2_partner_profiles to service_role;
grant all on private.tier2_partner_profile_resource_bindings to service_role;
grant all on private.tier2_forming_runs to service_role;
grant all on private.tier2_pipeline_run_rows to service_role;
grant all on private.tier2_publication_targets to service_role;
grant usage, select on sequence private.tier2_contract_resource_activations_id_seq to service_role;
grant usage, select on sequence private.tier2_partner_profile_resource_bindings_id_seq to service_role;
grant usage, select on sequence private.tier2_pipeline_run_rows_id_seq to service_role;
grant execute on function private.activate_tier2_contract_resource_version(uuid, text, text, text, text) to service_role;
grant execute on function private.finalize_tier2_release_set(uuid, text, text, text) to service_role;
grant execute on function private.publish_tier2_pipeline_run(uuid, uuid, text, text, text, uuid) to service_role;
grant execute on function private.rollback_tier2_publication_target(text, uuid, uuid, text, text) to service_role;

insert into private.tier2_contract_resources (resource_key, label)
values
  ('jp-peopleid3', 'Joshua Project PeopleID3 crosswalk'),
  ('peid', 'PEID crosswalk'),
  ('engagement-mappings', 'Engagement field and template mappings')
on conflict (resource_key) do update set label = excluded.label;

insert into private.pipeline_definitions (
  definition_key, stage, display_name, version, checksum, required_input_keys,
  output_classification, publication_target_key, is_workspace_visible
)
values
  (
    'tier2-complete-partners', 'tier2-union',
    'Tier 2 provenance-preserving partner union', 'v1',
    '1641ad4635a3a7dc4b18102538bef5f046caecd51348fa9a1145f0324a3fd315',
    '[]'::jsonb, 'PGIC', 'tier2-pgic', true
  ),
  (
    'aggregate2-exact-union', 'aggregate2',
    'Aggregate 2 Combined Release', 'v1',
    '278dee49fd8a6a4b678b24bbb5c97350a479a05d042d8c175d4870d00f9a0be9',
    '["tier2","imb","jp"]'::jsonb, 'PGIC',
    'aggregate2-pgic', true
  )
on conflict (definition_key) do update
set stage = excluded.stage,
    display_name = excluded.display_name,
    version = excluded.version,
    checksum = excluded.checksum,
    required_input_keys = excluded.required_input_keys,
    output_classification = excluded.output_classification,
    publication_target_key = excluded.publication_target_key,
    is_workspace_visible = excluded.is_workspace_visible,
    active = true;

insert into private.tier2_publication_targets (product_kind, publication_target_key)
values ('tier2', 'tier2-pgic'), ('aggregate2', 'aggregate2-pgic')
on conflict (product_kind) do nothing;
