-- ============================================================================
-- Payment Transfer System - Atomic Operations and RLS Policies
-- ============================================================================
-- This migration sets up functions for atomic payment transfers between users,
-- ensuring wallet balances are updated transactionally with full audit trail

-- ============================================================================
-- 1. CREATE FUNCTION: process_payment_transfer
-- ============================================================================
-- Atomically completes a payment transfer and updates wallets
CREATE OR REPLACE FUNCTION process_payment_transfer(
  p_transfer_id UUID,
  p_recipient_confirmation JSONB DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  transfer_id UUID,
  new_sender_balance NUMERIC,
  new_recipient_balance NUMERIC
) AS $$
DECLARE
  v_transfer RECORD;
  v_sender_wallet RECORD;
  v_recipient_wallet RECORD;
  v_new_sender_balance NUMERIC;
  v_new_recipient_balance NUMERIC;
BEGIN
  -- Get transfer record with exclusive lock
  SELECT * INTO v_transfer FROM transfers WHERE id = p_transfer_id FOR UPDATE;
  
  IF v_transfer IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Transfer not found'::TEXT, p_transfer_id, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;
  
  IF v_transfer.status != 'pending' THEN
    RETURN QUERY SELECT FALSE, 'Transfer is already ' || v_transfer.status, p_transfer_id, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;
  
  -- Get sender wallet with exclusive lock
  SELECT * INTO v_sender_wallet FROM wallets 
  WHERE id = v_transfer.from_wallet_id FOR UPDATE;
  
  IF v_sender_wallet IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Sender wallet not found'::TEXT, p_transfer_id, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;
  
  IF v_sender_wallet.balance < v_transfer.sender_amount THEN
    RETURN QUERY SELECT FALSE, 'Insufficient sender balance'::TEXT, p_transfer_id, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;
  
  -- Get recipient wallet with exclusive lock
  SELECT * INTO v_recipient_wallet FROM wallets 
  WHERE id = v_transfer.to_wallet_id FOR UPDATE;
  
  IF v_recipient_wallet IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Recipient wallet not found'::TEXT, p_transfer_id, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;
  
  -- Calculate new balances
  v_new_sender_balance := v_sender_wallet.balance - v_transfer.sender_amount;
  v_new_recipient_balance := v_recipient_wallet.balance + v_transfer.recipient_amount;
  
  -- Update sender wallet
  UPDATE wallets 
  SET balance = v_new_sender_balance,
      updated_at = NOW()
  WHERE id = v_transfer.from_wallet_id;
  
  -- Update recipient wallet
  UPDATE wallets 
  SET balance = v_new_recipient_balance,
      updated_at = NOW()
  WHERE id = v_transfer.to_wallet_id;
  
  -- Record sender debit transaction
  INSERT INTO wallet_transactions (
    wallet_id,
    user_id,
    amount,
    currency_code,
    transaction_type,
    description,
    reference_id,
    balance_before,
    balance_after,
    metadata
  ) VALUES (
    v_transfer.from_wallet_id,
    v_transfer.from_user_id,
    v_transfer.sender_amount,
    v_transfer.sender_currency,
    'transfer_debit',
    'Payment transfer to ' || (SELECT email FROM users WHERE id = v_transfer.to_user_id),
    p_transfer_id,
    v_sender_wallet.balance,
    v_new_sender_balance,
    JSONB_BUILD_OBJECT(
      'transfer_id', p_transfer_id,
      'recipient_user_id', v_transfer.to_user_id,
      'recipient_amount', v_transfer.recipient_amount,
      'recipient_currency', v_transfer.recipient_currency,
      'exchange_rate', v_transfer.exchange_rate
    )
  );
  
  -- Record recipient credit transaction
  INSERT INTO wallet_transactions (
    wallet_id,
    user_id,
    amount,
    currency_code,
    transaction_type,
    description,
    reference_id,
    balance_before,
    balance_after,
    metadata
  ) VALUES (
    v_transfer.to_wallet_id,
    v_transfer.to_user_id,
    v_transfer.recipient_amount,
    v_transfer.recipient_currency,
    'transfer_credit',
    'Payment received from ' || (SELECT email FROM users WHERE id = v_transfer.from_user_id),
    p_transfer_id,
    v_recipient_wallet.balance,
    v_new_recipient_balance,
    JSONB_BUILD_OBJECT(
      'transfer_id', p_transfer_id,
      'sender_user_id', v_transfer.from_user_id,
      'sender_amount', v_transfer.sender_amount,
      'sender_currency', v_transfer.sender_currency,
      'exchange_rate', v_transfer.exchange_rate
    )
  );
  
  -- Update transfer status
  UPDATE transfers
  SET status = 'completed',
      completed_at = NOW(),
      metadata = COALESCE(metadata, '{}'::JSONB) || JSONB_BUILD_OBJECT(
        'recipient_confirmation', COALESCE(p_recipient_confirmation, '{}'::JSONB),
        'completed_at_iso', NOW()::TEXT
      ),
      updated_at = NOW()
  WHERE id = p_transfer_id;
  
  RETURN QUERY SELECT 
    TRUE, 
    'Transfer completed successfully'::TEXT, 
    p_transfer_id, 
    v_new_sender_balance, 
    v_new_recipient_balance;
    
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    FALSE, 
    'Error processing transfer: ' || SQLERRM, 
    p_transfer_id, 
    NULL::NUMERIC, 
    NULL::NUMERIC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. CREATE FUNCTION: validate_transfer
