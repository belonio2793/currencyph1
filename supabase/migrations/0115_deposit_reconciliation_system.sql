-- ============================================================================
-- DEPOSIT RECONCILIATION AND AUDIT SYSTEM
-- ============================================================================
-- Adds comprehensive audit trail for deposits with state transition tracking
-- and wallet balance reconciliation capabilities
-- ============================================================================

-- 1️⃣ DEPOSIT STATE TRANSITIONS TABLE - Track all status changes with full context
CREATE TABLE IF NOT EXISTS deposit_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE SET NULL,
  
  -- State change information
  previous_state TEXT NOT NULL,
  new_state TEXT NOT NULL CHECK (new_state IN ('pending', 'approved', 'completed', 'rejected', 'reversed', 'cancelled')),
  
  -- Reason and audit trail
  reason TEXT,
  notes JSONB DEFAULT NULL,
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_email TEXT,
  
  -- Idempotency and versioning
  idempotency_key VARCHAR(255) UNIQUE,
  version_number INTEGER DEFAULT 1,
  
  -- Transaction details
  amount_usd NUMERIC(36, 8),
  exchange_rate NUMERIC(36, 8),
  
  -- Wallet impact
  balance_before NUMERIC(36, 8),
  balance_after NUMERIC(36, 8),
  balance_adjustment NUMERIC(36, 8),
  
  -- Metadata
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_state_deposit ON deposit_state_transitions(deposit_id);
CREATE INDEX IF NOT EXISTS idx_deposit_state_user ON deposit_state_transitions(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_state_new_state ON deposit_state_transitions(new_state);
CREATE INDEX IF NOT EXISTS idx_deposit_state_created ON deposit_state_transitions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_state_idempotent ON deposit_state_transitions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_deposit_state_wallet ON deposit_state_transitions(wallet_id);

-- 2️⃣ DEPOSIT TRANSACTION MAPPING - Link deposits to wallet transactions for reconciliation
CREATE TABLE IF NOT EXISTS deposit_transaction_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  wallet_transaction_id UUID NOT NULL REFERENCES wallet_transactions(id) ON DELETE CASCADE,
  
  -- Transaction context
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('creation', 'approval', 'reversal', 'rejection', 'completion')),
  transaction_state TEXT NOT NULL,
  
  -- Financial details
  amount NUMERIC(36, 8) NOT NULL,
  currency_code VARCHAR(16) NOT NULL REFERENCES currencies(code),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deposit_id, wallet_transaction_id, transaction_type)
);

CREATE INDEX IF NOT EXISTS idx_deposit_tx_map_deposit ON deposit_transaction_mapping(deposit_id);
CREATE INDEX IF NOT EXISTS idx_deposit_tx_map_wallet_tx ON deposit_transaction_mapping(wallet_transaction_id);
CREATE INDEX IF NOT EXISTS idx_deposit_tx_map_type ON deposit_transaction_mapping(transaction_type);

-- 3️⃣ WALLET BALANCE AUDIT TABLE - Track all balance reconciliations and corrections
CREATE TABLE IF NOT EXISTS wallet_balance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Audit information
  audit_type TEXT NOT NULL CHECK (audit_type IN ('manual', 'automatic', 'emergency', 'scheduled')),
  audit_reason TEXT,
  
  -- Balance details
  balance_before NUMERIC(36, 8) NOT NULL,
  balance_after NUMERIC(36, 8) NOT NULL,
  discrepancy NUMERIC(36, 8) GENERATED ALWAYS AS (balance_after - balance_before) STORED,
  discrepancy_percentage NUMERIC(10, 4),
  
  -- Calculation method
  expected_balance NUMERIC(36, 8),
  calculation_method TEXT,
  
  -- Resolution
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')),
  resolution_notes JSONB,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balance_audit_wallet ON wallet_balance_audit(wallet_id);
CREATE INDEX IF NOT EXISTS idx_balance_audit_user ON wallet_balance_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_audit_type ON wallet_balance_audit(audit_type);
CREATE INDEX IF NOT EXISTS idx_balance_audit_status ON wallet_balance_audit(status);
CREATE INDEX IF NOT EXISTS idx_balance_audit_created ON wallet_balance_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_balance_audit_discrepancy ON wallet_balance_audit(discrepancy) WHERE discrepancy != 0;

