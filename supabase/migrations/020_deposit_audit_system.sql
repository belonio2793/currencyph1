-- Deposit Status History Table
-- Tracks all status changes with full audit trail
CREATE TABLE IF NOT EXISTS deposit_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL,
  user_id UUID NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  reason TEXT,
  notes JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deposit Audit Log Table
-- Complete audit trail of deposit operations
CREATE TABLE IF NOT EXISTS deposit_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL,
  user_id UUID NOT NULL,
  wallet_id UUID,
  action TEXT NOT NULL,
  old_state JSONB,
  new_state JSONB,
  wallet_impact JSONB,
  admin_id UUID,
  admin_email TEXT,
  idempotency_key TEXT UNIQUE,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  network_sync_version INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Deposit Reversal Registry
CREATE TABLE IF NOT EXISTS deposit_reversal_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_deposit_id UUID NOT NULL,
  reversal_deposit_id UUID,
  reason TEXT NOT NULL,
  reversed_by UUID NOT NULL,
  original_balance NUMERIC,
  reversal_balance NUMERIC,
  status TEXT DEFAULT 'active',
  is_idempotent BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Deposit State Lock Table
CREATE TABLE IF NOT EXISTS deposit_state_lock (
  deposit_id UUID PRIMARY KEY,
  version INT DEFAULT 1,
  locked_by UUID,
  locked_at TIMESTAMP,
  lock_expires_at TIMESTAMP,
  is_locked BOOLEAN DEFAULT FALSE,
  last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallet Balance Reconciliation Log
CREATE TABLE IF NOT EXISTS wallet_balance_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL,
  user_id UUID NOT NULL,
  balance_before NUMERIC,
  balance_after NUMERIC,
  transaction_count INT,
  discrepancy NUMERIC,
  reason TEXT,
  reconciliation_type TEXT,
  admin_id UUID,
  status TEXT DEFAULT 'completed',
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

-- RLS Policies - Admins can view all, users can view their own
CREATE POLICY deposit_status_history_select ON deposit_status_history
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY deposit_audit_log_select ON deposit_audit_log
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() = admin_id OR
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY deposit_reversal_registry_select ON deposit_reversal_registry
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY deposit_state_lock_select ON deposit_state_lock
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY wallet_reconciliation_select ON wallet_balance_reconciliation
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.jwt() ->> 'role' = 'admin'
  );

-- Add new columns to deposits table
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS reversal_reason TEXT;
