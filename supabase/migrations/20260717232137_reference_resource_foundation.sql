create extension if not exists pgcrypto with schema extensions;

create table if not exists private.reference_resources (
  id uuid primary key default gen_random_uuid(),
  resource_key text not null,
  resource_kind text not null,
  label text not null,
  description text not null,
  route_path text not null,
  sort_order integer not null default 0,
  active_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reference_resources_key_not_blank check (btrim(resource_key) <> ''),
  constraint reference_resources_kind_check check (resource_kind in ('country-geography', 'rop-taxonomy')),
  constraint reference_resources_label_not_blank check (btrim(label) <> ''),
  constraint reference_resources_route_check check (route_path ~ '^/dashboard/[a-z0-9/-]+$')
);

create unique index if not exists reference_resources_key_idx
  on private.reference_resources(resource_key);
create index if not exists reference_resources_sort_idx
  on private.reference_resources(sort_order, label, id);
create index if not exists reference_resources_active_version_idx
  on private.reference_resources(active_version_id)
  where active_version_id is not null;

create table if not exists private.reference_resource_versions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references private.reference_resources(id) on delete restrict,
  version_number bigint not null,
  lifecycle_state text not null default 'building',
  schema_version integer not null,
  content_checksum text,
  source_retrieved_at timestamptz not null,
  source_metadata jsonb not null default '{}'::jsonb,
  normalized_resource jsonb,
  artifact_manifest jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  diff_summary jsonb not null default '{}'::jsonb,
  entry_count integer not null default 0,
  created_by_owner_id text not null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  rejected_by_owner_id text,
  rejected_at timestamptz,
  rejection_reason text,
  build_error text,
  constraint reference_resource_versions_number_check check (version_number > 0),
  constraint reference_resource_versions_state_check check (lifecycle_state in ('building', 'valid', 'invalid', 'rejected')),
  constraint reference_resource_versions_schema_check check (schema_version > 0),
  constraint reference_resource_versions_checksum_check check (content_checksum is null or content_checksum ~ '^[0-9a-f]{64}$'),
  constraint reference_resource_versions_source_metadata_check check (jsonb_typeof(source_metadata) = 'object'),
  constraint reference_resource_versions_artifact_manifest_check check (jsonb_typeof(artifact_manifest) = 'object'),
  constraint reference_resource_versions_validation_summary_check check (jsonb_typeof(validation_summary) = 'object'),
  constraint reference_resource_versions_diff_summary_check check (jsonb_typeof(diff_summary) = 'object'),
  constraint reference_resource_versions_entry_count_check check (entry_count >= 0),
  constraint reference_resource_versions_created_by_check check (btrim(created_by_owner_id) <> ''),
  constraint reference_resource_versions_finalized_check check (
    (lifecycle_state = 'building' and finalized_at is null)
    or
    (lifecycle_state <> 'building' and finalized_at is not null and content_checksum is not null and normalized_resource is not null)
  ),
  constraint reference_resource_versions_rejected_check check (
    lifecycle_state <> 'rejected'
    or (rejected_at is not null and btrim(coalesce(rejected_by_owner_id, '')) <> '' and btrim(coalesce(rejection_reason, '')) <> '')
  )
);

create unique index if not exists reference_resource_versions_number_idx
  on private.reference_resource_versions(resource_id, version_number);
create unique index if not exists reference_resource_versions_content_idx
  on private.reference_resource_versions(resource_id, schema_version, content_checksum)
  where content_checksum is not null and lifecycle_state in ('valid', 'rejected');
create index if not exists reference_resource_versions_history_idx
  on private.reference_resource_versions(resource_id, created_at desc, id);
create index if not exists reference_resource_versions_candidate_idx
  on private.reference_resource_versions(resource_id, lifecycle_state, created_at desc)
  where lifecycle_state in ('building', 'valid', 'invalid');

alter table private.reference_resources
  add constraint reference_resources_active_version_fk
  foreign key (active_version_id)
  references private.reference_resource_versions(id)
  on delete restrict
  deferrable initially immediate;

create table if not exists private.reference_resource_validation_findings (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references private.reference_resource_versions(id) on delete cascade,
  severity text not null,
  rule_code text not null,
  stable_entry_key text,
  field_name text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint reference_resource_findings_severity_check check (severity in ('info', 'warning', 'error')),
  constraint reference_resource_findings_rule_check check (btrim(rule_code) <> ''),
  constraint reference_resource_findings_message_check check (btrim(message) <> ''),
  constraint reference_resource_findings_details_check check (jsonb_typeof(details) = 'object')
);

