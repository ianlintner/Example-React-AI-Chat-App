-- Phase 1: threads, messages, runs. Applied by apps/agent on boot when
-- DATABASE_URL is set. Idempotent.

create table if not exists threads (
  thread_id text primary key,
  owner_id text not null,
  title text not null default 'New thread',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists threads_owner_idx on threads (owner_id, updated_at desc);

create table if not exists thread_messages (
  thread_id text primary key references threads (thread_id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists runs (
  run_id text primary key,
  thread_id text not null references threads (thread_id) on delete cascade,
  owner_id text not null,
  status text not null check (status in ('running', 'completed', 'failed', 'aborted')),
  tier text not null check (tier in ('fast', 'deep', 'research')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists runs_thread_idx on runs (thread_id, created_at desc);
