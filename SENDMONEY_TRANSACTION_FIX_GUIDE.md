# Send Money Transaction Fix - Complete Implementation Guide

## Overview

This guide documents the implementation of atomic, multi-currency money transfer with proper fee handling and platform treasury (house) wallet syndication.

## Problem Statement

The previous implementation had several issues:

1. **Missing `recipient_id` column** in the `beneficiaries` table
2. **Non-atomic transfers** - Three separate RPC calls that could partially fail
3. **Incomplete fee handling** - Fee wasn't being syndicated to platform house wallet
4. **No cross-wallet syndication** - Platform treasury wasn't tracking platform fees

## Solution Architecture

### 1. Database Schema Enhancements

#### A. Beneficiaries Table

**Migration**: `0135_fix_beneficiaries_add_recipient_id_and_transfers.sql`

```sql
ALTER TABLE beneficiaries
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS relationship VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

CREATE INDEX idx_beneficiaries_recipient_id ON beneficiaries(recipient_id);
```

**Purpose**: 
- Store recipient user ID for direct foreign key relationship
- Maintain user profile reference
- Support relationship classification
- Enable favorite recipient marking

#### B. Wallets_House Table

**Purpose**: Platform treasury wallet for each currency

```sql
CREATE TABLE wallets_house (
  id UUID PRIMARY KEY,
  currency_code VARCHAR(16) NOT NULL REFERENCES currencies(code),
  network TEXT NOT NULL,
  address TEXT,
  balance NUMERIC(36, 8),
  total_received NUMERIC(36, 8),
  total_sent NUMERIC(36, 8),
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (currency_code, network)
);
```

**Purpose**:
- Track platform's treasury for each currency
- Maintain running balance of collected fees
- Support multi-network/multi-address wallets (crypto)

#### C. Transfer_Ledger Table

**Purpose**: Immutable audit log of all money transfers

```sql
CREATE TABLE transfer_ledger (
  id UUID PRIMARY KEY,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  from_wallet_id UUID NOT NULL,
  to_wallet_id UUID NOT NULL,
  from_currency VARCHAR(16) NOT NULL,
  to_currency VARCHAR(16) NOT NULL,
  from_amount NUMERIC(36, 8) NOT NULL,
  to_amount NUMERIC(36, 8) NOT NULL,
  exchange_rate NUMERIC(18, 8),
  fee_amount NUMERIC(36, 8),
  fee_percentage NUMERIC(5, 2),
  house_wallet_id UUID,
  fee_credited_to_house BOOLEAN,
  status TEXT,
  reference_number VARCHAR(50) UNIQUE,
  
  -- Transaction IDs for ledger entries
  sender_debit_tx_id UUID,
  sender_fee_tx_id UUID,
  recipient_credit_tx_id UUID,
  house_credit_tx_id UUID,
  
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

**Purpose**:
- Immutable record of ALL transfers
- Tracks which wallet_transactions entries were created for each transfer
- Enables full audit trail and reconciliation
- Supports reversals and refunds

#### D. Wallet_Transactions Enhancements

```sql
ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(16),
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS fee NUMERIC(36, 8),
  ADD COLUMN IF NOT EXISTS received_amount NUMERIC(36, 8),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);
