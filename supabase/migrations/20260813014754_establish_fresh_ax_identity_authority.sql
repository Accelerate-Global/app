-- AX Online deliberately starts a new identity authority. Refuse to reinterpret
-- any existing or staged authority state as fresh state.
do $$
begin
  if exists (select 1 from private.ax_identities)
    or exists (select 1 from private.ax_identity_codes)
    or exists (select 1 from private.ax_identity_source_bindings)
    or exists (select 1 from private.ax_registry_revisions)
    or exists (select 1 from private.ax_identity_legacy_imports)
    or exists (select 1 from private.ax_identity_registry_cutovers)
    or exists (select 1 from private.ax_identity_graph_commit_sessions)
    or exists (select 1 from private.ax_identity_legacy_import_audits)
    or exists (
      select 1 from private.ax_identity_artifacts where legacy_import_id is not null
    )
    or coalesce((
      select next_value from private.ax_identity_counters
      where namespace = 'people-groups'
    ), 0) <> 1
  then
    raise exception 'Fresh AX authority migration requires a completely empty identity graph and counter 000001.'
      using errcode = '23514';
  end if;
  if exists (
    select 1 from storage.objects where bucket_id = 'identity-registry-evidence'
  ) then
    raise exception 'Legacy AX identity evidence storage must be inventoried and empty before fresh authority migration.'
      using errcode = '23514';
  end if;
end;
$$;

-- Remove legacy-only guards before removing the legacy columns and tables they
-- reference. Current Tier 2 configuration remains protected by active/current
-- source bindings rather than by legacy import ownership.
drop trigger if exists ax_identity_legacy_imports_verified_guard
  on private.ax_identity_legacy_imports;
drop trigger if exists ax_identity_legacy_import_audits_immutable
  on private.ax_identity_legacy_import_audits;
drop trigger if exists ax_identity_legacy_import_audits_require_session
  on private.ax_identity_legacy_import_audits;
drop trigger if exists ax_identity_registry_cutovers_immutable
  on private.ax_identity_registry_cutovers;
drop trigger if exists ax_identity_registry_cutovers_require_finalizer
  on private.ax_identity_registry_cutovers;
drop trigger if exists ax_identities_require_cutover on private.ax_identities;
drop trigger if exists ax_identity_codes_require_import_session
  on private.ax_identity_codes;
drop trigger if exists ax_identity_source_bindings_require_import_session
  on private.ax_identity_source_bindings;
drop trigger if exists ax_identities_require_import_activation_session
  on private.ax_identities;
drop trigger if exists ax_identity_codes_require_import_activation_session
  on private.ax_identity_codes;
drop trigger if exists ax_identity_source_bindings_require_import_activation_session
  on private.ax_identity_source_bindings;
drop trigger if exists pipeline_publications_require_identity_cutover
  on private.pipeline_publications;

drop trigger if exists tier2_partner_profiles_guard_identity
  on private.tier2_partner_profiles;
drop trigger if exists tier2_partner_profiles_serialize_identity
  on private.tier2_partner_profiles;
drop trigger if exists api_connections_guard_tier2_identity
  on private.api_connections;
drop trigger if exists api_connections_serialize_tier2_identity
  on private.api_connections;

drop function if exists private.begin_legacy_ax_identity_graph_commit(uuid, text, text);
drop function if exists private.finalize_legacy_ax_identity_graph_import(uuid, text, text, text, text, text);
drop function if exists private.has_legacy_ax_graph_commit_session(uuid);
drop function if exists private.guard_verified_legacy_ax_import();
drop function if exists private.guard_ax_identity_registry_cutover_insert();
drop function if exists private.guard_ax_import_lifecycle_activation();
drop function if exists private.guard_ax_identity_cutover_insert();
drop function if exists private.guard_ax_identity_code_import_insert();
drop function if exists private.guard_ax_identity_binding_import_insert();
drop function if exists private.guard_ax_identity_import_audit_insert();
drop function if exists private.guard_ax_identity_publication_cutover();

drop table private.ax_identity_graph_commit_sessions;
drop table private.ax_identity_registry_cutovers;
drop table private.ax_identity_legacy_import_audits;

alter table private.ax_identity_artifacts
  drop constraint if exists ax_identity_artifacts_owner_check,
  drop constraint if exists ax_identity_artifacts_import_fk,
  drop column legacy_import_id;
drop index if exists private.ax_identity_artifacts_import_key_idx;

alter table private.ax_identity_source_bindings
  drop constraint if exists ax_identity_source_bindings_owner_check,
  drop constraint if exists ax_identity_source_bindings_import_fk,
  drop constraint if exists ax_identity_source_bindings_legacy_component_check,
  drop column legacy_import_id,
  drop column source_pgac_code,
  drop column source_pgic_code,
  drop column legacy_component,
  add column identity_evidence jsonb not null default '{}'::jsonb,
  add column evidence_checksum text,
  add column supersedes_binding_id uuid
    references private.ax_identity_source_bindings(id) on delete restrict,
  add constraint ax_identity_source_bindings_evidence_check check (
    jsonb_typeof(identity_evidence) = 'object'
    and (evidence_checksum is null or evidence_checksum ~ '^[0-9a-f]{64}$')
  );

alter table private.ax_identities
  drop constraint if exists ax_identities_import_fk,
  drop column created_by_import_id;
alter table private.ax_identity_codes
  drop constraint if exists ax_identity_codes_import_fk,
  drop column created_by_import_id;

