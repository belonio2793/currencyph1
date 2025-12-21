-- ====================================================================
-- EMERGENCY FIX: Recalculate wallet balances from approved deposits ONLY
-- This is the source of truth: wallet.balance = SUM(deposits.amount WHERE status='approved')
-- ====================================================================

BEGIN;

-- Step 1: Verify trigger exists
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_deposit_status_change';

-- Step 2: Create temp table with correct balances
CREATE TEMP TABLE corrected_balances AS
SELECT 
  w.id as wallet_id,
  w.balance as current_balance,
  COALESCE(SUM(CAST(d.amount AS NUMERIC)), 0) as approved_total,
  w.user_id
FROM wallets w
LEFT JOIN deposits d ON w.id = d.wallet_id AND d.status = 'approved'
GROUP BY w.id, w.balance, w.user_id;

-- Step 3: Update all wallets to correct balance
UPDATE wallets w
SET 
  balance = cb.approved_total,
  updated_at = CURRENT_TIMESTAMP
FROM corrected_balances cb
WHERE w.id = cb.wallet_id
  AND w.balance != cb.approved_total;

-- Step 4: Log all corrections in wallet_transactions
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
  cb.wallet_id,
  'emergency_correction',
  cb.approved_total - cb.current_balance,
  cb.current_balance,
  cb.approved_total,
  'EMERGENCY FIX: Wallet balance corrected to sum of approved deposits only',
  NULL,
  jsonb_build_object(
    'reason', 'Real-time trigger not working - manual correction',
    'rule', 'wallet.balance = SUM(deposits WHERE status=approved)',
    'deposits_approved_count', (SELECT COUNT(*) FROM deposits WHERE wallet_id = cb.wallet_id AND status = 'approved'),
    'deposits_other_count', (SELECT COUNT(*) FROM deposits WHERE wallet_id = cb.wallet_id AND status != 'approved')
  ),
  CURRENT_TIMESTAMP
FROM corrected_balances cb
WHERE cb.approved_total != cb.current_balance;

-- Step 5: Record reconciliation
INSERT INTO wallet_balance_reconciliation (
  wallet_id,
  user_id,
  balance_before,
  balance_after,
  reconciliation_type,
  reason,
  status,
  completed_at
)
SELECT 
  cb.wallet_id,
  cb.user_id,
  cb.current_balance,
  cb.approved_total,
  'emergency_correction',
  'EMERGENCY: Wallet corrected to match only approved deposits',
  'completed',
  CURRENT_TIMESTAMP
FROM corrected_balances cb
WHERE cb.approved_total != cb.current_balance;

COMMIT;

-- ====================================================================
-- VERIFICATION: Run these to confirm the fix worked
-- ====================================================================

-- Check wallet balances
SELECT 
  w.id,
  w.balance as current_wallet_balance,
  (SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) 
   FROM deposits d 
   WHERE d.wallet_id = w.id AND d.status = 'approved') as calculated_from_approved,
  (SELECT COUNT(*) FROM deposits d WHERE d.wallet_id = w.id AND d.status = 'approved') as approved_count,
  (SELECT COUNT(*) FROM deposits d WHERE d.wallet_id = w.id AND d.status != 'approved') as non_approved_count
FROM wallets w
WHERE w.balance > 0
ORDER BY w.balance DESC;

-- Check the specific problematic wallet
-- SELECT 
--   w.id,
--   w.balance,
--   (SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) FROM deposits WHERE wallet_id = w.id AND status = 'approved') as should_be
-- FROM wallets w
-- WHERE w.id = 'ab5b16c7-07d2-483f-97f3-cb2542b08cb1';

-- ====================================================================
-- DEBUGGING: If wallets STILL don't update, the issue is:
-- 1. Frontend is caching the balance
-- 2. RLS policies are blocking reads
-- 3. Trigger never actually fires
-- 
-- Run this to check trigger execution:
-- ====================================================================

-- SELECT * FROM wallet_transactions 
-- WHERE type IN ('balance_sync', 'emergency_correction')
-- ORDER BY created_at DESC LIMIT 10;
