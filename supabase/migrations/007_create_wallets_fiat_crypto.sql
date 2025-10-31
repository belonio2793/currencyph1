-- Create separate tables for fiat and crypto wallets and a house/network balances table

CREATE TABLE IF NOT EXISTS public.wallets_fiat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_account_id text,
  currency varchar(16) NOT NULL,
  balance numeric(36,8) NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallets_fiat_user ON public.wallets_fiat(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_fiat_currency ON public.wallets_fiat(currency);

CREATE TABLE IF NOT EXISTS public.wallets_crypto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain text NOT NULL,
  address text NOT NULL,
  provider text,
  balance numeric(36,8) NOT NULL DEFAULT 0,
  synced_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, chain, address)
);

CREATE INDEX IF NOT EXISTS idx_wallets_crypto_user ON public.wallets_crypto(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_crypto_chain ON public.wallets_crypto(chain);

-- House / network balances table to track platform-level balances
CREATE TABLE IF NOT EXISTS public.wallets_house (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_type text NOT NULL CHECK (wallet_type IN ('fiat','crypto')),
  currency varchar(16) NOT NULL,
  network text,
  balance numeric(36,8) NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallets_house_type ON public.wallets_house(wallet_type);
CREATE INDEX IF NOT EXISTS idx_wallets_house_currency ON public.wallets_house(currency);

-- Basic RLS: allow authenticated users to view their own rows
ALTER TABLE public.wallets_fiat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets_crypto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fiat wallets" ON public.wallets_fiat
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own crypto wallets" ON public.wallets_crypto
  FOR SELECT USING (auth.uid() = user_id);

-- House table is admin-only; do not expose via RLS policy by default