drop table private.ax_identity_legacy_imports;

-- A source binding may point to PGAC when the source classification permits a
-- country-independent identity. Active and replacement reservations are unique
-- independently so a reviewed replacement can coexist until atomic publish.
drop index if exists private.ax_identity_source_bindings_current_key_idx;
create unique index ax_identity_source_bindings_active_key_idx
  on private.ax_identity_source_bindings(source_profile_key, stable_row_key)
  where binding_state = 'active';
create unique index ax_identity_source_bindings_reserved_key_idx
  on private.ax_identity_source_bindings(source_profile_key, stable_row_key)
  where binding_state = 'reserved';
create unique index ax_identity_source_bindings_replacement_idx
  on private.ax_identity_source_bindings(supersedes_binding_id)
  where supersedes_binding_id is not null and binding_state in ('reserved', 'active');

alter table private.ax_identity_run_rows
  drop constraint if exists ax_identity_run_rows_assignment_check,
  drop constraint if exists ax_identity_run_rows_status_check,
  add constraint ax_identity_run_rows_status_check check (
    assignment_status in ('reused', 'reserved', 'pgac-only', 'review-required', 'conflict', 'unassignable')
  ),
  add constraint ax_identity_run_rows_assignment_check check (
    (assignment_status in ('reused', 'reserved', 'pgac-only')
      and binding_id is not null and pgac_code is not null)
    or (assignment_status in ('review-required', 'conflict', 'unassignable')
      and binding_id is null)
  );

alter table private.ax_identity_runs
  drop constraint if exists ax_identity_runs_counts_check,
  add constraint ax_identity_runs_counts_check check (
    input_row_count >= 0 and (output_row_count is null or output_row_count >= 0)
    and reused_count >= 0 and retained_count = 0 and reserved_count >= 0
    and conflict_count >= 0 and unassignable_count >= 0
    and warning_count >= 0 and error_count >= 0
  );

create table private.ax_identity_rop3_evidence (
  rop3 text primary key,
  pgac_identity_id uuid not null unique
    references private.ax_identities(id) on delete restrict,
  identity_run_id uuid not null
    references private.ax_identity_runs(id) on delete restrict,
  resource_version_id uuid not null,
  resource_checksum text not null,
  evidence_state text not null default 'reserved',
  reserved_until timestamptz,
  activated_revision_id uuid
    references private.ax_registry_revisions(id) on delete restrict,
  activated_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ax_identity_rop3_evidence_code_check check (rop3 ~ '^\d{6}$'),
  constraint ax_identity_rop3_evidence_checksum_check
    check (resource_checksum ~ '^[0-9a-f]{64}$'),
  constraint ax_identity_rop3_evidence_state_check
    check (evidence_state in ('reserved', 'active', 'cancelled', 'superseded')),
  constraint ax_identity_rop3_evidence_reservation_check
    check (evidence_state <> 'reserved' or reserved_until is not null)
);

create table private.ax_identity_change_decisions (
  id uuid primary key default gen_random_uuid(),
  identity_run_id uuid not null
    references private.ax_identity_runs(id) on delete restrict,
  source_row_index integer not null,
  source_profile_key text not null,
  stable_row_key text not null,
  current_binding_id uuid not null
    references private.ax_identity_source_bindings(id) on delete restrict,
  current_evidence jsonb not null,
  proposed_evidence jsonb not null,
  allowed_actions text[] not null,
  selected_action text,
  selected_by_owner_id text,
  selected_by_email text,
  selected_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ax_identity_change_decisions_row_check check (source_row_index >= 0),
  constraint ax_identity_change_decisions_profile_check
    check (btrim(source_profile_key) <> '' and btrim(stable_row_key) <> ''),
  constraint ax_identity_change_decisions_evidence_check check (
    jsonb_typeof(current_evidence) = 'object'
    and jsonb_typeof(proposed_evidence) = 'object'
  ),
  constraint ax_identity_change_decisions_actions_check check (
    cardinality(allowed_actions) > 0
    and allowed_actions <@ array['rebind', 'new-identity', 'canonical-supersession']::text[]
    and (selected_action is null or selected_action = any(allowed_actions))
  ),
  constraint ax_identity_change_decisions_review_check check (
    (selected_action is null and selected_by_owner_id is null and selected_at is null)
    or (selected_action is not null and btrim(selected_by_owner_id) <> '' and selected_at is not null)
  ),
  unique (identity_run_id, source_row_index)
);

