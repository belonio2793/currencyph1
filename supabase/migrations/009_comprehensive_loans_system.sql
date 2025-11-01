-- ============================================================================
-- COMPREHENSIVE LOANS MANAGEMENT SYSTEM
-- ============================================================================
-- Supports: Personal Loans, Business Loans, Partner Loans
-- Features: Interest accrual, Payment schedules, Collateral, Documents
-- Status: pending → approved → active → completed/defaulted
-- ============================================================================

-- ============================================================================
-- 1️⃣ MAIN LOANS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Loan Identification
  reference_number VARCHAR(50) UNIQUE NOT NULL,
  loan_type VARCHAR(50) NOT NULL CHECK (loan_type IN ('personal', 'business', 'partner')),
  
  -- Loan Amount & Currency
  requested_amount NUMERIC(36, 8) NOT NULL CHECK (requested_amount > 0),
  approved_amount NUMERIC(36, 8),
  disbursed_amount NUMERIC(36, 8) DEFAULT 0,
  currency_code VARCHAR(16) NOT NULL REFERENCES currencies(code),
  
  -- Interest & Calculations
  interest_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
  interest_type VARCHAR(50) DEFAULT 'fixed' CHECK (interest_type IN ('fixed', 'variable')),
  total_interest NUMERIC(36, 8) DEFAULT 0,
  total_owed NUMERIC(36, 8) NOT NULL,
  
  -- Loan Terms
  loan_term_months INTEGER DEFAULT 12,
  monthly_payment NUMERIC(36, 8),
  payment_frequency VARCHAR(50) DEFAULT 'monthly' CHECK (payment_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
  
  -- Payment Tracking
  amount_paid NUMERIC(36, 8) DEFAULT 0,
  amount_due NUMERIC(36, 8),
  remaining_balance NUMERIC(36, 8),
  total_payments_made INTEGER DEFAULT 0,
  total_payments_missed INTEGER DEFAULT 0,
  late_fees_accrued NUMERIC(36, 8) DEFAULT 0,
  
  -- Status & Dates
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'active', 'completed', 'rejected', 'defaulted', 'cancelled'
  )),
  start_date TIMESTAMP,
  due_date TIMESTAMP,
  last_payment_date TIMESTAMP,
  next_payment_due TIMESTAMP,
  completion_date TIMESTAMP,
  
  -- Borrower Information (optional, for privacy)
  display_name VARCHAR(255),
  email VARCHAR(255),
  phone_number VARCHAR(20),
  city VARCHAR(255),
  country VARCHAR(255),
  
  -- Purpose & Additional Details
  loan_purpose TEXT,
  business_name VARCHAR(255), -- For business loans
  business_type VARCHAR(255), -- For business loans
  
  -- Payment Method & Partner
  primary_payment_method VARCHAR(50), -- 'gcash', 'crypto', 'bank_transfer', 'partner'
  partner_id UUID REFERENCES partners(id),
  
  -- Risk & Assessment
  credit_score INTEGER,
  risk_level VARCHAR(50) CHECK (risk_level IN ('low', 'medium', 'high')),
  collateral_required BOOLEAN DEFAULT false,
  
  -- Approval & Management
  approved_by UUID REFERENCES auth.users(id),
  approval_notes TEXT,
  approved_date TIMESTAMP,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT approved_amount_not_exceeded 
    CHECK (approved_amount IS NULL OR approved_amount <= requested_amount),
  CONSTRAINT disbursed_not_exceeded 
    CHECK (disbursed_amount IS NULL OR disbursed_amount <= COALESCE(approved_amount, 0))
);

-- Indexes
CREATE INDEX idx_loans_user_id ON loans(user_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_type ON loans(loan_type);
CREATE INDEX idx_loans_user_status ON loans(user_id, status);
CREATE INDEX idx_loans_created_at ON loans(created_at DESC);
CREATE INDEX idx_loans_currency_code ON loans(currency_code);
CREATE INDEX idx_loans_due_date ON loans(due_date);
CREATE INDEX idx_loans_reference ON loans(reference_number);

-- ============================================================================
-- 2️⃣ PAYMENT SCHEDULES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  
  payment_number INTEGER NOT NULL,
  scheduled_date TIMESTAMP NOT NULL,
  due_date TIMESTAMP NOT NULL,
  grace_period_days INTEGER DEFAULT 15,
  grace_period_end TIMESTAMP,
  
  principal_amount NUMERIC(36, 8) NOT NULL,
  interest_amount NUMERIC(36, 8) NOT NULL,
  total_due NUMERIC(36, 8) NOT NULL,
  
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'paid', 'partially_paid', 'overdue', 'skipped', 'waived'
  )),
  
  amount_paid NUMERIC(36, 8) DEFAULT 0,
  paid_date TIMESTAMP,
  late_fee NUMERIC(36, 8) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT payment_number_unique PER LOAN UNIQUE (loan_id, payment_number),
  CONSTRAINT valid_amounts CHECK (principal_amount > 0 AND interest_amount >= 0)
);

