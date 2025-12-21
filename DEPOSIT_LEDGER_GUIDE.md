# Deposit Ledger System - Single Table Architecture

## Overview

A simplified deposit management system using **only `wallet_transactions` table** as the single source of truth.

**Key Principle**: Every deposit action creates a new transaction row, not state transitions or separate tables.

---

## How It Works

### Example: User Deposits 5000 PHP

**Initial State:**
- Wallet balance: 0 PHP
- wallet_transactions: empty

**Step 1: User submits deposit (status = pending)**
```
deposits table:
  id: abc123
  user_id: user1
  wallet_id: wallet1
  amount: 5000
  status: pending
  currency_code: PHP

wallet_transactions table (NEW ROW):
  type: deposit_pending
  amount: 5000
  note: pending
  status: pending
  reference_id: abc123 (links to deposit)
  balance_before: 0
  balance_after: 0 (not credited yet)
  metadata: { method: 'gcash', ... }
```

**Step 2: Admin approves deposit**
```
deposits table (UPDATED):
  status: approved (changed from pending)
  approved_by: admin1
  approved_at: 2024-01-15T10:30:00Z
  received_amount: 5000

wallet_transactions table (NEW ROW 2):
  type: deposit_approved
  amount: 5000
  note: approved
  status: approved
  reference_id: abc123 (same deposit)
  balance_before: 0
  balance_after: 5000 (NOW CREDITED!)
  metadata: { approved_by: admin1, reason: '...' }

public.wallets table (UPDATED):
  balance: 5000 (credited automatically)
```

**Result**: Complete audit trail in a single table. Two rows for one deposit:
1. First row: pending state
2. Second row: approved + balance credited

---

## Database Schema

### wallet_transactions Table

```sql
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Transaction Details
  type TEXT CHECK (type IN (
    'deposit_pending', 'deposit_approved', 'deposit_rejected',
    'deposit_reversed', 'withdrawal', 'transfer_in', 'transfer_out',
    'payment', 'fee', 'refund', 'adjustment'
  )),
  amount NUMERIC(36, 8),
  
  -- Audit Trail
  balance_before NUMERIC(36, 8),
  balance_after NUMERIC(36, 8),
  
  -- Classification
  note TEXT, -- 'pending'|'approved'|'rejected'|'reversed'
  status TEXT CHECK (status IN (
    'pending', 'approved', 'completed', 'reversed', 'rejected'
  )),
  
  -- Linking
  reference_id UUID, -- Links to deposits, payments, etc
  
  -- Additional Info
  currency_code VARCHAR(16),
  description TEXT, -- Human-readable summary
  metadata JSONB, -- Admin info, rates, reason, etc
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Key Indexes
CREATE INDEX idx_wallet_tx_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_tx_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_tx_type ON wallet_transactions(type);
CREATE INDEX idx_wallet_tx_note ON wallet_transactions(note);
CREATE INDEX idx_wallet_tx_reference_id ON wallet_transactions(reference_id);
CREATE INDEX idx_wallet_tx_created_at ON wallet_transactions(created_at DESC);
```

### New Functions

**`record_ledger_transaction()`** - Atomic transaction recording
```sql
SELECT record_ledger_transaction(
  p_wallet_id := 'wallet-uuid',
  p_user_id := 'user-uuid',
  p_type := 'deposit_approved',
  p_amount := 5000,
  p_note := 'approved',
  p_reference_id := 'deposit-uuid',
  p_metadata := '{"admin_id": "admin-uuid", ...}'::jsonb
);
```

**`recalculate_wallet_balance()`** - Calculate from transactions
```sql
SELECT recalculate_wallet_balance('wallet-uuid');
-- Returns: 5000 (sum of all transactions)
```

**`verify_wallet_balance()`** - Check for discrepancies
```sql
SELECT * FROM verify_wallet_balance('wallet-uuid');
-- Returns: is_valid, actual_balance, calculated_balance, discrepancy
```

**`get_deposit_timeline()`** - Get all transactions for deposit
```sql
SELECT * FROM get_deposit_timeline('deposit-uuid');
-- Returns: All wallet_transactions rows with reference_id = deposit-uuid
```

---

## Setup Instructions

### 1️⃣ Run Migration

```bash
# Go to Supabase Dashboard → SQL Editor
# Run: supabase/migrations/0115_wallet_transactions_ledger_system.sql

# This creates/updates:
# - wallet_transactions table enhancements
# - record_ledger_transaction() function
# - verify_wallet_balance() function
# - Automatic triggers for deposit approval
# - Views for quick lookups
```

