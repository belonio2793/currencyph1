-- ============================================================================
-- TRANSFERS TABLE SCHEMA FIXES AND ENHANCEMENTS
-- ============================================================================
-- This migration ensures the transfers table has proper:
-- 1. Auto-updating timestamp triggers
-- 2. Comprehensive indexes for performance
-- 3. Check constraints for data integrity
-- 4. RLS policies for security
-- 5. Foreign key relationships with CASCADE rules
--
-- Migration version: 0125
-- Created: 2025-01-01
-- Purpose: Fix and harden transfers table schema

-- ============================================================================
-- PART 1: ENSURE TRANSFERS TABLE EXISTS WITH PROPER STRUCTURE
-- ============================================================================

CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- From/To wallets
  from_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  to_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Amounts (support cross-currency)
  sender_amount NUMERIC(36, 8) NOT NULL CHECK (sender_amount > 0),
  sender_currency VARCHAR(16) NOT NULL,
  recipient_amount NUMERIC(36, 8) NOT NULL CHECK (recipient_amount > 0),
  recipient_currency VARCHAR(16) NOT NULL,
  
  -- Conversion tracking
  exchange_rate NUMERIC(18, 8) DEFAULT 1,
  rate_source VARCHAR(100),
  rate_fetched_at TIMESTAMPTZ,
  
  -- Status and fees
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  fee NUMERIC(36, 8) DEFAULT 0 CHECK (fee >= 0),
  description TEXT,
  
  -- Metadata for extensibility
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================================
-- PART 2: ADD AUTO-UPDATE TRIGGER FOR UPDATED_AT
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS transfers_update_updated_at_trigger ON transfers;

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_transfers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER transfers_update_updated_at_trigger
BEFORE UPDATE ON transfers
FOR EACH ROW
EXECUTE FUNCTION update_transfers_updated_at();

-- ============================================================================
-- PART 3: CREATE COMPREHENSIVE INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_transfers_from_user ON transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_user ON transfers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_wallet ON transfers(from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_wallet ON transfers(to_wallet_id);

-- Status and timestamp indexes
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_created ON transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_updated ON transfers(updated_at DESC);

-- Compound indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transfers_user_status ON transfers(from_user_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_recipient_status ON transfers(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_created_status ON transfers(created_at DESC, status);

-- Currency-related indexes
CREATE INDEX IF NOT EXISTS idx_transfers_sender_currency ON transfers(sender_currency);
CREATE INDEX IF NOT EXISTS idx_transfers_recipient_currency ON transfers(recipient_currency);

-- ============================================================================
-- PART 4: ADD CHECK CONSTRAINTS FOR DATA INTEGRITY
-- ============================================================================

-- Ensure amounts are positive (these may already exist)
ALTER TABLE transfers
ADD CONSTRAINT IF NOT EXISTS check_transfers_sender_amount_positive CHECK (sender_amount > 0);

ALTER TABLE transfers
ADD CONSTRAINT IF NOT EXISTS check_transfers_recipient_amount_positive CHECK (recipient_amount > 0);

ALTER TABLE transfers
ADD CONSTRAINT IF NOT EXISTS check_transfers_fee_positive CHECK (fee >= 0);

-- Ensure exchange_rate is positive when set
ALTER TABLE transfers
ADD CONSTRAINT IF NOT EXISTS check_transfers_exchange_rate_positive CHECK (exchange_rate IS NULL OR exchange_rate > 0);

-- Ensure status is one of allowed values
ALTER TABLE transfers
ADD CONSTRAINT IF NOT EXISTS check_transfers_status_valid CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

-- ============================================================================
-- PART 5: ENSURE ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on transfers table
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their transfers" ON transfers;
DROP POLICY IF EXISTS "Service role manages transfers" ON transfers;
DROP POLICY IF EXISTS "Users can view transfers they sent" ON transfers;
DROP POLICY IF EXISTS "Users can view transfers they received" ON transfers;
DROP POLICY IF EXISTS "Authenticated users can insert transfers" ON transfers;

-- Policy: Users can view transfers they sent or received
CREATE POLICY "Users can view transfers they sent or received"
  ON transfers FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Policy: Service role can insert transfers
CREATE POLICY "Service role can insert transfers"
  ON transfers FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Service role can update transfers
CREATE POLICY "Service role can update transfers"
  ON transfers FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Service role can delete transfers
CREATE POLICY "Service role can delete transfers"
  ON transfers FOR DELETE
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- PART 6: ADD METADATA FIELD VALIDATION (JSON Schema optional)
-- ============================================================================

-- This is an optional constraint to ensure metadata has expected structure
-- Uncomment if you want strict metadata validation
-- ALTER TABLE transfers
-- ADD CONSTRAINT IF NOT EXISTS check_transfers_metadata_structure CHECK (
--   metadata IS NULL OR 
--   (
--     jsonb_typeof(metadata) = 'object' AND
--     metadata ? 'payment_method' AND
--     metadata ? 'crypto_network' OR NOT (metadata ? 'crypto_network')
--   )
-- );

-- ============================================================================
-- PART 7: ADD HELPER VIEW FOR TRANSFER REPORTING
-- ============================================================================

DROP VIEW IF EXISTS transfers_summary CASCADE;

CREATE VIEW transfers_summary AS
SELECT
  t.id,
  t.from_user_id,
  t.to_user_id,
  fp.email as from_user_email,
  tp.email as to_user_email,
  t.from_wallet_id,
  t.to_wallet_id,
  t.sender_amount,
  t.sender_currency,
  t.recipient_amount,
  t.recipient_currency,
  t.exchange_rate,
  t.status,
  t.fee,
  t.description,
  t.created_at,
  t.updated_at,
  t.completed_at,
  (t.completed_at IS NOT NULL) as is_completed,
  (EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600) as hours_since_creation
FROM transfers t
LEFT JOIN auth.users fp ON t.from_user_id = fp.id
LEFT JOIN auth.users tp ON t.to_user_id = tp.id;

-- ============================================================================
-- PART 8: GRANT PERMISSIONS
-- ============================================================================

-- Grant access to authenticated users (RLS will enforce row-level restrictions)
GRANT SELECT ON transfers TO authenticated;
GRANT INSERT ON transfers TO service_role;
GRANT UPDATE ON transfers TO service_role;
GRANT DELETE ON transfers TO service_role;

-- Grant view access
GRANT SELECT ON transfers_summary TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- The transfers table now has:
-- ✓ Proper foreign key relationships with CASCADE delete rules
-- ✓ Auto-updating updated_at timestamp
-- ✓ Comprehensive indexes for common queries
-- ✓ Check constraints for data integrity
-- ✓ Row-level security policies
-- ✓ Helper view for transfer reporting
-- ============================================================================
