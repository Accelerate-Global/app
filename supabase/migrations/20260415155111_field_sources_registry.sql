alter table if exists public.field_definitions
add column if not exists mapping_field_id text,
add column if not exists mapping_data_type text,
add column if not exists mapping_is_active boolean,
add column if not exists source_priority_keys jsonb not null default '[]'::jsonb;

create table if not exists public.field_source_types (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_source_types_key_not_blank check (btrim(key) <> ''),
  constraint field_source_types_label_not_blank check (btrim(label) <> '')
);

create unique index if not exists field_source_types_key_idx
  on public.field_source_types (key);

create unique index if not exists field_source_types_label_lower_idx
  on public.field_source_types (lower(btrim(label)));

create index if not exists field_source_types_sort_order_idx
  on public.field_source_types (sort_order, created_at);

create table if not exists public.field_definition_sources (
  id uuid primary key default gen_random_uuid(),
  field_definition_id uuid not null references public.field_definitions (id) on delete cascade,
  source_type_id uuid not null references public.field_source_types (id) on delete cascade,
  source_field_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_definition_sources_source_field_name_not_blank check (btrim(source_field_name) <> '')
);

create unique index if not exists field_definition_sources_field_source_idx
  on public.field_definition_sources (field_definition_id, source_type_id);

create index if not exists field_definition_sources_source_type_idx
  on public.field_definition_sources (source_type_id);

create or replace function private.normalize_field_source_type()
returns trigger
language plpgsql
as $$
begin
  new.key := btrim(new.key);
  new.label := btrim(new.label);
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.normalize_field_source_type() from public;

drop trigger if exists field_source_types_normalize on public.field_source_types;

create trigger field_source_types_normalize
before insert or update on public.field_source_types
for each row
execute function private.normalize_field_source_type();

create or replace function private.normalize_field_definition_source()
returns trigger
language plpgsql
as $$
begin
  new.source_field_name := btrim(new.source_field_name);
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.normalize_field_definition_source() from public;

drop trigger if exists field_definition_sources_normalize on public.field_definition_sources;

create trigger field_definition_sources_normalize
before insert or update on public.field_definition_sources
for each row
execute function private.normalize_field_definition_source();

alter table public.field_source_types enable row level security;
alter table public.field_definition_sources enable row level security;

drop policy if exists "authenticated users can read field source types"
  on public.field_source_types;
drop policy if exists "dataset admin can insert field source types"
  on public.field_source_types;
drop policy if exists "dataset admin can update field source types"
  on public.field_source_types;
drop policy if exists "dataset admin can delete field source types"
  on public.field_source_types;

create policy "authenticated users can read field source types"
  on public.field_source_types
  for select
  to authenticated
  using (true);

create policy "dataset admin can insert field source types"
  on public.field_source_types
  for insert
  to authenticated
  with check (private.is_dataset_admin());

create policy "dataset admin can update field source types"
  on public.field_source_types
  for update
  to authenticated
  using (private.is_dataset_admin())
  with check (private.is_dataset_admin());

create policy "dataset admin can delete field source types"
  on public.field_source_types
  for delete
  to authenticated
  using (private.is_dataset_admin());

drop policy if exists "authenticated users can read field definition sources"
  on public.field_definition_sources;
drop policy if exists "dataset admin can insert field definition sources"
  on public.field_definition_sources;
drop policy if exists "dataset admin can update field definition sources"
  on public.field_definition_sources;
drop policy if exists "dataset admin can delete field definition sources"
  on public.field_definition_sources;

create policy "authenticated users can read field definition sources"
  on public.field_definition_sources
  for select
  to authenticated
  using (true);

create policy "dataset admin can insert field definition sources"
  on public.field_definition_sources
  for insert
  to authenticated
  with check (private.is_dataset_admin());

create policy "dataset admin can update field definition sources"
  on public.field_definition_sources
  for update
  to authenticated
  using (private.is_dataset_admin())
  with check (private.is_dataset_admin());

create policy "dataset admin can delete field definition sources"
  on public.field_definition_sources
  for delete
  to authenticated
  using (private.is_dataset_admin());
