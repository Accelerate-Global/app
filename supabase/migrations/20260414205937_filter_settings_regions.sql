create table if not exists public.filter_regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint filter_regions_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists filter_regions_name_lower_idx
  on public.filter_regions (lower(btrim(name)));

create table if not exists public.filter_region_countries (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.filter_regions(id) on delete cascade,
  country_name text not null,
  created_at timestamptz not null default now(),
  constraint filter_region_countries_name_not_blank check (btrim(country_name) <> '')
);

create index if not exists filter_region_countries_region_idx
  on public.filter_region_countries (region_id);

create unique index if not exists filter_region_countries_region_country_lower_idx
  on public.filter_region_countries (region_id, lower(btrim(country_name)));

create or replace function private.normalize_filter_region()
returns trigger
language plpgsql
as $$
begin
  new.name := btrim(new.name);
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.normalize_filter_region_country()
returns trigger
language plpgsql
as $$
begin
  new.country_name := btrim(new.country_name);
  return new;
end;
$$;

revoke all on function private.normalize_filter_region() from public;
revoke all on function private.normalize_filter_region_country() from public;

drop trigger if exists filter_regions_normalize on public.filter_regions;

create trigger filter_regions_normalize
before insert or update on public.filter_regions
for each row
execute function private.normalize_filter_region();

drop trigger if exists filter_region_countries_normalize on public.filter_region_countries;

create trigger filter_region_countries_normalize
before insert or update on public.filter_region_countries
for each row
execute function private.normalize_filter_region_country();

alter table public.filter_regions enable row level security;
alter table public.filter_region_countries enable row level security;

drop policy if exists "authenticated users can read filter regions"
  on public.filter_regions;
drop policy if exists "dataset admin can insert filter regions"
  on public.filter_regions;
drop policy if exists "dataset admin can update filter regions"
  on public.filter_regions;
drop policy if exists "dataset admin can delete filter regions"
  on public.filter_regions;

create policy "authenticated users can read filter regions"
  on public.filter_regions
  for select
  to authenticated
  using (true);

create policy "dataset admin can insert filter regions"
  on public.filter_regions
  for insert
  to authenticated
  with check (private.is_dataset_admin());

create policy "dataset admin can update filter regions"
  on public.filter_regions
  for update
  to authenticated
  using (private.is_dataset_admin())
  with check (private.is_dataset_admin());

create policy "dataset admin can delete filter regions"
  on public.filter_regions
  for delete
  to authenticated
  using (private.is_dataset_admin());

drop policy if exists "authenticated users can read filter region countries"
  on public.filter_region_countries;
drop policy if exists "dataset admin can insert filter region countries"
  on public.filter_region_countries;
drop policy if exists "dataset admin can update filter region countries"
  on public.filter_region_countries;
drop policy if exists "dataset admin can delete filter region countries"
  on public.filter_region_countries;

create policy "authenticated users can read filter region countries"
  on public.filter_region_countries
  for select
  to authenticated
  using (true);

create policy "dataset admin can insert filter region countries"
  on public.filter_region_countries
  for insert
  to authenticated
  with check (private.is_dataset_admin());

create policy "dataset admin can update filter region countries"
  on public.filter_region_countries
  for update
  to authenticated
  using (private.is_dataset_admin())
  with check (private.is_dataset_admin());

create policy "dataset admin can delete filter region countries"
  on public.filter_region_countries
  for delete
  to authenticated
  using (private.is_dataset_admin());
