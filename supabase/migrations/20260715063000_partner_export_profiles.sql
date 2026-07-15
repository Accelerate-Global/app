alter table private.api_connections
  add column if not exists archived_by_owner_id text,
  add column if not exists archive_reason text,
  add column if not exists archived_at timestamp with time zone;

create index if not exists api_connections_provider_archived_idx
  on private.api_connections(provider, archived_at, updated_at);

with ranked_google_sheet_connections as (
  select
    id,
    row_number() over (
      partition by
        provider_config ->> 'spreadsheetId',
        provider_config ->> 'sheetId'
      order by updated_at desc, created_at desc, id desc
    ) as active_rank
  from private.api_connections
  where provider = 'google_sheets'
    and archived_at is null
)
update private.api_connections as connections
set
  archived_at = now(),
  archived_by_owner_id = connections.updated_by_owner_id,
  archive_reason = 'Archived duplicate during active Google Sheets source migration.',
  updated_at = now()
from ranked_google_sheet_connections as ranked
where connections.id = ranked.id
  and ranked.active_rank > 1;

create unique index if not exists api_connections_google_sheet_active_source_idx
  on private.api_connections (
    (provider_config ->> 'spreadsheetId'),
    (provider_config ->> 'sheetId')
  )
  where provider = 'google_sheets' and archived_at is null;

create table if not exists private.partner_export_profiles (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  name text not null,
  partner_key text not null,
  status text not null default 'active',
  file_name_stem text not null,
  revision integer not null default 1,
  created_by_owner_id text not null,
  updated_by_owner_id text not null,
  archived_by_owner_id text,
  archived_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint partner_export_profiles_name_check check (length(btrim(name)) between 1 and 120),
  constraint partner_export_profiles_partner_key_check check (partner_key in ('custom', 'joshua-project')),
  constraint partner_export_profiles_status_check check (status in ('active', 'archived')),
  constraint partner_export_profiles_file_name_stem_check check (length(btrim(file_name_stem)) between 1 and 160),
  constraint partner_export_profiles_revision_check check (revision >= 1),
  constraint partner_export_profiles_archive_state_check check (
    (status = 'active' and archived_at is null and archived_by_owner_id is null)
    or (status = 'archived' and archived_at is not null and archived_by_owner_id is not null)
  )
);

create index if not exists partner_export_profiles_dataset_status_idx
  on private.partner_export_profiles(dataset_id, status, updated_at);
create unique index if not exists partner_export_profiles_dataset_name_active_idx
  on private.partner_export_profiles(dataset_id, lower(btrim(name)))
  where archived_at is null;

alter table private.partner_export_profiles enable row level security;
revoke all on private.partner_export_profiles from public, anon, authenticated;

create table if not exists private.partner_export_profile_columns (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references private.partner_export_profiles(id) on delete cascade,
  ordinal integer not null,
  output_header text not null,
  source_column_keys jsonb not null default '[]'::jsonb,
  source_label_snapshot jsonb not null default '[]'::jsonb,
  transform text not null,
  literal_value text,
  required boolean not null default false,
  required_severity text not null default 'error',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint partner_export_profile_columns_ordinal_check check (ordinal >= 0),
  constraint partner_export_profile_columns_output_header_check check (length(btrim(output_header)) between 1 and 128),
  constraint partner_export_profile_columns_source_keys_check check (jsonb_typeof(source_column_keys) = 'array'),
  constraint partner_export_profile_columns_source_labels_check check (jsonb_typeof(source_label_snapshot) = 'array'),
  constraint partner_export_profile_columns_transform_check check (
    transform in ('copy', 'coalesce', 'literal', 'whole_number', 'iso_timestamp', 'non_negative_whole_number')
  ),
  constraint partner_export_profile_columns_required_severity_check check (required_severity in ('error', 'warning')),
  constraint partner_export_profile_columns_literal_check check (
    (transform = 'literal' and jsonb_array_length(source_column_keys) = 0)
    or transform <> 'literal'
  )
);

create unique index if not exists partner_export_profile_columns_profile_ordinal_idx
  on private.partner_export_profile_columns(profile_id, ordinal);
create unique index if not exists partner_export_profile_columns_profile_header_idx
  on private.partner_export_profile_columns(profile_id, lower(btrim(output_header)));

alter table private.partner_export_profile_columns enable row level security;
revoke all on private.partner_export_profile_columns from public, anon, authenticated;

create table if not exists private.partner_export_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references private.partner_export_profiles(id) on delete restrict,
  dataset_id uuid not null references public.datasets(id) on delete restrict,
  actor_owner_id text not null,
  actor_email text,
  status text not null,
  warnings_acknowledged boolean not null default false,
  profile_revision jsonb not null,
  source_snapshot jsonb not null,
  validation jsonb not null default '{"errorCount":0,"warningCount":0,"findings":[],"truncated":false}'::jsonb,
  row_count integer,
  output_checksum text,
  output_size_bytes integer,
  csv_storage_path text,
  crosswalk_storage_path text,
  validation_storage_path text,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint partner_export_runs_status_check check (status in ('queued', 'running', 'success', 'failed')),
  constraint partner_export_runs_row_count_check check (row_count is null or row_count >= 0),
  constraint partner_export_runs_output_size_check check (output_size_bytes is null or output_size_bytes >= 0)
);

create index if not exists partner_export_runs_profile_created_idx
  on private.partner_export_runs(profile_id, created_at);
create index if not exists partner_export_runs_dataset_created_idx
  on private.partner_export_runs(dataset_id, created_at);

alter table private.partner_export_runs enable row level security;
revoke all on private.partner_export_runs from public, anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'partner-export-artifacts',
  'partner-export-artifacts',
  false,
  26214400,
  array['text/csv', 'application/json']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();
