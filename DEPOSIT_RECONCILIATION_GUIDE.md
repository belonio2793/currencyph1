# Deposit Reconciliation & Wallet Audit System

## Overview

This system provides comprehensive deposit management with full audit trails, wallet reconciliation, and state transition tracking. Every deposit goes through carefully tracked states (pending → approved → completed) with complete historical records for compliance and debugging.

## Key Features

### ✅ Complete Audit Trail
- **Deposit State Transitions**: Track every status change with reason, admin info, and idempotency
- **Wallet Transactions**: Every balance change is recorded atomically
- **Transaction Mapping**: Links deposits to wallet transactions for reconciliation
- **Audit Logs**: Comprehensive operation history with before/after states

### ✅ Safe State Management
- **State Validation**: Only allow valid transitions (pending → approved → completed, etc.)
- **Idempotency**: Prevent duplicate operations with idempotency keys
- **Version Control**: Track deposit versions to prevent race conditions
- **Atomic Updates**: All changes to balances and deposits happen atomically

### ✅ Balance Reconciliation
- **Automatic Verification**: Detect wallet balance discrepancies
- **Expected Balance Calculation**: Calculate what balance should be based on approved deposits
- **Discrepancy Reports**: Track and flag balance mismatches
- **Historical Tracking**: Audit trail of all reconciliation checks

### ✅ Multi-Currency Support
- Exchange rate tracking for currency conversions
- Received amount vs. original amount tracking
- Conversion audit trail

## Database Schema

### New Tables

#### `deposit_state_transitions` - State Change History
Tracks all status changes with complete audit context:
```sql
- id (UUID, PK)
- deposit_id (FK to deposits)
- user_id (FK to users)
- wallet_id (FK to wallets)
- previous_state (TEXT)
- new_state (TEXT) - pending|approved|completed|rejected|reversed|cancelled
- reason (TEXT) - Why the change happened
- admin_id (UUID) - Who made the change
- admin_email (TEXT)
- idempotency_key (VARCHAR) - Prevent duplicate operations
- balance_before, balance_after, balance_adjustment - Wallet impact
- exchange_rate, amount_usd - Currency conversion details
- metadata (JSONB) - Additional context
```

#### `deposit_transaction_mapping` - Deposit to Transaction Link
Links deposits to wallet transactions for reconciliation:
```sql
- id (UUID, PK)
- deposit_id (FK to deposits)
- wallet_transaction_id (FK to wallet_transactions)
- transaction_type (TEXT) - creation|approval|reversal|rejection|completion
- amount, currency_code
```

#### `wallet_balance_audit` - Balance Verification Records
Tracks all balance reconciliation checks:
```sql
- id (UUID, PK)
- wallet_id (FK to wallets)
- user_id (FK to users)
- audit_type (TEXT) - manual|automatic|emergency|scheduled
- balance_before, balance_after
- expected_balance - What it should be based on deposits
- discrepancy - Difference between actual and expected
- status (TEXT) - pending|approved|rejected|resolved
- metadata (JSONB) - Details about the audit
```

#### `deposit_audit_log` - Comprehensive Operation Log
Complete audit trail for all deposit operations:
```sql
- id (UUID, PK)
- deposit_id (FK to deposits)
- operation (TEXT) - deposit_created|deposit_approved|deposit_reversed
- status (TEXT) - success|failed
- previous_state, new_state (JSONB) - Before/after
- wallet_impact (JSONB) - Balance changes
- admin_id, admin_email - Who performed it
- error_message, error_details - If failed
```

### Modified Tables

The existing `deposits` and `wallet_transactions` tables work with the new system. When a deposit status changes, triggers automatically create `wallet_transactions` records and state transition records.

## Setup Instructions

### 1️⃣ Run Database Migration

```bash
# Go to Supabase Dashboard → SQL Editor
# Run the migration file:
supabase/migrations/0115_deposit_reconciliation_system.sql

# This creates:
# - New tables (deposit_state_transitions, wallet_balance_audit, etc.)
# - Functions for validation and reconciliation
# - Triggers for automatic transaction recording
# - RLS policies
# - Views for easy querying
```

### 2️⃣ Install/Update Services

The following services are now available:

#### **depositReconciliationService** - Main Deposit Handler
```javascript
import { depositReconciliationService } from './src/lib/depositReconciliationService'

// Process incoming deposit
const result = await depositReconciliationService.processIncomingDeposit({
  userId: 'user-uuid',
  walletId: 'wallet-uuid',
  amount: 1000,
  currency: 'PHP',
  method: 'gcash',
  methodDetails: { reference: '12345' },
  externalId: 'gcash-12345'
})

// Approve pending deposit
const approval = await depositReconciliationService.approveDeposit(depositId, {
  adminId: 'admin-uuid',
  adminEmail: 'admin@example.com',
  reason: 'Verified by manual review',
  receivedAmount: 1000,
  exchangeRate: 1
})

// Reject deposit
const rejection = await depositReconciliationService.rejectDeposit(depositId, {
  adminId: 'admin-uuid',
  reason: 'Duplicate deposit detected'
})

// Reverse approved deposit (refund)
const reversal = await depositReconciliationService.reverseDeposit(depositId, {
  adminId: 'admin-uuid',
  reason: 'User requested refund'
})

// Get complete audit history
const history = await depositReconciliationService.getAuditHistory(depositId)

// Reconcile wallet balance
const reconciliation = await depositReconciliationService.reconcileWalletBalance(walletId, userId)

// Generate reconciliation report
const report = await depositReconciliationService.generateReconciliationReport(userId)
```

