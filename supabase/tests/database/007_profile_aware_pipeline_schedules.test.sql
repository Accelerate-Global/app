begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_column(
  'private',
  'pipeline_schedule_states',
  'source_profile_id',
  'pipeline schedules persist an exact optional source profile'
);

insert into private.api_connections (
  id, name, description, method, url, request_headers, secret_header_names,
  body_template, response_format, response_data_path, import_mode,
  dataset_name, dataset_classification, provider, provider_config,
  created_by_owner_id, updated_by_owner_id
) values
(
  '93000000-0000-4000-8000-000000000001', 'Scheduled Partner One', '', 'GET',
  'https://docs.google.com/spreadsheets/d/scheduled-one/edit', '[]'::jsonb, '[]'::jsonb,
  '', 'csv', '', 'create', 'scheduled-one.csv', 'PGIC', 'google_sheets',
  '{"provider":"google_sheets","spreadsheetId":"scheduled-one","spreadsheetUrl":"https://docs.google.com/spreadsheets/d/scheduled-one/edit","spreadsheetTitle":"One","sheetId":1,"sheetTitle":"Engagement","rangeMode":"full_tab"}'::jsonb,
  'schedule-test-admin', 'schedule-test-admin'
),
(
  '93000000-0000-4000-8000-000000000002', 'Scheduled Partner Two', '', 'GET',
  'https://docs.google.com/spreadsheets/d/scheduled-two/edit', '[]'::jsonb, '[]'::jsonb,
  '', 'csv', '', 'create', 'scheduled-two.csv', 'PGIC', 'google_sheets',
  '{"provider":"google_sheets","spreadsheetId":"scheduled-two","spreadsheetUrl":"https://docs.google.com/spreadsheets/d/scheduled-two/edit","spreadsheetTitle":"Two","sheetId":2,"sheetTitle":"Engagement","rangeMode":"full_tab"}'::jsonb,
  'schedule-test-admin', 'schedule-test-admin'
);

insert into private.tier2_partner_profiles (
  id, profile_key, partner_key, display_name, api_connection_id,
  spreadsheet_id, sheet_id, sheet_title, stable_row_key_column,
  tracking_id_column, tracking_id_source, source_rop3_column,
  contract_version, contract_checksum, created_by_owner_id, updated_by_owner_id
) values
(
  '91000000-0000-4000-8000-000000000001', 'scheduled-partner-one',
  'scheduled-one', 'Scheduled Partner One',
  '93000000-0000-4000-8000-000000000001', 'scheduled-one', 1,
  'Engagement', 'Partner Row ID', 'PeopleID3', 'peopleid3', 'ROP3',
  'v1', repeat('a', 64), 'schedule-test-admin', 'schedule-test-admin'
),
(
  '91000000-0000-4000-8000-000000000002', 'scheduled-partner-two',
  'scheduled-two', 'Scheduled Partner Two',
  '93000000-0000-4000-8000-000000000002', 'scheduled-two', 2,
  'Engagement', 'Partner Row ID', 'PeopleID3', 'peopleid3', 'ROP3',
  'v1', repeat('b', 64), 'schedule-test-admin', 'schedule-test-admin'
);

insert into private.pipeline_flow_runs (
  id, definition_key, definition_version, definition_checksum, launch_kind,
  idempotency_key, input_fingerprint, exact_inputs, status,
  actor_owner_id, progress_total, completed_at
) values
(
  '92000000-0000-4000-8000-000000000001', 'tier2-partner', 'v1',
  repeat('c', 64), 'manual', 'profile-canary-one', repeat('d', 64),
  '{"profileId":"91000000-0000-4000-8000-000000000001"}'::jsonb,
  'succeeded', 'schedule-test-admin', 0, now()
),
(
  '92000000-0000-4000-8000-000000000002', 'tier2-partner', 'v1',
  repeat('c', 64), 'manual', 'profile-canary-two', repeat('e', 64),
  '{"profileId":"91000000-0000-4000-8000-000000000002"}'::jsonb,
  'succeeded', 'schedule-test-admin', 0, now()
);

select lives_ok(
  $$
    insert into private.pipeline_schedule_states (
      definition_key, source_profile_id, enabled, interval_minutes,
      manual_canary_run_id, manual_canary_verified_at, manual_canary_verified_by
    ) values
    (
      'tier2-partner', '91000000-0000-4000-8000-000000000001', true, 1440,
      '92000000-0000-4000-8000-000000000001', now(), 'schedule-test-admin'
    ),
    (
      'tier2-partner', '91000000-0000-4000-8000-000000000002', true, 2880,
      '92000000-0000-4000-8000-000000000002', now(), 'schedule-test-admin'
    )
  $$,
  'two active partner profiles can retain independent schedules and canaries'
);

select is(
  (
    select count(*)::integer
    from private.pipeline_schedule_states
    where definition_key = 'tier2-partner'
  ),
  2,
  'profile-aware schedule identity preserves both partner rows'
);

select throws_ok(
  $$
    insert into private.pipeline_schedule_states (
      definition_key, source_profile_id, enabled, interval_minutes,
      manual_canary_run_id, manual_canary_verified_at, manual_canary_verified_by
    ) values (
      'tier2-partner', '91000000-0000-4000-8000-000000000001', true, 1440,
      '92000000-0000-4000-8000-000000000001', now(), 'schedule-test-admin'
    )
  $$,
  '23505',
  null,
  'one profile cannot have two competing schedules for the same definition'
);

select throws_ok(
  $$
    insert into private.pipeline_schedule_states (
      definition_key, enabled, interval_minutes,
      manual_canary_run_id, manual_canary_verified_at, manual_canary_verified_by
    ) values (
      'tier2-partner', true, 1440,
      '92000000-0000-4000-8000-000000000001', now(), 'schedule-test-admin'
    )
  $$,
  '23514',
  null,
  'Tier 2 partner schedules require an exact source profile'
);

select throws_ok(
  $$
    insert into private.pipeline_schedule_states (
      definition_key, source_profile_id, enabled, interval_minutes,
      manual_canary_run_id, manual_canary_verified_at, manual_canary_verified_by
    ) values (
      'source-imb-people-groups', '91000000-0000-4000-8000-000000000001', true, 1440,
      '92000000-0000-4000-8000-000000000001', now(), 'schedule-test-admin'
    )
  $$,
  '23514',
  null,
  'definitions that are not profile-scoped cannot retain a partner profile'
);

select throws_ok(
  $$
    insert into private.pipeline_schedule_states (
      definition_key, enabled, interval_minutes
    ) values ('source-imb-people-groups', false, 60)
  $$,
  '23514',
  null,
  'sub-daily schedules are rejected by the database contract'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'private.pipeline_schedule_states',
    'SELECT'
  ),
  'profile-aware schedules remain inaccessible to browser roles'
);

select * from finish();

rollback;
