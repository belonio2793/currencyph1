-- Migration: Create Unified Debts Table
-- Purpose: Consolidate all debt types (loans, mortgages, credit cards, insurance, etc.)
--          into a single source of truth with proper audit trails
-- Status: READY FOR APPLICATION
-- Date: 2024

-- ========================================
-- 1. CREATE MAIN DEBTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.debts (
  -- Identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Debt Classification
  debt_type VARCHAR(50) NOT NULL,
    -- Valid types: 'personal_loan', 'business_loan', 'mortgage', 'credit_card',
    --             'auto_loan', 'student_loan', 'insurance', 'installment', 'p2p_loan'
  
  -- Creditor/Provider Information
  provider_type VARCHAR(50) NOT NULL,
    -- 'bank', 'platform', 'insurer', 'credit_card_company', 'peer', 'government'
  provider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- For peer-to-peer debts, references lender; for institutional, may be NULL
  provider_name VARCHAR(255),
    -- 'BDO', 'Cimb', etc.
  
  -- Financial Terms
  original_principal NUMERIC(36,8) NOT NULL CHECK (original_principal > 0),
  interest_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    -- Annual interest percentage
  interest_type VARCHAR(50) DEFAULT 'simple',
    -- 'simple', 'compound'
  total_owed NUMERIC(36,8) NOT NULL,
    -- Principal + accrued interest
  amount_paid NUMERIC(36,8) NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC(36,8) NOT NULL,
  currency_code VARCHAR(16) NOT NULL REFERENCES public.currencies(code),
  
  -- Critical Dates
  origination_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  original_due_date TIMESTAMPTZ NOT NULL,
  last_payment_date TIMESTAMPTZ,
  next_payment_due TIMESTAMPTZ,
  
  -- Status & Delinquency
  status VARCHAR(50) NOT NULL DEFAULT 'active',
    -- 'pending', 'active', 'delinquent', 'paid_off', 'defaulted', 'charged_off', 'refinanced'
  days_past_due INT DEFAULT 0,
  
  -- Payment Terms
  repayment_schedule VARCHAR(50),
    -- 'lump_sum', 'monthly', 'weekly', 'bi-weekly'
  payment_frequency INT,
    -- Number of payments
  payment_method VARCHAR(50),
    -- 'bank_transfer', 'gcash', 'crypto', 'check'
  
  -- Platform Fees (for marketplace debts)
  platform_fee_applied BOOLEAN DEFAULT FALSE,
  platform_fee_amount NUMERIC(36,8) DEFAULT 0,
  
  -- Flexible Metadata for Debt-Type-Specific Fields
  metadata JSONB DEFAULT '{}',
    -- Examples:
    -- Personal Loan: { purpose: 'emergency', coSigners: [...], term: 12 }
    -- Mortgage: { propertyAddress, loanToValue, amortizationPeriod }
    -- Credit Card: { creditLimit, statementDueDate, minimumPayment }
    -- Insurance: { policyNumber, coverageAmount, deductible }
  
  -- Reconciliation & Integration
  reconciliation_metadata JSONB DEFAULT '{}',
    -- External system IDs, sync timestamps, validation flags
  
  -- Audit Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT outstanding_balance_non_negative CHECK (outstanding_balance >= 0),
  CONSTRAINT amount_paid_non_negative CHECK (amount_paid >= 0),
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'active', 'delinquent', 'paid_off', 'defaulted', 'charged_off', 'refinanced'
  )),
  CONSTRAINT valid_debt_type CHECK (debt_type IN (
    'personal_loan', 'business_loan', 'mortgage', 'credit_card', 'auto_loan',
    'student_loan', 'insurance', 'installment', 'p2p_loan'
  )),
  CONSTRAINT valid_provider_type CHECK (provider_type IN (
    'bank', 'platform', 'insurer', 'credit_card_company', 'peer', 'government'
  ))
);

-- Create indexes for optimal query performance
CREATE INDEX idx_debts_user ON public.debts(user_id);
CREATE INDEX idx_debts_status ON public.debts(status);
CREATE INDEX idx_debts_type ON public.debts(debt_type);
CREATE INDEX idx_debts_provider ON public.debts(provider_id);
CREATE INDEX idx_debts_currency ON public.debts(currency_code);
CREATE INDEX idx_debts_user_status ON public.debts(user_id, status);
CREATE INDEX idx_debts_user_type ON public.debts(user_id, debt_type);
CREATE INDEX idx_debts_due_date ON public.debts(due_date);
CREATE INDEX idx_debts_created ON public.debts(created_at DESC);
CREATE INDEX idx_debts_updated ON public.debts(updated_at DESC);

