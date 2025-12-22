-- ============================================================================
-- MIGRATION 059: Add wallet type column and auto-distinguish fiat vs crypto
-- ============================================================================
-- This migration:
-- 1. Adds a "type" column to the wallets table
-- 2. Creates a trigger to auto-populate type based on currency type
-- 3. Populates existing wallets with type based on their currency
-- ============================================================================

-- Step 1: Add type column to wallets table
ALTER TABLE public.wallets
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('fiat', 'crypto', 'wire'));

-- Step 2: Create index on type for faster queries
CREATE INDEX IF NOT EXISTS idx_wallets_type ON public.wallets(type);
CREATE INDEX IF NOT EXISTS idx_wallets_user_type ON public.wallets(user_id, type);

-- Step 3: Populate existing wallets with type based on currency_code
UPDATE public.wallets w
SET type = COALESCE(c.type, 'fiat')
FROM public.currencies c
WHERE w.currency_code = c.code
  AND w.type IS NULL;

-- Step 4: Create or replace function to auto-set type on wallet creation
CREATE OR REPLACE FUNCTION public.set_wallet_type()
RETURNS TRIGGER AS $$
BEGIN
  -- If type is not provided, get it from the currency table
  IF NEW.type IS NULL THEN
    SELECT type INTO NEW.type
    FROM public.currencies
    WHERE code = NEW.currency_code;
    
    -- Default to 'fiat' if currency not found
    IF NEW.type IS NULL THEN
      NEW.type := 'fiat';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create or replace trigger
DROP TRIGGER IF EXISTS wallet_type_trigger ON public.wallets;

CREATE TRIGGER wallet_type_trigger
BEFORE INSERT ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.set_wallet_type();

-- Step 6: Make type column NOT NULL after populating
ALTER TABLE public.wallets
ALTER COLUMN type SET NOT NULL,
ALTER COLUMN type SET DEFAULT 'fiat';

-- Step 7: Create view for easy wallet querying by type
DROP VIEW IF EXISTS public.user_wallets_by_type CASCADE;

CREATE VIEW public.user_wallets_by_type AS
SELECT
  w.id,
  w.user_id,
  w.currency_code,
  w.type,
  c.name AS currency_name,
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
LEFT JOIN public.currencies c ON w.currency_code = c.code
WHERE w.is_active = true;

-- Step 8: Grant permissions
GRANT SELECT ON public.user_wallets_by_type TO anon, authenticated;

-- Step 9: Update RLS policy to include type awareness (optional, for future features)
-- Current policies remain unchanged as they already filter by user_id

-- ============================================================================
-- END MIGRATION 059
-- ============================================================================
