create schema if not exists private;

revoke all on schema private from public;

create table if not exists public.signup_email_allowlist (
  email text primary key,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signup_email_allowlist_email_lowercase
    check (email = lower(btrim(email)))
);

comment on table public.signup_email_allowlist is
  'Emails allowed to create an account. Add rows here before a user signs up.';

alter table public.signup_email_allowlist enable row level security;

drop policy if exists "supabase auth admin can read signup allowlist"
  on public.signup_email_allowlist;

create policy "supabase auth admin can read signup allowlist"
  on public.signup_email_allowlist
  for select
  to supabase_auth_admin
  using (true);

create or replace function private.normalize_signup_email_allowlist()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(btrim(new.email));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists signup_email_allowlist_normalize
  on public.signup_email_allowlist;

create trigger signup_email_allowlist_normalize
before insert or update on public.signup_email_allowlist
for each row
execute function private.normalize_signup_email_allowlist();

create or replace function private.enforce_signup_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  normalized_email text;
begin
  normalized_email := lower(btrim(new.email));

  if normalized_email is null or normalized_email = '' then
    raise exception 'Email is required.';
  end if;

  if not exists (
    select 1
    from public.signup_email_allowlist
    where email = normalized_email
  ) then
    raise exception 'This email is not approved for access.';
  end if;

  new.email := normalized_email;
  return new;
end;
$$;

revoke all on function private.enforce_signup_email_allowlist() from public;
revoke all on function private.normalize_signup_email_allowlist() from public;

drop trigger if exists enforce_signup_email_allowlist on auth.users;

create trigger enforce_signup_email_allowlist
before insert on auth.users
for each row
execute function private.enforce_signup_email_allowlist();