### 2️⃣ Use the Service

```javascript
import { depositLedgerService } from './src/lib/depositLedgerService'

// Step 1: Create pending deposit
const deposit = await depositLedgerService.processIncomingDeposit({
  userId: user.id,
  walletId: wallet.id,
  amount: 5000,
  currency: 'PHP',
  method: 'gcash',
  externalId: 'gcash-123456'
})
// Creates: deposits row (status=pending) + wallet_transactions row (type=deposit_pending)

// Step 2: Approve deposit
const approval = await depositLedgerService.approveDeposit(deposit.id, {
  adminId: admin.id,
  adminEmail: admin.email,
  reason: 'Verified in bank account'
})
// Updates: deposits (status=approved) + wallet_transactions row (type=deposit_approved, balance credited)

// Step 3: View complete timeline
const timeline = await depositLedgerService.getDepositTimeline(deposit.id)
// Returns: All transactions related to this deposit (pending + approved)

// Step 4: Verify wallet balance
const verification = await depositLedgerService.verifyWalletBalance(wallet.id)
// Returns: { is_valid: true, actual_balance: 5000, calculated_balance: 5000, discrepancy: 0 }
```

---

## API Examples

### Process Incoming Deposit

```javascript
const result = await depositLedgerService.processIncomingDeposit({
  userId: 'user-uuid',
  walletId: 'wallet-uuid',
  amount: 1000,
  currency: 'PHP',
  method: 'gcash',
  methodDetails: { reference_id: '12345' },
  externalId: 'gcash-12345'
})

// Returns:
{
  success: true,
  deposit: { id: 'dep-123', status: 'pending', ... },
  transaction: { id: 'tx-1', type: 'deposit_pending', note: 'pending', ... },
  warnings: []
}
```

### Approve Deposit

```javascript
const approval = await depositLedgerService.approveDeposit('deposit-uuid', {
  adminId: 'admin-uuid',
  adminEmail: 'admin@example.com',
  reason: 'Verified in bank statement',
  receivedAmount: 1000,
  exchangeRate: 1
})

// Returns:
{
  success: true,
  deposit: { id: 'dep-123', status: 'approved', ... },
  transaction: { id: 'tx-2', type: 'deposit_approved', note: 'approved', ... },
  balanceVerification: {
    is_valid: true,
    actual_balance: 1000,
    calculated_balance: 1000,
    discrepancy: 0
  }
}
```

### Reject Deposit

```javascript
const rejection = await depositLedgerService.rejectDeposit('deposit-uuid', {
  adminId: 'admin-uuid',
  reason: 'Duplicate deposit detected'
})

// Returns:
{
  success: true,
  deposit: { id: 'dep-123', status: 'rejected', ... }
}
```

### Reverse Approved Deposit

```javascript
const reversal = await depositLedgerService.reverseDeposit('deposit-uuid', {
  adminId: 'admin-uuid',
  reason: 'User requested refund'
})

// Wallet balance = current - reversed amount
```

### Get Deposit Timeline

```javascript
const timeline = await depositLedgerService.getDepositTimeline('deposit-uuid')

// Returns:
[
  {
    type: 'deposit_pending',
    note: 'pending',
    amount: 5000,
    balance_before: 0,
    balance_after: 0,
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    type: 'deposit_approved',
    note: 'approved',
    amount: 5000,
    balance_before: 0,
    balance_after: 5000,
    created_at: '2024-01-15T10:30:00Z',
    metadata: { admin_id: 'admin-1', reason: 'Verified' }
  }
]
```

### Get Transaction History

```javascript
const history = await depositLedgerService.getWalletTransactionHistory('wallet-uuid', 50)

// Returns all transactions for wallet (deposits, withdrawals, transfers, etc)
```

### Verify Wallet Balance

```javascript
const verification = await depositLedgerService.verifyWalletBalance('wallet-uuid')

// Returns:
{
  is_valid: true,
  actual_balance: 5000,
  calculated_balance: 5000,
  discrepancy: 0
}
```

### Reconcile All Wallets

```javascript
const report = await depositLedgerService.reconcileAllWallets()

// Returns:
{
  totalWallets: 100,
  validWallets: 99,
  mismatchWallets: 1,
  wallets: [ ... ],
  timestamp: '2024-01-15T10:30:00Z'
}
```

### Generate Audit Trail

```javascript
const audit = await depositLedgerService.generateAuditTrail('deposit-uuid')

// Returns:
{
  deposit: { ... deposit record ... },
  timeline: [ ... all related transactions ... ],
  totalTransactions: 2,
  status: 'approved',
  createdAt: '2024-01-15T10:00:00Z',
  lastUpdate: '2024-01-15T10:30:00Z'
}
```

