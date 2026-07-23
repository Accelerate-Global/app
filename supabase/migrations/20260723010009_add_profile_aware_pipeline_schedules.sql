alter table private.pipeline_schedule_states
  drop constraint pipeline_schedule_states_pkey;

alter table private.pipeline_schedule_states
  add column source_profile_id uuid
    references private.tier2_partner_profiles(id) on delete restrict;

alter table private.pipeline_schedule_states
  add constraint pipeline_schedule_states_profile_scope_check check (
    (definition_key = 'tier2-partner' and source_profile_id is not null)
    or (definition_key <> 'tier2-partner' and source_profile_id is null)
  ),
  add constraint pipeline_schedule_states_identity_unique
    unique nulls not distinct (definition_key, source_profile_id);

comment on column private.pipeline_schedule_states.source_profile_id is
  'Exact Tier 2 partner profile scheduled by this row. Null for definitions that are not profile-scoped.';
