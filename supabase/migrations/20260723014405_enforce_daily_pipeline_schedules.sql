update private.pipeline_schedule_states
set interval_minutes = 1440,
  updated_at = now()
where interval_minutes < 1440;

alter table private.pipeline_schedule_states
  drop constraint if exists pipeline_schedule_states_interval_check;

alter table private.pipeline_schedule_states
  add constraint pipeline_schedule_states_interval_check
  check (interval_minutes between 1440 and 10080);

comment on column private.pipeline_schedule_states.interval_minutes is
  'Daily schedule cadence in minutes. Vercel Hobby cron permits no interval below 1440 minutes.';
