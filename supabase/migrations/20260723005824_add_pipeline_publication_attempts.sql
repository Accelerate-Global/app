alter table private.pipeline_runs
  add column if not exists publication_attempt_id uuid,
  add column if not exists expected_current_publication_id uuid
    references private.pipeline_publications(id) on delete restrict;

create index if not exists pipeline_runs_publishing_lease_idx
  on private.pipeline_runs(publishing_started_at, id)
  where status = 'publishing';

create index if not exists pipeline_runs_expected_current_publication_idx
  on private.pipeline_runs(expected_current_publication_id)
  where expected_current_publication_id is not null;

comment on column private.pipeline_runs.publication_attempt_id is
  'Opaque lease token for the currently active dataset publication attempt. A recovered attempt cannot commit after this token is cleared or replaced.';

comment on column private.pipeline_runs.expected_current_publication_id is
  'Publication that was current for this stable target when the candidate was built. Null means the target did not yet exist.';

create or replace function private.guard_pipeline_run_publication_pin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.expected_current_publication_id is distinct from old.expected_current_publication_id then
    raise exception 'The pipeline publication target pin is immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists pipeline_runs_publication_pin_immutable on private.pipeline_runs;
create trigger pipeline_runs_publication_pin_immutable
before update on private.pipeline_runs
for each row execute function private.guard_pipeline_run_publication_pin();

revoke all on private.pipeline_runs from public, anon, authenticated;
revoke execute on function private.guard_pipeline_run_publication_pin() from public, anon, authenticated;
grant all on private.pipeline_runs to service_role;