```

**Purpose**:
- Better filtering and querying (user_id, currency_code)
- Metadata for complex transactions (rates, conversions)
- Transaction status tracking (pending, completed, failed)
- Fee tracking for each transaction

### 2. Atomic Transfer Function

**Function**: `execute_transfer_atomic()`

```sql
CREATE FUNCTION execute_transfer_atomic(
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
) RETURNS TABLE(
  success BOOLEAN,
  transfer_id UUID,
  reference_number VARCHAR,
  sender_new_balance NUMERIC,
  recipient_new_balance NUMERIC,
  fee_amount NUMERIC,
  error_message TEXT
)
```

**Atomic Operations** (all-or-nothing):

1. **Lock wallets** - Row-level locks prevent race conditions
2. **Validate balances** - Check sufficient funds
3. **Debit sender** - Remove transfer amount + fee from sender wallet
4. **Credit recipient** - Add converted amount to recipient wallet
5. **Syndicate to house** - Add fee to platform treasury
6. **Record transactions** - Insert 4 wallet_transactions entries:
   - Sender debit (transfer_out)
   - Sender fee (rake)
   - Recipient credit (transfer_in)
   - House credit (rake)
7. **Create transfer ledger** - Immutable record linking all transactions

### 3. Transaction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ User initiates transfer:                                         │
│ - Select sender account                                         │
│ - Select recipient                                              │
│ - Enter amount                                                  │
│ - Confirm exchange rate and fee (1%)                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ execute_transfer_atomic() is called atomically:                 │
│                                                                 │
│ STEP 1: Sender Debit (transfer_out)                            │
│ ├─ Amount: 1,000 PHP                                           │
│ ├─ Fee: 10 PHP (1%)                                            │
│ ├─ Total Debit: 1,010 PHP                                      │
│ └─ Wallet update: balance -= 1,010                             │
│                                                                 │
│ STEP 2: Recipient Credit (transfer_in)                         │
│ ├─ Amount: 1,000 PHP × 50.25 exchange_rate = 50,250 USD       │
│ └─ Wallet update: balance += 50,250                            │
│                                                                 │
│ STEP 3: House Syndication (rake)                               │
│ ├─ Fee: 10 PHP                                                 │
│ └─ Wallets_House[PHP] update: balance += 10                   │
│                                                                 │
│ STEP 4: Record Audit Trail                                     │
│ ├─ wallet_transactions[0]: Sender debit                        │
│ ├─ wallet_transactions[1]: Sender fee                          │
│ ├─ wallet_transactions[2]: Recipient credit                    │
│ ├─ wallet_transactions[3]: House credit                        │
│ └─ transfer_ledger: Link all transactions                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Response to client:                                             │
│ {                                                               │
│   success: true,                                                │
│   transfer_id: "uuid",                                          │
│   reference_number: "TRN-20250101-120000-5678",                │
│   sender_new_balance: 98,990,                                  │
│   recipient_new_balance: 150,250,                              │
│   fee_amount: 10,                                              │
│   error_message: null                                          │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Frontend Implementation

#### SendMoney Component Updates

**Step 1: Select Sender Account** (Dropdown)
```jsx
<select value={selectedSender} onChange={...}>
  {fiatWallets.map(w => (
    <option value={w.currency_code}>
      {w.currency_code} - Balance: {formatNumber(w.balance)}
    </option>
  ))}
</select>
```

**Step 2: Select Recipient** (Search + Save)
```jsx
<input placeholder="Search by email or name..." />
{/* Beneficiary selection displays recipient_id, email, phone, etc */}
<button onClick={handleAddBeneficiary}>Save Recipient</button>
```

**Step 3: Enter Amount** (Auto-calculate)
```jsx
<input value={amount} onChange={...} />
{/* Exchange rate and fee automatically calculated */}
<p>Recipient receives: {(amount * rate).toFixed(2)} {recipientCurrency}</p>
<p>Fee (1%): {(amount * 0.01).toFixed(2)} {senderCurrency}</p>
```

#### sendMoney() API Call

**Before** (3 separate RPC calls):
```javascript
await record_wallet_transaction(transfer_out)
await record_wallet_transaction(fee)
await record_wallet_transaction(transfer_in)
// Risk: Fee might record but transfer_in might fail
```

**After** (Single atomic call):
```javascript
const { data, error } = await supabase.rpc('execute_transfer_atomic', {
  p_from_user_id: senderId,
  p_to_user_id: recipientUser.id,
  p_from_wallet_id: senderWallet.id,
  p_to_wallet_id: recipientWallet.id,
  p_from_currency: senderCurrency,
  p_to_currency: recipientCurrency,
  p_from_amount: parseFloat(amount),
  p_exchange_rate: parseFloat(exchangeRate),
  p_fee_percentage: 1.0
})
// All-or-nothing: Either entire transfer succeeds or entirely fails
```

### 5. Error Handling

#### Balance Validation
```sql
IF v_sender_wallet.balance < v_total_debit THEN
  RAISE EXCEPTION 'Insufficient balance. Required: %', v_total_debit;
END IF;
```

#### Wallet Existence Check
```sql
IF v_sender_wallet IS NULL THEN
  RETURN ... 'Sender wallet not found';
