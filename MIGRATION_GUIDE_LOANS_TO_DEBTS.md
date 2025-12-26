# Migration Guide: `public.loans` → `public.debts`

## Overview
This guide provides step-by-step instructions to migrate from the existing `public.loans` table to the new unified `public.debts` table, which consolidates all debt types (personal loans, mortgages, credit cards, insurance, installments, p2p loans) into a single source of truth with proper audit trails.

## Timeline
- **Phase 1 (Week 1)**: Schema creation and indexes
- **Phase 2 (Week 2)**: Data migration and backward compatibility
- **Phase 3 (Week 3)**: Application code updates
- **Phase 4 (Week 4)**: Validation and cutover

---

## Phase 1: Schema Creation (Week 1)

### Step 1.1: Apply Migration
```bash
# Apply the migration to your Supabase project
# File: supabase/migrations/025_create_unified_debts_table.sql

# Using Supabase CLI:
supabase db push
```

This creates:
- `public.debts` table with all necessary columns and constraints
- `public.debt_payments` table for audit trail
- `public.debt_payment_schedules` table for amortization
- Indexes for optimal query performance
- RLS policies for security
- Helper functions: `process_debt_payment()`, `get_user_total_debt()`
- Auto-update trigger for `updated_at`

### Step 1.2: Verify Schema
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('debts', 'debt_payments', 'debt_payment_schedules');

-- Verify indexes
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' AND tablename = 'debts';

-- Test functions
SELECT * FROM get_user_total_debt('test-user-id'::uuid);
```

---

## Phase 2: Data Migration (Week 2)

### Step 2.1: Create Migration Data Script
Create a new migration file: `supabase/migrations/026_migrate_loans_to_debts.sql`

```sql
-- Migration: Migrate existing loans data to debts table
-- This script maps the old loans structure to the new debts structure

-- First, disable triggers temporarily to speed up migration
ALTER TABLE public.debts DISABLE TRIGGER update_debts_updated_at;

-- Migrate loans data to debts table
INSERT INTO public.debts (
  id,
  user_id,
  debt_type,
  provider_type,
  provider_id,
  provider_name,
  original_principal,
  interest_rate,
  total_owed,
  amount_paid,
  outstanding_balance,
  currency_code,
  origination_date,
  due_date,
  original_due_date,
  last_payment_date,
  status,
  days_past_due,
  repayment_schedule,
  payment_method,
  platform_fee_applied,
  platform_fee_amount,
  metadata,
  created_at,
  updated_at
)
SELECT
  l.id,
  l.user_id,
  -- Map old loan_type to debt_type
  CASE 
    WHEN l.loan_type = 'personal' THEN 'personal_loan'
    WHEN l.loan_type = 'business' THEN 'business_loan'
    ELSE 'personal_loan'
  END::VARCHAR(50),
  -- Determine provider_type based on lender_id
  CASE 
    WHEN l.lender_id IS NOT NULL THEN 'peer'
    ELSE 'platform'
  END::VARCHAR(50),
  l.lender_id,
  -- For P2P: lender display name (if available); for platform loans: 'currency.ph'
  CASE 
    WHEN l.lender_id IS NOT NULL THEN NULL  -- Will be populated from users table if needed
    ELSE 'currency.ph'
  END::VARCHAR(255),
  l.requested_amount,
  l.interest_rate,
  l.total_owed,
  l.amount_paid,
  l.remaining_balance,
  l.currency_code,
  l.created_at::TIMESTAMPTZ,
  l.due_date::TIMESTAMPTZ,
  l.original_due_date::TIMESTAMPTZ,
  l.last_payment_date::TIMESTAMPTZ,
  l.status::VARCHAR(50),
  l.days_past_due,
  l.repayment_schedule,
  l.payment_method,
  l.platform_fee_applied,
  l.platform_fee_amount,
  -- Consolidate metadata
  jsonb_build_object(
    'reason', l.reason_for_loan,
    'preferred_payment_methods', l.preferred_payment_methods,
    'display_name', l.display_name,
    'city', l.city,
    'phone_number', l.phone_number
  ),
  l.created_at::TIMESTAMPTZ,
  l.updated_at::TIMESTAMPTZ
FROM public.loans l
WHERE NOT EXISTS (
  -- Avoid duplicates if re-running migration
  SELECT 1 FROM public.debts d WHERE d.id = l.id
);

-- Re-enable trigger
ALTER TABLE public.debts ENABLE TRIGGER update_debts_updated_at;

