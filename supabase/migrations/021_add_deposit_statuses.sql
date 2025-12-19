-- ============================================================================
-- UPDATE DEPOSITS TABLE TO INCLUDE APPROVED AND REJECTED STATUSES
-- ============================================================================

-- Drop the existing constraint
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_status_check;

-- Add new constraint with approved and rejected statuses
ALTER TABLE deposits ADD CONSTRAINT deposits_status_check 
  CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'completed', 'failed', 'cancelled'));

-- Update the deposit_method constraint to be more flexible
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_deposit_method_check;

ALTER TABLE deposits ADD CONSTRAINT deposits_deposit_method_check 
  CHECK (deposit_method IN ('solana', 'gcash', 'fiat_transfer', 'crypto_transfer', 'bank_transfer', 'stripe', 'paymaya'));

-- ============================================================================
-- UPDATE RLS POLICY TO ALLOW UPDATING APPROVED/REJECTED DEPOSITS
-- ============================================================================

DROP POLICY IF EXISTS "Users can update own deposits" ON deposits;

CREATE POLICY "Users can update own deposits"
ON deposits
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('pending', 'processing', 'approved', 'rejected')
);

-- ============================================================================
-- ADD COMMENT FOR CLARITY
-- ============================================================================

COMMENT ON COLUMN deposits.status IS 
'Status of the deposit: 
- pending: Initial state, awaiting user payment
- processing: Payment received, processing the deposit
- approved: Admin approved the deposit, ready to credit wallet
- rejected: Admin rejected the deposit
- completed: Deposit completed and wallet has been credited
- failed: Deposit failed (payment issue, etc)
- cancelled: User cancelled the deposit';

-- ============================================================================
-- END MIGRATION
-- ============================================================================
