begin;

create extension if not exists pgtap with schema extensions;

select plan(38);

select has_table(
  'private', 'ax_identity_graph_commit_sessions',
  'legacy graph commits use a transaction-scoped authorization session'
);
select has_function(
  'private', 'begin_legacy_ax_identity_graph_commit',
  array['uuid', 'text', 'text'],
  'legacy graph commit authorization has one explicit entry point'
);
select has_function(
  'private', 'finalize_legacy_ax_identity_graph_import',
  array['uuid', 'text', 'text', 'text', 'text', 'text'],
  'legacy graph finalization requires the same fingerprint and raw token'
);
select ok(
  not has_table_privilege(
    'service_role', 'private.ax_identity_graph_commit_sessions', 'SELECT'
  ),
  'service code cannot forge or inspect transaction authorization sessions'
);
select is(
  (select public from storage.buckets where id = 'identity-registry-evidence'),
  false,
  'legacy import evidence uses a dedicated private bucket'
);
select is(
  private.ax_identity_canonical_jsonb('{"z":1,"a":{"y":2,"x":3}}'::jsonb),
  '{"a":{"x":3,"y":2},"z":1}',
  'database graph hashing uses the same canonical JSON key order as the importer'
);

insert into private.api_connections (
  id, name, description, method, url, request_headers, secret_header_names,
  body_template, response_format, response_data_path, import_mode,
  dataset_name, dataset_classification, provider, provider_config,
  created_by_owner_id, updated_by_owner_id
) values (
  '88000000-0000-4000-8000-000000000001', 'Legacy cutover partner', '', 'GET',
  'https://docs.google.com/spreadsheets/d/tier2-cutover/edit',
  '[]'::jsonb, '[]'::jsonb, '', 'csv', '', 'create', 'tier2-cutover.csv',
  'PGIC', 'google_sheets',
  '{"provider":"google_sheets","spreadsheetId":"tier2-cutover","spreadsheetUrl":"https://docs.google.com/spreadsheets/d/tier2-cutover/edit","spreadsheetTitle":"Cutover","sheetId":42,"sheetTitle":"Engagement","rangeMode":"full_tab"}'::jsonb,
  'cutover-test', 'cutover-test'
);

insert into private.tier2_partner_profiles (
  id, profile_key, partner_key, display_name, api_connection_id,
  spreadsheet_id, sheet_id, sheet_title, stable_row_key_column,
  tracking_id_column, tracking_id_source, source_rop3_column,
  source_country_column, source_iso3_column, contract_version,
  contract_checksum, created_by_owner_id, updated_by_owner_id
) values (
  '88000000-0000-4000-8000-000000000002', 'partner-cutover', 'cutover',
  'Legacy cutover partner', '88000000-0000-4000-8000-000000000001',
  'tier2-cutover', 42, 'Engagement', 'Partner Row ID', 'ROP3', 'rop3',
  'ROP3', 'Country', 'ISO3', 'v1', repeat('a', 64),
  'cutover-test', 'cutover-test'
);

do $setup$
declare
  import_id constant uuid := '88000000-0000-4000-8000-000000000003';
  raw_token constant text := 'reviewed-cutover-token';
  graph_checksum text;
  audit_checksum text;
  audit_artifact_checksum text;
  report_checksum text;
  report jsonb;
  audit_record jsonb;
  artifact_key text;
  artifact_checksum text;
  artifact_path text;