-- Enable RLS
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY debts_user_select ON public.debts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY debts_user_insert ON public.debts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY debts_user_update ON public.debts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY debts_user_delete ON public.debts
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can read all (admin dashboards)
CREATE POLICY debts_service_read ON public.debts
  FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

-- Service role can write for automated processes
CREATE POLICY debts_service_write ON public.debts
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ========================================
-- 2. CREATE DEBT PAYMENTS TABLE (AUDIT TRAIL)
-- ========================================
CREATE TABLE IF NOT EXISTS public.debt_payments (
  -- Identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Payment Breakdown
  amount NUMERIC(36,8) NOT NULL CHECK (amount > 0),
  principal_paid NUMERIC(36,8) NOT NULL DEFAULT 0,
  interest_paid NUMERIC(36,8) NOT NULL DEFAULT 0,
  fees_paid NUMERIC(36,8) NOT NULL DEFAULT 0,
  
  -- Payment Method & Reference
  payment_method VARCHAR(50) NOT NULL,
    -- 'bank_transfer', 'gcash', 'crypto', 'check', 'auto_debit'
  payment_reference VARCHAR(255),
    -- External payment ID for reconciliation (bank ref, GCash reference, etc.)
  
  -- Link to Wallet Ledger (for unified audit trail)
  wallet_tx_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
    -- CRITICAL: Links this debt payment to corresponding wallet transaction
    -- This ensures one audit trail across domain (debt_payments) and ledger (wallet_transactions)
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'completed',
    -- 'pending', 'completed', 'failed', 'cancelled', 'reversed'
  
  -- Flexible Metadata
  metadata JSONB DEFAULT '{}',
    -- { receiptUrl, notes, automatedPayment, scheduleId, retryCount }
  
  -- Audit Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Validation: amount must equal sum of component payments
  CONSTRAINT payment_breakdown_valid CHECK (
    amount = principal_paid + interest_paid + fees_paid
  )
);

-- Create indexes
CREATE INDEX idx_debt_payments_debt ON public.debt_payments(debt_id);
CREATE INDEX idx_debt_payments_user ON public.debt_payments(user_id);
CREATE INDEX idx_debt_payments_status ON public.debt_payments(status);
CREATE INDEX idx_debt_payments_wallet_tx ON public.debt_payments(wallet_tx_id);
CREATE INDEX idx_debt_payments_created ON public.debt_payments(created_at DESC);
CREATE INDEX idx_debt_payments_method ON public.debt_payments(payment_method);

-- Enable RLS
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY debt_payments_user_select ON public.debt_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY debt_payments_user_insert ON public.debt_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY debt_payments_service_all ON public.debt_payments
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ========================================
-- 3. CREATE DEBT PAYMENT SCHEDULES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.debt_payment_schedules (
  -- Identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  
  -- Schedule Details
  payment_number INT NOT NULL,
    -- 1st, 2nd, 3rd payment, etc.
  due_date TIMESTAMPTZ NOT NULL,
  amount_due NUMERIC(36,8) NOT NULL,
  principal_due NUMERIC(36,8) NOT NULL,
  interest_due NUMERIC(36,8) NOT NULL,
  
  -- Status & Fulfillment
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- 'pending', 'paid', 'delinquent', 'skipped'
  actual_payment_date TIMESTAMPTZ,
  
  -- Link to Actual Payment
  debt_payment_id UUID REFERENCES public.debt_payments(id) ON DELETE SET NULL,
  
  -- Audit Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One payment number per debt
  UNIQUE(debt_id, payment_number)
);

-- Create indexes
CREATE INDEX idx_debt_schedules_debt ON public.debt_payment_schedules(debt_id);
CREATE INDEX idx_debt_schedules_due_date ON public.debt_payment_schedules(due_date);
CREATE INDEX idx_debt_schedules_status ON public.debt_payment_schedules(status);

-- ========================================
-- 4. HELPER FUNCTION: PROCESS DEBT PAYMENT (ATOMIC)
-- ========================================
CREATE OR REPLACE FUNCTION process_debt_payment(
  p_debt_id UUID,
  p_user_id UUID,
  p_amount NUMERIC,
  p_principal_paid NUMERIC DEFAULT 0,
  p_interest_paid NUMERIC DEFAULT 0,
  p_fees_paid NUMERIC DEFAULT 0,
  p_payment_method VARCHAR DEFAULT 'bank_transfer',
  p_payment_reference VARCHAR DEFAULT NULL,
  p_description TEXT DEFAULT 'Debt payment'
) RETURNS TABLE (
  debt_payment_id UUID,
  debt_updated BOOLEAN,
  remaining_balance NUMERIC,
  debt_status VARCHAR
) AS $$
DECLARE
  v_debt RECORD;
  v_debt_payment_id UUID;
  v_new_balance NUMERIC;
  v_new_status VARCHAR;
