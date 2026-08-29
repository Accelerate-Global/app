create table private.data_archive_package_verifications (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  nonce text not null unique,
  package_id uuid not null references private.data_archive_packages(id) on delete restrict,
  status text not null,
  manifest_checksum text not null,
  member_count integer not null,
  total_bytes bigint not null,
  requested_by_owner_id text not null,
  issued_at timestamptz not null,
  completed_at timestamptz not null,
  verified_at timestamptz,
  failure_code text,
  signature_digest text not null,
  payload_checksum text not null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint data_archive_package_verifications_request_key_check
    check (char_length(request_key) between 8 and 160 and request_key ~ '^[a-zA-Z0-9._:-]+$'),
  constraint data_archive_package_verifications_nonce_check
    check (char_length(nonce) between 16 and 128 and nonce ~ '^[a-zA-Z0-9._:-]+$'),
  constraint data_archive_package_verifications_status_check
    check (status in ('verified', 'failed')),
  constraint data_archive_package_verifications_manifest_check
    check (manifest_checksum ~ '^[0-9a-f]{64}$'),
  constraint data_archive_package_verifications_counts_check
    check (member_count > 0 and total_bytes >= 0),
  constraint data_archive_package_verifications_actor_check
    check (char_length(btrim(requested_by_owner_id)) between 1 and 255),
  constraint data_archive_package_verifications_failure_code_check
    check (
      failure_code is null
      or (char_length(failure_code) between 2 and 128 and failure_code ~ '^[a-z0-9._-]+$')
    ),
  constraint data_archive_package_verifications_signature_check
    check (signature_digest ~ '^[0-9a-f]{64}$' and payload_checksum ~ '^[0-9a-f]{64}$'),
  constraint data_archive_package_verifications_time_check
    check (completed_at >= issued_at and (verified_at is null or verified_at = completed_at)),
  constraint data_archive_package_verifications_state_check
    check (
      (status = 'verified' and verified_at is not null and failure_code is null)
      or (status = 'failed' and verified_at is null and failure_code is not null)
    )
);

create index data_archive_package_verifications_package_idx
  on private.data_archive_package_verifications(package_id, completed_at desc);

comment on table private.data_archive_package_verifications is
  'Immutable signed evidence that Samson restored and verified one exact archive package. Payload bodies and local paths are never stored here.';

create or replace function private.guard_data_archive_package_verification_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Data archive package verification evidence is immutable.';
end;
$$;

create trigger data_archive_package_verifications_immutable
before update or delete on private.data_archive_package_verifications
for each row execute function private.guard_data_archive_package_verification_evidence();

create or replace function private.guard_data_archive_package_restore_verified_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.restore_verified_at is not null
    and old.restore_verified_at is distinct from new.restore_verified_at
  then
    raise exception 'Verified package restore evidence cannot be changed.';
  end if;

  if new.restore_verified_at is not null
    and not exists (
      select 1
      from private.data_archive_package_verifications as verification
      where verification.package_id = new.id
        and verification.status = 'verified'
        and verification.manifest_checksum = new.manifest_checksum
        and verification.verified_at = new.restore_verified_at
    )
  then
    raise exception 'Package restore evidence requires a matching verified audit record.';
  end if;

  return new;
end;
$$;

create trigger data_archive_packages_require_restore_verification_evidence
before update of restore_verified_at on private.data_archive_packages
for each row execute function private.guard_data_archive_package_restore_verified_at();

revoke all on function private.guard_data_archive_package_verification_evidence()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_data_archive_package_restore_verified_at()
  from public, anon, authenticated, service_role;

alter table private.data_archive_package_verifications enable row level security;
revoke all on private.data_archive_package_verifications from public, anon, authenticated;
grant select on private.data_archive_package_verifications to data_archive_backup_reader;
