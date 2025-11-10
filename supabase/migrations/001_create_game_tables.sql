-- game properties and related tables for Play Currency game

create table if not exists public.property_types (
  id uuid default gen_random_uuid() primary key,
  type text not null unique,
  label text,
  base_cost numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.game_properties (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references public.users(id) on delete set null,
  type text not null,
  level int default 0,
  x int default 0,
  z int default 0,
  placed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_game_properties_owner on public.game_properties(owner_id);

create table if not exists public.player_achievements (
  id uuid default gen_random_uuid() primary key,
  player_id uuid references public.users(id) on delete cascade,
  achievement_key text not null,
  progress numeric default 0,
  unlocked boolean default false,
  unlocked_at timestamptz
);

create table if not exists public.game_balance_logs (
  id uuid default gen_random_uuid() primary key,
  player_id uuid references public.users(id) on delete cascade,
  delta numeric not null,
  reason text,
  created_at timestamptz default now()
);