create table private.ax_identity_authority_activation_attempts (
  id uuid primary key default gen_random_uuid(),
  namespace text not null
    references private.ax_identity_counters(namespace) on delete restrict,
  environment text not null,
  state_fingerprint text not null,
  empty_graph_checksum text not null,
  rules_checksum text not null,
  formatter_checksum text not null,
  token_hash text not null,
  actor_owner_id text not null,
  actor_email text,
  reason text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ax_identity_authority_attempt_environment_check
    check (environment ~ '^[a-z][a-z0-9-]{0,31}$'),
  constraint ax_identity_authority_attempt_checksums_check check (
    state_fingerprint ~ '^[0-9a-f]{64}$'
    and empty_graph_checksum ~ '^[0-9a-f]{64}$'
    and rules_checksum ~ '^[0-9a-f]{64}$'
    and formatter_checksum ~ '^[0-9a-f]{64}$'
    and token_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint ax_identity_authority_attempt_actor_check
    check (btrim(actor_owner_id) <> '' and btrim(reason) <> ''),
  constraint ax_identity_authority_attempt_expiry_check check (expires_at > created_at)
);

create table private.ax_identity_authorities (
  namespace text primary key
    references private.ax_identity_counters(namespace) on delete restrict,
  environment text not null,
  registry_revision_id uuid not null unique
    references private.ax_registry_revisions(id) on delete restrict,
  activation_attempt_id uuid not null unique
    references private.ax_identity_authority_activation_attempts(id) on delete restrict,
  state_fingerprint text not null,
  empty_graph_checksum text not null,
  rules_checksum text not null,
  formatter_checksum text not null,
  actor_owner_id text not null,
  actor_email text,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint ax_identity_authorities_checksums_check check (
    state_fingerprint ~ '^[0-9a-f]{64}$'
    and empty_graph_checksum ~ '^[0-9a-f]{64}$'
    and rules_checksum ~ '^[0-9a-f]{64}$'
    and formatter_checksum ~ '^[0-9a-f]{64}$'
  ),
  constraint ax_identity_authorities_actor_check
    check (btrim(actor_owner_id) <> '' and btrim(reason) <> '')
);

create index ax_identity_change_decisions_run_idx
  on private.ax_identity_change_decisions(identity_run_id, source_row_index);
create index ax_identity_authority_attempts_created_idx
  on private.ax_identity_authority_activation_attempts(created_at desc, id);

create or replace function private.ax_identity_graph_checksum()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(
    private.ax_identity_canonical_jsonb(jsonb_build_object(
      'identities', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'kind', identity_kind, 'parent', parent_identity_id,
        'iso3', normalized_iso3, 'rop3', rop3_component,
        'allocated', allocated_value, 'state', lifecycle_state,
        'supersededBy', superseded_by_identity_id
      ) order by id) from private.ax_identities
        where lifecycle_state in ('active', 'superseded')), '[]'::jsonb),
      'codes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'identity', identity_id, 'code', code, 'kind', code_kind,
        'state', lifecycle_state, 'supersededBy', superseded_by_code_id
      ) order by code, id) from private.ax_identity_codes
        where lifecycle_state in ('active', 'superseded')), '[]'::jsonb),
      'bindings', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'source', source_profile_key, 'key', stable_row_key,
        'identity', identity_id, 'state', binding_state,
        'evidence', identity_evidence, 'supersededBy', superseded_by_binding_id
      ) order by source_profile_key, stable_row_key, id)
        from private.ax_identity_source_bindings
        where binding_state in ('active', 'superseded')), '[]'::jsonb),
      'rop3Evidence', coalesce((select jsonb_agg(jsonb_build_object(
        'rop3', rop3, 'identity', pgac_identity_id, 'state', evidence_state,
        'resourceVersion', resource_version_id, 'resourceChecksum', resource_checksum
      ) order by rop3) from private.ax_identity_rop3_evidence
        where evidence_state in ('active', 'superseded')), '[]'::jsonb)
    )), 'sha256'), 'hex')
$$;

create or replace function private.ax_identity_registry_state_fingerprint()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(
    private.ax_identity_canonical_jsonb(jsonb_build_object(
      'authorityCount', (select count(*) from private.ax_identity_authorities),
      'identityCount', (select count(*) from private.ax_identities),
      'codeCount', (select count(*) from private.ax_identity_codes),
      'bindingCount', (select count(*) from private.ax_identity_source_bindings),
      'rop3EvidenceCount', (select count(*) from private.ax_identity_rop3_evidence),
      'revisionCount', (select count(*) from private.ax_registry_revisions),
      'counter', (select jsonb_build_object(
        'namespace', namespace, 'nextValue', next_value,
        'minimumValue', minimum_value, 'maximumValue', maximum_value
      ) from private.ax_identity_counters where namespace = 'people-groups')
    )), 'sha256'), 'hex')
$$;

create or replace function private.assert_ax_identity_authority_empty()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.ax_identity_authorities)
    or exists (select 1 from private.ax_identities)
    or exists (select 1 from private.ax_identity_codes)
    or exists (select 1 from private.ax_identity_source_bindings)
    or exists (select 1 from private.ax_identity_rop3_evidence)
    or exists (select 1 from private.ax_registry_revisions)
    or coalesce((select next_value from private.ax_identity_counters
      where namespace = 'people-groups'), 0) <> 1
  then
    raise exception 'AX identity authority is not in the required empty state.'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function private.begin_ax_identity_authority_activation(
  p_environment text,
  p_rules_checksum text,
  p_formatter_checksum text,
  p_actor_owner_id text,
  p_actor_email text,
  p_reason text
)
returns table (
  activation_attempt_id uuid,
  activation_token text,
  state_fingerprint text,
  empty_graph_checksum text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_id uuid;
  raw_token text;
  fingerprint text;
  graph_checksum text;
  expiry timestamptz := now() + interval '30 minutes';
begin
  if p_environment !~ '^[a-z][a-z0-9-]{0,31}$'
    or p_rules_checksum !~ '^[0-9a-f]{64}$'
    or p_formatter_checksum !~ '^[0-9a-f]{64}$'
    or p_actor_owner_id is null or btrim(p_actor_owner_id) = ''
    or p_reason is null or btrim(p_reason) = ''
  then
    raise exception 'AX authority activation inputs are invalid.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ax-identity-authority', 23));
  perform private.assert_ax_identity_authority_empty();
  fingerprint := private.ax_identity_registry_state_fingerprint();
  graph_checksum := private.ax_identity_graph_checksum();
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into private.ax_identity_authority_activation_attempts (
    namespace, environment, state_fingerprint, empty_graph_checksum,
    rules_checksum, formatter_checksum, token_hash, actor_owner_id,
    actor_email, reason, expires_at
  ) values (
    'people-groups', p_environment, fingerprint, graph_checksum,
    p_rules_checksum, p_formatter_checksum,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    p_actor_owner_id, p_actor_email, p_reason, expiry
  ) returning id into attempt_id;

  return query select attempt_id, raw_token, fingerprint, graph_checksum, expiry;
