begin;

create extension if not exists pgtap with schema extensions;

select plan(34);

select has_table(
  'private',
  'operational_alert_notifications',
  'operational alert outbox exists in the private schema'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'private'
      and pg_class.relname = 'operational_alert_notifications'
      and pg_class.relkind = 'r'
  ),
  'operational alert outbox has RLS enabled'
);

select is(
  (
    select count(*)::bigint
    from information_schema.table_privileges
    where table_schema = 'private'
      and table_name = 'operational_alert_notifications'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0::bigint,
  'public-facing roles have no outbox table privileges'
);

select ok(
  has_table_privilege(
    'service_role',
    'private.operational_alert_notifications',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'service role can operate the private outbox'
);

select is(
  (
    select count(*)::bigint
    from pg_policies
    where schemaname = 'private'
      and tablename = 'operational_alert_notifications'
  ),
  0::bigint,
  'outbox has no user-facing RLS policies'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.enqueue_operational_alert(text,text,text,text,text,text,text,integer)'::regprocedure),
  'enqueue RPC uses invoker security'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.claim_operational_alert_notifications(integer)'::regprocedure),
  'claim RPC uses invoker security'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.complete_operational_alert_notification(uuid,text)'::regprocedure),
  'complete RPC uses invoker security'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.fail_operational_alert_notification(uuid,text,boolean)'::regprocedure),
  'failure RPC uses invoker security'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.enqueue_operational_alert(text,text,text,text,text,text,text,integer)',
    'EXECUTE'
  ),
  'anonymous users cannot enqueue alerts'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_operational_alert_notifications(integer)',
    'EXECUTE'
  ),
  'authenticated users cannot claim alerts'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.enqueue_operational_alert(text,text,text,text,text,text,text,integer)',
    'EXECUTE'
  ),
  'service role can enqueue alerts'
);

select ok(
  not has_function_privilege(
    'service_role',
    'private.request_operational_alert_dispatch()',
    'EXECUTE'
  ),
  'service role cannot read Vault through the private dispatch helper'
);

select ok(
  exists(
    select 1
    from pg_trigger
    where tgrelid = 'private.operational_alert_notifications'::regclass
      and tgname = 'operational_alert_notifications_dispatch'
      and not tgisinternal
  ),
  'pending outbox inserts have an immediate dispatch trigger'
);

select ok(
  exists(
    select 1
    from cron.job
    where jobname = 'retry-operational-alert-delivery'
      and schedule = '*/15 * * * *'
  ),
  'one 15-minute operational alert retry job is scheduled'
);

select ok(exists(select 1 from pg_extension where extname = 'pg_net'), 'pg_net is enabled');
select ok(exists(select 1 from pg_extension where extname = 'pg_cron'), 'pg_cron is enabled');

select lives_ok(
  $$
    select public.enqueue_operational_alert(
      'alert-primary-2026-08-18t18',
      'dataset-refresh-timeout',
      'high',
      'dataset.refresh',
      'Dataset refresh failed',
      'The provider timed out after retries were exhausted.',
      'https://data.accelerateglobal.org/admin/operations',
      3
    )
  $$,
  'trusted callers can enqueue a sanitized high alert'
);

select public.enqueue_operational_alert(
  'alert-primary-2026-08-18t18',
  'dataset-refresh-timeout',
  'high',
  'dataset.refresh',
  'Dataset refresh failed',
  'The provider timed out after retries were exhausted.',
  null,
  4
);

select is(
  (
    select count(*)::bigint
    from private.operational_alert_notifications
    where idempotency_key = 'alert-primary-2026-08-18t18'
  ),
  1::bigint,
  'idempotency keys prevent duplicate outbox rows'
);

select public.enqueue_operational_alert(
  'alert-medium-2026-08-18t18',
  'upload-validation',
  'medium',
  'dataset.upload',
  'Upload validation failed',
  'A user supplied an unsupported file.',
  null,
  1
);