CREATE INDEX idx_loan_schedules_loan_id ON loan_payment_schedules(loan_id);
CREATE INDEX idx_loan_schedules_status ON loan_payment_schedules(status);
CREATE INDEX idx_loan_schedules_due_date ON loan_payment_schedules(due_date);

-- ============================================================================
-- 3️⃣ LOAN PAYMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES loan_payment_schedules(id),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Payment Details
  payment_type VARCHAR(50) DEFAULT 'regular' CHECK (payment_type IN (
    'regular', 'early', 'lump_sum', 'partial', 'catch_up'
  )),
  amount NUMERIC(36, 8) NOT NULL CHECK (amount > 0),
  principal_paid NUMERIC(36, 8),
  interest_paid NUMERIC(36, 8),
  late_fees_paid NUMERIC(36, 8) DEFAULT 0,
  
  -- Payment Processing
  payment_method VARCHAR(50) NOT NULL,
  payment_reference VARCHAR(255),
  transaction_id VARCHAR(255),
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed'
  )),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMP,
  failed_reason TEXT
);

CREATE INDEX idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX idx_loan_payments_user_id ON loan_payments(user_id);
CREATE INDEX idx_loan_payments_status ON loan_payments(status);
CREATE INDEX idx_loan_payments_created_at ON loan_payments(created_at DESC);

-- ============================================================================
-- 4️⃣ LOAN DOCUMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  document_type VARCHAR(100) NOT NULL CHECK (document_type IN (
    'id_verification', 'proof_of_income', 'bank_statement', 'tax_return',
    'business_license', 'employment_letter', 'utility_bill', 'credit_report',
    'collateral_appraisal', 'personal_statement', 'guarantor_document', 'other'
  )),
  
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  storage_bucket VARCHAR(255) DEFAULT 'loan-documents',
  
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES auth.users(id),
  verified_date TIMESTAMP,
  verification_notes TEXT,
  
  expiry_date TIMESTAMP,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loan_docs_loan_id ON loan_documents(loan_id);
CREATE INDEX idx_loan_docs_user_id ON loan_documents(user_id);
CREATE INDEX idx_loan_docs_type ON loan_documents(document_type);
CREATE INDEX idx_loan_docs_verified ON loan_documents(verified);

-- ============================================================================
-- 5️⃣ COLLATERAL TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_collateral (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  
  collateral_type VARCHAR(100) NOT NULL CHECK (collateral_type IN (
    'property', 'vehicle', 'jewelry', 'equipment', 'inventory', 'crypto', 'other'
  )),
  
  description TEXT NOT NULL,
  estimated_value NUMERIC(36, 8) NOT NULL CHECK (estimated_value > 0),
  valuation_date TIMESTAMP,
  appraised_value NUMERIC(36, 8),
  appraised_by VARCHAR(255),
  appraised_date TIMESTAMP,
  
  lien_percentage NUMERIC(5, 2) DEFAULT 100.0,
  location VARCHAR(255),
  
  status VARCHAR(50) DEFAULT 'pledged' CHECK (status IN (
    'pledged', 'held', 'released', 'sold', 'forfeited'
  )),
  
  release_condition TEXT,
  released_date TIMESTAMP,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_collateral_loan_id ON loan_collateral(loan_id);
CREATE INDEX idx_collateral_type ON loan_collateral(collateral_type);
CREATE INDEX idx_collateral_status ON loan_collateral(status);

-- ============================================================================
-- 6️⃣ INTEREST ACCRUAL TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_interest_accrual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  
  accrual_date DATE NOT NULL,
  daily_rate NUMERIC(10, 8) NOT NULL,
  days_in_month INTEGER,
  principal_balance NUMERIC(36, 8) NOT NULL,
  accrued_amount NUMERIC(36, 8) NOT NULL CHECK (accrued_amount >= 0),
  
  accrual_type VARCHAR(50) DEFAULT 'daily' CHECK (accrual_type IN ('daily', 'monthly')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(loan_id, accrual_date)
);

CREATE INDEX idx_accrual_loan_id ON loan_interest_accrual(loan_id);
CREATE INDEX idx_accrual_date ON loan_interest_accrual(accrual_date DESC);

-- ============================================================================
-- 7️⃣ LOAN STATUS HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  status_reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_status_history_loan_id ON loan_status_history(loan_id);
CREATE INDEX idx_status_history_created_at ON loan_status_history(created_at DESC);

-- ============================================================================
-- 8️⃣ LOAN DEFAULTS & RECOVERY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  
  days_overdue INTEGER NOT NULL,
  amount_overdue NUMERIC(36, 8) NOT NULL,
  default_date TIMESTAMP NOT NULL,
  
  recovery_status VARCHAR(50) DEFAULT 'active' CHECK (recovery_status IN (
    'active', 'under_negotiation', 'payment_plan', 'legal_action', 'settled', 'written_off'
  )),
  
  settlement_amount NUMERIC(36, 8),
  settlement_date TIMESTAMP,
  
  assigned_to UUID REFERENCES auth.users(id),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(loan_id)
);

