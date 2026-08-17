alter table private.api_connection_runs
  drop constraint if exists api_connection_runs_status_check;

alter table private.api_connection_runs
  add constraint api_connection_runs_status_check
  check (status in ('queued', 'running', 'success', 'failed', 'cancelled')),
  add column if not exists workflow_run_id text,
  add column if not exists stage text,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists deadline_at timestamptz,
  add column if not exists pages_completed integer not null default 0,
  add column if not exists records_completed integer not null default 0,
  add column if not exists bytes_processed bigint not null default 0,
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add constraint api_connection_runs_pages_completed_check
    check (pages_completed >= 0),
  add constraint api_connection_runs_records_completed_check
    check (records_completed >= 0),
  add constraint api_connection_runs_bytes_processed_check
    check (bytes_processed >= 0),
  add constraint api_connection_runs_cancelled_state_check
    check (
      (status = 'cancelled' and cancelled_at is not null and completed_at is not null)
      or status <> 'cancelled'
    );

create unique index api_connection_runs_workflow_run_id_idx
  on private.api_connection_runs(workflow_run_id)
  where workflow_run_id is not null;

create index api_connection_runs_active_heartbeat_idx
  on private.api_connection_runs(heartbeat_at)
  where status in ('queued', 'running');
