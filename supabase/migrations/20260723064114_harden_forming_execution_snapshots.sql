alter table private.api_connection_runs
  add column if not exists source_profile_snapshot jsonb,
  add column if not exists source_profile_checksum text;

alter table private.api_connection_runs
  drop constraint if exists api_connection_runs_source_profile_snapshot_check,
  add constraint api_connection_runs_source_profile_snapshot_check check (
    (
      source_profile_snapshot is null
      and source_profile_checksum is null
    )
    or
    (
      jsonb_typeof(source_profile_snapshot) = 'object'
      and source_profile_snapshot ->> 'schemaVersion' = '1'
      and btrim(source_profile_snapshot ->> 'connectionId') <> ''
      and source_profile_snapshot ->> 'connectionId' = connection_id::text
      and btrim(source_profile_snapshot ->> 'sourceProfileKey') <> ''
      and btrim(source_profile_snapshot ->> 'sourceProfileLabel') <> ''
      and btrim(source_profile_snapshot ->> 'engineKey') <> ''
      and btrim(source_profile_snapshot ->> 'engineLabel') <> ''
      and btrim(source_profile_snapshot ->> 'engineVersion') <> ''
      and (source_profile_snapshot ->> 'engineChecksum') ~ '^[0-9a-f]{64}$'
      and (source_profile_snapshot ->> 'artifactSchemaVersion') ~ '^[1-9][0-9]*$'
      and btrim(source_profile_snapshot ->> 'publicationTargetKey') <> ''
      and jsonb_typeof(source_profile_snapshot -> 'configurable') = 'boolean'
      and (
        source_profile_snapshot -> 'stableKeyColumn' = 'null'::jsonb
        or btrim(source_profile_snapshot ->> 'stableKeyColumn') <> ''
      )
      and source_profile_checksum ~ '^[0-9a-f]{64}$'
    )
  );

comment on column private.api_connection_runs.source_profile_snapshot is
  'Immutable source-profile, engine, and stable-key configuration captured when the ingestion run is created.';
comment on column private.api_connection_runs.source_profile_checksum is
  'SHA-256 checksum of the canonical immutable source-profile snapshot.';

create or replace function private.guard_api_connection_run_source_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source_profile_snapshot is distinct from old.source_profile_snapshot
    or new.source_profile_checksum is distinct from old.source_profile_checksum
  then
    raise exception 'API connection run source-profile snapshots are immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists api_connection_runs_source_snapshot_immutable
  on private.api_connection_runs;
create trigger api_connection_runs_source_snapshot_immutable
before update on private.api_connection_runs
for each row execute function private.guard_api_connection_run_source_snapshot();

alter table private.dataset_forming_runs
  add column if not exists attempt_number integer,
  add column if not exists execution_claimed_at timestamptz;

-- Existing finalized runs are append-only. Temporarily suspend only that
-- guard while assigning deterministic attempt numbers to the new column;
-- all other table triggers remain active, and a migration failure rolls this
-- trigger change back with the transaction.
alter table private.dataset_forming_runs
  disable trigger dataset_forming_runs_immutable;

with numbered as (
  select
    id,
    row_number() over (
      partition by source_run_id, resource_set_id, input_fingerprint
      order by created_at, id
    ) as attempt_number
  from private.dataset_forming_runs
)
update private.dataset_forming_runs as run
set attempt_number = numbered.attempt_number
from numbered
where numbered.id = run.id
  and run.attempt_number is null;

alter table private.dataset_forming_runs
  enable trigger dataset_forming_runs_immutable;

alter table private.dataset_forming_runs
  alter column attempt_number set default 1,
  alter column attempt_number set not null,
  drop constraint if exists dataset_forming_runs_attempt_number_check,
  add constraint dataset_forming_runs_attempt_number_check
    check (attempt_number > 0);

create unique index if not exists dataset_forming_runs_fingerprint_attempt_idx
  on private.dataset_forming_runs(
    source_run_id,
    resource_set_id,
    input_fingerprint,
    attempt_number
  );

create index if not exists dataset_forming_runs_unclaimed_execution_idx
  on private.dataset_forming_runs(created_at, id)
  where status = 'building' and execution_claimed_at is null;

comment on column private.dataset_forming_runs.attempt_number is
  'Monotonic attempt within one exact source/resource/engine input fingerprint.';
comment on column private.dataset_forming_runs.execution_claimed_at is
  'Atomic durable execution claim; only the first callback may transition this value from null.';

create or replace function private.guard_dataset_forming_execution_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.attempt_number is distinct from old.attempt_number then
    raise exception 'Dataset forming attempt numbers are immutable.';
  end if;

  if new.execution_claimed_at is distinct from old.execution_claimed_at
    and not (
      old.status = 'building'
      and old.execution_claimed_at is null
      and new.execution_claimed_at is not null
    )
  then
    raise exception 'Dataset forming execution claims are immutable.';
  end if;

  return new;
end;
$$;

drop trigger if exists dataset_forming_runs_execution_metadata_immutable
  on private.dataset_forming_runs;
create trigger dataset_forming_runs_execution_metadata_immutable
before update on private.dataset_forming_runs
for each row execute function private.guard_dataset_forming_execution_metadata();

revoke execute on function private.guard_api_connection_run_source_snapshot()
  from public, anon, authenticated;
revoke execute on function private.guard_dataset_forming_execution_metadata()
  from public, anon, authenticated;
grant execute on function private.guard_api_connection_run_source_snapshot()
  to service_role;
grant execute on function private.guard_dataset_forming_execution_metadata()
  to service_role;
