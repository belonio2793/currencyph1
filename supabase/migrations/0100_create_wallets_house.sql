-- Create wallets_house table for storing house-owned crypto deposit addresses
-- This table stores cryptocurrency addresses where users can deposit funds

CREATE TABLE IF NOT EXISTS wallets_house (
  id BIGSERIAL PRIMARY KEY,
  wallet_type VARCHAR(50) NOT NULL DEFAULT 'crypto', -- 'crypto', 'fiat', etc.
  currency VARCHAR(20) NOT NULL, -- 'BTC', 'ETH', 'SOL', etc.
  network VARCHAR(100) NOT NULL, -- 'Bitcoin', 'Ethereum', 'Solana', etc.
  address VARCHAR(255) NOT NULL, -- The deposit address
  provider VARCHAR(50) NOT NULL DEFAULT 'internal', -- 'internal', 'coins.ph', 'thirdweb', etc.
  balance DECIMAL(30, 18) DEFAULT 0, -- Balance in the address
  metadata JSONB DEFAULT '{}', -- Extra data like memo, tag, etc.
  private_key TEXT, -- Optional: encrypted private key (should be encrypted in production)
  thirdweb_wallet_id VARCHAR(255), -- Optional: Thirdweb wallet reference
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique combination of currency, network, and address
  UNIQUE(currency, network, address)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wallets_house_currency ON wallets_house(currency);
CREATE INDEX IF NOT EXISTS idx_wallets_house_network ON wallets_house(network);
CREATE INDEX IF NOT EXISTS idx_wallets_house_provider ON wallets_house(provider);
CREATE INDEX IF NOT EXISTS idx_wallets_house_wallet_type ON wallets_house(wallet_type);
CREATE INDEX IF NOT EXISTS idx_wallets_house_currency_network ON wallets_house(currency, network);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wallets_house_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_wallets_house_updated_at ON wallets_house;

CREATE TRIGGER trigger_wallets_house_updated_at
BEFORE UPDATE ON wallets_house
FOR EACH ROW
EXECUTE FUNCTION update_wallets_house_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE wallets_house ENABLE ROW LEVEL SECURITY;

-- Create policy allowing public read (addresses are public but funds are protected)
CREATE POLICY "Allow public read of wallets_house" ON wallets_house
  FOR SELECT
  USING (true);

-- Create policy allowing service role full access (for admin operations)
CREATE POLICY "Allow service role full access to wallets_house" ON wallets_house
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
