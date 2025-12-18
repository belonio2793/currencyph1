-- Drop problematic constraints and recreate wallets table properly
-- Run this in Supabase SQL Editor

-- 1. Drop the old wallets table and views
DROP VIEW IF EXISTS public.user_wallets_summary CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;

-- 2. Create wallets table without FK constraint to auth.users (won't work due to schema)
-- Instead, store user_id as UUID and rely on application logic
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  currency_code VARCHAR(10) NOT NULL REFERENCES public.currencies(code) ON DELETE RESTRICT,
  balance DECIMAL(20, 8) DEFAULT 0,
  total_deposited DECIMAL(20, 8) DEFAULT 0,
  total_withdrawn DECIMAL(20, 8) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  account_number VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, currency_code)
);

-- 3. Create indexes for performance
CREATE INDEX idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX idx_wallets_currency_code ON public.wallets(currency_code);
CREATE INDEX idx_wallets_user_currency ON public.wallets(user_id, currency_code);

-- 4. Create the view for wallet details with currencies
CREATE VIEW public.user_wallets_summary AS
SELECT
  w.id,
  w.user_id,
  w.currency_code,
  c.name AS currency_name,
  c.type AS currency_type,
  c.symbol,
  c.decimals,
  w.balance,
  w.total_deposited,
  w.total_withdrawn,
  w.is_active,
  w.account_number,
  w.created_at,
  w.updated_at
FROM public.wallets w
INNER JOIN public.currencies c ON w.currency_code = c.code
WHERE c.active = true AND w.is_active = true;

-- 5. Set RLS policies
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Users can only see their own wallets
DROP POLICY IF EXISTS wallets_select_policy ON public.wallets;
CREATE POLICY wallets_select_policy ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own wallets
DROP POLICY IF EXISTS wallets_insert_policy ON public.wallets;
CREATE POLICY wallets_insert_policy ON public.wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own wallets
DROP POLICY IF EXISTS wallets_update_policy ON public.wallets;
CREATE POLICY wallets_update_policy ON public.wallets
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.wallets TO anon, authenticated;
GRANT SELECT ON public.user_wallets_summary TO anon, authenticated;

-- Done!
-- The wallets table is now ready:
-- - user_id is stored as UUID but not FK constrained to auth.users
-- - RLS policies ensure users can only access their own wallets
-- - Unique constraint prevents duplicate wallets per user per currency
