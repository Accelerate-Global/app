begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

create temporary table first_attempt as
select * from private.begin_ax_identity_authority_activation(
  'test', repeat('1', 64), repeat('2', 64),
  'authority-test', null, 'Initialize clean authority'
);

select throws_ok(
  $$ select * from private.commit_ax_identity_authority_activation(
       (select activation_attempt_id from first_attempt), 'wrong-token',
       (select state_fingerprint from first_attempt), repeat('1', 64), repeat('2', 64)
     ) $$,
  '28000', 'AX authority activation token is invalid, expired, or already used.',
  'commit rejects the wrong token'
);

select throws_ok(
  $$ select * from private.commit_ax_identity_authority_activation(
       (select activation_attempt_id from first_attempt),
       (select activation_token from first_attempt), repeat('0', 64),
       repeat('1', 64), repeat('2', 64)
     ) $$,
  '28000', 'AX authority activation token is invalid, expired, or already used.',
  'commit rejects a different expected state fingerprint'
);

select throws_ok(
  $$ select * from private.commit_ax_identity_authority_activation(
       (select activation_attempt_id from first_attempt),
       (select activation_token from first_attempt),
       (select state_fingerprint from first_attempt),
       repeat('9', 64), repeat('2', 64)
     ) $$,
  '28000', 'AX authority activation token is invalid, expired, or already used.',
  'commit rejects a changed current rules contract'
);

create temporary table committed_authority as
select committed.* from first_attempt as attempt
cross join lateral private.commit_ax_identity_authority_activation(
  attempt.activation_attempt_id, attempt.activation_token,
  attempt.state_fingerprint, repeat('1', 64), repeat('2', 64)
) as committed;

select is((select authority_namespace from committed_authority), 'people-groups',
  'commit establishes the people-groups authority');
select is((select revision_number from committed_authority), 1::bigint,
  'commit establishes revision 1');
select ok((select consumed_at is not null
  from private.ax_identity_authority_activation_attempts),
  'commit consumes the activation attempt');

select throws_ok(
  $$ select * from private.commit_ax_identity_authority_activation(
       (select activation_attempt_id from first_attempt),
       (select activation_token from first_attempt),
       (select state_fingerprint from first_attempt),
       repeat('1', 64), repeat('2', 64)
     ) $$,
  '28000', 'AX authority activation token is invalid, expired, or already used.',
  'the activation token cannot be replayed'
);

select throws_ok(
  $$ select * from private.begin_ax_identity_authority_activation(
       'test', repeat('1', 64), repeat('2', 64),
       'authority-test', null, 'Second activation'
     ) $$,
  '23514', 'AX identity authority is not in the required empty state.',
  'an initialized authority cannot be activated again'
);

select has_trigger('private', 'ax_identity_authorities',
  'ax_identity_authorities_immutable', 'authority marker has an immutable-history trigger');
select has_trigger('private', 'ax_identity_change_decisions',
  'ax_identity_change_decisions_review_once', 'review decisions can be selected only once');
select has_trigger('private', 'ax_identities',
  'ax_identities_require_authority', 'identity inserts require initialized authority');
select has_trigger('private', 'pipeline_publications',
  'pipeline_publications_require_identity_authority',
  'identity publications require initialized authority');
select is((select count(*) from pg_tables
  where schemaname = 'private' and tablename = 'ax_identity_legacy_imports'),
  0::bigint, 'legacy identity import state is absent');
select is((select private.ax_identity_graph_checksum()),
  (select content_checksum from private.ax_registry_revisions where revision_number = 1),
  'empty revision checksum equals the current empty graph');
select is((select next_value from private.ax_identity_counters
  where namespace = 'people-groups'), 1,
  'security failures and activation consume no registry number');

select * from finish();
rollback;
