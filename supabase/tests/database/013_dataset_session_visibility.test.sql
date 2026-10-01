begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

select has_trigger(
  'public', 'datasets', 'datasets_z_enforce_source_visibility',
  'derived dataset visibility is database enforced'
);

select has_function(
  'private', 'is_active_workspace_session', array[]::text[],
  'active workspace session helper exists'
);

insert into public.signup_email_allowlist (email, note)
values
  ('session-admin@example.com', 'session security fixture'),
  ('session-basic@example.com', 'session security fixture');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'aa000001-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'session-admin@example.com', '', now(),
    '{"provider":"email","providers":["email"],"workspace_role":"admin"}'::jsonb,
    '{}'::jsonb, now(), now()
  ),
  (
    'aa000002-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'session-basic@example.com', '', now(),
    '{"provider":"email","providers":["email"],"workspace_role":"basic"}'::jsonb,
    '{}'::jsonb, now(), now()
  );

insert into auth.sessions (id, user_id, created_at, updated_at)
values
  ('ab000001-0000-4000-8000-000000000001', 'aa000001-0000-4000-8000-000000000001', now(), now()),
  ('ab000002-0000-4000-8000-000000000002', 'aa000002-0000-4000-8000-000000000002', now(), now());

insert into public.datasets (
  id, owner_id, file_name, blob_url, blob_path,
  current_version_actor_owner_id, size_bytes, columns,
  is_workspace_visible, backing_dataset_id
)
values
  (
    'ac000001-0000-4000-8000-000000000001', 'session-admin',
    'visible.csv', 'https://example.invalid/visible.csv', 'datasets/csv/session-visible.csv',
    'session-admin', 1, '[]'::jsonb, true, null
  ),
  (
    'ac000002-0000-4000-8000-000000000002', 'session-admin',
    'restricted.csv', 'https://example.invalid/restricted.csv', 'datasets/csv/session-restricted.csv',
    'session-admin', 1, '[]'::jsonb, false, null
  );

insert into public.datasets (
  id, owner_id, file_name, blob_url, blob_path,
  current_version_actor_owner_id, size_bytes, columns,
  is_workspace_visible, backing_dataset_id
)
values (
  'ac000003-0000-4000-8000-000000000003', 'session-admin',
  'derived.csv', 'https://example.invalid/derived.csv', 'datasets/csv/session-derived.csv',
  'session-admin', 1, '[]'::jsonb, true,
  'ac000001-0000-4000-8000-000000000001'
);

insert into public.dataset_rows (id, dataset_id, row_index, data)
values ('ad000001-0000-4000-8000-000000000001', 'ac000001-0000-4000-8000-000000000001', 0, '{"name":"visible"}'::jsonb);

insert into public.saved_dataset_tables (id, owner_id, dataset_id, name, filters)
values (
  'af000001-0000-4000-8000-000000000001',
  'aa000002-0000-4000-8000-000000000002',
  'ac000001-0000-4000-8000-000000000001',
  'Existing basic saved table',
  '{}'::jsonb
);

insert into storage.buckets (id, name, public)
values ('datasets', 'datasets', false)
on conflict (id) do nothing;

insert into storage.objects (id, bucket_id, name)
values ('ae000001-0000-4000-8000-000000000001', 'datasets', 'datasets/csv/session-visible.csv');

select set_config('request.jwt.claim.sub', 'aa000002-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"aa000002-0000-4000-8000-000000000002","role":"authenticated","session_id":"ab000002-0000-4000-8000-000000000002"}', true);
set local role authenticated;

select is(private.is_active_workspace_session(), true, 'basic live session is accepted');
select results_eq($$ select count(*)::bigint from public.datasets where id = 'ac000001-0000-4000-8000-000000000001' $$, array[1::bigint], 'basic live session reads visible dataset');
select results_eq($$ select count(*)::bigint from public.datasets where id = 'ac000002-0000-4000-8000-000000000002' $$, array[0::bigint], 'basic live session cannot read restricted dataset');
select results_eq($$ select count(*)::bigint from public.dataset_rows where dataset_id = 'ac000001-0000-4000-8000-000000000001' $$, array[1::bigint], 'basic live session reads visible rows');
select results_eq($$ select count(*)::bigint from public.saved_dataset_tables where id = 'af000001-0000-4000-8000-000000000001' $$, array[1::bigint], 'basic live session reads own saved table');

