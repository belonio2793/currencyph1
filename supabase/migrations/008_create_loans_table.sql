-- ============================================================================
-- LOANS TABLE FOR MULTI-TIERED BORROWING SYSTEM
-- ============================================================================
-- Supports Personal and Business loans with 10% interest rate
-- Tracks loan status: pending, active, completed
-- Integrates with wallet system for payments
-- ============================================================================

-- 1️⃣ LOANS TABLE - Track all loan requests and status
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Loan Details
  loan_type VARCHAR(50) NOT NULL CHECK (loan_type IN ('personal', 'business')),
  requested_amount NUMERIC(36, 8) NOT NULL CHECK (requested_amount > 0),
  interest_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00, -- 10% default
  total_owed NUMERIC(36, 8) NOT NULL, -- requested_amount + (requested_amount * 0.10)
  currency_code VARCHAR(16) NOT NULL REFERENCES currencies(code),
  
  -- Status Tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'rejected', 'defaulted')),
  
  -- User Information (sensitive data stored but can be blurred in UI)
  display_name VARCHAR(255),
  city VARCHAR(255),
  phone_number VARCHAR(20),
  
  -- Payment Details
  amount_paid NUMERIC(36, 8) DEFAULT 0,
  remaining_balance NUMERIC(36, 8),
  last_payment_date TIMESTAMP,
  due_date TIMESTAMP,
  
  -- Payment Method
  payment_method VARCHAR(50), -- 'gcash', 'crypto', 'bank_transfer', 'partner'
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_type ON loans(loan_type);
CREATE INDEX IF NOT EXISTS idx_loans_user_status ON loans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_created ON loans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loans_currency ON loans(currency_code);

-- 2️⃣ LOAN PAYMENTS TABLE - Track individual payments
CREATE TABLE IF NOT EXISTS loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  amount NUMERIC(36, 8) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) NOT NULL, -- 'gcash', 'crypto', 'bank_transfer', 'partner'
  payment_reference VARCHAR(255), -- External payment ID
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_user ON loan_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_status ON loan_payments(status);
CREATE INDEX IF NOT EXISTS idx_loan_payments_created ON loan_payments(created_at DESC);

-- 3️⃣ FUNCTION - Create a new loan request
CREATE OR REPLACE FUNCTION create_loan_request(
  p_user_id UUID,
  p_loan_type VARCHAR,
  p_requested_amount NUMERIC,
  p_currency_code VARCHAR,
  p_display_name VARCHAR DEFAULT NULL,
  p_city VARCHAR DEFAULT NULL,
  p_phone_number VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_loan_id UUID;
  v_total_owed NUMERIC;
  v_interest_rate NUMERIC := 10.00;
BEGIN
  -- Calculate total owed with 10% interest
  v_total_owed := p_requested_amount * (1 + (v_interest_rate / 100));
  
  -- Insert new loan request
  INSERT INTO loans (
    user_id,
    loan_type,
    requested_amount,
    interest_rate,
    total_owed,
    currency_code,
    status,
    display_name,
    city,
    phone_number,
    remaining_balance
  ) VALUES (
    p_user_id,
    p_loan_type,
    p_requested_amount,
    v_interest_rate,
    v_total_owed,
    p_currency_code,
    'pending',
    p_display_name,
    p_city,
    p_phone_number,
    v_total_owed
  )
  RETURNING id INTO v_loan_id;
  
  RETURN v_loan_id;
END;
$$ LANGUAGE plpgsql;

-- 4️⃣ FUNCTION - Process loan payment
CREATE OR REPLACE FUNCTION process_loan_payment(
  p_loan_id UUID,
  p_amount NUMERIC,
  p_payment_method VARCHAR,
  p_payment_reference VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_remaining_balance NUMERIC;
  v_loan_status VARCHAR;
BEGIN
  -- Get current loan status
  SELECT remaining_balance, status INTO v_remaining_balance, v_loan_status
  FROM loans WHERE id = p_loan_id;
  
  IF v_remaining_balance IS NULL THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;
  
  -- Create payment record
  INSERT INTO loan_payments (
    loan_id,
    user_id,
    amount,
    payment_method,
    payment_reference,
    status,
    completed_at
  ) SELECT
    p_loan_id,
    user_id,
    p_amount,
    p_payment_method,
    p_payment_reference,
    'completed',
    NOW()
  FROM loans WHERE id = p_loan_id
  RETURNING id INTO v_payment_id;
  
  -- Update loan remaining balance
  v_remaining_balance := v_remaining_balance - p_amount;
  
  -- Update loan status
  UPDATE loans SET
    amount_paid = COALESCE(amount_paid, 0) + p_amount,
    remaining_balance = v_remaining_balance,
    last_payment_date = NOW(),
    status = CASE 
      WHEN v_remaining_balance <= 0 THEN 'completed'
      WHEN status = 'pending' THEN 'active'
      ELSE status
    END,
    completed_at = CASE 
      WHEN v_remaining_balance <= 0 THEN NOW()
      ELSE completed_at
    END,
    updated_at = NOW()
  WHERE id = p_loan_id;
  
  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql;

-- 5️⃣ VIEW - User loans with payment progress
CREATE OR REPLACE VIEW user_loans_summary AS
SELECT 
  l.id,
  l.user_id,
  l.loan_type,
  l.requested_amount,
  l.total_owed,
  l.amount_paid,
  l.remaining_balance,
  l.currency_code,
  c.symbol,
  l.status,
  l.display_name,
  l.city,
  l.phone_number,
  l.payment_method,
  l.created_at,
  l.updated_at,
  l.approved_at,
  l.completed_at,
  ROUND((l.amount_paid / l.total_owed * 100)::numeric, 2) AS progress_percentage
FROM loans l
JOIN currencies c ON c.code = l.currency_code;

-- 6️⃣ RLS POLICIES - Enable row-level security
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;

-- Users can only view their own loans
CREATE POLICY loans_view_policy ON loans FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own loan requests
CREATE POLICY loans_insert_policy ON loans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only view their own payments
CREATE POLICY loan_payments_view_policy ON loan_payments FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own payments
CREATE POLICY loan_payments_insert_policy ON loan_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);
