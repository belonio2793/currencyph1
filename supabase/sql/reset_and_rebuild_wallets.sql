-- ============================================================================
-- RESET & REBUILD: Clear corrupted wallets, rebuild from deposits
-- ============================================================================
-- This script:
-- 1. Clears all wallet balances to 0
-- 2. Rebuilds wallet_transactions from approved deposits
-- 3. Recalculates balances correctly
-- 4. Verifies data integrity
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: BACKUP CHECK - Show current corrupted state
-- ============================================================================

RAISE NOTICE '═══════════════════════════════════════════════════════════';
RAISE NOTICE 'PHASE 1: CURRENT STATE BEFORE RESET';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

CREATE TEMPORARY TABLE wallet_backup AS
SELECT id, user_id, currency_code, balance, total_deposited, total_withdrawn, created_at
FROM wallets
WHERE balance != 0;

-- Show how many wallets have non-zero balances (will be reset)
SELECT COUNT(*) as wallets_with_balance FROM wallet_backup;

-- ============================================================================
-- PHASE 2: CLEAR ALL WALLET BALANCES
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════════════════';
RAISE NOTICE 'PHASE 2: CLEARING ALL WALLET BALANCES TO ZERO';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

UPDATE wallets SET balance = 0 WHERE balance != 0;
RAISE NOTICE 'Cleared all wallet balances';

-- ============================================================================
-- PHASE 3: DELETE INCORRECT WALLET_TRANSACTIONS
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════════════════';
RAISE NOTICE 'PHASE 3: CLEARING WALLET_TRANSACTIONS';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

-- Count before deletion
SELECT COUNT(*) as transaction_count_before_delete FROM wallet_transactions;

