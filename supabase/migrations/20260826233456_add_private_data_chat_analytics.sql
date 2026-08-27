create schema if not exists analytics_ro;
create schema if not exists private;

revoke all on schema analytics_ro from public, anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'analytics_chat_reader') then
    create role analytics_chat_reader
      nologin
      noinherit
      nosuperuser
      nocreatedb
      nocreaterole
      noreplication
      nobypassrls;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'analytics_chat_login') then
    create role analytics_chat_login
      login
      noinherit
      nosuperuser
      nocreatedb
      nocreaterole
      noreplication
      nobypassrls
      connection limit 4;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_roles
    where rolname = 'analytics_chat_reader'
      and not rolcanlogin
      and not rolinherit
      and not rolsuper
      and not rolcreatedb
      and not rolcreaterole
      and not rolreplication
      and not rolbypassrls
  ) then
    raise exception 'Existing analytics_chat_reader role is not safely constrained.';
  end if;

  if not exists (
    select 1
    from pg_roles
    where rolname = 'analytics_chat_login'
      and rolcanlogin
      and not rolinherit
      and not rolsuper
      and not rolcreatedb
      and not rolcreaterole
      and not rolreplication
      and not rolbypassrls
      and rolconnlimit = 4
  ) then
    raise exception 'Existing analytics_chat_login role is not safely constrained.';
  end if;
end
$$;

grant analytics_chat_reader to analytics_chat_login;
grant analytics_chat_reader to postgres;

alter role analytics_chat_login set default_transaction_read_only = on;
alter role analytics_chat_login set statement_timeout = '5s';
alter role analytics_chat_login set lock_timeout = '500ms';
alter role analytics_chat_login set idle_in_transaction_session_timeout = '5s';
alter role analytics_chat_login set work_mem = '16MB';
alter role analytics_chat_login set search_path = 'pg_catalog,analytics_ro';

alter role analytics_chat_reader set default_transaction_read_only = on;
alter role analytics_chat_reader set statement_timeout = '5s';
alter role analytics_chat_reader set lock_timeout = '500ms';
alter role analytics_chat_reader set idle_in_transaction_session_timeout = '5s';
alter role analytics_chat_reader set work_mem = '16MB';
alter role analytics_chat_reader set search_path = 'pg_catalog,analytics_ro';

create or replace function private.analytics_primary_people_groups_rows()
returns table (
  dataset_id uuid,
  dataset_version_created_at timestamptz,
  people_id text,
  people_name text,
  country text,
  gsec numeric,
  frontier_group boolean,
  engagement_phase numeric,
  globally_engaged boolean,
  population numeric,
  percent_evangelical numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    dataset.id as dataset_id,
    dataset.current_version_created_at as dataset_version_created_at,
    coalesce(
      nullif(btrim(row.data ->> 'pg_peopleid3'), ''),
      nullif(btrim(row.data ->> 'pg_peopleid1'), ''),
      nullif(btrim(row.data ->> 'pg_peid'), '')
    ) as people_id,
    nullif(btrim(row.data ->> 'people_name'), '') as people_name,
    nullif(btrim(row.data ->> 'geo_country_name'), '') as country,
    case
      when btrim(row.data ->> 'christianity_gsec') ~ '^[+-]?[0-9]+(?:[.][0-9]+)?$'
        then btrim(row.data ->> 'christianity_gsec')::numeric
      else null
    end as gsec,
    case lower(btrim(row.data ->> 'christianity_frontier_group'))
      when 'true' then true
      when 'false' then false
      else null
    end as frontier_group,
    case
      when btrim(row.data ->> 'engage_8_phases_of_engagement') ~ '^[+-]?[0-9]+(?:[.][0-9]+)?$'
        then btrim(row.data ->> 'engage_8_phases_of_engagement')::numeric
      else null
    end as engagement_phase,
    case lower(btrim(row.data ->> 'engage_global_engagement_anywhere'))
      when 'true' then true
      when 'false' then false
      else null
    end as globally_engaged,
    case
      when btrim(row.data ->> 'pg_population') ~ '^[+-]?[0-9]+(?:[.][0-9]+)?$'
        then btrim(row.data ->> 'pg_population')::numeric
      else null
    end as population,
    case
      when btrim(row.data ->> 'percent_evangelical_pgac') ~ '^[+-]?[0-9]+(?:[.][0-9]+)?$'
        then btrim(row.data ->> 'percent_evangelical_pgac')::numeric
      else null
    end as percent_evangelical
  from public.datasets as dataset
  join public.dataset_rows as row
    on row.dataset_id = coalesce(dataset.backing_dataset_id, dataset.id)
  where dataset.is_primary
    and dataset.status = 'ready'
    and exists (
      select 1
      from auth.users as actor
      where actor.id = auth.uid()
        and coalesce(actor.raw_app_meta_data ->> 'workspace_role', 'pro')
          in ('admin', 'super_admin')
    )
$$;

comment on function private.analytics_primary_people_groups_rows() is
  'Returns only the approved typed primary people-groups projection to a verified admin identity. It accepts no caller-controlled SQL or identifiers.';

revoke all on function private.analytics_primary_people_groups_rows()
  from public, anon, authenticated, service_role;
grant execute on function private.analytics_primary_people_groups_rows()
  to analytics_chat_reader;

create or replace view analytics_ro.primary_people_groups
with (security_invoker = true, security_barrier = true)
as
select
  dataset_id,
  dataset_version_created_at,
  people_id,
  people_name,
  country,
  gsec,
  frontier_group,
  engagement_phase,
  globally_engaged,
  population,
  percent_evangelical
from private.analytics_primary_people_groups_rows();

comment on view analytics_ro.primary_people_groups is
  'Approved version-one semantic projection for private Qwen data chat.';

revoke all on analytics_ro.primary_people_groups
  from public, anon, authenticated, service_role;
grant usage on schema analytics_ro, private to analytics_chat_reader;
grant select on analytics_ro.primary_people_groups to analytics_chat_reader;

create table if not exists private.analytics_chat_audit (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null unique,
  occurred_at timestamptz not null default now(),
  pseudonymous_user_id text not null
    check (length(pseudonymous_user_id) between 16 and 128),
  catalog_version text not null check (length(catalog_version) between 1 and 100),
  policy_version text not null check (length(policy_version) between 1 and 100),
  model_sha256 text check (model_sha256 is null or model_sha256 ~ '^[0-9a-f]{64}$'),
  runtime_revision text check (
    runtime_revision is null or length(runtime_revision) between 1 and 100
  ),
  decision text not null check (
    decision in ('admitted', 'rejected', 'executed', 'failed')
  ),
  reason_code text not null check (length(reason_code) between 1 and 100),
  referenced_view text,
  sql_template text check (sql_template is null or length(sql_template) <= 8000),
  elapsed_ms integer check (elapsed_ms is null or elapsed_ms >= 0),
  row_count integer check (row_count is null or row_count >= 0),
  response_bytes integer check (response_bytes is null or response_bytes >= 0)
);

alter table private.analytics_chat_audit enable row level security;
alter table private.analytics_chat_audit force row level security;

create index if not exists analytics_chat_audit_occurred_idx
  on private.analytics_chat_audit (occurred_at desc);

revoke all on table private.analytics_chat_audit
  from public, anon, authenticated, service_role, analytics_chat_login,
    analytics_chat_reader;

comment on table private.analytics_chat_audit is
  'Redacted private data-chat admission and execution evidence. Raw prompts, parameter values, result rows, and provider errors are prohibited.';
