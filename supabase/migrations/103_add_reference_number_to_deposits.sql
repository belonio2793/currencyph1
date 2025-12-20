-- ============================================================================
-- Add reference_number to deposits table for GCash verification
-- ============================================================================

-- Add reference_number column if it doesn't exist
ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);

-- Create index for reference number lookups
CREATE INDEX IF NOT EXISTS idx_deposits_reference_number 
ON deposits(reference_number) 
WHERE reference_number IS NOT NULL;

-- Create index for GCash pending deposits
CREATE INDEX IF NOT EXISTS idx_deposits_gcash_pending 
ON deposits(user_id, deposit_method, status) 
WHERE deposit_method = 'gcash' AND status = 'pending';

-- ============================================================================
-- END MIGRATION
-- ============================================================================
