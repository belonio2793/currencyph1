-- ============================================================================
-- COMPREHENSIVE DEPOSITS TABLE ENHANCEMENT
-- ============================================================================
-- This migration adds all necessary fields to make the deposits table
-- self-contained with complete transaction details, currency information,
-- and historical rate tracking for full audit trail and display capabilities.

-- ============================================================================
-- ADD CURRENCY INFORMATION COLUMNS
-- ============================================================================

ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS currency_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10);

-- ============================================================================
-- ADD ORIGINAL CURRENCY INFORMATION (what was deposited FROM)
-- ============================================================================

ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS original_currency VARCHAR(16),
ADD COLUMN IF NOT EXISTS original_currency_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS original_currency_symbol VARCHAR(10);

-- ============================================================================
-- ADD EXCHANGE RATE AND CONVERSION TRACKING
-- ============================================================================

ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 8),
ADD COLUMN IF NOT EXISTS exchange_rate_at_time NUMERIC(18, 8),
ADD COLUMN IF NOT EXISTS time_based_rate NUMERIC(18, 8),
ADD COLUMN IF NOT EXISTS rate_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS rate_fetched_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS received_amount NUMERIC(36, 8);

-- ============================================================================
-- ADD CONVERSION DETAILS
-- ============================================================================

ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS conversion_fee NUMERIC(18, 8),
ADD COLUMN IF NOT EXISTS conversion_fee_currency VARCHAR(16),
ADD COLUMN IF NOT EXISTS net_received_amount NUMERIC(36, 8);

-- ============================================================================
-- ADD PROCESSING TRACKING
-- ============================================================================

ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS webhook_received_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS confirmation_received_at TIMESTAMPTZ;

-- ============================================================================
-- ADD SOURCE AND VERIFICATION TRACKING
-- ============================================================================

ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS initiator_ip_address INET,
ADD COLUMN IF NOT EXISTS initiator_user_agent TEXT,
ADD COLUMN IF NOT EXISTS verification_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- ============================================================================
-- ADD REFERENCE AND TRACKING
-- ============================================================================

ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS internal_reference VARCHAR(100),
ADD COLUMN IF NOT EXISTS gateway_reference VARCHAR(255),
ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(255);

-- ============================================================================
-- ADD ENRICHMENT AND METADATA
-- ============================================================================

ALTER TABLE deposits
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS transaction_details JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS error_details JSONB,
ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb;