begin
  graph_checksum := encode(extensions.digest(
    'parents' || chr(10) || private.ax_identity_canonical_jsonb(jsonb_build_object(
      'canonicalCode', '10-zz-100001', 'allocatedValue', null,
      'rop3Component', '100001'
    )) || chr(10) ||
    'children' || chr(10) || private.ax_identity_canonical_jsonb(jsonb_build_object(
      'canonicalCode', '10-zz-100001-LAO',
      'parentCanonicalCode', '10-zz-100001', 'normalizedIso3', 'LAO'
    )) || chr(10) ||
    'aliases' || chr(10) ||
    'bindings' || chr(10) || private.ax_identity_canonical_jsonb(jsonb_build_object(
      'sourceProfileKey', 'partner-cutover',
      'stableRowKey', 'partner-cutover:sheet-42:legacy-1',
      'identityCanonicalCode', '10-zz-100001-LAO',
      'sourcePgacCode', '10-zz-100001',
      'sourcePgicCode', '10-zz-100001-LAO',
      'tier2Component', 'spreadsheet:tier2-cutover'
    )) || chr(10), 'sha256'
  ), 'hex');
  audit_record := jsonb_build_object(
    'auditKind', 'cross-ledger-mismatch',
    'sourceFileKey', 'sharedRop3Ledger',
    'stableRowKeyHash', repeat('1', 64),
    'details', jsonb_build_object('resolution', 'rop3-semantic-precedence')
  );
  audit_checksum := encode(extensions.digest(
    'audits' || chr(10) || private.ax_identity_canonical_jsonb(audit_record) || chr(10),
    'sha256'
  ), 'hex');
  audit_artifact_checksum := encode(extensions.digest(
    private.ax_identity_canonical_jsonb(jsonb_build_array(audit_record)), 'sha256'
  ), 'hex');
  report := jsonb_build_object(
    'schemaVersion', 1,
    'blocking', false,
    'blockingReasons', '[]'::jsonb,
    'graphChecksum', graph_checksum,
    'graph', jsonb_build_object(
      'bindings', 1, 'pgacIdentities', 1, 'pgicIdentities', 1,
      'identities', 2, 'aliases', 0, 'allocationCounterFloor', 2055
    ),
    'audit', jsonb_build_object(
      'records', 1, 'checksum', audit_checksum,
      'artifactChecksum', audit_artifact_checksum,
      'decisions', jsonb_build_array(audit_record)
    ),
    'bindingTranslation', jsonb_build_object(
      'algorithmVersion', 'source-forming-runtime-stable-row-key-v1',
      'status', 'verified-pinned-source-crosswalk',
      'present', true, 'rawBindingCount', 1,
      'selectedActiveBindingCount', 1, 'historicalUnboundCount', 0,
      'sha256', repeat('4', 64)
    ),
    'tier2Components', jsonb_build_array(jsonb_build_object(
      'component', 'spreadsheet:tier2-cutover',
      'observedRowCount', 1, 'expectedRowCount', 1,
      'profileKey', 'partner-cutover', 'mapped', true,
      'databaseProfile', jsonb_build_object(
        'partnerKey', 'cutover', 'spreadsheetId', 'tier2-cutover',
        'sheetId', 42, 'contractVersion', 'v1',
        'contractChecksum', repeat('a', 64),
        'apiConnectionId', '88000000-0000-4000-8000-000000000001',
        'connectionProvider', 'google_sheets',
        'connectionSpreadsheetId', 'tier2-cutover',
        'connectionSheetId', 42
      )
    ))
  );
  report_checksum := encode(extensions.digest(
    private.ax_identity_canonical_jsonb(report), 'sha256'
  ), 'hex');

  insert into private.ax_identity_legacy_imports (
    id, input_fingerprint, snapshot_manifest, status, finding_count,
    actor_owner_id, reason, import_kind, state_fingerprint, graph_checksum,
    report_checksum, manifest_checksum, dry_run_token_hash, report,
    dry_run_completed_at
  ) values (
    import_id, repeat('2', 64), '{}'::jsonb, 'dry-run', 0,
    'cutover-test', 'Verified cutover dry-run', 'verified-identity-graph',
    private.ax_identity_registry_state_fingerprint(), graph_checksum,
    report_checksum, repeat('3', 64),
    encode(extensions.digest(raw_token, 'sha256'), 'hex'), report, now()
  );

  foreach artifact_key in array array[
    'shared-uuid-ledger', 'tier1-uuid-ledger', 'tier2-uuid-ledger',
    'shared-rop3-ledger', 'tier2-rop3-ledger',
    'binding-translation', 'audit-report', 'manifest', 'report'
  ] loop
    artifact_checksum := case artifact_key
      when 'audit-report' then audit_artifact_checksum
      when 'report' then report_checksum
      when 'manifest' then repeat('3', 64)
      when 'binding-translation' then repeat('4', 64)
      else encode(extensions.digest(artifact_key, 'sha256'), 'hex')
    end;
    artifact_path := 'identity-registry-legacy-imports/' || repeat('2', 64) ||
      '/' || artifact_key || '.json';
    insert into storage.objects (bucket_id, name, metadata)
    values ('identity-registry-evidence', artifact_path, '{}'::jsonb);
    insert into private.ax_identity_artifacts (
      legacy_import_id, artifact_kind, artifact_key,
      storage_path, content_checksum, size_bytes
    ) values (
      import_id,
      case when artifact_key like '%ledger' or artifact_key = 'binding-translation'
        then 'snapshot' else 'report' end,
      artifact_key, artifact_path, artifact_checksum, 1
    );
  end loop;