END IF;
```

#### Transaction Rollback
- If any step fails, entire transaction is rolled back by the database
- No partial debits or credits occur
- User retains full balance

### 6. Query Examples

#### Get all transfers for a user
```sql
SELECT * FROM transfer_ledger
WHERE from_user_id = $1 OR to_user_id = $1
ORDER BY created_at DESC;
```

#### Get transaction history for a wallet
```sql
SELECT * FROM wallet_transactions
WHERE wallet_id = $1
ORDER BY created_at DESC
LIMIT 50;
```

#### Reconcile platform fees
```sql
SELECT currency_code, SUM(balance) as total_fees
FROM wallets_house
GROUP BY currency_code;
```

#### Audit specific transfer
```sql
SELECT wt.* FROM wallet_transactions wt
JOIN transfer_ledger tl ON (
  wt.id = tl.sender_debit_tx_id OR
  wt.id = tl.sender_fee_tx_id OR
  wt.id = tl.recipient_credit_tx_id OR
  wt.id = tl.house_credit_tx_id
)
WHERE tl.id = $1
ORDER BY wt.created_at;
```

## Implementation Steps

### Step 1: Deploy Migration

```bash
# Run the migration in Supabase
supabase migrations deploy 0135_fix_beneficiaries_add_recipient_id_and_transfers.sql
```

Or manually in Supabase SQL Editor:
1. Go to SQL Editor
2. Copy contents of `0135_fix_beneficiaries_add_recipient_id_and_transfers.sql`
3. Click Run

### Step 2: Update Frontend

- ✅ SendMoney.jsx - Updated dropdown UI + recipient selection with recipient_id
- ✅ src/lib/payments.js - Updated sendMoney() to use execute_transfer_atomic()
- ✅ src/lib/payments.js - Updated addBeneficiary() to store recipient_id

### Step 3: Test the Flow

```javascript
// Test atomic transfer
const result = await currencyAPI.sendMoney(
  'sender-user-id',
  'recipient@email.com',
  'PHP',
  'USD',
  1000,
  50.25
)

console.log(result)
// {
//   transfer_id: "uuid",
//   reference_number: "TRN-...",
//   sender_amount: "1000",
//   recipient_amount: "50250.00",
//   fee_amount: 10,
//   status: "completed"
// }
```

### Step 4: Verify Database State

```sql
-- Check beneficiaries has recipient_id
SELECT id, user_id, recipient_id, recipient_email, recipient_name
FROM beneficiaries LIMIT 5;

-- Check transfer ledger
SELECT reference_number, from_user_id, to_user_id, from_amount, 
       fee_amount, status, created_at
FROM transfer_ledger ORDER BY created_at DESC LIMIT 5;

-- Check house wallet balance
SELECT currency_code, balance, total_received
FROM wallets_house;

-- Check transaction audit
SELECT id, user_id, type, amount, balance_before, balance_after
FROM wallet_transactions
ORDER BY created_at DESC LIMIT 20;
```

## Key Features

✅ **Atomic Transactions** - All-or-nothing database consistency
✅ **Fee Syndication** - Fees automatically credited to platform treasury
✅ **Immutable Audit** - Complete transaction history in transfer_ledger
✅ **Cross-Currency** - Proper exchange rate handling
✅ **Multi-Wallet** - Support for multiple wallets per currency per user
✅ **Error Recovery** - Automatic rollback on any failure
✅ **Beneficiary Management** - Save frequent recipients with direct user reference

## Security Considerations

- ✅ Row-level locking prevents race conditions
- ✅ Exclusive transaction scope ensures consistency
- ✅ RLS policies enforce user access controls
- ✅ Service role required for execution
- ✅ All transactions logged immutably

## Monitoring & Reconciliation

### Daily Reconciliation
```sql
-- Verify wallet balances match ledger
SELECT w.id, w.balance,
  (SELECT SUM(amount) FROM wallet_transactions 
   WHERE wallet_id = w.id) as calculated_balance
FROM wallets w
WHERE balance != (SELECT COALESCE(SUM(amount), 0) 
                  FROM wallet_transactions WHERE wallet_id = w.id);
```

### Platform Treasury Report
```sql
SELECT currency_code, balance, total_received, 
  (total_received - balance) as distributed
FROM wallets_house
ORDER BY currency_code;
```

## Rollback Plan

If issues arise:

1. **Revert migration** (drop new columns, keep data)
2. **Restore from backup** (if before migration)
3. **Manual refunds** (execute refund_transfer() for affected users)

## Future Enhancements

- [ ] Scheduled fee distribution to merchant accounts
- [ ] Multi-step transfer approvals
- [ ] Recurring/scheduled transfers
- [ ] Transfer limits per user/day
- [ ] Chargeback/dispute resolution
