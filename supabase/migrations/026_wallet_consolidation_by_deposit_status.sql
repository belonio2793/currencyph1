-- ====================================================================
-- WALLET CONSOLIDATION: Debit wallets for all non-approved deposits
-- Rule: Only deposits with status='approved' should credit the wallet
-- All other statuses: pending, reverted, failed, cancelled, etc. should debit
-- ====================================================================

BEGIN;

-- Step 1: Create reconciliation temp table
CREATE TEMP TABLE temp_consolidation AS
SELECT 
  d.id as deposit_id,
  d.user_id,
  d.wallet_id,
  d.amount,
  d.currency_code,
  d.status,
  w.balance as current_balance,
  CASE 
    -- If status is 'approved', wallet SHOULD have been credited (+amount)
    -- If status is NOT 'approved', wallet should NOT be credited (or should be debited)
    WHEN d.status = 'approved' THEN w.balance -- No change needed
    ELSE w.balance - CAST(d.amount AS NUMERIC) -- Debit for non-approved
  END as corrected_balance
FROM deposits d
LEFT JOIN wallets w ON d.wallet_id = w.id
WHERE d.wallet_id IS NOT NULL;

-- Step 2: Update wallet balances to corrected state
UPDATE wallets w
SET 
  balance = tc.corrected_balance,
  updated_at = CURRENT_TIMESTAMP
FROM temp_consolidation tc
WHERE w.id = tc.wallet_id
  AND w.balance != tc.corrected_balance; -- Only update if different

-- Step 3: Record all consolidation transactions
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
  tc.wallet_id,
  'consolidation_adjustment',
  tc.corrected_balance - tc.current_balance, -- Difference
  tc.current_balance,
  tc.corrected_balance,
  'Wallet consolidation: Non-approved deposit adjustment (' || tc.status || ')',
  tc.deposit_id,
  jsonb_build_object(
    'deposit_status', tc.status,
    'consolidation_reason', 'Only approved deposits should credit wallet',
    'original_amount', tc.amount,
    'currency', tc.currency_code
  ),
  CURRENT_TIMESTAMP
FROM temp_consolidation tc
WHERE tc.corrected_balance != tc.current_balance;

-- Step 4: Record reconciliation entries
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
  tc.wallet_id,
  tc.user_id,
  tc.current_balance,
  tc.corrected_balance,
  'deposit_consolidation',
  'Wallet consolidated: ' || COUNT(*) || ' deposits reviewed. Status: ' || STRING_AGG(DISTINCT tc.status, ', '),
  'completed',
  CURRENT_TIMESTAMP
FROM temp_consolidation tc
WHERE tc.corrected_balance != tc.current_balance
GROUP BY tc.wallet_id, tc.user_id, tc.current_balance, tc.corrected_balance;

COMMIT;

-- ====================================================================
-- VERIFICATION QUERIES - Run these to confirm consolidation worked
-- ====================================================================

-- Check which wallets were adjusted
SELECT 
  wt.wallet_id,
  COUNT(*) as adjustment_count,
  SUM(wt.amount) as total_adjustment,
  MAX(wt.created_at) as last_adjustment
FROM wallet_transactions wt
WHERE wt.type = 'consolidation_adjustment'
  AND wt.created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
GROUP BY wt.wallet_id;

-- Check specific wallet balance
-- SELECT id, balance FROM wallets WHERE id = 'ab5b16c7-07d2-483f-97f3-cb2542b08cb1';

-- Verify all approved deposits have corresponding transaction records
-- SELECT d.id, d.amount, d.status, 
--        (SELECT COUNT(*) FROM wallet_transactions wt WHERE wt.reference_id = d.id) as tx_count
-- FROM deposits d
-- WHERE d.status = 'approved'
-- LIMIT 10;

-- Check consolidated vs expected
-- SELECT 
--   w.id,
--   w.balance as actual_balance,
--   SUM(CASE WHEN d.status = 'approved' THEN CAST(d.amount AS NUMERIC) ELSE 0 END) as should_be_credited,
--   COUNT(d.id) FILTER (WHERE d.status != 'approved') as non_approved_count
-- FROM wallets w
-- LEFT JOIN deposits d ON w.id = d.wallet_id
-- GROUP BY w.id, w.balance
-- HAVING COUNT(d.id) > 0;