#### **walletReconciliationService** - Wallet Verification
```javascript
import { walletReconciliationService } from './src/lib/walletReconciliationService'

// Verify single wallet balance
const verification = await walletReconciliationService.verifyWalletBalance(walletId, userId)

// Reconcile all user wallets
const userReconciliation = await walletReconciliationService.reconcileUserWallets(userId)

// Reconcile wallet against deposit ledger
const depositReconciliation = await walletReconciliationService.reconcileAgainstDeposits(walletId, userId)

// Find all wallets with discrepancies
const discrepancies = await walletReconciliationService.findAllDiscrepancies()

// Get wallet transaction history
const transactions = await walletReconciliationService.getWalletTransactionHistory(walletId)

// Get wallet deposit history
const deposits = await walletReconciliationService.getWalletDepositHistory(walletId)

// Generate comprehensive wallet report
const report = await walletReconciliationService.generateWalletReport(walletId, userId)
```

### 3️⃣ Update Deposit Approval Flow

Replace the old `process-deposit-approval` function with the new `safe-deposit-approval`:

**Old:**
```bash
POST /functions/v1/process-deposit-approval
```

**New:**
```bash
POST /functions/v1/safe-deposit-approval
```

Request format:
```json
{
  "depositId": "uuid",
  "adminId": "admin-uuid",
  "adminEmail": "admin@example.com",
  "reason": "Verified payment received",
  "receivedAmount": 1000,
  "exchangeRate": 1
}
```

Response includes:
- deposit (updated record)
- transaction (wallet_transaction created)
- stateTransition (state change record)
- reconciliation (balance verification)
- warnings (any non-critical issues)

## Workflow Examples

### Example 1: Process New Deposit

```javascript
// 1. User submits deposit via GCash
const deposit = await depositReconciliationService.processIncomingDeposit({
  userId: user.id,
  walletId: wallet.id,
  amount: 5000,
  currency: 'PHP',
  method: 'gcash',
  methodDetails: { reference_id: '123456' },
  externalId: 'gcash-123456'
})
// Result: deposit.status = 'pending'
// Creates: wallet_transaction (deposit_pending), deposit_state_transitions, audit_log

// 2. Admin verifies and approves
const approval = await depositReconciliationService.approveDeposit(deposit.id, {
  adminId: admin.id,
  adminEmail: admin.email,
  reason: 'Verified in bank account'
})
// Result: deposit.status = 'approved', wallet.balance += 5000
// Creates: wallet_transaction (deposit), deposit_state_transitions, audit_log
// Reconciles: Checks wallet balance against expected

// 3. Check audit trail
const history = await depositReconciliationService.getAuditHistory(deposit.id)
// Returns: All state transitions, transactions, and audit logs
```

### Example 2: Handle Deposit Reversal

```javascript
// User requests refund
const reversal = await depositReconciliationService.reverseDeposit(depositId, {
  adminId: admin.id,
  reason: 'User requested refund'
})
// Result: deposit.status = 'reversed', wallet.balance -= 5000
// Creates: wallet_transaction (deposit_reversal), state_transition, audit_log
```

### Example 3: Full Wallet Reconciliation

```javascript
// Verify all user's wallets
const reconciliation = await walletReconciliationService.reconcileUserWallets(userId)
// Returns summary of all wallets and discrepancies

if (reconciliation.invalidWallets > 0) {
  console.log(`Found ${reconciliation.invalidWallets} wallets with issues:`)
  reconciliation.wallets.forEach(wallet => {
    if (!wallet.isValid) {
      console.log(`  - ${wallet.currency}: ${wallet.discrepancy} discrepancy`)
    }
  })
}
```

### Example 4: Generate Audit Report

```javascript
// Run reconciliation report
const report = await depositReconciliationService.generateReconciliationReport(userId)

// Returns: All deposit state transitions, transactions, and issues
// Includes: Deposit summaries, discrepancies, recommendations

// Save to file
console.log(JSON.stringify(report, null, 2))
```

## Running Reconciliation Scripts

### Comprehensive System Audit

```bash
# Run full reconciliation across all wallets and deposits
npm run reconcile-deposits-and-wallets

# This will:
# - Audit all wallets (1000+ if you have many)
# - Audit all deposits
# - Verify state transitions
# - Generate recommendations
# - Save report to reconciliation-report.json
```

### Audit Specific User

```bash
npm run reconcile-deposits-and-wallets -- --user=<user-uuid>
```

### Audit Specific Wallet

```bash
npm run reconcile-deposits-and-wallets -- --wallet=<wallet-uuid>
```

