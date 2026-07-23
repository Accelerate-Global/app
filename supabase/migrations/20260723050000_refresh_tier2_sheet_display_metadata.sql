-- A Google Sheet tab title is mutable display metadata. Refreshing it must not
-- invalidate an already launched flow whose immutable spreadsheet_id/sheet_id
-- and execution contract are unchanged.
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
  ) then
    raise exception 'A used Tier 2 profile cannot change stable identity fields.';
  end if;

  if row(
    new.profile_key, new.partner_key, new.display_name,
    new.api_connection_id, new.spreadsheet_id, new.sheet_id,
    new.stable_row_key_column, new.tracking_id_column,
    new.tracking_id_source, new.source_rop3_column,
    new.source_country_column, new.source_iso3_column,
    new.contract_version, new.contract_checksum, new.active,
    new.created_by_owner_id, new.updated_by_owner_id
  ) is not distinct from row(
    old.profile_key, old.partner_key, old.display_name,
    old.api_connection_id, old.spreadsheet_id, old.sheet_id,
    old.stable_row_key_column, old.tracking_id_column,
    old.tracking_id_source, old.source_rop3_column,
    old.source_country_column, old.source_iso3_column,
    old.contract_version, old.contract_checksum, old.active,
    old.created_by_owner_id, old.updated_by_owner_id
  ) and new.sheet_title is distinct from old.sheet_title then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;
