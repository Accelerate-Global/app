create table if not exists private.source_profile_bindings (
  connection_id uuid primary key
    references private.api_connections(id) on delete restrict,
  source_profile_key text not null,
  stable_key_column text not null,
  configured_by_owner_id text not null,
  configured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_profile_bindings_profile_check check (
    source_profile_key in (
      'accelerate-owned-people-groups',
      'wcd-people-groups'
    )
  ),
  constraint source_profile_bindings_stable_key_check
    check (btrim(stable_key_column) <> ''),
  constraint source_profile_bindings_actor_check
    check (btrim(configured_by_owner_id) <> '')
);

create unique index if not exists source_profile_bindings_source_profile_unique
  on private.source_profile_bindings(source_profile_key);

create or replace function private.guard_source_profile_binding()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  connection_provider text;
  archived_at timestamptz;
begin
  select provider, api_connections.archived_at
  into connection_provider, archived_at
  from private.api_connections
  where id = new.connection_id;

  if connection_provider is distinct from 'google_sheets' then
    raise exception 'Only Google Sheets connections can use configurable source profiles.';
  end if;

  if archived_at is not null then
    raise exception 'Archived connections cannot receive source profile bindings.';
  end if;

  new.source_profile_key := btrim(new.source_profile_key);
  new.stable_key_column := btrim(new.stable_key_column);
  new.configured_by_owner_id := btrim(new.configured_by_owner_id);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists source_profile_bindings_guard
  on private.source_profile_bindings;
create trigger source_profile_bindings_guard
before insert or update on private.source_profile_bindings
for each row execute function private.guard_source_profile_binding();

alter table private.source_profile_bindings enable row level security;

revoke all on private.source_profile_bindings from public, anon, authenticated;
grant all on private.source_profile_bindings to service_role;