### Save Report to Custom Location

```bash
npm run reconcile-deposits-and-wallets -- --report=./reports/audit-2024.json
```

### Auto-Fix Discrepancies (Experimental)

```bash
npm run reconcile-deposits-and-wallets -- --fix
```

## API Query Examples

### Check Deposit State Transitions

```sql
-- See all status changes for a deposit
SELECT * FROM deposit_state_transitions 
WHERE deposit_id = 'deposit-uuid'
ORDER BY created_at ASC;

-- See all transitions by admin
SELECT * FROM deposit_state_transitions 
WHERE admin_id = 'admin-uuid'
ORDER BY created_at DESC;
```

### Find Balance Discrepancies

```sql
-- Find wallets with balance mismatches
SELECT * FROM wallet_balance_audit
WHERE status = 'pending' AND discrepancy != 0
ORDER BY ABS(discrepancy) DESC;

-- See reconciliation history for a wallet
SELECT * FROM wallet_balance_audit
WHERE wallet_id = 'wallet-uuid'
ORDER BY created_at DESC;
```

### Audit Trail for Deposit

```sql
-- Complete audit trail
SELECT 
  'state_transition' as source,
  new_state as action,
  created_at,
  admin_email
FROM deposit_state_transitions
WHERE deposit_id = 'deposit-uuid'

UNION ALL

SELECT
  'wallet_transaction',
  type,
  created_at,
  'system'
FROM wallet_transactions
WHERE reference_id = 'deposit-uuid'

UNION ALL

SELECT
  'audit_log',
  operation,
  created_at,
  admin_email
FROM deposit_audit_log
WHERE deposit_id = 'deposit-uuid'

ORDER BY created_at ASC;
```

## Monitoring & Alerts

### Setup Alerts for Issues

```sql
-- Find pending deposits older than 24 hours
SELECT d.id, d.user_id, d.amount, d.created_at
FROM deposits d
WHERE d.status = 'pending'
  AND d.created_at < NOW() - INTERVAL '24 hours'
ORDER BY d.created_at ASC;

-- Find wallets with significant discrepancies
SELECT w.id, w.user_id, wba.discrepancy, wba.created_at
FROM wallet_balance_audit wba
JOIN wallets w ON wba.wallet_id = w.id
WHERE wba.status = 'pending'
  AND ABS(wba.discrepancy) > 100
ORDER BY wba.created_at DESC;
```

## Safety Features

### Idempotency Protection
Every operation has an optional `idempotencyKey` to prevent duplicate processing:
```javascript
// Same key = same result, even if called twice
const result1 = await service.approveDeposit(id, { idempotencyKey: 'unique-key-123' })
const result2 = await service.approveDeposit(id, { idempotencyKey: 'unique-key-123' })
// result1 === result2 (no double credit)
```

### Atomic Transactions
All balance updates happen atomically with transaction records:
- Update deposit status
- Update wallet balance
- Create wallet transaction
- Record state transition
- Create audit log
(All succeed or all fail together)

### Version Control
Deposits track version numbers to prevent concurrent modifications.

### RLS Policies
- Users can only see their own wallets and deposits
- Service role can access all for admin operations
- Audit logs are viewable by users and admins

## Troubleshooting

### Wallet Balance Doesn't Match Deposits

```javascript
// 1. Check discrepancies
const discrepancies = await walletReconciliationService.findAllDiscrepancies()

// 2. View wallet report
const report = await walletReconciliationService.generateWalletReport(walletId, userId)

// 3. Manual reconciliation against deposits
const recon = await walletReconciliationService.reconcileAgainstDeposits(walletId, userId)

// 4. Review transaction history
const history = await walletReconciliationService.getWalletTransactionHistory(walletId)
```

### Missing State Transitions

```sql
-- Check if deposits have transition records
SELECT d.id, d.status, COUNT(dst.id) as transitions
FROM deposits d
LEFT JOIN deposit_state_transitions dst ON d.id = dst.deposit_id
GROUP BY d.id, d.status
HAVING COUNT(dst.id) = 0;
```

### Slow Reconciliation

If reconciliation is slow with many deposits/transactions:
1. Ensure indexes exist (migration creates them)
2. Archive old transactions (not yet implemented)
3. Run reconciliation in background

## Future Enhancements

- [ ] Automated transaction archiving (old transactions → archive table)
- [ ] Scheduled reconciliation reports (email daily/weekly)
- [ ] Auto-correction for small discrepancies
- [ ] WebSocket subscriptions for real-time balance updates
- [ ] Batch deposit approvals
- [ ] Reversal scheduling (approve now, reverse later)

## Support

For questions or issues:
1. Check SQL in `supabase/migrations/0115_deposit_reconciliation_system.sql`
2. Review service implementations in `src/lib/`
3. Check Edge Function in `supabase/functions/safe-deposit-approval/`
4. Run reconciliation script to diagnose issues
5. Review audit logs in database

---

**Status**: ✅ Production Ready

**Last Updated**: 2024

**Tested With**: Supabase PostgreSQL v14+