-- ============================================================================
-- Create indexes for common queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_deposits_time_based_rate 
  ON deposits(rate_fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_deposits_original_currency 
  ON deposits(original_currency);

CREATE INDEX IF NOT EXISTS idx_deposits_processed 
  ON deposits(processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_deposits_blockchain_tx 
  ON deposits(blockchain_tx_hash) 
  WHERE blockchain_tx_hash IS NOT NULL;

-- ============================================================================
-- ENHANCED TRIGGER: Record comprehensive transaction details
-- ============================================================================

CREATE OR REPLACE FUNCTION record_deposit_transaction_details()
RETURNS trigger AS $$
DECLARE
  v_notes JSONB;
  v_exchange_rate NUMERIC;
  v_received_amount NUMERIC;
  v_conversion_fee NUMERIC;
  v_net_received NUMERIC;
  v_original_currency VARCHAR(16);
  v_original_currency_name VARCHAR(100);
  v_original_currency_symbol VARCHAR(10);
  v_currency_name VARCHAR(100);
  v_currency_symbol VARCHAR(10);
BEGIN
  -- Only process when deposit transitions to 'approved' or 'completed'
  IF (NEW.status = 'approved' OR NEW.status = 'completed') 
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Extract metadata from notes JSON
    IF NEW.notes IS NOT NULL THEN
      v_notes := NEW.notes::jsonb;
      
      -- Extract original currency info
      v_original_currency := COALESCE(NEW.original_currency, v_notes->>'original_currency');
      v_original_currency_name := v_notes->>'original_currency_name';
      v_original_currency_symbol := v_notes->>'original_currency_symbol';
      
      -- Get wallet currency info if not already set
      IF NEW.currency_name IS NULL THEN
        SELECT name, symbol INTO v_currency_name, v_currency_symbol
        FROM currencies
        WHERE code = NEW.currency_code
        LIMIT 1;
        NEW.currency_name := v_currency_name;
        NEW.currency_symbol := v_currency_symbol;
      END IF;
      
      -- Extract exchange rate and amounts
      IF v_notes ? 'converted_amount' THEN
        v_received_amount := (v_notes->>'converted_amount')::NUMERIC;
        NEW.received_amount := v_received_amount;
        
        -- Calculate exchange rate
        IF NEW.amount > 0 THEN
          v_exchange_rate := v_received_amount / NEW.amount;
          NEW.exchange_rate := v_exchange_rate;
          NEW.exchange_rate_at_time := v_exchange_rate;
          NEW.time_based_rate := v_exchange_rate;
        END IF;
      END IF;
      
      -- Extract fee if available
      IF v_notes ? 'conversion_fee' THEN
        v_conversion_fee := (v_notes->>'conversion_fee')::NUMERIC;
        NEW.conversion_fee := v_conversion_fee;
        
        IF v_received_amount IS NOT NULL AND v_conversion_fee IS NOT NULL THEN
          v_net_received := v_received_amount - v_conversion_fee;
          NEW.net_received_amount := v_net_received;
        END IF;
      END IF;
      
      -- Set original currency info
      IF v_original_currency IS NOT NULL THEN
        NEW.original_currency := v_original_currency;
        NEW.original_currency_name := COALESCE(v_original_currency_name, v_notes->>'original_currency_name');
        NEW.original_currency_symbol := COALESCE(v_original_currency_symbol, v_notes->>'original_currency_symbol');
      END IF;
      
      -- Record rate fetch timestamp
      IF NEW.rate_fetched_at IS NULL THEN
        NEW.rate_fetched_at := COALESCE(
          (v_notes->>'rate_fetched_at')::TIMESTAMPTZ,
          NOW()
        );
      END IF;
      
      -- Extract rate source
      IF NEW.rate_source IS NULL THEN
        NEW.rate_source := v_notes->>'rate_source';
      END IF;
      
      -- Set processed timestamp
      IF NEW.processed_at IS NULL THEN
        NEW.processed_at := NOW();
      END IF;
      
      -- Build comprehensive transaction details JSON
      NEW.transaction_details := jsonb_build_object(
        'original_amount', NEW.amount,
        'original_currency', NEW.original_currency,
        'original_currency_name', NEW.original_currency_name,
        'original_currency_symbol', NEW.original_currency_symbol,
        'received_amount', v_received_amount,
        'net_received_amount', v_net_received,
        'received_currency', NEW.currency_code,
        'received_currency_name', NEW.currency_name,
        'received_currency_symbol', NEW.currency_symbol,
        'exchange_rate', v_exchange_rate,
        'exchange_rate_at_time', NEW.exchange_rate_at_time,
        'time_based_rate', NEW.time_based_rate,
        'rate_source', NEW.rate_source,
        'rate_fetched_at', NEW.rate_fetched_at::text,
        'conversion_fee', v_conversion_fee,
        'conversion_fee_currency', NEW.conversion_fee_currency,
        'conversion_rate_percentage', CASE 
          WHEN v_exchange_rate IS NOT NULL AND v_exchange_rate > 0 
          THEN ROUND((v_exchange_rate - 1) * 100, 4)
          ELSE NULL 
        END,
        'deposit_method', NEW.deposit_method,
        'deposit_type', v_notes->>'deposit_type',
        'network', v_notes->>'network',
        'verification_method', NEW.verification_method,
        'verified_at', NEW.verified_at::text,
        'transaction_id', NEW.transaction_id::text,
        'external_tx_id', NEW.external_tx_id,
        'gateway_reference', NEW.gateway_reference,
        'blockchain_tx_hash', NEW.blockchain_tx_hash,
        'reference_number', COALESCE(NEW.reference_number, NEW.phone_number),
        'internal_reference', NEW.internal_reference,
        'created_at', NEW.created_at::text,
        'processed_at', NEW.processed_at::text,
        'webhook_received_at', NEW.webhook_received_at::text,
        'confirmation_received_at', NEW.confirmation_received_at::text,
        'approved_at', CASE 
          WHEN NEW.status = 'approved' THEN NOW()::text 
          ELSE NULL 
        END,
        'completed_at', NEW.completed_at::text,
        'status', NEW.status,
        'processing_time_ms', NEW.processing_time_ms,
        'initiator_ip_address', NEW.initiator_ip_address::text,
        'initiator_user_agent', NEW.initiator_user_agent
      );
      
      -- Add audit log entry
      NEW.audit_log := jsonb_set(
        COALESCE(NEW.audit_log, '[]'::jsonb),
        ARRAY[(jsonb_array_length(COALESCE(NEW.audit_log, '[]'::jsonb)))::text],
        jsonb_build_object(
          'timestamp', NOW()::text,
          'event', 'status_transition_to_' || NEW.status,
          'previous_status', OLD.status,
          'new_status', NEW.status,
          'exchange_rate_used', v_exchange_rate,
          'received_amount', v_received_amount
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_record_deposit_transaction_details ON deposits;

CREATE TRIGGER trg_record_deposit_transaction_details
BEFORE UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION record_deposit_transaction_details();

-- ============================================================================
-- ENHANCED WALLET CREDITING TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION credit_wallet_on_deposit_approval()
RETURNS trigger AS $$
DECLARE
  v_wallet_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_received_amount NUMERIC;
  v_processing_time INTEGER;
BEGIN
  -- Process transitions to 'approved' or 'completed' status
  IF (NEW.status = 'approved' OR NEW.status = 'completed') 
     AND OLD.status IS DISTINCT FROM NEW.status 
     AND OLD.status NOT IN ('approved', 'completed') THEN
    
    BEGIN
      -- Use received_amount if available, otherwise use amount
      v_received_amount := COALESCE(NEW.received_amount, NEW.amount);
      
      -- Calculate processing time if not already set
      IF NEW.processing_time_ms IS NULL THEN
        v_processing_time := EXTRACT(EPOCH FROM (NOW() - NEW.created_at))::INTEGER * 1000;
        NEW.processing_time_ms := v_processing_time;
      END IF;
      
      -- Lock wallet row to prevent race conditions
      SELECT balance INTO v_wallet_balance
      FROM wallets
      WHERE id = NEW.wallet_id
        AND user_id = NEW.user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user % and wallet %', NEW.user_id, NEW.wallet_id;
      END IF;

      -- Calculate new balance
      v_new_balance := COALESCE(v_wallet_balance, 0) + v_received_amount;

      -- Update wallet balance atomically
      UPDATE wallets
      SET 
        balance = v_new_balance,
        updated_at = NOW()
      WHERE id = NEW.wallet_id
        AND user_id = NEW.user_id;

      -- Record transaction in wallet_transactions ledger
      BEGIN
        INSERT INTO wallet_transactions (
          user_id,
          wallet_id,
          transaction_type,
          amount,
          currency_code,
          reference_id,
          reference_type,
          description,
          balance_after,
          status,
          created_at
        ) VALUES (
          NEW.user_id,
          NEW.wallet_id,
          'deposit',
          v_received_amount,
          NEW.currency_code,
          NEW.id,
          'deposit',
          COALESCE(
            NEW.description,
            'Deposit from ' || NEW.deposit_method || 
            CASE WHEN NEW.original_currency IS NOT NULL 
              THEN ' (' || NEW.original_currency || ' → ' || NEW.currency_code || ')'
              ELSE ''
            END
          ),
          v_new_balance,
          'completed',
          NOW()
        ) RETURNING id INTO v_transaction_id;

        -- Update deposit with transaction record
        NEW.transaction_id = v_transaction_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to record wallet transaction: %', SQLERRM;
      END;

      -- Set completed timestamp if not already set
      IF NEW.completed_at IS NULL THEN
        NEW.completed_at = NOW();
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Error crediting wallet for deposit: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_credit_wallet_on_approved ON deposits;

CREATE TRIGGER trg_credit_wallet_on_approved
BEFORE UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION credit_wallet_on_deposit_approval();

-- ============================================================================
-- ENHANCED VIEW: Deposits with all details
-- ============================================================================

DROP VIEW IF EXISTS deposits_with_details CASCADE;

CREATE VIEW deposits_with_details AS
SELECT 
  -- Core identification
  d.id,
  d.user_id,
  d.wallet_id,
  
  -- Amount information
  d.amount,
  d.original_currency,
  d.original_currency_name,
  d.original_currency_symbol,
  
  -- Received amount information
  d.received_amount,
  d.net_received_amount,
  d.conversion_fee,
  d.conversion_fee_currency,
  
  -- Wallet/target information
  d.currency_code,
  d.currency_name,
  d.currency_symbol,
  
  -- Exchange rate information
  d.exchange_rate,
  d.exchange_rate_at_time,
  d.time_based_rate,
  d.rate_source,
  d.rate_fetched_at,
  
  -- Method and references
  d.deposit_method,
  d.reference_number,
  d.internal_reference,
  d.gateway_reference,
  d.blockchain_tx_hash,
  d.phone_number,
  
  -- Status and timestamps
  d.status,
  d.created_at,
  d.processed_at,
  d.processed_at,
  d.webhook_received_at,
  d.confirmation_received_at,
  d.verified_at,
  d.completed_at,
  d.processing_time_ms,
  
  -- Wallet information (joined)
  w.currency_code as wallet_currency_code,
  w.balance as wallet_balance,
  w.account_number,
  
  -- User information (for admin views)
  u.email as user_email,
  
  -- Comprehensive metadata
  d.transaction_details,
  d.metadata,
  d.audit_log,
  d.notes,
  d.description
FROM deposits d
JOIN wallets w ON d.wallet_id = w.id
LEFT JOIN users u ON d.user_id = u.id
ORDER BY d.created_at DESC;

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION record_deposit_transaction_details TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION credit_wallet_on_deposit_approval TO authenticated, service_role;
GRANT SELECT ON deposits_with_details TO authenticated;

-- ============================================================================
-- Update comment for clarity
-- ============================================================================

COMMENT ON TABLE deposits IS 
'Comprehensive deposits table with full transaction tracking, currency information,
and historical rate data. All necessary fields for audit trail and complete display.

Key fields:
- amount, original_currency: What was originally deposited
- received_amount, net_received_amount, currency_code: What was received in wallet
- exchange_rate, time_based_rate: Historical rate information at time of deposit
- processing_time_ms: How long the deposit took to process
- transaction_details: Comprehensive JSONB record of all transaction data
- audit_log: History of all status transitions and changes';

-- ============================================================================
-- END COMPREHENSIVE DEPOSITS ENHANCEMENT MIGRATION
-- ============================================================================
