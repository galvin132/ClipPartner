create table if not exists public.system_settings (
  id text primary key default 'global' check (id = 'global'),
  runtime_mode text not null default 'mock' check (runtime_mode in ('mock', 'hybrid', 'real')),
  commission_share numeric(5, 2) not null default 50.00 check (commission_share >= 0 and commission_share <= 100),
  daily_claim_limit integer not null default 10 check (daily_claim_limit >= 0 and daily_claim_limit <= 10000),
  risk_keywords text[] not null default array['搬运', '非指定商品', 'risk']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_configs (
  provider_key text primary key check (
    provider_key in ('wechat_oauth', 'douyin', 'wechat_channels', 'tencent_identity', 'payment', 'ffmpeg')
  ),
  enabled boolean not null default false,
  public_config jsonb not null default '{}'::jsonb,
  encrypted_secrets jsonb not null default '{}'::jsonb,
  secret_fingerprints jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  last_check_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_integration_configs_enabled on public.integration_configs(enabled);
create index if not exists idx_integration_configs_last_checked_at on public.integration_configs(last_checked_at desc);

alter table public.system_settings enable row level security;
alter table public.integration_configs enable row level security;

drop policy if exists system_settings_service_role_all on public.system_settings;
create policy system_settings_service_role_all on public.system_settings
  for all to service_role
  using (true)
  with check (true);

drop policy if exists integration_configs_service_role_all on public.integration_configs;
create policy integration_configs_service_role_all on public.integration_configs
  for all to service_role
  using (true)
  with check (true);

insert into public.system_settings (id, runtime_mode, commission_share, daily_claim_limit, risk_keywords)
values ('global', 'mock', 50.00, 10, array['搬运', '非指定商品', 'risk']::text[])
on conflict (id) do nothing;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.system_settings to service_role;
grant select, insert, update, delete on public.integration_configs to service_role;