select is(
  (
    select status || ':' || suppression_reason
    from private.operational_alert_notifications
    where idempotency_key = 'alert-medium-2026-08-18t18'
  ),
  'suppressed:lower_severity',
  'lower severity notifications are retained without email eligibility'
);

select public.enqueue_operational_alert(
  'alert-cooldown-2026-08-18t18',
  'dataset-refresh-timeout',
  'critical',
  'dataset.refresh',
  'Dataset refresh failed again',
  'The same failure recurred during cooldown.',
  null,
  5
);

select is(
  (
    select status || ':' || suppression_reason
    from private.operational_alert_notifications
    where idempotency_key = 'alert-cooldown-2026-08-18t18'
  ),
  'suppressed:cooldown',
  'same-fingerprint recurrence is suppressed during cooldown'
);

select is(
  jsonb_array_length(public.claim_operational_alert_notifications(10)),
  1,
  'claim RPC returns the one eligible notification'
);

select is(
  (
    select status || ':' || attempt_count::text
    from private.operational_alert_notifications
    where idempotency_key = 'alert-primary-2026-08-18t18'
  ),
  'sending:1',
  'claim marks the notification sending and increments its attempt'
);

select ok(
  public.complete_operational_alert_notification(
    (
      select id
      from private.operational_alert_notifications
      where idempotency_key = 'alert-primary-2026-08-18t18'
    ),
    'resend-message-id'
  ),
  'complete RPC accepts the Resend message identifier'
);

select is(
  (
    select status || ':' || resend_message_id
    from private.operational_alert_notifications
    where idempotency_key = 'alert-primary-2026-08-18t18'
  ),
  'sent:resend-message-id',
  'successful delivery is persisted'
);

select public.enqueue_operational_alert(
  'alert-retry-2026-08-18t18',
  'connection-provider-down',
  'high',
  'connection.test',
  'Connection provider unavailable',
  'The upstream provider could not be reached.',
  null,
  1
);

select public.claim_operational_alert_notifications(1);

select ok(
  public.fail_operational_alert_notification(
    (
      select id
      from private.operational_alert_notifications
      where idempotency_key = 'alert-retry-2026-08-18t18'
    ),
    'resend_http_503',
    true
  ),
  'retryable failure RPC updates claimed work'
);

select ok(
  (
    select status = 'pending'
      and attempt_count = 1
      and next_attempt_at > now()
      and last_error_code = 'resend_http_503'
    from private.operational_alert_notifications
    where idempotency_key = 'alert-retry-2026-08-18t18'
  ),
  'retryable failure receives bounded delayed retry state'
);

update private.operational_alert_notifications
set status = 'sending', attempt_count = 5, last_attempt_at = now()
where idempotency_key = 'alert-retry-2026-08-18t18';

select public.fail_operational_alert_notification(
  (
    select id
    from private.operational_alert_notifications
    where idempotency_key = 'alert-retry-2026-08-18t18'
  ),
  'resend_http_503',
  true
);

select is(
  (
    select status
    from private.operational_alert_notifications
    where idempotency_key = 'alert-retry-2026-08-18t18'
  ),
  'failed',
  'delivery stops retrying after five attempts'
);

delete from private.operational_alert_notifications;

insert into private.operational_alert_notifications (
  idempotency_key,
  fingerprint,
  severity,
  source,
  title,
  summary,
  status,
  attempt_count,
  last_attempt_at,
  sent_at,
  resend_message_id
)
select
  'daily-budget-' || series,
  'daily-budget-' || series,
  'high',
  'budget.test',
  'Budget fixture',
  'Budget fixture summary',
  'sent',
  1,
  now(),
  now(),
  'resend-daily-' || series
from generate_series(1, 20) as series;

select public.enqueue_operational_alert(
  'daily-budget-overflow',
  'daily-budget-overflow',
  'critical',
  'budget.test',
  'Daily budget overflow',
  'The daily budget is already exhausted.',
  null,
  1
);

