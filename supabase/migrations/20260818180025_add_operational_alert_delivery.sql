create extension if not exists pg_net;
create extension if not exists pg_cron;

create table private.operational_alert_notifications (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  fingerprint text not null,
  severity text not null,
  source text not null,
  title text not null,
  summary text not null,
  details_url text,
  occurrence_count integer not null default 1,
  status text not null default 'pending',
  suppression_reason text,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  resend_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_alert_notifications_idempotency_key_check
    check (char_length(idempotency_key) between 8 and 200),
  constraint operational_alert_notifications_fingerprint_check
    check (char_length(fingerprint) between 3 and 200),
  constraint operational_alert_notifications_severity_check
    check (severity in ('critical', 'high', 'medium', 'info')),
  constraint operational_alert_notifications_source_check
    check (
      char_length(source) between 2 and 80
      and source ~ '^[a-z0-9][a-z0-9._-]*$'
    ),
  constraint operational_alert_notifications_title_check
    check (char_length(btrim(title)) between 1 and 160),
  constraint operational_alert_notifications_summary_check
    check (char_length(btrim(summary)) between 1 and 1000),
  constraint operational_alert_notifications_details_url_check
    check (
      details_url is null
      or (char_length(details_url) <= 2048 and details_url ~ '^https://')
    ),
  constraint operational_alert_notifications_occurrence_count_check
    check (occurrence_count between 1 and 1000000),
  constraint operational_alert_notifications_status_check
    check (status in ('pending', 'sending', 'sent', 'suppressed', 'failed')),
  constraint operational_alert_notifications_suppression_reason_check
    check (
      suppression_reason is null
      or suppression_reason in ('cooldown', 'daily_budget', 'monthly_budget', 'lower_severity')
    ),
  constraint operational_alert_notifications_attempt_count_check
    check (attempt_count between 0 and 5),
  constraint operational_alert_notifications_resend_message_id_check
    check (resend_message_id is null or char_length(resend_message_id) <= 255),
  constraint operational_alert_notifications_last_error_code_check
    check (last_error_code is null or char_length(last_error_code) <= 128),
  constraint operational_alert_notifications_sent_state_check
    check (
      (status = 'sent' and sent_at is not null and resend_message_id is not null)
      or status <> 'sent'
    ),
  constraint operational_alert_notifications_suppressed_state_check
    check (
      (status = 'suppressed' and suppression_reason is not null)
      or status <> 'suppressed'
    )
);

comment on table private.operational_alert_notifications is
  'Bounded, sanitized operational email outbox. Never stores recipient addresses, credentials, raw provider payloads, arbitrary HTML, or uploaded data.';

create index operational_alert_notifications_pending_idx
  on private.operational_alert_notifications(next_attempt_at, created_at)
  where status = 'pending';

create index operational_alert_notifications_budget_idx
  on private.operational_alert_notifications(last_attempt_at)
  where status in ('sending', 'sent');

create index operational_alert_notifications_fingerprint_idx
  on private.operational_alert_notifications(fingerprint, created_at desc);

alter table private.operational_alert_notifications enable row level security;
revoke all on private.operational_alert_notifications from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.operational_alert_notifications to service_role;

