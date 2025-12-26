-- ============================================================================
-- Migration 0123: Enhance wallet_transactions with complete deposit metadata
-- ============================================================================
-- Purpose:
-- 1. Add columns from public.deposits to wallet_transactions for denormalization
-- 2. Improve metadata structure for deposits
-- 3. Enable efficient queries without joins
-- 4. Maintain complete audit trail of deposit-related transactions
--
-- Key Changes:
-- 1. Add deposit-specific columns to wallet_transactions
-- 2. Update metadata JSON structure to include all deposit details
-- 3. Create indexes for deposit-related queries
-- 4. Update triggers to populate new columns and metadata
-- ============================================================================

BEGIN;

-- Step 1: Add new columns to wallet_transactions table
ALTER TABLE IF EXISTS wallet_transactions
ADD COLUMN IF NOT EXISTS original_amount NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS original_currency TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS received_amount NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS received_currency TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rate_source TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deposit_method TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_reference TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS conversion_fee NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS conversion_fee_currency TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS net_received_amount NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS approved_by UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reversal_reason TEXT DEFAULT NULL;

-- Step 2: Create composite index for efficient deposit transaction queries
CREATE INDEX IF NOT EXISTS idx_wallet_tx_deposit_details ON wallet_transactions(
  deposit_id, 
  type, 
  original_currency, 
  received_currency, 
  created_at DESC
)
WHERE deposit_id IS NOT NULL;

-- Step 3: Create index for lookup by original/received currency pairs
CREATE INDEX IF NOT EXISTS idx_wallet_tx_currency_pair ON wallet_transactions(
  original_currency, 
  received_currency
)
WHERE original_currency IS NOT NULL AND received_currency IS NOT NULL;

-- Step 4: Create index for exchange rate lookups
CREATE INDEX IF NOT EXISTS idx_wallet_tx_exchange_rate ON wallet_transactions(
  exchange_rate,
  rate_source
)
WHERE exchange_rate IS NOT NULL;

