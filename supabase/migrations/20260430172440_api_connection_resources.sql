create table if not exists private.api_connection_resources (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references private.api_connections(id) on delete cascade,
  run_id uuid not null references private.api_connection_runs(id) on delete cascade,
  resource_url text not null,
  normalized_url text not null,
  category text not null default '',
  web_text text not null default '',
  source_row_index integer not null,
  source_resource_index integer not null,
  created_at timestamp with time zone not null default now(),
  constraint api_connection_resources_url_check check (resource_url <> ''),
  constraint api_connection_resources_normalized_url_check check (normalized_url <> ''),
  constraint api_connection_resources_source_row_index_check check (source_row_index >= 0),
  constraint api_connection_resources_source_resource_index_check check (source_resource_index > 0)
);

create unique index if not exists api_connection_resources_run_url_idx
  on private.api_connection_resources(connection_id, run_id, normalized_url);
create index if not exists api_connection_resources_created_idx
  on private.api_connection_resources(created_at desc);
create index if not exists api_connection_resources_connection_created_idx
  on private.api_connection_resources(connection_id, created_at desc);

alter table private.api_connection_resources enable row level security;
revoke all on private.api_connection_resources from public, anon, authenticated;
