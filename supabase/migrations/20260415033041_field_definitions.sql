create table if not exists public.field_definitions (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null,
  label text not null,
  definition text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_definitions_canonical_key_not_blank check (btrim(canonical_key) <> ''),
  constraint field_definitions_label_not_blank check (btrim(label) <> '')
);

create unique index if not exists field_definitions_canonical_key_idx
  on public.field_definitions (canonical_key);

create index if not exists field_definitions_label_lower_idx
  on public.field_definitions (lower(btrim(label)), created_at);

create or replace function private.normalize_field_definition()
returns trigger
language plpgsql
as $$
begin
  new.canonical_key := btrim(new.canonical_key);
  new.label := btrim(new.label);
  new.definition := coalesce(btrim(new.definition), '');
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.normalize_field_definition() from public;

drop trigger if exists field_definitions_normalize on public.field_definitions;

create trigger field_definitions_normalize
before insert or update on public.field_definitions
for each row
execute function private.normalize_field_definition();

with dataset_fields as (
  select distinct on (canonical_key)
    canonical_key,
    label
  from (
    select
      case
        when left(
          trim(
            both '_' from regexp_replace(
              regexp_replace(
                regexp_replace(
                  lower(btrim(column_data->>'label')),
                  '\s+',
                  '_',
                  'g'
                ),
                '[^a-z0-9_]',
                '_',
                'g'
              ),
              '_+',
              '_',
              'g'
            )
          ),
          96
        ) <> ''
          then left(
            trim(
              both '_' from regexp_replace(
                regexp_replace(
                  regexp_replace(
                    lower(btrim(column_data->>'label')),
                    '\s+',
                    '_',
                    'g'
                  ),
                  '[^a-z0-9_]',
                  '_',
                  'g'
                ),
                '_+',
                '_',
                'g'
              )
            ),
            96
          )
        else 'column_' || (coalesce((column_data->>'sourceIndex')::integer, 0) + 1)::text
      end as canonical_key,
      coalesce(
        nullif(btrim(column_data->>'label'), ''),
        'Column ' || (coalesce((column_data->>'sourceIndex')::integer, 0) + 1)::text
      ) as label,
      datasets.created_at,
      coalesce((column_data->>'sourceIndex')::integer, 0) as source_index
    from public.datasets as datasets
    cross join lateral jsonb_array_elements(datasets.columns) as column_data
  ) as extracted_fields
  order by canonical_key, created_at asc, source_index asc
)
insert into public.field_definitions (canonical_key, label)
select
  canonical_key,
  label
from dataset_fields
on conflict (canonical_key) do nothing;

alter table public.field_definitions enable row level security;

drop policy if exists "authenticated users can read field definitions"
  on public.field_definitions;
drop policy if exists "dataset admin can insert field definitions"
  on public.field_definitions;
drop policy if exists "dataset admin can update field definitions"
  on public.field_definitions;
drop policy if exists "dataset admin can delete field definitions"
  on public.field_definitions;

create policy "authenticated users can read field definitions"
  on public.field_definitions
  for select
  to authenticated
  using (true);

create policy "dataset admin can insert field definitions"
  on public.field_definitions
  for insert
  to authenticated
  with check (private.is_dataset_admin());

create policy "dataset admin can update field definitions"
  on public.field_definitions
  for update
  to authenticated
  using (private.is_dataset_admin())
  with check (private.is_dataset_admin());

create policy "dataset admin can delete field definitions"
  on public.field_definitions
  for delete
  to authenticated
  using (private.is_dataset_admin());
