-- ============================================================================
-- DIAGNOSTIC & FIX SCRIPT FOR TRANSACTION: cbf899c8-78f2-46e7-a319-c119400b68b1
-- ============================================================================
-- Issue: Corrupted wallet balances from PHP to BTC conversion
-- User balances: 5,179,990,012,320,011.00 PHP | 10,186,804,350,678,487,000.00 BTC
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: IDENTIFY THE AFFECTED USER AND TRANSACTION
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_deposit_id VARCHAR := 'cbf899c8-78f2-46e7-a319-c119400b68b1';
  v_user_email VARCHAR;
BEGIN
  -- Find the user with this deposit
  SELECT d.user_id, u.email
  INTO v_user_id, v_user_email
  FROM deposits d
  LEFT JOIN auth.users u ON u.id = d.user_id
  WHERE d.id = v_deposit_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Deposit % not found!', v_deposit_id;
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'TRANSACTION ID: %', v_deposit_id;
  RAISE NOTICE 'AFFECTED USER: % (%)', v_user_email, v_user_id;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- ============================================================================
-- PHASE 2: SHOW CURRENT (CORRUPTED) STATE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '>> PHASE 2: CURRENT WALLET STATE (CORRUPTED)';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

SELECT
  SUBSTRING(w.id FROM 1 FOR 8) || '...' as wallet_id,
  w.currency_code,
  w.balance,
  w.total_deposited,
  w.total_withdrawn,
  w.created_at,
  w.updated_at
FROM wallets w
WHERE w.user_id = (SELECT user_id FROM deposits WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1')
ORDER BY w.currency_code;

-- ============================================================================
-- PHASE 3: ANALYZE WALLET TRANSACTIONS FOR THIS DEPOSIT
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '>> PHASE 3: WALLET TRANSACTIONS FOR THIS DEPOSIT';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

SELECT
  SUBSTRING(wt.id FROM 1 FOR 8) || '...' as tx_id,
  wt.type,
  wt.amount,
  wt.currency_code,
  wt.balance_before,
  wt.balance_after,
  wt.created_at
FROM wallet_transactions wt
WHERE wt.reference_id = 'cbf899c8-78f2-46e7-a319-c119400b68b1'
ORDER BY wt.created_at;

-- ============================================================================
-- PHASE 4: CALCULATE EXPECTED BALANCES FROM TRANSACTIONS
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '>> PHASE 4: CALCULATED BALANCES FROM TRANSACTIONS';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

SELECT
  w.id as wallet_id,
  w.currency_code,
  w.balance as current_balance,
  COALESCE(SUM(CASE
    WHEN wt.type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN wt.amount
    WHEN wt.type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -wt.amount
    WHEN wt.type = 'adjustment' THEN wt.amount
    ELSE 0
  END), 0) as calculated_balance,
  ABS(w.balance - COALESCE(SUM(CASE
    WHEN wt.type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN wt.amount
    WHEN wt.type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -wt.amount
    WHEN wt.type = 'adjustment' THEN wt.amount
    ELSE 0
  END), 0)) as discrepancy
FROM wallets w
LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id
WHERE w.user_id = (SELECT user_id FROM deposits WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1')
GROUP BY w.id, w.currency_code, w.balance
ORDER BY w.currency_code;

-- ============================================================================
-- PHASE 5: DEPOSIT DETAILS
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '>> PHASE 5: DEPOSIT DETAILS';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

SELECT
  id as deposit_id,
  user_id,
  amount,
  currency_code,
  deposit_method,
  status,
  payment_reference,
  external_tx_id,
  created_at,
  updated_at,
  CASE WHEN metadata IS NOT NULL THEN jsonb_pretty(metadata) ELSE 'NULL' END as metadata
FROM deposits
WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1';

-- ============================================================================
-- PHASE 6: FIX CORRUPTED WALLET BALANCES
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '>> PHASE 6: FIXING CORRUPTED WALLET BALANCES';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

DO $$
DECLARE
  v_user_id UUID;
  v_wallet_record RECORD;
  v_calculated_balance NUMERIC;
  v_old_balance NUMERIC;
  v_fixed_count INTEGER := 0;
BEGIN
  -- Get user ID
  SELECT user_id INTO v_user_id
  FROM deposits
  WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1';

  -- Fix each wallet
  FOR v_wallet_record IN
    SELECT w.id, w.currency_code, w.balance as old_balance
    FROM wallets w
    WHERE w.user_id = v_user_id
    ORDER BY w.currency_code
  LOOP
    -- Calculate correct balance
    SELECT COALESCE(SUM(CASE
      WHEN type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN amount
      WHEN type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -amount
      WHEN type = 'adjustment' THEN amount
      ELSE 0
    END), 0) INTO v_calculated_balance
    FROM wallet_transactions
    WHERE wallet_id = v_wallet_record.id;

    v_old_balance := v_wallet_record.old_balance;

    -- If there's a significant difference, fix it
    IF ABS(v_old_balance - v_calculated_balance) >= 0.01 THEN
      UPDATE wallets
      SET balance = v_calculated_balance, updated_at = NOW()
      WHERE id = v_wallet_record.id;

      RAISE NOTICE '✓ FIXED % (%): % → %',
        v_wallet_record.currency_code,
        SUBSTRING(v_wallet_record.id FROM 1 FOR 8),
        v_old_balance,
        v_calculated_balance;

      v_fixed_count := v_fixed_count + 1;
    ELSE
      RAISE NOTICE '✓ OK % (%): % (no change needed)',
        v_wallet_record.currency_code,
        SUBSTRING(v_wallet_record.id FROM 1 FOR 8),
        v_calculated_balance;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'FIXED % WALLETS', v_fixed_count;
END $$;

-- ============================================================================
-- PHASE 7: VERIFY THE FIX
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '>> PHASE 7: VERIFICATION - NEW (CORRECTED) BALANCES';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

SELECT
  SUBSTRING(w.id FROM 1 FOR 8) || '...' as wallet_id,
  w.currency_code,
  w.balance,
  COALESCE(SUM(CASE
    WHEN wt.type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') THEN wt.amount
    WHEN wt.type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee') THEN -wt.amount
    WHEN wt.type = 'adjustment' THEN wt.amount
    ELSE 0
  END), 0) as expected_balance,
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
WHERE w.user_id = (SELECT user_id FROM deposits WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1')
GROUP BY w.id, w.currency_code, w.balance
ORDER BY w.currency_code;

-- ============================================================================
-- PHASE 8: AUDIT TRAIL
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '>> PHASE 8: BALANCE CHANGE AUDIT TRAIL';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

SELECT
  SUBSTRING(wba.wallet_id FROM 1 FOR 8) || '...' as wallet_id,
  wba.balance_before,
  wba.balance_after,
  wba.change_reason,
  wba.created_at
FROM wallet_balance_audit wba
WHERE wba.wallet_id IN (
  SELECT w.id FROM wallets w
  WHERE w.user_id = (SELECT user_id FROM deposits WHERE id = 'cbf899c8-78f2-46e7-a319-c119400b68b1')
)
ORDER BY wba.created_at DESC
LIMIT 20;

RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════════════════';
RAISE NOTICE 'FIX COMPLETE!';
RAISE NOTICE '═══════════════════════════════════════════════════════════';

COMMIT;