end;
$$;

create or replace function private.commit_ax_identity_authority_activation(
  p_activation_attempt_id uuid,
  p_activation_token text,
  p_expected_state_fingerprint text,
  p_current_rules_checksum text,
  p_current_formatter_checksum text
)
returns table (authority_namespace text, revision_id uuid, revision_number bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt private.ax_identity_authority_activation_attempts%rowtype;
  current_fingerprint text;
  new_revision_id uuid;
  new_revision_number bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('ax-identity-authority', 23));
  select * into attempt
  from private.ax_identity_authority_activation_attempts
  where id = p_activation_attempt_id
  for update;

  if not found or attempt.consumed_at is not null or attempt.expires_at <= now()
    or attempt.token_hash <> encode(extensions.digest(p_activation_token, 'sha256'), 'hex')
    or attempt.state_fingerprint <> p_expected_state_fingerprint
    or attempt.rules_checksum <> p_current_rules_checksum
    or attempt.formatter_checksum <> p_current_formatter_checksum
  then
    raise exception 'AX authority activation token is invalid, expired, or already used.'
      using errcode = '28000';
  end if;

  perform private.assert_ax_identity_authority_empty();
  current_fingerprint := private.ax_identity_registry_state_fingerprint();
  if current_fingerprint <> attempt.state_fingerprint then
    raise exception 'AX authority state changed after dry run.' using errcode = '40001';
  end if;

  perform pg_catalog.setval(
    'private.ax_registry_revisions_revision_number_seq'::regclass, 1, false
  );
  insert into private.ax_registry_revisions as created_revision (
    previous_revision_id, content_checksum, binding_count,
    actor_owner_id, actor_email, reason
  ) values (
    null, attempt.empty_graph_checksum, 0,
    attempt.actor_owner_id, attempt.actor_email, attempt.reason
  ) returning created_revision.id, created_revision.revision_number
    into new_revision_id, new_revision_number;

  if new_revision_number <> 1 then
    raise exception 'Fresh AX authority must begin at registry revision 1.'
      using errcode = '23514';
  end if;

  insert into private.ax_identity_authorities (
    namespace, environment, registry_revision_id, activation_attempt_id,
    state_fingerprint, empty_graph_checksum, rules_checksum,
    formatter_checksum, actor_owner_id, actor_email, reason
  ) values (
    attempt.namespace, attempt.environment, new_revision_id, attempt.id,
    attempt.state_fingerprint, attempt.empty_graph_checksum,
    attempt.rules_checksum, attempt.formatter_checksum,
    attempt.actor_owner_id, attempt.actor_email, attempt.reason
  );
  update private.ax_identity_authority_activation_attempts
  set consumed_at = now() where id = attempt.id;

  return query select attempt.namespace, new_revision_id, new_revision_number;
end;
$$;

