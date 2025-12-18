-- ============================================================================
-- TRANSFER FUNDS FUNCTION - Atomic wallet-to-wallet transfer
-- ============================================================================

CREATE OR REPLACE FUNCTION transfer_funds(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_sender_wallet_id UUID,
  p_receiver_wallet_id UUID,
  p_amount NUMERIC,
  p_currency_code VARCHAR,
  p_description TEXT DEFAULT 'Payment transfer',
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS jsonb AS $$
DECLARE
  v_sender_balance_before NUMERIC;
  v_sender_balance_after NUMERIC;
  v_receiver_balance_before NUMERIC;
  v_receiver_balance_after NUMERIC;
  v_transfer_id UUID;
  v_result jsonb;
BEGIN
  -- Lock sender wallet row for update
  SELECT balance INTO v_sender_balance_before
  FROM wallets
  WHERE id = p_sender_wallet_id
  FOR UPDATE;

  IF v_sender_balance_before IS NULL THEN
    RAISE EXCEPTION 'Sender wallet not found';
  END IF;

  -- Check sender has sufficient balance
  IF v_sender_balance_before < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: %, Required: %', v_sender_balance_before, p_amount;
  END IF;

  -- Lock receiver wallet row for update
  SELECT balance INTO v_receiver_balance_before
  FROM wallets
  WHERE id = p_receiver_wallet_id
  FOR UPDATE;

  IF v_receiver_balance_before IS NULL THEN
    RAISE EXCEPTION 'Receiver wallet not found';
  END IF;

  -- Calculate new balances
  v_sender_balance_after := v_sender_balance_before - p_amount;
  v_receiver_balance_after := v_receiver_balance_before + p_amount;

  -- Update sender wallet (debit)
  UPDATE wallets
  SET balance = v_sender_balance_after,
      updated_at = NOW()
  WHERE id = p_sender_wallet_id;

  -- Update receiver wallet (credit)
  UPDATE wallets
  SET balance = v_receiver_balance_after,
      updated_at = NOW()
  WHERE id = p_receiver_wallet_id;

  -- Record sender transaction (transfer_send)
  INSERT INTO public.balances (
    user_id,
    currency_code,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    sender_id,
    receiver_id,
    reference_type,
    description,
    metadata,
    status
  ) VALUES (
    p_sender_id,
    p_currency_code,
    'transfer_send',
    p_amount,
    v_sender_balance_before,
    v_sender_balance_after,
    p_sender_id,
    p_receiver_id,
    'payment',
    p_description,
    p_metadata,
    'completed'
  ) RETURNING id INTO v_transfer_id;

  -- Record receiver transaction (transfer_receive)
  INSERT INTO public.balances (
    user_id,
    currency_code,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    sender_id,
    receiver_id,
    reference_id,
    reference_type,
    description,
    metadata,
    status
  ) VALUES (
    p_receiver_id,
    p_currency_code,
    'transfer_receive',
    p_amount,
    v_receiver_balance_before,
    v_receiver_balance_after,
    p_sender_id,
    p_receiver_id,
    v_transfer_id,
    'payment',
    p_description,
    p_metadata,
    'completed'
  );

  -- Build result JSON
  v_result := jsonb_build_object(
    'success', true,
    'transfer_id', v_transfer_id,
    'sender_id', p_sender_id,
    'receiver_id', p_receiver_id,
    'amount', p_amount,
    'currency_code', p_currency_code,
    'sender_balance_before', v_sender_balance_before,
    'sender_balance_after', v_sender_balance_after,
    'receiver_balance_before', v_receiver_balance_before,
    'receiver_balance_after', v_receiver_balance_after,
    'timestamp', NOW()
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_code', SQLSTATE
  );
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION transfer_funds TO authenticated;
