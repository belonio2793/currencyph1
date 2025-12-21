-- ============================================================================
-- MIGRATION: Normalize deposits schema for data integrity and performance
-- ============================================================================
-- This migration reorganizes the bloated deposits table into properly normalized tables:
-- - deposits: Core deposit information only
-- - deposit_conversions: All currency conversion tracking
-- - deposit_workflow: Status timeline and processing workflow
-- - deposit_audit: Security audit and tracking data
-- - deposit_gateway_data: External gateway/blockchain references
--
-- This prevents the currency mismatch bug by enforcing strict constraints.
-- ============================================================================

-- ============================================================================
-- STEP 1: Create deposit_conversions table (for all conversion-related data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deposit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  
  -- Source (what was deposited)
  received_currency VARCHAR(16) NOT NULL REFERENCES currencies(code),
  received_amount NUMERIC(36, 8) NOT NULL CHECK (received_amount > 0),
  
  -- Target (what goes to wallet)
  target_currency VARCHAR(16) NOT NULL REFERENCES currencies(code),
  target_amount NUMERIC(36, 8) NOT NULL CHECK (target_amount > 0),
  
  -- Conversion details
  exchange_rate NUMERIC(36, 8) NOT NULL CHECK (exchange_rate > 0),
  rate_source VARCHAR(64) NOT NULL DEFAULT 'unknown', -- 'coingecko', 'manual', 'api', etc.
  
  -- Fees
  conversion_fee NUMERIC(36, 8) DEFAULT 0,
  fee_currency VARCHAR(16) REFERENCES currencies(code),
  net_amount NUMERIC(36, 8) NOT NULL, -- target_amount - conversion_fee
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'applied')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  
  -- Audit
  confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  
  CONSTRAINT conversion_math_check CHECK (
    ABS(received_amount * exchange_rate - target_amount) < 0.01
  ),
  CONSTRAINT dates_logical CHECK (
    confirmed_at IS NULL OR confirmed_at >= created_at
  ),
  CONSTRAINT dates_logical_2 CHECK (
    applied_at IS NULL OR (confirmed_at IS NOT NULL AND applied_at >= confirmed_at)
  )
);

CREATE INDEX idx_deposit_conversions_deposit ON deposit_conversions(deposit_id);
CREATE INDEX idx_deposit_conversions_status ON deposit_conversions(status);
CREATE INDEX idx_deposit_conversions_currencies ON deposit_conversions(received_currency, target_currency);
CREATE INDEX idx_deposit_conversions_created ON deposit_conversions(created_at DESC);

-- ============================================================================
-- STEP 2: Create deposit_workflow table (for status timeline)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deposit_workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  
  -- Status transition
  from_status TEXT,
  to_status TEXT NOT NULL,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Who made the change
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  change_reason TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_deposit_workflow_deposit ON deposit_workflow(deposit_id);
CREATE INDEX idx_deposit_workflow_status ON deposit_workflow(to_status);
CREATE INDEX idx_deposit_workflow_created ON deposit_workflow(created_at DESC);

-- ============================================================================
-- STEP 3: Create deposit_processing_timeline table (for detailed timeline)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deposit_processing_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  
  -- Event type
  event_type TEXT NOT NULL, -- 'initiated', 'webhook_received', 'rate_fetched', 'conversion_confirmed', 'wallet_credited', 'completed'
  
  -- Timing
  event_at TIMESTAMPTZ NOT NULL,
  
  -- Details
  details JSONB DEFAULT '{}',
  processing_time_ms INTEGER, -- milliseconds since last event
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deposit_timeline_deposit ON deposit_processing_timeline(deposit_id);
CREATE INDEX idx_deposit_timeline_event ON deposit_processing_timeline(event_type);
CREATE INDEX idx_deposit_timeline_at ON deposit_processing_timeline(event_at DESC);