end
$setup$;

create or replace function pg_temp.stage_legacy_cutover_graph(
  p_child_iso3 text,
  p_include_audit boolean
)
returns void
language plpgsql
as $$
declare
  import_id constant uuid := '88000000-0000-4000-8000-000000000003';
  parent_id uuid := gen_random_uuid();
  child_id uuid := gen_random_uuid();
  child_code text := '10-zz-100001-' || p_child_iso3;
begin
  insert into private.ax_identities (
    id, namespace, identity_kind, rop3_component, lifecycle_state,
    created_by_import_id, activated_at
  ) values (
    parent_id, 'people-groups', 'pgac', '100001', 'active', import_id, now()
  );
  insert into private.ax_identities (
    id, namespace, identity_kind, parent_identity_id, normalized_iso3,
    lifecycle_state, created_by_import_id, activated_at
  ) values (
    child_id, 'people-groups', 'pgic', parent_id, p_child_iso3,
    'active', import_id, now()
  );
  insert into private.ax_identity_codes (
    identity_id, code, code_kind, lifecycle_state, created_by_import_id
  ) values
    (parent_id, '10-zz-100001', 'canonical', 'active', import_id),
    (child_id, child_code, 'canonical', 'active', import_id);
  insert into private.ax_identity_source_bindings (
    source_profile_key, stable_row_key, identity_id, legacy_import_id,
    binding_state, source_pgac_code, source_pgic_code, legacy_component, activated_at
  ) values (
    'partner-cutover', 'partner-cutover:sheet-42:legacy-1', child_id, import_id,
    'active', '10-zz-100001', child_code,
    'spreadsheet:tier2-cutover', now()
  );
  if p_include_audit then
    insert into private.ax_identity_legacy_import_audits (
      legacy_import_id, audit_kind, source_file_key, stable_row_key_hash, details
    ) values (
      import_id, 'cross-ledger-mismatch', 'sharedRop3Ledger', repeat('1', 64),
      '{"resolution":"rop3-semantic-precedence"}'::jsonb
    );
  end if;
end;
$$;

select throws_ok(
  $$ select private.finalize_legacy_ax_identity_graph_import(
    '88000000-0000-4000-8000-000000000003', repeat('2', 64),
    'reviewed-cutover-token', 'cutover-test', null, 'Direct finalize'
  ) $$,
  '55000',
  'The verified legacy AX graph must begin and finalize in one authorized transaction.',
  'finalization cannot bypass the transaction-bound begin handshake'
);

select throws_ok(
  $$ insert into private.ax_identities (
    namespace, identity_kind, rop3_component, lifecycle_state, created_by_import_id
  ) values (
    'people-groups', 'pgac', '100001', 'active',
    '88000000-0000-4000-8000-000000000003'
  ) $$,
  '23514',
  'An authorized legacy AX graph commit session is required for imported identities.',
  'direct pre-cutover graph staging is rejected'
);

select throws_ok(
  $$ select private.begin_legacy_ax_identity_graph_commit(
    '88000000-0000-4000-8000-000000000003', repeat('2', 64), 'wrong-token'
  ) $$,
  '22023',
  'The verified legacy AX dry-run fingerprint or token does not match.',
  'a stored token hash is not a replayable commit credential'
);

