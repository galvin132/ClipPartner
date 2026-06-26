create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('credit_adjust', 'wallet_freeze', 'settlement_block')),
  target_id text not null,
  actor_id text,
  status text not null check (status in ('ok', 'failed')),
  detail jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_events_event_type_created_at on public.audit_events(event_type, created_at desc);
create index if not exists idx_audit_events_target_id_created_at on public.audit_events(target_id, created_at desc);
create index if not exists idx_audit_events_status_created_at on public.audit_events(status, created_at desc);

alter table public.audit_events enable row level security;

drop policy if exists audit_events_service_role_all on public.audit_events;
create policy audit_events_service_role_all on public.audit_events
  for all to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on public.audit_events to service_role;