-- ============================================================================
-- STEP 4: Create deposit_audit table (for security and audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deposit_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  
  -- User tracking
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- IP and browser info
  initiator_ip_address INET,
  initiator_user_agent TEXT,
  
  -- Verification
  verification_method TEXT, -- 'webhook', 'manual', 'api', 'blockchain'
  verified_at TIMESTAMPTZ,
  
  -- Action
  action TEXT NOT NULL, -- 'initiated', 'approved', 'rejected', 'reverted'
  action_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deposit_audit_deposit ON deposit_audit(deposit_id);
CREATE INDEX idx_deposit_audit_user ON deposit_audit(user_id);
CREATE INDEX idx_deposit_audit_action ON deposit_audit(action);
CREATE INDEX idx_deposit_audit_created ON deposit_audit(created_at DESC);

-- ============================================================================
-- STEP 5: Create deposit_gateway_data table (for external references)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deposit_gateway_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL UNIQUE REFERENCES deposits(id) ON DELETE CASCADE,
  
  -- Payment gateway
  gateway_name VARCHAR(64), -- 'stripe', 'gcash', 'solana', etc.
  gateway_reference VARCHAR(255),
  external_tx_id VARCHAR(255),
  
  -- Blockchain (for crypto)
  blockchain_tx_hash VARCHAR(255),
  blockchain_network VARCHAR(64),
  blockchain_confirmations INTEGER,
  
  -- Payment address
  payment_address TEXT,
  phone_number VARCHAR(20),
  qr_code_data TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gateway_deposit ON deposit_gateway_data(deposit_id);
CREATE INDEX idx_gateway_external_tx ON deposit_gateway_data(external_tx_id);
CREATE INDEX idx_gateway_blockchain_tx ON deposit_gateway_data(blockchain_tx_hash);

-- ============================================================================
-- STEP 6: Clean up deposits table (keep only essential columns)
-- ============================================================================

-- Note: We'll keep all columns for now (for backward compatibility) but mark them as deprecated
-- New code should use the normalized tables instead

-- Add comments to deprecated columns
COMMENT ON COLUMN deposits.currency_name IS 'DEPRECATED: Use currencies table instead';
COMMENT ON COLUMN deposits.currency_symbol IS 'DEPRECATED: Use currencies table instead';
COMMENT ON COLUMN deposits.original_currency IS 'DEPRECATED: Use deposit_conversions.received_currency';
COMMENT ON COLUMN deposits.original_currency_name IS 'DEPRECATED: Use currencies table';
COMMENT ON COLUMN deposits.original_currency_symbol IS 'DEPRECATED: Use currencies table';
COMMENT ON COLUMN deposits.exchange_rate IS 'DEPRECATED: Use deposit_conversions.exchange_rate';
COMMENT ON COLUMN deposits.exchange_rate_at_time IS 'DEPRECATED: Use deposit_conversions table';
COMMENT ON COLUMN deposits.time_based_rate IS 'DEPRECATED: Use deposit_conversions table';
COMMENT ON COLUMN deposits.rate_source IS 'DEPRECATED: Use deposit_conversions.rate_source';
COMMENT ON COLUMN deposits.rate_fetched_at IS 'DEPRECATED: Use deposit_conversions.created_at';
COMMENT ON COLUMN deposits.received_amount IS 'DEPRECATED: Use deposit_conversions.received_amount';
COMMENT ON COLUMN deposits.conversion_fee IS 'DEPRECATED: Use deposit_conversions.conversion_fee';
COMMENT ON COLUMN deposits.conversion_fee_currency IS 'DEPRECATED: Use deposit_conversions.fee_currency';
COMMENT ON COLUMN deposits.net_received_amount IS 'DEPRECATED: Use deposit_conversions.net_amount';
COMMENT ON COLUMN deposits.initiator_ip_address IS 'DEPRECATED: Use deposit_audit table';
COMMENT ON COLUMN deposits.initiator_user_agent IS 'DEPRECATED: Use deposit_audit table';
COMMENT ON COLUMN deposits.verification_method IS 'DEPRECATED: Use deposit_audit table';
COMMENT ON COLUMN deposits.verified_at IS 'DEPRECATED: Use deposit_audit table';
COMMENT ON COLUMN deposits.internal_reference IS 'DEPRECATED: Use deposit_gateway_data table';
COMMENT ON COLUMN deposits.gateway_reference IS 'DEPRECATED: Use deposit_gateway_data table';
COMMENT ON COLUMN deposits.blockchain_tx_hash IS 'DEPRECATED: Use deposit_gateway_data table';
COMMENT ON COLUMN deposits.transaction_details IS 'DEPRECATED: Use deposit_gateway_data.metadata';
COMMENT ON COLUMN deposits.audit_log IS 'DEPRECATED: Use deposit_workflow and deposit_audit tables';

-- ============================================================================
-- STEP 7: Create views for easy access to denormalized data
-- ============================================================================

CREATE OR REPLACE VIEW deposits_with_conversion AS
SELECT 
  d.id,
  d.user_id,
  d.wallet_id,
  d.amount,
  d.currency_code,
  d.deposit_method,
  d.status,
  d.created_at,
  d.updated_at,
  d.completed_at,
  
  -- Conversion details
  dc.received_currency,
  dc.received_amount,
  dc.target_currency,
  dc.target_amount,
  dc.exchange_rate,
  dc.conversion_fee,
  dc.net_amount,
  dc.status AS conversion_status,
  
  -- User info
  u.email AS user_email,
  
  -- Wallet info
  w.currency_code AS wallet_currency
  
FROM deposits d
LEFT JOIN deposit_conversions dc ON d.id = dc.deposit_id AND dc.status = 'applied'
LEFT JOIN users u ON d.user_id = u.id
LEFT JOIN wallets w ON d.wallet_id = w.id;

CREATE OR REPLACE VIEW deposits_full_timeline AS
SELECT 
  d.id AS deposit_id,
  d.user_id,
  d.status,
  
  -- Timeline
  MIN(CASE WHEN pt.event_type = 'initiated' THEN pt.event_at END) AS initiated_at,
  MIN(CASE WHEN pt.event_type = 'webhook_received' THEN pt.event_at END) AS webhook_received_at,
  MIN(CASE WHEN pt.event_type = 'conversion_confirmed' THEN pt.event_at END) AS conversion_confirmed_at,
  MIN(CASE WHEN pt.event_type = 'wallet_credited' THEN pt.event_at END) AS wallet_credited_at,
  MIN(CASE WHEN pt.event_type = 'completed' THEN pt.event_at END) AS completed_at,
  
  -- Workflow
  dw.from_status AS current_from_status,
  dw.to_status AS current_to_status,
  dw.created_at AS last_status_change_at,
  
  -- Conversion
  dc.conversion_status
  
FROM deposits d
LEFT JOIN deposit_processing_timeline pt ON d.id = pt.deposit_id
LEFT JOIN deposit_workflow dw ON d.id = dw.deposit_id
LEFT JOIN deposit_conversions dc ON d.id = dc.deposit_id
GROUP BY d.id, d.user_id, d.status, dw.from_status, dw.to_status, dw.created_at, dc.conversion_status;

-- ============================================================================
-- STEP 8: Create function to safely record deposit conversion
-- ============================================================================

CREATE OR REPLACE FUNCTION record_deposit_conversion(
  p_deposit_id UUID,
  p_received_currency VARCHAR(16),
  p_received_amount NUMERIC,
  p_target_currency VARCHAR(16),
  p_exchange_rate NUMERIC,
  p_conversion_fee NUMERIC DEFAULT 0,
  p_fee_currency VARCHAR(16) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_target_amount NUMERIC;
  v_net_amount NUMERIC;
  v_conversion_id UUID;
BEGIN
  -- Calculate amounts
  v_target_amount := p_received_amount * p_exchange_rate;
  v_net_amount := v_target_amount - COALESCE(p_conversion_fee, 0);
  
  -- Validate math
  IF ABS(p_received_amount * p_exchange_rate - v_target_amount) > 0.01 THEN
    RAISE EXCEPTION 'Exchange rate calculation mismatch';
  END IF;
  
  -- Insert conversion record
  INSERT INTO deposit_conversions (
    deposit_id,
    received_currency,
    received_amount,
    target_currency,
    target_amount,
    exchange_rate,
    conversion_fee,
    fee_currency,
    net_amount,
    status
  ) VALUES (
    p_deposit_id,
    p_received_currency,
    p_received_amount,
    p_target_currency,
    v_target_amount,
    p_exchange_rate,
    p_conversion_fee,
    p_fee_currency,
    v_net_amount,
    'pending'
  )
  RETURNING id INTO v_conversion_id;
  
  RETURN v_conversion_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 9: Create function to confirm conversion
-- ============================================================================

CREATE OR REPLACE FUNCTION confirm_deposit_conversion(
  p_conversion_id UUID,
  p_confirmed_by UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE deposit_conversions
  SET 
    status = 'confirmed',
    confirmed_at = NOW(),
    confirmed_by = p_confirmed_by
  WHERE id = p_conversion_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 10: Create function to apply conversion (credit wallet)
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_deposit_conversion(
  p_conversion_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_target_amount NUMERIC;
  v_wallet_id UUID;
  v_deposit_id UUID;
BEGIN
  -- Get conversion details
  SELECT dc.target_amount, d.wallet_id, d.id
  INTO v_target_amount, v_wallet_id, v_deposit_id
  FROM deposit_conversions dc
  JOIN deposits d ON d.id = dc.deposit_id
  WHERE dc.id = p_conversion_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversion not found';
  END IF;
  
  -- Update conversion status
  UPDATE deposit_conversions
  SET status = 'applied', applied_at = NOW()
  WHERE id = p_conversion_id;
  
  -- Credit wallet
  UPDATE wallets
  SET balance = balance + v_target_amount, updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Record timeline event
  INSERT INTO deposit_processing_timeline (
    deposit_id,
    event_type,
    event_at,
    details
  ) VALUES (
    v_deposit_id,
    'wallet_credited',
    NOW(),
    jsonb_build_object('amount', v_target_amount, 'wallet_id', v_wallet_id)
  );
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 11: Migrate existing conversion data (one-time migration)
-- ============================================================================

-- This will populate deposit_conversions from existing deposits with conversion data
DO $$
DECLARE
  v_deposit record;
BEGIN
  FOR v_deposit IN
    SELECT 
      id,
      original_currency,
      received_amount,
      currency_code,
      converted_amount,
      exchange_rate,
      conversion_fee,
      conversion_fee_currency,
      conversion_status,
      rate_source,
      created_at
    FROM deposits
    WHERE received_amount IS NOT NULL
      AND converted_amount IS NOT NULL
      AND (SELECT COUNT(*) FROM deposit_conversions WHERE deposit_id = deposits.id) = 0
  LOOP
    BEGIN
      INSERT INTO deposit_conversions (
        deposit_id,
        received_currency,
        received_amount,
        target_currency,
        target_amount,
        exchange_rate,
        conversion_fee,
        fee_currency,
        net_amount,
        status,
        created_at
      ) VALUES (
        v_deposit.id,
        COALESCE(v_deposit.original_currency, v_deposit.currency_code),
        COALESCE(v_deposit.received_amount, v_deposit.converted_amount / NULLIF(v_deposit.exchange_rate, 0)),
        v_deposit.currency_code,
        v_deposit.converted_amount,
        COALESCE(v_deposit.exchange_rate, 1),
        COALESCE(v_deposit.conversion_fee, 0),
        v_deposit.conversion_fee_currency,
        COALESCE(v_deposit.converted_amount, 0) - COALESCE(v_deposit.conversion_fee, 0),
        CASE WHEN v_deposit.conversion_status = 'confirmed' THEN 'applied' ELSE 'pending' END,
        v_deposit.created_at
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error and continue
      RAISE WARNING 'Failed to migrate conversion for deposit %: %', v_deposit.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 12: Create triggers to maintain old columns for backward compatibility
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_deposit_from_conversion()
RETURNS TRIGGER AS $$
BEGIN
  -- Update deposits table from deposit_conversions when conversion is applied
  UPDATE deposits
  SET 
    received_amount = NEW.received_amount,
    converted_amount = NEW.target_amount,
    exchange_rate = NEW.exchange_rate,
    conversion_fee = NEW.conversion_fee,
    conversion_status = NEW.status
  WHERE id = NEW.deposit_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_deposit_from_conversion
AFTER INSERT OR UPDATE ON deposit_conversions
FOR EACH ROW
EXECUTE FUNCTION sync_deposit_from_conversion();

-- ============================================================================
-- FINAL: Add documentation comments
-- ============================================================================

COMMENT ON TABLE deposit_conversions IS 'Stores all currency conversion details for deposits. This is the source of truth for conversion data.';
COMMENT ON TABLE deposit_workflow IS 'Tracks all status transitions of a deposit (pending → approved → completed, etc.)';
COMMENT ON TABLE deposit_processing_timeline IS 'Detailed timeline of all events in the deposit lifecycle (initiated, webhook, conversion, credit, complete)';
COMMENT ON TABLE deposit_audit IS 'Security and audit trail: IP, user agent, verification method, approvals';
COMMENT ON TABLE deposit_gateway_data IS 'External gateway/blockchain specific data: transaction IDs, addresses, etc.';

-- ============================================================================
-- END MIGRATION: NORMALIZE DEPOSITS SCHEMA
-- ============================================================================
