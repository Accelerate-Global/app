begin;

create extension if not exists pgtap with schema extensions;

select plan(34);

select is(
  (
    select count(*)::bigint
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname in (
        'pipeline_flow_runs', 'pipeline_flow_stages',
        'pipeline_stage_attempts', 'pipeline_run_events',
        'pipeline_schedule_states'
      )
      and pg_class.relkind = 'r'
  ),
  5::bigint,
  'durable pipeline coordination tables exist'
);

select is(
  (
    select count(*)::bigint
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname in (
        'pipeline_flow_runs', 'pipeline_flow_stages',
        'pipeline_stage_attempts', 'pipeline_run_events',
        'pipeline_schedule_states'
      )
      and pg_class.relrowsecurity
  ),
  5::bigint,
  'all coordination tables have RLS enabled'
);

select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name in (
        'pipeline_flow_runs', 'pipeline_flow_stages',
        'pipeline_stage_attempts', 'pipeline_run_events',
        'pipeline_schedule_states'
      )
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0::bigint,
  'browser roles cannot access coordinator storage'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.claim_pipeline_stage(uuid,text,integer)',
    'EXECUTE'
  ),
  'browser roles cannot claim pipeline stages'
);

insert into private.pipeline_flow_runs (
  id, definition_key, definition_version, definition_checksum, launch_kind,
  idempotency_key, input_fingerprint, exact_inputs, actor_owner_id,
  progress_total
) values (
  '87000000-0000-4000-8000-000000000001',
  'source-test', 'v1', repeat('a', 64), 'manual', 'source-test:request-1',
  repeat('b', 64), '{"connectionId":"87000000-0000-4000-8000-000000000099"}',
  'pipeline-test-admin', 3
);

insert into private.pipeline_flow_stages (
  id, flow_run_id, stage_key, stage_index, stage_kind, effect_key,
  status, max_attempts, progress_total, exact_inputs
) values
  (
    '87000000-0000-4000-8000-000000000011',
    '87000000-0000-4000-8000-000000000001',
    'ingest', 0, 'ingestion', 'source-ingestion', 'queued', 3, 2, '{}'
  ),
  (
    '87000000-0000-4000-8000-000000000012',
    '87000000-0000-4000-8000-000000000001',
    'review', 1, 'review', 'manual-review', 'blocked', 1, 1, '{}'
  ),
  (
    '87000000-0000-4000-8000-000000000013',
    '87000000-0000-4000-8000-000000000001',
    'publish', 2, 'publication', 'source-publish', 'blocked', 3, 1, '{}'
  );

select throws_ok(
  $$
    insert into private.pipeline_flow_runs (
      definition_key, definition_version, definition_checksum, launch_kind,
      idempotency_key, input_fingerprint, exact_inputs, actor_owner_id
    ) values (
      'source-test', 'v1', repeat('a', 64), 'manual',
      'source-test:request-1', repeat('b', 64), '{}', 'pipeline-test-admin'
    )
  $$,
  '23505',
  null,
  'duplicate launch idempotency keys are rejected'
);

select is(
  (
    select stage_key
    from private.claim_pipeline_stage(
      '87000000-0000-4000-8000-000000000001', 'worker-one', 60
    )
  ),
  'ingest',
  'the first runnable stage is claimed'
);

select is(
  (
    select count(*)::bigint
    from private.claim_pipeline_stage(
      '87000000-0000-4000-8000-000000000001', 'worker-two', 60
    )
  ),
  0::bigint,
  'a duplicate continuation cannot claim the active stage'
);

select is(
  (
    select status || ':' || attempt_count::text
    from private.pipeline_flow_stages
    where id = '87000000-0000-4000-8000-000000000011'
  ),
  'claimed:1',
  'the claim records one durable attempt'
);

select ok(
  private.update_pipeline_stage_progress(
    (
      select id from private.pipeline_stage_attempts
      where stage_id = '87000000-0000-4000-8000-000000000011'
    ),
    'worker-one', 1, 2, 60
  ),
  'the current lease owner can checkpoint progress'
);

select is(
  private.complete_pipeline_stage(
    (
      select id from private.pipeline_stage_attempts
      where stage_id = '87000000-0000-4000-8000-000000000011'
    ),
    'worker-one', 'succeeded', '{"apiConnectionRunId":"run-1"}', '{}', 12
  ),
  'queued',
  'completing ingestion queues the next stage'
);

select is(
  (
    select status from private.pipeline_flow_stages
    where id = '87000000-0000-4000-8000-000000000012'
  ),
  'queued',
  'the explicit review stage becomes runnable'
);

select is(
  (
    select stage_key
    from private.claim_pipeline_stage(
      '87000000-0000-4000-8000-000000000001', 'review-worker', 60
    )
  ),
  'review',
  'the review stage is claimed once'
);

select is(
  private.complete_pipeline_stage(
    (
      select id from private.pipeline_stage_attempts
      where stage_id = '87000000-0000-4000-8000-000000000012'
    ),
    'review-worker', 'awaiting_review', '{"reviewGate":"review"}', '{}', null
  ),
  'awaiting_review',
  'a review gate pauses the flow'
);

select is(
  (
    select status from private.pipeline_flow_runs
    where id = '87000000-0000-4000-8000-000000000001'
  ),
  'awaiting_review',
  'the durable run reports review required'
);

select is(
  private.resume_pipeline_review(
    '87000000-0000-4000-8000-000000000001', 'review',
    'pipeline-test-admin', 'approve', 'Reviewed source findings', true
  ),
  'queued',
  'an authorized explicit approval resumes the flow'
);

select ok(
  (
    select output @> '{"approved":true,"warningsAcknowledged":true}'::jsonb
    from private.pipeline_flow_stages
    where id = '87000000-0000-4000-8000-000000000012'
  ),
  'the review decision and warning acknowledgement are retained'
);

