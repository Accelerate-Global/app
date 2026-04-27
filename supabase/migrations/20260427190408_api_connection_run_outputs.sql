alter table private.api_connection_runs
  add column if not exists started_at timestamp with time zone,
  add column if not exists completed_at timestamp with time zone;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'api_connection_runs_status_check'
      and conrelid = 'private.api_connection_runs'::regclass
  ) then
    alter table private.api_connection_runs
      drop constraint api_connection_runs_status_check;
  end if;
end $$;

alter table private.api_connection_runs
  add constraint api_connection_runs_status_check
  check (status in ('queued', 'running', 'success', 'failed'));

create table if not exists private.api_connection_run_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.api_connection_runs(id) on delete cascade,
  connection_id uuid not null references private.api_connections(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  created_at timestamp with time zone not null default now(),
  constraint api_connection_run_logs_level_check check (level in ('info', 'error'))
);

create index if not exists api_connection_run_logs_run_created_idx
  on private.api_connection_run_logs(run_id, created_at);
create index if not exists api_connection_run_logs_connection_created_idx
  on private.api_connection_run_logs(connection_id, created_at);

alter table private.api_connection_run_logs enable row level security;
revoke all on private.api_connection_run_logs from public, anon, authenticated;

create table if not exists private.api_connection_run_outputs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.api_connection_runs(id) on delete cascade,
  connection_id uuid not null references private.api_connections(id) on delete cascade,
  row_count integer not null default 0,
  columns jsonb not null default '[]'::jsonb,
  rows_storage_path text not null,
  raw_storage_path text not null,
  rows_size_bytes integer not null default 0,
  raw_size_bytes integer not null default 0,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists api_connection_run_outputs_run_idx
  on private.api_connection_run_outputs(run_id);
create index if not exists api_connection_run_outputs_connection_created_idx
  on private.api_connection_run_outputs(connection_id, created_at);

alter table private.api_connection_run_outputs enable row level security;
revoke all on private.api_connection_run_outputs from public, anon, authenticated;
