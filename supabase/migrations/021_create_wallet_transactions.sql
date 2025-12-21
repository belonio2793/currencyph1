-- Create wallet_transactions table to track all wallet balance changes
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'transfer', 'deposit_reversal', etc.
  amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  description TEXT,
  reference_id UUID, -- Links to deposits, withdrawals, or other transactions
  metadata JSONB, -- Extra data like conversion_rate, original_currency, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference_id ON wallet_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);

-- Enable RLS
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own wallet transactions
CREATE POLICY wallet_transactions_select ON wallet_transactions
  FOR SELECT USING (
    wallet_id IN (
      SELECT id FROM wallets WHERE user_id = auth.uid()
    ) OR
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Only service role can insert/update/delete
CREATE POLICY wallet_transactions_insert ON wallet_transactions
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY wallet_transactions_update ON wallet_transactions
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY wallet_transactions_delete ON wallet_transactions
  FOR DELETE USING (auth.jwt() ->> 'role' = 'service_role');