create index if not exists reference_resource_findings_version_idx
  on private.reference_resource_validation_findings(version_id, severity, created_at, id);

create table if not exists private.reference_resource_activation_events (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references private.reference_resources(id) on delete restrict,
  previous_version_id uuid references private.reference_resource_versions(id) on delete restrict,
  selected_version_id uuid not null references private.reference_resource_versions(id) on delete restrict,
  action text not null,
  actor_owner_id text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint reference_resource_events_action_check check (action in ('activate', 'rollback', 'alias-edit')),
  constraint reference_resource_events_actor_check check (btrim(actor_owner_id) <> ''),
  constraint reference_resource_events_reason_check check (btrim(reason) <> '')
);

create index if not exists reference_resource_events_resource_idx
  on private.reference_resource_activation_events(resource_id, created_at desc, id);
create index if not exists reference_resource_events_previous_version_idx
  on private.reference_resource_activation_events(previous_version_id)
  where previous_version_id is not null;
create index if not exists reference_resource_events_selected_version_idx
  on private.reference_resource_activation_events(selected_version_id);

create table if not exists private.reference_resource_sets (
  id uuid primary key default gen_random_uuid(),
  sequence_number bigint generated always as identity,
  content_checksum text not null,
  created_by_owner_id text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint reference_resource_sets_checksum_check check (content_checksum ~ '^[0-9a-f]{64}$'),
  constraint reference_resource_sets_actor_check check (btrim(created_by_owner_id) <> ''),
  constraint reference_resource_sets_reason_check check (btrim(reason) <> '')
);

create unique index if not exists reference_resource_sets_sequence_idx
  on private.reference_resource_sets(sequence_number);
create index if not exists reference_resource_sets_created_idx
  on private.reference_resource_sets(created_at desc, id);

create table if not exists private.reference_resource_set_members (
  set_id uuid not null references private.reference_resource_sets(id) on delete restrict,
  resource_id uuid not null references private.reference_resources(id) on delete restrict,
  version_id uuid not null references private.reference_resource_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (set_id, resource_id)
);

create index if not exists reference_resource_set_members_resource_idx
  on private.reference_resource_set_members(resource_id, set_id);
create index if not exists reference_resource_set_members_version_idx
  on private.reference_resource_set_members(version_id, set_id);

create table if not exists private.country_reference_entries (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references private.reference_resource_versions(id) on delete cascade,
  stable_key text not null,
  display_name text not null,
  active boolean not null,
  primary_alpha3 text,
  official_iso_alpha2 text,
  official_iso_alpha3 text,
  official_iso_numeric text,
  unterm_english_short_name text,
  unterm_english_formal_name text,
  unterm_name_source text,
  genc_alpha2 text,
  genc_alpha3 text,
  genc_numeric text,
  fips text,
  rog3 text,
  alternative_names jsonb not null default '[]'::jsonb,
  classification text not null,
  source_uri text,
  search_text text not null,
  created_at timestamptz not null default now(),
  constraint country_reference_entries_key_check check (btrim(stable_key) <> ''),
  constraint country_reference_entries_name_check check (btrim(display_name) <> ''),
  constraint country_reference_entries_primary_alpha3_check check (primary_alpha3 is null or primary_alpha3 ~ '^[A-Z0-9]{3}$'),
  constraint country_reference_entries_iso2_check check (official_iso_alpha2 is null or official_iso_alpha2 ~ '^[A-Z]{2}$'),
  constraint country_reference_entries_iso3_check check (official_iso_alpha3 is null or official_iso_alpha3 ~ '^[A-Z]{3}$'),
  constraint country_reference_entries_iso_numeric_check check (official_iso_numeric is null or official_iso_numeric ~ '^[0-9]{3}$'),
  constraint country_reference_entries_genc2_check check (genc_alpha2 is null or genc_alpha2 ~ '^[A-Z0-9]{2}$'),
  constraint country_reference_entries_genc3_check check (genc_alpha3 is null or genc_alpha3 ~ '^[A-Z0-9]{3}$'),
  constraint country_reference_entries_genc_numeric_check check (genc_numeric is null or genc_numeric ~ '^[0-9]{3}$'),
  constraint country_reference_entries_fips_check check (fips is null or fips ~ '^[A-Z]{2}$'),
  constraint country_reference_entries_rog3_check check (rog3 is null or rog3 ~ '^[A-Z]{2}$'),
  constraint country_reference_entries_aliases_check check (jsonb_typeof(alternative_names) = 'array'),
  constraint country_reference_entries_classification_check check (classification in ('iso-official', 'genc-supported', 'duplicate-iso-territory', 'legacy-fips-only', 'csv-only', 'non-official-code'))
);