-- Delete all transactions (they'll be rebuilt from deposits)
DELETE FROM wallet_transactions;

RAISE NOTICE 'Deleted all wallet_transactions';

-- ============================================================================
-- PHASE 4: REBUILD WALLET_TRANSACTIONS FROM APPROVED DEPOSITS
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════════════════';
RAISE NOTICE 'PHASE 4: REBUILDING WALLET_TRANSACTIONS FROM DEPOSITS';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

DO $$
DECLARE
  v_deposit_count INTEGER := 0;
  v_transaction_count INTEGER := 0;
  v_deposit_record RECORD;
  v_wallet_id UUID;
BEGIN
  -- Find all approved deposits
  FOR v_deposit_record IN
    SELECT 
      id,
      user_id,
      wallet_id,
      amount,
      currency_code,
      status,
      created_at
    FROM deposits
    WHERE status = 'approved'
    ORDER BY created_at
  LOOP
    v_deposit_count := v_deposit_count + 1;

    -- Create wallet_transaction entry for this deposit
    BEGIN
      INSERT INTO wallet_transactions (
        id,
        wallet_id,
        user_id,
        type,
        reference_id,
        amount,
        balance_before,
        balance_after,
        currency_code,
        description,
        created_at
      )
      SELECT
        gen_random_uuid(),
        v_deposit_record.wallet_id,
        v_deposit_record.user_id,
        'deposit_approved',
        v_deposit_record.id,
        v_deposit_record.amount,
        0, -- Will recalculate below
        0, -- Will recalculate below
        v_deposit_record.currency_code,
        'Approved deposit credited to wallet',
        v_deposit_record.created_at;

      v_transaction_count := v_transaction_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create transaction for deposit %: %', v_deposit_record.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Processed % approved deposits', v_deposit_count;
  RAISE NOTICE 'Created % wallet_transactions', v_transaction_count;
END $$;

-- ============================================================================
-- PHASE 5: RECALCULATE WALLET BALANCES FROM TRANSACTIONS
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════════════════';
RAISE NOTICE 'PHASE 5: RECALCULATING WALLET BALANCES';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

DO $$
DECLARE
  v_wallet_record RECORD;
  v_calculated_balance NUMERIC;
  v_updated_count INTEGER := 0;
BEGIN
  -- For each wallet, calculate balance from transactions
  FOR v_wallet_record IN
    SELECT DISTINCT wallet_id FROM wallet_transactions
  LOOP
    -- Calculate balance
    SELECT COALESCE(SUM(CASE
      WHEN type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN amount
      WHEN type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -amount
      WHEN type = 'adjustment' THEN amount
      ELSE 0
    END), 0) INTO v_calculated_balance
    FROM wallet_transactions
    WHERE wallet_id = v_wallet_record.wallet_id;

    -- Update wallet balance
    UPDATE wallets
    SET balance = v_calculated_balance, updated_at = NOW()
    WHERE id = v_wallet_record.wallet_id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  RAISE NOTICE 'Updated % wallets with recalculated balances', v_updated_count;
END $$;

-- ============================================================================
-- PHASE 6: UPDATE WALLET TOTALS
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════════════════';
RAISE NOTICE 'PHASE 6: UPDATING WALLET TOTALS';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

UPDATE wallets w
SET 
  total_deposited = COALESCE((
    SELECT SUM(amount)
    FROM wallet_transactions wt
    WHERE wt.wallet_id = w.id
    AND wt.type IN ('deposit_pending', 'deposit_approved')
  ), 0),
  total_withdrawn = COALESCE((
    SELECT SUM(amount)
    FROM wallet_transactions wt
    WHERE wt.wallet_id = w.id
    AND wt.type IN ('withdrawal', 'transfer_out')
  ), 0)
WHERE id IN (SELECT DISTINCT wallet_id FROM wallet_transactions);

RAISE NOTICE 'Updated wallet total_deposited and total_withdrawn';

-- ============================================================================
-- PHASE 7: VERIFY DATA INTEGRITY
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════════════════';
RAISE NOTICE 'PHASE 7: VERIFICATION - NEW BALANCES';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

SELECT
  w.id,
  w.user_id,
  w.currency_code,
  w.balance as current_balance,
  COALESCE(SUM(CASE
    WHEN wt.type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN wt.amount
    WHEN wt.type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -wt.amount
    WHEN wt.type = 'adjustment' THEN wt.amount
    ELSE 0
  END), 0) as calculated_balance,
  CASE
    WHEN ABS(w.balance - COALESCE(SUM(CASE
      WHEN wt.type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN wt.amount
      WHEN wt.type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -wt.amount
      WHEN wt.type = 'adjustment' THEN wt.amount
      ELSE 0
    END), 0)) < 0.01 THEN '✓ VALID'
    ELSE '✗ MISMATCH'
  END as verification_status
FROM wallets w
LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
WHERE w.balance != 0 OR w.id IN (SELECT DISTINCT wallet_id FROM wallet_transactions)
GROUP BY w.id, w.user_id, w.currency_code, w.balance
ORDER BY w.user_id, w.currency_code;

-- ============================================================================
-- PHASE 8: SHOW SUMMARY
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════════════════';
RAISE NOTICE 'SUMMARY';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

RAISE NOTICE 'Total wallets: %', (SELECT COUNT(*) FROM wallets);
RAISE NOTICE 'Wallets with balance: %', (SELECT COUNT(*) FROM wallets WHERE balance != 0);
RAISE NOTICE 'Total wallet_transactions: %', (SELECT COUNT(*) FROM wallet_transactions);
RAISE NOTICE 'Approved deposits processed: %', (SELECT COUNT(*) FROM deposits WHERE status = 'approved');

RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════════════════';
RAISE NOTICE 'REBUILD COMPLETE!';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after this script completes)
-- ============================================================================
--
-- 1. Check wallet balances are reasonable:
-- SELECT currency_code, MIN(balance) as min_balance, MAX(balance) as max_balance, COUNT(*) as count
-- FROM wallets
-- WHERE balance > 0
-- GROUP BY currency_code;
--
-- 2. Check for any mismatches:
-- SELECT w.id, w.currency_code, w.balance, 
--   COALESCE(SUM(CASE
--     WHEN wt.type IN ('deposit_approved') THEN wt.amount
--     WHEN wt.type IN ('withdrawal') THEN -wt.amount
--     ELSE 0
--   END), 0) as calculated
-- FROM wallets w
-- LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
-- GROUP BY w.id, w.currency_code, w.balance
-- HAVING ABS(w.balance - COALESCE(SUM(CASE
--   WHEN wt.type IN ('deposit_approved') THEN wt.amount
--   WHEN wt.type IN ('withdrawal') THEN -wt.amount
--   ELSE 0
-- END), 0)) >= 0.01;
--
-- 3. Verify specific user's wallets:
-- SELECT * FROM wallets WHERE user_id = 'user-uuid';
--
-- ============================================================================
