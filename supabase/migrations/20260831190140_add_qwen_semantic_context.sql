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
      'field-mapping',
      'semantic-catalog'
    )
  );

insert into private.reference_resources (
  resource_key,
  resource_kind,
  label,
  description,
  route_path,
  sort_order
)
values (
  'semantic-context-catalog',
  'semantic-catalog',
  'Private Qwen semantic context',
  'Reviewed field, filter, metric, resource, relationship, and semantic-plan guidance used by private Qwen chat.',
  '/dashboard/resources/semantic-context-catalog',
  80
)
on conflict (resource_key) do update
set
  resource_kind = excluded.resource_kind,
  label = excluded.label,
  description = excluded.description,
  route_path = excluded.route_path,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table private.pipeline_reference_entries
  add column if not exists search_document tsvector
  generated always as (
    to_tsvector('english'::regconfig, coalesce(search_text, ''))
  ) stored;

create index if not exists pipeline_reference_entries_search_document_idx
  on private.pipeline_reference_entries using gin (search_document);

create extension if not exists vector with schema extensions;

create table if not exists private.analytics_semantic_context_embeddings (
  resource_version_id uuid not null
    references private.reference_resource_versions(id) on delete cascade,
  stable_key text not null check (length(stable_key) between 1 and 200),
  artifact_sha256 text not null check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  runtime_revision text not null check (length(runtime_revision) between 1 and 100),
  instruction_sha256 text not null check (instruction_sha256 ~ '^[0-9a-f]{64}$'),
  dimensions integer not null check (dimensions = 1024),
  embedding extensions.vector(1024) not null,
  created_at timestamptz not null default now(),
  primary key (
    resource_version_id,
    stable_key,
    artifact_sha256,
    instruction_sha256
  )
);

create index if not exists analytics_semantic_context_embeddings_manifest_idx
  on private.analytics_semantic_context_embeddings (
    resource_version_id,
    artifact_sha256,
    instruction_sha256,
    stable_key
  );

alter table private.analytics_semantic_context_embeddings enable row level security;
alter table private.analytics_semantic_context_embeddings force row level security;
revoke all on private.analytics_semantic_context_embeddings
  from public, anon, authenticated, service_role,
    analytics_chat_login, analytics_chat_reader;

comment on table private.analytics_semantic_context_embeddings is
  'Optional exact-search Qwen3 embedding projection for reviewed semantic cards. No approximate vector index, prompt, result row, credential, or unrestricted value domain is stored.';

alter table private.analytics_chat_audit
  add column if not exists matching_count integer,
  add column if not exists requested_limit integer,
  add column if not exists query_mode text,
  add column if not exists named_filter_keys jsonb not null default '[]'::jsonb,
  add column if not exists resource_key text,
  add column if not exists resource_operation text,
  add column if not exists resource_version_id uuid,
  add column if not exists retrieval_audience text,
  add column if not exists semantic_snapshot_checksum text,
  add column if not exists retrieval_policy_checksum text,
  add column if not exists retrieval_tier text,
  add column if not exists retrieved_card_keys jsonb not null default '[]'::jsonb,
  add column if not exists retrieved_card_checksums jsonb not null default '[]'::jsonb,
  add column if not exists retrieval_latency_ms integer,
  add column if not exists context_bytes integer;

