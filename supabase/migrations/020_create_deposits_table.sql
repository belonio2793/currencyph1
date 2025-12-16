-- ============================================================================
-- DEPOSITS TABLE - FULL, SAFE, PRODUCTION MIGRATION (FIXED)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Create DEPOSITS table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,

  -- Amount & Currency
  amount NUMERIC(36, 8) NOT NULL CHECK (amount > 0),
  currency_code VARCHAR(16) NOT NULL REFERENCES currencies(code),

  -- Method & Status
  deposit_method TEXT NOT NULL
    CHECK (deposit_method IN ('solana', 'gcash', 'fiat_transfer', 'crypto_transfer')),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  -- Payment details
  payment_address TEXT,
  phone_number TEXT,
  payment_reference TEXT,
  qr_code_data TEXT,

  -- Transaction tracking
  transaction_id UUID,
  external_tx_id TEXT,

  -- Metadata
  description TEXT,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  UNIQUE (external_tx_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_wallet ON deposits(wallet_id);
CREATE INDEX IF NOT EXISTS idx_deposits_method ON deposits(deposit_method);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_created ON deposits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_user_status ON deposits(user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deposits_ext_tx_currency
  ON deposits (external_tx_id, currency_code)
  WHERE external_tx_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Conditionally add FK to wallet_transactions (SAFE)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- Check wallet_transactions exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'wallet_transactions'
      AND table_schema = 'public'
  ) THEN
    -- Check constraint does not already exist
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'deposits_transaction_fk'
    ) THEN
      ALTER TABLE deposits
        ADD CONSTRAINT deposits_transaction_fk
        FOREIGN KEY (transaction_id)
        REFERENCES wallet_transactions(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Enforce immutability & protect completed deposits
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_deposit_immutability()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Completed deposits cannot be modified';
  END IF;

  IF NEW.amount <> OLD.amount
     OR NEW.currency_code <> OLD.currency_code
     OR NEW.deposit_method <> OLD.deposit_method
     OR NEW.user_id <> OLD.user_id
     OR NEW.wallet_id <> OLD.wallet_id THEN
    RAISE EXCEPTION 'Immutable deposit fields cannot be modified';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_deposit_immutability ON deposits;

CREATE TRIGGER trg_enforce_deposit_immutability
BEFORE UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION enforce_deposit_immutability();

-- ---------------------------------------------------------------------------
-- Auto-update updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_deposits_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_deposits_updated_at ON deposits;

CREATE TRIGGER trg_set_deposits_updated_at
BEFORE UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION set_deposits_updated_at();

-- ---------------------------------------------------------------------------
-- Deposit summary view
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own deposits" ON deposits;
CREATE POLICY "Users can view own deposits"
ON deposits
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own deposits" ON deposits;
CREATE POLICY "Users can insert own deposits"
ON deposits
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own deposits" ON deposits;
CREATE POLICY "Users can update own deposits"
ON deposits
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('pending', 'processing')
);

-- ============================================================================
-- END DEPOSITS TABLE MIGRATION
-- ============================================================================