create or replace function private.guard_ax_authority_required()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from private.ax_identity_authorities
    where namespace = coalesce(new.namespace, 'people-groups')
  ) then
    raise exception 'Initialized AX Online identity authority is required.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_ax_identity_publication_authority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.producer_kind = 'identity' and not exists (
    select 1 from private.ax_identity_authorities where namespace = 'people-groups'
  ) then
    raise exception 'Initialized AX Online identity authority is required for identity publication.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop function if exists private.allocate_ax_identity_value(
  text, text, text, uuid, text, text, text, timestamptz
);
create or replace function private.allocate_ax_identity_value(
  p_namespace text,
  p_source_profile_key text,
  p_stable_row_key text,
  p_identity_run_id uuid,
  p_rop1 text,
  p_source_initials text,
  p_iso3 text,
  p_reserved_until timestamptz,
  p_identity_evidence jsonb,
  p_evidence_checksum text,
  p_supersedes_binding_id uuid default null
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
  next_number integer;
  maximum_number integer;
  parent_id uuid;
  child_id uuid;
  binding_identity_id uuid;
  new_binding_id uuid;
  existing_binding_id uuid;
  existing_identity_id uuid;
  existing_allocated_value integer;
  existing_pgac_code text;
  existing_pgic_code text;
  existing_evidence_checksum text;
  six_digit text;
  new_pgac text;
  new_pgic text;
begin
  if p_source_profile_key is null or btrim(p_source_profile_key) = ''
    or p_stable_row_key is null or btrim(p_stable_row_key) = ''
    or p_source_initials !~ '^[a-z0-9]{1,8}$'
    or (p_iso3 is not null and p_iso3 !~ '^[A-Z]{3}$')
    or (p_rop1 is not null and p_rop1 <> '' and p_rop1 !~ '^[A-Z][0-9]{3}$')
    or p_reserved_until is null or p_reserved_until <= now()
    or jsonb_typeof(p_identity_evidence) <> 'object'
    or p_evidence_checksum !~ '^[0-9a-f]{64}$'
  then
    raise exception 'AX identity allocation inputs are invalid.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ax-identity-allocation', 7));

  if p_supersedes_binding_id is null then
    select binding.id, binding.identity_id, pgac_identity.allocated_value,
      pgac_code.code, pgic_code.code, binding.evidence_checksum
    into existing_binding_id, existing_identity_id, existing_allocated_value,
      existing_pgac_code, existing_pgic_code, existing_evidence_checksum
    from private.ax_identity_source_bindings as binding
    join private.ax_identities as assigned_identity
      on assigned_identity.id = binding.identity_id
    join private.ax_identities as pgac_identity
      on pgac_identity.id = coalesce(
        assigned_identity.parent_identity_id, assigned_identity.id
      )
    join private.ax_identity_codes as pgac_code
      on pgac_code.identity_id = pgac_identity.id
     and pgac_code.code_kind = 'canonical'
     and pgac_code.lifecycle_state in ('reserved', 'active')
    left join private.ax_identity_codes as pgic_code
      on pgic_code.identity_id = assigned_identity.id
     and assigned_identity.identity_kind = 'pgic'
     and pgic_code.code_kind = 'canonical'
     and pgic_code.lifecycle_state in ('reserved', 'active')
    where binding.source_profile_key = p_source_profile_key
      and binding.stable_row_key = p_stable_row_key
      and binding.binding_state in ('reserved', 'active')
    order by case binding.binding_state when 'active' then 0 else 1 end,
      binding.created_at, binding.id
    limit 1;

    if existing_binding_id is not null then
      if existing_evidence_checksum is distinct from p_evidence_checksum then
        raise exception 'The current source key already has different identity evidence.'
          using errcode = '23505';
      end if;
      return query select existing_binding_id, existing_identity_id,
        existing_allocated_value, existing_pgac_code, existing_pgic_code, true;
      return;
    end if;
  end if;

  loop
    select counter.next_value, counter.maximum_value
    into next_number, maximum_number
    from private.ax_identity_counters as counter
    where counter.namespace = p_namespace
    for update;

    if next_number is null then
      raise exception 'AX identity namespace does not exist.' using errcode = '22023';
    end if;
    if next_number > maximum_number then
      raise exception 'AX identity namespace is exhausted.' using errcode = '22003';
    end if;

    update private.ax_identity_counters
    set next_value = next_number + 1, updated_at = now()
    where namespace = p_namespace;

    six_digit := lpad(next_number::text, 6, '0');
    select parts.pgac_code, parts.pgic_code into new_pgac, new_pgic
    from private.ax_identity_code_parts(
      p_rop1, p_source_initials, six_digit, p_iso3
    ) as parts;

    exit when not exists (
      select 1 from private.ax_identity_codes
      where code in (new_pgac, new_pgic)
        and lifecycle_state in ('reserved', 'active', 'superseded')
    );
  end loop;

  insert into private.ax_identities (
    namespace, identity_kind, allocated_value, lifecycle_state, created_by_run_id
  ) values (p_namespace, 'pgac', next_number, 'reserved', p_identity_run_id)
  returning id into parent_id;
  insert into private.ax_identity_codes (
    identity_id, code, code_kind, lifecycle_state, created_by_run_id
  ) values (parent_id, new_pgac, 'canonical', 'reserved', p_identity_run_id);

  binding_identity_id := parent_id;
  if p_iso3 is not null then
    insert into private.ax_identities (
      namespace, identity_kind, parent_identity_id, normalized_iso3,
      lifecycle_state, created_by_run_id
    ) values (
      p_namespace, 'pgic', parent_id, p_iso3, 'reserved', p_identity_run_id
    ) returning id into child_id;
    insert into private.ax_identity_codes (
      identity_id, code, code_kind, lifecycle_state, created_by_run_id
    ) values (child_id, new_pgic, 'canonical', 'reserved', p_identity_run_id);
    binding_identity_id := child_id;
  end if;

  insert into private.ax_identity_source_bindings (
    source_profile_key, stable_row_key, identity_id, identity_run_id,
    binding_state, reserved_until, identity_evidence, evidence_checksum,
    supersedes_binding_id
  ) values (
    p_source_profile_key, p_stable_row_key, binding_identity_id,
    p_identity_run_id, 'reserved', p_reserved_until,
    p_identity_evidence, p_evidence_checksum, p_supersedes_binding_id
  ) returning id into new_binding_id;

  return query select new_binding_id, binding_identity_id, next_number,
    new_pgac, new_pgic, false;
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
  update private.ax_identity_rop3_evidence
  set evidence_state = 'cancelled', cancelled_at = now()
  where identity_run_id = p_identity_run_id and evidence_state = 'reserved';
  update private.ax_identity_codes
  set lifecycle_state = 'cancelled'
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'reserved';
  update private.ax_identities
  set lifecycle_state = 'cancelled', cancelled_at = now()
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'reserved';
  return cancelled_count;
end;
$$;