alter table private.analytics_chat_audit
  drop constraint if exists analytics_chat_audit_matching_count_check,
  add constraint analytics_chat_audit_matching_count_check
    check (matching_count is null or matching_count >= 0),
  drop constraint if exists analytics_chat_audit_requested_limit_check,
  add constraint analytics_chat_audit_requested_limit_check
    check (requested_limit is null or requested_limit between 1 and 100),
  drop constraint if exists analytics_chat_audit_query_mode_check,
  add constraint analytics_chat_audit_query_mode_check
    check (query_mode is null or query_mode in ('aggregate', 'records', 'resource')),
  drop constraint if exists analytics_chat_audit_named_filters_check,
  add constraint analytics_chat_audit_named_filters_check
    check (jsonb_typeof(named_filter_keys) = 'array'),
  drop constraint if exists analytics_chat_audit_resource_key_check,
  add constraint analytics_chat_audit_resource_key_check
    check (resource_key is null or resource_key = 'rop-codes'),
  drop constraint if exists analytics_chat_audit_resource_operation_check,
  add constraint analytics_chat_audit_resource_operation_check
    check (
      resource_operation is null
      or resource_operation in ('search', 'list', 'lookup', 'count', 'continue')
    ),
  drop constraint if exists analytics_chat_audit_resource_shape_check,
  add constraint analytics_chat_audit_resource_shape_check
    check (
      (query_mode = 'resource'
        and resource_key is not null
        and resource_operation is not null)
      or
      (query_mode is distinct from 'resource'
        and resource_key is null
        and resource_operation is null
        and resource_version_id is null)
    ),
  drop constraint if exists analytics_chat_audit_retrieval_audience_check,
  add constraint analytics_chat_audit_retrieval_audience_check
    check (retrieval_audience is null or retrieval_audience in ('planner', 'answer')),
  drop constraint if exists analytics_chat_audit_semantic_snapshot_check,
  add constraint analytics_chat_audit_semantic_snapshot_check
    check (
      semantic_snapshot_checksum is null
      or semantic_snapshot_checksum ~ '^[0-9a-f]{64}$'
    ),
  drop constraint if exists analytics_chat_audit_retrieval_policy_check,
  add constraint analytics_chat_audit_retrieval_policy_check
    check (
      retrieval_policy_checksum is null
      or retrieval_policy_checksum ~ '^[0-9a-f]{64}$'
    ),
  drop constraint if exists analytics_chat_audit_retrieval_tier_check,
  add constraint analytics_chat_audit_retrieval_tier_check
    check (
      retrieval_tier is null
      or retrieval_tier in (
        'exact-postgres-lexical',
        'exact-pgvector-rrf',
        'exact-pgvector-rrf-rerank'
      )
    ),
  drop constraint if exists analytics_chat_audit_retrieved_cards_check,
  add constraint analytics_chat_audit_retrieved_cards_check
    check (
      jsonb_typeof(retrieved_card_keys) = 'array'
      and jsonb_array_length(retrieved_card_keys) <= 6
      and jsonb_typeof(retrieved_card_checksums) = 'array'
      and jsonb_array_length(retrieved_card_checksums) =
        jsonb_array_length(retrieved_card_keys)
    ),
  drop constraint if exists analytics_chat_audit_retrieval_latency_check,
  add constraint analytics_chat_audit_retrieval_latency_check
    check (retrieval_latency_ms is null or retrieval_latency_ms >= 0),
  drop constraint if exists analytics_chat_audit_context_bytes_check,
  add constraint analytics_chat_audit_context_bytes_check
    check (context_bytes is null or context_bytes between 0 and 8192),
  drop constraint if exists analytics_chat_audit_retrieval_shape_check,
  add constraint analytics_chat_audit_retrieval_shape_check
    check (
      (retrieval_tier is null
        and retrieval_audience is null
        and semantic_snapshot_checksum is null
        and retrieval_policy_checksum is null
        and jsonb_array_length(retrieved_card_keys) = 0
        and jsonb_array_length(retrieved_card_checksums) = 0
        and retrieval_latency_ms is null
        and context_bytes is null)
      or
      (retrieval_tier is not null
        and retrieval_audience is not null
        and semantic_snapshot_checksum is not null
        and retrieval_policy_checksum is not null
        and jsonb_array_length(retrieved_card_keys) > 0
        and retrieval_latency_ms is not null
        and context_bytes is not null)
    );

create table if not exists private.analytics_chat_continuation_uses (
  token_hash text primary key
    check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz not null default now(),
  constraint analytics_chat_continuation_expiry_check
    check (expires_at > used_at - interval '1 minute')
);

create index if not exists analytics_chat_continuation_expiry_idx
  on private.analytics_chat_continuation_uses (expires_at);

alter table private.analytics_chat_continuation_uses enable row level security;
alter table private.analytics_chat_continuation_uses force row level security;
revoke all on private.analytics_chat_continuation_uses
  from public, anon, authenticated, service_role,
    analytics_chat_login, analytics_chat_reader;

comment on table private.analytics_chat_continuation_uses is
  'One-way hashes of consumed short-lived ROP continuation tokens. No prompts, values, result rows, owners, or credentials are stored.';

