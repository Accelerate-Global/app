create extension if not exists pgcrypto;

create table if not exists datasets (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  file_name text not null,
  blob_url text not null,
  blob_path text not null,
  status text not null default 'processing',
  row_count integer not null default 0,
  size_bytes integer not null,
  columns jsonb not null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists datasets_owner_created_idx
  on datasets (owner_id, created_at);

create table if not exists dataset_rows (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references datasets(id) on delete cascade,
  row_index integer not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists dataset_rows_dataset_row_idx
  on dataset_rows (dataset_id, row_index);

create index if not exists dataset_rows_dataset_idx
  on dataset_rows (dataset_id);
