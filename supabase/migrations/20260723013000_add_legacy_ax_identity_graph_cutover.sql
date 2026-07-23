alter table private.ax_identity_legacy_imports
  add column import_kind text not null default 'flat-snapshot',
  add column state_fingerprint text,
  add column graph_checksum text,
  add column report_checksum text,
  add column manifest_checksum text,
  add column dry_run_token_hash text,
  add column report jsonb,
  add column dry_run_completed_at timestamptz,
  add constraint ax_identity_legacy_imports_kind_check
    check (import_kind in ('flat-snapshot', 'verified-identity-graph')),
  add constraint ax_identity_legacy_imports_state_fingerprint_check
    check (state_fingerprint is null or state_fingerprint ~ '^[0-9a-f]{64}$'),
  add constraint ax_identity_legacy_imports_graph_checksum_check
    check (graph_checksum is null or graph_checksum ~ '^[0-9a-f]{64}$'),
  add constraint ax_identity_legacy_imports_report_checksum_check
    check (report_checksum is null or report_checksum ~ '^[0-9a-f]{64}$'),
  add constraint ax_identity_legacy_imports_manifest_checksum_check
    check (manifest_checksum is null or manifest_checksum ~ '^[0-9a-f]{64}$'),
  add constraint ax_identity_legacy_imports_token_hash_check
    check (dry_run_token_hash is null or dry_run_token_hash ~ '^[0-9a-f]{64}$'),
  add constraint ax_identity_legacy_imports_report_check
    check (report is null or jsonb_typeof(report) = 'object'),
  add constraint ax_identity_legacy_imports_verified_graph_check check (
    import_kind <> 'verified-identity-graph'
    or (
      state_fingerprint is not null
      and graph_checksum is not null
      and report_checksum is not null
      and manifest_checksum is not null
      and dry_run_token_hash is not null
      and report is not null
      and dry_run_completed_at is not null
    )
  );

alter table private.ax_identity_artifacts
  add column artifact_key text;

update private.ax_identity_artifacts
set artifact_key = artifact_kind
where artifact_key is null;

alter table private.ax_identity_artifacts
  alter column artifact_key set not null,
  add constraint ax_identity_artifacts_key_check
    check (artifact_key ~ '^[a-z][a-z0-9-]{0,63}$');

create unique index ax_identity_artifacts_import_key_idx
  on private.ax_identity_artifacts(legacy_import_id, artifact_key)
  where legacy_import_id is not null;

alter table private.ax_identity_source_bindings
  add column legacy_component text,
  add constraint ax_identity_source_bindings_legacy_component_check
    check (legacy_component is null or legacy_component ~ '^(dataset|spreadsheet):\S+$');

create table private.ax_identity_legacy_import_audits (
  id bigint generated always as identity primary key,
  legacy_import_id uuid not null
    references private.ax_identity_legacy_imports(id) on delete restrict,
  audit_kind text not null,
  source_file_key text not null,
  stable_row_key_hash text not null,
  details jsonb not null,
  created_at timestamptz not null default now(),
  constraint ax_identity_legacy_import_audits_kind_check check (
    audit_kind in (
      'short-primary-normalized',
      'cross-ledger-mismatch',
      'alias-conflict-quarantined'
    )
  ),
  constraint ax_identity_legacy_import_audits_source_check check (
    source_file_key in (
      'sharedUuidLedger', 'tier1UuidLedger', 'tier2UuidLedger',
      'sharedRop3Ledger', 'tier2Rop3Ledger'
    )
  ),
  constraint ax_identity_legacy_import_audits_key_hash_check
    check (stable_row_key_hash ~ '^[0-9a-f]{64}$'),
  constraint ax_identity_legacy_import_audits_details_check
    check (jsonb_typeof(details) = 'object')
);

create index ax_identity_legacy_import_audits_import_idx
  on private.ax_identity_legacy_import_audits(legacy_import_id, audit_kind, id);

