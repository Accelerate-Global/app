alter table public.datasets
  add column if not exists is_public boolean not null default true;

drop policy if exists "authenticated users can read shared datasets"
  on public.datasets;

create policy "authenticated users can read shared datasets"
  on public.datasets
  for select
  to authenticated
  using (is_public or private.is_dataset_admin());

drop policy if exists "authenticated users can read shared dataset rows"
  on public.dataset_rows;

create policy "authenticated users can read shared dataset rows"
  on public.dataset_rows
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.datasets
      where public.datasets.id = public.dataset_rows.dataset_id
        and (
          public.datasets.is_public
          or private.is_dataset_admin()
        )
    )
  );
