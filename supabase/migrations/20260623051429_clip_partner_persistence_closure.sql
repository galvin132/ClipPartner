create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'authorization_status') then
    create type authorization_status as enum ('pending', 'approved', 'rejected', 'paused', 'banned', 'expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'material_status') then
    create type material_status as enum ('draft', 'processing', 'ready', 'published', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'publish_status') then
    create type publish_status as enum ('claimed', 'downloaded', 'submitted', 'verified', 'invalid', 'settled');
  end if;
  if not exists (select 1 from pg_type where typname = 'settlement_status') then
    create type settlement_status as enum ('pending', 'confirmed', 'paid', 'blocked');
  end if;
  if not exists (select 1 from pg_type where typname = 'social_platform') then
    create type social_platform as enum ('douyin', 'wechat_channels');
  end if;
end $$;

alter table distributor_profiles
  add column if not exists wechat_id text,
  add column if not exists onboarding_status text not null default 'registered',
  add column if not exists credit_score integer not null default 100,
  add column if not exists exam_score integer not null default 0,
  add column if not exists agreement_signed boolean not null default false;

alter table social_accounts
  add column if not exists shop_window_status text not null default 'unknown',
  add column if not exists risk_tag text;

alter table clip_assets
  add column if not exists selling_point text,
  add column if not exists forbidden_words text[] not null default '{}',
  add column if not exists quality_score integer not null default 0,
  add column if not exists expires_at date;

create table if not exists training_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  lesson_count integer not null default 0,
  estimated_minutes integer not null default 0,
  is_required boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists training_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references training_courses(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  duration_minutes integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists exam_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references training_courses(id) on delete set null,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  score integer not null default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists exam_attempts (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  score integer not null default 0,
  passed boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  attempted_at timestamptz not null default now()
);

create table if not exists agreement_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, version)
);

create table if not exists agreement_signatures (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  template_id uuid not null references agreement_templates(id) on delete restrict,
  signed_at timestamptz not null default now(),
  signer_ip text,
  signer_user_agent text
);

