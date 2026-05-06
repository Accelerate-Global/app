create table if not exists private.iso_country_code_entry_overrides (
  display_name text primary key,
  alternative_names jsonb not null default '[]'::jsonb,
  updated_by_owner_id text not null,
  updated_at timestamp with time zone not null default now(),
  constraint iso_country_code_entry_overrides_display_name_check
    check (btrim(display_name) <> ''),
  constraint iso_country_code_entry_overrides_alternative_names_check
    check (jsonb_typeof(alternative_names) = 'array')
);

create index if not exists iso_country_code_entry_overrides_updated_idx
  on private.iso_country_code_entry_overrides(updated_at desc);

alter table private.iso_country_code_entry_overrides enable row level security;
revoke all on private.iso_country_code_entry_overrides from public, anon, authenticated;