select throws_ok(
  $direct_committed_import$
    do $test$
    begin
      insert into private.ax_registry_revisions (
        id, content_checksum, binding_count, actor_owner_id, reason
      ) values (
        '88000000-0000-4000-8000-000000000004', repeat('5', 64), 0,
        'cutover-test', 'Synthetic committed import fixture'
      );
      insert into private.ax_identity_legacy_imports (
        id, input_fingerprint, snapshot_manifest, status, registry_revision_id,
        actor_owner_id, reason, committed_at, import_kind, state_fingerprint,
        graph_checksum, report_checksum, manifest_checksum, dry_run_token_hash,
        report, dry_run_completed_at
      ) values (
        '88000000-0000-4000-8000-000000000005', repeat('6', 64), '{}'::jsonb,
        'committed', '88000000-0000-4000-8000-000000000004',
        'cutover-test', 'Synthetic committed import fixture', now(),
        'verified-identity-graph', repeat('7', 64), repeat('8', 64),
        repeat('9', 64), repeat('a', 64), repeat('b', 64),
        '{"blocking":false}'::jsonb, now()
      );
    end
    $test$
  $direct_committed_import$,
  '55000',
  'Verified legacy AX imports must begin as blocked or dry-run evidence.',
  'the table owner cannot insert synthetic committed verified import authority'
);

select throws_ok(
  $import_kind_escalation$
    do $test$
    begin
      insert into private.ax_identity_legacy_imports (
        id, input_fingerprint, snapshot_manifest, status, actor_owner_id, reason
      ) values (
        '88000000-0000-4000-8000-000000000006', repeat('c', 64), '{}'::jsonb,
        'dry-run', 'cutover-test', 'Flat import escalation fixture'
      );
      update private.ax_identity_legacy_imports
      set import_kind = 'verified-identity-graph'
      where id = '88000000-0000-4000-8000-000000000006';
    end
    $test$
  $import_kind_escalation$,
  '55000',
  'Legacy AX import kind is immutable.',
  'a flat import cannot be escalated into verified graph authority'
);

select throws_ok(
  $owner_cutover_without_session$
    do $test$
    begin
      insert into private.ax_registry_revisions (
        id, content_checksum, binding_count, actor_owner_id, reason
      ) values (
        '88000000-0000-4000-8000-000000000007', repeat('d', 64), 0,
        'cutover-test', 'Unauthorized owner cutover fixture'
      );
      insert into private.ax_identity_registry_cutovers (
        namespace, legacy_import_id, registry_revision_id, input_fingerprint,
        graph_checksum, report_checksum, actor_owner_id, reason
      ) values (
        'people-groups', '88000000-0000-4000-8000-000000000003',
        '88000000-0000-4000-8000-000000000007', repeat('2', 64),
        repeat('3', 64), repeat('4', 64), 'cutover-test',
        'Unauthorized owner cutover fixture'
      );
    end
    $test$
  $owner_cutover_without_session$,
  '23514',
  'The AX cutover marker does not match its authorized finalizer session.',
  'the table owner cannot insert a cutover marker without an authorized session'
);

select throws_ok(
  $state_drift$
    do $test$
    begin
      update private.tier2_partner_profiles
      set active = false
      where profile_key = 'partner-cutover';
      perform private.begin_legacy_ax_identity_graph_commit(
        '88000000-0000-4000-8000-000000000003', repeat('2', 64),
        'reviewed-cutover-token'
      );
    end
    $test$
  $state_drift$,
  '40001',
  'The AX identity registry changed after the verified dry-run.',
  'database state drift invalidates the reviewed token'
);

select throws_ok(
  $connection_drift$
    do $test$
    begin
      update private.api_connections
      set archived_at = now(), archived_by_owner_id = 'cutover-test',
        archive_reason = 'Disconnect after dry-run'
      where id = '88000000-0000-4000-8000-000000000001';
      perform private.begin_legacy_ax_identity_graph_commit(
        '88000000-0000-4000-8000-000000000003', repeat('2', 64),
        'reviewed-cutover-token'
      );
    end
    $test$
  $connection_drift$,
  '40001',
  'The AX identity registry changed after the verified dry-run.',
  'disconnecting a mapped source connection invalidates the reviewed token'
);

