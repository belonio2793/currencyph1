# Unified Debts Table - Developer Quick Reference

## Key Concepts

### Single Source of Truth
All debt types (loans, mortgages, credit cards, insurance, installments, p2p loans) are stored in one `public.debts` table with a `debt_type` discriminator column.

### Audit Trail with Wallet Integration
Every debt payment is recorded in:
1. **`debt_payments`** - Domain-level payment record (what happened in the debt domain)
2. **`wallet_transactions`** - Ledger record (how money moved through wallets)

These are linked via `debt_payments.wallet_tx_id → wallet_transactions.id` for complete reconciliation.

### Flexible Schema
Debt-type-specific data is stored in JSONB `metadata` field, allowing for:
- Personal Loans: purpose, coSigners, term
- Mortgages: propertyAddress, loanToValue, amortizationPeriod
- Credit Cards: creditLimit, statementDueDate, minPayment
- Insurance: policyNumber, coverageAmount, deductible
- Student Loans: schoolName, graduationDate, defermentEligible

---

## Database Schema Quick Reference

### Table: `debts`
Master debt record with all terms and current status.

**Key Columns:**
```sql
id UUID                           -- Unique debt identifier
user_id UUID                      -- Debtor (foreign key to users)
debt_type VARCHAR(50)             -- 'personal_loan', 'mortgage', 'credit_card', 'insurance', etc.
provider_type VARCHAR(50)         -- 'bank', 'platform', 'peer', 'insurer'
provider_id UUID NULL             -- Creditor (null for platform, references users for peer)

-- Financial terms
original_principal NUMERIC        -- Borrowed amount
interest_rate NUMERIC(5,2)        -- Annual interest %
total_owed NUMERIC                -- Principal + interest
amount_paid NUMERIC               -- Cumulative payments
outstanding_balance NUMERIC       -- What's left to pay

-- Dates
origination_date TIMESTAMPTZ      -- When debt started
due_date TIMESTAMPTZ              -- When full amount is due
original_due_date TIMESTAMPTZ     -- Initial due date (for tracking changes)
last_payment_date TIMESTAMPTZ     -- When last payment was made

-- Status & health
status VARCHAR(50)                -- 'pending', 'active', 'delinquent', 'paid_off', 'defaulted', 'charged_off'
days_past_due INT                 -- Days overdue

-- Flexible data
metadata JSONB                    -- Debt-type-specific fields
reconciliation_metadata JSONB     -- External system IDs, sync info

-- Timestamps
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### Table: `debt_payments`
Audit trail of every payment (linked to wallet transactions).

**Key Columns:**
```sql
id UUID                           -- Payment record ID
debt_id UUID                      -- Which debt (FK to debts)
user_id UUID                      -- Who paid
amount NUMERIC                    -- Total payment
principal_paid NUMERIC            -- Applied to principal
interest_paid NUMERIC             -- Applied to interest
fees_paid NUMERIC                 -- Applied to fees

payment_method VARCHAR(50)        -- 'bank_transfer', 'gcash', 'crypto'
payment_reference VARCHAR(255)    -- External payment ID (for reconciliation)

wallet_tx_id UUID                 -- CRITICAL: Links to wallet_transactions.id
status VARCHAR(50)                -- 'completed', 'failed', 'reversed', etc.

metadata JSONB                    -- Additional payment context
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ
```

### Table: `debt_payment_schedules`
Amortization schedule for installment debts.

**Key Columns:**
```sql
id UUID
debt_id UUID                      -- Which debt
payment_number INT                -- 1st, 2nd, 3rd payment, etc.
due_date TIMESTAMPTZ              -- When this payment is due
amount_due NUMERIC                -- How much is due
principal_due NUMERIC
interest_due NUMERIC

status VARCHAR(50)                -- 'pending', 'paid', 'delinquent'
actual_payment_date TIMESTAMPTZ   -- When actually paid
debt_payment_id UUID              -- Links to actual payment
```

---

## Common Operations

### 1. Retrieve All Debts for a User
```javascript
import debtService from './debtService'

