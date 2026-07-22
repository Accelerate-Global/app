alter table private.api_connection_run_outputs
  add column if not exists rows_checksum text,
  add column if not exists raw_checksum text;

alter table private.api_connection_run_outputs
  drop constraint if exists api_connection_run_outputs_rows_checksum_check,
  add constraint api_connection_run_outputs_rows_checksum_check
    check (rows_checksum is null or rows_checksum ~ '^[0-9a-f]{64}$'),
  drop constraint if exists api_connection_run_outputs_raw_checksum_check,
  add constraint api_connection_run_outputs_raw_checksum_check
    check (raw_checksum is null or raw_checksum ~ '^[0-9a-f]{64}$');

create table if not exists private.dataset_forming_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references private.api_connections(id) on delete restrict,
  source_run_id uuid not null references private.api_connection_runs(id) on delete restrict,
  resource_set_id uuid not null references private.reference_resource_sets(id) on delete restrict,
  actor_owner_id text not null,
  actor_email text,
  status text not null default 'building',
  source_rows_checksum text not null,
  source_raw_checksum text not null,
  field_contract_version integer not null,
  field_contract_checksum text not null,
  transformation_version text not null,
  transformation_checksum text not null,
  input_row_count integer not null,
  output_row_count integer,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  validation_summary jsonb not null default '{}'::jsonb,
  artifact_manifest jsonb not null default '{}'::jsonb,
  output_checksum text,
  output_size_bytes integer,
  dataset_id uuid references public.datasets(id) on delete set null,
  rejection_reason text,
  rejected_by_owner_id text,
  rejected_at timestamptz,
  publication_reason text,
  warnings_acknowledged boolean not null default false,
  published_by_owner_id text,
  published_at timestamptz,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint dataset_forming_runs_status_check
    check (status in ('building', 'valid', 'invalid', 'rejected', 'publishing', 'published', 'failed')),
  constraint dataset_forming_runs_actor_check check (btrim(actor_owner_id) <> ''),
  constraint dataset_forming_runs_source_rows_checksum_check
    check (source_rows_checksum ~ '^[0-9a-f]{64}$'),
  constraint dataset_forming_runs_source_raw_checksum_check
    check (source_raw_checksum ~ '^[0-9a-f]{64}$'),
  constraint dataset_forming_runs_field_contract_version_check check (field_contract_version > 0),
  constraint dataset_forming_runs_field_contract_checksum_check
    check (field_contract_checksum ~ '^[0-9a-f]{64}$'),
  constraint dataset_forming_runs_transformation_version_check
    check (btrim(transformation_version) <> ''),
  constraint dataset_forming_runs_transformation_checksum_check
    check (transformation_checksum ~ '^[0-9a-f]{64}$'),
  constraint dataset_forming_runs_input_row_count_check check (input_row_count >= 0),
  constraint dataset_forming_runs_output_row_count_check
    check (output_row_count is null or output_row_count >= 0),
  constraint dataset_forming_runs_warning_count_check check (warning_count >= 0),
  constraint dataset_forming_runs_error_count_check check (error_count >= 0),
  constraint dataset_forming_runs_output_checksum_check
    check (output_checksum is null or output_checksum ~ '^[0-9a-f]{64}$'),
  constraint dataset_forming_runs_output_size_check
    check (output_size_bytes is null or output_size_bytes >= 0),
  constraint dataset_forming_runs_rejection_audit_check check (
    (status = 'rejected' and rejection_reason is not null and btrim(rejection_reason) <> '' and rejected_by_owner_id is not null and rejected_at is not null)
    or status <> 'rejected'
  ),
  constraint dataset_forming_runs_publication_audit_check check (
    (status = 'published' and dataset_id is not null and publication_reason is not null and btrim(publication_reason) <> '' and published_by_owner_id is not null and published_at is not null)
    or status <> 'published'
  )
);

create index if not exists dataset_forming_runs_connection_created_idx
  on private.dataset_forming_runs(connection_id, created_at desc, id);
create index if not exists dataset_forming_runs_source_created_idx
  on private.dataset_forming_runs(source_run_id, created_at desc, id);
create index if not exists dataset_forming_runs_resource_set_idx
  on private.dataset_forming_runs(resource_set_id, created_at desc, id);
create index if not exists dataset_forming_runs_dataset_idx
  on private.dataset_forming_runs(dataset_id)
  where dataset_id is not null;
create unique index if not exists dataset_forming_runs_active_build_idx
  on private.dataset_forming_runs(source_run_id, resource_set_id, transformation_checksum)
  where status in ('building', 'valid', 'publishing');
create unique index if not exists dataset_forming_runs_connection_publishing_idx
  on private.dataset_forming_runs(connection_id)
  where status = 'publishing';

create table if not exists private.dataset_forming_findings (
  id bigint generated always as identity primary key,
  forming_run_id uuid not null references private.dataset_forming_runs(id) on delete cascade,
  severity text not null,
  rule_code text not null,
  source_row_index integer,
  stable_row_key text,
  field_name text,
  source_value text,
  canonical_value text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint dataset_forming_findings_severity_check check (severity in ('warning', 'error')),
  constraint dataset_forming_findings_rule_code_check check (btrim(rule_code) <> ''),
  constraint dataset_forming_findings_source_row_index_check
    check (source_row_index is null or source_row_index >= 0),
  constraint dataset_forming_findings_message_check check (btrim(message) <> '')
);

create index if not exists dataset_forming_findings_run_created_idx
  on private.dataset_forming_findings(forming_run_id, id);
create index if not exists dataset_forming_findings_run_severity_idx
  on private.dataset_forming_findings(forming_run_id, severity, id);
create index if not exists dataset_forming_findings_run_row_idx
  on private.dataset_forming_findings(forming_run_id, source_row_index, id)
  where source_row_index is not null;

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

create or replace function private.guard_dataset_forming_finding_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Dataset forming findings are append-only.';
end;
$$;

drop trigger if exists dataset_forming_runs_immutable on private.dataset_forming_runs;
create trigger dataset_forming_runs_immutable
before update or delete on private.dataset_forming_runs
for each row execute function private.guard_dataset_forming_run_immutability();

drop trigger if exists dataset_forming_findings_immutable on private.dataset_forming_findings;
create trigger dataset_forming_findings_immutable
before update or delete on private.dataset_forming_findings
for each row execute function private.guard_dataset_forming_finding_immutability();

alter table private.dataset_forming_runs enable row level security;
alter table private.dataset_forming_findings enable row level security;

revoke all on private.dataset_forming_runs from public, anon, authenticated;
revoke all on private.dataset_forming_findings from public, anon, authenticated;
revoke all on sequence private.dataset_forming_findings_id_seq from public, anon, authenticated;

grant all on private.dataset_forming_runs to service_role;
grant all on private.dataset_forming_findings to service_role;
grant usage, select on sequence private.dataset_forming_findings_id_seq to service_role;
