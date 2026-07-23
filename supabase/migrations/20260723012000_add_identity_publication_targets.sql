alter table private.ax_identity_runs
  add column if not exists publication_target_key text,
  add column if not exists expected_current_publication_id uuid
    references private.pipeline_publications(id) on delete restrict,
  add column if not exists publication_attempt_id uuid,
  add column if not exists publishing_started_at timestamptz,
  add column if not exists publication_blob_path text;

-- Historical publications are immutable at runtime. Suspend only that trigger
-- for this one-time, transaction-scoped metadata backfill, then restore it
-- before any application statement can observe the migrated schema.
drop trigger if exists pipeline_publications_immutable
  on private.pipeline_publications;

update private.pipeline_publications
set publication_target_key = 'identity-' || source_profile_key
where producer_kind = 'identity'
  and publication_target_key is null
  and source_profile_key is not null;

create trigger pipeline_publications_immutable
before update or delete on private.pipeline_publications
for each row execute function private.guard_ax_immutable_history();

drop trigger if exists ax_identity_runs_lifecycle
  on private.ax_identity_runs;

update private.ax_identity_runs
set publication_target_key = 'identity-' || source_profile_key
where publication_target_key is null;

update private.ax_identity_runs
set status = 'valid', publication_attempt_id = null,
  publishing_started_at = null, publication_blob_path = null,
  error_message = 'An identity publication interrupted by the target-safety migration was recovered.'
where status = 'publishing' and publication_id is null;

create trigger ax_identity_runs_lifecycle
before update or delete on private.ax_identity_runs
for each row execute function private.guard_ax_identity_run();

alter table private.ax_identity_runs
  alter column publication_target_key set not null,
  drop constraint if exists ax_identity_runs_publication_target_check,
  add constraint ax_identity_runs_publication_target_check
    check (publication_target_key ~ '^[a-z][a-z0-9-]*$'),
  drop constraint if exists ax_identity_runs_publication_blob_path_check,
  add constraint ax_identity_runs_publication_blob_path_check
    check (publication_blob_path is null or publication_blob_path like 'datasets/csv/%');

create index if not exists ax_identity_runs_publication_target_idx
  on private.ax_identity_runs(publication_target_key, created_at desc, id);

create index if not exists ax_identity_runs_expected_publication_idx
  on private.ax_identity_runs(expected_current_publication_id)
  where expected_current_publication_id is not null;

create index if not exists ax_identity_runs_publication_lease_idx
  on private.ax_identity_runs(publishing_started_at, id)
  where status = 'publishing';

create unique index if not exists ax_identity_runs_publishing_target_idx
  on private.ax_identity_runs(publication_target_key)
  where status = 'publishing';

comment on column private.ax_identity_runs.publication_target_key is
  'Stable per-source identity publication target. Every publication replaces this target dataset and archives its prior version.';
comment on column private.ax_identity_runs.expected_current_publication_id is
  'Identity publication that was current for the stable target when this candidate was built. Null means the target did not exist.';
comment on column private.ax_identity_runs.publication_attempt_id is
  'Opaque lease token that prevents a recovered publication attempt from committing.';

create or replace function private.guard_ax_identity_publication_pin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.publication_target_key is distinct from old.publication_target_key
    or new.expected_current_publication_id is distinct from old.expected_current_publication_id
  then
    raise exception 'The AX identity publication target pin is immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists ax_identity_runs_publication_pin_immutable
  on private.ax_identity_runs;
create trigger ax_identity_runs_publication_pin_immutable
before update on private.ax_identity_runs
for each row execute function private.guard_ax_identity_publication_pin();

