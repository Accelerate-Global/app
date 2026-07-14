alter table public.datasets
  add column if not exists is_workspace_visible boolean;

update public.datasets
set is_workspace_visible = is_public
where is_workspace_visible is null;

alter table public.datasets
  alter column is_workspace_visible set default true,
  alter column is_workspace_visible set not null;

comment on column public.datasets.is_workspace_visible is
  'True when authenticated workspace members may access the dataset; never grants anonymous access.';

comment on column public.datasets.is_public is
  'Deprecated deployment-compatibility alias for is_workspace_visible. Do not use in new application contracts.';

create or replace function private.sync_dataset_workspace_visibility()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    -- The canonical field wins for new writes. Legacy deployments create
    -- workspace-visible datasets with both defaults and continue to use the
    -- legacy field for updates, which is synchronized below.
    new.is_public := new.is_workspace_visible;

    return new;
  end if;

  if new.is_workspace_visible is distinct from old.is_workspace_visible
     and new.is_public is not distinct from old.is_public then
    new.is_public := new.is_workspace_visible;
  elsif new.is_public is distinct from old.is_public
        and new.is_workspace_visible is not distinct from old.is_workspace_visible then
    new.is_workspace_visible := new.is_public;
  elsif new.is_workspace_visible is distinct from new.is_public then
    raise exception 'Dataset visibility columns must match.';
  end if;

  return new;
end;
$$;

revoke all on function private.sync_dataset_workspace_visibility() from public;

drop trigger if exists datasets_sync_workspace_visibility on public.datasets;
create trigger datasets_sync_workspace_visibility
before insert or update of is_public, is_workspace_visible
on public.datasets
for each row
execute function private.sync_dataset_workspace_visibility();

drop policy if exists "authenticated users can read shared datasets"
  on public.datasets;

create policy "authenticated users can read shared datasets"
  on public.datasets
  for select
  to authenticated
  using (is_workspace_visible or private.is_dataset_admin());

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
          public.datasets.is_workspace_visible
          or private.is_dataset_admin()
        )
    )
  );

-- Keep table privileges explicit across hosted and local Supabase versions.
-- RLS remains the authorization boundary for authenticated members; anonymous
-- clients receive no data-table privileges at all.
revoke all on table
  public.datasets,
  public.dataset_rows,
  public.dataset_versions,
  public.dataset_version_rows,
  public.filter_regions,
  public.filter_region_countries,
  public.field_definitions,
  public.field_source_types,
  public.field_definition_sources,
  public.saved_dataset_tables,
  public.signup_email_allowlist
from anon;

grant select, insert, update, delete on table
  public.datasets,
  public.dataset_rows,
  public.dataset_versions,
  public.dataset_version_rows,
  public.filter_regions,
  public.filter_region_countries,
  public.field_definitions,
  public.field_source_types,
  public.field_definition_sources,
  public.saved_dataset_tables
to authenticated;

revoke all on table public.signup_email_allowlist from authenticated;

grant all on table
  public.datasets,
  public.dataset_rows,
  public.dataset_versions,
  public.dataset_version_rows,
  public.filter_regions,
  public.filter_region_countries,
  public.field_definitions,
  public.field_source_types,
  public.field_definition_sources,
  public.saved_dataset_tables,
  public.signup_email_allowlist
to service_role;
