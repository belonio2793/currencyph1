-- Migration: create wallets, wallets_fiat, wallets_house, wallets_tokens, transactions

create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  provider text,
  provider_type text,
  address text,
  chain_id int,
  currency_code text,
  balance numeric default 0,
  token_balances jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists wallets_user_id_idx on wallets(user_id);
create index if not exists wallets_address_idx on wallets(address);
create index if not exists wallets_chain_idx on wallets(chain_id);

create table if not exists wallets_fiat (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  provider text,
  account_number text,
  currency_code text,
  balance numeric default 0,
  metadata jsonb default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists wallets_house (
  id uuid primary key default gen_random_uuid(),
  network text,
  currency_code text,
  address text,
  balance numeric default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists wallets_tokens (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references wallets(id) on delete cascade,
  token_address text,
  token_symbol text,
  token_decimals int,
  balance numeric default 0,
  metadata jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  wallet_id uuid references wallets(id) on delete set null,
  type text,
  amount numeric,
  currency_code text,
  status text,
  tx_hash text,
  raw jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists tx_wallet_idx on transactions(wallet_id);
create index if not exists tx_user_idx on transactions(user_id);
