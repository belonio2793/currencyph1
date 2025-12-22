-- ============================================================================
-- MIGRATION: FIX BENEFICIARIES TABLE & ENHANCE TRANSFER SYSTEM
-- ============================================================================
-- Version: 0135
-- Purpose:
--   1. Add missing 'recipient_id' column to beneficiaries table
--   2. Add proper foreign key to auth.users
--   3. Ensure wallet_transactions is enriched with required columns
--   4. Create atomic transfer function with fee handling and wallets_house syndication
--   5. Add transfer ledger table for cross-wallet/cross-currency transfers
-- ============================================================================

-- ============================================================================
-- PART 1: FIX BENEFICIARIES TABLE
-- ============================================================================

-- Add recipient_id column if it doesn't exist
ALTER TABLE IF EXISTS public.beneficiaries
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add other missing columns if they don't exist
ALTER TABLE IF EXISTS public.beneficiaries
  ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS relationship VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

-- Backfill recipient_id from recipient_email (optional - only if data exists)
DO $$
BEGIN
  UPDATE public.beneficiaries b
  SET recipient_id = (
    SELECT id FROM auth.users u 
    WHERE u.email = b.recipient_email 
    LIMIT 1
  )
  WHERE b.recipient_id IS NULL 
    AND b.recipient_email IS NOT NULL;
END $$;

-- Create index on recipient_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_beneficiaries_recipient_id ON public.beneficiaries(recipient_id);

-- ============================================================================
-- PART 2: ENHANCE WALLET_TRANSACTIONS TABLE
-- ============================================================================

-- Ensure all required columns exist
ALTER TABLE IF EXISTS public.wallet_transactions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(16),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS fee NUMERIC(36, 8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_amount NUMERIC(36, 8),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50); -- Alias for 'type' for consistency

-- Backfill user_id from wallets relationship if not already set
UPDATE public.wallet_transactions wt
SET user_id = w.user_id
FROM public.wallets w
WHERE wt.wallet_id = w.id AND wt.user_id IS NULL;

-- Backfill currency_code from wallets relationship if not already set
UPDATE public.wallet_transactions wt
SET currency_code = w.currency_code
FROM public.wallets w
WHERE wt.wallet_id = w.id AND wt.currency_code IS NULL;

