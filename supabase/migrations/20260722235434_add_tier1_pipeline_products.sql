create table if not exists private.pipeline_definitions (
  definition_key text primary key,
  stage text not null,
  display_name text not null,
  version text not null,
  checksum text not null,
  required_input_keys jsonb not null default '[]'::jsonb,
  output_classification text not null,
  publication_target_key text not null,
  is_workspace_visible boolean not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint pipeline_definitions_key_check check (definition_key ~ '^[a-z][a-z0-9-]*$'),
  constraint pipeline_definitions_stage_check check (stage in ('tier1-merge', 'aggregate1')),
  constraint pipeline_definitions_display_name_check check (btrim(display_name) <> ''),
  constraint pipeline_definitions_version_check check (btrim(version) <> ''),
  constraint pipeline_definitions_checksum_check check (checksum ~ '^[0-9a-f]{64}$'),
  constraint pipeline_definitions_inputs_check check (jsonb_typeof(required_input_keys) = 'array'),
  constraint pipeline_definitions_classification_check check (output_classification in ('PGAC', 'PGIC')),
  constraint pipeline_definitions_target_check check (publication_target_key ~ '^[a-z][a-z0-9-]*$')
);

comment on column private.pipeline_definitions.is_workspace_visible is
  'Checksummed product behavior: final publications are listed for normal workspace consumers when true.';

create table if not exists private.pipeline_release_sets (
  id uuid primary key default gen_random_uuid(),
  release_key text not null,
  resource_set_id uuid not null references private.reference_resource_sets(id) on delete restrict,
  registry_revision_id uuid not null references private.ax_registry_revisions(id) on delete restrict,
  rule_version text not null,
  rule_checksum text not null,
  rule_payload jsonb not null,
  status text not null default 'draft',
  canonical_checksum text,
  created_by_owner_id text not null,
  created_by_email text,
  finalized_by_owner_id text,
  finalized_by_email text,
  finalization_reason text,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pipeline_release_sets_key_check check (release_key ~ '^[a-z][a-z0-9-]*$'),
  constraint pipeline_release_sets_rule_version_check check (btrim(rule_version) <> ''),
  constraint pipeline_release_sets_rule_checksum_check check (rule_checksum ~ '^[0-9a-f]{64}$'),
  constraint pipeline_release_sets_rule_payload_check check (jsonb_typeof(rule_payload) = 'array'),
  constraint pipeline_release_sets_status_check check (status in ('draft', 'finalized', 'cancelled')),
  constraint pipeline_release_sets_checksum_check check (canonical_checksum is null or canonical_checksum ~ '^[0-9a-f]{64}$'),
  constraint pipeline_release_sets_actor_check check (btrim(created_by_owner_id) <> ''),
  constraint pipeline_release_sets_finalization_check check (
    (status = 'finalized'
      and canonical_checksum is not null
      and finalized_by_owner_id is not null
      and btrim(finalized_by_owner_id) <> ''
      and finalization_reason is not null
      and btrim(finalization_reason) <> ''
      and finalized_at is not null)
    or status <> 'finalized'
  )
);

