create or replace function private.sync_dataset_private_tag()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  tags_without_private jsonb;
begin
  select coalesce(jsonb_agg(tag.value order by tag.ordinality), '[]'::jsonb)
  into tags_without_private
  from jsonb_array_elements(new.tags) with ordinality as tag(value, ordinality)
  where coalesce(lower(btrim(tag.value ->> 'label')), '') <> 'private';

  if new.is_workspace_visible then
    new.tags := tags_without_private;
  else
    new.tags := tags_without_private || jsonb_build_array(
      jsonb_build_object(
        'id', 'dataset-visibility-private',
        'label', 'Private',
        'color', '#dc2626'
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function private.sync_dataset_private_tag() from public;

drop trigger if exists datasets_zz_sync_private_tag on public.datasets;
create trigger datasets_zz_sync_private_tag
before insert or update of tags, is_public, is_workspace_visible
on public.datasets
for each row
execute function private.sync_dataset_private_tag();

-- Backfill restricted datasets and remove any user-authored Private variants
-- from workspace-visible datasets without disturbing classification or custom tags.
update public.datasets
set tags = tags;