CREATE INDEX idx_defaults_loan_id ON loan_defaults(loan_id);
CREATE INDEX idx_defaults_status ON loan_defaults(recovery_status);

-- ============================================================================
-- 9️⃣ LOAN DISBURSEMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  
  disbursement_number INTEGER NOT NULL,
  requested_amount NUMERIC(36, 8) NOT NULL,
  approved_amount NUMERIC(36, 8),
  actual_amount NUMERIC(36, 8),
  
  disbursal_method VARCHAR(50) NOT NULL CHECK (disbursal_method IN (
    'bank_transfer', 'check', 'direct_deposit', 'crypto_wallet', 'partner_transfer'
  )),
  
  bank_account_id UUID REFERENCES public.wallets_fiat(id),
  wallet_address VARCHAR(255),
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'processing', 'completed', 'failed', 'cancelled'
  )),
  
  requested_date TIMESTAMP DEFAULT NOW(),
  approved_date TIMESTAMP,
  actual_disbursal_date TIMESTAMP,
  
  approval_notes TEXT,
  failure_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disbursements_loan_id ON loan_disbursements(loan_id);
CREATE INDEX idx_disbursements_status ON loan_disbursements(status);

-- ============================================================================
-- 🔟 LOAN PARTNERS TABLE (for partner loans)
-- ============================================================================
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  partner_name VARCHAR(255) NOT NULL UNIQUE,
  partner_type VARCHAR(100) NOT NULL,
  
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone_number VARCHAR(20),
  website VARCHAR(255),
  address TEXT,
  
  commission_rate NUMERIC(5, 2) DEFAULT 0,
  commission_type VARCHAR(50) CHECK (commission_type IN ('percentage', 'flat')),
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partners_active ON partners(is_active);

-- ============================================================================
-- 1️⃣1️⃣ VIEWS FOR EASY DATA ACCESS
-- ============================================================================

-- Active loans summary with progress
CREATE OR REPLACE VIEW v_active_loans AS
SELECT 
  l.id,
  l.user_id,
  l.reference_number,
  l.loan_type,
  l.requested_amount,
  l.approved_amount,
  l.disbursed_amount,
  l.total_owed,
  l.amount_paid,
  l.remaining_balance,
  l.currency_code,
  c.symbol as currency_symbol,
  l.status,
  l.start_date,
  l.due_date,
  l.last_payment_date,
  l.next_payment_due,
  ROUND((l.amount_paid / NULLIF(l.total_owed, 0) * 100)::numeric, 2) as progress_percentage,
  ROUND(CAST(l.amount_paid AS NUMERIC), 2) as paid_formatted,
  ROUND(CAST(l.remaining_balance AS NUMERIC), 2) as remaining_formatted,
  ROUND(CAST(l.total_owed AS NUMERIC), 2) as total_formatted,
  l.interest_rate,
  l.monthly_payment,
  l.total_payments_made,
  l.total_payments_missed,
  EXTRACT(DAY FROM (l.due_date - NOW())) as days_until_due,
  l.created_at
