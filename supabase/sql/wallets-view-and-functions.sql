-- This script creates the necessary views and functions for the wallets system
-- Run this in Supabase SQL Editor (SQL > New Query) for your project

-- 1. Drop existing view and functions if they exist
DROP VIEW IF EXISTS public.user_wallets_summary CASCADE;
DROP FUNCTION IF EXISTS public.ensure_user_wallets(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.trigger_ensure_wallets() CASCADE;
DROP TRIGGER IF EXISTS ensure_wallets_on_signup ON auth.users;

-- 2. Create user_wallets_summary view
-- This view joins wallets with currencies to show complete wallet information
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

-- 3. Grant permissions on the view
GRANT SELECT ON public.user_wallets_summary TO anon, authenticated;

-- 4. Create function to ensure user has a PHP wallet
CREATE FUNCTION public.ensure_user_wallets(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_php_exists BOOLEAN;
BEGIN
  -- Check if user already has PHP wallet
  SELECT EXISTS(
    SELECT 1 FROM public.wallets 
    WHERE user_id = p_user_id AND currency_code = 'PHP'
  ) INTO v_php_exists;
  
  -- Create PHP wallet if it doesn't exist
  IF NOT v_php_exists THEN
    INSERT INTO public.wallets (user_id, currency_code, balance, is_active)
    VALUES (p_user_id, 'PHP', 0, true)
    ON CONFLICT (user_id, currency_code) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.ensure_user_wallets(uuid) TO anon, authenticated;

-- 6. Create trigger function for auto-wallet creation on signup
CREATE FUNCTION public.trigger_ensure_wallets()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.ensure_user_wallets(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger on auth.users table to auto-create wallets on signup
CREATE TRIGGER ensure_wallets_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.trigger_ensure_wallets();

-- Done! The wallets system is now ready to use.
-- - New users will automatically get a PHP wallet when they sign up
-- - The user_wallets_summary view shows all wallet information joined with currency data
-- - The ensure_user_wallets function can be called to manually ensure a PHP wallet exists
