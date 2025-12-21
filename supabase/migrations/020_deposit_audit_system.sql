-- Deposit Status History Table
-- Tracks all status changes with full audit trail
CREATE TABLE IF NOT EXISTS deposit_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL, -- Admin or system user who made the change
  reason TEXT,
  notes JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deposit Audit Log Table
-- Complete audit trail of deposit operations (approvals, rejections, reversals)
CREATE TABLE IF NOT EXISTS deposit_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  wallet_id UUID,
  action TEXT NOT NULL, -- 'approve', 'reject', 'reverse', 'manual_adjust', 'sync_fix'
  old_state JSONB, -- Previous deposit state (amount, status, balance_before)
  new_state JSONB, -- New deposit state (amount, status, balance_after)
  wallet_impact JSONB, -- { balance_before, balance_after, amount_changed }
  admin_id UUID, -- The admin who performed the action
  admin_email TEXT,
  idempotency_key TEXT UNIQUE, -- Prevent duplicate operations
  status TEXT DEFAULT 'success', -- 'success', 'failed', 'partial_success', 'rolled_back'
  error_message TEXT,
  network_sync_version INT DEFAULT 0, -- Version for network sync tracking
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Deposit Reversal Registry
-- Tracks all reversals and their relationships
CREATE TABLE IF NOT EXISTS deposit_reversal_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  reversal_deposit_id UUID REFERENCES deposits(id) ON DELETE SET NULL,
  reason TEXT NOT NULL, -- 'manual_revert', 'admin_correction', 'network_sync_fix'
  reversed_by UUID NOT NULL, -- Admin user
  original_balance NUMERIC,
  reversal_balance NUMERIC,
  status TEXT DEFAULT 'active', -- 'active', 'superseded', 'cancelled'
  is_idempotent BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Deposit State Lock Table
-- Prevents concurrent modifications (optimistic locking)
CREATE TABLE IF NOT EXISTS deposit_state_lock (
  deposit_id UUID PRIMARY KEY REFERENCES deposits(id) ON DELETE CASCADE,
  version INT DEFAULT 1,
  locked_by UUID, -- Admin user who has the lock
  locked_at TIMESTAMP,
  lock_expires_at TIMESTAMP,
  is_locked BOOLEAN DEFAULT FALSE,
  last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallet Balance Reconciliation Log
-- Tracks balance changes for reconciliation
CREATE TABLE IF NOT EXISTS wallet_balance_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  balance_before NUMERIC,
  balance_after NUMERIC,
  transaction_count INT,
  discrepancy NUMERIC,
  reason TEXT,
  reconciliation_type TEXT, -- 'deposit_approval', 'deposit_reversal', 'auto_sync'
  admin_id UUID,
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_deposit_status_history_deposit_id ON deposit_status_history(deposit_id);
CREATE INDEX IF NOT EXISTS idx_deposit_status_history_created_at ON deposit_status_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_audit_log_deposit_id ON deposit_audit_log(deposit_id);
CREATE INDEX IF NOT EXISTS idx_deposit_audit_log_admin_id ON deposit_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_deposit_audit_log_idempotency ON deposit_audit_log(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_deposit_audit_log_created_at ON deposit_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_reversal_registry_original ON deposit_reversal_registry(original_deposit_id);
CREATE INDEX IF NOT EXISTS idx_deposit_state_lock_locked_by ON deposit_state_lock(locked_by);
CREATE INDEX IF NOT EXISTS idx_wallet_reconciliation_wallet ON wallet_balance_reconciliation(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_reconciliation_created_at ON wallet_balance_reconciliation(created_at DESC);

-- Enable RLS on audit tables
ALTER TABLE deposit_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_reversal_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_state_lock ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_balance_reconciliation ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admins and users can view their audit logs
CREATE POLICY deposit_status_history_select ON deposit_status_history
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY deposit_audit_log_select ON deposit_audit_log
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() = admin_id OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY deposit_reversal_registry_select ON deposit_reversal_registry
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Add new columns to deposits table if they don't exist (check before altering)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deposits' AND column_name = 'version'
  ) THEN
    ALTER TABLE deposits ADD COLUMN version INT DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deposits' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE deposits ADD COLUMN idempotency_key TEXT UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deposits' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE deposits ADD COLUMN approved_by UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deposits' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE deposits ADD COLUMN approved_at TIMESTAMP;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deposits' AND column_name = 'reversal_reason'
  ) THEN
    ALTER TABLE deposits ADD COLUMN reversal_reason TEXT;
  END IF;
END $$;