const debts = await debtService.getDebts(userId)
// Returns array of all debts for user
```

### 2. Get Total Outstanding Debt
```javascript
const summary = await debtService.getUserTotalDebt(userId, 'PHP')
// Returns:
// {
//   total_outstanding: 50000.00,
//   active_debt_count: 3,
//   delinquent_count: 1,
//   paid_off_count: 5
// }
```

### 3. Create a New Debt
```javascript
const newDebt = await debtService.createDebt(userId, {
  debtType: 'mortgage',
  providerType: 'bank',
  providerName: 'BDO',
  originalPrincipal: 5000000,
  interestRate: 5.5,
  currencyCode: 'PHP',
  dueDate: '2035-06-30',
  repaymentSchedule: 'monthly',
  paymentMethod: 'bank_transfer',
  metadata: {
    propertyAddress: '123 Main St, Manila',
    loanToValue: 80,
    amortizationPeriod: 20
  }
})
```

### 4. Process a Payment (Atomic Operation)
```javascript
// This function:
// - Creates debt_payments record
// - Updates debts outstanding_balance and status
// - Links to wallet_transactions (if wallet provided)
// All in one atomic transaction

const paymentResult = await debtService.processPayment(
  debtId,
  userId,
  5000,  // Total amount
  {
    principalPaid: 4700,
    interestPaid: 300,
    feesPaid: 0,
    paymentMethod: 'bank_transfer',
    paymentReference: 'BDO-TRF-20240101-12345'
  }
)

// Returns:
// {
//   debt_payment_id: 'uuid',
//   debt_updated: true,
//   remaining_balance: 95000,
//   debt_status: 'active'
// }
```

### 5. Get Payment History
```javascript
const payments = await debtService.getPaymentHistory(debtId)
// Returns chronological list of all payments for debt
```

### 6. Get Payment Schedule
```javascript
const schedule = await debtService.getPaymentSchedule(debtId)
// Returns array of upcoming/past scheduled payments
```

### 7. Update Debt Status
```javascript
await debtService.updateDebtStatus(debtId, 'paid_off', {
  completion_date: new Date().toISOString()
})
```

### 8. Update Delinquency
```javascript
// Auto-calculates days_past_due and updates status if needed
await debtService.updateDelinquencyStatus(debtId)
```

### 9. Get Debt Summary by Type/Status
```javascript
const summary = await debtService.getDebtSummary(userId)
// Returns:
// {
//   byType: {
//     mortgage: { count: 1, totalOutstanding: 4900000, debts: [...] },
//     credit_card: { count: 2, totalOutstanding: 50000, debts: [...] }
//   },
//   byStatus: {
//     active: { count: 2, totalOutstanding: 4950000, debts: [...] },
//     paid_off: { count: 1, totalOutstanding: 0, debts: [...] }
//   },
//   currencies: {
//     PHP: { totalOutstanding: 4950000, debts: [...] }
//   },
//   totalOutstanding: 4950000
// }
```

---

## API/RPC Functions (in database)

### `process_debt_payment()`
Atomic function that processes payment and updates debt.
```sql
SELECT * FROM process_debt_payment(
  p_debt_id,
  p_user_id,
  p_amount,
  p_principal_paid,
  p_interest_paid,
  p_fees_paid,
  p_payment_method,
  p_payment_reference,
  p_description
)
```

### `get_user_total_debt()`
Get total outstanding debt for user in specific currency.
```sql
SELECT * FROM get_user_total_debt(p_user_id, p_currency_code)
```

---

## Query Examples

### Active Debts by User
```sql
SELECT id, debt_type, original_principal, outstanding_balance, due_date
FROM public.debts
WHERE user_id = 'user-id'
  AND status IN ('active', 'delinquent')
ORDER BY due_date ASC;
```

### Delinquent Debts
```sql
SELECT id, user_id, debt_type, outstanding_balance, days_past_due
FROM public.debts
WHERE status = 'delinquent'
ORDER BY days_past_due DESC;
```

### Payment History for Debt with Wallet Link
```sql
SELECT 
  dp.id,
  dp.amount,
  dp.principal_paid,
  dp.interest_paid,
  dp.payment_method,
  dp.created_at,
  wt.reference_id as wallet_tx_reference  -- Verify ledger
