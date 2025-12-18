-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create currencies table
CREATE TABLE IF NOT EXISTS public.currencies (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('fiat', 'crypto')),
  symbol VARCHAR(10),
  decimals INTEGER DEFAULT 2,
  is_default BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wallets table with proper structure
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_currency_code ON public.wallets(currency_code);
CREATE INDEX IF NOT EXISTS idx_wallets_user_currency ON public.wallets(user_id, currency_code);

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.user_wallets_summary;

-- Create user_wallets_summary view
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

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.ensure_user_wallets(uuid);

-- Create function to ensure user has PHP wallet
CREATE FUNCTION public.ensure_user_wallets(user_id uuid)
RETURNS void AS $$
DECLARE
  php_exists BOOLEAN;
  currency_record RECORD;
BEGIN
  -- Check if user already has PHP wallet
  SELECT EXISTS(
    SELECT 1 FROM public.wallets 
    WHERE user_id = $1 AND currency_code = 'PHP'
  ) INTO php_exists;
  
  -- Create PHP wallet if it doesn't exist
  IF NOT php_exists THEN
    INSERT INTO public.wallets (user_id, currency_code, balance, is_active)
    VALUES ($1, 'PHP', 0, true)
    ON CONFLICT (user_id, currency_code) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF NOT EXISTS ensure_wallets_on_signup ON auth.users;
DROP FUNCTION IF EXISTS public.trigger_ensure_wallets();

-- Create trigger function to auto-create wallets on user signup
CREATE FUNCTION public.trigger_ensure_wallets()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.ensure_user_wallets(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on auth.users table
CREATE TRIGGER ensure_wallets_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.trigger_ensure_wallets();

-- Grant permissions
GRANT SELECT ON public.currencies TO anon, authenticated;
GRANT SELECT ON public.wallets TO anon, authenticated;
GRANT INSERT, UPDATE ON public.wallets TO anon, authenticated;
GRANT SELECT ON public.user_wallets_summary TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_wallets TO anon, authenticated;