---

## Edge Function

Replace old endpoint with new simplified version:

```bash
POST /functions/v1/deposit-approval
```

**Request:**
```json
{
  "depositId": "uuid",
  "adminId": "admin-uuid",
  "adminEmail": "admin@example.com",
  "reason": "Verified payment received",
  "receivedAmount": 5000,
  "exchangeRate": 1
}
```

**Response:**
```json
{
  "success": true,
  "deposit": { ... updated deposit ... },
  "transaction": { ... approval transaction ... },
  "balanceVerification": { ... balance status ... }
}
```

---

## SQL Queries

### Get All Transactions for Deposit

```sql
SELECT * FROM wallet_transactions
WHERE reference_id = 'deposit-uuid'
ORDER BY created_at ASC;
```

### Check Wallet Balance Status

```sql
SELECT * FROM wallet_balance_verification;

-- Shows all wallets with actual vs. calculated balance
```

### Find Wallets with Discrepancies

```sql
SELECT * FROM wallet_balance_verification
WHERE status = 'MISMATCH'
ORDER BY ABS(discrepancy) DESC;
```

### Recent Deposit Activity

```sql
SELECT * FROM recent_deposit_activity
LIMIT 50;
```

### Calculate Wallet Balance from Ledger

```sql
SELECT 
  SUM(CASE 
    WHEN type IN ('deposit_pending', 'deposit_approved', 'transfer_in', 'refund') 
      THEN amount
    WHEN type IN ('deposit_reversed', 'withdrawal', 'transfer_out', 'payment', 'fee')
      THEN -amount
    ELSE 0
  END) as balance
FROM wallet_transactions
WHERE wallet_id = 'wallet-uuid';
```

---

## Transaction Types & States

### Deposit Workflow

```
User Deposits
    ↓
deposit_pending (note: 'pending')
    ↓
Admin Reviews
    ├→ Approves: deposit_approved (note: 'approved') + balance credited
    ├→ Rejects: deposit_rejected (note: 'rejected') + no balance change
    └→ Reverses: deposit_reversed (note: 'reversed') + balance debited
```

### Other Transactions

- `withdrawal`: User withdraws funds
- `transfer_in`: Receives from another user
- `transfer_out`: Sends to another user
- `payment`: Pays for service/product
- `fee`: System fee deducted
- `refund`: Refund received
- `adjustment`: Admin adjustment

---

## Safety Features

### ✅ Atomic Updates
All balance changes happen atomically with transaction records

### ✅ Single Source of Truth
Wallet balance = SUM of all wallet_transactions

### ✅ Complete Audit Trail
Every action creates a new row (never deleted or modified)

### ✅ Trigger-Based Auto-Credit
When deposit.status changes → automatically creates wallet_transaction + credits balance

### ✅ Balance Verification
Can verify balance against ledger at any time

### ✅ Reference Linking
Every transaction can reference deposits, payments, etc.

---

## Monitoring

### Check System Health

```sql
-- Find wallets with balance mismatches
SELECT * FROM wallet_balance_verification
WHERE status = 'MISMATCH';

-- Count pending deposits
SELECT COUNT(*) FROM deposits WHERE status = 'pending';

-- Get recent activity
SELECT * FROM recent_deposit_activity LIMIT 10;
```

### Reconcile Specific Wallet

```javascript
const verification = await depositLedgerService.verifyWalletBalance('wallet-uuid')

if (!verification.is_valid) {
  console.log('MISMATCH DETECTED:')
  console.log(`Actual: ${verification.actual_balance}`)
  console.log(`Calculated: ${verification.calculated_balance}`)
  console.log(`Difference: ${verification.discrepancy}`)
}
```

---

## Advantages Over Multi-Table Approach

✅ **Simpler**: Only one transaction table to query  
✅ **Faster**: No joins needed for audit trails  
✅ **Cleaner**: All deposit actions in one place  
✅ **Easier**: New team members understand quickly  
✅ **Flexible**: Easy to add new transaction types  
✅ **Auditable**: Complete history never deleted

---

## Notes

- Every deposit action = 1+ new wallet_transactions rows
- Balance is NEVER stored in deposits table, only in wallets table
- wallet_transactions is the source of truth for history
- Wallet balance is calculated by summing transactions
- All transactions are immutable (never updated or deleted)
- Metadata JSONB allows flexibility for future fields

---

**Status**: ✅ Production Ready

**Last Updated**: 2024
