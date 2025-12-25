-- ============================================================================
-- IMMEDIATE FIX: Corrupted Wallet Balances (PHP to BTC conversion)
-- ============================================================================
-- 
-- Transaction ID: cbf899c8-78f2-46e7-a319-c119400b68b1
-- Issue: User has absurdly large balances (5 quadrillion PHP, 10 septillion BTC)
-- 
-- This script:
-- 1. Diagnoses the corruption
-- 2. Fixes the specific user's wallets
-- 3. Verifies the fix
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Identify the affected user
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_user_email VARCHAR;
  v_deposit_id VARCHAR := 'cbf899c8-78f2-46e7-a319-c119400b68b1';
BEGIN
  -- Find the user with this deposit
  SELECT d.user_id, u.email
  INTO v_user_id, v_user_email
  FROM deposits d
  LEFT JOIN auth.users u ON u.id = d.user_id
  WHERE d.id = v_deposit_id;

  RAISE NOTICE 'Finding corrupted wallets for user: % (%)', v_user_email, v_user_id;

  -- Show current corrupted state
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'CURRENT (CORRUPTED) WALLET BALANCES:';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  FOR v_user_id, v_user_email IN
    SELECT w.id, w.currency_code, w.balance
    FROM wallets w
    WHERE w.user_id = (SELECT user_id FROM deposits WHERE id = v_deposit_id)
  LOOP
    RAISE NOTICE '  % - %: %', (SELECT SUBSTRING(id FROM 1 FOR 8) || '...' FROM wallets WHERE id = v_user_id), v_user_email, v_user_id;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Analyze transaction history for the deposit
-- ============================================================================

DO $$
DECLARE
  v_deposit_id VARCHAR := 'cbf899c8-78f2-46e7-a319-c119400b68b1';
  v_wallet_record RECORD;
  v_total_debit NUMERIC := 0;
  v_total_credit NUMERIC := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'TRANSACTION HISTORY ANALYSIS:';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  -- Show all transactions for this deposit
  FOR v_wallet_record IN
    SELECT 
      wt.id,
      wt.type,
      wt.amount,
      wt.currency_code,
      wt.balance_after,
      wt.created_at,
      (wt.metadata->>'original_amount') as orig_amt,
      (wt.metadata->>'exchange_rate') as rate
    FROM wallet_transactions wt
    WHERE wt.reference_id = v_deposit_id
    ORDER BY wt.created_at
  LOOP
    RAISE NOTICE '  [%] % - %: % %', 
      TO_CHAR(v_wallet_record.created_at, 'YYYY-MM-DD HH:MI:SS'),
      SUBSTRING(v_wallet_record.type FROM 1 FOR 20),
      v_wallet_record.amount,
      v_wallet_record.currency_code,
      CASE WHEN v_wallet_record.rate IS NOT NULL THEN '@ ' || v_wallet_record.rate || ' rate' ELSE '' END;

    IF v_wallet_record.type LIKE 'deposit%' THEN
      v_total_credit := v_total_credit + v_wallet_record.amount;
    ELSE
      v_total_debit := v_total_debit + v_wallet_record.amount;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Summary: +% credited, -% debited', v_total_credit, v_total_debit;
END $$;

-- ============================================================================
-- STEP 3: Fix corrupted wallet balances
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_wallet_record RECORD;
  v_calculated_balance NUMERIC;
  v_old_balance NUMERIC;
  v_fixed_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'FIXING CORRUPTED WALLET BALANCES:';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  -- Get user ID
  SELECT user_id INTO v_user_id
  FROM deposits
  WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1';

  -- Fix each wallet for this user
  FOR v_wallet_record IN
    SELECT w.id, w.currency_code, w.balance as old_balance
    FROM wallets w
    WHERE w.user_id = v_user_id
    ORDER BY w.currency_code
  LOOP
    -- Calculate correct balance from transactions
    SELECT SUM(CASE
      WHEN type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN amount
      WHEN type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -amount
      WHEN type = 'adjustment' THEN amount
      ELSE 0
    END) INTO v_calculated_balance
    FROM wallet_transactions
    WHERE wallet_id = v_wallet_record.id;

    v_calculated_balance := COALESCE(v_calculated_balance, 0);
    v_old_balance := v_wallet_record.old_balance;

    -- If there's a significant difference, fix it
    IF ABS(v_old_balance - v_calculated_balance) >= 0.01 THEN
      UPDATE wallets
      SET balance = v_calculated_balance, updated_at = NOW()
      WHERE id = v_wallet_record.id;

      RAISE NOTICE '  ✓ FIXED % (%): % → %',
        v_wallet_record.currency_code,
        SUBSTRING(v_wallet_record.id FROM 1 FOR 8),
        v_old_balance,
        v_calculated_balance;

      v_fixed_count := v_fixed_count + 1;
    ELSE
      RAISE NOTICE '  ✓ OK %: balance already correct at %',
        v_wallet_record.currency_code,
        v_calculated_balance;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Fixed % wallets', v_fixed_count;
END $$;

-- ============================================================================
-- STEP 4: Verify the fix
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_wallet_record RECORD;
  v_calculated NUMERIC;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'VERIFICATION - NEW (CORRECTED) BALANCES:';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  SELECT user_id INTO v_user_id
  FROM deposits
  WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1';

  FOR v_wallet_record IN
    SELECT w.id, w.currency_code, w.balance
    FROM wallets w
    WHERE w.user_id = v_user_id
    ORDER BY w.currency_code
  LOOP
    -- Verify calculation
    SELECT SUM(CASE
      WHEN type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN amount
      WHEN type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -amount
      WHEN type = 'adjustment' THEN amount
      ELSE 0
    END) INTO v_calculated
    FROM wallet_transactions
    WHERE wallet_id = v_wallet_record.id;

    v_calculated := COALESCE(v_calculated, 0);

    IF ABS(v_wallet_record.balance - v_calculated) < 0.01 THEN
      RAISE NOTICE '  ✓ % (%): %', 
        v_wallet_record.currency_code,
        SUBSTRING(v_wallet_record.id FROM 1 FOR 8),
        v_wallet_record.balance;
    ELSE
      RAISE WARNING '  ✗ % (%): MISMATCH! Balance: % vs Calculated: %',
        v_wallet_record.currency_code,
        SUBSTRING(v_wallet_record.id FROM 1 FOR 8),
        v_wallet_record.balance,
        v_calculated;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'FIX COMPLETE!';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

COMMIT;

-- ============================================================================
-- MANUAL VERIFICATION (run these after the script completes)
-- ============================================================================
--
-- Check the deposit metadata:
-- SELECT id, amount, currency_code, received_amount, exchange_rate, status, metadata
-- FROM deposits
-- WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1';
--
-- Check the wallet transactions:
-- SELECT type, amount, currency_code, balance_after, created_at
-- FROM wallet_transactions
-- WHERE reference_id = 'cbf899c8-78f2-46e7-a319-c119400b68b1'
-- ORDER BY created_at;
--
-- Verify user's current wallets:
-- SELECT w.id, w.currency_code, w.balance, w.user_id
-- FROM wallets w
-- WHERE w.user_id = (SELECT user_id FROM deposits WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1');
--
-- Check balance audit trail:
-- SELECT wallet_id, balance_before, balance_after, change_reason, created_at
-- FROM wallet_balance_audit
-- ORDER BY created_at DESC
-- LIMIT 20;
--
-- ============================================================================
