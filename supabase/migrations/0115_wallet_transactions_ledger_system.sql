-- ============================================================================
-- WALLET TRANSACTIONS LEDGER SYSTEM
-- ============================================================================
-- Single source of truth: wallet_transactions table
-- Every deposit action creates a new row with type and note fields
-- Wallet balance is calculated from sum of all wallet_transactions
-- ============================================================================

-- 1️⃣ ENHANCE WALLET_TRANSACTIONS TABLE if not already complete
-- (Add columns if they don't exist)

ALTER TABLE IF EXISTS wallet_transactions 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'deposit' CHECK (type IN (
    'deposit_pending', 'deposit_approved', 'deposit_rejected', 
    'deposit_reversed', 'withdrawal', 'transfer_in', 'transfer_out',
    'payment', 'fee', 'refund', 'adjustment'
  )),
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'completed', 'reversed', 'rejected'
  )),
  ADD COLUMN IF NOT EXISTS reference_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- 2️⃣ CREATE INDEXES for fast queries
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_note ON wallet_transactions(note);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_reference_id ON wallet_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_created ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_created ON wallet_transactions(wallet_id, created_at DESC);

-- 3️⃣ FUNCTION - Record wallet transaction and update balance atomically
CREATE OR REPLACE FUNCTION record_ledger_transaction(
  p_wallet_id UUID,
  p_user_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_note TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Get current wallet balance
  SELECT balance INTO v_balance_before 
  FROM wallets 
  WHERE id = p_wallet_id 
  FOR UPDATE;
  
  IF v_balance_before IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Calculate new balance based on transaction type
  CASE p_type
    WHEN 'deposit_pending', 'deposit_approved', 'transfer_in', 'refund' THEN
      v_balance_after := v_balance_before + p_amount;
    WHEN 'deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee' THEN
      v_balance_after := v_balance_before - p_amount;
    WHEN 'adjustment' THEN
      v_balance_after := v_balance_before + p_amount;
    ELSE
      RAISE EXCEPTION 'Invalid transaction type: %', p_type;
  END CASE;

  -- Prevent negative balance (except adjustments)
  IF v_balance_after < 0 AND p_type NOT IN ('adjustment') THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Attempted: %', v_balance_before, p_amount;
  END IF;

  -- Update wallet balance
  UPDATE wallets
  SET 
    balance = v_balance_after,
    updated_at = NOW()
  WHERE id = p_wallet_id;

  -- Record transaction
  INSERT INTO wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    balance_before,
    balance_after,
    currency_code,
    description,
    note,
    status,
    reference_id,
    metadata,
    created_at
  ) VALUES (
    p_wallet_id,
    p_user_id,
    p_type,
    p_amount,
    v_balance_before,
    v_balance_after,
    (SELECT currency_code FROM wallets WHERE id = p_wallet_id),
    p_description,
    p_note,
    CASE 
      WHEN p_type LIKE 'deposit_%' THEN 
        CASE 
          WHEN p_type = 'deposit_pending' THEN 'pending'
          WHEN p_type = 'deposit_approved' THEN 'approved'
          WHEN p_type = 'deposit_rejected' THEN 'rejected'
          WHEN p_type = 'deposit_reversed' THEN 'reversed'
          ELSE 'pending'
        END
      ELSE 'completed'
    END,
    p_reference_id,
    p_metadata,
    NOW()
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- 4️⃣ FUNCTION - Recalculate wallet balance from wallet_transactions
CREATE OR REPLACE FUNCTION recalculate_wallet_balance(p_wallet_id UUID) 
RETURNS NUMERIC AS $$
DECLARE
  v_calculated_balance NUMERIC := 0;
BEGIN
  SELECT SUM(
    CASE 
      WHEN type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN amount
      WHEN type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -amount
      WHEN type = 'adjustment' THEN amount
      ELSE 0
    END
  ) INTO v_calculated_balance
  FROM wallet_transactions
  WHERE wallet_id = p_wallet_id;

  RETURN COALESCE(v_calculated_balance, 0);
END;
$$ LANGUAGE plpgsql;

-- 5️⃣ FUNCTION - Verify wallet balance matches ledger
CREATE OR REPLACE FUNCTION verify_wallet_balance(p_wallet_id UUID) 
RETURNS TABLE(is_valid BOOLEAN, actual_balance NUMERIC, calculated_balance NUMERIC, discrepancy NUMERIC) AS $$
DECLARE
  v_actual NUMERIC;
  v_calculated NUMERIC;
BEGIN
  SELECT balance INTO v_actual FROM wallets WHERE id = p_wallet_id;
  v_calculated := recalculate_wallet_balance(p_wallet_id);
  
  RETURN QUERY SELECT 
    (ABS(v_actual - v_calculated) < 0.01),
    v_actual,
    v_calculated,
    v_actual - v_calculated;
END;
$$ LANGUAGE plpgsql;

-- 6️⃣ FUNCTION - Get transaction history for wallet
CREATE OR REPLACE FUNCTION get_wallet_transaction_history(
  p_wallet_id UUID,
  p_limit INTEGER DEFAULT 100
) RETURNS TABLE(
  id UUID,
  type TEXT,
  amount NUMERIC,
  balance_before NUMERIC,
  balance_after NUMERIC,
  note TEXT,
  description TEXT,
  created_at TIMESTAMP,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wt.id,
    wt.type,
    wt.amount,
    wt.balance_before,
    wt.balance_after,
    wt.note,
    wt.description,
    wt.created_at,
    wt.metadata
  FROM wallet_transactions wt
  WHERE wt.wallet_id = p_wallet_id
  ORDER BY wt.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 7️⃣ FUNCTION - Get deposit timeline (all deposit-related transactions)
CREATE OR REPLACE FUNCTION get_deposit_timeline(p_deposit_id UUID) 
RETURNS TABLE(
  id UUID,
  type TEXT,
  note TEXT,
  amount NUMERIC,
  balance_before NUMERIC,
  balance_after NUMERIC,
  created_at TIMESTAMP,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wt.id,
    wt.type,
    wt.note,
    wt.amount,
    wt.balance_before,
    wt.balance_after,
    wt.created_at,
    wt.metadata
  FROM wallet_transactions wt
  WHERE wt.reference_id = p_deposit_id
  ORDER BY wt.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 8️⃣ TRIGGER - Auto-credit wallet when deposit approved
-- This trigger updates wallet balance when status changes to 'approved'
CREATE OR REPLACE FUNCTION trigger_auto_credit_on_deposit_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Only process when status changes to approved
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Create wallet transaction for approval
    v_transaction_id := record_ledger_transaction(
      p_wallet_id := NEW.wallet_id,
      p_user_id := NEW.user_id,
      p_type := 'deposit_approved',
      p_amount := COALESCE(NEW.received_amount, NEW.amount),
      p_note := 'approved',
      p_reference_id := NEW.id,
      p_metadata := jsonb_build_object(
        'original_amount', NEW.amount,
        'received_amount', NEW.received_amount,
        'currency_code', NEW.currency_code,
        'exchange_rate', NEW.exchange_rate,
        'approved_by', COALESCE(NEW.approved_by, 'system'),
        'approved_at', NEW.approved_at
      ),
      p_description := 'Deposit approved: ' || COALESCE(NEW.received_amount, NEW.amount) || ' ' || NEW.currency_code
    );
  END IF;
  
  -- Process reversal
  IF NEW.status = 'reversed' AND OLD.status = 'approved' THEN
    v_transaction_id := record_ledger_transaction(
      p_wallet_id := NEW.wallet_id,
      p_user_id := NEW.user_id,
      p_type := 'deposit_reversed',
      p_amount := COALESCE(NEW.received_amount, NEW.amount),
      p_note := 'reversed',
      p_reference_id := NEW.id,
      p_metadata := jsonb_build_object(
        'original_amount', NEW.amount,
        'received_amount', NEW.received_amount,
        'reversed_by', COALESCE(NEW.reversed_by, 'system'),
        'reversed_at', NEW.reversed_at
      ),
      p_description := 'Deposit reversed: ' || COALESCE(NEW.received_amount, NEW.amount) || ' ' || NEW.currency_code
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on deposits table
DROP TRIGGER IF EXISTS trg_auto_credit_on_approval ON deposits;
CREATE TRIGGER trg_auto_credit_on_approval
AFTER UPDATE ON deposits
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION trigger_auto_credit_on_deposit_approval();

-- 9️⃣ VIEW - Wallet balance verification status
CREATE OR REPLACE VIEW wallet_balance_verification AS
SELECT 
  w.id AS wallet_id,
  u.email,
  w.currency_code,
  w.balance AS actual_balance,
  (SELECT recalculate_wallet_balance(w.id)) AS calculated_balance,
  w.balance - (SELECT recalculate_wallet_balance(w.id)) AS discrepancy,
  CASE 
    WHEN ABS(w.balance - (SELECT recalculate_wallet_balance(w.id))) < 0.01 THEN 'VALID'
    ELSE 'MISMATCH'
  END AS status,
  w.updated_at
FROM wallets w
LEFT JOIN users u ON w.user_id = u.id
ORDER BY w.updated_at DESC;

-- 🔟 VIEW - Recent deposit activity
CREATE OR REPLACE VIEW recent_deposit_activity AS
SELECT 
  d.id AS deposit_id,
  u.email,
  d.amount,
  d.currency_code,
  d.status,
  COUNT(wt.id) AS transaction_count,
  MAX(wt.created_at) AS last_update,
  d.created_at
FROM deposits d
LEFT JOIN users u ON d.user_id = u.id
LEFT JOIN wallet_transactions wt ON d.id = wt.reference_id
GROUP BY d.id, u.email, d.amount, d.currency_code, d.status, d.created_at
ORDER BY d.created_at DESC;

-- ============================================================================
-- END WALLET TRANSACTIONS LEDGER SYSTEM
-- ============================================================================
