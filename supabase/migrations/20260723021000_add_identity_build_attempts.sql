alter table private.ax_identity_runs
  add column if not exists attempt_number integer;

update private.ax_identity_runs
set attempt_number = 1
where attempt_number is null;

alter table private.ax_identity_runs
  alter column attempt_number set default 1,
  alter column attempt_number set not null,
  drop constraint if exists ax_identity_runs_input_unique,
  drop constraint if exists ax_identity_runs_attempt_number_check,
  add constraint ax_identity_runs_attempt_number_check
    check (attempt_number > 0),
  add constraint ax_identity_runs_input_attempt_unique
    unique (source_publication_id, input_fingerprint, attempt_number);

create unique index if not exists ax_identity_runs_reusable_input_idx
  on private.ax_identity_runs(source_publication_id, input_fingerprint)
  where status not in ('failed', 'expired', 'rejected');

create or replace function private.guard_ax_identity_attempt_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.attempt_number is distinct from old.attempt_number then
    raise exception 'AX identity candidate attempt lineage is immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists ax_identity_runs_attempt_number_immutable
  on private.ax_identity_runs;
create trigger ax_identity_runs_attempt_number_immutable
before update on private.ax_identity_runs
for each row execute function private.guard_ax_identity_attempt_number();

revoke all on function private.guard_ax_identity_attempt_number()
  from public, anon, authenticated;
grant execute on function private.guard_ax_identity_attempt_number()
  to service_role;

alter table private.tier2_partner_profile_resource_bindings
  drop constraint if exists tier2_profile_resource_bindings_key_check,
  drop constraint if exists tier2_profile_resource_bindings_source_check,
  add constraint tier2_profile_resource_bindings_key_check check (
    binding_key in (
      'country-territory-codes', 'rop-codes', 'source-aliases',
      'jp-peopleid3', 'peid', 'engagement-mappings'
    )
  ),
  add constraint tier2_profile_resource_bindings_source_check check (
    (
      binding_key in (
        'country-territory-codes', 'rop-codes', 'source-aliases'
      )
      and reference_resource_version_id is not null
      and contract_resource_version_id is null
    )
    or
    (
      binding_key in ('jp-peopleid3', 'peid', 'engagement-mappings')
      and reference_resource_version_id is null
      and contract_resource_version_id is not null
    )
  );

comment on column private.ax_identity_runs.attempt_number is
  'Monotonic immutable build attempt for one exact source publication and input fingerprint.';