create unique index if not exists country_reference_entries_version_key_idx
  on private.country_reference_entries(version_id, stable_key);
create index if not exists country_reference_entries_version_display_idx
  on private.country_reference_entries(version_id, lower(display_name), id);
create index if not exists country_reference_entries_version_primary_iso3_idx
  on private.country_reference_entries(version_id, primary_alpha3)
  where primary_alpha3 is not null;
create index if not exists country_reference_entries_version_rog3_idx
  on private.country_reference_entries(version_id, rog3)
  where rog3 is not null;
create index if not exists country_reference_entries_search_idx
  on private.country_reference_entries using gin (to_tsvector('simple', search_text));

create table if not exists private.rop_reference_terms (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references private.reference_resource_versions(id) on delete cascade,
  level text not null,
  code text not null,
  parent_code text,
  name text,
  description text,
  status text,
  created_at timestamptz not null default now(),
  constraint rop_reference_terms_level_check check (level in ('rop1', 'rop2', 'rop25', 'rop3')),
  constraint rop_reference_terms_code_check check (btrim(code) <> ''),
  constraint rop_reference_terms_status_check check (status is null or status in ('Active', 'Inactive'))
);

create unique index if not exists rop_reference_terms_version_level_code_idx
  on private.rop_reference_terms(version_id, level, code);
create index if not exists rop_reference_terms_version_parent_idx
  on private.rop_reference_terms(version_id, parent_code)
  where parent_code is not null;

create table if not exists private.rop_reference_people (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references private.reference_resource_versions(id) on delete cascade,
  stable_key text not null,
  row_type text not null,
  rop1_code text,
  rop2_code text,
  rop25_code text,
  rop3_code text,
  status text not null,
  place text,
  language text,
  source text,
  ethnic_id text,
  direct_rop2 text,
  join_issue text,
  join_issue_label text,
  search_text text not null,
  created_at timestamptz not null default now(),
  constraint rop_reference_people_key_check check (btrim(stable_key) <> ''),
  constraint rop_reference_people_row_type_check check (row_type in ('rop3-person', 'rop25-parent')),
  constraint rop_reference_people_status_check check (status in ('Active', 'Inactive')),
  constraint rop_reference_people_join_issue_check check (join_issue is null or join_issue in ('missing-rop25', 'rop2-conflict', 'parent-only-rop25'))
);

create unique index if not exists rop_reference_people_version_key_idx
  on private.rop_reference_people(version_id, stable_key);
create index if not exists rop_reference_people_version_rop1_idx on private.rop_reference_people(version_id, rop1_code) where rop1_code is not null;
create index if not exists rop_reference_people_version_rop2_idx on private.rop_reference_people(version_id, rop2_code) where rop2_code is not null;
create index if not exists rop_reference_people_version_rop25_idx on private.rop_reference_people(version_id, rop25_code) where rop25_code is not null;
create index if not exists rop_reference_people_version_rop3_idx on private.rop_reference_people(version_id, rop3_code) where rop3_code is not null;
create index if not exists rop_reference_people_version_sort_idx on private.rop_reference_people(version_id, stable_key, id);
create index if not exists rop_reference_people_search_idx on private.rop_reference_people using gin (to_tsvector('simple', search_text));

create table if not exists private.rop_reference_geographies (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references private.reference_resource_versions(id) on delete cascade,
  geo_id integer not null,
  rop3_code text not null,
  rog text,
  geo_name text,
  people_name text,
  people_id3 text,
  iso_alpha3 text,
  status text not null,
  search_text text not null,
  created_at timestamptz not null default now(),
  constraint rop_reference_geo_id_check check (geo_id > 0),
  constraint rop_reference_geo_rop3_check check (btrim(rop3_code) <> ''),
  constraint rop_reference_geo_iso3_check check (iso_alpha3 is null or iso_alpha3 ~ '^[A-Z0-9]{3}$'),
  constraint rop_reference_geo_status_check check (status in ('Active', 'Inactive'))
);

create unique index if not exists rop_reference_geographies_version_geo_idx
  on private.rop_reference_geographies(version_id, geo_id);
create index if not exists rop_reference_geographies_version_rop3_idx
  on private.rop_reference_geographies(version_id, rop3_code, geo_id);
create index if not exists rop_reference_geographies_version_rog_idx
  on private.rop_reference_geographies(version_id, rog)
  where rog is not null;
