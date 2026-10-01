-- A derived view may not be more visible than its physical source.
update public.datasets as derived
set is_workspace_visible = false
from public.datasets as source
where derived.backing_dataset_id = source.id
  and derived.is_workspace_visible
  and not source.is_workspace_visible;

create or replace function private.enforce_dataset_source_visibility()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_is_workspace_visible boolean;
begin
  if new.backing_dataset_id is not null and new.is_workspace_visible then
    select source.is_workspace_visible
    into source_is_workspace_visible
    from public.datasets as source
    where source.id = new.backing_dataset_id;

    if source_is_workspace_visible is distinct from true then
      raise exception 'A workspace-visible derived view requires a workspace-visible source.'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and new.backing_dataset_id is null
    and old.is_workspace_visible
    and not new.is_workspace_visible then
    update public.datasets
    set is_workspace_visible = false
    where backing_dataset_id = new.id
      and is_workspace_visible;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_dataset_source_visibility() from public;

-- Run after datasets_sync_workspace_visibility so legacy is_public writes are
-- checked against the normalized visibility value.
create trigger datasets_z_enforce_source_visibility
before insert or update of backing_dataset_id, is_workspace_visible, is_public
on public.datasets
for each row
execute function private.enforce_dataset_source_visibility();

-- Revoking a refresh session does not invalidate an issued access JWT. Keep
-- direct RLS access bound to a live session and a currently enabled account.
create or replace function private.is_active_workspace_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as account
    join auth.sessions as active_session on active_session.user_id = account.id
    where account.id = (select auth.uid())
      and account.deleted_at is null
      and (account.banned_until is null or account.banned_until <= now())
      and active_session.id::text = (select auth.jwt() ->> 'session_id')
      and (active_session.not_after is null or active_session.not_after > now())
  );
$$;

revoke all on function private.is_active_workspace_session() from public;
grant execute on function private.is_active_workspace_session() to authenticated;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'datasets',
    'dataset_rows',
    'dataset_versions',
    'dataset_version_rows',
    'filter_regions',
    'filter_region_countries',
    'field_definitions',
    'field_source_types',
    'field_definition_sources',
    'saved_dataset_tables'
  ] loop
    execute format(
      'create policy "active workspace session required" on public.%I as restrictive for all to authenticated using ((select private.is_active_workspace_session())) with check ((select private.is_active_workspace_session()))',
      relation_name
    );
  end loop;
end;
$$;

create policy "active workspace session required"
on storage.objects
as restrictive
for all
to authenticated
using ((select private.is_active_workspace_session()))
with check ((select private.is_active_workspace_session()));