select public.claim_operational_alert_notifications(10);

select is(
  (
    select status || ':' || suppression_reason
    from private.operational_alert_notifications
    where idempotency_key = 'daily-budget-overflow'
  ),
  'suppressed:daily_budget',
  'daily operational email budget suppresses overflow'
);

delete from private.operational_alert_notifications;

insert into private.operational_alert_notifications (
  idempotency_key,
  fingerprint,
  severity,
  source,
  title,
  summary,
  status,
  attempt_count,
  last_attempt_at,
  sent_at,
  resend_message_id
)
select
  'monthly-budget-' || series,
  'monthly-budget-' || series,
  'high',
  'budget.test',
  'Budget fixture',
  'Budget fixture summary',
  'sent',
  1,
  date_trunc('month', now()) + interval '1 hour',
  date_trunc('month', now()) + interval '1 hour',
  'resend-monthly-' || series
from generate_series(1, 300) as series;

select public.enqueue_operational_alert(
  'monthly-budget-overflow',
  'monthly-budget-overflow',
  'critical',
  'budget.test',
  'Monthly budget overflow',
  'The monthly budget is already exhausted.',
  null,
  1
);

select public.claim_operational_alert_notifications(10);

select is(
  (
    select status || ':' || suppression_reason
    from private.operational_alert_notifications
    where idempotency_key = 'monthly-budget-overflow'
  ),
  'suppressed:monthly_budget',
  'monthly operational email budget suppresses overflow'
);

select throws_ok(
  $$
    select public.enqueue_operational_alert(
      'unsafe-details-url',
      'unsafe-details-url',
      'high',
      'security.test',
      'Unsafe URL',
      'The details URL must use HTTPS.',
      'javascript:alert(1)',
      1
    )
  $$,
  '23514',
  'new row for relation "operational_alert_notifications" violates check constraint "operational_alert_notifications_details_url_check"',
  'unsafe detail links are rejected by a database constraint'
);

insert into private.operational_alert_notifications (
  idempotency_key,
  fingerprint,
  severity,
  source,
  title,
  summary,
  status,
  suppression_reason,
  created_at
)
values (
  'expired-suppressed-alert',
  'expired-suppressed-alert',
  'medium',
  'retention.test',
  'Expired alert',
  'This fixture should be pruned.',
  'suppressed',
  'lower_severity',
  now() - interval '91 days'
);

select private.retry_operational_alert_delivery();

select ok(
  not exists(
    select 1
    from private.operational_alert_notifications
    where idempotency_key = 'expired-suppressed-alert'
  ),
  'retry maintenance prunes terminal records after 90 days'
);

delete from vault.secrets
where name in (
  'operational_alert_edge_function_url',
  'operational_alert_dispatch_secret'
);

select is(
  private.request_operational_alert_dispatch(),
  false,
  'dispatch fails open when named Vault secrets are absent locally'
);

delete from private.operational_alert_notifications;

insert into private.operational_alert_notifications (
  idempotency_key,
  fingerprint,
  severity,
  source,
  title,
  summary,
  status,
  suppression_reason,
  created_at
)
select
  'storage-budget-' || series,
  'storage-budget-' || series,
  'medium',
  'storage.test',
  'Storage budget fixture',
  'Storage budget fixture summary',
  'suppressed',
  'lower_severity',
  now() - make_interval(secs => 3001 - series)
from generate_series(1, 3000) as series;

select public.enqueue_operational_alert(
  'storage-budget-new-alert',
  'storage-budget-new-alert',
  'high',
  'storage.test',
  'Storage budget replacement',
  'Terminal rows are pruned before accepting a new alert.',
  null,
  1
);

select is(
  (select count(*)::integer from private.operational_alert_notifications),
  2701,
  'storage budget prunes the oldest terminal rows before accepting new work'
);

select * from finish();

rollback;