create or replace function private.finalize_ax_identity_publication(
  p_identity_run_id uuid,
  p_dataset_id uuid,
  p_publication_attempt_id uuid,
  p_dataset_created boolean,
  p_actor_owner_id text,
  p_actor_email text,
  p_reason text
)
returns table (revision_id uuid, publication_id uuid, dataset_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.ax_identity_runs%rowtype;
  prior_revision private.ax_registry_revisions%rowtype;
  current_publication_id uuid;
  current_dataset_id uuid;
  selected_revision_id uuid;
  new_publication_id uuid;
  graph_checksum text;
  active_binding_count integer;
  current_row_evidence_checksum text;
  dataset_row_evidence_checksum text;
  updated_count integer;
begin
  if p_identity_run_id is null or p_dataset_id is null
    or p_publication_attempt_id is null or p_dataset_created is null
    or p_actor_owner_id is null or btrim(p_actor_owner_id) = ''
    or p_reason is null or btrim(p_reason) = ''
  then raise exception 'AX identity publication inputs are invalid.' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended('ax-identity-publication', 11));
  if not exists (
    select 1 from private.ax_identity_authorities where namespace = 'people-groups'
  ) then
    raise exception 'Initialized AX Online identity authority is required.' using errcode = '23514';
  end if;

  select * into run_record from private.ax_identity_runs
  where id = p_identity_run_id for update;
  if not found then raise exception 'AX identity candidate does not exist.' using errcode = 'P0002'; end if;
  if run_record.status = 'published' then
    return query select run_record.registry_revision_id, run_record.publication_id, run_record.dataset_id;
    return;
  end if;
  if run_record.status <> 'publishing'
    or run_record.publication_attempt_id is distinct from p_publication_attempt_id
    or run_record.error_count <> 0 or run_record.conflict_count <> 0
    or run_record.unassignable_count <> 0 or run_record.output_checksum is null
    or exists (select 1 from private.ax_identity_change_decisions
      where identity_run_id = p_identity_run_id and selected_action is null)
  then raise exception 'AX identity candidate is not owned by this publication attempt.' using errcode = '23514'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'ax-identity-publication:' || run_record.publication_target_key, 391743
  ));
  select publication.id, publication.dataset_id
  into current_publication_id, current_dataset_id
  from private.pipeline_publications as publication
  where publication.producer_kind = 'identity'
    and publication.publication_target_key = run_record.publication_target_key
  order by publication.created_at desc, publication.id desc limit 1;
  if current_publication_id is distinct from run_record.expected_current_publication_id then
    raise exception 'The AX identity publication target changed after this candidate was built.' using errcode = '40001';
  end if;
  if (run_record.expected_current_publication_id is null and not p_dataset_created)
    or (run_record.expected_current_publication_id is not null and p_dataset_created)
    or (run_record.expected_current_publication_id is not null
      and current_dataset_id is distinct from p_dataset_id)
  then raise exception 'The AX identity dataset does not match the pinned publication target.' using errcode = '23514'; end if;

  select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_object(
    'sourceRowIndex', source_row_index, 'data', enriched_row
  ) order by source_row_index)::text, '[]'), 'sha256'), 'hex')
  into current_row_evidence_checksum
  from private.ax_identity_run_rows where identity_run_id = p_identity_run_id;
  select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_object(
    'sourceRowIndex', row_index, 'data', data
  ) order by row_index)::text, '[]'), 'sha256'), 'hex')
  into dataset_row_evidence_checksum
  from public.dataset_rows as dataset_row
  where dataset_row.dataset_id = p_dataset_id;
  if run_record.row_evidence_checksum is null
    or current_row_evidence_checksum is distinct from run_record.row_evidence_checksum
    or dataset_row_evidence_checksum is distinct from run_record.row_evidence_checksum
  then raise exception 'AX identity dataset rows do not match the reviewed candidate evidence.' using errcode = '23514'; end if;

  -- Atomically replace bindings approved by a current-evidence decision.
  update private.ax_identity_source_bindings as old_binding
  set binding_state = 'superseded',
    superseded_by_binding_id = replacement.id
  from private.ax_identity_source_bindings as replacement
  where replacement.identity_run_id = p_identity_run_id
    and replacement.binding_state = 'reserved'
    and replacement.supersedes_binding_id = old_binding.id
    and old_binding.binding_state = 'active';

  update private.ax_identity_source_bindings
  set binding_state = 'active', reserved_until = null, activated_at = now()
  where identity_run_id = p_identity_run_id and binding_state = 'reserved';

  -- A canonical supersession is permitted only when no other active binding
  -- still depends on the old assigned identity. Binding history remains intact.
  if exists (
    select 1
    from private.ax_identity_change_decisions as decision
    join private.ax_identity_source_bindings as replacement
      on replacement.identity_run_id = p_identity_run_id
     and replacement.supersedes_binding_id = decision.current_binding_id
     and replacement.binding_state = 'active'
    join private.ax_identity_source_bindings as old_binding
      on old_binding.id = decision.current_binding_id
    where decision.identity_run_id = p_identity_run_id
      and decision.selected_action = 'canonical-supersession'
      and exists (
        select 1 from private.ax_identity_source_bindings as dependent
        where dependent.identity_id = old_binding.identity_id
          and dependent.binding_state = 'active'
          and dependent.id <> replacement.id
      )
  ) then
    raise exception 'Canonical supersession requires exclusive ownership of the prior assigned identity.'
      using errcode = '23514';
  end if;

  update private.ax_identities as old_identity
  set lifecycle_state = 'superseded',
    superseded_by_identity_id = replacement.identity_id
  from private.ax_identity_change_decisions as decision
  join private.ax_identity_source_bindings as replacement
    on replacement.identity_run_id = p_identity_run_id
   and replacement.supersedes_binding_id = decision.current_binding_id
   and replacement.binding_state = 'active'
  join private.ax_identity_source_bindings as old_binding
    on old_binding.id = decision.current_binding_id
  where decision.identity_run_id = p_identity_run_id
    and decision.selected_action = 'canonical-supersession'
    and old_identity.id = old_binding.identity_id;

  update private.ax_identity_codes as old_code
  set lifecycle_state = 'superseded',
    superseded_by_code_id = new_code.id
  from private.ax_identity_change_decisions as decision
  join private.ax_identity_source_bindings as replacement
    on replacement.identity_run_id = p_identity_run_id
   and replacement.supersedes_binding_id = decision.current_binding_id
   and replacement.binding_state = 'active'
  join private.ax_identity_source_bindings as old_binding
    on old_binding.id = decision.current_binding_id
  join private.ax_identity_codes as new_code
    on new_code.identity_id = replacement.identity_id
   and new_code.code_kind = 'canonical'
   and new_code.lifecycle_state in ('reserved', 'active')
  where decision.identity_run_id = p_identity_run_id
    and decision.selected_action = 'canonical-supersession'
    and old_code.identity_id = old_binding.identity_id
    and old_code.code_kind = 'canonical'
    and old_code.lifecycle_state = 'active';
  update private.ax_identities set lifecycle_state = 'active',
    activated_at = coalesce(activated_at, now())
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'reserved';
  update private.ax_identity_codes set lifecycle_state = 'active'
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'reserved';
  update private.ax_identity_rop3_evidence set evidence_state = 'active',
    reserved_until = null, activated_at = now()
  where identity_run_id = p_identity_run_id and evidence_state = 'reserved';

  select * into prior_revision from private.ax_registry_revisions
  order by revision_number desc limit 1;
  graph_checksum := private.ax_identity_graph_checksum();
  select count(*)::integer into active_binding_count
  from private.ax_identity_source_bindings where binding_state = 'active';
  if prior_revision.id is not null and prior_revision.content_checksum = graph_checksum then
    selected_revision_id := prior_revision.id;
  else
    insert into private.ax_registry_revisions (
      previous_revision_id, content_checksum, binding_count,
      actor_owner_id, actor_email, reason
    ) values (
      prior_revision.id, graph_checksum, active_binding_count,
      p_actor_owner_id, p_actor_email, p_reason
    ) returning id into selected_revision_id;
    insert into private.ax_registry_revision_bindings (revision_id, binding_id)
    select selected_revision_id, id from private.ax_identity_source_bindings
    where binding_state = 'active';
  end if;

  update private.ax_identity_source_bindings
  set activated_revision_id = coalesce(activated_revision_id, selected_revision_id)
  where identity_run_id = p_identity_run_id and binding_state = 'active';
  update private.ax_identities
  set activated_revision_id = coalesce(activated_revision_id, selected_revision_id)
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'active';
  update private.ax_identity_codes
  set activated_revision_id = coalesce(activated_revision_id, selected_revision_id)
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'active';
  update private.ax_identity_rop3_evidence
  set activated_revision_id = coalesce(activated_revision_id, selected_revision_id)
  where identity_run_id = p_identity_run_id and evidence_state = 'active';

  insert into private.pipeline_publications (
    producer_kind, producer_run_id, dataset_id, source_profile_key,
    registry_revision_id, output_checksum, row_count, artifact_manifest,
    actor_owner_id, actor_email, reason, publication_target_key
  ) values (
    'identity', p_identity_run_id, p_dataset_id, run_record.source_profile_key,
    selected_revision_id, run_record.output_checksum, run_record.output_row_count,
    run_record.artifact_manifest, p_actor_owner_id, p_actor_email, p_reason,
    run_record.publication_target_key
  ) returning id into new_publication_id;
  insert into private.pipeline_publication_rows (publication_id, row_index, data)
  select new_publication_id, source_row_index, enriched_row
  from private.ax_identity_run_rows where identity_run_id = p_identity_run_id
  order by source_row_index;
  update private.ax_identity_runs
  set status = 'published', dataset_id = p_dataset_id,
    publication_id = new_publication_id, registry_revision_id = selected_revision_id,
    publication_reason = p_reason, published_by_owner_id = p_actor_owner_id,
    published_at = now(), completed_at = coalesce(completed_at, now()),
    publication_attempt_id = null, publishing_started_at = null,
    publication_blob_path = null
  where id = p_identity_run_id and status = 'publishing'
    and publication_attempt_id = p_publication_attempt_id;
  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'The AX identity publication lease was lost before commit.' using errcode = '40001';
  end if;
  return query select selected_revision_id, new_publication_id, p_dataset_id;
