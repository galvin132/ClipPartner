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

alter table distributor_profiles
  add column if not exists wechat_id text,
  add column if not exists onboarding_status text not null default 'registered',
  add column if not exists credit_score integer not null default 100,
  add column if not exists exam_score integer not null default 0,
  add column if not exists agreement_signed boolean not null default false;

create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  platform social_platform not null,
  account_name text not null,
  account_url text,
  followers integer not null default 0,
  category text not null default '未分类',
  status authorization_status not null default 'pending',
  binding_note text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table social_accounts
  add column if not exists shop_window_status text not null default 'unknown',
  add column if not exists risk_tag text;

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

alter table clip_assets
  add column if not exists selling_point text,
  add column if not exists recommended_copy text,
  add column if not exists forbidden_words text[] not null default '{}',
  add column if not exists quality_score integer not null default 0,
  add column if not exists expires_at date;

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
create index idx_social_accounts_status on social_accounts(status);
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

create table training_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  lesson_count integer not null default 0,
  estimated_minutes integer not null default 0,
  is_required boolean not null default true,
  created_at timestamptz not null default now()
);

create table training_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references training_courses(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  duration_minutes integer not null default 0,
  created_at timestamptz not null default now()
);

create table exam_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references training_courses(id) on delete set null,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  score integer not null default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table exam_attempts (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  score integer not null default 0,
  passed boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  attempted_at timestamptz not null default now()
);

create table agreement_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, version)
);

create table agreement_signatures (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  template_id uuid not null references agreement_templates(id) on delete restrict,
  signed_at timestamptz not null default now(),
  signer_ip text,
  signer_user_agent text
);

create table credit_score_events (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table authorization_pools (
  id uuid primary key default gen_random_uuid(),
  ip_account_id uuid not null references ip_accounts(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'paused', 'full')),
  total_quota integer not null default 0,
  used_quota integer not null default 0,
  min_credit_score integer not null default 80,
  default_share_rate numeric(5, 2) not null default 30.00,
  daily_claim_limit integer not null default 10,
  requirement text not null default '',
  created_at timestamptz not null default now()
);

create table authorization_events (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid references authorizations(id) on delete cascade,
  event_type text not null,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);

alter table authorizations
  add column if not exists authorization_pool_id uuid references authorization_pools(id) on delete set null,
  add column if not exists daily_claim_limit integer not null default 10,
  add column if not exists agreement_signature_id uuid references agreement_signatures(id) on delete set null,
  add column if not exists paused_reason text;

create table material_versions (
  id uuid primary key default gen_random_uuid(),
  clip_asset_id uuid not null references clip_assets(id) on delete cascade,
  version_type text not null default 'watermarked',
  r2_key text,
  watermark_text text,
  created_at timestamptz not null default now()
);

create table distribution_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  ip_account_id uuid not null references ip_accounts(id) on delete cascade,
  platform social_platform not null,
  product_id uuid not null references products(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'open', 'paused', 'closed')),
  start_at timestamptz not null default now(),
  end_at timestamptz,
  reward_rule text not null default '',
  claim_limit integer not null default 0,
  claimed_count integer not null default 0,
  published_count integer not null default 0,
  requirement text not null default '',
  created_at timestamptz not null default now()
);

create table distribution_task_materials (
  distribution_task_id uuid not null references distribution_tasks(id) on delete cascade,
  clip_asset_id uuid not null references clip_assets(id) on delete cascade,
  primary key (distribution_task_id, clip_asset_id)
);