reset role;
select set_config('request.jwt.claims', '{"sub":"aa000002-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is(private.is_active_workspace_session(), false, 'token without session claim is rejected');
select results_eq($$ select count(*)::bigint from public.datasets where id = 'ac000001-0000-4000-8000-000000000001' $$, array[0::bigint], 'token without session claim cannot read data');

reset role;
select set_config('request.jwt.claims', '{"sub":"aa000002-0000-4000-8000-000000000002","role":"authenticated","session_id":"ab000002-0000-4000-8000-000000000002"}', true);
delete from auth.sessions where id = 'ab000002-0000-4000-8000-000000000002';
set local role authenticated;

select is(private.is_active_workspace_session(), false, 'revoked basic session is rejected');
select results_eq($$ select count(*)::bigint from public.datasets where id = 'ac000001-0000-4000-8000-000000000001' $$, array[0::bigint], 'revoked basic token cannot read visible dataset');
select results_eq($$ select count(*)::bigint from public.saved_dataset_tables where id = 'af000001-0000-4000-8000-000000000001' $$, array[0::bigint], 'revoked basic token cannot read saved table');

reset role;
select set_config('request.jwt.claim.sub', 'aa000001-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated","session_id":"ab000001-0000-4000-8000-000000000001"}', true);
set local role authenticated;

select results_eq($$ select count(*)::bigint from public.datasets where id = 'ac000002-0000-4000-8000-000000000002' $$, array[1::bigint], 'active admin reads restricted dataset');
select results_eq($$ select count(*)::bigint from storage.objects where id = 'ae000001-0000-4000-8000-000000000001' $$, array[1::bigint], 'active admin reads dataset storage');

reset role;
update auth.users set banned_until = now() + interval '100 years'
where id = 'aa000001-0000-4000-8000-000000000001';
set local role authenticated;

select is(private.is_active_workspace_session(), false, 'disabled admin session is rejected');
select results_eq($$ select count(*)::bigint from public.datasets where id = 'ac000002-0000-4000-8000-000000000002' $$, array[0::bigint], 'disabled admin token cannot read restricted dataset');
select results_eq($$ select count(*)::bigint from storage.objects where id = 'ae000001-0000-4000-8000-000000000001' $$, array[0::bigint], 'disabled admin token cannot read dataset storage');
select results_eq($$ update public.datasets set file_name = 'blocked.csv' where id = 'ac000002-0000-4000-8000-000000000002' returning id $$, array[]::uuid[], 'disabled admin token cannot mutate a dataset');

reset role;
delete from auth.sessions where id = 'ab000001-0000-4000-8000-000000000001';
update auth.users set banned_until = null
where id = 'aa000001-0000-4000-8000-000000000001';
insert into auth.sessions (id, user_id, created_at, updated_at)
values ('ab000003-0000-4000-8000-000000000003', 'aa000001-0000-4000-8000-000000000001', now(), now());
select set_config('request.jwt.claims', '{"sub":"aa000001-0000-4000-8000-000000000001","role":"authenticated","session_id":"ab000003-0000-4000-8000-000000000003"}', true);
set local role authenticated;

select is(private.is_active_workspace_session(), true, 're-enabled admin live session is accepted');
select results_eq($$ select count(*)::bigint from public.datasets where id = 'ac000002-0000-4000-8000-000000000002' $$, array[1::bigint], 're-enabled admin can read restricted dataset');

reset role;
set local role authenticated;
update public.datasets set is_workspace_visible = false
where id = 'ac000001-0000-4000-8000-000000000001';
reset role;

select results_eq($$ select is_workspace_visible from public.datasets where id = 'ac000003-0000-4000-8000-000000000003' $$, array[false], 'restricting a source atomically hides its derived view');

select throws_ok(
  $$ update public.datasets set is_workspace_visible = true where id = 'ac000003-0000-4000-8000-000000000003' $$,
  '23514',
  'A workspace-visible derived view requires a workspace-visible source.',
  'restricted source cannot back a visible view'
);

update public.datasets set is_workspace_visible = true
where id = 'ac000001-0000-4000-8000-000000000001';
update public.datasets set is_workspace_visible = true
where id = 'ac000003-0000-4000-8000-000000000003';
set local role authenticated;
update public.datasets set is_public = false
where id = 'ac000001-0000-4000-8000-000000000001';
reset role;

select results_eq($$ select is_workspace_visible from public.datasets where id = 'ac000003-0000-4000-8000-000000000003' $$, array[false], 'legacy visibility update also hides derived view');

select * from finish();

rollback;