end;
$$;

create or replace function private.guard_ax_rop3_evidence_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    or new.rop3 is distinct from old.rop3
    or new.pgac_identity_id is distinct from old.pgac_identity_id
    or new.identity_run_id is distinct from old.identity_run_id
    or new.resource_version_id is distinct from old.resource_version_id
    or new.resource_checksum is distinct from old.resource_checksum
    or new.created_at is distinct from old.created_at
  then raise exception 'AX ROP3 ownership evidence is immutable.'; end if;
  if old.evidence_state = 'active' and new.evidence_state not in ('active', 'superseded') then
    raise exception 'Active AX ROP3 evidence cannot return to a pre-activation state.';
  end if;
  if old.evidence_state in ('cancelled', 'superseded') and new is distinct from old then
    raise exception 'Final AX ROP3 evidence is immutable.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_ax_identity_change_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    or new.identity_run_id is distinct from old.identity_run_id
    or new.source_row_index is distinct from old.source_row_index
    or new.source_profile_key is distinct from old.source_profile_key
    or new.stable_row_key is distinct from old.stable_row_key
    or new.current_binding_id is distinct from old.current_binding_id
    or new.current_evidence is distinct from old.current_evidence
    or new.proposed_evidence is distinct from old.proposed_evidence
    or new.allowed_actions is distinct from old.allowed_actions
    or new.created_at is distinct from old.created_at
    or old.selected_action is not null
  then raise exception 'Reviewed AX identity decisions are immutable.'; end if;
  return new;