-- 4️⃣ DEPOSIT AUDIT LOG TABLE - Comprehensive audit trail for all deposit operations
CREATE TABLE IF NOT EXISTS deposit_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Operation details
  operation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  
  -- Before and after states
  previous_state JSONB,
  new_state JSONB,
  
  -- Impact
  wallet_impact JSONB,
  balance_changes JSONB,
  
  -- Audit trail
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_email TEXT,
  initiated_by TEXT,
  
  -- Error handling
  error_message TEXT,
  error_details JSONB,
  
  -- Metadata
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_deposit ON deposit_audit_log(deposit_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON deposit_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON deposit_audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_status ON deposit_audit_log(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON deposit_audit_log(created_at DESC);

-- 5️⃣ FUNCTION - Validate deposit state transition
CREATE OR REPLACE FUNCTION validate_deposit_state_transition(
  p_current_state TEXT,
  p_desired_state TEXT
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_valid BOOLEAN;
  v_allowed_transitions JSON;
BEGIN
  -- Define valid state transitions
  v_allowed_transitions := jsonb_build_object(
    'pending', '["approved", "rejected", "cancelled"]'::jsonb,
    'approved', '["completed", "reversed", "rejected"]'::jsonb,
    'completed', '["reversed"]'::jsonb,
    'rejected', '["pending"]'::jsonb,
    'reversed', '["approved", "pending"]'::jsonb,
    'cancelled', '["pending"]'::jsonb
  );
  
  -- Check if transition is allowed
  v_valid := (v_allowed_transitions -> p_current_state ->> '0' IS NOT NULL);
  
  v_result := jsonb_build_object(
    'valid', v_valid,
    'current_state', p_current_state,
    'desired_state', p_desired_state,
    'message', CASE 
      WHEN v_valid THEN 'Valid state transition'
      ELSE 'Invalid state transition from ' || p_current_state || ' to ' || p_desired_state
    END
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 6️⃣ FUNCTION - Record deposit state transition with audit trail
CREATE OR REPLACE FUNCTION record_deposit_state_transition(
  p_deposit_id UUID,
  p_user_id UUID,
  p_wallet_id UUID,
  p_new_state TEXT,
  p_admin_id UUID DEFAULT NULL,
  p_admin_email TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_notes JSONB DEFAULT NULL,
  p_idempotency_key VARCHAR DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_deposit RECORD;
  v_wallet RECORD;
  v_previous_state TEXT;
  v_transition_id UUID;
  v_balance_adjustment NUMERIC;
  v_result JSONB;
BEGIN
  -- Fetch current deposit state
  SELECT * INTO v_deposit FROM deposits WHERE id = p_deposit_id;
  IF v_deposit IS NULL THEN
    RAISE EXCEPTION 'Deposit not found: %', p_deposit_id;
  END IF;
  
  v_previous_state := v_deposit.status;
  
  -- Validate state transition
  IF NOT (validate_deposit_state_transition(v_previous_state, p_new_state)->>'valid')::BOOLEAN THEN
    RAISE EXCEPTION 'Invalid state transition from % to %', v_previous_state, p_new_state;
  END IF;
  
  -- Fetch wallet information
  SELECT * INTO v_wallet FROM wallets WHERE id = p_wallet_id;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;
  
  -- Calculate balance adjustment based on state transition
  v_balance_adjustment := 0;
  CASE
    WHEN p_new_state = 'approved' AND v_previous_state = 'pending' THEN
      v_balance_adjustment := COALESCE(v_deposit.received_amount, v_deposit.amount);
    WHEN p_new_state = 'reversed' AND v_previous_state = 'completed' THEN
      v_balance_adjustment := -COALESCE(v_deposit.received_amount, v_deposit.amount);
    WHEN p_new_state = 'rejected' THEN
      v_balance_adjustment := 0;
    WHEN p_new_state = 'cancelled' THEN
      v_balance_adjustment := 0;
    ELSE
      v_balance_adjustment := 0;
  END CASE;
  
  -- Create state transition record
  INSERT INTO deposit_state_transitions (
    deposit_id,
    user_id,
    wallet_id,
    previous_state,
    new_state,
    reason,
    notes,
    admin_id,
    admin_email,
    idempotency_key,
    amount_usd,
    exchange_rate,
    balance_before,
    balance_after,
    balance_adjustment
  ) VALUES (
    p_deposit_id,
    p_user_id,
    p_wallet_id,
    v_previous_state,
    p_new_state,
    p_reason,
    p_notes,
    p_admin_id,
    p_admin_email,
    p_idempotency_key,
    v_deposit.amount,
    v_deposit.exchange_rate,
    v_wallet.balance,
    v_wallet.balance + v_balance_adjustment,
    v_balance_adjustment
  ) RETURNING id INTO v_transition_id;
  
  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'transition_id', v_transition_id,
    'deposit_id', p_deposit_id,
    'previous_state', v_previous_state,
    'new_state', p_new_state,
    'balance_adjustment', v_balance_adjustment,
    'wallet_balance_before', v_wallet.balance,
    'wallet_balance_after', v_wallet.balance + v_balance_adjustment
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 7️⃣ FUNCTION - Reconcile wallet balance against expected balance
CREATE OR REPLACE FUNCTION reconcile_wallet_balance(
  p_wallet_id UUID,
  p_user_id UUID,
  p_admin_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_wallet RECORD;
  v_expected_balance NUMERIC;
  v_discrepancy NUMERIC;
  v_audit_record RECORD;
  v_calculation_method TEXT;
  v_result JSONB;
BEGIN
  -- Fetch wallet
  SELECT * INTO v_wallet FROM wallets WHERE id = p_wallet_id;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;
  
  -- Calculate expected balance from approved deposits minus reversals
  SELECT SUM(CASE 
    WHEN status IN ('approved', 'completed') THEN amount
    WHEN status = 'reversed' THEN -amount
    ELSE 0
  END) INTO v_expected_balance
  FROM deposits
  WHERE wallet_id = p_wallet_id;
  
  v_expected_balance := COALESCE(v_expected_balance, 0);
  v_discrepancy := v_wallet.balance - v_expected_balance;
  v_calculation_method := 'sum_of_approved_deposits_minus_reversals';
  
  -- Create audit record
  INSERT INTO wallet_balance_audit (
    wallet_id,
    user_id,
    audit_type,
    audit_reason,
    balance_before,
    balance_after,
    discrepancy_percentage,
    expected_balance,
    calculation_method,
    status,
    approved_by,
    metadata
  ) VALUES (
    p_wallet_id,
    p_user_id,
    'automatic',
    'Scheduled reconciliation',
    v_wallet.balance,
    v_wallet.balance,
    CASE WHEN v_expected_balance > 0 THEN (v_discrepancy / v_expected_balance * 100) ELSE 0 END,
    v_expected_balance,
    v_calculation_method,
    CASE WHEN v_discrepancy = 0 THEN 'resolved' ELSE 'pending' END,
    p_admin_id,
    jsonb_build_object(
      'discrepancy', v_discrepancy,
      'expected_balance', v_expected_balance,
      'wallet_balance', v_wallet.balance
    )
  ) RETURNING * INTO v_audit_record;
  
  -- Build result
  v_result := jsonb_build_object(
    'wallet_id', p_wallet_id,
    'is_balanced', v_discrepancy = 0,
    'actual_balance', v_wallet.balance,
    'expected_balance', v_expected_balance,
    'discrepancy', v_discrepancy,
    'discrepancy_percentage', CASE WHEN v_expected_balance > 0 THEN (v_discrepancy / v_expected_balance * 100) ELSE 0 END,
    'audit_id', v_audit_record.id,
    'audit_status', v_audit_record.status,
    'timestamp', v_audit_record.created_at
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 8️⃣ TRIGGER - Automatically record wallet transactions for deposit state changes
CREATE OR REPLACE FUNCTION trigger_record_deposit_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_transaction_type TEXT;
  v_amount NUMERIC;
  v_description TEXT;
  v_wallet_id UUID;
  v_user_id UUID;
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
BEGIN
  -- Only record if status has changed
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  
  -- Get wallet info
  SELECT id INTO v_wallet_id FROM wallets WHERE id = NEW.wallet_id;
  v_user_id := NEW.user_id;
  
  -- Determine transaction type based on status change
  CASE
    WHEN NEW.status = 'approved' AND OLD.status = 'pending' THEN
      v_transaction_type := 'deposit';
      v_amount := COALESCE(NEW.received_amount, NEW.amount);
      v_description := 'Deposit approved: ' || v_amount || ' ' || NEW.currency_code;
    WHEN NEW.status = 'reversed' THEN
      v_transaction_type := 'deposit_reversal';
      v_amount := COALESCE(NEW.received_amount, NEW.amount);
      v_description := 'Deposit reversed: ' || v_amount || ' ' || NEW.currency_code;
    WHEN NEW.status = 'rejected' THEN
      RETURN NEW;
    ELSE
      RETURN NEW;
  END CASE;
  
  -- Get current wallet balance
  SELECT balance INTO v_balance_before FROM wallets WHERE id = v_wallet_id FOR UPDATE;
  
  -- Calculate balance after
  IF v_transaction_type = 'deposit' THEN
    v_balance_after := v_balance_before + v_amount;
  ELSIF v_transaction_type = 'deposit_reversal' THEN
    v_balance_after := v_balance_before - v_amount;
  END IF;
  
  -- Record wallet transaction
  INSERT INTO wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    balance_before,
    balance_after,
    currency_code,
    description,
    reference_id
  ) VALUES (
    v_wallet_id,
    v_user_id,
    v_transaction_type,
    v_amount,
    v_balance_before,
    v_balance_after,
    NEW.currency_code,
    v_description,
    NEW.id
  );
  
  -- Update wallet balance
  UPDATE wallets
  SET balance = v_balance_after,
      updated_at = NOW()
  WHERE id = v_wallet_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for deposits table
DROP TRIGGER IF EXISTS trigger_deposit_transaction_on_status_change ON deposits;
CREATE TRIGGER trigger_deposit_transaction_on_status_change
AFTER UPDATE ON deposits
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION trigger_record_deposit_transaction();

-- 9️⃣ ENABLE ROW LEVEL SECURITY
ALTER TABLE deposit_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_transaction_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_balance_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
-- Users can view their own deposit state transitions
CREATE POLICY "Users can view own deposit transitions" ON deposit_state_transitions
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

-- Users can view their own wallet balance audits
CREATE POLICY "Users can view own balance audits" ON wallet_balance_audit
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

-- Users can view their own deposit audit logs
CREATE POLICY "Users can view own deposit audits" ON deposit_audit_log
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

-- Service role can insert/update all
CREATE POLICY "Service role manages deposit transitions" ON deposit_state_transitions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role manages balance audits" ON wallet_balance_audit
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role manages audit logs" ON deposit_audit_log
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 🔟 VIEW - Deposit reconciliation summary
CREATE OR REPLACE VIEW deposit_reconciliation_summary AS
SELECT 
  d.id AS deposit_id,
  d.user_id,
  u.email AS user_email,
  d.wallet_id,
  d.amount,
  d.received_amount,
  d.currency_code,
  d.status,
  (SELECT new_state FROM deposit_state_transitions WHERE deposit_id = d.id ORDER BY created_at DESC LIMIT 1) AS current_state,
  (SELECT COUNT(*) FROM deposit_state_transitions WHERE deposit_id = d.id) AS state_transition_count,
  (SELECT COUNT(*) FROM wallet_transactions WHERE reference_id = d.id) AS transaction_record_count,
  d.created_at,
  d.updated_at
FROM deposits d
LEFT JOIN users u ON d.user_id = u.id
ORDER BY d.created_at DESC;

-- 1️⃣1️⃣ VIEW - Wallet balance audit summary
CREATE OR REPLACE VIEW wallet_audit_summary AS
SELECT 
  wa.wallet_id,
  w.user_id,
  u.email,
  w.currency_code,
  w.balance,
  wa.expected_balance,
  wa.discrepancy,
  wa.discrepancy_percentage,
  wa.audit_type,
  wa.status,
  wa.created_at
FROM wallet_balance_audit wa
LEFT JOIN wallets w ON wa.wallet_id = w.id
LEFT JOIN users u ON wa.user_id = u.id
ORDER BY wa.created_at DESC;

-- ============================================================================
-- END DEPOSIT RECONCILIATION AND AUDIT SYSTEM
-- ============================================================================