-- Migrate loan_payments to debt_payments
INSERT INTO public.debt_payments (
  id,
  debt_id,
  user_id,
  amount,
  principal_paid,
  interest_paid,
  fees_paid,
  payment_method,
  payment_reference,
  status,
  created_at,
  completed_at
)
SELECT
  lp.id,
  lp.loan_id,
  lp.user_id,
  lp.amount,
  lp.amount,  -- Assume full payment goes to principal (adjust if you have breakdown)
  0,  -- Interest breakdown not available in old schema
  0,  -- Fees breakdown not available in old schema
  lp.payment_method,
  lp.payment_reference,
  lp.status::VARCHAR(50),
  lp.created_at::TIMESTAMPTZ,
  lp.completed_at::TIMESTAMPTZ
FROM public.loan_payments lp
WHERE NOT EXISTS (
  SELECT 1 FROM public.debt_payments dp WHERE dp.id = lp.id
);

-- Create view for backward compatibility
DROP VIEW IF EXISTS public.loans CASCADE;

CREATE OR REPLACE VIEW public.loans AS
SELECT
  d.id,
  d.user_id,
  d.provider_id as lender_id,
  CASE 
    WHEN d.debt_type = 'personal_loan' THEN 'personal'
    WHEN d.debt_type = 'business_loan' THEN 'business'
    ELSE 'personal'
  END::VARCHAR(50) as loan_type,
  d.original_principal::NUMERIC(36,8) as requested_amount,
  d.interest_rate,
  NULL::NUMERIC(5,2) as minimum_interest_rate,
  NULL::NUMERIC(5,2) as maximum_interest_rate,
  d.total_owed,
  d.amount_paid,
  d.outstanding_balance as remaining_balance,
  d.currency_code,
  d.payment_method,
  d.repayment_schedule,
  EXTRACT(DAY FROM (d.due_date - d.origination_date))::INT as duration_days,
  d.due_date,
  d.original_due_date,
  d.last_payment_date,
  NULL::TIMESTAMPTZ as approved_at,
  CASE WHEN d.status = 'paid_off' THEN d.updated_at ELSE NULL END::TIMESTAMPTZ as completed_at,
  d.days_past_due,
  d.platform_fee_applied,
  d.platform_fee_amount,
  d.metadata->>'reason' as reason_for_loan,
  d.metadata->>'preferred_payment_methods' as preferred_payment_methods,
  d.metadata->>'display_name' as display_name,
  d.metadata->>'city' as city,
  d.metadata->>'phone_number' as phone_number,
  d.status,
  d.created_at,
  d.updated_at
FROM public.debts d
WHERE d.debt_type IN ('personal_loan', 'business_loan')
ORDER BY d.created_at DESC;

-- Log migration completion
INSERT INTO public.audit_log (action, table_name, details)
VALUES ('MIGRATION', 'loans_to_debts', jsonb_build_object(
  'timestamp', NOW(),
  'loans_migrated', (SELECT COUNT(*) FROM public.debts WHERE debt_type IN ('personal_loan', 'business_loan')),
  'payments_migrated', (SELECT COUNT(*) FROM public.debt_payments)
));
```

### Step 2.2: Run Migration
```bash
supabase db push
```

### Step 2.3: Verify Migration
```sql
-- Count records
SELECT COUNT(*) as loan_count FROM public.debts WHERE debt_type IN ('personal_loan', 'business_loan');
SELECT COUNT(*) as payment_count FROM public.debt_payments;

-- Check sample data
SELECT id, user_id, debt_type, original_principal, outstanding_balance, status 
FROM public.debts 
LIMIT 5;

