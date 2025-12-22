# Send Money Feature - Quick Start Guide

## What Changed?

### 1. **New Migration: `0135_fix_beneficiaries_add_recipient_id_and_transfers.sql`**

This migration adds:
- ✅ `recipient_id` column to `beneficiaries` table (foreign key to `auth.users`)
- ✅ `wallets_house` table (platform treasury for fees)
- ✅ `transfer_ledger` table (immutable transaction log)
- ✅ Enhanced `wallet_transactions` with user_id, currency_code, status, metadata, fee, exchange_rate
- ✅ Atomic function `execute_transfer_atomic()` for atomic money transfers

### 2. **Updated `src/lib/payments.js`**

**sendMoney() function:**
- Old: 3 separate RPC calls (could partially fail)
- New: Single atomic RPC call to `execute_transfer_atomic()`
- Automatically handles: debit, fee, credit, and house syndication

**addBeneficiary() function:**
- Now stores: recipient_id, recipient_email, recipient_name, recipient_phone, country_code, relationship

**getBeneficiaries() function:**
- Now returns all new columns including recipient_id for better UI

### 3. **Updated `src/components/SendMoney.jsx`**

- Improved dropdown UI for sender/recipient currency selection
- Properly separates Fiat vs Crypto currencies
- Handles recipient_id in beneficiary data
- Shows selected account details in collapsible cards

## Deployment Steps

### Step 1: Run Migration

```bash
# Option A: Via Supabase CLI
supabase db push

# Option B: Manual in Supabase Dashboard
# 1. Go to SQL Editor
# 2. New Query
# 3. Copy/paste: supabase/migrations/0135_fix_beneficiaries_add_recipient_id_and_transfers.sql
# 4. Run
```

### Step 2: Verify Migration

```sql
-- Check beneficiaries has recipient_id
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'beneficiaries' 
AND column_name = 'recipient_id';
-- Should return: recipient_id

-- Check function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'execute_transfer_atomic';
-- Should return: execute_transfer_atomic

-- Check transfer_ledger table exists
SELECT tablename FROM pg_tables 
WHERE tablename = 'transfer_ledger';
-- Should return: transfer_ledger
```

### Step 3: Test Send Money Flow

```javascript
// 1. Login as a test user
// 2. Navigate to Send Money tab
// 3. Follow the 3-step wizard:
//    - Step 1: Select sender account (PHP, USD, BTC, etc.)
//    - Step 2: Search & select recipient, save as favorite
//    - Step 3: Enter amount, review fee (1%), confirm
// 4. Monitor network requests in DevTools (F12)
// 5. Check Supabase: Inspect transfer_ledger and wallet_transactions

// Or test programmatically:
const result = await currencyAPI.sendMoney(
  'user-id-1',
  'recipient@example.com',
  'PHP',
  'USD',
  1000,  // 1,000 PHP
  50.25  // 1 PHP = 50.25 USD
)

console.log('Transfer result:', result)
// {
//   transfer_id: "550e8400-e29b-41d4-a716-446655440000",
//   reference_number: "TRN-20250122-120000-5678",
//   sender_amount: 1000,
//   recipient_amount: "50250.00",
//   fee_amount: 10,
//   status: "completed"
// }
```

## Key Database Changes

### New Tables

#### `wallets_house` - Platform Treasury
```sql
-- Track fees collected by currency
SELECT currency_code, balance, total_received FROM wallets_house;
-- Example:
-- PHP     | 1500.00  | 5000.00
-- USD     | 500.00   | 2000.00
-- ETH     | 0.05     | 0.20
```

#### `transfer_ledger` - Transaction Log
```sql
-- View all transfers
SELECT reference_number, from_user_id, to_user_id, 
       from_amount, to_amount, fee_amount, status
FROM transfer_ledger
ORDER BY created_at DESC
LIMIT 10;
```

### Enhanced Columns

#### `wallet_transactions`
```sql
-- Now includes:
SELECT id, wallet_id, user_id, type, amount, currency_code,
       balance_before, balance_after, status, fee, exchange_rate, metadata
FROM wallet_transactions
WHERE user_id = 'current-user-id'
ORDER BY created_at DESC;
```

#### `beneficiaries`
```sql
-- Now includes:
SELECT id, user_id, recipient_id, recipient_email, recipient_name, 
       recipient_phone, relationship, is_favorite
FROM beneficiaries
WHERE user_id = 'current-user-id';
```

## API Reference

### `sendMoney(senderId, recipientEmail, senderCurrency, recipientCurrency, amount, exchangeRate)`

**Parameters:**
- `senderId` (UUID): Current user ID
- `recipientEmail` (string): Email of recipient
- `senderCurrency` (string): Currency of sender wallet (e.g., "PHP")
- `recipientCurrency` (string): Currency of recipient wallet (e.g., "USD")
- `amount` (number): Amount to send in sender's currency
- `exchangeRate` (number): Exchange rate (sender_currency to recipient_currency)

**Returns:**
```javascript
{
  transfer_id: UUID,           // Unique transfer ID
  reference_number: string,    // "TRN-YYYYMMDD-HHMMSS-XXXX"
  sender_amount: number,       // Amount debited from sender
  recipient_amount: string,    // Amount credited to recipient (formatted)
  fee_amount: number,          // Platform fee (1%)
  status: "completed"          // Transfer status
}
```