create table if not exists private.pipeline_release_members (
  id bigint generated always as identity primary key,
  release_set_id uuid not null references private.pipeline_release_sets(id) on delete restrict,
  position integer not null,
  input_key text not null,
  publication_id uuid not null references private.pipeline_publications(id) on delete restrict,
  publication_checksum text not null,
  publication_row_count integer not null,
  registry_revision_id uuid not null references private.ax_registry_revisions(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint pipeline_release_members_position_check check (position >= 0),
  constraint pipeline_release_members_key_check check (input_key ~ '^[a-z][a-z0-9-]*$'),
  constraint pipeline_release_members_checksum_check check (publication_checksum ~ '^[0-9a-f]{64}$'),
  constraint pipeline_release_members_row_count_check check (publication_row_count >= 0),
  unique (release_set_id, position),
  unique (release_set_id, input_key),
  unique (release_set_id, publication_id)
);

create table if not exists private.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  definition_key text not null references private.pipeline_definitions(definition_key) on delete restrict,
  definition_version text not null,
  definition_checksum text not null,
  release_set_id uuid references private.pipeline_release_sets(id) on delete restrict,
  parent_publication_id uuid references private.pipeline_publications(id) on delete restrict,
  resource_set_id uuid not null references private.reference_resource_sets(id) on delete restrict,
  registry_revision_id uuid not null references private.ax_registry_revisions(id) on delete restrict,
  actor_owner_id text not null,
  actor_email text,
  status text not null default 'building',
  input_fingerprint text not null,
  input_row_count integer not null default 0,
  output_row_count integer,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  validation_summary jsonb not null default '{}'::jsonb,
  artifact_manifest jsonb not null default '{}'::jsonb,
  output_checksum text,
  dataset_id uuid references public.datasets(id) on delete set null,
  publication_id uuid references private.pipeline_publications(id) on delete restrict,
  rejection_reason text,
  rejected_by_owner_id text,
  rejected_at timestamptz,
  publication_reason text,
  warnings_acknowledged boolean not null default false,
  published_by_owner_id text,
  published_at timestamptz,
  publishing_started_at timestamptz,
  publication_blob_path text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pipeline_runs_definition_version_check check (btrim(definition_version) <> ''),
  constraint pipeline_runs_definition_checksum_check check (definition_checksum ~ '^[0-9a-f]{64}$'),
  constraint pipeline_runs_actor_check check (btrim(actor_owner_id) <> ''),
  constraint pipeline_runs_status_check check (status in ('building', 'valid', 'invalid', 'rejected', 'publishing', 'published', 'failed')),
  constraint pipeline_runs_input_fingerprint_check check (input_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint pipeline_runs_input_row_count_check check (input_row_count >= 0),
  constraint pipeline_runs_output_row_count_check check (output_row_count is null or output_row_count >= 0),
  constraint pipeline_runs_warning_count_check check (warning_count >= 0),
  constraint pipeline_runs_error_count_check check (error_count >= 0),
  constraint pipeline_runs_output_checksum_check check (output_checksum is null or output_checksum ~ '^[0-9a-f]{64}$'),
  constraint pipeline_runs_parent_shape_check check (
    (release_set_id is not null and parent_publication_id is null)
    or (release_set_id is null and parent_publication_id is not null)
  ),
  constraint pipeline_runs_rejection_check check (
    (status = 'rejected' and rejection_reason is not null and btrim(rejection_reason) <> '' and rejected_by_owner_id is not null and rejected_at is not null)
    or status <> 'rejected'
  ),
  constraint pipeline_runs_publication_check check (
    (status = 'published' and publication_reason is not null and btrim(publication_reason) <> '' and published_by_owner_id is not null and published_at is not null)
    or status <> 'published'
  )
);

create table if not exists private.pipeline_run_inputs (
  id bigint generated always as identity primary key,
  run_id uuid not null references private.pipeline_runs(id) on delete restrict,
  position integer not null,
  input_key text not null,
  publication_id uuid not null references private.pipeline_publications(id) on delete restrict,
  publication_checksum text not null,
  publication_row_count integer not null,
  created_at timestamptz not null default now(),
  constraint pipeline_run_inputs_position_check check (position >= 0),
  constraint pipeline_run_inputs_key_check check (input_key ~ '^[a-z][a-z0-9-]*$'),
  constraint pipeline_run_inputs_checksum_check check (publication_checksum ~ '^[0-9a-f]{64}$'),
  constraint pipeline_run_inputs_row_count_check check (publication_row_count >= 0),
  unique (run_id, position),
  unique (run_id, input_key)
);

create table if not exists private.pipeline_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.pipeline_runs(id) on delete restrict,
  artifact_kind text not null,
  storage_path text not null,
  content_checksum text not null,
  size_bytes integer not null,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  constraint pipeline_artifacts_kind_check check (artifact_kind in ('rows-json', 'rows-csv', 'findings-json', 'lineage-json', 'comparison-json')),
  constraint pipeline_artifacts_path_check check (btrim(storage_path) <> ''),
  constraint pipeline_artifacts_checksum_check check (content_checksum ~ '^[0-9a-f]{64}$'),
  constraint pipeline_artifacts_size_check check (size_bytes >= 0),
  constraint pipeline_artifacts_schema_check check (schema_version > 0),
  unique (run_id, artifact_kind)
);

create table if not exists private.pipeline_findings (
  id bigint generated always as identity primary key,
  run_id uuid not null references private.pipeline_runs(id) on delete cascade,
  severity text not null,
  rule_code text not null,
  source_row_key text,
  field_name text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint pipeline_findings_severity_check check (severity in ('warning', 'error')),
  constraint pipeline_findings_rule_check check (btrim(rule_code) <> ''),
  constraint pipeline_findings_message_check check (btrim(message) <> '')
);