create table private.ax_identity_registry_cutovers (
  namespace text primary key
    references private.ax_identity_counters(namespace) on delete restrict,
  legacy_import_id uuid not null unique
    references private.ax_identity_legacy_imports(id) on delete restrict,
  registry_revision_id uuid not null unique
    references private.ax_registry_revisions(id) on delete restrict,
  input_fingerprint text not null unique,
  graph_checksum text not null,
  report_checksum text not null,
  actor_owner_id text not null,
  actor_email text,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint ax_identity_registry_cutovers_fingerprint_check
    check (input_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint ax_identity_registry_cutovers_graph_checksum_check
    check (graph_checksum ~ '^[0-9a-f]{64}$'),
  constraint ax_identity_registry_cutovers_report_checksum_check
    check (report_checksum ~ '^[0-9a-f]{64}$'),
  constraint ax_identity_registry_cutovers_actor_check
    check (btrim(actor_owner_id) <> ''),
  constraint ax_identity_registry_cutovers_reason_check
    check (btrim(reason) <> '')
);

create table private.ax_identity_graph_commit_sessions (
  backend_pid integer not null,
  transaction_id bigint not null,
  legacy_import_id uuid not null
    references private.ax_identity_legacy_imports(id) on delete restrict,
  input_fingerprint text not null,
  token_hash text not null,
  state_fingerprint text not null,
  created_at timestamptz not null default now(),
  primary key (backend_pid, transaction_id),
  constraint ax_identity_graph_commit_sessions_fingerprint_check
    check (input_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint ax_identity_graph_commit_sessions_token_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint ax_identity_graph_commit_sessions_state_check
    check (state_fingerprint ~ '^[0-9a-f]{64}$')
);

insert into storage.buckets (id, name, public)
values ('identity-registry-evidence', 'identity-registry-evidence', false)
on conflict (id) do update
set public = false;

create or replace function private.ax_identity_canonical_jsonb(p_value jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  result text;
begin
  if jsonb_typeof(p_value) = 'object' then
    select '{' || coalesce(string_agg(
      to_jsonb(entry.key)::text || ':' || private.ax_identity_canonical_jsonb(entry.value),
      ',' order by entry.key collate "C"
    ), '') || '}' into result
    from jsonb_each(p_value) as entry;
    return result;
  elsif jsonb_typeof(p_value) = 'array' then
    select '[' || coalesce(string_agg(
      private.ax_identity_canonical_jsonb(entry.value), ',' order by entry.ordinality
    ), '') || ']' into result
    from jsonb_array_elements(p_value) with ordinality as entry(value, ordinality);
    return result;
  end if;
  return p_value::text;
end;
$$;

create or replace function private.has_legacy_ax_graph_commit_session(p_legacy_import_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.ax_identity_graph_commit_sessions
    where backend_pid = pg_backend_pid()
      and transaction_id = txid_current()
      and legacy_import_id = p_legacy_import_id
  )
$$;

create or replace function private.guard_tier2_partner_profile_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  profile_used boolean;
begin
  profile_used := (
    exists (select 1 from private.tier2_forming_runs where profile_id = old.id)
    or exists (
      select 1
      from private.ax_identity_source_bindings
      where legacy_import_id is not null
        and source_profile_key = old.profile_key
    )
  );

  if tg_op = 'DELETE' then
    if profile_used then
      raise exception 'A used Tier 2 profile cannot be deleted.';
    end if;
    return old;
  end if;

  if profile_used and (
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

create or replace function private.serialize_tier2_partner_profile_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('ax-identity-publication', 11));
  return null;
end;
$$;

drop trigger if exists tier2_partner_profiles_guard_identity
  on private.tier2_partner_profiles;
create trigger tier2_partner_profiles_guard_identity
before update or delete on private.tier2_partner_profiles
for each row execute function private.guard_tier2_partner_profile_identity();

drop trigger if exists tier2_partner_profiles_serialize_identity
  on private.tier2_partner_profiles;
create trigger tier2_partner_profiles_serialize_identity
before update or delete on private.tier2_partner_profiles
for each statement execute function private.serialize_tier2_partner_profile_identity();

create or replace function private.guard_tier2_api_connection_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  connection_used boolean;
begin
  connection_used := exists (
    select 1
    from private.tier2_partner_profiles as profile
    join private.ax_identity_source_bindings as binding
      on binding.source_profile_key = profile.profile_key
     and binding.legacy_import_id is not null
    where profile.api_connection_id = old.id
  );

  if tg_op = 'DELETE' then
    if connection_used then
      raise exception 'A used Tier 2 source connection cannot be deleted.';
    end if;
    return old;
  end if;

  if connection_used and (
    new.provider is distinct from old.provider
    or new.provider_config ->> 'spreadsheetId'
      is distinct from old.provider_config ->> 'spreadsheetId'
    or new.provider_config ->> 'sheetId'
      is distinct from old.provider_config ->> 'sheetId'
    or new.archived_at is distinct from old.archived_at
  ) then
    raise exception 'A used Tier 2 source connection cannot change source identity or be disconnected.';
  end if;
  return new;
end;
$$;

create or replace function private.serialize_tier2_api_connection_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('ax-identity-publication', 11));
  return null;
end;
$$;

drop trigger if exists api_connections_guard_tier2_identity
  on private.api_connections;
create trigger api_connections_guard_tier2_identity
before update or delete on private.api_connections
for each row execute function private.guard_tier2_api_connection_identity();

drop trigger if exists api_connections_serialize_tier2_identity
  on private.api_connections;
create trigger api_connections_serialize_tier2_identity
before update or delete on private.api_connections
for each statement execute function private.serialize_tier2_api_connection_identity();

create or replace function private.ax_identity_registry_state_fingerprint()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(
    jsonb_build_object(
      'identities', jsonb_build_object(
        'count', (select count(*) from private.ax_identities),
        'checksum', (
          select encode(extensions.digest(coalesce(string_agg(
            identity_kind || ':' || id::text || ':' ||
              coalesce(parent_identity_id::text, '') || ':' ||
              coalesce(allocated_value::text, '') || ':' ||
              coalesce(rop3_component, '') || ':' || lifecycle_state,
            '|' order by id
          ), ''), 'sha256'), 'hex')
          from private.ax_identities
        )
      ),
      'codes', jsonb_build_object(
        'count', (select count(*) from private.ax_identity_codes),
        'checksum', (
          select encode(extensions.digest(coalesce(string_agg(
            code || ':' || identity_id::text || ':' || code_kind || ':' || lifecycle_state,
            '|' order by code
          ), ''), 'sha256'), 'hex')
          from private.ax_identity_codes
        )
      ),
      'bindings', jsonb_build_object(
        'count', (select count(*) from private.ax_identity_source_bindings),
        'checksum', (
          select encode(extensions.digest(coalesce(string_agg(
            source_profile_key || ':' || stable_row_key || ':' ||
              identity_id::text || ':' || binding_state,
            '|' order by source_profile_key, stable_row_key, id
          ), ''), 'sha256'), 'hex')
          from private.ax_identity_source_bindings
        )
      ),
      'revisions', jsonb_build_object(
        'count', (select count(*) from private.ax_registry_revisions),
        'latest', (
          select coalesce(jsonb_build_object(
            'id', id,
            'revisionNumber', revision_number,
            'contentChecksum', content_checksum,
            'bindingCount', binding_count
          ), '{}'::jsonb)
          from private.ax_registry_revisions
          order by revision_number desc
          limit 1
        )
      ),
      'counter', (
        select jsonb_build_object(
          'namespace', namespace,
          'nextValue', next_value,
          'minimumValue', minimum_value,
          'maximumValue', maximum_value
        )
        from private.ax_identity_counters
        where namespace = 'people-groups'
      ),
      'cutover', (
        select coalesce(jsonb_build_object(
          'importId', legacy_import_id,
          'revisionId', registry_revision_id,
          'inputFingerprint', input_fingerprint,
          'graphChecksum', graph_checksum
        ), '{}'::jsonb)
        from private.ax_identity_registry_cutovers
        where namespace = 'people-groups'
      ),
      'tier2Profiles', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', profile.id,
          'profileKey', profile.profile_key,
          'partnerKey', profile.partner_key,
          'spreadsheetId', profile.spreadsheet_id,
          'sheetId', profile.sheet_id,
          'stableRowKeyColumn', profile.stable_row_key_column,
          'trackingIdColumn', profile.tracking_id_column,
          'trackingIdSource', profile.tracking_id_source,
          'contractVersion', profile.contract_version,
          'contractChecksum', profile.contract_checksum,
          'active', profile.active,
          'updatedAt', profile.updated_at,
          'apiConnection', jsonb_build_object(
            'id', connection.id,
            'provider', connection.provider,
            'spreadsheetId', connection.provider_config ->> 'spreadsheetId',
            'sheetId', connection.provider_config ->> 'sheetId',
            'archivedAt', connection.archived_at,
            'updatedAt', connection.updated_at
          )
        ) order by profile.profile_key collate "C")
        from private.tier2_partner_profiles as profile
        left join private.api_connections as connection
          on connection.id = profile.api_connection_id
      ), '[]'::jsonb)
    )::text,
    'sha256'
  ), 'hex')