select is(
  private.begin_legacy_ax_identity_graph_commit(
    '88000000-0000-4000-8000-000000000003', repeat('2', 64),
    'reviewed-cutover-token'
  ),
  true,
  'the exact raw token opens one transaction-bound graph commit session'
);

set local role service_role;
select throws_ok(
  $$
    update private.ax_identity_legacy_imports
    set status = 'committed', committed_at = now()
    where id = '88000000-0000-4000-8000-000000000003'
  $$,
  '42501',
  'permission denied for schema private',
  'even a token-authorized service session cannot forge committed import status'
);
select throws_ok(
  $$
    insert into private.ax_identity_registry_cutovers (
      namespace, legacy_import_id, registry_revision_id, input_fingerprint,
      graph_checksum, report_checksum, actor_owner_id, reason
    ) values (
      'people-groups', '88000000-0000-4000-8000-000000000003',
      '88000000-0000-4000-8000-000000000099', repeat('2', 64),
      repeat('3', 64), repeat('4', 64), 'cutover-test', 'Forged cutover'
    )
  $$,
  '42501',
  'permission denied for schema private',
  'service code cannot insert a cutover marker even after begin authorization'
);
reset role;

select throws_ok(
  $same_count_mutation$
    do $test$
    begin
      perform pg_temp.stage_legacy_cutover_graph('NPL', true);
      perform private.finalize_legacy_ax_identity_graph_import(
        '88000000-0000-4000-8000-000000000003', repeat('2', 64),
        'reviewed-cutover-token', 'cutover-test', null, 'Mutated graph'
      );
    end
    $test$
  $same_count_mutation$,
  '23514',
  'The staged legacy AX graph does not match its verified dry-run.',
  'same-count canonical and binding mutations fail exact graph checksum validation'
);

select throws_ok(
  $missing_audit$
    do $test$
    begin
      perform pg_temp.stage_legacy_cutover_graph('LAO', false);
      perform private.finalize_legacy_ax_identity_graph_import(
        '88000000-0000-4000-8000-000000000003', repeat('2', 64),
        'reviewed-cutover-token', 'cutover-test', null, 'Missing audit'
      );
    end
    $test$
  $missing_audit$,
  '23514',
  'The staged legacy AX graph does not match its verified dry-run.',
  'missing reconciliation evidence fails exact audit validation'
);

select throws_ok(
  $hidden_reserved_row$
    do $test$
    begin
      perform pg_temp.stage_legacy_cutover_graph('LAO', true);
      insert into private.ax_identities (
        namespace, identity_kind, rop3_component, lifecycle_state,
        created_by_import_id
      ) values (
        'people-groups', 'pgac', '999999', 'reserved',
        '88000000-0000-4000-8000-000000000003'
      );
      perform private.finalize_legacy_ax_identity_graph_import(
        '88000000-0000-4000-8000-000000000003', repeat('2', 64),
        'reviewed-cutover-token', 'cutover-test', null, 'Hidden reserved row'
      );
    end
    $test$
  $hidden_reserved_row$,
  '23514',
  'The staged legacy AX graph does not match its verified dry-run.',
  'non-active import-owned rows cannot be hidden outside the reviewed graph'
);

select throws_ok(
  $late_activation$
    do $test$
    declare
      hidden_identity_id uuid;
    begin
      insert into private.ax_identities (
        namespace, identity_kind, rop3_component, lifecycle_state,
        created_by_import_id
      ) values (
        'people-groups', 'pgac', '999998', 'reserved',
        '88000000-0000-4000-8000-000000000003'
      ) returning id into hidden_identity_id;
      delete from private.ax_identity_graph_commit_sessions
      where backend_pid = pg_backend_pid() and transaction_id = txid_current();
      update private.ax_identities
      set lifecycle_state = 'active'
      where id = hidden_identity_id;
    end
    $test$
  $late_activation$,
  '23514',
  'Imported AX records require their authorized commit session for activation.',
  'reserved import rows cannot activate after their transaction authorization is consumed'
);