alter table private.pipeline_publications
  add column if not exists publication_target_key text,
  add column if not exists producer_definition_key text,
  add column if not exists release_set_id uuid references private.pipeline_release_sets(id) on delete restrict;

alter table private.pipeline_publications
  drop constraint if exists pipeline_publications_target_key_check,
  add constraint pipeline_publications_target_key_check
    check (publication_target_key is null or publication_target_key ~ '^[a-z][a-z0-9-]*$');

create table if not exists private.pipeline_publication_inputs (
  id bigint generated always as identity primary key,
  publication_id uuid not null references private.pipeline_publications(id) on delete restrict,
  position integer not null,
  input_key text not null,
  input_publication_id uuid not null references private.pipeline_publications(id) on delete restrict,
  input_checksum text not null,
  created_at timestamptz not null default now(),
  constraint pipeline_publication_inputs_position_check check (position >= 0),
  constraint pipeline_publication_inputs_key_check check (input_key ~ '^[a-z][a-z0-9-]*$'),
  constraint pipeline_publication_inputs_checksum_check check (input_checksum ~ '^[0-9a-f]{64}$'),
  constraint pipeline_publication_inputs_no_self_check check (publication_id <> input_publication_id),
  unique (publication_id, position),
  unique (publication_id, input_key)
);

create index if not exists pipeline_release_sets_status_created_idx
  on private.pipeline_release_sets(status, created_at desc, id);
create unique index if not exists pipeline_release_sets_final_checksum_idx
  on private.pipeline_release_sets(canonical_checksum)
  where status = 'finalized';
create index if not exists pipeline_release_sets_registry_idx
  on private.pipeline_release_sets(registry_revision_id, created_at desc, id);
create index if not exists pipeline_release_members_publication_idx
  on private.pipeline_release_members(publication_id, release_set_id);
create index if not exists pipeline_runs_definition_created_idx
  on private.pipeline_runs(definition_key, created_at desc, id);
create index if not exists pipeline_runs_status_created_idx
  on private.pipeline_runs(status, created_at desc, id);
create index if not exists pipeline_runs_release_idx
  on private.pipeline_runs(release_set_id, created_at desc, id)
  where release_set_id is not null;
create index if not exists pipeline_runs_parent_idx
  on private.pipeline_runs(parent_publication_id, created_at desc, id)
  where parent_publication_id is not null;
create index if not exists pipeline_runs_dataset_idx
  on private.pipeline_runs(dataset_id)
  where dataset_id is not null;
create unique index if not exists pipeline_runs_publication_idx
  on private.pipeline_runs(publication_id)
  where publication_id is not null;
create unique index if not exists pipeline_runs_active_build_idx
  on private.pipeline_runs(definition_key, input_fingerprint)
  where status in ('building', 'valid', 'publishing');
create index if not exists pipeline_run_inputs_publication_idx
  on private.pipeline_run_inputs(publication_id, run_id);
create index if not exists pipeline_artifacts_run_created_idx
  on private.pipeline_artifacts(run_id, created_at, id);
create index if not exists pipeline_findings_run_severity_idx
  on private.pipeline_findings(run_id, severity, id);
create index if not exists pipeline_publications_target_created_idx
  on private.pipeline_publications(publication_target_key, created_at desc, id)
  where publication_target_key is not null;
create index if not exists pipeline_publication_inputs_parent_idx
  on private.pipeline_publication_inputs(input_publication_id, publication_id);

create or replace function private.guard_pipeline_release_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Pipeline release history is append-only.';
  end if;
  if old.status <> 'draft' then
    raise exception 'Finalized pipeline releases are immutable.';
  end if;
  if new.id is distinct from old.id
    or new.release_key is distinct from old.release_key
    or new.resource_set_id is distinct from old.resource_set_id
    or new.registry_revision_id is distinct from old.registry_revision_id
    or new.rule_version is distinct from old.rule_version
    or new.rule_checksum is distinct from old.rule_checksum
    or new.rule_payload is distinct from old.rule_payload
    or new.created_by_owner_id is distinct from old.created_by_owner_id
    or new.created_by_email is distinct from old.created_by_email
    or new.created_at is distinct from old.created_at then
    raise exception 'Pipeline release bindings are immutable.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_pipeline_release_member_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  release_status text;