create or replace function public.enqueue_operational_alert(
  p_idempotency_key text,
  p_fingerprint text,
  p_severity text,
  p_source text,
  p_title text,
  p_summary text,
  p_details_url text default null,
  p_occurrence_count integer default 1
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  notification_id uuid;
  notification_status text := 'pending';
  notification_suppression_reason text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_fingerprint, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('operational-alert-storage-budget', 0)
  );

  if (
    select count(*)
    from private.operational_alert_notifications
  ) >= 3000 then
    delete from private.operational_alert_notifications
    where id in (
      select id
      from private.operational_alert_notifications
      where status in ('sent', 'suppressed', 'failed')
      order by created_at
      limit 300
    );
  end if;

  if (
    select count(*)
    from private.operational_alert_notifications
  ) >= 3000 then
    raise exception using
      errcode = 'P0001',
      message = 'Operational alert storage budget is exhausted.';
  end if;

  select id
  into notification_id
  from private.operational_alert_notifications
  where idempotency_key = p_idempotency_key;

  if notification_id is not null then
    return notification_id;
  end if;

  if p_severity not in ('critical', 'high') then
    notification_status := 'suppressed';
    notification_suppression_reason := 'lower_severity';
  elsif exists (
    select 1
    from private.operational_alert_notifications
    where fingerprint = p_fingerprint
      and created_at >= now() - interval '1 hour'
      and status in ('pending', 'sending', 'sent')
  ) then
    notification_status := 'suppressed';
    notification_suppression_reason := 'cooldown';
  end if;

  insert into private.operational_alert_notifications (
    idempotency_key,
    fingerprint,
    severity,
    source,
    title,
    summary,
    details_url,
    occurrence_count,
    status,
    suppression_reason
  )
  values (
    p_idempotency_key,
    p_fingerprint,
    p_severity,
    p_source,
    p_title,
    p_summary,
    p_details_url,
    p_occurrence_count,
    notification_status,
    notification_suppression_reason
  )
  returning id into notification_id;

  return notification_id;
end;
$$;

create or replace function public.claim_operational_alert_notifications(
  p_limit integer default 10
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  utc_day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  utc_month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  daily_count integer;
  monthly_count integer;
  available_count integer;
  claimed jsonb;
begin
  if p_limit < 1 or p_limit > 10 then
    raise exception 'Operational alert claim limit must be between 1 and 10.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('operational-alert-email-budget', 0)
  );

  update private.operational_alert_notifications
  set
    status = case when attempt_count >= 5 then 'failed' else 'pending' end,
    next_attempt_at = now(),
    last_error_code = coalesce(last_error_code, 'claim_timeout'),
    updated_at = now()
  where status = 'sending'
    and last_attempt_at < now() - interval '15 minutes';

  select count(*)::integer
  into daily_count
  from private.operational_alert_notifications
  where status in ('sending', 'sent')
    and last_attempt_at >= utc_day_start;

  select count(*)::integer
  into monthly_count
  from private.operational_alert_notifications
  where status in ('sending', 'sent')
    and last_attempt_at >= utc_month_start;

  if monthly_count >= 300 then
    update private.operational_alert_notifications
    set
      status = 'suppressed',
      suppression_reason = 'monthly_budget',
      updated_at = now()
    where status = 'pending'
      and next_attempt_at <= now();

    return '[]'::jsonb;
  end if;

  if daily_count >= 20 then
    update private.operational_alert_notifications
    set
      status = 'suppressed',
      suppression_reason = 'daily_budget',
      updated_at = now()
    where status = 'pending'
      and next_attempt_at <= now();

    return '[]'::jsonb;
  end if;

  available_count := least(p_limit, 20 - daily_count, 300 - monthly_count);

  with candidates as (
    select id
    from private.operational_alert_notifications
    where status = 'pending'
      and next_attempt_at <= now()
      and severity in ('critical', 'high')
    order by
      case severity when 'critical' then 0 else 1 end,
      created_at
    for update skip locked
    limit available_count
  ), updated as (
    update private.operational_alert_notifications as notification
    set
      status = 'sending',
      attempt_count = notification.attempt_count + 1,
      last_attempt_at = now(),
      updated_at = now()
    from candidates
    where notification.id = candidates.id
    returning notification.*
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'idempotency_key', idempotency_key,
        'fingerprint', fingerprint,
        'severity', severity,
        'source', source,
        'title', title,
        'summary', summary,
        'details_url', details_url,
        'occurrence_count', occurrence_count,
        'attempt_count', attempt_count,
        'created_at', created_at
      )
      order by created_at
    ),
    '[]'::jsonb
  )
  into claimed
  from updated;

  return claimed;
end;
$$;

