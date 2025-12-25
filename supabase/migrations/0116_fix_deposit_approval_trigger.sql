-- ============================================================================
-- FIX: Deposit Approval Trigger - UUID Type Error
-- ============================================================================
-- Issue: trigger_auto_credit_on_deposit_approval() fails with 
-- "ERROR: 22P02: invalid input syntax for type uuid: "system""
-- 
-- Root causes:
-- 1. COALESCE(NEW.approved_by, 'system') tries to cast 'system' to UUID
-- 2. Missing columns reversed_by and reversed_at
-- 
-- Solution: 
-- - Add missing columns to deposits table
-- - Fix trigger to use proper type casting
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Add missing columns to deposits table
-- ============================================================================

ALTER TABLE IF EXISTS deposits
ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;

-- ============================================================================
-- Step 2: Fix the trigger function with proper type handling
-- ============================================================================

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
    
    -- Create wallet transaction for approval
    v_transaction_id := record_ledger_transaction(
      p_wallet_id := NEW.wallet_id,
      p_user_id := NEW.user_id,
      p_type := 'deposit_approved',
      p_amount := COALESCE(NEW.received_amount, NEW.amount),
      p_note := 'approved',
      p_reference_id := NEW.id,
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

-- ============================================================================
-- Step 3: Verify trigger exists and is properly configured
-- ============================================================================

-- Drop and recreate the trigger to ensure it uses the fixed function
DROP TRIGGER IF EXISTS trg_auto_credit_on_approval ON deposits;

CREATE TRIGGER trg_auto_credit_on_approval
AFTER UPDATE ON deposits
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION trigger_auto_credit_on_deposit_approval();

-- ============================================================================
-- Step 4: Add helpful comments
-- ============================================================================

COMMENT ON FUNCTION trigger_auto_credit_on_deposit_approval() IS 
'Automatically credits wallet when deposit status changes to approved.

FIXES:
- UUID type casting issue: approved_by and reversed_by now properly cast to TEXT
- Missing columns: reversed_by and reversed_at now exist

BEHAVIOR:
1. When status changes from pending to approved: credits wallet and records transaction
2. When status changes from approved to reversed: reverses the transaction
3. Handles NULL approved_by/reversed_by by storing "system" as the actor

PRECONDITIONS:
- deposits.wallet_id must be valid UUID
- deposits.user_id must be valid UUID
- If using conversions, received_amount must be set for approval
';

COMMENT ON COLUMN deposits.reversed_by IS 'UUID of user who reversed this deposit, or NULL for system reversals';
COMMENT ON COLUMN deposits.reversed_at IS 'Timestamp when deposit was reversed';

COMMIT;

-- ============================================================================
-- Test query (run after applying this migration):
-- ============================================================================
-- SELECT * FROM deposits 
-- WHERE status IN ('approved', 'reversed') 
-- LIMIT 1;
-- 
-- SELECT * FROM wallet_transactions 
-- WHERE type IN ('deposit_approved', 'deposit_reversed')
-- LIMIT 5;
-- ============================================================================
