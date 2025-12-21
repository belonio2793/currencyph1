-- ============================================================================
-- MIGRATION: Create crypto_rates table for fallback storage
-- ============================================================================
--
-- This table stores cryptocurrency rates fetched from external APIs
-- Used as a fallback when external APIs are unavailable
-- Also serves as a cache to reduce API calls
--
-- ============================================================================

BEGIN;

-- Ensure extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create crypto_rates table
CREATE TABLE IF NOT EXISTS public.crypto_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Currency identification
  from_currency VARCHAR(20) NOT NULL,
  to_currency VARCHAR(20) NOT NULL,
  
  -- Rate information
  rate NUMERIC(36, 18) NOT NULL,
  source VARCHAR(50) NOT NULL,
  
  -- Metadata
  api_response_time_ms INT,
  confidence_score DECIMAL(3, 2) DEFAULT 1.00,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
  
  -- Uniqueness constraint
  UNIQUE (from_currency, to_currency)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_crypto_rates_from_to 
ON public.crypto_rates(from_currency, to_currency);

CREATE INDEX IF NOT EXISTS idx_crypto_rates_updated_at 
ON public.crypto_rates(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_crypto_rates_expires_at 
ON public.crypto_rates(expires_at DESC);

-- Create trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_crypto_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_crypto_rates_updated_at ON public.crypto_rates;

CREATE TRIGGER trigger_crypto_rates_updated_at
BEFORE UPDATE ON public.crypto_rates
FOR EACH ROW
EXECUTE FUNCTION update_crypto_rates_updated_at();

-- Enable RLS and create policies
ALTER TABLE public.crypto_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of crypto_rates" ON public.crypto_rates
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access to crypto_rates" ON public.crypto_rates
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Create view for valid (non-expired) rates
CREATE OR REPLACE VIEW crypto_rates_valid AS
SELECT *
FROM public.crypto_rates
WHERE expires_at > NOW()
ORDER BY updated_at DESC;

-- Create view for latest rates per currency pair
CREATE OR REPLACE VIEW crypto_rates_latest AS
SELECT DISTINCT ON (from_currency, to_currency)
  from_currency,
  to_currency,
  rate,
  source,
  updated_at,
  expires_at
FROM public.crypto_rates
WHERE expires_at > NOW()
ORDER BY from_currency, to_currency, updated_at DESC;

-- Cleanup function for expired rates
CREATE OR REPLACE FUNCTION cleanup_expired_crypto_rates()
RETURNS TABLE(deleted_count INT) AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM public.crypto_rates
  WHERE expires_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN QUERY SELECT v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;
