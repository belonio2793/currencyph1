-- ============================================================================
-- DEPOSIT PROCESSING FUNCTIONS & PROCEDURES
-- ============================================================================
-- Provides atomic, transactional deposit operations for balance management

-- ============================================================================
-- Function: record_deposit_transaction
-- Purpose: Atomically record a deposit and credit user balance
-- ============================================================================

CREATE OR REPLACE FUNCTION record_deposit_transaction(
  p_deposit_id UUID,
  p_user_id UUID,
  p_wallet_id UUID,
  p_amount NUMERIC,
  p_currency_code VARCHAR,
  p_deposit_method TEXT,
  p_external_tx_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  transaction_id UUID,
  new_balance NUMERIC,
  message TEXT
) AS $$
DECLARE
  v_wallet_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_error_msg TEXT;
BEGIN
  -- Start transaction (implicit in function)
  
  -- Lock wallet row to prevent race conditions
  SELECT balance INTO v_wallet_balance
  FROM wallets
  WHERE id = p_wallet_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      NULL::UUID,
      NULL::NUMERIC,
      'Wallet not found'::TEXT;
    RETURN;
  END IF;

  -- Calculate new balance
  v_new_balance := COALESCE(v_wallet_balance, 0) + p_amount;

  -- Update wallet balance
  UPDATE wallets
  SET 
    balance = v_new_balance,
    updated_at = NOW()
  WHERE id = p_wallet_id
    AND user_id = p_user_id;

  -- Record transaction in wallet_transactions (if table exists)
  BEGIN
    INSERT INTO wallet_transactions (
      user_id,
      wallet_id,
      transaction_type,
      amount,
      currency_code,
      reference_id,
      reference_type,
      description,
      balance_after,
      status,
      created_at
    ) VALUES (
      p_user_id,
      p_wallet_id,
      'deposit',
      p_amount,
      p_currency_code,
      p_deposit_id,
      'deposit',
      COALESCE(p_description, 'Deposit from ' || p_deposit_method),
      v_new_balance,
      'completed',
      NOW()
    ) RETURNING id INTO v_transaction_id;
  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    -- Continue even if wallet_transactions fails, it's optional
  END;

  -- Update deposit record
  UPDATE deposits
  SET 
    status = 'completed',
    completed_at = NOW(),
    transaction_id = v_transaction_id,
    external_tx_id = COALESCE(p_external_tx_id, external_tx_id),
    updated_at = NOW()
  WHERE id = p_deposit_id;

  -- Return success
  RETURN QUERY SELECT 
    true::BOOLEAN,
    v_transaction_id,
    v_new_balance,
    'Deposit processed successfully'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    false::BOOLEAN,
    NULL::UUID,
    NULL::NUMERIC,
    'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: verify_and_credit_deposit
-- Purpose: Verify deposit amount and credit wallet balance
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_and_credit_deposit(
  p_deposit_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  deposit_id UUID,
  amount NUMERIC,
  new_balance NUMERIC,
  message TEXT
) AS $$
DECLARE
  v_deposit RECORD;
  v_result RECORD;
BEGIN
  -- Fetch deposit
  SELECT * INTO v_deposit
  FROM deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      p_deposit_id,
      NULL::NUMERIC,
      NULL::NUMERIC,
      'Deposit not found'::TEXT;
    RETURN;
  END IF;

  -- Check if already processed
  IF v_deposit.status = 'completed' THEN
    RETURN QUERY SELECT 
      true::BOOLEAN,
      p_deposit_id,
      v_deposit.amount,
      NULL::NUMERIC,
      'Deposit already completed'::TEXT;
    RETURN;
  END IF;

  -- Check if failed
  IF v_deposit.status = 'failed' OR v_deposit.status = 'cancelled' THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      p_deposit_id,
      v_deposit.amount,
      NULL::NUMERIC,
      'Deposit has status: ' || v_deposit.status::TEXT;
    RETURN;
  END IF;

  -- Validate amount
  IF v_deposit.amount <= 0 THEN
    UPDATE deposits SET status = 'failed', updated_at = NOW()
    WHERE id = p_deposit_id;

    RETURN QUERY SELECT 
      false::BOOLEAN,
      p_deposit_id,
      v_deposit.amount,
      NULL::NUMERIC,
      'Invalid deposit amount: ' || v_deposit.amount::TEXT;
    RETURN;
  END IF;

  -- Process the deposit
  SELECT * INTO v_result
  FROM record_deposit_transaction(
    v_deposit.id,
    v_deposit.user_id,
    v_deposit.wallet_id,
    v_deposit.amount,
    v_deposit.currency_code,
    v_deposit.deposit_method,
    v_deposit.external_tx_id,
    v_deposit.description
  );

  RETURN QUERY SELECT 
    v_result.success,
    p_deposit_id,
    v_deposit.amount,
    v_result.new_balance,
    v_result.message;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    false::BOOLEAN,
    p_deposit_id,
    NULL::NUMERIC,
    NULL::NUMERIC,
    'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: process_pending_deposits