create table task_claims (
  id uuid primary key default gen_random_uuid(),
  distribution_task_id uuid not null references distribution_tasks(id) on delete cascade,
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  authorization_id uuid references authorizations(id) on delete set null,
  social_account_id uuid not null references social_accounts(id) on delete restrict,
  clip_asset_id uuid not null references clip_assets(id) on delete restrict,
  product_id uuid not null references products(id) on delete restrict,
  status text not null default 'claimed' check (status in ('claimed', 'downloaded', 'submitted', 'overdue', 'verified', 'invalid', 'settled')),
  claim_token text not null unique,
  submitted_url text,
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table download_tokens (
  id uuid primary key default gen_random_uuid(),
  task_claim_id uuid not null references task_claims(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  downloaded_at timestamptz,
  requester_ip text,
  requester_user_agent text,
  created_at timestamptz not null default now()
);

create table clip_task_logs (
  id uuid primary key default gen_random_uuid(),
  clip_task_id uuid not null references clip_tasks(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  created_at timestamptz not null default now()
);

create table performance_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  status text not null default 'processing',
  total_rows integer not null default 0,
  matched_rows integer not null default 0,
  error_rows integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table performance_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references performance_import_batches(id) on delete cascade,
  publish_url text,
  platform social_platform,
  gmv numeric(12, 2) not null default 0,
  commission_amount numeric(12, 2) not null default 0,
  raw_row jsonb not null default '{}'::jsonb,
  matched_publish_record_id uuid references publish_records(id) on delete set null,
  created_at timestamptz not null default now()
);

create table performance_import_errors (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references performance_import_batches(id) on delete cascade,
  row_id uuid references performance_import_rows(id) on delete cascade,
  error_code text not null,
  error_message text not null,
  created_at timestamptz not null default now()
);

create table publish_verification_results (
  id uuid primary key default gen_random_uuid(),
  publish_record_id uuid not null references publish_records(id) on delete cascade,
  result text not null,
  reason text,
  checked_by uuid,
  checked_at timestamptz not null default now()
);

create table commission_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_share_rate numeric(5, 2) not null default 30.00,
  refund_freeze_days integer not null default 15,
  min_payout_amount numeric(12, 2) not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table commission_tiers (
  id uuid primary key default gen_random_uuid(),
  commission_rule_id uuid not null references commission_rules(id) on delete cascade,
  min_monthly_gmv numeric(12, 2) not null default 0,
  share_rate numeric(5, 2) not null,
  created_at timestamptz not null default now()
);

create table settlement_periods (
  id uuid primary key default gen_random_uuid(),
  period text not null unique,
  status text not null default 'calculating',
  created_at timestamptz not null default now()
);

create table settlement_adjustments (
  id uuid primary key default gen_random_uuid(),
  settlement_order_id uuid references settlement_orders(id) on delete cascade,
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  amount numeric(12, 2) not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  available_amount numeric(12, 2) not null default 0,
  frozen_amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (distributor_id)
);

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  type text not null,
  amount numeric(12, 2) not null,
  status text not null,
  source text not null,
  note text,
  created_at timestamptz not null default now()
);

create table payment_records (
  id uuid primary key default gen_random_uuid(),
  settlement_order_id uuid references settlement_orders(id) on delete set null,
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  amount numeric(12, 2) not null,
  status text not null default 'pending',
  payment_note text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table settlement_disputes (
  id uuid primary key default gen_random_uuid(),
  settlement_order_id uuid references settlement_orders(id) on delete cascade,
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table risk_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_type text not null,
  credit_delta integer not null default 0,
  settlement_action text not null default 'none',
  authorization_action text not null default 'none',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table risk_events (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid references distributor_profiles(id) on delete set null,
  publish_record_id uuid references publish_records(id) on delete set null,
  task_claim_id uuid references task_claims(id) on delete set null,
  risk_rule_id uuid references risk_rules(id) on delete set null,
  title text not null,
  description text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table risk_actions (
  id uuid primary key default gen_random_uuid(),
  risk_event_id uuid not null references risk_events(id) on delete cascade,
  action_type text not null,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create table evidence_files (
  id uuid primary key default gen_random_uuid(),
  risk_event_id uuid references risk_events(id) on delete cascade,
  r2_key text not null,
  file_type text not null,
  created_at timestamptz not null default now()
);

create table appeals (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  risk_event_id uuid references risk_events(id) on delete set null,
  reason text not null,
  status text not null default 'open',
  handled_note text,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null default 'all',
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table notification_reads (
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index idx_exam_attempts_distributor on exam_attempts(distributor_id, attempted_at desc);
create index idx_credit_score_events_distributor on credit_score_events(distributor_id, created_at desc);
create index idx_authorization_pools_status on authorization_pools(status);
create index idx_distribution_tasks_status on distribution_tasks(status, start_at desc);
create index idx_task_claims_distributor_status on task_claims(distributor_id, status);
create index idx_download_tokens_claim on download_tokens(task_claim_id);
create index idx_wallet_transactions_distributor on wallet_transactions(distributor_id, created_at desc);
create index idx_risk_events_status on risk_events(status, created_at desc);
create index idx_notifications_created_at on notifications(created_at desc);

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
alter table training_courses enable row level security;
alter table training_lessons enable row level security;
alter table exam_questions enable row level security;
alter table exam_attempts enable row level security;
alter table agreement_templates enable row level security;
alter table agreement_signatures enable row level security;
alter table credit_score_events enable row level security;
alter table authorization_pools enable row level security;
alter table authorization_events enable row level security;
alter table material_versions enable row level security;
alter table distribution_tasks enable row level security;
alter table distribution_task_materials enable row level security;
alter table task_claims enable row level security;
alter table download_tokens enable row level security;
alter table clip_task_logs enable row level security;
alter table performance_import_batches enable row level security;
alter table performance_import_rows enable row level security;
alter table performance_import_errors enable row level security;
alter table publish_verification_results enable row level security;
alter table commission_rules enable row level security;
alter table commission_tiers enable row level security;
alter table settlement_periods enable row level security;
alter table settlement_adjustments enable row level security;
alter table wallet_accounts enable row level security;
alter table wallet_transactions enable row level security;
alter table payment_records enable row level security;
alter table settlement_disputes enable row level security;
alter table risk_rules enable row level security;
alter table risk_events enable row level security;
alter table risk_actions enable row level security;
alter table evidence_files enable row level security;
alter table appeals enable row level security;
alter table notifications enable row level security;
alter table notification_reads enable row level security;
alter table audit_logs enable row level security;

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

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'training_courses',
    'training_lessons',
    'exam_questions',
    'exam_attempts',
    'agreement_templates',
    'agreement_signatures',
    'credit_score_events',
    'authorization_pools',
    'authorization_events',
    'material_versions',
    'distribution_tasks',
    'distribution_task_materials',
    'task_claims',
    'download_tokens',
    'clip_task_logs',
    'performance_import_batches',
    'performance_import_rows',
    'performance_import_errors',
    'publish_verification_results',
    'commission_rules',
    'commission_tiers',
    'settlement_periods',
    'settlement_adjustments',
    'wallet_accounts',
    'wallet_transactions',
    'payment_records',
    'settlement_disputes',
    'risk_rules',
    'risk_events',
    'risk_actions',
    'evidence_files',
    'appeals',
    'notifications',
    'notification_reads',
    'audit_logs'
  ] loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'admin_all_' || table_name
    ) then
      execute format(
        'create policy %I on %I for all to authenticated using (((auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'', ''operator'', ''reviewer'', ''finance''))) with check (((auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'', ''operator'', ''reviewer'', ''finance'')))',
        'admin_all_' || table_name,
        table_name
      );
    end if;
  end loop;
end $$;

create policy distributor_read_training_courses on training_courses
  for select to authenticated
  using (is_required = true);

create policy distributor_own_exam_attempts on exam_attempts
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_insert_own_exam_attempts on exam_attempts
  for insert to authenticated
  with check (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_own_agreement_signatures on agreement_signatures
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_insert_own_agreement_signatures on agreement_signatures
  for insert to authenticated
  with check (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_own_credit_score_events on credit_score_events
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_read_authorization_pools on authorization_pools
  for select to authenticated
  using (status = 'open');

create policy distributor_own_authorizations on authorizations
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_read_open_distribution_tasks on distribution_tasks
  for select to authenticated
  using (status = 'open');

create policy distributor_read_distribution_task_materials on distribution_task_materials
  for select to authenticated
  using (
    distribution_task_id in (
      select id from distribution_tasks where status = 'open'
    )
  );

create policy distributor_own_task_claims on task_claims
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_insert_own_task_claims on task_claims
  for insert to authenticated
  with check (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_own_download_tokens on download_tokens
  for select to authenticated
  using (
    task_claim_id in (
      select tc.id
      from task_claims tc
      join distributor_profiles dp on dp.id = tc.distributor_id
      where dp.user_id = auth.uid()
    )
  );

create policy distributor_own_wallet_transactions on wallet_transactions
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_own_appeals on appeals
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_insert_own_appeals on appeals
  for insert to authenticated
  with check (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

create policy distributor_read_notifications on notifications
  for select to authenticated
  using (audience in ('all', 'partner'));

create policy distributor_own_notification_reads on notification_reads
  for select to authenticated
  using (user_id = auth.uid());

create policy distributor_insert_own_notification_reads on notification_reads
  for insert to authenticated
  with check (user_id = auth.uid());

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

create or replace view distributor_summaries
with (security_invoker = true)
as
select
  dp.id,
  dp.display_name,
  dp.phone,
  dp.wechat_id,
  dp.onboarding_status,
  dp.credit_score,
  dp.exam_score,
  dp.agreement_signed,
  coalesce(account_counts.account_count, 0) as account_count,
  coalesce(authorization_counts.authorization_count, 0) as authorization_count,
  coalesce(violation_counts.violation_count, 0) as violation_count,
  coalesce(wallet.available_amount, 0) as payable_commission,
  dp.created_at
from distributor_profiles dp
left join (
  select distributor_id, count(*)::int as account_count
  from social_accounts
  group by distributor_id
) account_counts on account_counts.distributor_id = dp.id
left join (
  select distributor_id, count(*)::int as authorization_count
  from authorizations
  where status = 'approved'
  group by distributor_id
) authorization_counts on authorization_counts.distributor_id = dp.id
left join (
  select distributor_id, count(*)::int as violation_count
  from violation_records
  group by distributor_id
) violation_counts on violation_counts.distributor_id = dp.id
left join (
  select distributor_id, sum(amount) as available_amount
  from wallet_transactions
  where status = 'available'
  group by distributor_id
) wallet on wallet.distributor_id = dp.id;

create or replace view authorization_pool_summaries
with (security_invoker = true)
as
select
  ap.id,
  ia.name as ip_name,
  ia.platform,
  ap.status,
  ap.total_quota,
  ap.used_quota,
  ap.min_credit_score,
  ap.default_share_rate,
  ap.daily_claim_limit,
  ap.requirement,
  ap.created_at
from authorization_pools ap
join ip_accounts ia on ia.id = ap.ip_account_id;

create or replace view distribution_task_summaries
with (security_invoker = true)
as
select
  dt.id,
  dt.title,
  ia.name as ip_name,
  dt.platform,
  p.name as product_name,
  dt.status,
  dt.start_at,
  dt.end_at,
  dt.reward_rule,
  dt.claim_limit,
  dt.claimed_count,
  dt.published_count,
  dt.requirement,
  coalesce(materials.material_ids, '{}') as material_ids,
  dt.created_at
from distribution_tasks dt
join ip_accounts ia on ia.id = dt.ip_account_id
join products p on p.id = dt.product_id
left join (
  select distribution_task_id, array_agg(clip_asset_id::text order by clip_asset_id::text) as material_ids
  from distribution_task_materials
  group by distribution_task_id
) materials on materials.distribution_task_id = dt.id;

create or replace view partner_wallet_summaries
with (security_invoker = true)
as
select
  dp.id as distributor_id,
  dp.display_name as distributor_name,
  coalesce(sum(wt.amount) filter (where wt.status = 'available'), 0) as available_amount,
  coalesce(sum(abs(wt.amount)) filter (where wt.status = 'frozen'), 0) as frozen_amount,
  coalesce(sum(wt.amount) filter (where wt.status = 'pending'), 0) as pending_amount,
  coalesce(sum(wt.amount) filter (where wt.status = 'paid'), 0) as paid_amount,
  max(wt.created_at) as last_transaction_at
from distributor_profiles dp
left join wallet_transactions wt on wt.distributor_id = dp.id
group by dp.id, dp.display_name;

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant select on material_summaries, product_summaries, publish_record_summaries, settlement_summaries, distributor_summaries, authorization_pool_summaries, distribution_task_summaries, partner_wallet_summaries to service_role;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on material_summaries, product_summaries, publish_record_summaries, settlement_summaries, distributor_summaries, authorization_pool_summaries, distribution_task_summaries, partner_wallet_summaries to authenticated;
