alter table if exists public.field_definitions
add column if not exists display_label text not null default '';

create or replace function private.normalize_field_definition()
returns trigger
language plpgsql
as $$
begin
  new.canonical_key := btrim(new.canonical_key);
  new.label := btrim(new.label);
  new.display_label := coalesce(btrim(new.display_label), '');
  new.definition := coalesce(btrim(new.definition), '');
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.normalize_field_definition() from public;