-- Purpose: Batch process all pending deposits that have been confirmed
-- ============================================================================

CREATE OR REPLACE FUNCTION process_pending_deposits()
RETURNS TABLE(
  processed_count INT,
  success_count INT,
  failed_count INT,
  message TEXT
) AS $$
DECLARE
  v_processed_count INT := 0;
  v_success_count INT := 0;
  v_failed_count INT := 0;
  v_deposit_id UUID;
  v_result RECORD;
  v_cursor CURSOR FOR
    SELECT id FROM deposits
    WHERE status = 'pending'
      AND completed_at IS NOT NULL
      AND created_at < NOW() - INTERVAL '1 hour'
    LIMIT 100;
BEGIN
  OPEN v_cursor;
  
  LOOP
    FETCH v_cursor INTO v_deposit_id;
    EXIT WHEN NOT FOUND;
    
    v_processed_count := v_processed_count + 1;

    SELECT * INTO v_result
    FROM verify_and_credit_deposit(v_deposit_id);

    IF v_result.success THEN
      v_success_count := v_success_count + 1;
    ELSE
      v_failed_count := v_failed_count + 1;
    END IF;
  END LOOP;
  
  CLOSE v_cursor;

  RETURN QUERY SELECT 
    v_processed_count,
    v_success_count,
    v_failed_count,
    'Processed ' || v_processed_count::TEXT || ' deposits'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    v_processed_count,
    v_success_count,
    v_failed_count,
    'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: get_deposit_status_with_balance
-- Purpose: Get detailed deposit info including current wallet balance
-- ============================================================================

