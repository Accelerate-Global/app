create extension if not exists pgcrypto with schema extensions;

alter table private.api_connection_runs
  add column if not exists operation_key text;

create unique index if not exists api_connection_runs_operation_key_idx
  on private.api_connection_runs(operation_key)
  where operation_key is not null;

create table private.pipeline_flow_runs (
  id uuid primary key default gen_random_uuid(),
  definition_key text not null,
  definition_version text not null,
  definition_checksum text not null,
  correlation_id uuid not null default gen_random_uuid(),
  launch_kind text not null,
  idempotency_key text not null,
  input_fingerprint text not null,
  exact_inputs jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  current_stage_key text,
  actor_owner_id text not null,
  actor_email text,
  parent_run_id uuid references private.pipeline_flow_runs(id) on delete restrict,
  progress_current integer not null default 0,
  progress_total integer not null default 0,
  row_count integer,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  publication_id uuid references private.pipeline_publications(id) on delete restrict,
  out_of_date boolean not null default false,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pipeline_flow_runs_definition_key_check
    check (definition_key ~ '^[a-z][a-z0-9-]*$'),
  constraint pipeline_flow_runs_definition_version_check
    check (btrim(definition_version) <> ''),
  constraint pipeline_flow_runs_definition_checksum_check
    check (definition_checksum ~ '^[0-9a-f]{64}$'),
  constraint pipeline_flow_runs_launch_kind_check
    check (launch_kind in ('manual', 'schedule', 'backfill', 'rebuild')),
  constraint pipeline_flow_runs_idempotency_key_check
    check (btrim(idempotency_key) <> ''),
  constraint pipeline_flow_runs_input_fingerprint_check
    check (input_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint pipeline_flow_runs_exact_inputs_check
    check (jsonb_typeof(exact_inputs) = 'object'),
  constraint pipeline_flow_runs_backfill_inputs_check
    check (launch_kind <> 'backfill' or exact_inputs <> '{}'::jsonb),
  constraint pipeline_flow_runs_status_check
    check (status in ('queued', 'running', 'awaiting_review', 'succeeded', 'failed', 'cancelled')),
  constraint pipeline_flow_runs_actor_check check (btrim(actor_owner_id) <> ''),
  constraint pipeline_flow_runs_progress_check check (
    progress_current >= 0 and progress_total >= 0 and progress_current <= progress_total
  ),
  constraint pipeline_flow_runs_counts_check check (
    (row_count is null or row_count >= 0) and warning_count >= 0 and error_count >= 0
  ),
  constraint pipeline_flow_runs_idempotency_unique unique (idempotency_key)
);

create table private.pipeline_flow_stages (
  id uuid primary key default gen_random_uuid(),
  flow_run_id uuid not null references private.pipeline_flow_runs(id) on delete restrict,
  stage_key text not null,
  stage_index integer not null,
  stage_kind text not null,
  effect_key text not null,
  status text not null default 'blocked',
  max_attempts integer not null default 3,
  attempt_count integer not null default 0,
  lease_owner text,
  lease_expires_at timestamptz,
  progress_current integer not null default 0,
  progress_total integer not null default 0,
  exact_inputs jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  finding_summary jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pipeline_flow_stages_key_check check (stage_key ~ '^[a-z][a-z0-9-]*$'),
  constraint pipeline_flow_stages_index_check check (stage_index >= 0),
  constraint pipeline_flow_stages_kind_check check (
    stage_kind in ('ingestion', 'forming', 'identity', 'release', 'merge', 'aggregate', 'publication', 'review')
  ),
  constraint pipeline_flow_stages_effect_key_check check (btrim(effect_key) <> ''),
  constraint pipeline_flow_stages_status_check check (
    status in ('blocked', 'queued', 'claimed', 'awaiting_review', 'succeeded', 'retryable', 'failed', 'skipped')
  ),
  constraint pipeline_flow_stages_attempts_check check (
    max_attempts between 1 and 20 and attempt_count between 0 and max_attempts
  ),
  constraint pipeline_flow_stages_lease_check check (
    (status = 'claimed' and lease_owner is not null and btrim(lease_owner) <> '' and lease_expires_at is not null)
    or (status <> 'claimed' and lease_owner is null and lease_expires_at is null)
  ),
  constraint pipeline_flow_stages_progress_check check (
    progress_current >= 0 and progress_total >= 0 and progress_current <= progress_total
  ),
  constraint pipeline_flow_stages_json_check check (
    jsonb_typeof(exact_inputs) = 'object'
    and jsonb_typeof(output) = 'object'
    and jsonb_typeof(finding_summary) = 'object'
  ),
  constraint pipeline_flow_stages_run_key_unique unique (flow_run_id, stage_key),
  constraint pipeline_flow_stages_run_index_unique unique (flow_run_id, stage_index)
);

create table private.pipeline_stage_attempts (
  id uuid primary key default gen_random_uuid(),
  flow_run_id uuid not null references private.pipeline_flow_runs(id) on delete restrict,
  stage_id uuid not null references private.pipeline_flow_stages(id) on delete restrict,
  attempt_number integer not null,
  worker_id text not null,
  effect_key text not null,
  status text not null default 'claimed',
  lease_expires_at timestamptz not null,
  progress jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  finding_summary jsonb not null default '{}'::jsonb,
  retryable boolean,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint pipeline_stage_attempts_number_check check (attempt_number > 0),
  constraint pipeline_stage_attempts_worker_check check (btrim(worker_id) <> ''),
  constraint pipeline_stage_attempts_effect_key_check check (btrim(effect_key) <> ''),
  constraint pipeline_stage_attempts_status_check check (
    status in ('claimed', 'succeeded', 'awaiting_review', 'failed', 'interrupted')
  ),
  constraint pipeline_stage_attempts_json_check check (
    jsonb_typeof(progress) = 'object'
    and jsonb_typeof(output) = 'object'
    and jsonb_typeof(finding_summary) = 'object'
  ),
  constraint pipeline_stage_attempts_stage_number_unique unique (stage_id, attempt_number)
);

create unique index pipeline_stage_attempts_active_claim_idx
  on private.pipeline_stage_attempts(stage_id)
  where status = 'claimed';

create table private.pipeline_run_events (
  id bigint generated always as identity primary key,
  flow_run_id uuid not null references private.pipeline_flow_runs(id) on delete restrict,
  stage_id uuid references private.pipeline_flow_stages(id) on delete restrict,
  event_type text not null,
  safe_message text not null,
  details jsonb not null default '{}'::jsonb,
  actor_owner_id text,
  created_at timestamptz not null default now(),
  constraint pipeline_run_events_type_check check (event_type ~ '^[a-z][a-z0-9-]*$'),
  constraint pipeline_run_events_message_check check (btrim(safe_message) <> ''),
  constraint pipeline_run_events_details_check check (jsonb_typeof(details) = 'object')
);

create table private.pipeline_schedule_states (
  definition_key text primary key,
  enabled boolean not null default false,
  interval_minutes integer not null default 1440,
  manual_canary_run_id uuid references private.pipeline_flow_runs(id) on delete restrict,
  manual_canary_verified_at timestamptz,
  manual_canary_verified_by text,
  last_enqueued_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint pipeline_schedule_states_key_check check (definition_key ~ '^[a-z][a-z0-9-]*$'),
  constraint pipeline_schedule_states_interval_check check (interval_minutes between 5 and 10080),
  constraint pipeline_schedule_states_enablement_check check (
    not enabled
    or (manual_canary_run_id is not null and manual_canary_verified_at is not null
      and manual_canary_verified_by is not null and btrim(manual_canary_verified_by) <> '')
  )
);

create index pipeline_flow_runs_status_created_idx
  on private.pipeline_flow_runs(status, created_at desc, id);
create index pipeline_flow_runs_definition_created_idx
  on private.pipeline_flow_runs(definition_key, created_at desc, id);
create index pipeline_flow_runs_correlation_idx
  on private.pipeline_flow_runs(correlation_id, created_at, id);
create index pipeline_flow_stages_runnable_idx
  on private.pipeline_flow_stages(status, lease_expires_at, flow_run_id, stage_index);
create index pipeline_flow_stages_run_idx
  on private.pipeline_flow_stages(flow_run_id, stage_index);
create index pipeline_stage_attempts_run_idx
  on private.pipeline_stage_attempts(flow_run_id, started_at, id);
create index pipeline_run_events_run_idx
  on private.pipeline_run_events(flow_run_id, created_at, id);

create or replace function private.claim_pipeline_stage(
  p_flow_run_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 60
)
returns table (
  stage_id uuid,
  attempt_id uuid,
  flow_run_id uuid,
  definition_key text,
  actor_owner_id text,
  actor_email text,
  stage_key text,
  stage_kind text,
  effect_key text,
  exact_inputs jsonb,
  attempt_number integer,
  max_attempts integer,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run private.pipeline_flow_runs%rowtype;
  v_stage private.pipeline_flow_stages%rowtype;
  v_attempt_id uuid := gen_random_uuid();
  v_lease_expires_at timestamptz;
begin
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'A worker identifier is required.' using errcode = '22023';
  end if;
  if p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception 'Lease duration must be between 15 and 900 seconds.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_flow_run_id::text, 0));

  select runs.* into v_run
  from private.pipeline_flow_runs as runs
  where runs.id = p_flow_run_id
  for update;

  if not found then
    raise exception 'Pipeline flow run was not found.' using errcode = 'P0002';
  end if;
  if v_run.status in ('awaiting_review', 'succeeded', 'failed', 'cancelled') then
    return;
  end if;

  select candidate.* into v_stage
  from private.pipeline_flow_stages as candidate
  where candidate.flow_run_id = p_flow_run_id
    and (
      candidate.status in ('queued', 'retryable')
      or (candidate.status = 'claimed' and candidate.lease_expires_at <= now())
    )
  order by candidate.stage_index
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  if v_stage.status = 'claimed' then
    update private.pipeline_stage_attempts as attempts
    set status = 'interrupted', retryable = true,
      error_code = 'lease-expired', error_message = 'The worker lease expired before completion.',
      completed_at = now(), heartbeat_at = now()
    where attempts.stage_id = v_stage.id and attempts.status = 'claimed';

    insert into private.pipeline_run_events (
      flow_run_id, stage_id, event_type, safe_message, details
    ) values (
      p_flow_run_id, v_stage.id, 'stale-recovered',
      'An expired stage lease was recovered.',
      jsonb_build_object('previousWorkerId', v_stage.lease_owner)
    );

    if v_stage.attempt_count >= v_stage.max_attempts then
      update private.pipeline_flow_stages as stages
      set status = 'failed', lease_owner = null, lease_expires_at = null,
        error_code = 'attempts-exhausted',
        error_message = 'The stage exhausted its retry limit after an expired lease.',
        completed_at = now(), updated_at = now()
      where stages.id = v_stage.id;
      update private.pipeline_flow_runs as runs
      set status = 'failed', current_stage_key = v_stage.stage_key,
        error_code = 'attempts-exhausted',
        error_message = 'A pipeline stage exhausted its retry limit.',
        completed_at = now(), updated_at = now()
      where runs.id = p_flow_run_id;
      return;
    end if;
  end if;

  v_lease_expires_at := now() + make_interval(secs => p_lease_seconds);

  update private.pipeline_flow_stages as stages
  set status = 'claimed', attempt_count = stages.attempt_count + 1,
    lease_owner = p_worker_id, lease_expires_at = v_lease_expires_at,
    started_at = coalesce(stages.started_at, now()), updated_at = now(),
    error_code = null, error_message = null
  where stages.id = v_stage.id
  returning * into v_stage;

  insert into private.pipeline_stage_attempts (
    id, flow_run_id, stage_id, attempt_number, worker_id, effect_key,
    lease_expires_at, progress
  ) values (
    v_attempt_id, p_flow_run_id, v_stage.id, v_stage.attempt_count,
    p_worker_id, v_stage.effect_key, v_lease_expires_at,
    jsonb_build_object('current', v_stage.progress_current, 'total', v_stage.progress_total)
  );

  update private.pipeline_flow_runs as runs
  set status = 'running', current_stage_key = v_stage.stage_key,
    started_at = coalesce(runs.started_at, now()), updated_at = now()
  where runs.id = p_flow_run_id;

  insert into private.pipeline_run_events (
    flow_run_id, stage_id, event_type, safe_message, details
  ) values (
    p_flow_run_id, v_stage.id, 'stage-claimed', 'A worker claimed the next pipeline stage.',
    jsonb_build_object('attemptNumber', v_stage.attempt_count, 'leaseExpiresAt', v_lease_expires_at)
  );

  return query select
    v_stage.id, v_attempt_id, p_flow_run_id, v_run.definition_key,
    v_run.actor_owner_id, v_run.actor_email,
    v_stage.stage_key, v_stage.stage_kind, v_stage.effect_key,
    v_stage.exact_inputs, v_stage.attempt_count, v_stage.max_attempts,
    v_lease_expires_at;
end;
$$;

create or replace function private.update_pipeline_stage_progress(
  p_attempt_id uuid,
  p_worker_id text,
  p_current integer,
  p_total integer,
  p_lease_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage_id uuid;
  v_run_id uuid;
begin
  if p_current < 0 or p_total < 0 or p_current > p_total then
    raise exception 'Pipeline stage progress is invalid.' using errcode = '22023';
  end if;

  select flow_run_id into v_run_id
  from private.pipeline_stage_attempts
  where id = p_attempt_id;
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_run_id::text, 0));

  select stage_id, flow_run_id into v_stage_id, v_run_id
  from private.pipeline_stage_attempts
  where id = p_attempt_id and worker_id = p_worker_id and status = 'claimed'
    and lease_expires_at > now()
  for update;

  if not found then return false; end if;

  update private.pipeline_stage_attempts
  set progress = jsonb_build_object('current', p_current, 'total', p_total),
    heartbeat_at = now(), lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  where id = p_attempt_id;

  update private.pipeline_flow_stages
  set progress_current = p_current, progress_total = p_total,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds), updated_at = now()
  where id = v_stage_id and lease_owner = p_worker_id and status = 'claimed';

  update private.pipeline_flow_runs
  set updated_at = now()
  where id = v_run_id;

  return true;