$$;

create or replace function private.begin_legacy_ax_identity_graph_commit(
  p_legacy_import_id uuid,
  p_input_fingerprint text,
  p_dry_run_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record private.ax_identity_legacy_imports%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('ax-identity-publication', 11));

  select * into import_record
  from private.ax_identity_legacy_imports
  where id = p_legacy_import_id
  for update;

  if import_record.id is null
    or import_record.import_kind <> 'verified-identity-graph'
    or import_record.input_fingerprint is distinct from p_input_fingerprint
    or import_record.dry_run_token_hash is distinct from encode(
      extensions.digest(p_dry_run_token, 'sha256'), 'hex'
    )
  then
    raise exception 'The verified legacy AX dry-run fingerprint or token does not match.'
      using errcode = '22023';
  end if;

  if import_record.status = 'committed' and exists (
    select 1 from private.ax_identity_registry_cutovers
    where namespace = 'people-groups'
      and legacy_import_id = import_record.id
      and input_fingerprint = import_record.input_fingerprint
  ) then
    return false;
  end if;

  if import_record.status <> 'dry-run'
    or coalesce((import_record.report ->> 'blocking')::boolean, true)
  then
    raise exception 'The verified legacy AX dry-run is blocked and cannot be committed.'
      using errcode = '23514';
  end if;

  perform profile.id
  from jsonb_array_elements(import_record.report -> 'tier2Components') as component
  join private.tier2_partner_profiles as profile
    on profile.profile_key = component ->> 'profileKey'
  join private.api_connections as connection
    on connection.id = profile.api_connection_id
  where coalesce((component ->> 'mapped')::boolean, false)
  for update of profile, connection;

  if import_record.state_fingerprint is distinct from private.ax_identity_registry_state_fingerprint()
  then
    raise exception 'The AX identity registry changed after the verified dry-run.'
      using errcode = '40001';
  end if;

  if exists (select 1 from private.ax_identity_registry_cutovers)
    or exists (select 1 from private.ax_identities)
    or exists (select 1 from private.ax_identity_codes)
    or exists (select 1 from private.ax_identity_source_bindings)
    or exists (select 1 from private.ax_registry_revisions)
  then
    raise exception 'The verified legacy AX graph requires an empty pre-cutover registry.'
      using errcode = '23514';
  end if;

  delete from private.ax_identity_graph_commit_sessions
  where backend_pid = pg_backend_pid();

  insert into private.ax_identity_graph_commit_sessions (
    backend_pid, transaction_id, legacy_import_id,
    input_fingerprint, token_hash, state_fingerprint
  ) values (
    pg_backend_pid(), txid_current(), import_record.id,
    import_record.input_fingerprint, import_record.dry_run_token_hash,
    import_record.state_fingerprint
  );

  return true;
end;
$$;