-- ============================================================================
-- Validates a transfer request before processing
CREATE OR REPLACE FUNCTION validate_transfer(
  p_transfer_id UUID
)
RETURNS TABLE(
  is_valid BOOLEAN,
  validation_error TEXT,
  transfer_id UUID
) AS $$
DECLARE
  v_transfer RECORD;
  v_sender_wallet RECORD;
  v_recipient_wallet RECORD;
BEGIN
  -- Get transfer
  SELECT * INTO v_transfer FROM transfers WHERE id = p_transfer_id;
  
  IF v_transfer IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Transfer not found', p_transfer_id;
    RETURN;
  END IF;
  
  -- Check status
  IF v_transfer.status != 'pending' THEN
    RETURN QUERY SELECT FALSE, 'Transfer is ' || v_transfer.status, p_transfer_id;
    RETURN;
  END IF;
  
  -- Check sender wallet
  SELECT * INTO v_sender_wallet FROM wallets WHERE id = v_transfer.from_wallet_id;
  IF v_sender_wallet IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Sender wallet not found', p_transfer_id;
    RETURN;
  END IF;
  
  -- Check balance
  IF v_sender_wallet.balance < v_transfer.sender_amount THEN
    RETURN QUERY SELECT FALSE, 'Insufficient balance. Required: ' || v_transfer.sender_amount || ', Available: ' || v_sender_wallet.balance, p_transfer_id;
    RETURN;
  END IF;
  
  -- Check recipient wallet
  SELECT * INTO v_recipient_wallet FROM wallets WHERE id = v_transfer.to_wallet_id;
  IF v_recipient_wallet IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Recipient wallet not found', p_transfer_id;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, NULL, p_transfer_id;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, SQLERRM, p_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. ENABLE RLS ON TRANSFERS TABLE
-- ============================================================================
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their transfers" ON transfers;
DROP POLICY IF EXISTS "Service role manages transfers" ON transfers;

-- RLS Policy: Users can view their own transfers
CREATE POLICY "Users can view their transfers" ON transfers
  FOR SELECT USING (
    auth.uid() = from_user_id OR auth.uid() = to_user_id
  );

-- RLS Policy: Service role can insert/update
CREATE POLICY "Service role manages transfers" ON transfers
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can update transfers" ON transfers
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_transfers_status_created ON transfers(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_from_user_status ON transfers(from_user_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_to_user_status ON transfers(to_user_id, status);

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION process_payment_transfer(UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_transfer(UUID) TO anon, authenticated;
