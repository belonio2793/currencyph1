-- ============================================================================
-- MIGRATION: Add currency conversion tracking to deposits
-- ============================================================================
-- Adds fields to track when a deposit is converted to a different currency
-- Enables auto-conversion from deposit currency to wallet currency

-- Step 1: Add new columns to track conversion
ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS received_amount NUMERIC(36, 8),
ADD COLUMN IF NOT EXISTS received_currency VARCHAR(16),
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(36, 8),
ADD COLUMN IF NOT EXISTS converted_amount NUMERIC(36, 8),
ADD COLUMN IF NOT EXISTS conversion_status TEXT DEFAULT 'pending' CHECK (conversion_status IN ('pending', 'confirmed', 'rejected', 'none')),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS idempotency_key UUID UNIQUE;

-- Step 2: Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_deposits_conversion_status ON deposits(conversion_status);
CREATE INDEX IF NOT EXISTS idx_deposits_approved_at ON deposits(approved_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_idempotency ON deposits(idempotency_key);

-- Step 3: Update existing deposits to have conversion_status = 'none'
UPDATE deposits
SET conversion_status = 'none'
WHERE conversion_status IS NULL;

-- Step 4: Create trigger to validate conversion data
CREATE OR REPLACE FUNCTION validate_deposit_conversion()
RETURNS trigger AS $$
BEGIN
  -- If conversion_status is 'confirmed', must have conversion data
  IF NEW.conversion_status = 'confirmed' THEN
    IF NEW.received_amount IS NULL 
       OR NEW.exchange_rate IS NULL 
       OR NEW.converted_amount IS NULL 
       OR NEW.received_currency IS NULL THEN
      RAISE EXCEPTION 'Conversion confirmed but missing conversion data';
    END IF;
    
    -- Validate math: received_amount * exchange_rate = converted_amount
    IF ABS(NEW.received_amount * NEW.exchange_rate - NEW.converted_amount) > 0.01 THEN
      RAISE EXCEPTION 'Conversion amount mismatch: % * % should equal %', 
        NEW.received_amount, NEW.exchange_rate, NEW.converted_amount;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_deposit_conversion ON deposits;
CREATE TRIGGER trg_validate_deposit_conversion
BEFORE INSERT OR UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION validate_deposit_conversion();

-- Step 5: Create function to get latest exchange rate for a currency pair
CREATE OR REPLACE FUNCTION get_latest_exchange_rate(
  p_from_currency VARCHAR(16),
  p_to_currency VARCHAR(16)
)
RETURNS NUMERIC AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  -- Try to get from crypto_rates table
  SELECT rate INTO v_rate
  FROM crypto_rates_valid
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
  ORDER BY updated_at DESC
  LIMIT 1;
  
  IF v_rate IS NOT NULL THEN
    RETURN v_rate;
  END IF;
  
  -- If not found, return NULL (application will handle)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create audit table for conversion tracking
CREATE TABLE IF NOT EXISTS deposit_conversion_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('conversion_initiated', 'conversion_confirmed', 'conversion_rejected', 'conversion_applied')),
  received_amount NUMERIC(36, 8),
  received_currency VARCHAR(16),
  exchange_rate NUMERIC(36, 8),
  converted_amount NUMERIC(36, 8),
  wallet_currency VARCHAR(16),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_conversion_audit_deposit ON deposit_conversion_audit(deposit_id);
CREATE INDEX IF NOT EXISTS idx_deposit_conversion_audit_user ON deposit_conversion_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_conversion_audit_created ON deposit_conversion_audit(created_at DESC);

-- ============================================================================
-- END MIGRATION
-- ============================================================================
