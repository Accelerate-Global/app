alter table public.datasets
add column is_primary boolean not null default false;

create unique index if not exists datasets_single_primary_idx
on public.datasets (is_primary)
where is_primary;
