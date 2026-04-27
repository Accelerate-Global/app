create schema if not exists private;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;

create table if not exists private.api_connections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  method text not null default 'GET',
  url text not null,
  request_headers jsonb not null default '[]'::jsonb,
  secret_header_names jsonb not null default '[]'::jsonb,
  secret_vault_id uuid,
  body_template text not null default '',
  response_format text not null default 'json',
  response_data_path text not null default '',
  import_mode text not null default 'create',
  target_dataset_id uuid references public.datasets(id) on delete set null,
  dataset_name text not null default 'api-import.csv',
  dataset_classification text not null default 'PGAC',
  created_by_owner_id text not null,
  updated_by_owner_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint api_connections_method_check check (method in ('GET', 'POST', 'PUT', 'PATCH')),
  constraint api_connections_response_format_check check (response_format in ('json', 'csv')),
  constraint api_connections_import_mode_check check (import_mode in ('create', 'replace')),
  constraint api_connections_dataset_classification_check check (dataset_classification in ('PGAC', 'PGIC'))
);

create index if not exists api_connections_created_at_idx
  on private.api_connections(created_at);
create index if not exists api_connections_updated_at_idx
  on private.api_connections(updated_at);

alter table private.api_connections enable row level security;
revoke all on private.api_connections from public, anon, authenticated;

create table if not exists private.api_connection_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references private.api_connections(id) on delete cascade,
  actor_owner_id text not null,
  actor_email text,
  mode text not null,
  status text not null,
  http_status integer,
  duration_ms integer not null,
  row_count integer,
  dataset_id uuid references public.datasets(id) on delete set null,
  error_message text,
  response_preview text not null default '',
  created_at timestamp with time zone not null default now(),
  constraint api_connection_runs_mode_check check (mode in ('test', 'import')),
  constraint api_connection_runs_status_check check (status in ('success', 'failed'))
);

create index if not exists api_connection_runs_connection_created_idx
  on private.api_connection_runs(connection_id, created_at);
create index if not exists api_connection_runs_created_at_idx
  on private.api_connection_runs(created_at);

alter table private.api_connection_runs enable row level security;
revoke all on private.api_connection_runs from public, anon, authenticated;