FROM loans l
JOIN currencies c ON c.code = l.currency_code
WHERE l.status IN ('active', 'pending', 'approved');

-- Overdue payments summary
CREATE OR REPLACE VIEW v_overdue_payments AS
SELECT 
  l.id,
  l.user_id,
  l.reference_number,
  lps.payment_number,
  lps.due_date,
  lps.total_due,
  lps.amount_paid,
  (lps.total_due - COALESCE(lps.amount_paid, 0)) as amount_overdue,
  EXTRACT(DAY FROM (NOW() - lps.due_date)) as days_overdue,
  lps.status,
  l.late_fees_accrued,
  l.currency_code,
  c.symbol as currency_symbol
FROM loans l
JOIN currencies c ON c.code = l.currency_code
JOIN loan_payment_schedules lps ON lps.loan_id = l.id
WHERE lps.status IN ('overdue', 'partially_paid')
AND lps.due_date < NOW();

-- User loan portfolio summary
CREATE OR REPLACE VIEW v_user_loan_portfolio AS
SELECT 
  l.user_id,
  COUNT(*) as total_loans,
  COUNT(*) FILTER (WHERE l.status = 'active') as active_loans,
  COUNT(*) FILTER (WHERE l.status = 'pending') as pending_loans,
  COUNT(*) FILTER (WHERE l.status = 'completed') as completed_loans,
  SUM(CASE WHEN l.status IN ('active', 'pending') THEN l.total_owed ELSE 0 END) as total_debt,
  SUM(CASE WHEN l.status IN ('active', 'pending') THEN l.remaining_balance ELSE 0 END) as remaining_debt,
  SUM(CASE WHEN l.status IN ('active', 'pending') THEN l.amount_paid ELSE 0 END) as total_paid,
  COUNT(*) FILTER (WHERE ld.id IS NOT NULL) as defaulted_loans,
  MAX(l.created_at) as most_recent_loan_date
FROM loans l
LEFT JOIN loan_defaults ld ON ld.loan_id = l.id
GROUP BY l.user_id;

-- ============================================================================
-- 1️⃣2️⃣ ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_collateral ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_interest_accrual ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_disbursements ENABLE ROW LEVEL SECURITY;

-- Loans: Users can only view their own loans
CREATE POLICY loans_select_policy ON loans FOR SELECT
  USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY loans_insert_policy ON loans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY loans_update_policy ON loans FOR UPDATE
  USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

-- Payment Schedules: Users can view their own loan schedules
CREATE POLICY schedules_select_policy ON loan_payment_schedules FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM loans l WHERE l.id = loan_payment_schedules.loan_id AND l.user_id = auth.uid())
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- Loan Payments: Users can view and insert their own payments
CREATE POLICY payments_select_policy ON loan_payments FOR SELECT
  USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY payments_insert_policy ON loan_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Documents: Users can view and insert their own documents
CREATE POLICY documents_select_policy ON loan_documents FOR SELECT
  USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY documents_insert_policy ON loan_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Collateral: Users can view their own collateral
CREATE POLICY collateral_select_policy ON loan_collateral FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM loans l WHERE l.id = loan_collateral.loan_id AND l.user_id = auth.uid())
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- ============================================================================
-- 1️⃣3️⃣ FUNCTIONS
-- ============================================================================

-- Generate unique reference number for loans
CREATE OR REPLACE FUNCTION generate_loan_reference()
RETURNS VARCHAR AS $$
DECLARE
  v_reference VARCHAR;
BEGIN
  v_reference := 'LOAN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                 LPAD(NEXTVAL('loan_reference_seq')::text, 6, '0');
  RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for loan reference numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS loan_reference_seq START 1;

-- Calculate monthly payment
CREATE OR REPLACE FUNCTION calculate_monthly_payment(
  p_principal NUMERIC,
  p_annual_rate NUMERIC,
  p_months INTEGER
) RETURNS NUMERIC AS $$
DECLARE
  v_monthly_rate NUMERIC;
  v_payment NUMERIC;
BEGIN
  IF p_months = 0 OR p_annual_rate = 0 THEN
    RETURN p_principal;
  END IF;
  
  v_monthly_rate := p_annual_rate / 100 / 12;
  v_payment := p_principal * (v_monthly_rate * POWER(1 + v_monthly_rate, p_months)) / 
               (POWER(1 + v_monthly_rate, p_months) - 1);
  
  RETURN ROUND(v_payment, 2);
