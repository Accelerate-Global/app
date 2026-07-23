create extension if not exists pgcrypto with schema extensions;

create table private.ax_registry_revisions (
  id uuid primary key default gen_random_uuid(),
  revision_number bigint generated always as identity,
  previous_revision_id uuid references private.ax_registry_revisions(id) on delete restrict,
  content_checksum text not null,
  binding_count integer not null,
  actor_owner_id text not null,
  actor_email text,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint ax_registry_revisions_number_unique unique (revision_number),
  constraint ax_registry_revisions_checksum_check check (content_checksum ~ '^[0-9a-f]{64}$'),
  constraint ax_registry_revisions_binding_count_check check (binding_count >= 0),
  constraint ax_registry_revisions_actor_check check (btrim(actor_owner_id) <> ''),
  constraint ax_registry_revisions_reason_check check (btrim(reason) <> '')
);

create table private.pipeline_publications (
  id uuid primary key default gen_random_uuid(),
  producer_kind text not null,
  producer_run_id uuid not null,
  dataset_id uuid not null references public.datasets(id) on delete restrict,
  source_profile_key text,
  registry_revision_id uuid references private.ax_registry_revisions(id) on delete restrict,
  output_checksum text not null,
  row_count integer not null,
  artifact_manifest jsonb not null default '{}'::jsonb,
  actor_owner_id text not null,
  actor_email text,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint pipeline_publications_producer_check check (
    producer_kind in (
      'dataset-forming', 'identity', 'tier1-merge', 'aggregate1',
      'tier2-forming', 'tier2-merge', 'aggregate2'
    )
  ),
  constraint pipeline_publications_profile_check
    check (source_profile_key is null or btrim(source_profile_key) <> ''),
  constraint pipeline_publications_checksum_check check (output_checksum ~ '^[0-9a-f]{64}$'),
  constraint pipeline_publications_row_count_check check (row_count >= 0),
  constraint pipeline_publications_actor_check check (btrim(actor_owner_id) <> ''),
  constraint pipeline_publications_reason_check check (btrim(reason) <> ''),
  constraint pipeline_publications_producer_unique unique (producer_kind, producer_run_id)
);

create table private.pipeline_publication_rows (
  id bigint generated always as identity primary key,
  publication_id uuid not null references private.pipeline_publications(id) on delete restrict,
  row_index integer not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  constraint pipeline_publication_rows_index_check check (row_index >= 0),
  constraint pipeline_publication_rows_data_check check (jsonb_typeof(data) = 'object'),
  constraint pipeline_publication_rows_unique unique (publication_id, row_index)
);

create table private.ax_identity_counters (
  namespace text primary key,
  next_value integer not null,
  minimum_value integer not null default 1,
  maximum_value integer not null default 999999,
  updated_at timestamptz not null default now(),
  constraint ax_identity_counters_namespace_check check (namespace ~ '^[a-z][a-z0-9-]{0,63}$'),
  constraint ax_identity_counters_bounds_check check (
    minimum_value between 0 and 999999
    and maximum_value between minimum_value and 999999
    and next_value between minimum_value and maximum_value + 1
  )
);

insert into private.ax_identity_counters (namespace, next_value)
values ('people-groups', 1)
on conflict (namespace) do nothing;

