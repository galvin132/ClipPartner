create schema if not exists auth_app;

create table if not exists auth_app."user" (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  role text not null default 'partner' check (role in ('admin', 'reviewer', 'finance', 'partner')),
  banned boolean not null default false,
  "banReason" text,
  "banExpires" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists auth_app.session (
  id text primary key,
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references auth_app."user"(id) on delete cascade,
  "impersonatedBy" text
);

create table if not exists auth_app.account (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references auth_app."user"(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("providerId", "accountId")
);

create table if not exists auth_app.verification (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists idx_better_auth_session_user_id on auth_app.session("userId");
create index if not exists idx_better_auth_account_user_id on auth_app.account("userId");
create index if not exists idx_better_auth_verification_identifier on auth_app.verification(identifier);

create table if not exists public.app_user_profiles (
  better_auth_user_id text primary key,
  role text not null default 'partner' check (role in ('admin', 'reviewer', 'finance', 'partner')),
  distributor_profile_id uuid references public.distributor_profiles(id) on delete set null,
  display_name text,
  email text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_user_profiles_distributor on public.app_user_profiles(distributor_profile_id);
alter table public.app_user_profiles enable row level security;

drop policy if exists app_user_profiles_service_role_all on public.app_user_profiles;
create policy app_user_profiles_service_role_all on public.app_user_profiles
  for all to service_role
  using (true)
  with check (true);

revoke all on schema auth_app from anon, authenticated;
revoke all on all tables in schema auth_app from anon, authenticated;
grant usage on schema auth_app to service_role;
grant select, insert, update, delete on all tables in schema auth_app to service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'auth_app_runtime') then
    grant usage on schema auth_app to auth_app_runtime;
    grant select, insert, update, delete on all tables in schema auth_app to auth_app_runtime;
  end if;
end $$;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon;
revoke all on all sequences in schema public from authenticated;
revoke all on all routines in schema public from anon;
revoke all on all routines in schema public from authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all routines in schema public to service_role;
