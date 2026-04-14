alter table public.datasets
add column sort_order integer;

with ranked_datasets as (
  select
    id,
    row_number() over (order by created_at desc, id desc) - 1 as sort_order
  from public.datasets
)
update public.datasets
set sort_order = ranked_datasets.sort_order
from ranked_datasets
where ranked_datasets.id = public.datasets.id;

alter table public.datasets
alter column sort_order set default 0;

alter table public.datasets
alter column sort_order set not null;

create index if not exists datasets_sort_order_idx
on public.datasets (sort_order, created_at);
