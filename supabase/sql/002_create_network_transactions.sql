-- Create network_transactions table to store on-chain transactions for network/house wallets
CREATE TABLE IF NOT EXISTS network_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_house_id UUID REFERENCES wallets_house(id) ON DELETE CASCADE,
  chain_id BIGINT,
  tx_hash TEXT,
  from_address TEXT,
  to_address TEXT,
  value NUMERIC(36, 18),
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_tx_wallet ON network_transactions(wallet_house_id);
CREATE INDEX IF NOT EXISTS idx_network_tx_chain ON network_transactions(chain_id);
CREATE INDEX IF NOT EXISTS idx_network_tx_hash ON network_transactions(tx_hash);
