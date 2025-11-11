-- Create unified pairs table combining fiat and crypto rates
CREATE TABLE IF NOT EXISTS pairs (
  id BIGSERIAL PRIMARY KEY,
  from_currency VARCHAR(10) NOT NULL,
  to_currency VARCHAR(10) NOT NULL,
  rate NUMERIC NOT NULL,
  source_table VARCHAR(50) NOT NULL DEFAULT 'currency_rates',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_currency, to_currency)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_pairs_lookup ON pairs(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_pairs_from ON pairs(from_currency);
CREATE INDEX IF NOT EXISTS idx_pairs_to ON pairs(to_currency);

-- Function to sync pairs from currency_rates
CREATE OR REPLACE FUNCTION sync_currency_rates_to_pairs()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM pairs WHERE from_currency = OLD.from_currency AND to_currency = OLD.to_currency AND source_table = 'currency_rates';
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO pairs (from_currency, to_currency, rate, source_table, updated_at)
    VALUES (NEW.from_currency, NEW.to_currency, NEW.rate, 'currency_rates', NOW())
    ON CONFLICT (from_currency, to_currency) DO UPDATE
    SET rate = EXCLUDED.rate, source_table = EXCLUDED.source_table, updated_at = NOW();
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to sync pairs from cryptocurrency_rates
CREATE OR REPLACE FUNCTION sync_cryptocurrency_rates_to_pairs()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM pairs WHERE from_currency = OLD.from_currency AND to_currency = OLD.to_currency AND source_table = 'cryptocurrency_rates';
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO pairs (from_currency, to_currency, rate, source_table, updated_at)
    VALUES (NEW.from_currency, NEW.to_currency, NEW.rate, 'cryptocurrency_rates', NOW())
    ON CONFLICT (from_currency, to_currency) DO UPDATE
    SET rate = EXCLUDED.rate, source_table = EXCLUDED.source_table, updated_at = NOW();
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS currency_rates_sync ON currency_rates;
DROP TRIGGER IF EXISTS cryptocurrency_rates_sync ON cryptocurrency_rates;

-- Create triggers to auto-sync currency_rates
CREATE TRIGGER currency_rates_sync
AFTER INSERT OR UPDATE OR DELETE ON currency_rates
FOR EACH ROW
EXECUTE FUNCTION sync_currency_rates_to_pairs();

-- Create triggers to auto-sync cryptocurrency_rates
CREATE TRIGGER cryptocurrency_rates_sync
AFTER INSERT OR UPDATE OR DELETE ON cryptocurrency_rates
FOR EACH ROW
EXECUTE FUNCTION sync_cryptocurrency_rates_to_pairs();

-- Initial population from currency_rates
INSERT INTO pairs (from_currency, to_currency, rate, source_table, updated_at)
SELECT from_currency, to_currency, rate, 'currency_rates', NOW() FROM currency_rates
ON CONFLICT (from_currency, to_currency) DO UPDATE
SET rate = EXCLUDED.rate, source_table = EXCLUDED.source_table, updated_at = NOW();

-- Initial population from cryptocurrency_rates
INSERT INTO pairs (from_currency, to_currency, rate, source_table, updated_at)
SELECT from_currency, to_currency, rate, 'cryptocurrency_rates', NOW() FROM cryptocurrency_rates
ON CONFLICT (from_currency, to_currency) DO UPDATE
SET rate = EXCLUDED.rate, source_table = EXCLUDED.source_table, updated_at = NOW();