**Throws:**
- `'Recipient not found'` - Email not in system
- `'Sender wallet not found'` - User has no wallet in that currency
- `'Insufficient balance'` - Not enough funds + fee
- `'Error: ...'` - Database or RPC error

### `addBeneficiary(userId, beneficiaryData)`

**Parameters:**
```javascript
{
  recipient_id: UUID,              // User ID of recipient
  recipient_email: string,         // Recipient's email
  recipient_name: string,          // Recipient's full name
  recipient_phone: string,         // Optional: Phone number
  country_code: string,            // "PH", "US", etc.
  relationship: string,            // "Family", "Friend", "Business"
  is_favorite: boolean             // Mark as favorite recipient
}
```

**Returns:** Saved beneficiary object with all columns

## Troubleshooting

### "Could not find the 'recipient_id' column" Error

**Cause:** Migration not deployed

**Solution:**
1. Run migration in Supabase SQL Editor
2. Verify with: `SELECT column_name FROM information_schema.columns WHERE table_name = 'beneficiaries' AND column_name = 'recipient_id';`
3. Should return `recipient_id`

### "Transfer failed" with no clear error

**Cause:** RPC function not deployed or network issue

**Solution:**
1. Check migration deployed: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'execute_transfer_atomic';`
2. Check browser console (F12) for full error message
3. Test RPC in Supabase SQL Editor:
```sql
SELECT execute_transfer_atomic(
  'user-uuid-1'::UUID,
  'user-uuid-2'::UUID,
  'wallet-uuid-1'::UUID,
  'wallet-uuid-2'::UUID,
  'PHP',
  'USD',
  1000.00,
  50.25
);
```

### Beneficiaries not showing in dropdown

**Cause:** Column name mismatch

**Solution:**
1. Check database: `SELECT * FROM beneficiaries LIMIT 1;`
2. Verify columns match: `recipient_id`, `recipient_email`, `recipient_name`, etc.
3. Clear cache: `localStorage.clear()` in browser DevTools
4. Reload page

### Incorrect fee calculation

**Cause:** Fee percentage hardcoded or incorrect

**Solution:**
1. Verify in function: `p_fee_percentage: 1.0` = 1%
2. To change: Update migration `p_fee_percentage NUMERIC DEFAULT 1.0`
3. Recalculate: `fee = amount * (percentage / 100)`

## Database Reconciliation Queries

### Check for balance mismatches
```sql
SELECT w.id, w.balance, 
  (SELECT SUM(amount) FROM wallet_transactions WHERE wallet_id = w.id) as ledger_balance
FROM wallets w
WHERE w.balance != (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE wallet_id = w.id);
```

### View pending transfers
```sql
SELECT reference_number, from_user_id, to_user_id, from_amount, 
       status, created_at
FROM transfer_ledger
WHERE status = 'pending'
ORDER BY created_at;
```

### Platform fee summary
```sql
SELECT 
  currency_code, 
  COUNT(*) as transfer_count,
  SUM(fee_amount) as total_fees,
  (SELECT balance FROM wallets_house wh WHERE wh.currency_code = tl.from_currency) as house_balance
FROM transfer_ledger tl
GROUP BY currency_code, from_currency;
```

### Audit specific transfer
```sql
SELECT wt.id, wt.type, wt.amount, wt.balance_before, wt.balance_after, wt.created_at
FROM wallet_transactions wt
JOIN transfer_ledger tl ON (
  wt.id = tl.sender_debit_tx_id OR
  wt.id = tl.sender_fee_tx_id OR
  wt.id = tl.recipient_credit_tx_id OR
  wt.id = tl.house_credit_tx_id
)
WHERE tl.reference_number = 'TRN-20250122-120000-5678'
ORDER BY wt.created_at;
```

## Performance Considerations

### Indexes
- ✅ `idx_beneficiaries_recipient_id` - Fast recipient lookups
- ✅ `idx_transfer_ledger_from_user` - Fast sender queries
- ✅ `idx_transfer_ledger_to_user` - Fast recipient queries
- ✅ `idx_wallet_transactions_user_created` - Fast user transaction history

### Query Optimization
```javascript
// Good - Use indexed columns
await supabase
  .from('transfer_ledger')
  .select('*')
  .eq('from_user_id', userId)
  .order('created_at', { ascending: false })
  .limit(50)

// Avoid - Full table scan
await supabase
  .from('transfer_ledger')
  .select('*')
  .textSearch('description', 'query') // No index on description
```

## Next Steps

1. ✅ Deploy migration
2. ✅ Test send money flow
3. ✅ Monitor wallet_transactions
4. ✅ Verify house wallet balance
5. 🔄 Set up automated fee distribution (future)
6. 🔄 Implement transfer limits (future)
7. 🔄 Add transfer dispute resolution (future)

## Support

For issues or questions:
1. Check logs: `console.log()` output in browser DevTools
2. Review database: Supabase SQL Editor
3. Test RPC: Run migration queries manually
4. Contact: Check SENDMONEY_TRANSACTION_FIX_GUIDE.md for detailed docs
