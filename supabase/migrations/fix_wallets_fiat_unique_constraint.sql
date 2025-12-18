-- Migration: Add missing UNIQUE constraint on wallets_fiat
-- This constraint is required for the ON CONFLICT clause in initialize_user_wallets()
-- to work correctly when multiple wallets are being inserted for the same user.

-- ============================================================================
-- 1. ADD UNIQUE CONSTRAINT on (user_id, currency)
-- ============================================================================
ALTER TABLE IF EXISTS public.wallets_fiat
ADD CONSTRAINT wallets_fiat_user_currency_unique UNIQUE (user_id, currency);

-- ============================================================================
-- 2. VERIFY CONSTRAINT
-- ============================================================================
-- List all constraints on wallets_fiat table
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'wallets_fiat' AND table_schema = 'public'
ORDER BY constraint_name;
