-- Migration: create wallets_crypto table used by frontend

create table if not exists wallets_crypto (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  provider text,
  provider_type text,
  address text,
  chain_id int,
  chain text,
  currency text,
  balance numeric default 0,
  metadata jsonb default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists wallets_crypto_user_id_idx on wallets_crypto(user_id);
create index if not exists wallets_crypto_address_idx on wallets_crypto(address);
create index if not exists wallets_crypto_chain_idx on wallets_crypto(chain_id);
