-- Card 7: durable goal runs. Applied by apps/agent on boot when DATABASE_URL
-- is set. Idempotent; safe to re-run on every process start.
create table if not exists goal_runs (
  run_id text primary key,
  owner_id text not null,
  thread_id text not null,
  record jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goal_runs_owner_idx
  on goal_runs (owner_id, updated_at desc);

-- Immutable side-effect ledger: a key may be inserted once. The engine
-- inserts the key before the effect runs; a retry that sees a conflict must
-- NOT repeat the effect.
create table if not exists goal_run_effects (
  effect_key text primary key,
  run_id text not null references goal_runs (run_id) on delete cascade,
  created_at timestamptz not null default now()
);