end;
$$;

create or replace function private.complete_pipeline_stage(
  p_attempt_id uuid,
  p_worker_id text,
  p_outcome text,
  p_output jsonb default '{}'::jsonb,
  p_finding_summary jsonb default '{}'::jsonb,
  p_row_count integer default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt private.pipeline_stage_attempts%rowtype;
  v_stage private.pipeline_flow_stages%rowtype;
  v_next_stage_id uuid;
  v_next_stage_key text;
  v_run_status text;
  v_warning_count integer := greatest(coalesce((p_finding_summary ->> 'warningCount')::integer, 0), 0);
  v_error_count integer := greatest(coalesce((p_finding_summary ->> 'errorCount')::integer, 0), 0);
begin
  if p_outcome not in ('succeeded', 'awaiting_review') then
    raise exception 'Pipeline stage outcome is invalid.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_output, '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(p_finding_summary, '{}'::jsonb)) <> 'object' then
    raise exception 'Pipeline stage output must be JSON objects.' using errcode = '22023';
  end if;

  select flow_run_id into v_attempt.flow_run_id
  from private.pipeline_stage_attempts
  where id = p_attempt_id;
  if not found then
    raise exception 'The pipeline stage claim is no longer active.' using errcode = '40001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_attempt.flow_run_id::text, 0));

  select * into v_attempt
  from private.pipeline_stage_attempts
  where id = p_attempt_id
  for update;
  if not found or v_attempt.status <> 'claimed' or v_attempt.worker_id <> p_worker_id then
    raise exception 'The pipeline stage claim is no longer active.' using errcode = '40001';
  end if;

  select * into v_stage
  from private.pipeline_flow_stages
  where id = v_attempt.stage_id
  for update;
  if v_stage.status <> 'claimed' or v_stage.lease_owner <> p_worker_id
    or v_stage.lease_expires_at <= now() then
    raise exception 'The pipeline stage lease expired before completion.' using errcode = '40001';
  end if;

  update private.pipeline_stage_attempts
  set status = p_outcome, output = coalesce(p_output, '{}'::jsonb),
    finding_summary = coalesce(p_finding_summary, '{}'::jsonb),
    retryable = false, heartbeat_at = now(), completed_at = now()
  where id = p_attempt_id;

  update private.pipeline_flow_stages
  set status = p_outcome, lease_owner = null, lease_expires_at = null,
    progress_current = greatest(progress_current, progress_total),
    output = coalesce(p_output, '{}'::jsonb),
    finding_summary = coalesce(p_finding_summary, '{}'::jsonb),
    error_code = null, error_message = null,
    completed_at = case when p_outcome = 'succeeded' then now() else null end,
    updated_at = now()
  where id = v_stage.id;

  if p_outcome = 'awaiting_review' then
    v_run_status := 'awaiting_review';
  else
    select id, stage_key into v_next_stage_id, v_next_stage_key
    from private.pipeline_flow_stages
    where flow_run_id = v_attempt.flow_run_id and stage_index > v_stage.stage_index
      and status = 'blocked'
    order by stage_index
    limit 1
    for update;

    if found then
      update private.pipeline_flow_stages
      set status = 'queued', updated_at = now()
      where id = v_next_stage_id;
      v_run_status := 'queued';
    else
      v_run_status := 'succeeded';
    end if;
  end if;

  update private.pipeline_flow_runs
  set status = v_run_status,
    current_stage_key = case when v_run_status = 'queued' then v_next_stage_key else v_stage.stage_key end,
    row_count = coalesce(p_row_count, row_count),
    publication_id = case
      when coalesce(p_output ->> 'publicationId', '')
        ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (p_output ->> 'publicationId')::uuid
      else publication_id
    end,
    warning_count = warning_count + v_warning_count,
    error_count = error_count + v_error_count,
    progress_current = (
      select count(*)::integer from private.pipeline_flow_stages
      where flow_run_id = v_attempt.flow_run_id and status in ('succeeded', 'skipped')
    ),
    completed_at = case when v_run_status = 'succeeded' then now() else null end,
    updated_at = now()
  where id = v_attempt.flow_run_id;

  insert into private.pipeline_run_events (
    flow_run_id, stage_id, event_type, safe_message, details
  ) values (
    v_attempt.flow_run_id, v_stage.id,
    case when p_outcome = 'awaiting_review' then 'review-required' else 'stage-completed' end,
    case when p_outcome = 'awaiting_review'
      then 'The pipeline reached an explicit review gate.'
      else 'The pipeline stage completed.' end,
    jsonb_build_object('attemptNumber', v_attempt.attempt_number, 'nextStatus', v_run_status)
  );

  return v_run_status;
