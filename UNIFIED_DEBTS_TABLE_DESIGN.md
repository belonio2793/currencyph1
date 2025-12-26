# Unified Debts Table Architecture

## Problem Statement
Currently, the system uses `public.loans` table which handles only personal and business loans. This creates silos when trying to add mortgages, credit cards, insurance, and other debt types. We need a single source of truth for all debts with proper audit trails, similar to how `wallets` and `wallet_transactions` work.

## Design Philosophy
- **Single Source of Truth**: One `debts` table for all debt types
- **Audit Trail**: `debt_payments` table tracks all payment history (like `wallet_transactions`)
- **Flexible Metadata**: JSONB columns for debt-type-specific data
- **Strong Audit**: Link `debt_payments` to `wallet_transactions` via `wallet_tx_id` for complete ledger reconciliation
- **RLS Enforcement**: Users see only their own debts and payments
- **Backward Compatibility**: Maintain views mapping old `loans` queries to new `debts` table during transition

## Table Schema

### 1. `public.debts` (Master Debt Record)
```sql
CREATE TABLE debts (
  -- Identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debt_type VARCHAR(50) NOT NULL,
    -- Valid types: 'personal_loan', 'business_loan', 'mortgage', 'credit_card',
    --             'auto_loan', 'student_loan', 'insurance', 'installment', 'p2p_loan'
  
  -- Creditor/Provider Information
  provider_type VARCHAR(50) NOT NULL,
    -- 'bank', 'platform', 'insurer', 'credit_card_company', 'peer', 'government'
  provider_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    -- For peer-to-peer debts, lender_id; for institutional, may be NULL or provider UUID
  provider_name VARCHAR(255),  -- 'BDO', 'Cimb', etc. or peer name
  
  -- Financial Terms
  original_principal NUMERIC(36,8) NOT NULL CHECK (original_principal > 0),
  interest_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,  -- Annual interest %
  interest_type VARCHAR(50) DEFAULT 'simple',  -- 'simple', 'compound'
  total_owed NUMERIC(36,8) NOT NULL,  -- Principal + accrued interest
  amount_paid NUMERIC(36,8) NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC(36,8) NOT NULL,
  currency_code VARCHAR(16) NOT NULL REFERENCES public.currencies(code),
  
  -- Dates & Scheduling
  origination_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  original_due_date TIMESTAMPTZ NOT NULL,
  last_payment_date TIMESTAMPTZ,
  next_payment_due TIMESTAMPTZ,
  
  -- Status & Health
  status VARCHAR(50) NOT NULL DEFAULT 'active',
    -- 'pending', 'active', 'delinquent', 'paid_off', 'defaulted', 'charged_off', 'refinanced'
  days_past_due INT DEFAULT 0,
  
  -- Payment Terms (Structured)
  repayment_schedule VARCHAR(50),  -- 'lump_sum', 'monthly', 'weekly', 'bi-weekly'
  payment_frequency INT,  -- Number of payments
  payment_method VARCHAR(50),  -- 'bank_transfer', 'gcash', 'crypto', 'check'
  
  -- Platform Fees
  platform_fee_applied BOOLEAN DEFAULT FALSE,
  platform_fee_amount NUMERIC(36,8) DEFAULT 0,
  
  -- Flexible Metadata (debt-type specific)
  metadata JSONB DEFAULT '{}',
    -- Examples:
    -- Personal Loan: { purpose, loanTerm, coSigners }
    -- Mortgage: { propertyAddress, propertyValue, loanToValue, amortizationPeriod }
    -- Credit Card: { creditLimit, statementDueDate, minPayment, lastStatementBalance }
    -- Insurance: { policyNumber, coverageAmount, deductible }
    -- Student Loan: { schoolName, graduationDate, defermentEligible }
  
  -- Reconciliation & Audit
  reconciliation_metadata JSONB DEFAULT '{}',
    -- External system IDs, sync timestamps, validation flags
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT outstanding_balance_valid CHECK (outstanding_balance >= 0),
  CONSTRAINT amount_paid_not_negative CHECK (amount_paid >= 0),
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'active', 'delinquent', 'paid_off', 'defaulted', 'charged_off', 'refinanced'
  )),
  CONSTRAINT valid_debt_type CHECK (debt_type IN (
    'personal_loan', 'business_loan', 'mortgage', 'credit_card', 'auto_loan',
    'student_loan', 'insurance', 'installment', 'p2p_loan'
  ))
);

-- Indexes for common queries
CREATE INDEX idx_debts_user ON debts(user_id);
CREATE INDEX idx_debts_status ON debts(status);
CREATE INDEX idx_debts_type ON debts(debt_type);
CREATE INDEX idx_debts_provider ON debts(provider_id);
CREATE INDEX idx_debts_currency ON debts(currency_code);
CREATE INDEX idx_debts_user_status ON debts(user_id, status);
CREATE INDEX idx_debts_due_date ON debts(due_date);
CREATE INDEX idx_debts_created ON debts(created_at DESC);
CREATE INDEX idx_debts_updated ON debts(updated_at DESC);

-- RLS Policies
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY debts_user_select ON debts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY debts_user_insert ON debts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY debts_user_update ON debts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY debts_user_delete ON debts
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can read all (for admin dashboards)
CREATE POLICY debts_service_read ON debts
  FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');
```

