alter table public.filter_regions
  add column if not exists description text not null default '',
  add column if not exists sort_order integer not null default 1;

create index if not exists filter_regions_sort_order_idx
  on public.filter_regions (sort_order, created_at);

with ranked_regions as (
  select
    id,
    row_number() over (
      order by sort_order asc, created_at asc, lower(btrim(name)) asc
    ) as next_sort_order
  from public.filter_regions
)
update public.filter_regions as regions
set sort_order = ranked_regions.next_sort_order
from ranked_regions
where regions.id = ranked_regions.id;

create or replace function private.normalize_filter_region()
returns trigger
language plpgsql
as $$
begin
  new.name := btrim(new.name);
  new.description := coalesce(btrim(new.description), '');
  new.sort_order := greatest(coalesce(new.sort_order, 1), 1);
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.normalize_filter_region() from public;
