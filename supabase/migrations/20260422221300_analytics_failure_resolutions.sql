create table if not exists private.analytics_failure_resolutions (
  fingerprint text primary key,
  resolved_by_owner_id text not null,
  resolved_at timestamp with time zone not null default now()
);

create index if not exists analytics_failure_resolutions_resolved_at_idx
  on private.analytics_failure_resolutions (resolved_at desc);

alter table private.analytics_failure_resolutions enable row level security;

revoke all on private.analytics_failure_resolutions from public;
revoke all on private.analytics_failure_resolutions from anon;
revoke all on private.analytics_failure_resolutions from authenticated;
