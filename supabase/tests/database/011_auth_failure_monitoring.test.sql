begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

select has_table(
  'private',
  'auth_failure_windows',
  'authentication failure windows exist in the private schema'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname = 'auth_failure_windows'
      and pg_class.relkind = 'r'
  ),
  'authentication failure windows have RLS enabled'
);

select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name = 'auth_failure_windows'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0::bigint,
  'public-facing roles have no authentication failure table privileges'
);

select ok(
  has_table_privilege(
    'service_role',
    'private.auth_failure_windows',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'service role can maintain authentication failure windows'
);

select is(
  (
    select count(*)::bigint
    from pg_policies
    where schemaname = 'private'
      and tablename = 'auth_failure_windows'
  ),
  0::bigint,
  'authentication failure table has no user-facing RLS policies'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.record_auth_failure(text,integer,integer)'::regprocedure),
  'record RPC uses invoker security'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.reset_auth_failures(text)'::regprocedure),
  'reset RPC uses invoker security'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.record_auth_failure(text,integer,integer)',
    'EXECUTE'
  ),
  'anonymous callers cannot record authentication failures'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.reset_auth_failures(text)',
    'EXECUTE'
  ),
  'authenticated callers cannot reset authentication failures'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.record_auth_failure(text,integer,integer)',
    'EXECUTE'
  ),
  'service role can record authentication failures'
);

select throws_ok(
  $$ select public.record_auth_failure('raw-email@example.org', 15, 5) $$,
  '22023',
  'Authentication failure subject hash is invalid.',
  'record RPC rejects raw identifiers'
);

select is(
  public.record_auth_failure(repeat('a', 64), 15, 5)->>'failure_count',
  '1',
  'first failure starts the private window'
);

select is(
  public.record_auth_failure(repeat('a', 64), 15, 5)->>'should_alert',
  'false',
  'second failure does not alert'
);

select public.record_auth_failure(repeat('a', 64), 15, 5);
select public.record_auth_failure(repeat('a', 64), 15, 5);

select is(
  public.record_auth_failure(repeat('a', 64), 15, 5)->>'should_alert',
  'true',
  'fifth failure crosses the alert threshold'
);

select is(
  public.record_auth_failure(repeat('a', 64), 15, 5)->>'should_alert',
  'false',
  'later failures in the same window do not alert again'
);

select is(
  (
    select failure_count
    from private.auth_failure_windows
    where subject_hash = repeat('a', 64)
  ),
  6,
  'failure count remains observable to trusted operations'
);

select ok(
  public.reset_auth_failures(repeat('a', 64)),
  'successful sign-in can reset the active window'
);

select is(
  (
    select count(*)::bigint
    from private.auth_failure_windows
    where subject_hash = repeat('a', 64)
  ),
  0::bigint,
  'reset removes the keyed subject window'
);

insert into private.auth_failure_windows(
  subject_hash,
  window_started_at,
  last_failed_at,
  failure_count
)
values (
  repeat('b', 64),
  now() - interval '20 minutes',
  now() - interval '20 minutes',
  9
);

select is(
  public.record_auth_failure(repeat('b', 64), 15, 5)->>'failure_count',
  '1',
  'expired windows restart at one failure'
);

insert into private.auth_failure_windows(
  subject_hash,
  last_failed_at,
  failure_count
)
values (
  repeat('c', 64),
  now() - interval '25 hours',
  1
);

select public.record_auth_failure(repeat('d', 64), 15, 5);

select is(
  (
    select count(*)::bigint
    from private.auth_failure_windows
    where subject_hash = repeat('c', 64)
  ),
  0::bigint,
  'recording prunes inactive windows after 24 hours'
);

select is(
  (
    select count(*)::bigint
    from private.auth_failure_windows
    where subject_hash in (repeat('b', 64), repeat('d', 64))
  ),
  2::bigint,
  'only keyed digests remain in active storage'
);

select throws_ok(
  $$ select public.record_auth_failure(repeat('e', 64), 0, 5) $$,
  '22023',
  'Authentication failure window is invalid.',
  'record RPC rejects invalid windows'
);

select throws_ok(
  $$ select public.record_auth_failure(repeat('e', 64), 15, 1) $$,
  '22023',
  'Authentication failure threshold is invalid.',
  'record RPC rejects invalid thresholds'
);

delete from private.auth_failure_windows;

insert into private.auth_failure_windows(subject_hash)
select lpad(to_hex(subject_number), 64, '0')
from generate_series(1, 10000) as subject_number;

select is(
  public.record_auth_failure(repeat('f', 64), 15, 5)->>'recorded',
  'false',
  'active subject storage refuses growth beyond the 10,000-row ceiling'
);

select * from finish();

rollback;
