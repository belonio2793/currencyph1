-- ============================================================================
-- MIGRATION: Sync crypto_rates table to pairs table
-- ============================================================================
-- This adds the missing trigger to automatically sync the crypto_rates table
-- (populated by the fetch-rates edge function) to the pairs table.
-- Without this, rates fetched from ExConvert wouldn't be available to other parts of the system.
-- ============================================================================

BEGIN;

-- Function to sync pairs from crypto_rates table
CREATE OR REPLACE FUNCTION sync_crypto_rates_to_pairs()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM pairs 
    WHERE from_currency = OLD.from_currency 
      AND to_currency = OLD.to_currency 
      AND source_table = 'crypto_rates';
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO pairs (from_currency, to_currency, rate, source_table, updated_at)
    VALUES (NEW.from_currency, NEW.to_currency, NEW.rate, 'crypto_rates', NOW())
    ON CONFLICT (from_currency, to_currency) DO UPDATE
    SET rate = EXCLUDED.rate, source_table = EXCLUDED.source_table, updated_at = NOW();
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS crypto_rates_sync ON public.crypto_rates;

-- Create trigger to auto-sync crypto_rates
CREATE TRIGGER crypto_rates_sync
AFTER INSERT OR UPDATE OR DELETE ON public.crypto_rates
FOR EACH ROW
EXECUTE FUNCTION sync_crypto_rates_to_pairs();

-- Initial sync of existing rates from crypto_rates to pairs
INSERT INTO pairs (from_currency, to_currency, rate, source_table, updated_at)
SELECT from_currency, to_currency, CAST(rate AS NUMERIC), 'crypto_rates', NOW() 
FROM public.crypto_rates
ON CONFLICT (from_currency, to_currency) DO UPDATE
SET rate = EXCLUDED.rate, source_table = EXCLUDED.source_table, updated_at = NOW();

-- Log the sync
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM pairs WHERE source_table = 'crypto_rates';
  RAISE NOTICE 'Synced % rate pairs from crypto_rates to pairs table', v_count;
END $$;

COMMIT;
