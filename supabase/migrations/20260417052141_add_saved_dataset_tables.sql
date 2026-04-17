create table if not exists public.saved_dataset_tables (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  name text not null,
  details text not null default '',
  filters jsonb not null,
  saved_row_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_dataset_tables_owner_created_idx
  on public.saved_dataset_tables (owner_id, created_at);

create index if not exists saved_dataset_tables_owner_dataset_idx
  on public.saved_dataset_tables (owner_id, dataset_id, created_at);

create index if not exists saved_dataset_tables_dataset_idx
  on public.saved_dataset_tables (dataset_id);

alter table public.saved_dataset_tables enable row level security;

drop policy if exists "users can read own saved dataset tables"
  on public.saved_dataset_tables;
drop policy if exists "users can insert own saved dataset tables"
  on public.saved_dataset_tables;
drop policy if exists "users can update own saved dataset tables"
  on public.saved_dataset_tables;
drop policy if exists "users can delete own saved dataset tables"
  on public.saved_dataset_tables;

create policy "users can read own saved dataset tables"
  on public.saved_dataset_tables
  for select
  to authenticated
  using (owner_id = auth.uid()::text);

create policy "users can insert own saved dataset tables"
  on public.saved_dataset_tables
  for insert
  to authenticated
  with check (owner_id = auth.uid()::text);

create policy "users can update own saved dataset tables"
  on public.saved_dataset_tables
  for update
  to authenticated
  using (owner_id = auth.uid()::text)
  with check (owner_id = auth.uid()::text);

create policy "users can delete own saved dataset tables"
  on public.saved_dataset_tables
  for delete
  to authenticated
  using (owner_id = auth.uid()::text);