BEGIN
  -- Lock debt row to prevent concurrent updates
  SELECT * INTO v_debt FROM public.debts WHERE id = p_debt_id FOR UPDATE;
  
  IF v_debt IS NULL THEN
    RAISE EXCEPTION 'Debt not found: %', p_debt_id;
  END IF;
  
  IF v_debt.user_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: debt does not belong to user';
  END IF;
  
  -- Validate payment amounts
  IF p_amount != (p_principal_paid + p_interest_paid + p_fees_paid) THEN
    RAISE EXCEPTION 'Payment breakdown does not match total amount';
  END IF;
  
  -- Insert debt payment record
  INSERT INTO public.debt_payments (
    debt_id, user_id, amount, principal_paid, interest_paid, fees_paid,
    payment_method, payment_reference, status, completed_at
  ) VALUES (
    p_debt_id, p_user_id, p_amount, p_principal_paid, p_interest_paid, p_fees_paid,
    p_payment_method, p_payment_reference, 'completed', NOW()
  ) RETURNING debt_payments.id INTO v_debt_payment_id;
  
  -- Calculate new balance
  v_new_balance := v_debt.outstanding_balance - p_amount;
  
  -- Determine new status
  v_new_status := CASE 
    WHEN v_new_balance <= 0 THEN 'paid_off'
    WHEN v_debt.days_past_due > 0 THEN 'active'  -- Clear delinquent status on payment
    ELSE v_debt.status
  END;
  
  -- Update debt record atomically
  UPDATE public.debts
  SET
    amount_paid = amount_paid + p_amount,
    outstanding_balance = GREATEST(v_new_balance, 0),  -- Never go negative
    last_payment_date = NOW(),
    days_past_due = 0,
    status = v_new_status,
    updated_at = NOW()
  WHERE id = p_debt_id;
  
  -- Return results
  RETURN QUERY SELECT
    v_debt_payment_id,
    TRUE,
    GREATEST(v_new_balance, 0),
    v_new_status::VARCHAR;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 5. HELPER FUNCTION: GET TOTAL DEBT BY USER
-- ========================================
CREATE OR REPLACE FUNCTION get_user_total_debt(
  p_user_id UUID,
  p_currency_code VARCHAR DEFAULT 'PHP'
) RETURNS TABLE (
  total_outstanding NUMERIC,
  active_debt_count INT,
  delinquent_count INT,
  paid_off_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(outstanding_balance), 0)::NUMERIC,
    COUNT(*) FILTER (WHERE status = 'active')::INT,
    COUNT(*) FILTER (WHERE status = 'delinquent')::INT,
    COUNT(*) FILTER (WHERE status = 'paid_off')::INT
  FROM public.debts
  WHERE user_id = p_user_id AND currency_code = p_currency_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 6. TRIGGER: Auto-update debts.updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_debts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW
  EXECUTE FUNCTION update_debts_timestamp();

-- ========================================
-- 7. COMMENTS (FOR DOCUMENTATION)
-- ========================================
COMMENT ON TABLE public.debts IS 'Unified debt table consolidating all debt types (loans, mortgages, credit cards, insurance, etc.) with single source of truth and audit trail';

COMMENT ON TABLE public.debt_payments IS 'Audit trail for all debt payments, linked to wallet_transactions for complete ledger reconciliation';

COMMENT ON TABLE public.debt_payment_schedules IS 'Amortization schedules for installment-based debts, tracks scheduled vs actual payments';

COMMENT ON COLUMN public.debts.debt_type IS 'Type of debt: personal_loan, business_loan, mortgage, credit_card, auto_loan, student_loan, insurance, installment, p2p_loan';

COMMENT ON COLUMN public.debts.provider_type IS 'Type of creditor: bank, platform, insurer, credit_card_company, peer, government';

COMMENT ON COLUMN public.debts.metadata IS 'JSONB field for debt-type-specific data (purpose, property details, policy number, etc.)';

COMMENT ON COLUMN public.debt_payments.wallet_tx_id IS 'CRITICAL: Foreign key to wallet_transactions for unified audit trail across domain and ledger layers';

-- ========================================
-- 8. GRANTS (If needed for service role)
-- ========================================
-- Service role needs explicit grants for automation
GRANT SELECT, INSERT, UPDATE ON public.debts TO service_role;
GRANT SELECT, INSERT ON public.debt_payments TO service_role;
GRANT EXECUTE ON FUNCTION process_debt_payment TO service_role;
GRANT EXECUTE ON FUNCTION get_user_total_debt TO service_role;
