insert into public.field_definitions (canonical_key, label)
values ('christianity_frontier_group', 'Christianity_Frontier_Group')
on conflict (canonical_key) do nothing;

do $$
declare
  canonical_field_id uuid;
  alias_field_id uuid;
begin
  select id
  into canonical_field_id
  from public.field_definitions
  where canonical_key = 'christianity_frontier_group'
  limit 1;

  select id
  into alias_field_id
  from public.field_definitions
  where canonical_key = 'frontier_group'
  limit 1;

  if canonical_field_id is null or alias_field_id is null then
    return;
  end if;

  update public.field_definitions as canonical
  set
    display_label = case
      when btrim(coalesce(canonical.display_label, '')) = ''
        and btrim(coalesce(alias.display_label, '')) <> ''
      then alias.display_label
      else canonical.display_label
    end,
    definition = case
      when btrim(coalesce(canonical.definition, '')) = ''
        and btrim(coalesce(alias.definition, '')) <> ''
      then alias.definition
      else canonical.definition
    end,
    mapping_field_id = case
      when btrim(coalesce(canonical.mapping_field_id, '')) = ''
        and btrim(coalesce(alias.mapping_field_id, '')) <> ''
      then alias.mapping_field_id
      else canonical.mapping_field_id
    end,
    mapping_data_type = case
      when btrim(coalesce(canonical.mapping_data_type, '')) = ''
        and btrim(coalesce(alias.mapping_data_type, '')) <> ''
      then alias.mapping_data_type
      else canonical.mapping_data_type
    end,
    mapping_is_active = coalesce(
      canonical.mapping_is_active,
      alias.mapping_is_active
    ),
    source_priority_keys = case
      when jsonb_array_length(coalesce(canonical.source_priority_keys, '[]'::jsonb)) = 0
        and jsonb_array_length(coalesce(alias.source_priority_keys, '[]'::jsonb)) > 0
      then alias.source_priority_keys
      else canonical.source_priority_keys
    end
  from public.field_definitions as alias
  where canonical.id = canonical_field_id
    and alias.id = alias_field_id;

  insert into public.field_definition_sources (
    field_definition_id,
    source_type_id,
    source_field_name
  )
  select
    canonical_field_id,
    source_type_id,
    source_field_name
  from public.field_definition_sources
  where field_definition_id = alias_field_id
  on conflict (field_definition_id, source_type_id) do nothing;

  delete from public.field_definitions
  where id = alias_field_id;
end;
$$;