CREATE OR REPLACE FUNCTION get_deposit_status_with_balance(
  p_deposit_id UUID
)
RETURNS TABLE(
  deposit_id UUID,
  user_id UUID,
  wallet_id UUID,
  amount NUMERIC,
  currency_code VARCHAR,
  deposit_method TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  current_wallet_balance NUMERIC,
  transaction_recorded BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.user_id,
    d.wallet_id,
    d.amount,
    d.currency_code,
    d.deposit_method,
    d.status,
    d.created_at,
    d.completed_at,
    w.balance,
    d.transaction_id IS NOT NULL
  FROM deposits d
  LEFT JOIN wallets w ON w.id = d.wallet_id
  WHERE d.id = p_deposit_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: get_user_deposit_summary
-- Purpose: Get summary of user's deposits by status and method
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_deposit_summary(
  p_user_id UUID
)
RETURNS TABLE(
  deposit_method TEXT,
  status TEXT,
  count INT,
  total_amount NUMERIC,
  avg_amount NUMERIC,
  latest_deposit TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.deposit_method,
    d.status,
    COUNT(*)::INT,
    SUM(d.amount),
    AVG(d.amount),
    MAX(d.created_at)
  FROM deposits d
  WHERE d.user_id = p_user_id
  GROUP BY d.deposit_method, d.status
  ORDER BY MAX(d.created_at) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: validate_deposit_limits
-- Purpose: Check if user is within daily/monthly deposit limits
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_deposit_limits(
  p_user_id UUID,
  p_proposed_amount NUMERIC,
  p_currency_code VARCHAR DEFAULT 'USD'
)
RETURNS TABLE(
  valid BOOLEAN,
  daily_used NUMERIC,
  daily_limit NUMERIC,
  monthly_used NUMERIC,
  monthly_limit NUMERIC,
  message TEXT
) AS $$
DECLARE
  v_daily_used NUMERIC;
  v_monthly_used NUMERIC;
  v_daily_limit NUMERIC := 50000;
  v_monthly_limit NUMERIC := 500000;
BEGIN
  -- Calculate daily deposits (last 24 hours)
  SELECT COALESCE(SUM(amount), 0) INTO v_daily_used
  FROM deposits
  WHERE user_id = p_user_id
    AND status = 'completed'
    AND currency_code = p_currency_code
    AND created_at >= NOW() - INTERVAL '1 day';

  -- Calculate monthly deposits (last 30 days)
  SELECT COALESCE(SUM(amount), 0) INTO v_monthly_used
  FROM deposits
  WHERE user_id = p_user_id
    AND status = 'completed'
    AND currency_code = p_currency_code
    AND created_at >= NOW() - INTERVAL '30 days';

  RETURN QUERY SELECT 
    (v_daily_used + p_proposed_amount <= v_daily_limit 
     AND v_monthly_used + p_proposed_amount <= v_monthly_limit)::BOOLEAN,
    v_daily_used,
    v_daily_limit,
    v_monthly_used,
    v_monthly_limit,
    CASE 
      WHEN v_daily_used + p_proposed_amount > v_daily_limit THEN 
        'Daily limit exceeded'
      WHEN v_monthly_used + p_proposed_amount > v_monthly_limit THEN 
        'Monthly limit exceeded'
      ELSE 'Limits OK'
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: refund_deposit
-- Purpose: Reverse a failed or disputed deposit
-- ============================================================================

CREATE OR REPLACE FUNCTION refund_deposit(
  p_deposit_id UUID,
  p_reason TEXT DEFAULT 'User requested refund'
)
RETURNS TABLE(
  success BOOLEAN,
  refund_amount NUMERIC,
  new_balance NUMERIC,
  message TEXT
) AS $$
DECLARE
  v_deposit RECORD;
  v_wallet_balance NUMERIC;
  v_new_balance NUMERIC;
  v_refund_transaction_id UUID;
BEGIN
  -- Fetch deposit
  SELECT * INTO v_deposit
  FROM deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      NULL::NUMERIC,
      NULL::NUMERIC,
      'Deposit not found'::TEXT;
    RETURN;
  END IF;

  -- Check if already refunded
  IF v_deposit.status = 'refunded' THEN
    RETURN QUERY SELECT 
      true::BOOLEAN,
      v_deposit.amount,
      NULL::NUMERIC,
      'Deposit already refunded'::TEXT;
    RETURN;
  END IF;

  -- Check if completed (can only refund completed deposits)
  IF v_deposit.status != 'completed' THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      v_deposit.amount,
      NULL::NUMERIC,
      'Can only refund completed deposits. Current status: ' || v_deposit.status::TEXT;
    RETURN;
  END IF;

  -- Lock wallet
  SELECT balance INTO v_wallet_balance
  FROM wallets
  WHERE id = v_deposit.wallet_id
    AND user_id = v_deposit.user_id
  FOR UPDATE;

  -- Deduct refund from wallet
  v_new_balance := v_wallet_balance - v_deposit.amount;

  -- Update wallet
  UPDATE wallets
  SET 
    balance = v_new_balance,
    updated_at = NOW()
  WHERE id = v_deposit.wallet_id
    AND user_id = v_deposit.user_id;

  -- Record refund transaction
  BEGIN
    INSERT INTO wallet_transactions (
      user_id,
      wallet_id,
      transaction_type,
      amount,
      currency_code,
      reference_id,
      reference_type,
      description,
      balance_after,
      status,
      created_at
    ) VALUES (
      v_deposit.user_id,
      v_deposit.wallet_id,
      'refund',
      v_deposit.amount,
      v_deposit.currency_code,
      v_deposit.id,
      'deposit_refund',
      'Refund: ' || p_reason,
      v_new_balance,
      'completed',
      NOW()
    ) RETURNING id INTO v_refund_transaction_id;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Continue even if wallet_transactions fails
  END;

  -- Mark deposit as refunded
  UPDATE deposits
  SET 
    status = 'refunded',
    notes = COALESCE(notes, '') || 'Refunded: ' || p_reason,
    updated_at = NOW()
  WHERE id = p_deposit_id;

  RETURN QUERY SELECT 
    true::BOOLEAN,
    v_deposit.amount,
    v_new_balance,
    'Deposit refunded successfully'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    false::BOOLEAN,
    NULL::NUMERIC,
    NULL::NUMERIC,
    'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger: Auto-update deposits updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_deposits_update_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deposits_update_timestamp ON deposits;
CREATE TRIGGER trg_deposits_update_timestamp
BEFORE UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION trigger_deposits_update_timestamp();

-- ============================================================================
-- Grant permissions (if using RLS)
-- ============================================================================

GRANT EXECUTE ON FUNCTION record_deposit_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION verify_and_credit_deposit TO authenticated;
GRANT EXECUTE ON FUNCTION process_pending_deposits TO service_role;
GRANT EXECUTE ON FUNCTION get_deposit_status_with_balance TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_deposit_summary TO authenticated;
GRANT EXECUTE ON FUNCTION validate_deposit_limits TO authenticated;
GRANT EXECUTE ON FUNCTION refund_deposit TO service_role;

-- ============================================================================
-- END DEPOSIT FUNCTIONS MIGRATION
-- ============================================================================