-- Create comprehensive indexes
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created 
  ON public.wallet_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_currency 
  ON public.wallet_transactions(user_id, currency_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status 
  ON public.wallet_transactions(status, created_at DESC);

-- ============================================================================
-- PART 3: ENSURE WALLETS_HOUSE TABLE EXISTS (PLATFORM TREASURY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallets_house (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network TEXT NOT NULL, -- 'php_fiat', 'usd_fiat', 'solana', 'ethereum', etc.
  currency_code VARCHAR(16) NOT NULL REFERENCES public.currencies(code),
  address TEXT, -- Wallet address for crypto networks
  balance NUMERIC(36, 8) DEFAULT 0,
  total_received NUMERIC(36, 8) DEFAULT 0,
  total_sent NUMERIC(36, 8) DEFAULT 0,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (currency_code, network)
);

CREATE INDEX IF NOT EXISTS idx_wallets_house_currency ON public.wallets_house(currency_code);
CREATE INDEX IF NOT EXISTS idx_wallets_house_network ON public.wallets_house(network);

-- ============================================================================
-- PART 4: CREATE TRANSFER_LEDGER TABLE (Enhanced transfers with full audit)
-- ============================================================================

CREATE TABLE IF NOT EXISTS transfer_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Sender details
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  from_currency VARCHAR(16) NOT NULL REFERENCES public.currencies(code),
  from_amount NUMERIC(36, 8) NOT NULL CHECK (from_amount > 0),
  
  -- Recipient details
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  to_currency VARCHAR(16) NOT NULL REFERENCES public.currencies(code),
  to_amount NUMERIC(36, 8) NOT NULL CHECK (to_amount > 0),
  
  -- Exchange & Fees
  exchange_rate NUMERIC(18, 8) DEFAULT 1.0 CHECK (exchange_rate > 0),
  fee_amount NUMERIC(36, 8) DEFAULT 0 CHECK (fee_amount >= 0),
  fee_percentage NUMERIC(5, 2) DEFAULT 1.0 CHECK (fee_percentage >= 0),
  
  -- House synication (platform treasury)
  house_wallet_id UUID REFERENCES public.wallets_house(id) ON DELETE SET NULL,
  fee_credited_to_house BOOLEAN DEFAULT false,
  
  -- Status & Tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reversed')),
  reference_number VARCHAR(50) UNIQUE,
  description TEXT,
  
  -- Ledger entries created during processing
  sender_debit_tx_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  sender_fee_tx_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  recipient_credit_tx_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  house_credit_tx_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  
  -- Metadata & Audit
  metadata JSONB DEFAULT '{}'::JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_transfer_ledger_from_user ON public.transfer_ledger(from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_ledger_to_user ON public.transfer_ledger(to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_ledger_status ON public.transfer_ledger(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_ledger_ref ON public.transfer_ledger(reference_number);
CREATE INDEX IF NOT EXISTS idx_transfer_ledger_created ON public.transfer_ledger(created_at DESC);

-- ============================================================================
-- PART 5: TRIGGER TO AUTO-POPULATE user_id IN wallet_transactions
-- ============================================================================

DROP TRIGGER IF EXISTS populate_wallet_tx_user_trigger ON public.wallet_transactions;

CREATE OR REPLACE FUNCTION populate_wallet_transaction_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id FROM public.wallets WHERE id = NEW.wallet_id;
  END IF;
  
  IF NEW.currency_code IS NULL THEN
    SELECT currency_code INTO NEW.currency_code FROM public.wallets WHERE id = NEW.wallet_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER populate_wallet_tx_user_trigger
BEFORE INSERT ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION populate_wallet_transaction_user();

-- ============================================================================
-- PART 6: ATOMIC TRANSFER FUNCTION WITH FEE & HOUSE SYNDICATION
-- ============================================================================
-- This function handles:
-- 1. Debit sender wallet (transfer amount + fee)
-- 2. Credit recipient wallet (converted amount)
-- 3. Syndicate fee to platform house wallet
-- 4. Record all transactions atomically
-- ============================================================================

CREATE OR REPLACE FUNCTION execute_transfer_atomic(
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_from_wallet_id UUID,
  p_to_wallet_id UUID,
  p_from_currency VARCHAR,
  p_to_currency VARCHAR,
  p_from_amount NUMERIC,
  p_exchange_rate NUMERIC DEFAULT 1.0,
  p_fee_percentage NUMERIC DEFAULT 1.0,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE(
  success BOOLEAN,
  transfer_id UUID,
  reference_number VARCHAR,
  sender_new_balance NUMERIC,
  recipient_new_balance NUMERIC,
  fee_amount NUMERIC,
  error_message TEXT
) AS $$
DECLARE
  v_transfer_id UUID;
  v_reference_number VARCHAR;
  v_sender_wallet RECORD;
  v_recipient_wallet RECORD;
  v_house_wallet RECORD;
  v_fee_amount NUMERIC;
  v_total_debit NUMERIC;
  v_to_amount NUMERIC;
  v_sender_debit_tx UUID;
  v_sender_fee_tx UUID;
  v_recipient_credit_tx UUID;
  v_house_credit_tx UUID;
BEGIN
  -- Validate inputs
  IF p_from_user_id IS NULL OR p_to_user_id IS NULL 
     OR p_from_wallet_id IS NULL OR p_to_wallet_id IS NULL
     OR p_from_amount IS NULL OR p_from_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 
      'Invalid parameters'::TEXT;
    RETURN;
  END IF;

  -- Generate reference number
  v_reference_number := 'TRN-' || to_char(NOW(), 'YYYYMMDD-HH24MISS') || '-' || floor(random() * 9000 + 1000)::TEXT;

  -- Lock and fetch sender wallet
  SELECT * INTO v_sender_wallet FROM public.wallets 
  WHERE id = p_from_wallet_id AND user_id = p_from_user_id FOR UPDATE;
  
  IF v_sender_wallet IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, v_reference_number, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
      'Sender wallet not found'::TEXT;
    RETURN;
  END IF;

  -- Calculate amounts
  v_fee_amount := p_from_amount * (p_fee_percentage / 100.0);
  v_total_debit := p_from_amount + v_fee_amount;
  v_to_amount := p_from_amount * COALESCE(p_exchange_rate, 1.0);

  -- Check sender balance
  IF v_sender_wallet.balance < v_total_debit THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, v_reference_number, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
      'Insufficient balance. Required: ' || v_total_debit || ', Available: ' || v_sender_wallet.balance;
    RETURN;
  END IF;

  -- Lock and fetch recipient wallet
  SELECT * INTO v_recipient_wallet FROM public.wallets 
  WHERE id = p_to_wallet_id AND user_id = p_to_user_id FOR UPDATE;
  
  IF v_recipient_wallet IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, v_reference_number, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
      'Recipient wallet not found'::TEXT;
    RETURN;
  END IF;

  -- Get or create platform house wallet for fee syndication
  SELECT * INTO v_house_wallet FROM public.wallets_house 
  WHERE currency_code = p_from_currency FOR UPDATE;
  
  IF v_house_wallet IS NULL THEN
    INSERT INTO public.wallets_house (currency_code, network, balance, total_received)
    VALUES (p_from_currency, 'platform-' || p_from_currency, 0, 0)
    RETURNING * INTO v_house_wallet;
  END IF;

  BEGIN
    -- 1. Debit sender wallet (transfer amount)
    UPDATE public.wallets
    SET balance = balance - p_from_amount,
        total_withdrawn = total_withdrawn + p_from_amount,
        updated_at = NOW()
    WHERE id = p_from_wallet_id;

    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, type, amount, currency_code,
      balance_before, balance_after, description, status, metadata, created_at
    ) VALUES (
      p_from_wallet_id, p_from_user_id, 'transfer_out', p_from_amount, p_from_currency,
      v_sender_wallet.balance, v_sender_wallet.balance - p_from_amount,
      COALESCE(p_description, 'Transfer to ' || (SELECT email FROM auth.users WHERE id = p_to_user_id)),
      'completed', p_metadata || jsonb_build_object('reference_number', v_reference_number), NOW()
    ) RETURNING id INTO v_sender_debit_tx;

    -- 2. Debit sender wallet (fee)
    UPDATE public.wallets
    SET balance = balance - v_fee_amount,
        total_withdrawn = total_withdrawn + v_fee_amount,
        updated_at = NOW()
    WHERE id = p_from_wallet_id;

    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, type, amount, currency_code,
      balance_before, balance_after, description, status, metadata, created_at
    ) VALUES (
      p_from_wallet_id, p_from_user_id, 'rake', v_fee_amount, p_from_currency,
      v_sender_wallet.balance - p_from_amount, v_sender_wallet.balance - v_total_debit,
      'Transfer fee (' || p_fee_percentage || '%)',
      'completed', p_metadata || jsonb_build_object('reference_number', v_reference_number, 'fee_percentage', p_fee_percentage), NOW()
    ) RETURNING id INTO v_sender_fee_tx;

    -- 3. Credit recipient wallet
    UPDATE public.wallets
    SET balance = balance + v_to_amount,
        total_deposited = total_deposited + v_to_amount,
        updated_at = NOW()
    WHERE id = p_to_wallet_id;

    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, type, amount, currency_code,
      balance_before, balance_after, description, status, metadata, exchange_rate, created_at
    ) VALUES (
      p_to_wallet_id, p_to_user_id, 'transfer_in', v_to_amount, p_to_currency,
      v_recipient_wallet.balance, v_recipient_wallet.balance + v_to_amount,
      'Received from ' || (SELECT email FROM auth.users WHERE id = p_from_user_id),
      'completed', p_metadata || jsonb_build_object('reference_number', v_reference_number, 'exchange_rate', p_exchange_rate), 
      p_exchange_rate, NOW()
    ) RETURNING id INTO v_recipient_credit_tx;

    -- 4. Syndicate fee to platform house wallet
    UPDATE public.wallets_house
    SET balance = balance + v_fee_amount,
        total_received = total_received + v_fee_amount,
        updated_at = NOW()
    WHERE id = v_house_wallet.id;

    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, type, amount, currency_code,
      balance_before, balance_after, description, status, metadata, created_at
    ) VALUES (
      NULL, p_from_user_id, 'rake', v_fee_amount, p_from_currency,
      v_house_wallet.balance, v_house_wallet.balance + v_fee_amount,
      'Platform fee (syndication)',
      'completed', jsonb_build_object('reference_number', v_reference_number, 'house_wallet_id', v_house_wallet.id), NOW()
    ) RETURNING id INTO v_house_credit_tx;

    -- 5. Record transfer in transfer_ledger
    INSERT INTO public.transfer_ledger (
      from_user_id, from_wallet_id, from_currency, from_amount,
      to_user_id, to_wallet_id, to_currency, to_amount,
      exchange_rate, fee_amount, fee_percentage,
      house_wallet_id, fee_credited_to_house,
      status, reference_number, description, metadata,
      sender_debit_tx_id, sender_fee_tx_id, recipient_credit_tx_id, house_credit_tx_id
    ) VALUES (
      p_from_user_id, p_from_wallet_id, p_from_currency, p_from_amount,
      p_to_user_id, p_to_wallet_id, p_to_currency, v_to_amount,
      p_exchange_rate, v_fee_amount, p_fee_percentage,
      v_house_wallet.id, true,
      'completed', v_reference_number, p_description, p_metadata,
      v_sender_debit_tx, v_sender_fee_tx, v_recipient_credit_tx, v_house_credit_tx
    ) RETURNING id INTO v_transfer_id;

    -- Return success
    RETURN QUERY SELECT 
      TRUE,
      v_transfer_id,
      v_reference_number,
      v_sender_wallet.balance - v_total_debit,
      v_recipient_wallet.balance + v_to_amount,
      v_fee_amount,
      NULL::TEXT;

  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      FALSE, 
      NULL::UUID,
      v_reference_number,
      NULL::NUMERIC,
      NULL::NUMERIC,
      NULL::NUMERIC,
      'Error: ' || SQLERRM;
  END;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION execute_transfer_atomic TO authenticated, service_role;

-- ============================================================================
-- PART 7: RLS POLICIES FOR NEW TABLES
-- ============================================================================

ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS beneficiaries_select ON public.beneficiaries;
DROP POLICY IF EXISTS beneficiaries_insert ON public.beneficiaries;
DROP POLICY IF EXISTS beneficiaries_update ON public.beneficiaries;
DROP POLICY IF EXISTS beneficiaries_delete ON public.beneficiaries;

CREATE POLICY beneficiaries_select ON public.beneficiaries
  FOR SELECT USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY beneficiaries_insert ON public.beneficiaries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY beneficiaries_update ON public.beneficiaries
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY beneficiaries_delete ON public.beneficiaries
  FOR DELETE USING (user_id = auth.uid());

-- RLS for transfer_ledger
ALTER TABLE public.transfer_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transfer_ledger_select ON public.transfer_ledger;

CREATE POLICY transfer_ledger_select ON public.transfer_ledger
  FOR SELECT USING (
    from_user_id = auth.uid() OR to_user_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role'
  );

-- ============================================================================
-- PART 8: VERIFICATION QUERIES
-- ============================================================================

/*
After migration, run these to verify:

-- Check beneficiaries has recipient_id:
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'beneficiaries' AND column_name = 'recipient_id';

-- Check wallet_transactions has required columns:
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'wallet_transactions' AND column_name IN ('user_id', 'currency_code', 'metadata', 'fee')
ORDER BY column_name;

-- Check wallets_house exists:
SELECT COUNT(*) FROM pg_tables WHERE tablename = 'wallets_house';

-- Check transfer_ledger exists:
SELECT COUNT(*) FROM pg_tables WHERE tablename = 'transfer_ledger';

-- Test atomic transfer function:
-- SELECT execute_transfer_atomic(
--   'user-uuid-1'::UUID,
--   'user-uuid-2'::UUID,
--   'wallet-uuid-1'::UUID,
--   'wallet-uuid-2'::UUID,
--   'PHP',
--   'USD',
--   1000.00,
--   50.25,
--   1.0
-- );
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
