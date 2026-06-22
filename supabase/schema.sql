create extension if not exists "pgcrypto";

create type authorization_status as enum (
  'pending',
  'approved',
  'rejected',
  'paused',
  'banned',
  'expired'
);

create type material_status as enum (
  'draft',
  'processing',
  'ready',
  'published',
  'archived'
);

create type publish_status as enum (
  'claimed',
  'downloaded',
  'submitted',
  'verified',
  'invalid',
  'settled'
);

create type settlement_status as enum (
  'pending',
  'confirmed',
  'paid',
  'blocked'
);

create type social_platform as enum (
  'douyin',
  'wechat_channels'
);

create table distributor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  display_name text not null,
  phone text,
  status authorization_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  platform social_platform not null,
  account_name text not null,
  account_url text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table ip_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform social_platform not null,
  avatar_url text,
  description text,
  default_share_rate numeric(5, 2) not null default 50.00,
  is_open_for_authorization boolean not null default true,
  created_at timestamptz not null default now()
);

create table authorization_requests (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  ip_account_id uuid not null references ip_accounts(id) on delete cascade,
  social_account_id uuid references social_accounts(id) on delete set null,
  status authorization_status not null default 'pending',
  application_note text,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table authorizations (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  ip_account_id uuid not null references ip_accounts(id) on delete cascade,
  social_account_id uuid references social_accounts(id) on delete set null,
  status authorization_status not null default 'approved',
  share_rate numeric(5, 2) not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (distributor_id, ip_account_id)
);

create table live_recordings (
  id uuid primary key default gen_random_uuid(),
  ip_account_id uuid not null references ip_accounts(id) on delete cascade,
  source_platform social_platform not null,
  live_date date not null,
  title text not null,
  r2_key text not null,
  duration_seconds integer,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

create table clip_assets (
  id uuid primary key default gen_random_uuid(),
  live_recording_id uuid references live_recordings(id) on delete set null,
  ip_account_id uuid not null references ip_accounts(id) on delete cascade,
  title text not null,
  status material_status not null default 'draft',
  start_second integer,
  end_second integer,
  video_r2_key text,
  cover_r2_key text,
  tags text[] not null default '{}',
  highlights text,
  recommended_title text,
  recommended_copy text,
  edit_suggestion text,
  compliance_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform social_platform not null,
  image_url text,
  affiliate_url text not null,
  commission_rate numeric(5, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table clip_products (
  clip_asset_id uuid not null references clip_assets(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (clip_asset_id, product_id)
);

create table clip_claims (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  clip_asset_id uuid not null references clip_assets(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  social_account_id uuid not null references social_accounts(id) on delete restrict,
  planned_platform social_platform not null,
  created_at timestamptz not null default now()
);

create table clip_downloads (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references clip_claims(id) on delete cascade,
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  clip_asset_id uuid not null references clip_assets(id) on delete cascade,
  download_version text not null default 'watermarked',
  downloaded_at timestamptz not null default now()
);

create table publish_records (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references clip_claims(id) on delete cascade,
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  clip_asset_id uuid not null references clip_assets(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  platform social_platform not null,
  publish_url text not null,
  status publish_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,
  verification_note text
);

create table performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  publish_record_id uuid not null references publish_records(id) on delete cascade,
  views integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  gmv numeric(12, 2) not null default 0,
  commission_amount numeric(12, 2) not null default 0,
  captured_at timestamptz not null default now()
);

create table commission_records (
  id uuid primary key default gen_random_uuid(),
  publish_record_id uuid not null references publish_records(id) on delete cascade,
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  gross_commission numeric(12, 2) not null default 0,
  share_rate numeric(5, 2) not null,
  payable_commission numeric(12, 2) not null default 0,
  is_settleable boolean not null default true,
  blocked_reason text,
  created_at timestamptz not null default now()
);

create table settlement_orders (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  period text not null,
  status settlement_status not null default 'pending',
  total_amount numeric(12, 2) not null default 0,
  confirmed_at timestamptz,
  paid_at timestamptz,
  payment_note text,
  created_at timestamptz not null default now()
);

create table settlement_order_items (
  settlement_order_id uuid not null references settlement_orders(id) on delete cascade,
  commission_record_id uuid not null references commission_records(id) on delete restrict,
  amount numeric(12, 2) not null,
  primary key (settlement_order_id, commission_record_id)
);

create table violation_records (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid references distributor_profiles(id) on delete set null,
  publish_record_id uuid references publish_records(id) on delete set null,
  issue_type text not null,
  description text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table violation_leads (
  id uuid primary key default gen_random_uuid(),
  platform social_platform not null,
  account_name text not null,
  work_url text not null,
  suspected_clip_asset_id uuid references clip_assets(id) on delete set null,
  is_authorized boolean,
  evidence_r2_key text,
  status text not null default 'pending',
  handling_note text,
  created_at timestamptz not null default now()
);

create table clip_tasks (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  dedupe_key text not null unique,
  recording_id uuid references live_recordings(id) on delete set null,
  clip_asset_id uuid references clip_assets(id) on delete set null,
  r2_key text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'dead')),
  attempts integer not null default 0,
  last_error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create index idx_authorization_requests_status on authorization_requests(status);
create index idx_authorization_requests_created_at on authorization_requests(created_at desc);
create index idx_authorizations_distributor on authorizations(distributor_id);
create index idx_social_accounts_distributor on social_accounts(distributor_id);
create index idx_live_recordings_ip_live_date on live_recordings(ip_account_id, live_date desc);
create index idx_clip_assets_ip_status on clip_assets(ip_account_id, status);
create index idx_clip_assets_created_at on clip_assets(created_at desc);
create index idx_clip_products_product on clip_products(product_id);
create index idx_clip_claims_distributor on clip_claims(distributor_id);
create index idx_clip_claims_clip_asset on clip_claims(clip_asset_id);
create index idx_clip_downloads_clip_asset on clip_downloads(clip_asset_id);
create index idx_publish_records_status on publish_records(status);
create index idx_publish_records_distributor_status on publish_records(distributor_id, status);
create index idx_publish_records_submitted_at on publish_records(submitted_at desc);
create index idx_performance_snapshots_record_captured_at on performance_snapshots(publish_record_id, captured_at desc);
create index idx_settlement_orders_distributor on settlement_orders(distributor_id);
create index idx_settlement_orders_period_status on settlement_orders(period, status);
create index idx_violation_leads_status_created_at on violation_leads(status, created_at desc);
create index idx_clip_tasks_status_queued_at on clip_tasks(status, queued_at);
create index idx_clip_tasks_clip_asset on clip_tasks(clip_asset_id);

alter table distributor_profiles enable row level security;
alter table social_accounts enable row level security;
alter table ip_accounts enable row level security;
alter table authorization_requests enable row level security;
alter table authorizations enable row level security;
alter table live_recordings enable row level security;
alter table clip_assets enable row level security;
alter table products enable row level security;
alter table clip_products enable row level security;
alter table clip_claims enable row level security;
alter table clip_downloads enable row level security;
alter table publish_records enable row level security;
alter table performance_snapshots enable row level security;
alter table commission_records enable row level security;
alter table settlement_orders enable row level security;
alter table settlement_order_items enable row level security;
alter table violation_records enable row level security;
alter table violation_leads enable row level security;
alter table clip_tasks enable row level security;

create policy admin_all_distributor_profiles on distributor_profiles
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_social_accounts on social_accounts
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_ip_accounts on ip_accounts
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_authorization_requests on authorization_requests
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_authorizations on authorizations
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_live_recordings on live_recordings
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_clip_assets on clip_assets
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_products on products
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_clip_products on clip_products
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_clip_claims on clip_claims
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_clip_downloads on clip_downloads
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_publish_records on publish_records
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_performance_snapshots on performance_snapshots
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_commission_records on commission_records
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_settlement_orders on settlement_orders
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_settlement_order_items on settlement_order_items
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_violation_records on violation_records
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_violation_leads on violation_leads
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy admin_all_clip_tasks on clip_tasks
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operator'));

create policy distributor_own_profile on distributor_profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy distributor_own_social_accounts on social_accounts
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_own_authorization_requests on authorization_requests
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_read_open_ip_accounts on ip_accounts
  for select to authenticated
  using (is_open_for_authorization = true);

create policy distributor_read_ready_materials on clip_assets
  for select to authenticated
  using (status in ('ready', 'published'));

create policy distributor_read_active_products on products
  for select to authenticated
  using (is_active = true);

create policy distributor_read_clip_products on clip_products
  for select to authenticated
  using (clip_asset_id in (select id from clip_assets where status in ('ready', 'published')));

create policy distributor_own_claims on clip_claims
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_own_downloads on clip_downloads
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_own_publish_records on publish_records
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_own_performance on performance_snapshots
  for select to authenticated
  using (
    publish_record_id in (
      select pr.id
      from publish_records pr
      join distributor_profiles dp on dp.id = pr.distributor_id
      where dp.user_id = auth.uid()
    )
  );

create policy distributor_own_commissions on commission_records
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_own_settlements on settlement_orders
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create or replace view material_summaries
with (security_invoker = true)
as
select
  ca.id,
  ca.title,
  ia.name as ip_name,
  ia.platform as source_platform,
  ca.created_at::date as live_date,
  case
    when ca.end_second is not null and ca.start_second is not null and ca.end_second > ca.start_second
      then ca.end_second - ca.start_second
    else null
  end as duration_seconds,
  ca.tags,
  cp_primary.product_name,
  ca.status,
  coalesce(claim_counts.claims, 0) as claims,
  coalesce(download_counts.downloads, 0) as downloads,
  ca.created_at
from clip_assets ca
left join ip_accounts ia on ia.id = ca.ip_account_id
left join lateral (
  select p.name as product_name
  from clip_products cp
  join products p on p.id = cp.product_id
  where cp.clip_asset_id = ca.id
  order by cp.is_primary desc, cp.created_at desc
  limit 1
) cp_primary on true
left join (
  select clip_asset_id, count(*)::int as claims
  from clip_claims
  group by clip_asset_id
) claim_counts on claim_counts.clip_asset_id = ca.id
left join (
  select clip_asset_id, count(*)::int as downloads
  from clip_downloads
  group by clip_asset_id
) download_counts on download_counts.clip_asset_id = ca.id;

create or replace view product_summaries
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.platform,
  p.affiliate_url,
  p.commission_rate,
  p.is_active,
  coalesce(binding_counts.material_count, 0) as material_count,
  p.created_at
from products p
left join (
  select product_id, count(*)::int as material_count
  from clip_products
  group by product_id
) binding_counts on binding_counts.product_id = p.id;

create or replace view publish_record_summaries
with (security_invoker = true)
as
select
  pr.id,
  dp.display_name as distributor_name,
  ca.title as material_title,
  p.name as product_name,
  pr.platform,
  pr.status,
  pr.submitted_at,
  latest_perf.gmv,
  latest_perf.commission_amount as commission
from publish_records pr
left join distributor_profiles dp on dp.id = pr.distributor_id
left join clip_assets ca on ca.id = pr.clip_asset_id
left join products p on p.id = pr.product_id
left join lateral (
  select ps.gmv, ps.commission_amount
  from performance_snapshots ps
  where ps.publish_record_id = pr.id
  order by ps.captured_at desc
  limit 1
) latest_perf on true;

create or replace view settlement_summaries
with (security_invoker = true)
as
select
  so.id,
  dp.display_name as distributor_name,
  so.period,
  coalesce(valid_posts.verified_posts, 0) as verified_posts,
  so.total_amount as payable_commission,
  so.status,
  so.created_at
from settlement_orders so
left join distributor_profiles dp on dp.id = so.distributor_id
left join (
  select distributor_id, count(*)::int as verified_posts
  from publish_records
  where status = 'verified'
  group by distributor_id
) valid_posts on valid_posts.distributor_id = so.distributor_id;

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant select on material_summaries, product_summaries, publish_record_summaries, settlement_summaries to service_role;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on material_summaries, product_summaries, publish_record_summaries, settlement_summaries to authenticated;
