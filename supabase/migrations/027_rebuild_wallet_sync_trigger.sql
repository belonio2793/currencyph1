-- ====================================================================
-- REBUILD: Real-time wallet balance sync from deposit status
-- Every deposit status change instantly updates wallet.balance
-- Rule: wallet.balance = SUM(all approved deposits)
-- ====================================================================

BEGIN;

-- Step 1: Drop existing conflicting policies
DROP POLICY IF EXISTS wallet_transactions_select ON wallet_transactions;
DROP POLICY IF EXISTS wallet_transactions_insert ON wallet_transactions;
DROP POLICY IF EXISTS wallet_transactions_update ON wallet_transactions;
DROP POLICY IF EXISTS wallet_transactions_delete ON wallet_transactions;

-- Step 2: Recreate policies cleanly
CREATE POLICY wallet_transactions_select ON wallet_transactions
  FOR SELECT USING (true);

CREATE POLICY wallet_transactions_insert ON wallet_transactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY wallet_transactions_update ON wallet_transactions
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY wallet_transactions_delete ON wallet_transactions
  FOR DELETE USING (true);

-- Step 3: Drop existing problematic trigger
DROP TRIGGER IF EXISTS trigger_deposit_status_change ON deposits;
DROP FUNCTION IF EXISTS handle_deposit_status_change();

-- Step 4: Create REAL-TIME wallet sync function
-- This calculates wallet balance directly from approved deposits
CREATE OR REPLACE FUNCTION sync_wallet_balance_from_deposits()
RETURNS TRIGGER AS $$
DECLARE
  v_approved_total NUMERIC;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Only process if wallet_id exists
  IF NEW.wallet_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate total from ALL approved deposits for this wallet
  SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0)
  INTO v_approved_total
  FROM deposits
  WHERE wallet_id = NEW.wallet_id 
    AND status = 'approved';

  -- Get current wallet balance
  SELECT balance INTO v_current_balance
  FROM wallets
  WHERE id = NEW.wallet_id;

  -- Only update if different
  IF v_current_balance IS NULL OR v_current_balance != v_approved_total THEN
    v_new_balance := v_approved_total;
    
    -- Update wallet with exact approved sum
    UPDATE wallets
    SET 
      balance = v_new_balance,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.wallet_id;

    -- Record transaction for this change
    INSERT INTO wallet_transactions (
      wallet_id,
      type,
      amount,
      balance_before,
      balance_after,
      description,
      reference_id,
      metadata,
      created_at
    ) VALUES (
      NEW.wallet_id,
      'balance_sync',
      v_new_balance - COALESCE(v_current_balance, 0),
      v_current_balance,
      v_new_balance,
      'Wallet synced to approved deposits: ' || 
        'Old status: ' || OLD.status || ' → New status: ' || NEW.status,
      NEW.id,
      jsonb_build_object(
        'sync_type', 'deposit_status_change',
        'old_status', OLD.status,
        'new_status', NEW.status,
        'deposit_id', NEW.id,
        'approved_total', v_approved_total,
        'reason', 'Real-time balance sync'
      ),
      CURRENT_TIMESTAMP
    );

    -- Record in reconciliation
    INSERT INTO wallet_balance_reconciliation (
      wallet_id,
      user_id,
      balance_before,
      balance_after,
      reconciliation_type,
      reason,
      status,
      completed_at
    ) VALUES (
      NEW.wallet_id,
      NEW.user_id,
      v_current_balance,
      v_new_balance,
      'real_time_sync',
      'Deposit ' || OLD.status || ' → ' || NEW.status || ': Wallet recalculated from approved deposits',
      'completed',
      CURRENT_TIMESTAMP
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 5: Create trigger on ANY deposit update
CREATE TRIGGER trigger_deposit_status_change
AFTER UPDATE ON deposits
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION sync_wallet_balance_from_deposits();

-- Step 6: Initial sync - fix all wallets to match their approved deposits
UPDATE wallets w
SET 
  balance = (
    SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0)
    FROM deposits d
    WHERE d.wallet_id = w.id AND d.status = 'approved'
  ),
  updated_at = CURRENT_TIMESTAMP;

-- Step 7: Log the sync operation
INSERT INTO wallet_transactions (
  wallet_id,
  type,
  amount,
  balance_before,
  balance_after,
  description,
  reference_id,
  metadata,
  created_at
)
SELECT 
  w.id,
  'initial_sync',
  0,
  0,
  w.balance,
  'Initial wallet sync: Balance set to sum of approved deposits',
  NULL,
  jsonb_build_object(
    'sync_type', 'initial_system_sync',
    'reason', 'Establish real-time deposit status reflection'
  ),
  CURRENT_TIMESTAMP
FROM wallets w;

-- Step 8: Verify trigger was created
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_deposit_status_change';

COMMIT;

-- ====================================================================
-- TESTING: After this runs, test the real-time sync
-- ====================================================================

-- 1. Check a wallet balance
-- SELECT id, balance FROM wallets LIMIT 1;

-- 2. Change a deposit status in that wallet
-- UPDATE deposits SET status = 'approved' WHERE wallet_id = '<wallet_id>' LIMIT 1;

-- 3. Wallet balance should AUTO-UPDATE to sum of all approved deposits
-- SELECT id, balance FROM wallets WHERE id = '<wallet_id>';

-- 4. Check transaction log
-- SELECT * FROM wallet_transactions 
-- WHERE wallet_id = '<wallet_id>' 
-- ORDER BY created_at DESC LIMIT 5;
