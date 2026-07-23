create or replace function private.expire_ax_identity_run(
  p_identity_run_id uuid,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record private.ax_identity_runs%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('ax-identity-publication', 11));

  select * into run_record
  from private.ax_identity_runs
  where id = p_identity_run_id
  for update;

  if run_record is null
    or run_record.status not in ('building', 'valid', 'invalid')
    or run_record.reservation_expires_at is null
    or run_record.reservation_expires_at > p_now
  then
    return false;
  end if;

  perform private.cancel_ax_identity_run_reservations(p_identity_run_id);

  update private.ax_identity_runs
  set status = 'expired', completed_at = coalesce(completed_at, now())
  where id = p_identity_run_id;

  return true;
end;
$$;

revoke all on function private.expire_ax_identity_run(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function private.expire_ax_identity_run(uuid, timestamptz)
  to service_role;
