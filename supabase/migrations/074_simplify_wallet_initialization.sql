-- Migration: 074 - Simplify Wallet Initialization
-- Problem: Creating 25+ wallet entries on signup can cause performance issues
-- Solution: Only create the primary PHP wallet on signup, others can be created on-demand

-- Drop the old initialization function
DROP FUNCTION IF EXISTS public.initialize_user_wallets_internal(user_row auth.users) CASCADE;

-- Create simplified wallet initialization function
CREATE OR REPLACE FUNCTION public.initialize_user_wallets_internal(user_row auth.users)
RETURNS void AS $$
BEGIN
  -- Create only the primary PHP wallet
  INSERT INTO public.wallets_fiat (
    user_id,
    provider,
    provider_account_id,
    currency,
    balance,
    status,
    created_at,
    updated_at
  ) VALUES (
    user_row.id,
    'internal',
    'internal-PHP-' || user_row.id::TEXT,
    'PHP',
    0,
    'active',
    now(),
    now()
  ) ON CONFLICT (user_id, currency) DO NOTHING;
  
  -- Create USD wallet for international users
  INSERT INTO public.wallets_fiat (
    user_id,
    provider,
    provider_account_id,
    currency,
    balance,
    status,
    created_at,
    updated_at
  ) VALUES (
    user_row.id,
    'internal',
    'internal-USD-' || user_row.id::TEXT,
    'USD',
    0,
    'active',
    now(),
    now()
  ) ON CONFLICT (user_id, currency) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.initialize_user_wallets_internal(user_row auth.users) TO anon, authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION public.initialize_user_wallets_internal IS 'Initialize primary wallets (PHP and USD) on user signup. Additional wallets can be created on-demand.';