end;
$$;

create or replace function private.fail_pipeline_stage(
  p_attempt_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_message text,
  p_retryable boolean default true
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt private.pipeline_stage_attempts%rowtype;
  v_stage private.pipeline_flow_stages%rowtype;
  v_stage_status text;
  v_run_status text;
begin
  select flow_run_id into v_attempt.flow_run_id
  from private.pipeline_stage_attempts
  where id = p_attempt_id;
  if not found then
    raise exception 'The pipeline stage claim is no longer active.' using errcode = '40001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_attempt.flow_run_id::text, 0));

  select * into v_attempt
  from private.pipeline_stage_attempts
  where id = p_attempt_id
  for update;
  if not found or v_attempt.status <> 'claimed' or v_attempt.worker_id <> p_worker_id then
    raise exception 'The pipeline stage claim is no longer active.' using errcode = '40001';
  end if;

  select * into v_stage
  from private.pipeline_flow_stages
  where id = v_attempt.stage_id
  for update;

  if p_retryable and v_stage.attempt_count < v_stage.max_attempts then
    v_stage_status := 'retryable';
    v_run_status := 'queued';
  else
    v_stage_status := 'failed';
    v_run_status := 'failed';
  end if;

  update private.pipeline_stage_attempts
  set status = 'failed', retryable = p_retryable,
    error_code = coalesce(nullif(btrim(p_error_code), ''), 'stage-failed'),
    error_message = coalesce(nullif(btrim(p_error_message), ''), 'The pipeline stage failed.'),
    heartbeat_at = now(), completed_at = now()
  where id = p_attempt_id;

  update private.pipeline_flow_stages
  set status = v_stage_status, lease_owner = null, lease_expires_at = null,
    error_code = coalesce(nullif(btrim(p_error_code), ''), 'stage-failed'),
    error_message = coalesce(nullif(btrim(p_error_message), ''), 'The pipeline stage failed.'),
    completed_at = case when v_stage_status = 'failed' then now() else null end,
    updated_at = now()
  where id = v_stage.id;

  update private.pipeline_flow_runs
  set status = v_run_status, current_stage_key = v_stage.stage_key,
    error_code = coalesce(nullif(btrim(p_error_code), ''), 'stage-failed'),
    error_message = coalesce(nullif(btrim(p_error_message), ''), 'The pipeline stage failed.'),
    error_count = error_count + 1,
    completed_at = case when v_run_status = 'failed' then now() else null end,
    updated_at = now()
  where id = v_attempt.flow_run_id;

  insert into private.pipeline_run_events (
    flow_run_id, stage_id, event_type, safe_message, details
  ) values (
    v_attempt.flow_run_id, v_stage.id, 'stage-failed',
    coalesce(nullif(btrim(p_error_message), ''), 'The pipeline stage failed.'),
    jsonb_build_object('errorCode', coalesce(nullif(btrim(p_error_code), ''), 'stage-failed'),
      'retryable', p_retryable, 'nextStatus', v_run_status)
  );

  return v_run_status;
end;
$$;

create or replace function private.resume_pipeline_review(
  p_flow_run_id uuid,
  p_stage_key text,
  p_actor_owner_id text,
  p_decision text,
  p_reason text,
  p_acknowledge_warnings boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage private.pipeline_flow_stages%rowtype;
  v_next_stage_id uuid;
  v_next_stage_key text;
  v_run_status text;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'Review decision must be approve or reject.' using errcode = '22023';
  end if;
  if p_actor_owner_id is null or btrim(p_actor_owner_id) = ''
    or p_reason is null or btrim(p_reason) = '' then
    raise exception 'Review actor and reason are required.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_flow_run_id::text, 0));

  select * into v_stage
  from private.pipeline_flow_stages
  where flow_run_id = p_flow_run_id and stage_key = p_stage_key
  for update;
  if not found or v_stage.status <> 'awaiting_review' then
    raise exception 'The requested stage is not awaiting review.' using errcode = '40001';
  end if;

  if p_decision = 'reject' then
    update private.pipeline_flow_stages
    set status = 'failed', error_code = 'review-rejected',
      error_message = 'An administrator rejected this review gate.',
      completed_at = now(), updated_at = now()
    where id = v_stage.id;
    v_run_status := 'failed';
  else
    update private.pipeline_flow_stages
    set status = 'succeeded',
      output = output || jsonb_build_object(
        'reviewDecision', p_decision,
        'reviewReason', p_reason,
        'reviewedByOwnerId', p_actor_owner_id,
        'warningsAcknowledged', p_acknowledge_warnings,
        'approved', true,
        'reason', p_reason,
        'acknowledgeWarnings', p_acknowledge_warnings
      ),
      completed_at = now(), updated_at = now()
    where id = v_stage.id;

    select id, stage_key into v_next_stage_id, v_next_stage_key
    from private.pipeline_flow_stages
    where flow_run_id = p_flow_run_id and stage_index > v_stage.stage_index
      and status = 'blocked'
    order by stage_index
    limit 1
    for update;
    if found then
      update private.pipeline_flow_stages set status = 'queued', updated_at = now()
      where id = v_next_stage_id;
      v_run_status := 'queued';
    else
      v_run_status := 'succeeded';
    end if;
  end if;

  update private.pipeline_flow_runs
  set status = v_run_status,
    current_stage_key = case when v_run_status = 'queued' then v_next_stage_key else v_stage.stage_key end,
    error_code = case when v_run_status = 'failed' then 'review-rejected' else null end,
    error_message = case when v_run_status = 'failed' then 'An administrator rejected this review gate.' else null end,
    progress_current = (
      select count(*)::integer from private.pipeline_flow_stages
      where flow_run_id = p_flow_run_id and status in ('succeeded', 'skipped')
    ),
    completed_at = case when v_run_status in ('failed', 'succeeded') then now() else null end,
    updated_at = now()
  where id = p_flow_run_id;

  insert into private.pipeline_run_events (
    flow_run_id, stage_id, event_type, safe_message, details, actor_owner_id
  ) values (
    p_flow_run_id, v_stage.id, 'review-' || p_decision,
    case when p_decision = 'approve'
      then 'An administrator approved the review gate.'
      else 'An administrator rejected the review gate.' end,
    jsonb_build_object(
      'reason', p_reason,
      'warningsAcknowledged', p_acknowledge_warnings
    ), p_actor_owner_id
  );

  return v_run_status;
end;
$$;

create or replace function private.retry_pipeline_stage(
  p_flow_run_id uuid,
  p_stage_key text,
  p_actor_owner_id text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage_id uuid;
begin
  if p_actor_owner_id is null or btrim(p_actor_owner_id) = ''
    or p_reason is null or btrim(p_reason) = '' then
    raise exception 'Retry actor and reason are required.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_flow_run_id::text, 0));

  select id into v_stage_id
  from private.pipeline_flow_stages
  where flow_run_id = p_flow_run_id and stage_key = p_stage_key and status = 'failed'
  for update;
  if not found then return false; end if;

  update private.pipeline_flow_stages
  set status = 'retryable', max_attempts = greatest(max_attempts, attempt_count + 1),
    error_code = null, error_message = null, completed_at = null, updated_at = now()
  where id = v_stage_id;
  update private.pipeline_flow_runs
  set status = 'queued', current_stage_key = p_stage_key,
    error_code = null, error_message = null, completed_at = null, updated_at = now()
  where id = p_flow_run_id and status = 'failed';
  insert into private.pipeline_run_events (
    flow_run_id, stage_id, event_type, safe_message, details, actor_owner_id
  ) values (
    p_flow_run_id, v_stage_id, 'manual-retry',
    'An administrator authorized another stage attempt.',
    jsonb_build_object('reason', p_reason), p_actor_owner_id
  );
  return true;
end;
$$;

create or replace function private.recover_stale_pipeline_stages(
  p_flow_run_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage private.pipeline_flow_stages%rowtype;
  v_stage_id uuid;
  v_run_id uuid;
  v_count integer := 0;
  v_stage_status text;
  v_run_status text;
begin
  for v_stage_id, v_run_id in
    select id, flow_run_id from private.pipeline_flow_stages
    where status = 'claimed' and lease_expires_at <= now()
      and (p_flow_run_id is null or flow_run_id = p_flow_run_id)
    order by flow_run_id, stage_index
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_run_id::text, 0));
    select * into v_stage
    from private.pipeline_flow_stages
    where id = v_stage_id and status = 'claimed' and lease_expires_at <= now()
    for update skip locked;
    if not found then continue; end if;

    if v_stage.attempt_count < v_stage.max_attempts then
      v_stage_status := 'retryable';
      v_run_status := 'queued';
    else
      v_stage_status := 'failed';
      v_run_status := 'failed';
    end if;

    update private.pipeline_stage_attempts
    set status = 'interrupted', retryable = (v_stage_status = 'retryable'),
      error_code = 'lease-expired', error_message = 'The worker lease expired before completion.',
      completed_at = now(), heartbeat_at = now()
    where stage_id = v_stage.id and status = 'claimed';
    update private.pipeline_flow_stages
    set status = v_stage_status, lease_owner = null, lease_expires_at = null,
      error_code = 'lease-expired', error_message = 'The worker lease expired before completion.',
      completed_at = case when v_stage_status = 'failed' then now() else null end,
      updated_at = now()
    where id = v_stage.id;
    update private.pipeline_flow_runs
    set status = v_run_status, current_stage_key = v_stage.stage_key,
      error_code = 'lease-expired', error_message = 'A pipeline stage lease expired.',
      completed_at = case when v_run_status = 'failed' then now() else null end,
      updated_at = now()
    where id = v_stage.flow_run_id;
    insert into private.pipeline_run_events (
      flow_run_id, stage_id, event_type, safe_message, details
    ) values (
      v_stage.flow_run_id, v_stage.id, 'stale-recovered',
      'An expired stage lease was recovered.',
      jsonb_build_object('nextStatus', v_stage_status)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function private.guard_pipeline_flow_run_structure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    or new.definition_key is distinct from old.definition_key
    or new.definition_version is distinct from old.definition_version
    or new.definition_checksum is distinct from old.definition_checksum
    or new.correlation_id is distinct from old.correlation_id
    or new.launch_kind is distinct from old.launch_kind
    or new.idempotency_key is distinct from old.idempotency_key
    or new.input_fingerprint is distinct from old.input_fingerprint
    or new.exact_inputs is distinct from old.exact_inputs
    or new.actor_owner_id is distinct from old.actor_owner_id
    or new.actor_email is distinct from old.actor_email
    or new.parent_run_id is distinct from old.parent_run_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Pipeline flow launch lineage is immutable.';
  end if;
  if old.status in ('succeeded', 'cancelled') and new is distinct from old then
    raise exception 'Completed pipeline flow runs are immutable.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_pipeline_flow_stage_structure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    or new.flow_run_id is distinct from old.flow_run_id
    or new.stage_key is distinct from old.stage_key
    or new.stage_index is distinct from old.stage_index
    or new.stage_kind is distinct from old.stage_kind
    or new.effect_key is distinct from old.effect_key
    or new.exact_inputs is distinct from old.exact_inputs
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Pipeline stage lineage is immutable.';
  end if;
  if old.status in ('succeeded', 'skipped') and new is distinct from old then
    raise exception 'Completed pipeline stages are immutable.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_pipeline_stage_attempt_structure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    or new.flow_run_id is distinct from old.flow_run_id
    or new.stage_id is distinct from old.stage_id
    or new.attempt_number is distinct from old.attempt_number
    or new.worker_id is distinct from old.worker_id
    or new.effect_key is distinct from old.effect_key
    or new.started_at is distinct from old.started_at
  then
    raise exception 'Pipeline stage attempt history is append-only.';
  end if;
  if old.status <> 'claimed' and new is distinct from old then
    raise exception 'Completed pipeline stage attempts are immutable.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_pipeline_run_event_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Pipeline run events are append-only.';
end;
$$;

create trigger pipeline_flow_runs_structure_guard
before update or delete on private.pipeline_flow_runs
for each row execute function private.guard_pipeline_flow_run_structure();

create trigger pipeline_flow_stages_structure_guard
before update or delete on private.pipeline_flow_stages
for each row execute function private.guard_pipeline_flow_stage_structure();

create trigger pipeline_stage_attempts_structure_guard
before update or delete on private.pipeline_stage_attempts
for each row execute function private.guard_pipeline_stage_attempt_structure();

create trigger pipeline_run_events_append_only_guard
before update or delete on private.pipeline_run_events
for each row execute function private.guard_pipeline_run_event_append_only();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'pipeline_flow_runs', 'pipeline_flow_stages', 'pipeline_stage_attempts',
    'pipeline_run_events', 'pipeline_schedule_states'
  ] loop
    execute format('alter table private.%I enable row level security', table_name);
    execute format('revoke all on private.%I from public, anon, authenticated', table_name);
    execute format('grant all on private.%I to service_role', table_name);
  end loop;
end;
$$;

revoke all on sequence private.pipeline_run_events_id_seq from public, anon, authenticated;
grant usage, select on sequence private.pipeline_run_events_id_seq to service_role;

revoke all on function private.claim_pipeline_stage(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function private.update_pipeline_stage_progress(uuid, text, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function private.complete_pipeline_stage(uuid, text, text, jsonb, jsonb, integer)
  from public, anon, authenticated;
revoke all on function private.fail_pipeline_stage(uuid, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function private.resume_pipeline_review(uuid, text, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function private.retry_pipeline_stage(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function private.recover_stale_pipeline_stages(uuid)
  from public, anon, authenticated;
revoke all on function private.guard_pipeline_flow_run_structure()
  from public, anon, authenticated;
revoke all on function private.guard_pipeline_flow_stage_structure()
  from public, anon, authenticated;
revoke all on function private.guard_pipeline_stage_attempt_structure()
  from public, anon, authenticated;
revoke all on function private.guard_pipeline_run_event_append_only()
  from public, anon, authenticated;

grant execute on function private.claim_pipeline_stage(uuid, text, integer) to service_role;
grant execute on function private.update_pipeline_stage_progress(uuid, text, integer, integer, integer) to service_role;
grant execute on function private.complete_pipeline_stage(uuid, text, text, jsonb, jsonb, integer) to service_role;
grant execute on function private.fail_pipeline_stage(uuid, text, text, text, boolean) to service_role;
grant execute on function private.resume_pipeline_review(uuid, text, text, text, text, boolean) to service_role;
grant execute on function private.retry_pipeline_stage(uuid, text, text, text) to service_role;
grant execute on function private.recover_stale_pipeline_stages(uuid) to service_role;
