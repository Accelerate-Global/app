alter table public.datasets
  add column if not exists current_version_action text,
  add column if not exists current_version_actor_owner_id text,
  add column if not exists current_version_actor_email text,
  add column if not exists current_version_created_at timestamptz;

update public.datasets
set
  current_version_action = coalesce(current_version_action, 'upload'),
  current_version_actor_owner_id = coalesce(current_version_actor_owner_id, owner_id),
  current_version_created_at = coalesce(current_version_created_at, created_at);

alter table public.datasets
  alter column current_version_action set default 'upload',
  alter column current_version_action set not null,
  alter column current_version_actor_owner_id set not null,
  alter column current_version_created_at set default now(),
  alter column current_version_created_at set not null;

create table if not exists public.dataset_versions (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  file_name text not null,
  blob_url text not null,
  blob_path text not null,
  action text not null,
  actor_owner_id text not null,
  actor_email text,
  status text not null,
  row_count integer not null default 0,
  size_bytes integer not null,
  columns jsonb not null,
  error text,
  version_created_at timestamptz not null,
  archived_at timestamptz not null default now()
);

create index if not exists dataset_versions_dataset_version_created_idx
  on public.dataset_versions (dataset_id, version_created_at, archived_at);

create index if not exists dataset_versions_dataset_archived_idx
  on public.dataset_versions (dataset_id, archived_at);

create table if not exists public.dataset_version_rows (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.dataset_versions(id) on delete cascade,
  row_index integer not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists dataset_version_rows_version_row_idx
  on public.dataset_version_rows (version_id, row_index);

create index if not exists dataset_version_rows_version_idx
  on public.dataset_version_rows (version_id);

alter table public.dataset_versions enable row level security;
alter table public.dataset_version_rows enable row level security;

drop policy if exists "dataset admin can read dataset versions"
  on public.dataset_versions;
drop policy if exists "dataset admin can insert dataset versions"
  on public.dataset_versions;
drop policy if exists "dataset admin can update dataset versions"
  on public.dataset_versions;
drop policy if exists "dataset admin can delete dataset versions"
  on public.dataset_versions;

create policy "dataset admin can read dataset versions"
  on public.dataset_versions
  for select
  to authenticated
  using (private.is_dataset_admin());

create policy "dataset admin can insert dataset versions"
  on public.dataset_versions
  for insert
  to authenticated
  with check (private.is_dataset_admin());

create policy "dataset admin can update dataset versions"
  on public.dataset_versions
  for update
  to authenticated
  using (private.is_dataset_admin())
  with check (private.is_dataset_admin());

create policy "dataset admin can delete dataset versions"
  on public.dataset_versions
  for delete
  to authenticated
  using (private.is_dataset_admin());

drop policy if exists "dataset admin can read dataset version rows"
  on public.dataset_version_rows;
drop policy if exists "dataset admin can insert dataset version rows"
  on public.dataset_version_rows;
drop policy if exists "dataset admin can update dataset version rows"
  on public.dataset_version_rows;
drop policy if exists "dataset admin can delete dataset version rows"
  on public.dataset_version_rows;

create policy "dataset admin can read dataset version rows"
  on public.dataset_version_rows
  for select
  to authenticated
  using (private.is_dataset_admin());

create policy "dataset admin can insert dataset version rows"
  on public.dataset_version_rows
  for insert
  to authenticated
  with check (private.is_dataset_admin());

create policy "dataset admin can update dataset version rows"
  on public.dataset_version_rows
  for update
  to authenticated
  using (private.is_dataset_admin())
  with check (private.is_dataset_admin());

create policy "dataset admin can delete dataset version rows"
  on public.dataset_version_rows
  for delete
  to authenticated
  using (private.is_dataset_admin());