FROM public.debt_payments dp
LEFT JOIN public.wallet_transactions wt ON dp.wallet_tx_id = wt.id
WHERE dp.debt_id = 'debt-id'
ORDER BY dp.created_at DESC;
```

### Debt Summary by Type
```sql
SELECT 
  debt_type,
  COUNT(*) as count,
  SUM(original_principal) as total_principal,
  SUM(outstanding_balance) as total_outstanding,
  AVG(interest_rate) as avg_interest_rate
FROM public.debts
WHERE user_id = 'user-id'
GROUP BY debt_type;
```

### Upcoming Payments
```sql
SELECT 
  dps.id,
  dps.payment_number,
  dps.due_date,
  dps.amount_due,
  d.debt_type,
  d.provider_name
FROM public.debt_payment_schedules dps
JOIN public.debts d ON dps.debt_id = d.id
WHERE d.user_id = 'user-id'
  AND dps.status = 'pending'
  AND dps.due_date <= NOW() + INTERVAL '30 days'
ORDER BY dps.due_date ASC;
```

---

## Indexes & Performance

The table includes indexes on:
- `user_id` - Filter by user
- `status` - Filter by status
- `debt_type` - Filter by type
- `user_id, status` - Common combined filter
- `user_id, debt_type` - Filter by user and type
- `due_date` - Find upcoming payments
- `created_at DESC` - List debts by recency

For custom queries, consider adding indexes on:
- `provider_id` - If querying debts by creditor
- `currency_code` - If filtering by currency
- `days_past_due` - If frequently checking delinquency

---

## Data Integrity

### Constraints
- `outstanding_balance >= 0` - Can't go negative
- `amount_paid >= 0` - Can't be negative
- `debt_payment breakdown = total amount` - Principal + interest + fees must equal amount
- `status IN (...)` - Valid status values only
- `debt_type IN (...)` - Valid debt types only

### Audit Trail
Every payment is linked to wallet_transactions via `wallet_tx_id`:
```javascript
// Example: Verify payment was recorded in both systems
const debtPayment = await supabase.from('debt_payments').select('*').eq('id', paymentId).single()
const walletTx = await supabase.from('wallet_transactions').select('*').eq('id', debtPayment.wallet_tx_id).single()

// Both records should exist for complete audit trail
```

---

## Security (RLS)

Users can only:
- SELECT their own debts
- INSERT/UPDATE their own debts
- DELETE their own debts

Service role (backend only) can:
- READ all debts
- WRITE debts (for automated processes)

All operations enforce `auth.uid() = user_id` check.

---

## Migration from `public.loans`

The old `public.loans` table is now a **VIEW** over the debts table for backward compatibility:
```sql
-- Old code still works
const debts = await supabase.from('loans').select('*').eq('user_id', userId)

-- But migrate to new service
const debts = await debtService.getDebts(userId)
```

---

## Common Issues & Solutions

### Issue: "Missing wallet_tx_id"
**Problem**: Payment recorded but wallet transaction not linked
**Solution**: Ensure payment processing includes wallet update in same transaction
```javascript
// Use processPayment which handles both automatically
await debtService.processPayment(debtId, userId, amount, options)
```

### Issue: "Outstanding balance negative"
**Problem**: More paid than owed
**Solution**: Check constraint prevents this, but validate input amounts
```javascript
const debt = await debtService.getDebt(debtId)
if (amount > debt.outstanding_balance) {
  // Adjust amount or warn user
}
```

### Issue: "Query too slow"
**Problem**: Large result set
**Solution**: Use pagination and indexes
```sql
SELECT * FROM debts 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 50 
OFFSET 0;
```

---

## Testing Checklist

- [ ] Create debt with all types
- [ ] Process payments correctly
- [ ] Verify wallet_transactions linked
- [ ] Check RLS isolation (users see only own)
- [ ] Test delinquency calculations
- [ ] Verify payment schedules
- [ ] Check data consistency (constraints enforced)
- [ ] Performance test with 1000+ debts per user

---

## Related Documentation

- **Design Doc**: `UNIFIED_DEBTS_TABLE_DESIGN.md`
- **Migration Guide**: `MIGRATION_GUIDE_LOANS_TO_DEBTS.md`
- **SQL Migration**: `supabase/migrations/025_create_unified_debts_table.sql`
- **Service Layer**: `src/lib/debtService.js`