### 2. `public.debt_payments` (Audit Trail)
```sql
CREATE TABLE debt_payments (
  -- Identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Payment Amount & Type
  amount NUMERIC(36,8) NOT NULL CHECK (amount > 0),
  principal_paid NUMERIC(36,8) NOT NULL DEFAULT 0,
  interest_paid NUMERIC(36,8) NOT NULL DEFAULT 0,
  fees_paid NUMERIC(36,8) NOT NULL DEFAULT 0,
  
  -- Payment Method
  payment_method VARCHAR(50) NOT NULL,  -- 'bank_transfer', 'gcash', 'crypto', etc.
  payment_reference VARCHAR(255),  -- External payment ID (for reconciliation)
  
  -- Ledger Link (for single audit trail)
  wallet_tx_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
    -- Links this debt payment to the corresponding wallet transaction
    -- This ensures one audit trail across domain (debt_payments) and ledger (wallet_transactions)
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'completed',
    -- 'pending', 'completed', 'failed', 'cancelled', 'reversed'
  
  -- Flexible Metadata
  metadata JSONB DEFAULT '{}',
    -- Examples: { receiptUrl, notes, automatedPayment: true, scheduledPaymentId: 'uuid' }
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT amount_equals_principal_interest CHECK (amount = principal_paid + interest_paid + fees_paid)
);

-- Indexes
CREATE INDEX idx_debt_payments_debt ON debt_payments(debt_id);
CREATE INDEX idx_debt_payments_user ON debt_payments(user_id);
CREATE INDEX idx_debt_payments_status ON debt_payments(status);
CREATE INDEX idx_debt_payments_wallet_tx ON debt_payments(wallet_tx_id);
CREATE INDEX idx_debt_payments_created ON debt_payments(created_at DESC);

-- RLS Policies
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY debt_payments_user_select ON debt_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY debt_payments_user_insert ON debt_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY debt_payments_service_all ON debt_payments
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
```

### 3. `public.debt_payment_schedules` (Amortization)
```sql
CREATE TABLE debt_payment_schedules (
  -- Identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  
  -- Schedule Info
  payment_number INT NOT NULL,  -- 1st, 2nd, 3rd payment
  due_date TIMESTAMPTZ NOT NULL,
  amount_due NUMERIC(36,8) NOT NULL,
  principal_due NUMERIC(36,8) NOT NULL,
  interest_due NUMERIC(36,8) NOT NULL,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending', 'paid', 'delinquent', 'skipped'
  actual_payment_date TIMESTAMPTZ,
  
  -- Link to actual payment
  debt_payment_id UUID REFERENCES debt_payments(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(debt_id, payment_number)
);

CREATE INDEX idx_debt_schedules_debt ON debt_payment_schedules(debt_id);
CREATE INDEX idx_debt_schedules_due_date ON debt_payment_schedules(due_date);
```

## Functions & Procedures

