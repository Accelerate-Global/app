create table private.auth_failure_windows (
  id uuid primary key default gen_random_uuid(),
  subject_hash text not null unique
    check (subject_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  failure_count integer not null default 1
    check (failure_count between 1 and 1000000),
  alerted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index auth_failure_windows_last_failed_at_idx
  on private.auth_failure_windows(last_failed_at);

alter table private.auth_failure_windows enable row level security;
revoke all on private.auth_failure_windows from public, anon, authenticated;
grant select, insert, update, delete on private.auth_failure_windows to service_role;

create or replace function public.record_auth_failure(
  p_subject_hash text,
  p_window_minutes integer default 15,
  p_threshold integer default 5
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  failure_window private.auth_failure_windows%rowtype;
  should_alert boolean := false;
begin
  if p_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'Authentication failure subject hash is invalid.';
  end if;

  if p_window_minutes < 1 or p_window_minutes > 1440 then
    raise exception using
      errcode = '22023',
      message = 'Authentication failure window is invalid.';
  end if;

  if p_threshold < 2 or p_threshold > 100 then
    raise exception using
      errcode = '22023',
      message = 'Authentication failure threshold is invalid.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_subject_hash, 0)
  );

  delete from private.auth_failure_windows
  where last_failed_at < now() - interval '24 hours';

  select *
  into failure_window
  from private.auth_failure_windows
  where subject_hash = p_subject_hash
  for update;

  if failure_window.id is null then
    if (select count(*) from private.auth_failure_windows) >= 10000 then
      return jsonb_build_object(
        'recorded', false,
        'should_alert', false,
        'failure_count', 0,
        'window_id', null
      );
    end if;

    insert into private.auth_failure_windows(subject_hash)
    values (p_subject_hash)
    returning * into failure_window;
  elsif failure_window.window_started_at <=
    now() - make_interval(mins => p_window_minutes) then
    update private.auth_failure_windows
    set
      window_started_at = now(),
      last_failed_at = now(),
      failure_count = 1,
      alerted_at = null,
      updated_at = now()
    where id = failure_window.id
    returning * into failure_window;
  else
    update private.auth_failure_windows
    set
      last_failed_at = now(),
      failure_count = failure_count + 1,
      updated_at = now()
    where id = failure_window.id
    returning * into failure_window;
  end if;

  if failure_window.failure_count >= p_threshold
    and failure_window.alerted_at is null then
    update private.auth_failure_windows
    set
      alerted_at = now(),
      updated_at = now()
    where id = failure_window.id
    returning * into failure_window;
    should_alert := true;
  end if;

  return jsonb_build_object(
    'recorded', true,
    'should_alert', should_alert,
    'failure_count', failure_window.failure_count,
    'window_id', failure_window.id
  );
end;
$$;

create or replace function public.reset_auth_failures(p_subject_hash text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if p_subject_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  delete from private.auth_failure_windows
  where subject_hash = p_subject_hash;

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

revoke all on function public.record_auth_failure(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.reset_auth_failures(text)
  from public, anon, authenticated;
grant execute on function public.record_auth_failure(text, integer, integer)
  to service_role;
grant execute on function public.reset_auth_failures(text)
  to service_role;
