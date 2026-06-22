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

create index idx_authorization_requests_status on authorization_requests(status);
create index idx_authorizations_distributor on authorizations(distributor_id);
create index idx_clip_assets_ip_status on clip_assets(ip_account_id, status);
create index idx_clip_claims_distributor on clip_claims(distributor_id);
create index idx_publish_records_status on publish_records(status);
create index idx_settlement_orders_distributor on settlement_orders(distributor_id);
