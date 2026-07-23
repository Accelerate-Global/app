alter table private.dataset_forming_runs
  add column if not exists publication_attempt_id uuid,
  add column if not exists publication_blob_path text;

alter table private.pipeline_definitions
  add column if not exists is_workspace_visible boolean;

update private.pipeline_definitions
set is_workspace_visible = true
where is_workspace_visible is null;

alter table private.pipeline_definitions
  alter column is_workspace_visible set not null;

update private.pipeline_definitions
set checksum = case definition_key
      when 'tier1-pgic-merge'
        then '732a52ce030ead236c08c2a6810dd54129fb31b2fe0253072fa5177b22097b38'
      when 'tier1-specific-pg-merge'
        then '8e7dd1be61ff2071e69ba6c5cf30b9a277ee39f25ed3a7b5351a6311eff2fe62'
      when 'aggregate1-pgac'
        then 'a00034897ce331f06ca97ff548fdf68e77cf04ce3add01cdcd67303be1da4091'
      when 'aggregate1-self-engaged'
        then '6fd44c3c6dbcdbd8b244c7a2257acf15e27a23b77cee02006820df29d8666c01'
      when 'aggregate1-watchlist'
        then 'd00121d043431fe0554a9d825ab50076e67f55977e9b3cb2227ad0c2d7524c63'
      when 'aggregate1-baseline-uupg'
        then 'db0c9db072c5758f812973493f698b1df84f7c5250206c174112a13000862182'
      when 'aggregate1-hotspots'
        then 'f55f6692f1c15347165a0e2bf63a480d923719741de319674a8985e76b1d5b71'
      when 'aggregate1-south-asia'
        then 'f638957b5fbaefde243198f2389325c25a322931ef85331516c44e7bde828d59'
      when 'tier2-complete-partners'
        then '1641ad4635a3a7dc4b18102538bef5f046caecd51348fa9a1145f0324a3fd315'
      when 'aggregate2-exact-union'
        then '278dee49fd8a6a4b678b24bbb5c97350a479a05d042d8c175d4870d00f9a0be9'
    end,
    is_workspace_visible = true
where definition_key in (
  'tier1-pgic-merge',
  'tier1-specific-pg-merge',
  'aggregate1-pgac',
  'aggregate1-self-engaged',
  'aggregate1-watchlist',
  'aggregate1-baseline-uupg',
  'aggregate1-hotspots',
  'aggregate1-south-asia',
  'tier2-complete-partners',
  'aggregate2-exact-union'
);

comment on column private.dataset_forming_runs.publication_attempt_id is
  'Opaque lease token for the active formed-source publication attempt; commit requires exact ownership.';
comment on column private.dataset_forming_runs.publication_blob_path is
  'Dataset blob owned by the active or committed formed-source publication attempt.';

update private.dataset_forming_runs as run
set status = 'valid', publication_attempt_id = null,
  publishing_started_at = null, publication_blob_path = null,
  error_message = 'A pre-lease Tier 2 formed-source publication was recovered during migration.'
from private.tier2_forming_runs as tier2
where tier2.forming_run_id = run.id
  and run.status = 'publishing'
  and run.publication_id is null;

alter table private.dataset_forming_runs
  drop constraint if exists dataset_forming_runs_publication_lease_check,
  add constraint dataset_forming_runs_publication_lease_check check (
    engine_key <> 'tier2-partner-forming'
    or (
      (
        status = 'publishing'
        and publication_id is null
        and publication_attempt_id is not null
        and publishing_started_at is not null
        and publication_blob_path is not null
        and publication_blob_path like 'datasets/csv/%'
      )
      or
      (
        status <> 'publishing'
        and publication_attempt_id is null
        and publishing_started_at is null
        and (status = 'published' or publication_blob_path is null)
        and (publication_blob_path is null
          or publication_blob_path like 'datasets/csv/%')
      )
    )
  ) not valid;

alter table private.dataset_forming_runs
  validate constraint dataset_forming_runs_publication_lease_check;

drop index if exists private.dataset_forming_runs_publication_lease_idx;

create index dataset_forming_runs_publication_lease_idx
  on private.dataset_forming_runs(publishing_started_at, id)
  where status = 'publishing' and engine_key = 'tier2-partner-forming';

drop function if exists private.lock_tier2_forming_publication_target(uuid);

create or replace function private.lock_tier2_forming_publication_target(
  p_forming_run_id uuid,
  p_publication_attempt_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate record;
  current_publication_id uuid := null;
begin
  select run.status, run.publication_target_key,
    run.expected_current_publication_id, run.publication_attempt_id,
    run.publication_id
  into candidate
  from private.dataset_forming_runs as run
  join private.tier2_forming_runs as tier2
    on tier2.forming_run_id = run.id
  where run.id = p_forming_run_id
  for update of run;

  if not found then
    raise exception 'Tier 2 forming candidate not found.';
  end if;
  if candidate.status <> 'publishing'
    or candidate.publication_id is not null
    or candidate.publication_attempt_id is distinct from p_publication_attempt_id
  then
    raise exception 'This Tier 2 formed-source publication attempt no longer owns the candidate lease.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tier2-forming-publication:' || candidate.publication_target_key,
      391743
    )
  );

  select publication.id
  into current_publication_id
  from private.pipeline_publications as publication
  where publication.producer_kind = 'tier2-forming'
    and publication.publication_target_key = candidate.publication_target_key
  order by publication.created_at desc, publication.id desc
  limit 1;

  if current_publication_id is distinct from
    candidate.expected_current_publication_id
  then
    raise exception 'The Tier 2 formed-source publication target changed after this candidate was built.';
  end if;
end;
$$;

revoke execute on function private.lock_tier2_forming_publication_target(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.lock_tier2_forming_publication_target(uuid, uuid)
  to service_role;