create or replace function private.finalize_legacy_ax_identity_graph_import(
  p_legacy_import_id uuid,
  p_input_fingerprint text,
  p_dry_run_token text,
  p_actor_owner_id text,
  p_actor_email text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_record private.ax_identity_legacy_imports%rowtype;
  expected_bindings integer;
  expected_pgac integer;
  expected_pgic integer;
  expected_identities integer;
  expected_aliases integer;
  expected_audits integer;
  expected_audit_checksum text;
  counter_floor integer;
  actual_bindings integer;
  actual_pgac integer;
  actual_pgic integer;
  actual_identities integer;
  actual_aliases integer;
  actual_canonical_codes integer;
  actual_codes integer;
  actual_audits integer;
  computed_graph_checksum text;
  computed_audit_checksum text;
  binding_checksum text;
  new_revision_id uuid;
begin
  if p_actor_owner_id is null or btrim(p_actor_owner_id) = ''
    or p_reason is null or btrim(p_reason) = ''
  then
    raise exception 'Verified legacy AX cutover actor and reason are required.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ax-identity-publication', 11));

  select * into import_record
  from private.ax_identity_legacy_imports
  where id = p_legacy_import_id
  for update;

  if import_record.id is null
    or import_record.import_kind <> 'verified-identity-graph'
    or import_record.status <> 'dry-run'
    or coalesce((import_record.report ->> 'blocking')::boolean, true)
    or import_record.input_fingerprint is distinct from p_input_fingerprint
    or import_record.dry_run_token_hash is distinct from encode(
      extensions.digest(p_dry_run_token, 'sha256'), 'hex'
    )
  then
    raise exception 'A non-blocking verified legacy AX dry-run is required.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from private.ax_identity_graph_commit_sessions
    where backend_pid = pg_backend_pid()
      and transaction_id = txid_current()
      and legacy_import_id = p_legacy_import_id
      and input_fingerprint = p_input_fingerprint
      and token_hash = import_record.dry_run_token_hash
      and state_fingerprint = import_record.state_fingerprint
  ) then
    raise exception 'The verified legacy AX graph must begin and finalize in one authorized transaction.'
      using errcode = '55000';
  end if;

  perform profile.id
  from jsonb_array_elements(import_record.report -> 'tier2Components') as component
  join private.tier2_partner_profiles as profile
    on profile.profile_key = component ->> 'profileKey'
  join private.api_connections as connection
    on connection.id = profile.api_connection_id
  where coalesce((component ->> 'mapped')::boolean, false)
  for update of profile, connection;

  expected_bindings := (import_record.report #>> '{graph,bindings}')::integer;
  expected_pgac := (import_record.report #>> '{graph,pgacIdentities}')::integer;
  expected_pgic := (import_record.report #>> '{graph,pgicIdentities}')::integer;
  expected_identities := (import_record.report #>> '{graph,identities}')::integer;
  expected_aliases := (import_record.report #>> '{graph,aliases}')::integer;
  expected_audits := (import_record.report #>> '{audit,records}')::integer;
  expected_audit_checksum := import_record.report #>> '{audit,checksum}';
  counter_floor := (import_record.report #>> '{graph,allocationCounterFloor}')::integer;

  select count(*)::integer into actual_bindings
  from private.ax_identity_source_bindings
  where legacy_import_id = p_legacy_import_id;
  select count(*) filter (where identity_kind = 'pgac')::integer,
    count(*) filter (where identity_kind = 'pgic')::integer,
    count(*)::integer
  into actual_pgac, actual_pgic, actual_identities
  from private.ax_identities
  where created_by_import_id = p_legacy_import_id;
  select count(*)::integer into actual_aliases
  from private.ax_identity_codes
  where created_by_import_id = p_legacy_import_id
    and code_kind = 'alias';
  select count(*) filter (where code_kind = 'canonical')::integer,
    count(*)::integer
  into actual_canonical_codes, actual_codes
  from private.ax_identity_codes
  where created_by_import_id = p_legacy_import_id;
  select count(*)::integer into actual_audits
  from private.ax_identity_legacy_import_audits
  where legacy_import_id = p_legacy_import_id;

  select encode(extensions.digest(
    'parents' || chr(10) || coalesce((
      select string_agg(
        private.ax_identity_canonical_jsonb(jsonb_build_object(
          'canonicalCode', canonical.code,
          'allocatedValue', identity.allocated_value,
          'rop3Component', identity.rop3_component
        )) || chr(10),
        '' order by canonical.code collate "C"
      )
      from private.ax_identities as identity
      join private.ax_identity_codes as canonical
        on canonical.identity_id = identity.id
       and canonical.code_kind = 'canonical'
       and canonical.lifecycle_state = 'active'
      where identity.created_by_import_id = p_legacy_import_id
        and identity.identity_kind = 'pgac'
        and identity.lifecycle_state = 'active'
    ), '') ||
    'children' || chr(10) || coalesce((
      select string_agg(
        private.ax_identity_canonical_jsonb(jsonb_build_object(
          'canonicalCode', child_code.code,
          'parentCanonicalCode', parent_code.code,
          'normalizedIso3', child.normalized_iso3
        )) || chr(10),
        '' order by child_code.code collate "C"
      )
      from private.ax_identities as child
      join private.ax_identity_codes as child_code
        on child_code.identity_id = child.id
       and child_code.code_kind = 'canonical'
       and child_code.lifecycle_state = 'active'
      join private.ax_identity_codes as parent_code
        on parent_code.identity_id = child.parent_identity_id
       and parent_code.code_kind = 'canonical'
       and parent_code.lifecycle_state = 'active'
      where child.created_by_import_id = p_legacy_import_id
        and child.identity_kind = 'pgic'
        and child.lifecycle_state = 'active'
    ), '') ||
    'aliases' || chr(10) || coalesce((
      select string_agg(
        private.ax_identity_canonical_jsonb(jsonb_build_object(
          'code', alias.code,
          'identityCanonicalCode', canonical.code,
          'identityKind', identity.identity_kind
        )) || chr(10),
        '' order by alias.code collate "C"
      )
      from private.ax_identity_codes as alias
      join private.ax_identities as identity on identity.id = alias.identity_id
      join private.ax_identity_codes as canonical
        on canonical.identity_id = identity.id
       and canonical.code_kind = 'canonical'
       and canonical.lifecycle_state = 'active'
      where alias.created_by_import_id = p_legacy_import_id
        and alias.code_kind = 'alias'
        and alias.lifecycle_state = 'active'
    ), '') ||
    'bindings' || chr(10) || coalesce((
      select string_agg(
        private.ax_identity_canonical_jsonb(jsonb_build_object(
          'sourceProfileKey', binding.source_profile_key,
          'stableRowKey', binding.stable_row_key,
          'identityCanonicalCode', canonical.code,
          'sourcePgacCode', binding.source_pgac_code,
          'sourcePgicCode', binding.source_pgic_code,
          'tier2Component', binding.legacy_component
        )) || chr(10),
        '' order by binding.source_profile_key collate "C",
          binding.stable_row_key collate "C"
      )
      from private.ax_identity_source_bindings as binding
      join private.ax_identity_codes as canonical
        on canonical.identity_id = binding.identity_id
       and canonical.code_kind = 'canonical'
       and canonical.lifecycle_state = 'active'
      where binding.legacy_import_id = p_legacy_import_id
        and binding.binding_state = 'active'
    ), ''),
    'sha256'
  ), 'hex') into computed_graph_checksum;

  select encode(extensions.digest(
    'audits' || chr(10) || coalesce(string_agg(
      private.ax_identity_canonical_jsonb(jsonb_build_object(
        'auditKind', audit_kind,
        'sourceFileKey', source_file_key,
        'stableRowKeyHash', stable_row_key_hash,
        'details', details
      )) || chr(10),
      '' order by audit_kind collate "C", source_file_key collate "C",
        stable_row_key_hash collate "C"
    ), ''),
    'sha256'
  ), 'hex') into computed_audit_checksum
  from private.ax_identity_legacy_import_audits
  where legacy_import_id = p_legacy_import_id;

  if actual_bindings is distinct from expected_bindings
    or actual_pgac is distinct from expected_pgac
    or actual_pgic is distinct from expected_pgic
    or actual_identities is distinct from expected_identities
    or actual_aliases is distinct from expected_aliases
    or actual_canonical_codes is distinct from expected_identities
    or actual_codes is distinct from expected_identities + expected_aliases
    or actual_audits is distinct from expected_audits
    or exists (
      select 1 from private.ax_identities
      where created_by_import_id = p_legacy_import_id
        and lifecycle_state <> 'active'
    )
    or exists (
      select 1 from private.ax_identity_codes
      where created_by_import_id = p_legacy_import_id
        and lifecycle_state <> 'active'
    )
    or exists (
      select 1 from private.ax_identity_source_bindings
      where legacy_import_id = p_legacy_import_id
        and binding_state <> 'active'
    )
    or computed_graph_checksum is distinct from import_record.graph_checksum
    or computed_audit_checksum is distinct from expected_audit_checksum
    or encode(extensions.digest(
      private.ax_identity_canonical_jsonb(import_record.report), 'sha256'
    ), 'hex') is distinct from import_record.report_checksum
    or not exists (
      select 1 from private.ax_identity_artifacts
      where legacy_import_id = p_legacy_import_id
        and artifact_key = 'audit-report'
        and content_checksum = import_record.report #>> '{audit,artifactChecksum}'
    )
    or not exists (
      select 1 from private.ax_identity_artifacts
      where legacy_import_id = p_legacy_import_id
        and artifact_key = 'report'
        and content_checksum = import_record.report_checksum
    )
    or coalesce((import_record.report #>> '{bindingTranslation,present}')::boolean, false) = false
    or (import_record.report #>> '{bindingTranslation,selectedActiveBindingCount}')::integer
      is distinct from expected_bindings
    or (import_record.report #>> '{bindingTranslation,rawBindingCount}')::integer
      < expected_bindings
    or not exists (
      select 1 from private.ax_identity_artifacts
      where legacy_import_id = p_legacy_import_id
        and artifact_key = 'binding-translation'
        and content_checksum = import_record.report #>> '{bindingTranslation,sha256}'
    )
    or (select count(*) from private.ax_identity_artifacts
        where legacy_import_id = p_legacy_import_id) <> 9
    or exists (
      select 1
      from private.ax_identity_artifacts as artifact
      left join storage.objects as object
        on object.bucket_id = 'identity-registry-evidence'
       and object.name = artifact.storage_path
      where artifact.legacy_import_id = p_legacy_import_id
        and object.id is null
    )
    or exists (
      select 1 from private.ax_identities
      where created_by_import_id is distinct from p_legacy_import_id
    )
    or exists (
      select 1 from private.ax_identity_codes
      where created_by_import_id is distinct from p_legacy_import_id
    )
    or exists (
      select 1 from private.ax_identity_source_bindings
      where legacy_import_id is distinct from p_legacy_import_id
    )
    or exists (
      select 1
      from jsonb_array_elements(import_record.report -> 'tier2Components') as component
      where not coalesce((component ->> 'mapped')::boolean, false)
        or not exists (
          select 1
          from private.tier2_partner_profiles as profile
          join private.api_connections as connection
            on connection.id = profile.api_connection_id
          where profile.profile_key = component ->> 'profileKey'
            and profile.active
            and connection.provider = 'google_sheets'
            and connection.archived_at is null
            and connection.provider_config ->> 'spreadsheetId' = profile.spreadsheet_id
            and nullif(connection.provider_config ->> 'sheetId', '')::bigint = profile.sheet_id
            and (
              component ->> 'component' not like 'spreadsheet:%'
              or profile.spreadsheet_id = split_part(component ->> 'component', 'spreadsheet:', 2)
            )
            and component -> 'databaseProfile' is not null
            and profile.partner_key = component #>> '{databaseProfile,partnerKey}'
            and profile.spreadsheet_id = component #>> '{databaseProfile,spreadsheetId}'
            and profile.sheet_id = (component #>> '{databaseProfile,sheetId}')::bigint
            and profile.contract_version = component #>> '{databaseProfile,contractVersion}'
            and profile.contract_checksum = component #>> '{databaseProfile,contractChecksum}'
            and profile.api_connection_id::text = component #>> '{databaseProfile,apiConnectionId}'
            and connection.provider = component #>> '{databaseProfile,connectionProvider}'
            and connection.provider_config ->> 'spreadsheetId' =
              component #>> '{databaseProfile,connectionSpreadsheetId}'
            and nullif(connection.provider_config ->> 'sheetId', '')::bigint =
              (component #>> '{databaseProfile,connectionSheetId}')::bigint
        )
    )
    or exists (
      select component ->> 'profileKey'
      from jsonb_array_elements(import_record.report -> 'tier2Components') as component
      where coalesce((component ->> 'mapped')::boolean, false)
      group by component ->> 'profileKey'
      having count(*) <> 1
    )
  then
    raise exception 'The staged legacy AX graph does not match its verified dry-run.'
      using errcode = '23514';
  end if;

  update private.ax_identity_counters
  set next_value = greatest(next_value, counter_floor), updated_at = now()
  where namespace = 'people-groups';

  select count(*)::integer,
    encode(extensions.digest(coalesce(string_agg(
      binding.source_profile_key || ':' || binding.stable_row_key || ':' || code.code,
      '|' order by binding.source_profile_key collate "C",
        binding.stable_row_key collate "C", binding.id
    ), ''), 'sha256'), 'hex')
  into actual_bindings, binding_checksum
  from private.ax_identity_source_bindings as binding
  join private.ax_identity_codes as code
    on code.identity_id = binding.identity_id
   and code.code_kind = 'canonical'
   and code.lifecycle_state = 'active'
  where binding.binding_state = 'active';

  insert into private.ax_registry_revisions (
    previous_revision_id, content_checksum, binding_count,
    actor_owner_id, actor_email, reason
  ) values (
    null, binding_checksum, actual_bindings,
    p_actor_owner_id, p_actor_email, p_reason
  ) returning id into new_revision_id;

  update private.ax_identity_source_bindings
  set activated_revision_id = new_revision_id
  where legacy_import_id = p_legacy_import_id;
  update private.ax_identities
  set activated_revision_id = new_revision_id
  where created_by_import_id = p_legacy_import_id;
  update private.ax_identity_codes
  set activated_revision_id = new_revision_id
  where created_by_import_id = p_legacy_import_id;

  insert into private.ax_registry_revision_bindings (revision_id, binding_id)
  select new_revision_id, id
  from private.ax_identity_source_bindings
  where binding_state = 'active';

  update private.ax_identity_legacy_imports
  set status = 'committed', registry_revision_id = new_revision_id,
    committed_at = now(), reason = p_reason
  where id = p_legacy_import_id;

  insert into private.ax_identity_registry_cutovers (
    namespace, legacy_import_id, registry_revision_id,
    input_fingerprint, graph_checksum, report_checksum,
    actor_owner_id, actor_email, reason
  ) values (
    'people-groups', p_legacy_import_id, new_revision_id,
    import_record.input_fingerprint, import_record.graph_checksum,
    import_record.report_checksum, p_actor_owner_id, p_actor_email, p_reason
  );

  delete from private.ax_identity_graph_commit_sessions
  where backend_pid = pg_backend_pid()
    and transaction_id = txid_current()
    and legacy_import_id = p_legacy_import_id;

  return new_revision_id;
end;
$$;

create or replace function private.guard_verified_legacy_ax_import()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  table_owner text;
begin
  if tg_op = 'INSERT' then
    if new.import_kind = 'verified-identity-graph' and (
      new.status = 'committed'
      or new.registry_revision_id is not null
      or new.committed_at is not null
    ) then
      raise exception 'Verified legacy AX imports must begin as blocked or dry-run evidence.'
        using errcode = '55000';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Verified legacy AX import evidence is append-only.';
  end if;
  if new.import_kind is distinct from old.import_kind then
    raise exception 'Legacy AX import kind is immutable.'
      using errcode = '55000';
  end if;
  if old.import_kind = 'verified-identity-graph' and (
    new.input_fingerprint is distinct from old.input_fingerprint
    or new.snapshot_manifest is distinct from old.snapshot_manifest
    or new.finding_count is distinct from old.finding_count
    or new.actor_owner_id is distinct from old.actor_owner_id
    or new.state_fingerprint is distinct from old.state_fingerprint
    or new.graph_checksum is distinct from old.graph_checksum
    or new.report_checksum is distinct from old.report_checksum
    or new.manifest_checksum is distinct from old.manifest_checksum
    or new.dry_run_token_hash is distinct from old.dry_run_token_hash
    or new.report is distinct from old.report
    or new.dry_run_completed_at is distinct from old.dry_run_completed_at
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Verified legacy AX dry-run evidence is immutable.';
  end if;
  if old.import_kind = 'verified-identity-graph' and (
    new.status is distinct from old.status
    or new.registry_revision_id is distinct from old.registry_revision_id
    or new.committed_at is distinct from old.committed_at
    or new.reason is distinct from old.reason
  ) then
    select pg_get_userbyid(relowner) into table_owner
    from pg_class
    where oid = 'private.ax_identity_legacy_imports'::regclass;
    if current_user is distinct from table_owner
      or not private.has_legacy_ax_graph_commit_session(old.id)
      or old.status <> 'dry-run'
      or new.status <> 'committed'
      or new.registry_revision_id is null
      or new.committed_at is null
    then
      raise exception 'Verified legacy AX import finalization requires its authorized finalizer session.'
        using errcode = '55000';
    end if;
  end if;
  if old.status in ('blocked', 'committed') and new is distinct from old then
    raise exception 'Final legacy AX import evidence is immutable.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_ax_identity_registry_cutover_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  table_owner text;
begin
  select pg_get_userbyid(relowner) into table_owner
  from pg_class
  where oid = 'private.ax_identity_registry_cutovers'::regclass;
  if current_user is distinct from table_owner then
    raise exception 'Verified AX cutover markers can only be created by the authorized finalizer.'
      using errcode = '55000';
  end if;

  if not private.has_legacy_ax_graph_commit_session(new.legacy_import_id) or not exists (
    select 1
    from private.ax_identity_legacy_imports as legacy
    join private.ax_identity_graph_commit_sessions as session
      on session.legacy_import_id = legacy.id
     and session.backend_pid = pg_backend_pid()
     and session.transaction_id = txid_current()
     and session.input_fingerprint = legacy.input_fingerprint
     and session.token_hash = legacy.dry_run_token_hash
     and session.state_fingerprint = legacy.state_fingerprint
    where legacy.id = new.legacy_import_id
      and legacy.status = 'committed'
      and legacy.registry_revision_id = new.registry_revision_id
      and legacy.input_fingerprint = new.input_fingerprint
      and legacy.graph_checksum = new.graph_checksum
      and legacy.report_checksum = new.report_checksum
      and new.namespace = 'people-groups'
  ) then
    raise exception 'The AX cutover marker does not match its authorized finalizer session.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_ax_import_lifecycle_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_id uuid;
  activating boolean;
begin
  if tg_table_name = 'ax_identity_source_bindings' then
    import_id := new.legacy_import_id;
    activating := old.binding_state <> 'active' and new.binding_state = 'active';
  else
    import_id := new.created_by_import_id;
    activating := old.lifecycle_state <> 'active' and new.lifecycle_state = 'active';
  end if;
  if import_id is not null and activating
    and not private.has_legacy_ax_graph_commit_session(import_id)
  then
    raise exception 'Imported AX records require their authorized commit session for activation.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_ax_identity_cutover_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by_import_id is not null then
    if not private.has_legacy_ax_graph_commit_session(new.created_by_import_id) then
      raise exception 'An authorized legacy AX graph commit session is required for imported identities.'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if not exists (
    select 1
    from private.ax_identity_registry_cutovers as cutover
    join private.ax_identity_legacy_imports as legacy
      on legacy.id = cutover.legacy_import_id
     and legacy.import_kind = 'verified-identity-graph'
     and legacy.status = 'committed'
     and legacy.registry_revision_id = cutover.registry_revision_id
    join private.ax_registry_revisions as revision
      on revision.id = cutover.registry_revision_id
    where cutover.namespace = new.namespace
  ) then
    raise exception 'Verified legacy AX registry cutover is required before identity allocation.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_ax_identity_code_import_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by_import_id is not null
    and not private.has_legacy_ax_graph_commit_session(new.created_by_import_id)
  then
    raise exception 'An authorized legacy AX graph commit session is required for imported codes.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_ax_identity_binding_import_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.legacy_import_id is not null
    and not private.has_legacy_ax_graph_commit_session(new.legacy_import_id)
  then
    raise exception 'An authorized legacy AX graph commit session is required for imported bindings.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_ax_identity_import_audit_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_legacy_ax_graph_commit_session(new.legacy_import_id) then
    raise exception 'An authorized legacy AX graph commit session is required for import audits.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_ax_identity_publication_cutover()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.producer_kind = 'identity' and not exists (
    select 1
    from private.ax_identity_registry_cutovers as cutover
    join private.ax_identity_legacy_imports as legacy
      on legacy.id = cutover.legacy_import_id
     and legacy.import_kind = 'verified-identity-graph'
     and legacy.status = 'committed'
     and legacy.registry_revision_id = cutover.registry_revision_id
    where cutover.namespace = 'people-groups'
  ) then
    raise exception 'Verified legacy AX registry cutover is required before identity publication.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists ax_identity_legacy_imports_verified_guard
  on private.ax_identity_legacy_imports;
create trigger ax_identity_legacy_imports_verified_guard
before insert or update or delete on private.ax_identity_legacy_imports
for each row execute function private.guard_verified_legacy_ax_import();

drop trigger if exists ax_identity_legacy_import_audits_immutable
  on private.ax_identity_legacy_import_audits;
create trigger ax_identity_legacy_import_audits_immutable
before update or delete on private.ax_identity_legacy_import_audits
for each row execute function private.guard_ax_immutable_history();

drop trigger if exists ax_identity_legacy_import_audits_require_session
  on private.ax_identity_legacy_import_audits;
create trigger ax_identity_legacy_import_audits_require_session
before insert on private.ax_identity_legacy_import_audits
for each row execute function private.guard_ax_identity_import_audit_insert();

drop trigger if exists ax_identity_registry_cutovers_immutable
  on private.ax_identity_registry_cutovers;
create trigger ax_identity_registry_cutovers_immutable
before update or delete on private.ax_identity_registry_cutovers
for each row execute function private.guard_ax_immutable_history();

drop trigger if exists ax_identity_registry_cutovers_require_finalizer
  on private.ax_identity_registry_cutovers;
create trigger ax_identity_registry_cutovers_require_finalizer
before insert on private.ax_identity_registry_cutovers
for each row execute function private.guard_ax_identity_registry_cutover_insert();

drop trigger if exists ax_identities_require_cutover
  on private.ax_identities;
create trigger ax_identities_require_cutover
before insert on private.ax_identities
for each row execute function private.guard_ax_identity_cutover_insert();

drop trigger if exists ax_identity_codes_require_import_session
  on private.ax_identity_codes;
create trigger ax_identity_codes_require_import_session
before insert on private.ax_identity_codes
for each row execute function private.guard_ax_identity_code_import_insert();

drop trigger if exists ax_identity_source_bindings_require_import_session
  on private.ax_identity_source_bindings;
create trigger ax_identity_source_bindings_require_import_session
before insert on private.ax_identity_source_bindings
for each row execute function private.guard_ax_identity_binding_import_insert();

drop trigger if exists ax_identities_require_import_activation_session
  on private.ax_identities;
create trigger ax_identities_require_import_activation_session
before update of lifecycle_state on private.ax_identities
for each row execute function private.guard_ax_import_lifecycle_activation();

drop trigger if exists ax_identity_codes_require_import_activation_session
  on private.ax_identity_codes;
create trigger ax_identity_codes_require_import_activation_session
before update of lifecycle_state on private.ax_identity_codes
for each row execute function private.guard_ax_import_lifecycle_activation();

drop trigger if exists ax_identity_source_bindings_require_import_activation_session
  on private.ax_identity_source_bindings;
create trigger ax_identity_source_bindings_require_import_activation_session
before update of binding_state on private.ax_identity_source_bindings
for each row execute function private.guard_ax_import_lifecycle_activation();

drop trigger if exists pipeline_publications_require_identity_cutover
  on private.pipeline_publications;
create trigger pipeline_publications_require_identity_cutover
before insert on private.pipeline_publications
for each row execute function private.guard_ax_identity_publication_cutover();

alter table private.ax_identity_legacy_import_audits enable row level security;
alter table private.ax_identity_registry_cutovers enable row level security;
alter table private.ax_identity_graph_commit_sessions enable row level security;
revoke all on private.ax_identity_legacy_import_audits from public, anon, authenticated;
revoke all on private.ax_identity_registry_cutovers from public, anon, authenticated;
revoke all on private.ax_identity_graph_commit_sessions
  from public, anon, authenticated, service_role;
grant all on private.ax_identity_legacy_import_audits to service_role;
revoke all on private.ax_identity_registry_cutovers from service_role;
grant select on private.ax_identity_registry_cutovers to service_role;
revoke update, delete on private.ax_identity_legacy_imports from service_role;
revoke all on sequence private.ax_identity_legacy_import_audits_id_seq
  from public, anon, authenticated;
grant usage, select on sequence private.ax_identity_legacy_import_audits_id_seq
  to service_role;

revoke all on function private.ax_identity_registry_state_fingerprint()
  from public, anon, authenticated;
revoke all on function private.begin_legacy_ax_identity_graph_commit(uuid, text, text)
  from public, anon, authenticated;
revoke all on function private.finalize_legacy_ax_identity_graph_import(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function private.ax_identity_registry_state_fingerprint() to service_role;
grant execute on function private.begin_legacy_ax_identity_graph_commit(uuid, text, text)
  to service_role;
grant execute on function private.finalize_legacy_ax_identity_graph_import(uuid, text, text, text, text, text)
  to service_role;
