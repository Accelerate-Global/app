alter table private.dataset_forming_runs
  add column if not exists publication_id uuid
    references private.pipeline_publications(id) on delete restrict;

alter table private.dataset_forming_runs
  add column if not exists publishing_started_at timestamptz;

alter table private.dataset_forming_runs
  add column if not exists expected_current_publication_id uuid
    references private.pipeline_publications(id) on delete restrict;

create unique index if not exists dataset_forming_runs_publication_idx
  on private.dataset_forming_runs(publication_id)
  where publication_id is not null;

comment on column private.dataset_forming_runs.publication_id is
  'Immutable dataset-forming publication created atomically with a newly published formed dataset.';
comment on column private.dataset_forming_runs.publishing_started_at is
  'Lease timestamp for recovering a publication interrupted before its database commit.';
comment on column private.dataset_forming_runs.expected_current_publication_id is
  'Exact dataset-forming publication that was current for this target when the candidate was created; null means the target was empty.';

create or replace function private.guard_dataset_forming_run_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Dataset forming run history is append-only.';
  end if;

  if old.status in ('published', 'rejected', 'failed') and new is distinct from old then
    raise exception 'Final dataset forming run history is immutable.';
  end if;

  if old.status <> 'building' and (
    new.connection_id is distinct from old.connection_id
    or new.source_run_id is distinct from old.source_run_id
    or new.resource_set_id is distinct from old.resource_set_id
    or new.source_profile_key is distinct from old.source_profile_key
    or new.engine_key is distinct from old.engine_key
    or new.artifact_schema_version is distinct from old.artifact_schema_version
    or new.input_fingerprint is distinct from old.input_fingerprint
    or new.publication_target_key is distinct from old.publication_target_key
    or new.expected_current_publication_id is distinct from old.expected_current_publication_id
    or new.actor_owner_id is distinct from old.actor_owner_id
    or new.actor_email is distinct from old.actor_email
    or new.source_rows_checksum is distinct from old.source_rows_checksum
    or new.source_raw_checksum is distinct from old.source_raw_checksum
    or new.field_contract_version is distinct from old.field_contract_version
    or new.field_contract_checksum is distinct from old.field_contract_checksum
    or new.transformation_version is distinct from old.transformation_version
    or new.transformation_checksum is distinct from old.transformation_checksum
    or new.input_row_count is distinct from old.input_row_count
    or new.output_row_count is distinct from old.output_row_count
    or new.warning_count is distinct from old.warning_count
    or new.error_count is distinct from old.error_count
    or new.validation_summary is distinct from old.validation_summary
    or new.artifact_manifest is distinct from old.artifact_manifest
    or new.output_checksum is distinct from old.output_checksum
    or new.output_size_bytes is distinct from old.output_size_bytes
    or new.started_at is distinct from old.started_at
    or new.completed_at is distinct from old.completed_at
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Finalized dataset forming bindings and payload metadata are immutable.';
  end if;

  if (
    new.dataset_id is distinct from old.dataset_id
    or new.publication_id is distinct from old.publication_id
    or new.publication_reason is distinct from old.publication_reason
    or new.warnings_acknowledged is distinct from old.warnings_acknowledged
    or new.published_by_owner_id is distinct from old.published_by_owner_id
    or new.published_at is distinct from old.published_at
  ) and not (old.status = 'publishing' and new.status = 'published') then
    raise exception 'Dataset forming publication metadata may only be set during publication.';
  end if;

  if (
    new.rejection_reason is distinct from old.rejection_reason
    or new.rejected_by_owner_id is distinct from old.rejected_by_owner_id
    or new.rejected_at is distinct from old.rejected_at
  ) and not (old.status in ('valid', 'invalid') and new.status = 'rejected') then
    raise exception 'Dataset forming rejection metadata may only be set during rejection.';
  end if;

  return new;
end;
$$;