create or replace function private.consume_analytics_chat_continuation_token(
  p_token_hash text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= pg_catalog.now() then
    return false;
  end if;

  delete from private.analytics_chat_continuation_uses
  where expires_at <= pg_catalog.now();

  insert into private.analytics_chat_continuation_uses (
    token_hash,
    expires_at
  ) values (
    p_token_hash,
    p_expires_at
  ) on conflict (token_hash) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

revoke all on function private.consume_analytics_chat_continuation_token(
  text, timestamptz
) from public, anon, authenticated, service_role, analytics_chat_reader;
grant execute on function private.consume_analytics_chat_continuation_token(
  text, timestamptz
) to service_role, analytics_chat_reader;

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
    coalesce(forming_run.resource_set_id, product_run.resource_set_id) as resource_set_id,
    rop_member.version_id as rop_version_id,
    case
      when publication.id is null then 'missing_publication'
      when coalesce(forming_run.resource_set_id, product_run.resource_set_id) is null
        then 'missing_resource_set'
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
    where candidate.dataset_id = coalesce(dataset.backing_dataset_id, dataset.id)
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
  left join private.reference_resource_versions as rop_version
    on rop_version.id = rop_member.version_id
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
  'Returns the approved primary dataset identity and immutable ROP resource binding to a verified admin identity. Missing or invalid lineage is explicit and never falls back to the active ROP pointer.';

revoke all on function private.analytics_primary_people_groups_metadata()
  from public, anon, authenticated, service_role;
grant execute on function private.analytics_primary_people_groups_metadata()
  to analytics_chat_reader;

drop view if exists analytics_ro.primary_people_groups;

drop function if exists private.analytics_primary_people_groups_rows();

create function private.analytics_primary_people_groups_rows()
returns table (
  dataset_id uuid,
  dataset_version_created_at timestamptz,
  resource_set_id uuid,
  rop_version_id uuid,
  rop_binding_status text,
  people_id text,
  people_name text,
  country text,
  gsec numeric,
  frontier_group boolean,
  frontier_group_is_missing boolean,
  engagement_phase numeric,
  globally_engaged boolean,
  globally_engaged_is_missing boolean,
  population numeric,
  percent_evangelical numeric,
  rop1_code text,
  rop1_name text,
  rop2_code text,
  rop2_name text,
  rop25_code text,
  rop25_name text,
  rop3_code text,
  rop3_name text,
  rop3_status text,
  rop_place text,
  rop_language text,
  rop_source text,
  rop_join_issue text,
  rop_match_status text,
  rop_geographies text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with approved as (
    select * from private.analytics_primary_people_groups_metadata()
  ),
  normalized as (
    select
      approved.dataset_id,
      approved.dataset_version_created_at,
      approved.resource_set_id,
      approved.rop_version_id,
      approved.rop_binding_status,
      row.data,
      coalesce(
        nullif(btrim(row.data ->> 'pg_rop3'), ''),
        nullif(btrim(row.data ->> 'PG_ROP3'), '')
      ) as raw_rop3,
      coalesce(nullif(btrim(row.data ->> 'christianity_frontier_group'), ''), '') = ''
        as frontier_group_is_missing,
      coalesce(nullif(btrim(row.data ->> 'engage_global_engagement_anywhere'), ''), '') = ''
        as globally_engaged_is_missing
    from approved
    join public.dataset_rows as row
      on row.dataset_id = approved.source_dataset_id
  )
  select
    normalized.dataset_id,
    normalized.dataset_version_created_at,
    normalized.resource_set_id,
    normalized.rop_version_id,
    normalized.rop_binding_status,
    coalesce(
      nullif(btrim(normalized.data ->> 'pg_peopleid3'), ''),
      nullif(btrim(normalized.data ->> 'pg_peopleid1'), ''),
      nullif(btrim(normalized.data ->> 'pg_peid'), '')
    ) as people_id,
    nullif(btrim(normalized.data ->> 'people_name'), '') as people_name,
    nullif(btrim(normalized.data ->> 'geo_country_name'), '') as country,
    case
      when btrim(normalized.data ->> 'christianity_gsec') ~ '^[+-]?[0-9]+(?:[.][0-9]+)?$'
        then btrim(normalized.data ->> 'christianity_gsec')::numeric
      else null
    end as gsec,
    case lower(btrim(normalized.data ->> 'christianity_frontier_group'))
      when 'true' then true
      when 'false' then false
      else null
    end as frontier_group,
    normalized.frontier_group_is_missing,
    case
      when btrim(normalized.data ->> 'engage_8_phases_of_engagement') ~ '^[+-]?[0-9]+(?:[.][0-9]+)?$'
        then btrim(normalized.data ->> 'engage_8_phases_of_engagement')::numeric
      else null
    end as engagement_phase,
    case lower(btrim(normalized.data ->> 'engage_global_engagement_anywhere'))
      when 'true' then true
      when 'false' then false
      else null
    end as globally_engaged,
    normalized.globally_engaged_is_missing,
    case
      when btrim(normalized.data ->> 'pg_population') ~ '^[+-]?[0-9]+(?:[.][0-9]+)?$'
        then btrim(normalized.data ->> 'pg_population')::numeric
      else null
    end as population,
    case
      when btrim(normalized.data ->> 'percent_evangelical_pgac') ~ '^[+-]?[0-9]+(?:[.][0-9]+)?$'
        then btrim(normalized.data ->> 'percent_evangelical_pgac')::numeric
      else null
    end as percent_evangelical,
    rop_people.rop1_code,
    rop1.name as rop1_name,
    rop_people.rop2_code,
    rop2.name as rop2_name,
    rop_people.rop25_code,
    rop25.name as rop25_name,
    case when normalized.raw_rop3 ~ '^\d{6}$' then normalized.raw_rop3 end
      as rop3_code,
    rop3.name as rop3_name,
    rop_people.status as rop3_status,
    rop_people.place as rop_place,
    rop_people.language as rop_language,
    rop_people.source as rop_source,
    rop_people.join_issue as rop_join_issue,
    case
      when normalized.rop_binding_status <> 'bound' then 'unbound'
      when normalized.raw_rop3 is null then 'blank'
      when normalized.raw_rop3 !~ '^\d{6}$' then 'malformed'
      when rop_people.id is null then 'unmatched'
      when rop_people.status = 'Inactive' then 'inactive'
      when rop_people.join_issue is not null then 'join_issue'
      else 'matched'
    end as rop_match_status,
    coalesce(rop_geography.values, '{}'::text[]) as rop_geographies
  from normalized
  left join private.rop_reference_people as rop_people
    on rop_people.version_id = normalized.rop_version_id
    and rop_people.rop3_code = case
      when normalized.raw_rop3 ~ '^\d{6}$' then normalized.raw_rop3
      else null
    end
  left join private.rop_reference_terms as rop1
    on rop1.version_id = normalized.rop_version_id
    and rop1.level = 'rop1'
    and rop1.code = rop_people.rop1_code
  left join private.rop_reference_terms as rop2
    on rop2.version_id = normalized.rop_version_id
    and rop2.level = 'rop2'
    and rop2.code = rop_people.rop2_code
  left join private.rop_reference_terms as rop25
    on rop25.version_id = normalized.rop_version_id
    and rop25.level = 'rop25'
    and rop25.code = rop_people.rop25_code
  left join private.rop_reference_terms as rop3
    on rop3.version_id = normalized.rop_version_id
    and rop3.level = 'rop3'
    and rop3.code = rop_people.rop3_code
  left join lateral (
    select pg_catalog.array_agg(distinct candidate.value order by candidate.value)
      as values
    from private.rop_reference_geographies as geography
    cross join lateral pg_catalog.unnest(
      pg_catalog.array_remove(
        array[
          geography.geo_name,
          geography.iso_alpha3,
          geography.rog
        ]::text[],
        null
      )
    ) as candidate(value)
    where geography.version_id = normalized.rop_version_id
      and geography.rop3_code = rop_people.rop3_code
  ) as rop_geography on true
$$;

comment on function private.analytics_primary_people_groups_rows() is
  'Returns the approved typed primary people-groups projection with blank/invalid boolean distinction and a null-preserving dataset-version-bound ROP3 relationship.';

revoke all on function private.analytics_primary_people_groups_rows()
  from public, anon, authenticated, service_role;
grant execute on function private.analytics_primary_people_groups_rows()
  to analytics_chat_reader;

create view analytics_ro.primary_people_groups_metadata
with (security_invoker = true, security_barrier = true)
as
select * from private.analytics_primary_people_groups_metadata();

create view analytics_ro.primary_people_groups
with (security_invoker = true, security_barrier = true)
as
select * from private.analytics_primary_people_groups_rows();

comment on view analytics_ro.primary_people_groups_metadata is
  'Approved dataset and immutable ROP binding metadata for private Qwen chat.';
comment on view analytics_ro.primary_people_groups is
  'Approved semantic projection for private Qwen data chat with version-bound ROP classification.';

revoke all on analytics_ro.primary_people_groups_metadata,
  analytics_ro.primary_people_groups
  from public, anon, authenticated, service_role;
grant select on analytics_ro.primary_people_groups_metadata,
  analytics_ro.primary_people_groups
  to analytics_chat_reader;

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
