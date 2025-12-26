-- ============================================================================
-- Add deposit_id foreign key to wallet_transactions
-- ============================================================================
-- Purpose:
-- 1. Track which wallet_transactions rows are created when deposits are made
-- 2. Enable cascade delete: when a deposit is deleted, all related wallet_transactions are deleted
-- 3. Simplify auditing by linking transactions directly to their source deposits
--
-- Key Changes:
-- 1. Add deposit_id UUID column to wallet_transactions table
-- 2. Add foreign key constraint with ON DELETE CASCADE
-- 3. Update record_ledger_transaction function to accept and set deposit_id
-- 4. Update trigger_auto_credit_on_deposit_approval to pass deposit_id
-- 5. Create index on (deposit_id, type) for efficient queries
-- ============================================================================

BEGIN;

-- Step 1: Add deposit_id column to wallet_transactions if not already present
ALTER TABLE IF EXISTS wallet_transactions
ADD COLUMN IF NOT EXISTS deposit_id UUID;

-- Step 2: Add foreign key constraint with cascade delete
-- (If constraint already exists, this is idempotent via IF NOT EXISTS in the constraint name)
ALTER TABLE wallet_transactions
ADD CONSTRAINT fk_wallet_transactions_deposit_id 
  FOREIGN KEY (deposit_id) 
  REFERENCES deposits(id) 
  ON DELETE CASCADE 
  NOT VALID;

-- Validate the constraint (for existing rows that may not satisfy it)
ALTER TABLE wallet_transactions
VALIDATE CONSTRAINT fk_wallet_transactions_deposit_id;

-- Step 3: Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_wallet_tx_deposit_id ON wallet_transactions(deposit_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_deposit_type ON wallet_transactions(deposit_id, type) 
  WHERE deposit_id IS NOT NULL;

-- Step 4: Update record_ledger_transaction function to accept and use deposit_id
-- This function is called by triggers when deposits are approved/reversed
CREATE OR REPLACE FUNCTION record_ledger_transaction(
  p_wallet_id UUID,
  p_user_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_note TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_deposit_id UUID DEFAULT NULL
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

  -- Record transaction with deposit_id tracking
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
    p_deposit_id,
    p_metadata,
    NOW()
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Update the trigger function to pass deposit_id when recording transactions
CREATE OR REPLACE FUNCTION trigger_auto_credit_on_deposit_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_transaction_id UUID;
  v_approved_by_text TEXT;
  v_reversed_by_text TEXT;
BEGIN
  -- Only process when status changes to approved
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Handle approved_by field - store as UUID text or 'system' string
    v_approved_by_text := CASE 
      WHEN NEW.approved_by IS NOT NULL THEN NEW.approved_by::TEXT
      ELSE 'system'
    END;
    
    -- Create wallet transaction for approval with deposit_id tracking
    v_transaction_id := record_ledger_transaction(
      p_wallet_id := NEW.wallet_id,
      p_user_id := NEW.user_id,
      p_type := 'deposit_approved',
      p_amount := COALESCE(NEW.received_amount, NEW.amount),
      p_note := 'approved',
      p_reference_id := NEW.id,
      p_deposit_id := NEW.id,
      p_metadata := jsonb_build_object(
        'original_amount', NEW.amount,
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
    -- Handle reversed_by field - store as UUID text or 'system' string
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
      p_metadata := jsonb_build_object(
        'original_amount', NEW.amount,
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

-- Step 6: Add helpful comments for documentation
COMMENT ON COLUMN wallet_transactions.deposit_id IS 
'Foreign key to deposits table. When non-NULL, indicates this transaction was created due to a deposit action. 
Cascade delete ensures when a deposit is deleted, all related wallet_transactions rows are also deleted.
Use to query: SELECT * FROM wallet_transactions WHERE deposit_id = <deposit_id> AND type = ''deposit_approved''';

COMMENT ON INDEX idx_wallet_tx_deposit_id IS 
'Index for efficient queries of all transactions related to a specific deposit';

COMMENT ON INDEX idx_wallet_tx_deposit_type IS 
'Index for efficient queries of deposit-related transactions by type (e.g., find all deposit_approved transactions for a specific deposit)';

-- Step 7: Verify the migration was successful
-- (This SELECT helps validate the constraint and indexes exist)
SELECT 
  constraint_name,
  table_name,
  column_name,
  referenced_table_name,
  referenced_column_name
FROM information_schema.table_constraints tc
  INNER JOIN information_schema.key_column_usage kcu 
  ON tc.table_schema = kcu.table_schema 
  AND tc.table_name = kcu.table_name
  AND tc.constraint_name = kcu.constraint_name
  AND tc.constraint_type = 'FOREIGN KEY'
WHERE tc.table_name = 'wallet_transactions'
  AND tc.constraint_name = 'fk_wallet_transactions_deposit_id';

COMMIT;

-- ============================================================================
-- Testing the deposit_id tracking and cascade delete:
-- ============================================================================
--
-- 1. Create a test deposit (if not already approved):
--    INSERT INTO deposits (user_id, wallet_id, amount, currency_code, deposit_method, status)
--    VALUES ('<user_id>', '<wallet_id>', 100, 'PHP', 'test', 'pending');
--
-- 2. Query wallet_transactions with deposit_id set:
--    SELECT id, wallet_id, type, amount, deposit_id 
--    FROM wallet_transactions 
--    WHERE deposit_id IS NOT NULL
--    LIMIT 5;
--
-- 3. Test cascade delete - delete a deposit:
--    DELETE FROM deposits WHERE id = '<deposit_id>';
--
-- 4. Verify wallet_transactions rows with that deposit_id are also deleted:
--    SELECT COUNT(*) FROM wallet_transactions WHERE deposit_id = '<deposit_id>';
--    -- Should return 0 if cascade delete worked
--
-- ============================================================================