### Process Debt Payment (Atomic Transaction)
```sql
CREATE OR REPLACE FUNCTION process_debt_payment(
  p_debt_id UUID,
  p_user_id UUID,
  p_amount NUMERIC,
  p_principal_paid NUMERIC DEFAULT 0,
  p_interest_paid NUMERIC DEFAULT 0,
  p_fees_paid NUMERIC DEFAULT 0,
  p_payment_method VARCHAR DEFAULT 'bank_transfer',
  p_payment_reference VARCHAR DEFAULT NULL,
  p_wallet_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT 'Debt payment'
) RETURNS TABLE (
  debt_payment_id UUID,
  debt_updated BOOLEAN,
  wallet_tx_id UUID,
  remaining_balance NUMERIC
) AS $$
DECLARE
  v_debt RECORD;
  v_debt_payment_id UUID;
  v_wallet_tx_id UUID;
  v_wallet_id UUID;
BEGIN
  -- Lock debt row to prevent concurrent updates
  SELECT * INTO v_debt FROM debts WHERE id = p_debt_id FOR UPDATE;
  
  IF v_debt IS NULL THEN
    RAISE EXCEPTION 'Debt not found: %', p_debt_id;
  END IF;
  
  IF v_debt.user_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: debt does not belong to user';
  END IF;
  
  -- Insert debt payment record
  INSERT INTO debt_payments (
    debt_id, user_id, amount, principal_paid, interest_paid, fees_paid,
    payment_method, payment_reference, status, completed_at
  ) VALUES (
    p_debt_id, p_user_id, p_amount, p_principal_paid, p_interest_paid, p_fees_paid,
    p_payment_method, p_payment_reference, 'completed', NOW()
  ) RETURNING debt_payments.id INTO v_debt_payment_id;
  
  -- Record wallet transaction (if wallet provided)
  IF p_wallet_id IS NOT NULL THEN
    PERFORM record_wallet_transaction(
      p_wallet_id, p_user_id, 'debt_payment', v_debt_payment_id::TEXT,
      p_amount, v_debt.currency_code, p_description, '{"debt_id":"'||p_debt_id||'"}'::JSONB
    );
    
    SELECT id INTO v_wallet_tx_id FROM wallet_transactions 
    WHERE reference_id = v_debt_payment_id::TEXT ORDER BY created_at DESC LIMIT 1;
    
    -- Link wallet transaction to debt payment
    UPDATE debt_payments SET wallet_tx_id = v_wallet_tx_id WHERE id = v_debt_payment_id;
  END IF;
  
  -- Update debt record
  UPDATE debts
  SET
    amount_paid = amount_paid + p_amount,
    outstanding_balance = outstanding_balance - p_amount,
    last_payment_date = NOW(),
    days_past_due = 0,
    status = CASE 
      WHEN outstanding_balance - p_amount <= 0 THEN 'paid_off'
      ELSE 'active'
    END,
    updated_at = NOW()
  WHERE id = p_debt_id;
  
  -- Return results
  RETURN QUERY SELECT
    v_debt_payment_id,
    TRUE,
    v_wallet_tx_id,
    (v_debt.outstanding_balance - p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Data Migration from `public.loans`

### View for Backward Compatibility
```sql
CREATE OR REPLACE VIEW loans AS
SELECT
  id,
  user_id,
  NULL::UUID as lender_id,  -- Handle later with provider_id
  loan_type::VARCHAR(50) as loan_type,  -- Map personal_loan -> personal, business_loan -> business
  original_principal::NUMERIC(36,8) as requested_amount,
  interest_rate,
  NULL::NUMERIC(5,2) as minimum_interest_rate,
  NULL::NUMERIC(5,2) as maximum_interest_rate,
  total_owed,
  amount_paid,
  outstanding_balance as remaining_balance,
  currency_code,
  payment_method,
  repayment_schedule,
  EXTRACT(DAY FROM (due_date - origination_date))::INT as duration_days,
  due_date,
  original_due_date,
  last_payment_date,
  NULL::TIMESTAMPTZ as approved_at,
  CASE WHEN status = 'paid_off' THEN NOW() ELSE NULL END::TIMESTAMPTZ as completed_at,
  days_past_due,
  platform_fee_applied,
  platform_fee_amount,
  metadata->>'reason' as reason_for_loan,
  metadata->>'preferred_payment_methods' as preferred_payment_methods,
  metadata->>'display_name' as display_name,
  metadata->>'city' as city,
  metadata->>'phone_number' as phone_number,
  status,
  created_at,
  updated_at
FROM debts
WHERE debt_type IN ('personal_loan', 'business_loan')
ORDER BY created_at DESC;
```

### Migration Steps
1. **Phase 1**: Create new `debts` and `debt_payments` tables alongside `loans`
2. **Phase 2**: Create views for backward compatibility
3. **Phase 3**: Migrate existing loan data to debts table
4. **Phase 4**: Update application code to use debts directly
5. **Phase 5**: Deprecate loans table

## Key Benefits

✅ **Single Source of Truth**: All debt types in one table
✅ **Audit Trail**: Every payment tracked in `debt_payments` (linked to `wallet_transactions`)
✅ **Type Flexibility**: JSONB metadata for debt-type-specific fields
✅ **Reconciliation**: `wallet_tx_id` links domain payments to wallet ledger
✅ **Extensible**: Easy to add new debt types without schema changes
✅ **Security**: RLS enforces per-user access
✅ **Performance**: Proper indexes for common query patterns
✅ **Backward Compatible**: Views allow gradual migration

## Migration Timeline

### Week 1: Schema Creation
- Create debts, debt_payments, debt_payment_schedules tables
- Add indexes and RLS policies
- Create helper functions (process_debt_payment)

### Week 2: Data Migration
- Migrate historical loan data to debts
- Create backward compatibility views
- Test view queries against existing code

### Week 3: Code Updates
- Update service layer (payments.js, p2pLoanService.js) to use debts
- Update components to query debts instead of loans
- Maintain dual-write capability during transition

### Week 4: Validation & Cutover
- Run parallel queries to validate data consistency
- Switch application code to use debts exclusively
- Archive loans table
