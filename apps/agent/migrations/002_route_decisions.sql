-- Card 5: shadow routing decisions. Applied on boot with 001_init.sql.
-- Idempotent. Decisions are never used for dispatch in shadow mode.

create table if not exists route_decisions (
  decision_id text primary key,
  thread_id text not null,
  run_id text not null,
  owner_id text not null,
  mode text not null check (mode in ('shadow', 'live')),
  source text not null check (source in ('default', 'typed-router', 'llm-fallback')),
  skill text not null,
  tier text not null check (tier in ('fast', 'deep', 'research')),
  needs_research boolean not null,
  needs_plan boolean not null,
  confidence real not null check (confidence between 0 and 1),
  margin real not null check (margin between 0 and 1),
  proposed jsonb not null,
  baseline jsonb not null,
  comparison jsonb not null,
  agreement boolean not null,
  latency_ms integer not null check (latency_ms >= 0),
  created_at timestamptz not null default now()
);

-- Local dev databases created by an earlier revision gain the new column.
alter table route_decisions add column if not exists comparison jsonb;
update route_decisions set comparison = baseline where comparison is null;
alter table route_decisions alter column comparison set not null;

create index if not exists route_decisions_created_idx
  on route_decisions (created_at desc);
create index if not exists route_decisions_owner_idx
  on route_decisions (owner_id, created_at desc);