-- Test view compatibility
SELECT id, user_id, loan_type, requested_amount, remaining_balance, status 
FROM public.loans 
LIMIT 5;
```

---

## Phase 3: Application Code Updates (Week 3)

### Step 3.1: Update Service Layer

Replace `src/lib/payments.js` `getLoans()` function:

**Old Code:**
```javascript
async getLoans(userId) {
  const { data, error } = await supabase
    .from('loans')
    .select('id,user_id,loan_type,status,remaining_balance,total_owed,currency_code,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return data || []
}
```

**New Code:**
```javascript
async getLoans(userId) {
  // Gradually transition to debts table
  // For now, use view to maintain backward compatibility
  const { data, error } = await supabase
    .from('loans')  // This is now a view over debts
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return data || []
}

// New function for direct debts access
async getDebts(userId) {
  return await debtService.getDebts(userId)
}

// New function for total debt calculation
async getUserTotalDebt(userId, currencyCode = 'PHP') {
  return await debtService.getUserTotalDebt(userId, currencyCode)
}
```

### Step 3.2: Import New Service
Add to top of files that use debts:
```javascript
import debtService from './debtService'
```

### Step 3.3: Update Components Gradually

**HomePage.jsx** - Update debt calculation:
```javascript
// Old way (still works through view)
const debtData = await currencyAPI.getLoans(userId)
const totalDebt = debtData.reduce((sum, loan) => sum + parseFloat(loan.remaining_balance || 0), 0)

// New way (recommended)
const debtSummary = await debtService.getUserTotalDebt(userId, globalCurrency)
const totalDebt = debtSummary.total_outstanding
```

### Step 3.4: Update UI Components
Replace loan-specific components with debt-agnostic components:
- `LoanProgressTracker.jsx` → `DebtProgressTracker.jsx`
- `LoanPaymentModal.jsx` → `DebtPaymentModal.jsx`
- `BorrowMoney.jsx` → `CreateDebt.jsx` (expanded to handle all debt types)

---

## Phase 4: Validation & Cutover (Week 4)

### Step 4.1: Run Validation Queries
```sql
-- 1. Verify all loans are migrated
SELECT 
  'loans' as source,
  COUNT(*) as record_count,
  SUM(remaining_balance) as total_outstanding
FROM public.loans
UNION ALL
SELECT 
  'debts' as source,
  COUNT(*) as record_count,
  SUM(outstanding_balance) as total_outstanding
FROM public.debts
WHERE debt_type IN ('personal_loan', 'business_loan');

-- 2. Check for orphaned records
SELECT COUNT(*) FROM public.debt_payments dp
WHERE NOT EXISTS (SELECT 1 FROM public.debts d WHERE d.id = dp.debt_id);

-- 3. Verify payment history
SELECT 
  COUNT(*) as total_payments,
  COUNT(DISTINCT debt_id) as debts_with_payments
FROM public.debt_payments;

-- 4. Check data consistency
SELECT 
  d.id,
  d.original_principal + (d.original_principal * d.interest_rate / 100) as calculated_owed,
  d.total_owed,
  CASE 
    WHEN ABS((d.original_principal + (d.original_principal * d.interest_rate / 100)) - d.total_owed) < 0.01 THEN 'OK'
    ELSE 'MISMATCH'
  END as validation
FROM public.debts d
LIMIT 10;
```

### Step 4.2: User Acceptance Testing
- Test loan retrieval through view
- Test payment processing with new function
- Verify dashboard calculations
- Check historical data in reports

### Step 4.3: Update Supabase RLS Policies
If using custom roles, update policies:
```sql
-- Example: Update any custom role policies for debts table
-- Run after confirming all code is updated
```

### Step 4.4: Archive Old Loans Table
After 2 weeks of successful operation:

```sql
-- Create backup of old loans table (for audit)
CREATE TABLE public.loans_archived_2024 AS SELECT * FROM public.loans;

-- Drop old table if safe
-- DROP TABLE IF EXISTS public.loans CASCADE;

-- Note: Keep for at least 6 months per audit requirements
```

---

## Rollback Plan (If Needed)

If issues occur, you can rollback:

```sql
-- 1. Restore loans data from backup
-- truncate public.debts;
-- INSERT INTO public.debts SELECT * FROM public.loans_archived_2024;

-- 2. Update application code to use loans view again
-- 3. Revert service layer changes

-- 4. Notify users of temporary disruption
```

---

## Testing Checklist

- [ ] All loans records migrated to debts
- [ ] All loan_payments records migrated to debt_payments
- [ ] Backward compatibility view working
- [ ] Debts dashboard shows correct totals
- [ ] Payment processing works through process_debt_payment()
- [ ] Historical data queries return same results
- [ ] RLS policies correctly restrict user access
- [ ] Indexes are being used (check query plans)
- [ ] No orphaned records
- [ ] Data integrity checks pass

---

## Monitoring & Support

### During Migration
- Monitor Supabase logs for errors
- Check application error tracking (if available)
- Monitor database performance
- Track user reports

### Post-Migration
- Keep old loans table for 6 months (audit requirement)
- Monitor debt-related queries performance
- Set up alerts for status updates to 'delinquent'
- Regular reconciliation between debt_payments and wallet_transactions

---

## FAQ

**Q: Can I continue using the old loans table?**
A: Yes, use the backward compatibility view for existing code. Gradually migrate to debts table for new features.

**Q: How long does migration take?**
A: Data migration is typically < 1 minute. Full application update takes ~2 weeks.

**Q: What about existing P2P loans with lender_id?**
A: The provider_id field maps to lender_id. Provider_type is set to 'peer' for these.

**Q: Can I add new debt types without schema changes?**
A: Yes! Use the debt_type field and metadata JSONB for type-specific data.

**Q: How do I handle payment plans?**
A: Use the debt_payment_schedules table to define amortization schedules.

---

## Support
For questions or issues during migration, contact: [your support email]
