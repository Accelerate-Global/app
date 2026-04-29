create table if not exists private.analytics_failure_triage (
  fingerprint text primary key,
  status text not null default 'needs_review',
  note text not null default '',
  triaged_by_owner_id text not null,
  triaged_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint analytics_failure_triage_status_check
    check (status in ('needs_review', 'debugging', 'expected', 'resolved')),
  constraint analytics_failure_triage_note_length_check
    check (char_length(note) <= 500)
);

insert into private.analytics_failure_triage (
  fingerprint,
  status,
  note,
  triaged_by_owner_id,
  triaged_at,
  created_at,
  updated_at
)
select
  fingerprint,
  'resolved',
  '',
  resolved_by_owner_id,
  resolved_at,
  resolved_at,
  resolved_at
from private.analytics_failure_resolutions
on conflict (fingerprint) do update
set
  status = excluded.status,
  note = excluded.note,
  triaged_by_owner_id = excluded.triaged_by_owner_id,
  triaged_at = excluded.triaged_at,
  updated_at = excluded.updated_at;

create index if not exists analytics_failure_triage_status_triaged_at_idx
  on private.analytics_failure_triage (status, triaged_at desc);

create index if not exists analytics_failure_triage_updated_at_idx
  on private.analytics_failure_triage (updated_at desc);

alter table private.analytics_failure_triage enable row level security;

revoke all on private.analytics_failure_triage from public;
revoke all on private.analytics_failure_triage from anon;
revoke all on private.analytics_failure_triage from authenticated;

drop table if exists private.analytics_failure_resolutions;