begin
  if tg_op = 'DELETE' then
    raise exception 'Pipeline release members are append-only.';
  end if;
  select status into release_status
  from private.pipeline_release_sets
  where id = coalesce(new.release_set_id, old.release_set_id);
  if release_status <> 'draft' or tg_op = 'UPDATE' then
    raise exception 'Pipeline release members are immutable after insertion.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_pipeline_run_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Pipeline run history is append-only.';
  end if;
  if old.status <> 'building' and (
    new.definition_key is distinct from old.definition_key
    or new.definition_version is distinct from old.definition_version
    or new.definition_checksum is distinct from old.definition_checksum
    or new.release_set_id is distinct from old.release_set_id
    or new.parent_publication_id is distinct from old.parent_publication_id
    or new.resource_set_id is distinct from old.resource_set_id
    or new.registry_revision_id is distinct from old.registry_revision_id
    or new.actor_owner_id is distinct from old.actor_owner_id
    or new.actor_email is distinct from old.actor_email
    or new.input_fingerprint is distinct from old.input_fingerprint
    or new.input_row_count is distinct from old.input_row_count
    or new.output_row_count is distinct from old.output_row_count
    or new.warning_count is distinct from old.warning_count
    or new.error_count is distinct from old.error_count
    or new.validation_summary is distinct from old.validation_summary
    or new.artifact_manifest is distinct from old.artifact_manifest
    or new.output_checksum is distinct from old.output_checksum
    or (old.dataset_id is not null and new.dataset_id is distinct from old.dataset_id)
    or (old.publication_id is not null and new.publication_id is distinct from old.publication_id)
    or new.started_at is distinct from old.started_at
    or new.completed_at is distinct from old.completed_at
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Finalized pipeline run bindings and artifacts are immutable.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_pipeline_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Pipeline evidence is append-only.';
end;
$$;

drop trigger if exists pipeline_release_sets_immutable on private.pipeline_release_sets;
create trigger pipeline_release_sets_immutable
before update or delete on private.pipeline_release_sets
for each row execute function private.guard_pipeline_release_immutability();

drop trigger if exists pipeline_release_members_immutable on private.pipeline_release_members;
create trigger pipeline_release_members_immutable
before update or delete on private.pipeline_release_members
for each row execute function private.guard_pipeline_release_member_immutability();

drop trigger if exists pipeline_runs_immutable on private.pipeline_runs;
create trigger pipeline_runs_immutable
before update or delete on private.pipeline_runs
for each row execute function private.guard_pipeline_run_immutability();

drop trigger if exists pipeline_run_inputs_immutable on private.pipeline_run_inputs;
create trigger pipeline_run_inputs_immutable
before update or delete on private.pipeline_run_inputs
for each row execute function private.guard_pipeline_append_only();

drop trigger if exists pipeline_artifacts_immutable on private.pipeline_artifacts;
create trigger pipeline_artifacts_immutable
before update or delete on private.pipeline_artifacts
for each row execute function private.guard_pipeline_append_only();

drop trigger if exists pipeline_findings_immutable on private.pipeline_findings;
create trigger pipeline_findings_immutable
before update or delete on private.pipeline_findings
for each row execute function private.guard_pipeline_append_only();

drop trigger if exists pipeline_publication_inputs_immutable on private.pipeline_publication_inputs;
create trigger pipeline_publication_inputs_immutable
before update or delete on private.pipeline_publication_inputs
for each row execute function private.guard_pipeline_append_only();

alter table private.pipeline_definitions enable row level security;
alter table private.pipeline_release_sets enable row level security;
alter table private.pipeline_release_members enable row level security;
alter table private.pipeline_runs enable row level security;
alter table private.pipeline_run_inputs enable row level security;
alter table private.pipeline_artifacts enable row level security;
alter table private.pipeline_findings enable row level security;
alter table private.pipeline_publication_inputs enable row level security;

revoke all on private.pipeline_definitions from public, anon, authenticated;
revoke all on private.pipeline_release_sets from public, anon, authenticated;
revoke all on private.pipeline_release_members from public, anon, authenticated;
revoke all on private.pipeline_runs from public, anon, authenticated;
revoke all on private.pipeline_run_inputs from public, anon, authenticated;
revoke all on private.pipeline_artifacts from public, anon, authenticated;
revoke all on private.pipeline_findings from public, anon, authenticated;
revoke all on private.pipeline_publication_inputs from public, anon, authenticated;
revoke all on sequence private.pipeline_release_members_id_seq from public, anon, authenticated;
revoke all on sequence private.pipeline_run_inputs_id_seq from public, anon, authenticated;
revoke all on sequence private.pipeline_findings_id_seq from public, anon, authenticated;
revoke all on sequence private.pipeline_publication_inputs_id_seq from public, anon, authenticated;
revoke execute on function private.guard_pipeline_release_immutability() from public, anon, authenticated;
revoke execute on function private.guard_pipeline_release_member_immutability() from public, anon, authenticated;
revoke execute on function private.guard_pipeline_run_immutability() from public, anon, authenticated;
revoke execute on function private.guard_pipeline_append_only() from public, anon, authenticated;

grant all on private.pipeline_definitions to service_role;
grant all on private.pipeline_release_sets to service_role;
grant all on private.pipeline_release_members to service_role;
grant all on private.pipeline_runs to service_role;
grant all on private.pipeline_run_inputs to service_role;
grant all on private.pipeline_artifacts to service_role;
grant all on private.pipeline_findings to service_role;
grant all on private.pipeline_publication_inputs to service_role;
grant usage, select on sequence private.pipeline_release_members_id_seq to service_role;
grant usage, select on sequence private.pipeline_run_inputs_id_seq to service_role;
grant usage, select on sequence private.pipeline_findings_id_seq to service_role;
grant usage, select on sequence private.pipeline_publication_inputs_id_seq to service_role;

insert into private.pipeline_definitions (
  definition_key,
  stage,
  display_name,
  version,
  checksum,
  required_input_keys,
  output_classification,
  publication_target_key,
  is_workspace_visible
)
values
  ('tier1-pgic-merge', 'tier1-merge', 'Tier 1 canonical PGIC merge', 'v1', '732a52ce030ead236c08c2a6810dd54129fb31b2fe0253072fa5177b22097b38', '["ax","etno","imb","jp","wcd"]'::jsonb, 'PGIC', 'tier1-pgic', true),
  ('tier1-specific-pg-merge', 'tier1-merge', 'Tier 1 specific people-group merge', 'v1', '8e7dd1be61ff2071e69ba6c5cf30b9a277ee39f25ed3a7b5351a6311eff2fe62', '["ax","etno","imb","jp","wcd"]'::jsonb, 'PGIC', 'tier1-specific-pg', true),
  ('aggregate1-pgac', 'aggregate1', 'PGAC Aggregate 1', 'v1', 'a00034897ce331f06ca97ff548fdf68e77cf04ce3add01cdcd67303be1da4091', '["tier1-specific-pg"]'::jsonb, 'PGAC', 'aggregate1-pgac', true),
  ('aggregate1-self-engaged', 'aggregate1', 'PGAC Self-Engaged', 'v1', '6fd44c3c6dbcdbd8b244c7a2257acf15e27a23b77cee02006820df29d8666c01', '["aggregate1-pgac"]'::jsonb, 'PGAC', 'aggregate1-self-engaged', true),
  ('aggregate1-watchlist', 'aggregate1', 'Watchlist', 'v1', 'd00121d043431fe0554a9d825ab50076e67f55977e9b3cb2227ad0c2d7524c63', '["aggregate1-pgac"]'::jsonb, 'PGAC', 'aggregate1-watchlist', true),
  ('aggregate1-baseline-uupg', 'aggregate1', 'Baseline UUPG', 'v1', 'db0c9db072c5758f812973493f698b1df84f7c5250206c174112a13000862182', '["aggregate1-watchlist"]'::jsonb, 'PGAC', 'aggregate1-baseline-uupg', true),
  ('aggregate1-hotspots', 'aggregate1', 'Baseline UUPG Hotspots', 'v1', 'f55f6692f1c15347165a0e2bf63a480d923719741de319674a8985e76b1d5b71', '["aggregate1-baseline-uupg"]'::jsonb, 'PGAC', 'aggregate1-hotspots', true),
  ('aggregate1-south-asia', 'aggregate1', 'South Asia', 'v1', 'f638957b5fbaefde243198f2389325c25a322931ef85331516c44e7bde828d59', '["aggregate1-pgac"]'::jsonb, 'PGAC', 'aggregate1-south-asia', true)
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