create table if not exists credit_score_events (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists authorization_pools (
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

create table if not exists authorization_events (
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

create table if not exists material_versions (
  id uuid primary key default gen_random_uuid(),
  clip_asset_id uuid not null references clip_assets(id) on delete cascade,
  version_type text not null default 'watermarked',
  r2_key text,
  watermark_text text,
  created_at timestamptz not null default now()
);

create table if not exists distribution_tasks (
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

create table if not exists distribution_task_materials (
  distribution_task_id uuid not null references distribution_tasks(id) on delete cascade,
  clip_asset_id uuid not null references clip_assets(id) on delete cascade,
  primary key (distribution_task_id, clip_asset_id)
);

create table if not exists task_claims (
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

create table if not exists download_tokens (
  id uuid primary key default gen_random_uuid(),
  task_claim_id uuid not null references task_claims(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  downloaded_at timestamptz,
  requester_ip text,
  requester_user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists clip_task_logs (
  id uuid primary key default gen_random_uuid(),
  clip_task_id uuid not null references clip_tasks(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists performance_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  status text not null default 'processing',
  total_rows integer not null default 0,
  matched_rows integer not null default 0,
  error_rows integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists performance_import_rows (
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

create table if not exists performance_import_errors (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references performance_import_batches(id) on delete cascade,
  row_id uuid references performance_import_rows(id) on delete cascade,
  error_code text not null,
  error_message text not null,
  created_at timestamptz not null default now()
);

create table if not exists publish_verification_results (
  id uuid primary key default gen_random_uuid(),
  publish_record_id uuid not null references publish_records(id) on delete cascade,
  result text not null,
  reason text,
  checked_by uuid,
  checked_at timestamptz not null default now()
);

create table if not exists commission_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_share_rate numeric(5, 2) not null default 30.00,
  refund_freeze_days integer not null default 15,
  min_payout_amount numeric(12, 2) not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists commission_tiers (
  id uuid primary key default gen_random_uuid(),
  commission_rule_id uuid not null references commission_rules(id) on delete cascade,
  min_monthly_gmv numeric(12, 2) not null default 0,
  share_rate numeric(5, 2) not null,
  created_at timestamptz not null default now()
);

create table if not exists settlement_periods (
  id uuid primary key default gen_random_uuid(),
  period text not null unique,
  status text not null default 'calculating',
  created_at timestamptz not null default now()
);

create table if not exists settlement_adjustments (
  id uuid primary key default gen_random_uuid(),
  settlement_order_id uuid references settlement_orders(id) on delete cascade,
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  amount numeric(12, 2) not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  available_amount numeric(12, 2) not null default 0,
  frozen_amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (distributor_id)
);

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  type text not null,
  amount numeric(12, 2) not null,
  status text not null,
  source text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists payment_records (
  id uuid primary key default gen_random_uuid(),
  settlement_order_id uuid references settlement_orders(id) on delete set null,
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  amount numeric(12, 2) not null,
  status text not null default 'pending',
  payment_note text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists settlement_disputes (
  id uuid primary key default gen_random_uuid(),
  settlement_order_id uuid references settlement_orders(id) on delete cascade,
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists risk_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_type text not null,
  credit_delta integer not null default 0,
  settlement_action text not null default 'none',
  authorization_action text not null default 'none',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists risk_events (
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

create table if not exists risk_actions (
  id uuid primary key default gen_random_uuid(),
  risk_event_id uuid not null references risk_events(id) on delete cascade,
  action_type text not null,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists evidence_files (
  id uuid primary key default gen_random_uuid(),
  risk_event_id uuid references risk_events(id) on delete cascade,
  r2_key text not null,
  file_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists appeals (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributor_profiles(id) on delete cascade,
  risk_event_id uuid references risk_events(id) on delete set null,
  reason text not null,
  status text not null default 'open',
  handled_note text,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null default 'all',
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists notification_reads (
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_exam_attempts_distributor on exam_attempts(distributor_id, attempted_at desc);
create index if not exists idx_credit_score_events_distributor on credit_score_events(distributor_id, created_at desc);
create index if not exists idx_authorization_pools_status on authorization_pools(status);
create index if not exists idx_distribution_tasks_status on distribution_tasks(status, start_at desc);
create index if not exists idx_task_claims_distributor_status on task_claims(distributor_id, status);
create index if not exists idx_download_tokens_claim on download_tokens(task_claim_id);
create index if not exists idx_wallet_transactions_distributor on wallet_transactions(distributor_id, created_at desc);
create index if not exists idx_risk_events_status on risk_events(status, created_at desc);
create index if not exists idx_notifications_created_at on notifications(created_at desc);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
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
    execute format('alter table public.%I enable row level security', target_table);
    execute format('drop policy if exists %I on public.%I', 'admin_all_' || target_table, target_table);
    execute format(
      'create policy %I on public.%I for all to authenticated using (((auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'', ''operator'', ''reviewer'', ''finance''))) with check (((auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'', ''operator'', ''reviewer'', ''finance'')))',
      'admin_all_' || target_table,
      target_table
    );
  end loop;
end $$;

drop policy if exists distributor_read_training_courses on training_courses;
create policy distributor_read_training_courses on training_courses
  for select to authenticated
  using (is_required = true);

drop policy if exists distributor_own_exam_attempts on exam_attempts;
create policy distributor_own_exam_attempts on exam_attempts
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

drop policy if exists distributor_insert_own_exam_attempts on exam_attempts;
create policy distributor_insert_own_exam_attempts on exam_attempts
  for insert to authenticated
  with check (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

drop policy if exists distributor_own_agreement_signatures on agreement_signatures;
create policy distributor_own_agreement_signatures on agreement_signatures
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

drop policy if exists distributor_insert_own_agreement_signatures on agreement_signatures;
create policy distributor_insert_own_agreement_signatures on agreement_signatures
  for insert to authenticated
  with check (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

drop policy if exists distributor_own_credit_score_events on credit_score_events;
create policy distributor_own_credit_score_events on credit_score_events
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

drop policy if exists distributor_read_authorization_pools on authorization_pools;
create policy distributor_read_authorization_pools on authorization_pools
  for select to authenticated
  using (status = 'open');

drop policy if exists distributor_own_authorizations on authorizations;
create policy distributor_own_authorizations on authorizations
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

drop policy if exists distributor_read_open_distribution_tasks on distribution_tasks;
create policy distributor_read_open_distribution_tasks on distribution_tasks
  for select to authenticated
  using (status = 'open');

drop policy if exists distributor_read_distribution_task_materials on distribution_task_materials;
create policy distributor_read_distribution_task_materials on distribution_task_materials
  for select to authenticated
  using (
    distribution_task_id in (
      select id from distribution_tasks where status = 'open'
    )
  );

drop policy if exists distributor_own_task_claims on task_claims;
create policy distributor_own_task_claims on task_claims
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

drop policy if exists distributor_insert_own_task_claims on task_claims;
create policy distributor_insert_own_task_claims on task_claims
  for insert to authenticated
  with check (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

drop policy if exists distributor_own_download_tokens on download_tokens;
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

drop policy if exists distributor_own_wallet_transactions on wallet_transactions;
create policy distributor_own_wallet_transactions on wallet_transactions
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

drop policy if exists distributor_own_appeals on appeals;
create policy distributor_own_appeals on appeals
  for select to authenticated
  using (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

drop policy if exists distributor_insert_own_appeals on appeals;
create policy distributor_insert_own_appeals on appeals
  for insert to authenticated
  with check (distributor_id in (select id from distributor_profiles where user_id = auth.uid()));

drop policy if exists distributor_read_notifications on notifications;
create policy distributor_read_notifications on notifications
  for select to authenticated
  using (audience in ('all', 'partner'));

drop policy if exists distributor_own_notification_reads on notification_reads;
create policy distributor_own_notification_reads on notification_reads
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists distributor_insert_own_notification_reads on notification_reads;
create policy distributor_insert_own_notification_reads on notification_reads
  for insert to authenticated
  with check (user_id = auth.uid());

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

insert into training_courses (title, lesson_count, estimated_minutes, is_required)
select 'ClipPartner onboarding rules', 5, 35, true
where not exists (select 1 from training_courses where title = 'ClipPartner onboarding rules');

insert into agreement_templates (name, version, body, is_active)
select 'ClipPartner authorization agreement', '2026.06', 'Default ClipPartner authorization agreement template.', true
where not exists (
  select 1 from agreement_templates
  where name = 'ClipPartner authorization agreement' and version = '2026.06'
);

insert into commission_rules (name, base_share_rate, refund_freeze_days, min_payout_amount, is_active)
select 'Default ClipPartner commission rule', 30.00, 15, 100.00, true
where not exists (select 1 from commission_rules where name = 'Default ClipPartner commission rule');

insert into notifications (audience, title, content)
select 'partner', 'ClipPartner pilot notice', 'Finish onboarding before claiming distribution tasks.'
where not exists (select 1 from notifications where title = 'ClipPartner pilot notice');

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on distributor_summaries, authorization_pool_summaries, distribution_task_summaries, partner_wallet_summaries to service_role;
grant select on distributor_summaries, authorization_pool_summaries, distribution_task_summaries, partner_wallet_summaries to authenticated;