create table private.ax_identity_runs (
  id uuid primary key default gen_random_uuid(),
  source_publication_id uuid not null references private.pipeline_publications(id) on delete restrict,
  base_revision_id uuid references private.ax_registry_revisions(id) on delete restrict,
  source_profile_key text not null,
  rules_version text not null,
  rules_checksum text not null,
  resource_bindings jsonb not null,
  input_fingerprint text not null,
  actor_owner_id text not null,
  actor_email text,
  status text not null default 'building',
  input_row_count integer not null,
  output_row_count integer,
  reused_count integer not null default 0,
  retained_count integer not null default 0,
  reserved_count integer not null default 0,
  conflict_count integer not null default 0,
  unassignable_count integer not null default 0,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  output_checksum text,
  row_evidence_checksum text,
  artifact_manifest jsonb not null default '{}'::jsonb,
  dataset_id uuid references public.datasets(id) on delete restrict,
  publication_id uuid references private.pipeline_publications(id) on delete restrict,
  registry_revision_id uuid references private.ax_registry_revisions(id) on delete restrict,
  rejection_reason text,
  rejected_by_owner_id text,
  rejected_at timestamptz,
  publication_reason text,
  published_by_owner_id text,
  published_at timestamptz,
  error_message text,
  reservation_expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ax_identity_runs_status_check check (
    status in ('building', 'valid', 'invalid', 'rejected', 'publishing', 'published', 'failed', 'expired')
  ),
  constraint ax_identity_runs_profile_check check (btrim(source_profile_key) <> ''),
  constraint ax_identity_runs_rules_check check (btrim(rules_version) <> '' and rules_checksum ~ '^[0-9a-f]{64}$'),
  constraint ax_identity_runs_fingerprint_check check (input_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint ax_identity_runs_actor_check check (btrim(actor_owner_id) <> ''),
  constraint ax_identity_runs_resource_bindings_check check (jsonb_typeof(resource_bindings) = 'object'),
  constraint ax_identity_runs_counts_check check (
    input_row_count >= 0 and (output_row_count is null or output_row_count >= 0)
    and reused_count >= 0 and retained_count >= 0 and reserved_count >= 0
    and conflict_count >= 0 and unassignable_count >= 0
    and warning_count >= 0 and error_count >= 0
  ),
  constraint ax_identity_runs_output_checksum_check
    check (output_checksum is null or output_checksum ~ '^[0-9a-f]{64}$'),
  constraint ax_identity_runs_row_evidence_checksum_check
    check (row_evidence_checksum is null or row_evidence_checksum ~ '^[0-9a-f]{64}$'),
  constraint ax_identity_runs_rejection_audit_check check (
    status <> 'rejected'
    or (rejection_reason is not null and btrim(rejection_reason) <> ''
      and rejected_by_owner_id is not null and rejected_at is not null)
  ),
  constraint ax_identity_runs_publication_audit_check check (
    status <> 'published'
    or (dataset_id is not null and publication_id is not null and registry_revision_id is not null
      and publication_reason is not null and btrim(publication_reason) <> ''
      and published_by_owner_id is not null and published_at is not null)
  ),
  constraint ax_identity_runs_input_unique unique (source_publication_id, input_fingerprint)
);

create table private.ax_identities (
  id uuid primary key default gen_random_uuid(),
  namespace text not null references private.ax_identity_counters(namespace) on delete restrict,
  identity_kind text not null,
  parent_identity_id uuid references private.ax_identities(id) on delete restrict,
  normalized_iso3 text,
  rop3_component text,
  allocated_value integer,
  lifecycle_state text not null default 'reserved',
  created_by_run_id uuid references private.ax_identity_runs(id) on delete restrict,
  created_by_import_id uuid,
  activated_revision_id uuid references private.ax_registry_revisions(id) on delete restrict,
  superseded_by_identity_id uuid references private.ax_identities(id) on delete restrict,
  activated_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ax_identities_kind_check check (identity_kind in ('pgac', 'pgic')),
  constraint ax_identities_shape_check check (
    (identity_kind = 'pgac' and parent_identity_id is null and normalized_iso3 is null)
    or (identity_kind = 'pgic' and parent_identity_id is not null and normalized_iso3 ~ '^[A-Z]{3}$')
  ),
  constraint ax_identities_component_check check (
    (rop3_component is null or rop3_component ~ '^\d{6}$')
    and (allocated_value is null or allocated_value between 0 and 999999)
    and not (rop3_component is not null and allocated_value is not null)
  ),
  constraint ax_identities_lifecycle_check check (
    lifecycle_state in ('reserved', 'active', 'cancelled', 'superseded')
  )
);

create unique index ax_identities_allocated_value_idx
  on private.ax_identities(namespace, allocated_value)
  where identity_kind = 'pgac' and allocated_value is not null;
create unique index ax_identities_pgic_parent_iso_idx
  on private.ax_identities(parent_identity_id, normalized_iso3)
  where identity_kind = 'pgic' and lifecycle_state in ('reserved', 'active');

create table private.ax_identity_codes (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references private.ax_identities(id) on delete restrict,
  code text not null,
  code_kind text not null,
  lifecycle_state text not null default 'reserved',
  created_by_run_id uuid references private.ax_identity_runs(id) on delete restrict,
  created_by_import_id uuid,
  activated_revision_id uuid references private.ax_registry_revisions(id) on delete restrict,
  superseded_by_code_id uuid references private.ax_identity_codes(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint ax_identity_codes_code_shape_check
    check (code ~ '^\d{2}-[a-z0-9]{1,8}-\d{6}(-[A-Z]{3})?$'),
  constraint ax_identity_codes_kind_check check (code_kind in ('canonical', 'alias')),
  constraint ax_identity_codes_lifecycle_check check (
    lifecycle_state in ('reserved', 'active', 'cancelled', 'superseded')
  ),
  constraint ax_identity_codes_value_unique unique (code)
);

create unique index ax_identity_codes_canonical_identity_idx
  on private.ax_identity_codes(identity_id)
  where code_kind = 'canonical' and lifecycle_state in ('reserved', 'active');

create table private.ax_identity_source_bindings (
  id uuid primary key default gen_random_uuid(),
  source_profile_key text not null,
  stable_row_key text not null,
  identity_id uuid not null references private.ax_identities(id) on delete restrict,
  identity_run_id uuid references private.ax_identity_runs(id) on delete restrict,
  legacy_import_id uuid,
  binding_state text not null default 'reserved',
  source_pgac_code text,
  source_pgic_code text,
  reserved_until timestamptz,
  activated_revision_id uuid references private.ax_registry_revisions(id) on delete restrict,
  superseded_by_binding_id uuid references private.ax_identity_source_bindings(id) on delete restrict,
  activated_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ax_identity_source_bindings_profile_check check (btrim(source_profile_key) <> ''),
  constraint ax_identity_source_bindings_key_check check (btrim(stable_row_key) <> ''),
  constraint ax_identity_source_bindings_state_check check (
    binding_state in ('reserved', 'active', 'cancelled', 'superseded')
  ),
  constraint ax_identity_source_bindings_owner_check check (
    (identity_run_id is not null)::integer + (legacy_import_id is not null)::integer = 1
  ),
  constraint ax_identity_source_bindings_reservation_check check (
    binding_state <> 'reserved' or reserved_until is not null
  )
);

create unique index ax_identity_source_bindings_current_key_idx
  on private.ax_identity_source_bindings(source_profile_key, stable_row_key)
  where binding_state in ('reserved', 'active');
create index ax_identity_source_bindings_identity_idx
  on private.ax_identity_source_bindings(identity_id, created_at desc);
create index ax_identity_source_bindings_run_idx
  on private.ax_identity_source_bindings(identity_run_id, created_at, id);

create table private.ax_identity_run_rows (
  id bigint generated always as identity primary key,
  identity_run_id uuid not null references private.ax_identity_runs(id) on delete restrict,
  source_row_index integer not null,
  stable_row_key text,
  assignment_status text not null,
  binding_id uuid references private.ax_identity_source_bindings(id) on delete restrict,
  pgac_code text,
  pgic_code text,
  enriched_row jsonb not null,
  created_at timestamptz not null default now(),
  constraint ax_identity_run_rows_index_check check (source_row_index >= 0),
  constraint ax_identity_run_rows_status_check check (
    assignment_status in ('reused', 'retained', 'reserved', 'conflict', 'unassignable')
  ),
  constraint ax_identity_run_rows_data_check check (jsonb_typeof(enriched_row) = 'object'),
  constraint ax_identity_run_rows_assignment_check check (
    (assignment_status in ('reused', 'retained', 'reserved')
      and binding_id is not null and pgac_code is not null and pgic_code is not null)
    or (assignment_status in ('conflict', 'unassignable') and binding_id is null)
  ),
  constraint ax_identity_run_rows_unique unique (identity_run_id, source_row_index)
);

create table private.ax_identity_findings (
  id bigint generated always as identity primary key,
  identity_run_id uuid not null references private.ax_identity_runs(id) on delete restrict,
  severity text not null,
  rule_code text not null,
  source_row_index integer,
  stable_row_key text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ax_identity_findings_severity_check check (severity in ('warning', 'error')),
  constraint ax_identity_findings_rule_check check (btrim(rule_code) <> ''),
  constraint ax_identity_findings_index_check check (source_row_index is null or source_row_index >= 0),
  constraint ax_identity_findings_message_check check (btrim(message) <> '')
);

create table private.ax_identity_artifacts (
  id uuid primary key default gen_random_uuid(),
  identity_run_id uuid references private.ax_identity_runs(id) on delete restrict,
  legacy_import_id uuid,
  artifact_kind text not null,
  storage_path text not null,
  content_checksum text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now(),
  constraint ax_identity_artifacts_owner_check check (
    (identity_run_id is not null)::integer + (legacy_import_id is not null)::integer = 1
  ),
  constraint ax_identity_artifacts_kind_check check (
    artifact_kind in ('rows', 'findings', 'manifest', 'csv', 'snapshot', 'report')
  ),
  constraint ax_identity_artifacts_path_check check (btrim(storage_path) <> ''),
  constraint ax_identity_artifacts_checksum_check check (content_checksum ~ '^[0-9a-f]{64}$'),
  constraint ax_identity_artifacts_size_check check (size_bytes >= 0),
  constraint ax_identity_artifacts_run_kind_unique unique (identity_run_id, artifact_kind)
);

create table private.ax_identity_legacy_imports (
  id uuid primary key default gen_random_uuid(),
  input_fingerprint text not null unique,
  snapshot_manifest jsonb not null,
  status text not null,
  finding_count integer not null default 0,
  registry_revision_id uuid references private.ax_registry_revisions(id) on delete restrict,
  actor_owner_id text not null,
  actor_email text,
  reason text,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ax_identity_legacy_imports_fingerprint_check check (input_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint ax_identity_legacy_imports_status_check check (status in ('dry-run', 'blocked', 'committed')),
  constraint ax_identity_legacy_imports_findings_check check (finding_count >= 0),
  constraint ax_identity_legacy_imports_actor_check check (btrim(actor_owner_id) <> ''),
  constraint ax_identity_legacy_imports_commit_check check (
    status <> 'committed' or (registry_revision_id is not null and committed_at is not null)
  )
);

alter table private.ax_identity_artifacts
  add constraint ax_identity_artifacts_import_fk
  foreign key (legacy_import_id) references private.ax_identity_legacy_imports(id) on delete restrict;

alter table private.ax_identities
  add constraint ax_identities_import_fk
  foreign key (created_by_import_id) references private.ax_identity_legacy_imports(id) on delete restrict;
alter table private.ax_identity_codes
  add constraint ax_identity_codes_import_fk
  foreign key (created_by_import_id) references private.ax_identity_legacy_imports(id) on delete restrict;
alter table private.ax_identity_source_bindings
  add constraint ax_identity_source_bindings_import_fk
  foreign key (legacy_import_id) references private.ax_identity_legacy_imports(id) on delete restrict;

create table private.ax_registry_revision_bindings (
  revision_id uuid not null references private.ax_registry_revisions(id) on delete restrict,
  binding_id uuid not null references private.ax_identity_source_bindings(id) on delete restrict,
  primary key (revision_id, binding_id)
);

create index pipeline_publications_dataset_idx on private.pipeline_publications(dataset_id, created_at desc);
create index pipeline_publications_revision_idx on private.pipeline_publications(registry_revision_id, created_at desc)
  where registry_revision_id is not null;
create index pipeline_publications_profile_idx on private.pipeline_publications(source_profile_key, created_at desc)
  where source_profile_key is not null;
create index pipeline_publication_rows_publication_idx on private.pipeline_publication_rows(publication_id, row_index);
create index ax_identity_runs_created_idx on private.ax_identity_runs(created_at desc, id);
create index ax_identity_runs_status_idx on private.ax_identity_runs(status, created_at desc, id);
create index ax_identity_runs_source_idx on private.ax_identity_runs(source_publication_id, created_at desc);
create index ax_identity_run_rows_run_idx on private.ax_identity_run_rows(identity_run_id, source_row_index);
create index ax_identity_findings_run_idx on private.ax_identity_findings(identity_run_id, severity, id);
create index ax_identity_codes_identity_idx on private.ax_identity_codes(identity_id, created_at);
create index ax_registry_revision_bindings_binding_idx on private.ax_registry_revision_bindings(binding_id, revision_id);

create or replace function private.ax_identity_code_parts(
  p_rop1 text,
  p_source_initials text,
  p_six_digit text,
  p_iso3 text
)
returns table (pgac_code text, pgic_code text)
language sql
immutable
set search_path = ''
as $$
  select
    right(coalesce(nullif(p_rop1, ''), '00'), 2) || '-' || p_source_initials || '-' || p_six_digit,
    right(coalesce(nullif(p_rop1, ''), '00'), 2) || '-' || p_source_initials || '-' || p_six_digit || '-' || p_iso3
$$;

create or replace function private.allocate_ax_identity_value(
  p_namespace text,
  p_source_profile_key text,
  p_stable_row_key text,
  p_identity_run_id uuid,
  p_rop1 text,
  p_source_initials text,
  p_iso3 text,
  p_reserved_until timestamptz
)
returns table (
  binding_id uuid,
  identity_id uuid,
  allocated_value integer,
  pgac_code text,
  pgic_code text,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_record record;
  next_number integer;
  parent_id uuid;
  child_id uuid;
  new_binding_id uuid;
  six_digit text;
  new_pgac text;
  new_pgic text;
begin
  if p_source_profile_key is null or btrim(p_source_profile_key) = ''
    or p_stable_row_key is null or btrim(p_stable_row_key) = ''
    or p_source_initials !~ '^[a-z0-9]{1,8}$'
    or p_iso3 !~ '^[A-Z]{3}$'
    or (p_rop1 is not null and p_rop1 <> '' and p_rop1 !~ '^[A-Z][0-9]{3}$')
    or p_reserved_until is null or p_reserved_until <= now()
  then
    raise exception 'AX identity allocation inputs are invalid.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_source_profile_key || ':' || p_stable_row_key, 7));

  select
    binding.id as binding_id,
    child.id as identity_id,
    parent.allocated_value,
    parent_code.code as pgac_code,
    child_code.code as pgic_code
  into existing_record
  from private.ax_identity_source_bindings as binding
  join private.ax_identities as child on child.id = binding.identity_id
  join private.ax_identities as parent on parent.id = child.parent_identity_id
  join private.ax_identity_codes as child_code
    on child_code.identity_id = child.id and child_code.code_kind = 'canonical'
      and child_code.lifecycle_state in ('reserved', 'active')
  join private.ax_identity_codes as parent_code
    on parent_code.identity_id = parent.id and parent_code.code_kind = 'canonical'
      and parent_code.lifecycle_state in ('reserved', 'active')
  where binding.source_profile_key = p_source_profile_key
    and binding.stable_row_key = p_stable_row_key
    and (
      (binding.binding_state = 'reserved'
        and binding.identity_run_id = p_identity_run_id)
      or (
        binding.binding_state = 'active'
        and exists (
          select 1
          from private.ax_identity_runs as identity_run
          join private.ax_registry_revision_bindings as revision_binding
            on revision_binding.revision_id = identity_run.base_revision_id
           and revision_binding.binding_id = binding.id
          where identity_run.id = p_identity_run_id
        )
      )
    )
  limit 1;

  if existing_record is not null then
    return query select existing_record.binding_id, existing_record.identity_id,
      existing_record.allocated_value, existing_record.pgac_code,
      existing_record.pgic_code, true;
    return;
  end if;

  select counter.next_value
  into next_number
  from private.ax_identity_counters as counter
  where counter.namespace = p_namespace
  for update;

  if next_number is null then
    raise exception 'AX identity namespace does not exist.' using errcode = '22023';
  end if;

  if next_number > (
    select maximum_value from private.ax_identity_counters where namespace = p_namespace
  ) then
    raise exception 'AX identity namespace is exhausted.' using errcode = '22003';
  end if;

  update private.ax_identity_counters
  set next_value = next_number + 1, updated_at = now()
  where namespace = p_namespace;

  six_digit := lpad(next_number::text, 6, '0');
  select parts.pgac_code, parts.pgic_code into new_pgac, new_pgic
  from private.ax_identity_code_parts(p_rop1, p_source_initials, six_digit, p_iso3) as parts;

  insert into private.ax_identities (
    namespace, identity_kind, allocated_value, lifecycle_state, created_by_run_id
  ) values (p_namespace, 'pgac', next_number, 'reserved', p_identity_run_id)
  returning id into parent_id;

  insert into private.ax_identities (
    namespace, identity_kind, parent_identity_id, normalized_iso3,
    lifecycle_state, created_by_run_id
  ) values (
    p_namespace, 'pgic', parent_id, p_iso3, 'reserved', p_identity_run_id
  ) returning id into child_id;

  insert into private.ax_identity_codes (identity_id, code, code_kind, lifecycle_state, created_by_run_id)
  values
    (parent_id, new_pgac, 'canonical', 'reserved', p_identity_run_id),
    (child_id, new_pgic, 'canonical', 'reserved', p_identity_run_id);

  insert into private.ax_identity_source_bindings (
    source_profile_key, stable_row_key, identity_id, identity_run_id,
    binding_state, reserved_until
  ) values (
    p_source_profile_key, p_stable_row_key, child_id, p_identity_run_id,
    'reserved', p_reserved_until
  ) returning id into new_binding_id;

  return query select new_binding_id, child_id, next_number, new_pgac, new_pgic, false;
end;
$$;

create or replace function private.cancel_ax_identity_run_reservations(
  p_identity_run_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cancelled_count integer;
begin
  update private.ax_identity_source_bindings
  set binding_state = 'cancelled', cancelled_at = now()
  where identity_run_id = p_identity_run_id and binding_state = 'reserved';
  get diagnostics cancelled_count = row_count;

  update private.ax_identity_codes
  set lifecycle_state = 'cancelled'
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'reserved';

  update private.ax_identities
  set lifecycle_state = 'cancelled', cancelled_at = now()
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'reserved';

  return cancelled_count;
end;
$$;

create or replace function private.activate_ax_identity_run(
  p_identity_run_id uuid,
  p_actor_owner_id text,
  p_actor_email text,
  p_reason text,
  p_file_name text,
  p_blob_url text,
  p_blob_path text,
  p_size_bytes integer,
  p_columns jsonb
)
returns table (revision_id uuid, publication_id uuid, dataset_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record record;
  prior_revision_id uuid;
  new_revision_id uuid;
  new_publication_id uuid;
  new_dataset_id uuid;
  binding_checksum text;
  active_binding_count integer;
  current_row_evidence_checksum text;
begin
  if p_actor_owner_id is null or btrim(p_actor_owner_id) = ''
    or p_reason is null or btrim(p_reason) = ''
    or p_file_name is null or btrim(p_file_name) = ''
    or p_blob_path is null or btrim(p_blob_path) = ''
    or p_blob_url is null or btrim(p_blob_url) = ''
    or p_size_bytes < 0 or jsonb_typeof(p_columns) <> 'array'
  then
    raise exception 'AX identity publication inputs are invalid.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ax-identity-publication', 11));

  select * into run_record
  from private.ax_identity_runs
  where id = p_identity_run_id
  for update;

  if run_record is null then
    raise exception 'AX identity candidate does not exist.' using errcode = 'P0002';
  end if;

  if run_record.status = 'published' then
    return query select run_record.registry_revision_id, run_record.publication_id, run_record.dataset_id;
    return;
  end if;

  if run_record.status <> 'valid' or run_record.error_count <> 0
    or run_record.conflict_count <> 0 or run_record.unassignable_count <> 0
    or run_record.output_checksum is null
  then
    raise exception 'AX identity candidate is not publishable.' using errcode = '23514';
  end if;

  if (select count(*) from private.ax_identity_run_rows where identity_run_id = p_identity_run_id)
    <> run_record.output_row_count
  then
    raise exception 'AX identity candidate row evidence is incomplete.' using errcode = '23514';
  end if;

  select encode(extensions.digest(
    coalesce(jsonb_agg(jsonb_build_object(
      'sourceRowIndex', source_row_index,
      'data', enriched_row
    ) order by source_row_index)::text, '[]'),
    'sha256'
  ), 'hex')
  into current_row_evidence_checksum
  from private.ax_identity_run_rows
  where identity_run_id = p_identity_run_id;

  if run_record.row_evidence_checksum is null
    or current_row_evidence_checksum is distinct from run_record.row_evidence_checksum
  then
    raise exception 'AX identity candidate row evidence checksum does not match.' using errcode = '23514';
  end if;

  update private.ax_identity_runs set status = 'publishing' where id = p_identity_run_id;

  select id into prior_revision_id
  from private.ax_registry_revisions
  order by revision_number desc
  limit 1;

  update private.ax_identity_source_bindings
  set binding_state = 'active', reserved_until = null, activated_at = now()
  where identity_run_id = p_identity_run_id and binding_state = 'reserved';

  update private.ax_identities
  set lifecycle_state = 'active', activated_at = coalesce(activated_at, now())
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'reserved';

  update private.ax_identity_codes
  set lifecycle_state = 'active'
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'reserved';

  select count(*)::integer,
    encode(extensions.digest(coalesce(string_agg(
      source_profile_key || ':' || stable_row_key || ':' || identity_id::text,
      '|' order by source_profile_key, stable_row_key, identity_id
    ), ''), 'sha256'), 'hex')
  into active_binding_count, binding_checksum
  from private.ax_identity_source_bindings
  where binding_state = 'active';

  insert into private.ax_registry_revisions (
    previous_revision_id, content_checksum, binding_count,
    actor_owner_id, actor_email, reason
  ) values (
    prior_revision_id, binding_checksum, active_binding_count,
    p_actor_owner_id, p_actor_email, p_reason
  ) returning id into new_revision_id;

  update private.ax_identity_source_bindings
  set activated_revision_id = coalesce(activated_revision_id, new_revision_id)
  where identity_run_id = p_identity_run_id and binding_state = 'active';

  update private.ax_identities
  set activated_revision_id = coalesce(activated_revision_id, new_revision_id)
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'active';

  update private.ax_identity_codes
  set activated_revision_id = coalesce(activated_revision_id, new_revision_id)
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'active';

  insert into private.ax_registry_revision_bindings (revision_id, binding_id)
  select new_revision_id, id
  from private.ax_identity_source_bindings
  where binding_state = 'active';

  insert into public.datasets (
    owner_id, file_name, blob_url, blob_path, current_version_action,
    current_version_actor_owner_id, current_version_actor_email,
    is_primary, is_workspace_visible, status, row_count, size_bytes,
    columns, hidden_column_keys, tags
  ) values (
    p_actor_owner_id, p_file_name, p_blob_url, p_blob_path, 'api_import',
    p_actor_owner_id, p_actor_email, false, false, 'ready',
    run_record.output_row_count, p_size_bytes, p_columns, '[]'::jsonb, '[]'::jsonb
  ) returning id into new_dataset_id;

  insert into public.dataset_rows (dataset_id, row_index, data)
  select new_dataset_id, source_row_index, enriched_row
  from private.ax_identity_run_rows
  where identity_run_id = p_identity_run_id
  order by source_row_index;

  insert into private.pipeline_publications (
    producer_kind, producer_run_id, dataset_id, source_profile_key,
    registry_revision_id, output_checksum, row_count, artifact_manifest,
    actor_owner_id, actor_email, reason
  ) values (
    'identity', p_identity_run_id, new_dataset_id, run_record.source_profile_key,
    new_revision_id, run_record.output_checksum, run_record.output_row_count,
    run_record.artifact_manifest, p_actor_owner_id, p_actor_email, p_reason
  ) returning id into new_publication_id;

  insert into private.pipeline_publication_rows (publication_id, row_index, data)
  select new_publication_id, source_row_index, enriched_row
  from private.ax_identity_run_rows
  where identity_run_id = p_identity_run_id
  order by source_row_index;

  update private.ax_identity_runs
  set status = 'published', dataset_id = new_dataset_id,
    publication_id = new_publication_id, registry_revision_id = new_revision_id,
    publication_reason = p_reason, published_by_owner_id = p_actor_owner_id,
    published_at = now(), completed_at = coalesce(completed_at, now())
  where id = p_identity_run_id;

  return query select new_revision_id, new_publication_id, new_dataset_id;
end;
$$;

create or replace function private.guard_ax_immutable_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'AX identity history is append-only.';
end;
$$;

create or replace function private.guard_ax_identity_counter()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or new.namespace is distinct from old.namespace
    or new.minimum_value is distinct from old.minimum_value
    or new.maximum_value is distinct from old.maximum_value
    or new.next_value < old.next_value
  then
    raise exception 'AX identity counter values cannot be deleted, renumbered, or recycled.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_ax_identity_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    or new.namespace is distinct from old.namespace
    or new.identity_kind is distinct from old.identity_kind
    or new.parent_identity_id is distinct from old.parent_identity_id
    or new.normalized_iso3 is distinct from old.normalized_iso3
    or new.rop3_component is distinct from old.rop3_component
    or new.allocated_value is distinct from old.allocated_value
    or new.created_by_run_id is distinct from old.created_by_run_id
    or new.created_by_import_id is distinct from old.created_by_import_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'AX identity structural history is immutable.';
  end if;
  if old.lifecycle_state = 'active' and new.lifecycle_state not in ('active', 'superseded') then
    raise exception 'Active AX identities cannot return to a pre-activation state.';
  end if;
  if old.lifecycle_state in ('cancelled', 'superseded') and new is distinct from old then
    raise exception 'Final AX identity lifecycle records are immutable.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_ax_code_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    or new.identity_id is distinct from old.identity_id
    or new.code is distinct from old.code
    or new.code_kind is distinct from old.code_kind
    or new.created_by_run_id is distinct from old.created_by_run_id
    or new.created_by_import_id is distinct from old.created_by_import_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'AX identity code history is immutable.';
  end if;
  if old.lifecycle_state = 'active' and new.lifecycle_state not in ('active', 'superseded') then
    raise exception 'Active AX identity codes cannot return to a pre-activation state.';
  end if;
  if old.lifecycle_state in ('cancelled', 'superseded') and new is distinct from old then
    raise exception 'Final AX identity code records are immutable.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_ax_binding_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    or new.source_profile_key is distinct from old.source_profile_key
    or new.stable_row_key is distinct from old.stable_row_key
    or new.identity_id is distinct from old.identity_id
    or new.identity_run_id is distinct from old.identity_run_id
    or new.legacy_import_id is distinct from old.legacy_import_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'AX source binding history is immutable.';
  end if;
  if old.binding_state = 'active' and new.binding_state not in ('active', 'superseded') then
    raise exception 'Active AX bindings cannot return to a pre-activation state.';
  end if;
  if old.binding_state in ('cancelled', 'superseded') and new is distinct from old then
    raise exception 'Final AX binding records are immutable.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_ax_identity_run()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    or new.source_publication_id is distinct from old.source_publication_id
    or new.base_revision_id is distinct from old.base_revision_id
    or new.source_profile_key is distinct from old.source_profile_key
    or new.rules_version is distinct from old.rules_version
    or new.rules_checksum is distinct from old.rules_checksum
    or new.resource_bindings is distinct from old.resource_bindings
    or new.input_fingerprint is distinct from old.input_fingerprint
    or new.actor_owner_id is distinct from old.actor_owner_id
    or new.input_row_count is distinct from old.input_row_count
    or new.created_at is distinct from old.created_at
  then
    raise exception 'AX identity candidate input lineage is immutable.';
  end if;
  if old.status in ('published', 'rejected', 'failed', 'expired') and new is distinct from old then
    raise exception 'Final AX identity candidate records are immutable.';
  end if;
  if old.status <> 'building' and (
    new.output_row_count is distinct from old.output_row_count
    or new.reused_count is distinct from old.reused_count
    or new.retained_count is distinct from old.retained_count
    or new.reserved_count is distinct from old.reserved_count
    or new.conflict_count is distinct from old.conflict_count
    or new.unassignable_count is distinct from old.unassignable_count
    or new.warning_count is distinct from old.warning_count
    or new.error_count is distinct from old.error_count
    or new.output_checksum is distinct from old.output_checksum
    or new.row_evidence_checksum is distinct from old.row_evidence_checksum
    or new.artifact_manifest is distinct from old.artifact_manifest
  ) then
    raise exception 'Reviewed AX identity candidate evidence is immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists ax_registry_revisions_immutable on private.ax_registry_revisions;
create trigger ax_registry_revisions_immutable before update or delete on private.ax_registry_revisions
  for each row execute function private.guard_ax_immutable_history();
drop trigger if exists ax_registry_revision_bindings_immutable on private.ax_registry_revision_bindings;
create trigger ax_registry_revision_bindings_immutable before update or delete on private.ax_registry_revision_bindings
  for each row execute function private.guard_ax_immutable_history();
drop trigger if exists pipeline_publications_immutable on private.pipeline_publications;
create trigger pipeline_publications_immutable before update or delete on private.pipeline_publications
  for each row execute function private.guard_ax_immutable_history();
drop trigger if exists pipeline_publication_rows_immutable on private.pipeline_publication_rows;
create trigger pipeline_publication_rows_immutable before update or delete on private.pipeline_publication_rows
  for each row execute function private.guard_ax_immutable_history();
drop trigger if exists ax_identity_counters_non_recycling on private.ax_identity_counters;
create trigger ax_identity_counters_non_recycling before update or delete on private.ax_identity_counters
  for each row execute function private.guard_ax_identity_counter();
drop trigger if exists ax_identities_lifecycle on private.ax_identities;
create trigger ax_identities_lifecycle before update or delete on private.ax_identities
  for each row execute function private.guard_ax_identity_lifecycle();
drop trigger if exists ax_identity_codes_lifecycle on private.ax_identity_codes;
create trigger ax_identity_codes_lifecycle before update or delete on private.ax_identity_codes
  for each row execute function private.guard_ax_code_lifecycle();
drop trigger if exists ax_identity_source_bindings_lifecycle on private.ax_identity_source_bindings;
create trigger ax_identity_source_bindings_lifecycle before update or delete on private.ax_identity_source_bindings
  for each row execute function private.guard_ax_binding_lifecycle();
drop trigger if exists ax_identity_runs_lifecycle on private.ax_identity_runs;
create trigger ax_identity_runs_lifecycle before update or delete on private.ax_identity_runs
  for each row execute function private.guard_ax_identity_run();
drop trigger if exists ax_identity_run_rows_immutable on private.ax_identity_run_rows;
create trigger ax_identity_run_rows_immutable before update or delete on private.ax_identity_run_rows
  for each row execute function private.guard_ax_immutable_history();
drop trigger if exists ax_identity_findings_immutable on private.ax_identity_findings;
create trigger ax_identity_findings_immutable before update or delete on private.ax_identity_findings
  for each row execute function private.guard_ax_immutable_history();
drop trigger if exists ax_identity_artifacts_immutable on private.ax_identity_artifacts;
create trigger ax_identity_artifacts_immutable before update or delete on private.ax_identity_artifacts
  for each row execute function private.guard_ax_immutable_history();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'pipeline_publications', 'pipeline_publication_rows', 'ax_registry_revisions',
    'ax_registry_revision_bindings', 'ax_identity_counters', 'ax_identities',
    'ax_identity_codes', 'ax_identity_source_bindings', 'ax_identity_runs',
    'ax_identity_run_rows', 'ax_identity_findings', 'ax_identity_artifacts',
    'ax_identity_legacy_imports'
  ] loop
    execute format('alter table private.%I enable row level security', table_name);
    execute format('revoke all on private.%I from public, anon, authenticated', table_name);
    execute format('grant all on private.%I to service_role', table_name);
  end loop;
end;
$$;

revoke all on sequence private.pipeline_publication_rows_id_seq from public, anon, authenticated;
revoke all on sequence private.ax_registry_revisions_revision_number_seq from public, anon, authenticated;
revoke all on sequence private.ax_identity_run_rows_id_seq from public, anon, authenticated;
revoke all on sequence private.ax_identity_findings_id_seq from public, anon, authenticated;
grant usage, select on sequence private.pipeline_publication_rows_id_seq to service_role;
grant usage, select on sequence private.ax_registry_revisions_revision_number_seq to service_role;
grant usage, select on sequence private.ax_identity_run_rows_id_seq to service_role;
grant usage, select on sequence private.ax_identity_findings_id_seq to service_role;

revoke all on function private.ax_identity_code_parts(text, text, text, text)
  from public, anon, authenticated;
revoke all on function private.allocate_ax_identity_value(text, text, text, uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function private.cancel_ax_identity_run_reservations(uuid)
  from public, anon, authenticated;
revoke all on function private.activate_ax_identity_run(uuid, text, text, text, text, text, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function private.ax_identity_code_parts(text, text, text, text) to service_role;
grant execute on function private.allocate_ax_identity_value(text, text, text, uuid, text, text, text, timestamptz) to service_role;
grant execute on function private.cancel_ax_identity_run_reservations(uuid) to service_role;
grant execute on function private.activate_ax_identity_run(uuid, text, text, text, text, text, text, integer, jsonb) to service_role;
