alter table public.datasets
  add column if not exists backing_dataset_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'datasets_backing_dataset_id_fkey'
  ) then
    alter table public.datasets
      add constraint datasets_backing_dataset_id_fkey
      foreign key (backing_dataset_id)
      references public.datasets(id)
      on delete restrict;
  end if;
end
$$;

create index if not exists datasets_backing_dataset_idx
  on public.datasets (backing_dataset_id);

alter table public.datasets
  drop constraint if exists datasets_backing_dataset_primary_check;

alter table public.datasets
  add constraint datasets_backing_dataset_primary_check
  check (backing_dataset_id is null or is_primary = false);

alter table public.datasets
  drop constraint if exists datasets_backing_dataset_self_check;

alter table public.datasets
  add constraint datasets_backing_dataset_self_check
  check (backing_dataset_id is null or backing_dataset_id <> id);

create or replace function public.enforce_physical_backing_dataset()
returns trigger
language plpgsql
as $$
declare
  backing_target_backing_id uuid;
begin
  if new.backing_dataset_id is null then
    return new;
  end if;

  select datasets.backing_dataset_id
  into backing_target_backing_id
  from public.datasets
  where datasets.id = new.backing_dataset_id;

  if backing_target_backing_id is not null then
    raise exception 'Derived datasets must reference a physical dataset.';
  end if;

  if new.is_primary then
    raise exception 'Derived datasets cannot be primary.';
  end if;

  return new;
end
$$;

drop trigger if exists datasets_enforce_physical_backing_dataset
  on public.datasets;

create trigger datasets_enforce_physical_backing_dataset
  before insert or update of backing_dataset_id, is_primary
  on public.datasets
  for each row
  execute function public.enforce_physical_backing_dataset();

-- Backing dataset assignments stay explicit and data-driven.
-- Runtime support reads backing_dataset_id when present, and environments can
-- assign curated derived views to their primary source dataset with targeted
-- update statements once the exact dataset ids are known.
