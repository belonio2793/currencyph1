-- Migration: create core game tables for Currency MMO

-- Players table (game characters)
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  character_name text,
  balance numeric not null default 0,
  level int not null default 1,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists players_user_idx on players(user_id);

-- Persistent world positions for characters
create table if not exists world_positions (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references players(id) on delete cascade,
  x numeric,
  z numeric,
  lat double precision,
  lng double precision,
  street text,
  city text,
  recorded_at timestamptz not null default now()
);
create index if not exists world_positions_char_idx on world_positions(character_id);

-- Inventories (simple item records)
create table if not exists inventories (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  item jsonb not null,
  qty int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists inventories_player_idx on inventories(player_id);

-- Worker checkpoints for long-running jobs
create table if not exists worker_checkpoints (
  id uuid primary key default gen_random_uuid(),
  worker_name text not null,
  last_run timestamptz,
  state jsonb,
  created_at timestamptz not null default now()
);
create index if not exists worker_checkpoints_name_idx on worker_checkpoints(worker_name);

-- Property valuations table (historical snapshots)
create table if not exists property_valuations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  valuation numeric not null,
  source text,
  calculated_at timestamptz not null default now()
);
create index if not exists valuation_property_idx on property_valuations(property_id);

-- Notes: run this migration via Supabase SQL editor or supabase CLI using a service role key.