create or replace function private.finalize_ax_identity_publication(
  p_identity_run_id uuid,
  p_dataset_id uuid,
  p_publication_attempt_id uuid,
  p_dataset_created boolean,
  p_actor_owner_id text,
  p_actor_email text,
  p_reason text
)
returns table (revision_id uuid, publication_id uuid, dataset_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.ax_identity_runs%rowtype;
  prior_revision_id uuid;
  current_publication_id uuid;
  current_dataset_id uuid;
  new_revision_id uuid;
  new_publication_id uuid;
  binding_checksum text;
  active_binding_count integer;
  current_row_evidence_checksum text;
  dataset_row_evidence_checksum text;
  updated_count integer;
begin
  if p_identity_run_id is null or p_dataset_id is null
    or p_publication_attempt_id is null or p_dataset_created is null
    or p_actor_owner_id is null or btrim(p_actor_owner_id) = ''
    or p_reason is null or btrim(p_reason) = ''
  then
    raise exception 'AX identity publication inputs are invalid.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ax-identity-publication', 11)
  );

  select * into run_record
  from private.ax_identity_runs
  where id = p_identity_run_id
  for update;

  if not found then
    raise exception 'AX identity candidate does not exist.' using errcode = 'P0002';
  end if;

  if run_record.status = 'published' then
    return query
      select run_record.registry_revision_id, run_record.publication_id, run_record.dataset_id;
    return;
  end if;

  if run_record.status <> 'publishing'
    or run_record.publication_attempt_id is distinct from p_publication_attempt_id
    or run_record.error_count <> 0 or run_record.conflict_count <> 0
    or run_record.unassignable_count <> 0 or run_record.output_checksum is null
  then
    raise exception 'AX identity candidate is not owned by this publication attempt.'
      using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'ax-identity-publication:' || run_record.publication_target_key,
      391743
    )
  );

  select publication.id, publication.dataset_id
  into current_publication_id, current_dataset_id
  from private.pipeline_publications as publication
  where publication.producer_kind = 'identity'
    and publication.publication_target_key = run_record.publication_target_key
  order by publication.created_at desc, publication.id desc
  limit 1;

  if current_publication_id is distinct from run_record.expected_current_publication_id then
    raise exception 'The AX identity publication target changed after this candidate was built.'
      using errcode = '40001';
  end if;

  if (run_record.expected_current_publication_id is null and not p_dataset_created)
    or (run_record.expected_current_publication_id is not null and p_dataset_created)
    or (run_record.expected_current_publication_id is not null
      and current_dataset_id is distinct from p_dataset_id)
  then
    raise exception 'The AX identity dataset does not match the pinned publication target.'
      using errcode = '23514';
  end if;

  if (select count(*) from private.ax_identity_run_rows
      where identity_run_id = p_identity_run_id) <> run_record.output_row_count
  then
    raise exception 'AX identity candidate row evidence is incomplete.' using errcode = '23514';
  end if;

  select encode(extensions.digest(
    coalesce(jsonb_agg(jsonb_build_object(
      'sourceRowIndex', source_row_index,
      'data', enriched_row
    ) order by source_row_index)::text, '[]'),
    'sha256'
  ), 'hex')
  into current_row_evidence_checksum
  from private.ax_identity_run_rows
  where identity_run_id = p_identity_run_id;

  select encode(extensions.digest(
    coalesce(jsonb_agg(jsonb_build_object(
      'sourceRowIndex', row_index,
      'data', data
    ) order by row_index)::text, '[]'),
    'sha256'
  ), 'hex')
  into dataset_row_evidence_checksum
  from public.dataset_rows as dataset_row
  where dataset_row.dataset_id = p_dataset_id;

  if run_record.row_evidence_checksum is null
    or current_row_evidence_checksum is distinct from run_record.row_evidence_checksum
    or dataset_row_evidence_checksum is distinct from run_record.row_evidence_checksum
  then
    raise exception 'AX identity dataset rows do not match the reviewed candidate evidence.'
      using errcode = '23514';
  end if;

  select id into prior_revision_id
  from private.ax_registry_revisions
  order by revision_number desc
  limit 1;

  update private.ax_identity_source_bindings
  set binding_state = 'active', reserved_until = null, activated_at = now()
  where identity_run_id = p_identity_run_id and binding_state = 'reserved';

  update private.ax_identities
  set lifecycle_state = 'active', activated_at = coalesce(activated_at, now())
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'reserved';

  update private.ax_identity_codes
  set lifecycle_state = 'active'
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'reserved';

  select count(*)::integer,
    encode(extensions.digest(coalesce(string_agg(
      source_profile_key || ':' || stable_row_key || ':' || identity_id::text,
      '|' order by source_profile_key, stable_row_key, identity_id
    ), ''), 'sha256'), 'hex')
  into active_binding_count, binding_checksum
  from private.ax_identity_source_bindings
  where binding_state = 'active';

  insert into private.ax_registry_revisions (
    previous_revision_id, content_checksum, binding_count,
    actor_owner_id, actor_email, reason
  ) values (
    prior_revision_id, binding_checksum, active_binding_count,
    p_actor_owner_id, p_actor_email, p_reason
  ) returning id into new_revision_id;

  update private.ax_identity_source_bindings
  set activated_revision_id = coalesce(activated_revision_id, new_revision_id)
  where identity_run_id = p_identity_run_id and binding_state = 'active';

  update private.ax_identities
  set activated_revision_id = coalesce(activated_revision_id, new_revision_id)
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'active';

  update private.ax_identity_codes
  set activated_revision_id = coalesce(activated_revision_id, new_revision_id)
  where created_by_run_id = p_identity_run_id and lifecycle_state = 'active';

  insert into private.ax_registry_revision_bindings (revision_id, binding_id)
  select new_revision_id, id
  from private.ax_identity_source_bindings
  where binding_state = 'active';

  insert into private.pipeline_publications (
    producer_kind, producer_run_id, dataset_id, source_profile_key,
    registry_revision_id, output_checksum, row_count, artifact_manifest,
    actor_owner_id, actor_email, reason, publication_target_key
  ) values (
    'identity', p_identity_run_id, p_dataset_id, run_record.source_profile_key,
    new_revision_id, run_record.output_checksum, run_record.output_row_count,
    run_record.artifact_manifest, p_actor_owner_id, p_actor_email, p_reason,
    run_record.publication_target_key
  ) returning id into new_publication_id;

  insert into private.pipeline_publication_rows (publication_id, row_index, data)
  select new_publication_id, source_row_index, enriched_row
  from private.ax_identity_run_rows
  where identity_run_id = p_identity_run_id
  order by source_row_index;

  update private.ax_identity_runs
  set status = 'published', dataset_id = p_dataset_id,
    publication_id = new_publication_id, registry_revision_id = new_revision_id,
    publication_reason = p_reason, published_by_owner_id = p_actor_owner_id,
    published_at = now(), completed_at = coalesce(completed_at, now()),
    publication_attempt_id = null, publishing_started_at = null,
    publication_blob_path = null
  where id = p_identity_run_id and status = 'publishing'
    and publication_attempt_id = p_publication_attempt_id;
  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    raise exception 'The AX identity publication lease was lost before commit.'
      using errcode = '40001';
  end if;

  return query select new_revision_id, new_publication_id, p_dataset_id;
end;
$$;

revoke all on function private.guard_ax_identity_publication_pin()
  from public, anon, authenticated;
revoke all on function private.finalize_ax_identity_publication(uuid, uuid, uuid, boolean, text, text, text)
  from public, anon, authenticated;
revoke execute on function private.activate_ax_identity_run(uuid, text, text, text, text, text, text, integer, jsonb)
  from service_role;
grant execute on function private.finalize_ax_identity_publication(uuid, uuid, uuid, boolean, text, text, text)
  to service_role;

revoke all on private.ax_identity_runs from public, anon, authenticated;
grant all on private.ax_identity_runs to service_role;