end;
$$;

-- Replace structural guards after removing legacy ownership fields.
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
    or new.created_at is distinct from old.created_at
  then raise exception 'AX identity structural history is immutable.'; end if;
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
    or new.created_at is distinct from old.created_at
  then raise exception 'AX identity code history is immutable.'; end if;
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
    or new.identity_evidence is distinct from old.identity_evidence
    or new.evidence_checksum is distinct from old.evidence_checksum
    or new.supersedes_binding_id is distinct from old.supersedes_binding_id
    or new.created_at is distinct from old.created_at
  then raise exception 'AX source binding history is immutable.'; end if;
  if old.binding_state = 'active' and new.binding_state not in ('active', 'superseded') then
    raise exception 'Active AX bindings cannot return to a pre-activation state.';
  end if;
  if old.binding_state in ('cancelled', 'superseded') and new is distinct from old then
    raise exception 'Final AX binding records are immutable.';
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
    select 1 from private.ax_identity_source_bindings
    where source_profile_key = old.profile_key
      and binding_state in ('reserved', 'active')
  ) and (
    tg_op = 'DELETE'
    or new.profile_key is distinct from old.profile_key
    or new.stable_row_key_column is distinct from old.stable_row_key_column
    or new.tracking_id_column is distinct from old.tracking_id_column
    or new.tracking_id_source is distinct from old.tracking_id_source
  ) then
    raise exception 'A used Tier 2 profile cannot change stable identity fields.';
  end if;
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.guard_tier2_api_connection_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from private.tier2_partner_profiles as profile
    join private.ax_identity_source_bindings as binding
      on binding.source_profile_key = profile.profile_key
     and binding.binding_state in ('reserved', 'active')
    where profile.api_connection_id = old.id
  ) and tg_op = 'DELETE' then
    raise exception 'A connection used by AX identity bindings cannot be deleted.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger ax_identities_require_authority
before insert on private.ax_identities
for each row execute function private.guard_ax_authority_required();
create trigger pipeline_publications_require_identity_authority
before insert on private.pipeline_publications
for each row execute function private.guard_ax_identity_publication_authority();
create trigger tier2_partner_profiles_guard_identity
before update or delete on private.tier2_partner_profiles
for each row execute function private.guard_tier2_partner_profile_identity();
create trigger api_connections_guard_tier2_identity
before update or delete on private.api_connections
for each row execute function private.guard_tier2_api_connection_identity();

create trigger ax_identity_authorities_immutable
before update or delete on private.ax_identity_authorities
for each row execute function private.guard_ax_immutable_history();
create trigger ax_identity_rop3_evidence_lifecycle
before update or delete on private.ax_identity_rop3_evidence
for each row execute function private.guard_ax_rop3_evidence_lifecycle();
create trigger ax_identity_change_decisions_review_once
before update or delete on private.ax_identity_change_decisions
for each row execute function private.guard_ax_identity_change_decision();

alter table private.ax_identity_rop3_evidence enable row level security;
alter table private.ax_identity_change_decisions enable row level security;
alter table private.ax_identity_authority_activation_attempts enable row level security;
alter table private.ax_identity_authorities enable row level security;

revoke all on private.ax_identity_rop3_evidence,
  private.ax_identity_change_decisions,
  private.ax_identity_authority_activation_attempts,
  private.ax_identity_authorities
  from public, anon, authenticated;
grant all on private.ax_identity_rop3_evidence,
  private.ax_identity_change_decisions to service_role;
revoke all on private.ax_identity_authority_activation_attempts,
  private.ax_identity_authorities from service_role;
grant select on private.ax_identity_authority_activation_attempts,
  private.ax_identity_authorities to service_role;

revoke all on function private.ax_identity_graph_checksum(),
  private.ax_identity_registry_state_fingerprint(),
  private.assert_ax_identity_authority_empty(),
  private.begin_ax_identity_authority_activation(text, text, text, text, text, text),
  private.commit_ax_identity_authority_activation(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function private.ax_identity_graph_checksum(),
  private.ax_identity_registry_state_fingerprint()
  to service_role;
grant execute on function private.begin_ax_identity_authority_activation(text, text, text, text, text, text),
  private.commit_ax_identity_authority_activation(uuid, text, text, text, text)
  to service_role;
revoke all on function private.allocate_ax_identity_value(
  text, text, text, uuid, text, text, text, timestamptz, jsonb, text, uuid
), private.finalize_ax_identity_publication(uuid, uuid, uuid, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function private.allocate_ax_identity_value(
  text, text, text, uuid, text, text, text, timestamptz, jsonb, text, uuid
), private.finalize_ax_identity_publication(uuid, uuid, uuid, boolean, text, text, text)
  to service_role;

comment on table private.ax_identity_authorities is
  'Immutable marker that AX Online is the sole fresh people-groups identity authority.';
comment on column private.ax_identity_source_bindings.identity_evidence is
  'Canonical current-source identity evidence only. Historical/source-supplied AX codes are prohibited.';
