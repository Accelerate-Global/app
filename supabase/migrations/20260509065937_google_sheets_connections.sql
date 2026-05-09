create table if not exists private.api_connection_oauth_credentials (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'google_sheets',
  actor_owner_id text not null,
  actor_email text,
  scopes jsonb not null default '[]'::jsonb,
  secret_vault_id uuid not null,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint api_connection_oauth_credentials_provider_check check (provider in ('google_sheets'))
);

create index if not exists api_connection_oauth_credentials_actor_idx
  on private.api_connection_oauth_credentials(actor_owner_id, created_at);
create index if not exists api_connection_oauth_credentials_revoked_idx
  on private.api_connection_oauth_credentials(revoked_at);

alter table private.api_connection_oauth_credentials enable row level security;
revoke all on private.api_connection_oauth_credentials from public, anon, authenticated;

alter table private.api_connections
  add column if not exists provider text not null default 'http_api',
  add column if not exists provider_config jsonb not null default '{"provider":"http_api"}'::jsonb,
  add column if not exists oauth_credential_id uuid references private.api_connection_oauth_credentials(id) on delete set null;

alter table private.api_connections
  drop constraint if exists api_connections_provider_check;

alter table private.api_connections
  add constraint api_connections_provider_check check (provider in ('http_api', 'google_sheets'));

create index if not exists api_connections_provider_idx
  on private.api_connections(provider, updated_at);
create index if not exists api_connections_oauth_credential_idx
  on private.api_connections(oauth_credential_id);

create table if not exists private.google_sheets_connection_drafts (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null,
  actor_owner_id text not null,
  actor_email text,
  spreadsheet_url text not null,
  spreadsheet_id text not null,
  spreadsheet_title text,
  sheets jsonb not null default '[]'::jsonb,
  oauth_credential_id uuid references private.api_connection_oauth_credentials(id) on delete set null,
  status text not null default 'pending_oauth',
  error text,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint google_sheets_connection_drafts_status_check check (status in ('pending_oauth', 'ready', 'consumed', 'failed'))
);

create unique index if not exists google_sheets_connection_drafts_state_idx
  on private.google_sheets_connection_drafts(state_hash);
create index if not exists google_sheets_connection_drafts_actor_idx
  on private.google_sheets_connection_drafts(actor_owner_id, created_at);
create index if not exists google_sheets_connection_drafts_expires_idx
  on private.google_sheets_connection_drafts(expires_at);

alter table private.google_sheets_connection_drafts enable row level security;
revoke all on private.google_sheets_connection_drafts from public, anon, authenticated;