select lives_ok(
  $$ select pg_temp.stage_legacy_cutover_graph('LAO', true) $$,
  'the reviewed graph and audit evidence can be staged after authorization'
);

select lives_ok(
  $$ select private.finalize_legacy_ax_identity_graph_import(
    '88000000-0000-4000-8000-000000000003', repeat('2', 64),
    'reviewed-cutover-token', 'cutover-test', null, 'Verified legacy cutover'
  ) $$,
  'the exact staged graph finalizes atomically'
);

select is(
  (select status from private.ax_identity_legacy_imports
   where id = '88000000-0000-4000-8000-000000000003'),
  'committed',
  'the verified import becomes committed'
);
select is(
  (select count(*)::integer from private.ax_identity_registry_cutovers
   where legacy_import_id = '88000000-0000-4000-8000-000000000003'),
  1,
  'finalization creates the singleton authoritative cutover marker'
);
select is(
  (select count(*)::integer from private.ax_identities), 2,
  'the cutover activates the exact parent-child graph'
);
select is(
  (select next_value from private.ax_identity_counters where namespace = 'people-groups'),
  2055,
  'the historical allocator floor advances without recycling values'
);
select is(
  (select count(*)::integer from private.ax_identity_legacy_import_audits), 1,
  'the exact reviewed audit decision is retained'
);
select is(
  (select count(*)::integer from private.ax_registry_revision_bindings), 1,
  'the genesis revision snapshots every imported binding'
);
select is(
  (select count(*)::integer from private.ax_identity_graph_commit_sessions), 0,
  'successful finalization consumes the transaction authorization session'
);
select is(
  private.begin_legacy_ax_identity_graph_commit(
    '88000000-0000-4000-8000-000000000003', repeat('2', 64),
    'reviewed-cutover-token'
  ),
  false,
  'an exact committed retry is idempotent'
);

select is(
  (
    select code.code
    from private.ax_identity_source_bindings as binding
    join private.ax_identity_codes as code
      on code.identity_id = binding.identity_id
     and code.code_kind = 'canonical'
     and code.lifecycle_state = 'active'
    where binding.source_profile_key = 'partner-cutover'
      and binding.stable_row_key = 'partner-cutover:sheet-42:legacy-1'
      and binding.binding_state = 'active'
  ),
  '10-zz-100001-LAO',
  'the exact current forming key reuses the imported canonical identity'
);

select throws_ok(
  $$
    update private.tier2_partner_profiles
    set profile_key = 'partner-cutover-renamed'
    where profile_key = 'partner-cutover'
  $$,
  'P0001',
  'A used Tier 2 profile cannot change identity or forming fields.',
  'a cutover-mapped profile cannot orphan imported stable source bindings'
);

select throws_ok(
  $$
    delete from private.tier2_partner_profiles
    where profile_key = 'partner-cutover'
  $$,
  'P0001',
  'A used Tier 2 profile cannot be deleted.',
  'a cutover-mapped profile cannot be deleted'
);

select throws_ok(
  $$
    update private.api_connections
    set archived_at = now(), archived_by_owner_id = 'cutover-test',
      archive_reason = 'Disconnect after cutover'
    where id = '88000000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'A used Tier 2 source connection cannot change source identity or be disconnected.',
  'a cutover-mapped source connection cannot be disconnected'
);

set local role authenticated;
select results_eq(
  $$
    update storage.objects
    set metadata = '{"tampered":true}'::jsonb
    where bucket_id = 'identity-registry-evidence'
    returning name
  $$,
  array[]::text[],
  'authenticated dataset admins cannot overwrite legacy cutover evidence'
);
reset role;

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'DELETE' and 'authenticated' = any(roles)
      and coalesce(qual, '') not like '%datasets%'
  ),
  0,
  'no authenticated delete policy reaches the dedicated evidence bucket'
);

select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'identity-registry-evidence'),
  9,
  'service-role-only evidence remains available after browser deletion attempts'
);

select * from finish();
rollback;
