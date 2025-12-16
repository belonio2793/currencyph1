-- ============================================================================
-- CREATE DEPOSITS TABLE - Track deposit methods and transactions
-- ============================================================================

CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount NUMERIC(36, 8) NOT NULL CHECK (amount > 0),
  currency_code VARCHAR(16) NOT NULL REFERENCES currencies(code),
  deposit_method TEXT NOT NULL CHECK (deposit_method IN ('solana', 'gcash', 'fiat_transfer', 'crypto_transfer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  
  -- Payment details
  payment_address TEXT,
  phone_number TEXT,
  payment_reference TEXT,
  qr_code_data TEXT,
  
  -- Transaction tracking
  transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  external_tx_id TEXT,
  
  -- Metadata
  description TEXT,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Indexes
  UNIQUE (external_tx_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_wallet ON deposits(wallet_id);
CREATE INDEX IF NOT EXISTS idx_deposits_method ON deposits(deposit_method);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_created ON deposits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_user_status ON deposits(user_id, status);

-- Create a view for deposit summary
CREATE OR REPLACE VIEW deposits_summary AS
SELECT 
  d.id,
  d.user_id,
  u.email,
  d.wallet_id,
  d.amount,
  d.currency_code,
  d.deposit_method,
  d.status,
  d.phone_number,
  d.payment_address,
  d.payment_reference,
  d.created_at,
  d.completed_at,
  w.balance AS current_wallet_balance
FROM deposits d
JOIN users u ON u.id = d.user_id
LEFT JOIN wallets w ON w.id = d.wallet_id;

-- Enable Row Level Security
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
-- Users can view their own deposits
CREATE POLICY "Users can view own deposits" ON deposits
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own deposits
CREATE POLICY "Users can insert own deposits" ON deposits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own deposits (only certain fields)
CREATE POLICY "Users can update own deposits" ON deposits
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    status IN ('pending', 'processing') -- Can only modify pending/processing deposits
  );

-- ============================================================================
-- END DEPOSITS TABLE MIGRATION
-- ============================================================================
