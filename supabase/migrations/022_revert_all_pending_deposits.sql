-- Migration: Revert all pending deposits with full wallet reconciliation
-- This script reverts ALL pending deposits across the system
-- Updates: wallet balances, deposit_reversal_registry, wallet_transactions, and deposit_status_history

BEGIN;

-- Step 1: Create a temporary table to track all reversals
CREATE TEMP TABLE temp_reversals AS
SELECT 
  d.id as deposit_id,
  d.user_id,
  d.wallet_id,
  d.amount,
  d.currency_code,
  w.balance as current_balance,
  (w.balance - CAST(d.amount AS NUMERIC)) as new_balance
FROM deposits d
LEFT JOIN wallets w ON d.wallet_id = w.id
WHERE d.status = 'pending'
  AND d.wallet_id IS NOT NULL;

-- Step 2: Update all wallet balances for pending deposits
UPDATE wallets w
SET 
  balance = balance - CAST(d.amount AS NUMERIC),
  updated_at = CURRENT_TIMESTAMP
FROM deposits d
WHERE w.id = d.wallet_id
  AND d.status = 'pending';

-- Step 3: Insert wallet transactions for each reversal
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
  d.wallet_id,
  'deposit_reversal',
  -CAST(d.amount AS NUMERIC),
  (tr.current_balance),
  (tr.new_balance),
  'Pending deposit reverted: ' || d.amount || ' ' || COALESCE(d.currency_code, 'PHP'),
  d.id,
  jsonb_build_object(
    'deposit_id', d.id,
    'original_status', 'pending',
    'reason', 'bulk_reversal',
    'currency', d.currency_code
  ),
  CURRENT_TIMESTAMP
FROM deposits d
JOIN temp_reversals tr ON d.id = tr.deposit_id
WHERE d.status = 'pending';

-- Step 4: Create reversal registry entries
INSERT INTO deposit_reversal_registry (
  original_deposit_id,
  reason,
  reversed_by,
  original_balance,
  reversal_balance,
  status,
  created_at
)
SELECT 
  d.id,
  'bulk_pending_reversal',
  '00000000-0000-0000-0000-000000000000'::UUID,
  tr.current_balance,
  tr.new_balance,
  'active',
  CURRENT_TIMESTAMP
FROM deposits d
JOIN temp_reversals tr ON d.id = tr.deposit_id
WHERE d.status = 'pending';

-- Step 5: Record wallet balance reconciliation
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
  tr.wallet_id,
  tr.user_id,
  tr.current_balance,
  tr.new_balance,
  'deposit_reversal',
  'Bulk pending deposit reversal',
  'completed',
  CURRENT_TIMESTAMP
FROM temp_reversals tr;

-- Step 6: Update deposit status to 'reverted'
UPDATE deposits
SET 
  status = 'reverted',
  updated_at = CURRENT_TIMESTAMP,
  reversal_reason = 'bulk_pending_reversal'
WHERE status = 'pending';

-- Step 7: Record status history for all reverted deposits
INSERT INTO deposit_status_history (
  deposit_id,
  user_id,
  old_status,
  new_status,
  changed_by,
  reason,
  created_at
)
SELECT 
  d.id,
  d.user_id,
  'pending',
  'reverted',
  '00000000-0000-0000-0000-000000000000'::UUID,
  'Bulk reversal: All pending deposits consolidated',
  CURRENT_TIMESTAMP
FROM deposits d
WHERE d.status = 'reverted'
  AND NOT EXISTS (
    SELECT 1 FROM deposit_status_history dsh
    WHERE dsh.deposit_id = d.id 
      AND dsh.old_status = 'pending'
      AND dsh.new_status = 'reverted'
      AND dsh.created_at >= CURRENT_TIMESTAMP - INTERVAL '1 second'
  );

-- Step 8: Log audit entry for this bulk operation
INSERT INTO deposit_audit_log (
  deposit_id,
  user_id,
  wallet_id,
  action,
  old_state,
  new_state,
  wallet_impact,
  status,
  created_at
)
SELECT 
  d.id,
  d.user_id,
  d.wallet_id,
  'bulk_reversal',
  jsonb_build_object(
    'status', 'pending',
    'amount', d.amount,
    'balance_before', tr.current_balance
  ),
  jsonb_build_object(
    'status', 'reverted',
    'amount', d.amount,
    'balance_after', tr.new_balance
  ),
  jsonb_build_object(
    'wallet_id', d.wallet_id,
    'amount_reversed', -CAST(d.amount AS NUMERIC),
    'balance_before', tr.current_balance,
    'balance_after', tr.new_balance
  ),
  'success',
  CURRENT_TIMESTAMP
FROM deposits d
JOIN temp_reversals tr ON d.id = tr.deposit_id
WHERE d.status = 'reverted';

COMMIT;

-- Summary query to verify reversal
SELECT 
  COUNT(*) as total_reverted_deposits,
  SUM(CAST(amount AS NUMERIC)) as total_amount_reversed,
  COUNT(DISTINCT wallet_id) as affected_wallets
FROM deposits
WHERE status = 'reverted';
