create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists private.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  route text not null,
  source_surface text not null,
  actor_owner_id text not null,
  workspace_role text not null,
  success boolean not null,
  error_code text,
  duration_ms integer,
  dataset_id uuid,
  saved_table_id uuid,
  target_user_id text,
  event_props jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists analytics_events_created_at_idx
  on private.analytics_events (created_at desc);

create index if not exists analytics_events_event_name_created_at_idx
  on private.analytics_events (event_name, created_at desc);

create index if not exists analytics_events_route_created_at_idx
  on private.analytics_events (route, created_at desc);

create index if not exists analytics_events_success_created_at_idx
  on private.analytics_events (success, created_at desc);

create index if not exists analytics_events_actor_owner_created_at_idx
  on private.analytics_events (actor_owner_id, created_at desc);

alter table private.analytics_events enable row level security;

revoke all on private.analytics_events from public;
revoke all on private.analytics_events from anon;
revoke all on private.analytics_events from authenticated;