create or replace function public.complete_operational_alert_notification(
  p_notification_id uuid,
  p_resend_message_id text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update private.operational_alert_notifications
  set
    status = 'sent',
    sent_at = now(),
    resend_message_id = p_resend_message_id,
    last_error_code = null,
    updated_at = now()
  where id = p_notification_id
    and status = 'sending';

  get diagnostics updated_count = row_count;

  if updated_count = 1 then
    return true;
  end if;

  return exists (
    select 1
    from private.operational_alert_notifications
    where id = p_notification_id
      and status = 'sent'
      and resend_message_id = p_resend_message_id
  );
end;
$$;

create or replace function public.fail_operational_alert_notification(
  p_notification_id uuid,
  p_error_code text,
  p_retryable boolean default true
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_attempt_count integer;
  retry_delay_minutes integer;
begin
  select attempt_count
  into current_attempt_count
  from private.operational_alert_notifications
  where id = p_notification_id
    and status = 'sending'
  for update;

  if current_attempt_count is null then
    return false;
  end if;

  retry_delay_minutes := least(
    360,
    (5 * power(2, greatest(current_attempt_count - 1, 0)))::integer
  );

  update private.operational_alert_notifications
  set
    status = case
      when p_retryable and current_attempt_count < 5 then 'pending'
      else 'failed'
    end,
    next_attempt_at = case
      when p_retryable and current_attempt_count < 5
        then now() + make_interval(mins => retry_delay_minutes)
      else next_attempt_at
    end,
    last_error_code = left(coalesce(nullif(p_error_code, ''), 'unknown'), 128),
    updated_at = now()
  where id = p_notification_id;

  return true;
end;
$$;

revoke all on function public.enqueue_operational_alert(text, text, text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.claim_operational_alert_notifications(integer) from public, anon, authenticated;
revoke all on function public.complete_operational_alert_notification(uuid, text) from public, anon, authenticated;
revoke all on function public.fail_operational_alert_notification(uuid, text, boolean) from public, anon, authenticated;

grant execute on function public.enqueue_operational_alert(text, text, text, text, text, text, text, integer) to service_role;
grant execute on function public.claim_operational_alert_notifications(integer) to service_role;
grant execute on function public.complete_operational_alert_notification(uuid, text) to service_role;
grant execute on function public.fail_operational_alert_notification(uuid, text, boolean) to service_role;

create or replace function private.request_operational_alert_dispatch()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  function_url text;
  dispatch_secret text;
begin
  select decrypted_secret
  into function_url
  from vault.decrypted_secrets
  where name = 'operational_alert_edge_function_url'
  limit 1;

  select decrypted_secret
  into dispatch_secret
  from vault.decrypted_secrets
  where name = 'operational_alert_dispatch_secret'
  limit 1;

  if nullif(btrim(function_url), '') is null
    or nullif(btrim(dispatch_secret), '') is null then
    return false;
  end if;

  perform net.http_post(
    url := btrim(function_url),
    body := jsonb_build_object('source', 'database'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || btrim(dispatch_secret)
    ),
    timeout_milliseconds := 5000
  );

  return true;
exception
  when others then
    return false;
end;
$$;

revoke all on function private.request_operational_alert_dispatch() from public, anon, authenticated, service_role;

create or replace function private.trigger_operational_alert_dispatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    perform private.request_operational_alert_dispatch();
  end if;

  return new;
end;
$$;

revoke all on function private.trigger_operational_alert_dispatch() from public, anon, authenticated, service_role;

create trigger operational_alert_notifications_dispatch
after insert on private.operational_alert_notifications
for each row
when (new.status = 'pending')
execute function private.trigger_operational_alert_dispatch();

create or replace function private.retry_operational_alert_delivery()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.operational_alert_notifications
  where status in ('sent', 'suppressed', 'failed')
    and created_at < now() - interval '90 days';

  if exists (
    select 1
    from private.operational_alert_notifications
    where status in ('pending', 'sending')
      and (
        (status = 'pending' and next_attempt_at <= now())
        or (status = 'sending' and last_attempt_at < now() - interval '15 minutes')
      )
  ) then
    perform private.request_operational_alert_dispatch();
  end if;
end;
$$;

revoke all on function private.retry_operational_alert_delivery() from public, anon, authenticated, service_role;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'retry-operational-alert-delivery'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'retry-operational-alert-delivery',
    '*/15 * * * *',
    $job$select private.retry_operational_alert_delivery();$job$
  );
end;
$$;