END;
$$ LANGUAGE plpgsql;

-- Create a new loan request
CREATE OR REPLACE FUNCTION create_loan_request(
  p_user_id UUID,
  p_loan_type VARCHAR,
  p_requested_amount NUMERIC,
  p_currency_code VARCHAR,
  p_loan_term_months INTEGER DEFAULT 12,
  p_interest_rate NUMERIC DEFAULT 10.00,
  p_display_name VARCHAR DEFAULT NULL,
  p_email VARCHAR DEFAULT NULL,
  p_phone_number VARCHAR DEFAULT NULL,
  p_loan_purpose TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_loan_id UUID;
  v_reference VARCHAR;
  v_total_interest NUMERIC;
  v_total_owed NUMERIC;
  v_monthly_payment NUMERIC;
BEGIN
  -- Generate reference number
  v_reference := generate_loan_reference();
  
  -- Calculate total interest and owed amount
  v_total_interest := p_requested_amount * (p_interest_rate / 100);
  v_total_owed := p_requested_amount + v_total_interest;
  
  -- Calculate monthly payment
  v_monthly_payment := calculate_monthly_payment(p_requested_amount, p_interest_rate, p_loan_term_months);
  
  -- Insert new loan
  INSERT INTO loans (
    user_id,
    reference_number,
    loan_type,
    requested_amount,
    currency_code,
    interest_rate,
    total_interest,
    total_owed,
    loan_term_months,
    monthly_payment,
    amount_due,
    remaining_balance,
    status,
    display_name,
    email,
    phone_number,
    loan_purpose,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    v_reference,
    p_loan_type,
    p_requested_amount,
    p_currency_code,
    p_interest_rate,
    v_total_interest,
    v_total_owed,
    p_loan_term_months,
    v_monthly_payment,
    v_total_owed,
    v_total_owed,
    'pending',
    p_display_name,
    p_email,
    p_phone_number,
    p_loan_purpose,
    NOW(),
    NOW()
  ) RETURNING id INTO v_loan_id;
  
  RETURN v_loan_id;
END;
$$ LANGUAGE plpgsql;

-- Process loan payment with schedule updates
CREATE OR REPLACE FUNCTION process_loan_payment(
  p_loan_id UUID,
  p_amount NUMERIC,
  p_payment_method VARCHAR,
  p_payment_reference VARCHAR DEFAULT NULL,
  p_payment_type VARCHAR DEFAULT 'regular'
) RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_remaining_balance NUMERIC;
  v_loan_status VARCHAR;
  v_principal_paid NUMERIC;
  v_interest_paid NUMERIC;
  v_schedule_id UUID;
BEGIN
  -- Get loan details
  SELECT remaining_balance, status INTO v_remaining_balance, v_loan_status
  FROM loans WHERE id = p_loan_id;
  
  IF v_remaining_balance IS NULL THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;
  
  -- Find applicable payment schedule
  SELECT id INTO v_schedule_id
  FROM loan_payment_schedules
  WHERE loan_id = p_loan_id
    AND status IN ('scheduled', 'overdue', 'partially_paid')
  ORDER BY scheduled_date ASC
  LIMIT 1;
  
  -- Allocate payment: interest first, then principal
  SELECT interest_amount INTO v_interest_paid
  FROM loan_payment_schedules
  WHERE id = v_schedule_id;
  
  v_interest_paid := LEAST(v_interest_paid, p_amount);
  v_principal_paid := p_amount - v_interest_paid;
  
  -- Create payment record
  INSERT INTO loan_payments (
    loan_id,
    schedule_id,
    user_id,
    payment_type,
    amount,
    principal_paid,
    interest_paid,
    payment_method,
    payment_reference,
    status,
    completed_at
  ) VALUES (
    p_loan_id,
    v_schedule_id,
    (SELECT user_id FROM loans WHERE id = p_loan_id),
    p_payment_type,
    p_amount,
    v_principal_paid,
    v_interest_paid,
    p_payment_method,
    p_payment_reference,
    'completed',
    NOW()
  ) RETURNING id INTO v_payment_id;
  
  -- Update payment schedule if exists
  IF v_schedule_id IS NOT NULL THEN
    UPDATE loan_payment_schedules SET
      amount_paid = COALESCE(amount_paid, 0) + p_amount,
      status = CASE 
        WHEN COALESCE(amount_paid, 0) + p_amount >= total_due THEN 'paid'
        WHEN COALESCE(amount_paid, 0) + p_amount > 0 THEN 'partially_paid'
        ELSE status
      END,
      paid_date = CASE
        WHEN COALESCE(amount_paid, 0) + p_amount >= total_due THEN NOW()
        ELSE paid_date
      END,
      updated_at = NOW()
    WHERE id = v_schedule_id;
  END IF;
  
  -- Update loan record
  v_remaining_balance := v_remaining_balance - p_amount;
  
  UPDATE loans SET
    amount_paid = COALESCE(amount_paid, 0) + p_amount,
    remaining_balance = GREATEST(v_remaining_balance, 0),
    amount_due = GREATEST(v_remaining_balance, 0),
    last_payment_date = NOW(),
    total_payments_made = total_payments_made + 1,
    next_payment_due = CASE
      WHEN v_schedule_id IS NOT NULL 
      THEN (SELECT due_date FROM loan_payment_schedules WHERE id = v_schedule_id) + INTERVAL '1 month'
      ELSE next_payment_due
    END,
    status = CASE 
      WHEN v_remaining_balance <= 0 THEN 'completed'
      WHEN v_loan_status = 'pending' THEN 'active'
      ELSE v_loan_status
    END,
    completion_date = CASE 
      WHEN v_remaining_balance <= 0 THEN NOW()
      ELSE completion_date
    END,
    updated_at = NOW()
  WHERE id = p_loan_id;
  
  -- Log status change if loan became active
  IF v_loan_status = 'pending' THEN
    INSERT INTO loan_status_history (loan_id, previous_status, new_status, status_reason, changed_by, created_at)
    VALUES (p_loan_id, 'pending', 'active', 'First payment received', NULL, NOW());
  END IF;
  
  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql;

-- Generate payment schedule
CREATE OR REPLACE FUNCTION generate_payment_schedule(
  p_loan_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_loan_record RECORD;
  v_principal_per_payment NUMERIC;
  v_interest_per_payment NUMERIC;
  v_remaining_principal NUMERIC;
  v_scheduled_date TIMESTAMP;
  v_schedule_count INTEGER := 0;
  i INTEGER;
BEGIN
  -- Get loan details
  SELECT id, approved_amount, interest_rate, loan_term_months, monthly_payment, start_date
  INTO v_loan_record
  FROM loans
  WHERE id = p_loan_id
  AND status IN ('approved', 'active');
  
  IF v_loan_record.id IS NULL THEN
    RAISE EXCEPTION 'Loan not found or not in approved/active status';
  END IF;
  
  -- Delete existing schedules
  DELETE FROM loan_payment_schedules WHERE loan_id = p_loan_id;
  
  v_remaining_principal := v_loan_record.approved_amount;
  v_scheduled_date := COALESCE(v_loan_record.start_date, NOW());
  
  -- Generate payment schedule
  FOR i IN 1..v_loan_record.loan_term_months LOOP
    v_interest_per_payment := v_remaining_principal * (v_loan_record.interest_rate / 100 / 12);
    v_principal_per_payment := v_loan_record.monthly_payment - v_interest_per_payment;
    
    IF i = v_loan_record.loan_term_months THEN
      -- Final payment covers remaining principal
      v_principal_per_payment := v_remaining_principal;
    END IF;
    
    INSERT INTO loan_payment_schedules (
      loan_id,
      payment_number,
      scheduled_date,
      due_date,
      principal_amount,
      interest_amount,
      total_due,
      status,
      grace_period_end,
      created_at
    ) VALUES (
      p_loan_id,
      i,
      v_scheduled_date,
      v_scheduled_date,
      v_principal_per_payment,
      v_interest_per_payment,
      v_principal_per_payment + v_interest_per_payment,
      'scheduled',
      v_scheduled_date + INTERVAL '15 days',
      NOW()
    );
    
    v_remaining_principal := GREATEST(0, v_remaining_principal - v_principal_per_payment);
    v_scheduled_date := v_scheduled_date + INTERVAL '1 month';
    v_schedule_count := v_schedule_count + 1;
  END LOOP;
  
  RETURN v_schedule_count;
END;
$$ LANGUAGE plpgsql;