select is(
  (
    select stage_key
    from private.claim_pipeline_stage(
      '87000000-0000-4000-8000-000000000001', 'publish-worker', 60
    )
  ),
  'publish',
  'publication starts only after review approval'
);

select is(
  private.complete_pipeline_stage(
    (
      select id from private.pipeline_stage_attempts
      where stage_id = '87000000-0000-4000-8000-000000000013'
    ),
    'publish-worker', 'succeeded', '{"datasetId":"dataset-1"}', '{}', 12
  ),
  'succeeded',
  'the final publication stage completes the flow'
);

select is(
  (
    select status from private.pipeline_flow_runs
    where id = '87000000-0000-4000-8000-000000000001'
  ),
  'succeeded',
  'the completed flow is durably successful'
);

select throws_ok(
  $$
    update private.pipeline_run_events
    set safe_message = 'changed'
    where flow_run_id = '87000000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  null,
  'run events are append-only'
);

insert into private.pipeline_flow_runs (
  id, definition_key, definition_version, definition_checksum, launch_kind,
  idempotency_key, input_fingerprint, exact_inputs, actor_owner_id,
  progress_total
) values (
  '87000000-0000-4000-8000-000000000002',
  'retry-test', 'v1', repeat('c', 64), 'manual', 'retry-test:request-1',
  repeat('d', 64), '{}', 'pipeline-test-admin', 1
);

insert into private.pipeline_flow_stages (
  id, flow_run_id, stage_key, stage_index, stage_kind, effect_key,
  status, max_attempts, progress_total, exact_inputs
) values (
  '87000000-0000-4000-8000-000000000021',
  '87000000-0000-4000-8000-000000000002',
  'work', 0, 'forming', 'test-work', 'queued', 2, 1, '{}'
);

select is(
  (
    select attempt_number
    from private.claim_pipeline_stage(
      '87000000-0000-4000-8000-000000000002', 'stale-worker-one', 60
    )
  ),
  1,
  'the retry fixture records its first attempt'
);

update private.pipeline_flow_stages
set lease_expires_at = now() - interval '1 second'
where id = '87000000-0000-4000-8000-000000000021';
update private.pipeline_stage_attempts
set lease_expires_at = now() - interval '1 second'
where stage_id = '87000000-0000-4000-8000-000000000021' and status = 'claimed';

select is(
  private.recover_stale_pipeline_stages(
    '87000000-0000-4000-8000-000000000002'
  ),
  1,
  'one expired lease is recovered'
);

select is(
  (
    select status from private.pipeline_stage_attempts
    where stage_id = '87000000-0000-4000-8000-000000000021'
      and attempt_number = 1
  ),
  'interrupted',
  'stale recovery retains the interrupted attempt'
);

select is(
  (
    select attempt_number
    from private.claim_pipeline_stage(
      '87000000-0000-4000-8000-000000000002', 'stale-worker-two', 60
    )
  ),
  2,
  'the recovered stage receives a distinct second attempt'
);

update private.pipeline_flow_stages
set lease_expires_at = now() - interval '1 second'
where id = '87000000-0000-4000-8000-000000000021';
update private.pipeline_stage_attempts
set lease_expires_at = now() - interval '1 second'
where stage_id = '87000000-0000-4000-8000-000000000021' and status = 'claimed';

select is(
  private.recover_stale_pipeline_stages(
    '87000000-0000-4000-8000-000000000002'
  ),
  1,
  'the exhausted second lease is recovered once'
);

select is(
  (
    select status || ':' || error_code
    from private.pipeline_flow_runs
    where id = '87000000-0000-4000-8000-000000000002'
  ),
  'failed:lease-expired',
  'exhausted stale attempts fail the flow with a safe reason'
);

select ok(
  private.retry_pipeline_stage(
    '87000000-0000-4000-8000-000000000002', 'work',
    'pipeline-test-admin', 'Provider recovered'
  ),
  'an administrator can explicitly authorize one more attempt'
);

select is(
  (
    select attempt_number
    from private.claim_pipeline_stage(
      '87000000-0000-4000-8000-000000000002', 'manual-retry-worker', 60
    )
  ),
  3,
  'manual retry preserves prior attempts and creates the next number'
);

select is(
  private.fail_pipeline_stage(
    (
      select id from private.pipeline_stage_attempts
      where stage_id = '87000000-0000-4000-8000-000000000021'
        and status = 'claimed'
    ),
    'manual-retry-worker', 'invalid-input',
    'The exact input is no longer usable.', false
  ),
  'failed',
  'a non-retryable stage failure terminates the run'
);

select throws_ok(
  $$
    insert into private.pipeline_schedule_states (
      definition_key, enabled, interval_minutes
    ) values ('source-test', true, 1440)
  $$,
  '23514',
  null,
  'schedules cannot be enabled without verified manual canary evidence'
);

select ok(
  has_function_privilege(
    'service_role',
    'private.claim_pipeline_stage(uuid,text,integer)',
    'EXECUTE'
  ),
  'the service role can execute coordinator claims'
);

select throws_ok(
  $$
    update private.pipeline_flow_runs
    set error_message = 'changed'
    where id = '87000000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  null,
  'successful flow lineage is immutable'
);

select is(
  (
    select count(*)::integer
    from private.pipeline_stage_attempts
    where flow_run_id = '87000000-0000-4000-8000-000000000002'
  ),
  3,
  'all retry and interrupted attempts remain inspectable'
);

select ok(
  (
    select count(*) >= 6
    from private.pipeline_run_events
    where flow_run_id = '87000000-0000-4000-8000-000000000001'
  ),
  'the successful flow retains an operational event timeline'
);

select * from finish();

rollback;