create index if not exists rop_reference_geographies_version_people_id3_idx
  on private.rop_reference_geographies(version_id, people_id3)
  where people_id3 is not null;
create index if not exists rop_reference_geographies_version_iso3_idx
  on private.rop_reference_geographies(version_id, iso_alpha3)
  where iso_alpha3 is not null;
create index if not exists rop_reference_geographies_search_idx
  on private.rop_reference_geographies using gin (to_tsvector('simple', search_text));

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

  return new;
end;
$$;

create trigger reference_resource_versions_immutable
before update or delete on private.reference_resource_versions
for each row execute function private.prevent_finalized_reference_version_mutation();

create or replace function private.prevent_finalized_reference_projection_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, private
as $$
declare
  target_version_id uuid;
  target_state text;
begin
  target_version_id := case when tg_op = 'INSERT' then new.version_id else old.version_id end;
  select lifecycle_state into target_state
  from private.reference_resource_versions
  where id = target_version_id;

  if target_state is null then
    raise exception 'Reference-resource version does not exist.';
  end if;

  if target_state <> 'building' then
    raise exception 'Finalized reference-resource projections are immutable.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger country_reference_entries_immutable
before insert or update or delete on private.country_reference_entries
for each row execute function private.prevent_finalized_reference_projection_mutation();
create trigger rop_reference_terms_immutable
before insert or update or delete on private.rop_reference_terms
for each row execute function private.prevent_finalized_reference_projection_mutation();
create trigger rop_reference_people_immutable
before insert or update or delete on private.rop_reference_people
for each row execute function private.prevent_finalized_reference_projection_mutation();
create trigger rop_reference_geographies_immutable
before insert or update or delete on private.rop_reference_geographies
for each row execute function private.prevent_finalized_reference_projection_mutation();

create or replace function private.prevent_reference_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'Reference-resource audit and set records are append-only.';
end;
$$;

create trigger reference_resource_findings_append_only
before update or delete on private.reference_resource_validation_findings
for each row execute function private.prevent_reference_audit_mutation();
create trigger reference_resource_events_append_only
before update or delete on private.reference_resource_activation_events
for each row execute function private.prevent_reference_audit_mutation();
create trigger reference_resource_sets_append_only
before update or delete on private.reference_resource_sets
for each row execute function private.prevent_reference_audit_mutation();
create trigger reference_resource_set_members_append_only
before update or delete on private.reference_resource_set_members
for each row execute function private.prevent_reference_audit_mutation();

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

  update private.reference_resources
  set active_version_id = target_version.id, updated_at = now()
  where id = target_resource.id;

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
    'country-territory-codes',
    'country-geography',
    'Country & territory code resource',
    'Search and download shared ISO, GENC, FIPS, and ROG3 country and territory codes.',
    '/dashboard/country-codes',
    10
  ),
  (
    'rop-codes',
    'rop-taxonomy',
    'ROP Codes resource',
    'Search and download matched HIS ROP1, ROP2, ROP25, and ROP3 codes.',
    '/dashboard/rop-codes',
    20
  )
on conflict (resource_key) do update
set
  resource_kind = excluded.resource_kind,
  label = excluded.label,
  description = excluded.description,
  route_path = excluded.route_path,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'reference-resource-artifacts',
  'reference-resource-artifacts',
  false,
  134217728,
  array['application/json', 'text/csv']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

alter table private.reference_resources enable row level security;
alter table private.reference_resource_versions enable row level security;
alter table private.reference_resource_validation_findings enable row level security;
alter table private.reference_resource_activation_events enable row level security;
alter table private.reference_resource_sets enable row level security;
alter table private.reference_resource_set_members enable row level security;
alter table private.country_reference_entries enable row level security;
alter table private.rop_reference_terms enable row level security;
alter table private.rop_reference_people enable row level security;
alter table private.rop_reference_geographies enable row level security;

revoke all on private.reference_resources from public, anon, authenticated;
revoke all on private.reference_resource_versions from public, anon, authenticated;
revoke all on private.reference_resource_validation_findings from public, anon, authenticated;
revoke all on private.reference_resource_activation_events from public, anon, authenticated;
revoke all on private.reference_resource_sets from public, anon, authenticated;
revoke all on private.reference_resource_set_members from public, anon, authenticated;
revoke all on private.country_reference_entries from public, anon, authenticated;
revoke all on private.rop_reference_terms from public, anon, authenticated;
revoke all on private.rop_reference_people from public, anon, authenticated;
revoke all on private.rop_reference_geographies from public, anon, authenticated;