-- Step 5: Update record_ledger_transaction function to include deposit metadata
CREATE OR REPLACE FUNCTION record_ledger_transaction(
  p_wallet_id UUID,
  p_user_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_note TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_deposit_id UUID DEFAULT NULL,
  p_original_amount NUMERIC DEFAULT NULL,
  p_original_currency TEXT DEFAULT NULL,
  p_received_amount NUMERIC DEFAULT NULL,
  p_received_currency TEXT DEFAULT NULL,
  p_exchange_rate NUMERIC DEFAULT NULL,
  p_rate_source TEXT DEFAULT NULL,
  p_deposit_method TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL,
  p_conversion_fee NUMERIC DEFAULT NULL,
  p_conversion_fee_currency TEXT DEFAULT NULL,
  p_net_received_amount NUMERIC DEFAULT NULL,
  p_approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_approved_by UUID DEFAULT NULL,
  p_reversal_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_transaction_id UUID;
  v_enriched_metadata JSONB;
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
    WHEN 'adjustment', 'balance_sync_on_delete' THEN
      v_balance_after := v_balance_before + p_amount;
    ELSE
      RAISE EXCEPTION 'Invalid transaction type: %', p_type;
  END CASE;

  -- Prevent negative balance (except adjustments)
  IF v_balance_after < 0 AND p_type NOT IN ('adjustment', 'balance_sync_on_delete') THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Attempted: %', v_balance_before, p_amount;
  END IF;

  -- Update wallet balance
  UPDATE wallets
  SET 
    balance = v_balance_after,
    updated_at = NOW()
  WHERE id = p_wallet_id;

  -- Enrich metadata with deposit details
  v_enriched_metadata := COALESCE(p_metadata, '{}'::JSONB) || jsonb_build_object(
    'original_amount', p_original_amount,
    'original_currency', p_original_currency,
    'received_amount', p_received_amount,
    'received_currency', p_received_currency,
    'exchange_rate', p_exchange_rate,
    'rate_source', p_rate_source,
    'deposit_method', p_deposit_method,
    'payment_reference', p_payment_reference,
    'conversion_fee', p_conversion_fee,
    'conversion_fee_currency', p_conversion_fee_currency,
    'net_received_amount', p_net_received_amount,
    'approved_at', p_approved_at,
    'approved_by', p_approved_by,
    'reversal_reason', p_reversal_reason
  );

  -- Record transaction with all deposit metadata
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
    deposit_id,
    metadata,
    created_at,
    original_amount,
    original_currency,
    received_amount,
    received_currency,
    exchange_rate,
    rate_source,
    deposit_method,
    payment_reference,
    conversion_fee,
    conversion_fee_currency,
    net_received_amount,
    approved_at,
    approved_by,
    reversal_reason
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
    p_deposit_id,
    v_enriched_metadata,
    NOW(),
    p_original_amount,
    p_original_currency,
    p_received_amount,
    p_received_currency,
    p_exchange_rate,
    p_rate_source,
    p_deposit_method,
    p_payment_reference,
    p_conversion_fee,
    p_conversion_fee_currency,
    p_net_received_amount,
    p_approved_at,
    p_approved_by,
    p_reversal_reason
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Update trigger function to pass all deposit metadata
CREATE OR REPLACE FUNCTION trigger_auto_credit_on_deposit_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_transaction_id UUID;
  v_approved_by_text TEXT;
  v_reversed_by_text TEXT;
BEGIN
  -- Only process when status changes to approved
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    v_approved_by_text := CASE 
      WHEN NEW.approved_by IS NOT NULL THEN NEW.approved_by::TEXT
      ELSE 'system'
    END;
    
    v_transaction_id := record_ledger_transaction(
      p_wallet_id := NEW.wallet_id,
      p_user_id := NEW.user_id,
      p_type := 'deposit_approved',
      p_amount := COALESCE(NEW.received_amount, NEW.amount),
      p_note := 'approved',
      p_reference_id := NEW.id,
      p_deposit_id := NEW.id,
      p_original_amount := NEW.original_amount,
      p_original_currency := NEW.original_currency,
      p_received_amount := COALESCE(NEW.received_amount, NEW.amount),
      p_received_currency := NEW.received_currency,
      p_exchange_rate := NEW.exchange_rate,
      p_rate_source := NEW.rate_source,
      p_deposit_method := NEW.deposit_method,
      p_payment_reference := NEW.payment_reference,
      p_conversion_fee := NEW.conversion_fee,
      p_conversion_fee_currency := NEW.conversion_fee_currency,
      p_net_received_amount := NEW.net_received_amount,
      p_approved_at := NEW.approved_at,
      p_approved_by := NEW.approved_by,
      p_metadata := jsonb_build_object(
        'original_amount', NEW.original_amount,
        'received_amount', NEW.received_amount,
        'currency_code', NEW.currency_code,
        'exchange_rate', NEW.exchange_rate,
        'approved_by', v_approved_by_text,
        'approved_at', NEW.approved_at
      ),
      p_description := 'Deposit approved: ' || COALESCE(NEW.received_amount, NEW.amount) || ' ' || NEW.currency_code
    );
  END IF;
  
  -- Process reversal
  IF NEW.status = 'reversed' AND OLD.status = 'approved' THEN
    v_reversed_by_text := CASE 
      WHEN NEW.reversed_by IS NOT NULL THEN NEW.reversed_by::TEXT
      ELSE 'system'
    END;
    
    v_transaction_id := record_ledger_transaction(
      p_wallet_id := NEW.wallet_id,
      p_user_id := NEW.user_id,
      p_type := 'deposit_reversed',
      p_amount := COALESCE(NEW.received_amount, NEW.amount),
      p_note := 'reversed',
      p_reference_id := NEW.id,
      p_deposit_id := NEW.id,
      p_original_amount := NEW.original_amount,
      p_original_currency := NEW.original_currency,
      p_received_amount := COALESCE(NEW.received_amount, NEW.amount),
      p_received_currency := NEW.received_currency,
      p_exchange_rate := NEW.exchange_rate,
      p_rate_source := NEW.rate_source,
      p_deposit_method := NEW.deposit_method,
      p_payment_reference := NEW.payment_reference,
      p_conversion_fee := NEW.conversion_fee,
      p_conversion_fee_currency := NEW.conversion_fee_currency,
      p_net_received_amount := NEW.net_received_amount,
      p_reversal_reason := NEW.reversal_reason,
      p_metadata := jsonb_build_object(
        'original_amount', NEW.original_amount,
        'received_amount', NEW.received_amount,
        'reversed_by', v_reversed_by_text,
        'reversed_at', NEW.reversed_at
      ),
      p_description := 'Deposit reversed: ' || COALESCE(NEW.received_amount, NEW.amount) || ' ' || NEW.currency_code
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Add helpful column comments
COMMENT ON COLUMN wallet_transactions.original_amount IS 'Original amount in original_currency before conversion';
COMMENT ON COLUMN wallet_transactions.original_currency IS 'Currency code of the original deposit amount (e.g., ADA, USD)';
COMMENT ON COLUMN wallet_transactions.received_amount IS 'Amount received after conversion (in wallet currency)';
COMMENT ON COLUMN wallet_transactions.received_currency IS 'Currency code of the wallet where deposit is received';
COMMENT ON COLUMN wallet_transactions.exchange_rate IS 'Exchange rate used for conversion (original → received)';
COMMENT ON COLUMN wallet_transactions.rate_source IS 'Source of the exchange rate (e.g., public.pairs, coingecko, manual)';
COMMENT ON COLUMN wallet_transactions.deposit_method IS 'Deposit method used (e.g., gcash, btc, ada)';
COMMENT ON COLUMN wallet_transactions.payment_reference IS 'Payment reference from the deposit method';
COMMENT ON COLUMN wallet_transactions.conversion_fee IS 'Fee charged for currency conversion';
COMMENT ON COLUMN wallet_transactions.approved_at IS 'Timestamp when deposit was approved';
COMMENT ON COLUMN wallet_transactions.approved_by IS 'User ID or system identifier that approved the deposit';

-- Step 8: Verify migration success
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'wallet_transactions'
  AND column_name IN (
    'original_amount', 'original_currency', 'received_amount', 
    'received_currency', 'exchange_rate', 'rate_source', 
    'deposit_method', 'payment_reference', 'conversion_fee',
    'approved_at', 'approved_by'
  )
ORDER BY column_name;

COMMIT;

-- ============================================================================
-- Query Examples:
-- ============================================================================
--
-- 1. Get all deposit transactions for a wallet with full conversion details:
--    SELECT wallet_id, original_amount, original_currency, received_amount, 
--           received_currency, exchange_rate, rate_source, created_at
--    FROM wallet_transactions 
--    WHERE wallet_id = '<wallet_id>' AND type LIKE 'deposit_%'
--    ORDER BY created_at DESC;
--
-- 2. Find deposits by currency pair:
--    SELECT * FROM wallet_transactions
--    WHERE original_currency = 'ADA' AND received_currency = 'BTC'
--    ORDER BY created_at DESC;
--
-- 3. Audit deposit conversions by rate source:
--    SELECT rate_source, COUNT(*), AVG(exchange_rate) as avg_rate
--    FROM wallet_transactions
--    WHERE type = 'deposit_approved' AND rate_source IS NOT NULL
--    GROUP BY rate_source;
--
-- 4. Get deposit method usage statistics:
--    SELECT deposit_method, COUNT(*) as count, SUM(received_amount) as total_received
--    FROM wallet_transactions
--    WHERE type = 'deposit_approved' AND deposit_method IS NOT NULL
--    GROUP BY deposit_method;
--
-- ============================================================================
