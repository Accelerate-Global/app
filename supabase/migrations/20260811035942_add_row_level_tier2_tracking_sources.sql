create or replace function private.valid_tier2_tracking_source_mappings(value jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when jsonb_typeof(value) <> 'array'
      or jsonb_array_length(value) > 50 then false
    else not exists (
      select 1
      from jsonb_array_elements(value) as mapping
      where jsonb_typeof(mapping) <> 'object'
        or btrim(coalesce(mapping ->> 'sourceValue', '')) = ''
        or mapping ->> 'trackingIdSource' not in (
          'peopleid3', 'peid', 'rop3', 'provider-native'
        )
    ) and not exists (
      select 1
      from jsonb_array_elements(value) as mapping
      group by lower(regexp_replace(btrim(mapping ->> 'sourceValue'), '\s+', ' ', 'g'))
      having count(*) > 1
    )
  end
$$;

revoke all on function private.valid_tier2_tracking_source_mappings(jsonb)
  from public, anon, authenticated;
grant execute on function private.valid_tier2_tracking_source_mappings(jsonb)
  to service_role;

alter table private.tier2_partner_profiles
  add column tracking_id_source_column text,
  add column tracking_id_source_mappings jsonb not null default '[]'::jsonb;

alter table private.tier2_partner_profiles
  alter column tracking_id_source drop not null,
  drop constraint if exists tier2_partner_profiles_columns_check,
  drop constraint if exists tier2_partner_profiles_tracking_check,
  drop constraint if exists tier2_partner_profiles_rop3_tracking_check;

alter table private.tier2_partner_profiles
  add constraint tier2_partner_profiles_columns_check check (
    btrim(stable_row_key_column) <> ''
    and btrim(tracking_id_column) <> ''
    and stable_row_key_column <> tracking_id_column
    and (
      tracking_id_source_column is null
      or (
        btrim(tracking_id_source_column) <> ''
        and tracking_id_source_column <> stable_row_key_column
        and tracking_id_source_column <> tracking_id_column
      )
    )
  ),
  add constraint tier2_partner_profiles_tracking_check check (
    tracking_id_source is null
    or tracking_id_source in ('peopleid3', 'peid', 'rop3', 'provider-native')
  ),
  add constraint tier2_partner_profiles_tracking_source_mappings_check check (
    private.valid_tier2_tracking_source_mappings(tracking_id_source_mappings)
  ),
  add constraint tier2_partner_profiles_tracking_mode_check check (
    (
      tracking_id_source is not null
      and tracking_id_source_column is null
      and tracking_id_source_mappings = '[]'::jsonb
    )
    or
    (
      tracking_id_source is null
      and tracking_id_source_column is not null
      and jsonb_array_length(tracking_id_source_mappings) > 0
    )
  ),
  add constraint tier2_partner_profiles_rop3_tracking_check check (
    tracking_id_source is distinct from 'rop3'
    or source_rop3_column is null
    or source_rop3_column = tracking_id_column
  );

create or replace function private.guard_tier2_partner_profile_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  profile_used boolean;
begin
  profile_used := (
    exists (select 1 from private.tier2_forming_runs where profile_id = old.id)
    or exists (
      select 1
      from private.ax_identity_source_bindings
      where legacy_import_id is not null
        and source_profile_key = old.profile_key
    )
  );

  if tg_op = 'DELETE' then
    if profile_used then
      raise exception 'A used Tier 2 profile cannot be deleted.';
    end if;
    return old;
  end if;

  if profile_used and (
    new.profile_key is distinct from old.profile_key
    or new.partner_key is distinct from old.partner_key
    or new.api_connection_id is distinct from old.api_connection_id
    or new.spreadsheet_id is distinct from old.spreadsheet_id
    or new.sheet_id is distinct from old.sheet_id
    or new.stable_row_key_column is distinct from old.stable_row_key_column
    or new.tracking_id_column is distinct from old.tracking_id_column
    or new.tracking_id_source is distinct from old.tracking_id_source
    or new.tracking_id_source_column is distinct from old.tracking_id_source_column
    or new.tracking_id_source_mappings is distinct from old.tracking_id_source_mappings
    or new.source_rop3_column is distinct from old.source_rop3_column
    or new.source_country_column is distinct from old.source_country_column
    or new.source_iso3_column is distinct from old.source_iso3_column
    or new.contract_version is distinct from old.contract_version
    or new.contract_checksum is distinct from old.contract_checksum
  ) then
    raise exception 'A used Tier 2 profile cannot change identity or forming fields.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
