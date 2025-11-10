-- Creates cryptocurrencies metadata table and cryptocurrency_rates table
-- Run in Supabase SQL editor or as part of migration

CREATE TABLE IF NOT EXISTS cryptocurrencies (
  code VARCHAR(10) PRIMARY KEY,
  name TEXT NOT NULL,
  coingecko_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cryptocurrency_rates (
  id BIGSERIAL PRIMARY KEY,
  from_currency VARCHAR(10) NOT NULL,
  to_currency VARCHAR(10) NOT NULL,
  rate NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (from_currency, to_currency)
);

-- Optional: Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_crypto_rates_from_to ON cryptocurrency_rates(from_currency, to_currency);
