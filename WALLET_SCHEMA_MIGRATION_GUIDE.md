# Wallet Schema Migration Guide

## Overview

This guide explains the new comprehensive wallet schema that supports:
- ✅ Multiple currencies (40+ fiat + crypto)
- ✅ Per-user wallet balances with audit trail
- ✅ Atomic transaction handling with PostgreSQL functions
- ✅ PHP as the primary/default currency
- ✅ Full transaction history and reporting

## What Changed

### Old System
- Single `wallets` table with basic fields
- No transaction history
- Manual balance updates (not atomic)

### New System
- **`currencies`** table: Define supported currencies
- **`wallets`** table: Per-user wallet balances (with UUID primary keys)
- **`wallet_transactions`** table: Complete audit trail
- **PostgreSQL functions**: Atomic balance updates
- **View**: `user_wallets_summary` for easy querying

## Step-by-Step Implementation

### 1. Run the SQL Schema

1. Go to your **Supabase Dashboard**: https://supabase.co
2. Select your project
3. Navigate to **SQL Editor** → **New Query**
4. Copy the entire content from `supabase/sql/wallet_schema.sql`
5. Paste it into the editor
6. Click **Run**

**This will:**
- Create the `currencies`, `wallets`, and `wallet_transactions` tables
- Insert 40+ currencies with PHP as default
- Create PostgreSQL functions for atomic operations
- Set up proper indexes and RLS policies
- Create the `user_wallets_summary` view

### 2. Data Migration (Optional)

If you have existing wallet data, migrate it:

```sql
-- Insert existing wallets into new schema
INSERT INTO wallets (id, user_id, currency_code, balance, is_active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  user_id,
  currency_code,
  balance,
  true,
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW())
FROM old_wallets
ON CONFLICT (user_id, currency_code) DO NOTHING;
```

### 3. Update Your Code

The updated `src/lib/wisegcashAPI.js` includes:

#### New Methods

```javascript
// Wallet transactions with full history
await wisegcashAPI.getWalletTransactions(userId, limit)
await wisegcashAPI.getWalletTransactionsByType(userId, 'deposit', limit)
await wisegcashAPI.getWalletTransactionsByCurrency(userId, 'PHP', limit)

// Wallet operations (atomic)
await wisegcashAPI.addFunds(userId, 'PHP', 1000)
await wisegcashAPI.withdrawFunds(userId, 'PHP', 500)

// Currency management
await wisegcashAPI.getCurrencies(activeOnly = true)
await wisegcashAPI.getCurrencyByCode('PHP')
```

#### Updated Methods

All these methods now use the new schema and atomic transactions:
- `createWallet()` - creates UUID-based wallets
- `getWallets()` - uses `user_wallets_summary` view
- `sendMoney()` - uses PostgreSQL functions
- `payBill()` - uses PostgreSQL functions

### 4. Frontend Updates

**Minimal changes needed.** The Wallet component should work as-is because:

- `getWallets()` returns the same structure with additional fields
- `createWallet()` has the same interface
- `addFunds()` has the same interface

**However, you can enhance it to show:**
- Transaction history: `getWalletTransactions()`
- Deposited/withdrawn totals (now tracked in wallet)
- Currency details: symbol, decimals, type

### 5. Key Features

#### PHP as Primary Currency
```javascript
// PHP is marked as is_default = TRUE in currencies table
// Automatically created for new users via create_default_wallets()
const wallets = await wisegcashAPI.getWallets(userId)
// Result includes PHP wallet first
```

#### Atomic Transactions
All balance updates use the `record_wallet_transaction()` PostgreSQL function:
```sql
SELECT record_wallet_transaction(
  p_user_id := user_id,
  p_wallet_id := wallet_id,
  p_transaction_type := 'deposit',
  p_amount := 1000,
  p_currency_code := 'PHP',
  p_description := 'Deposit description'
)
```

This ensures:
- Balance updates and transaction records are atomic
- No race conditions
- Balance always equals sum of transactions
- Prevents negative balances (except via adjustment)

#### Transaction Types
- `deposit` - Add funds
- `withdrawal` - Withdraw funds
- `transfer_in` - Receive from another user
- `transfer_out` - Send to another user
- `purchase` - Bill payment, investment, etc.
- `reward` - Bonus, incentive, referral
- `rake` - Fee, commission
- `tip` - Gratuity
- `adjustment` - Admin correction (can be negative)

#### Full Audit Trail
Every balance change creates a transaction record:
```javascript
const history = await wisegcashAPI.getWalletTransactions(userId)
// Returns: id, wallet_id, user_id, type, amount, balance_before, balance_after, currency_code, description, created_at
```

## Architecture Highlights

### Constraints
- **Unique constraint**: `(user_id, currency_code)` per wallet
- **Referential integrity**: Wallets/transactions cascade on user delete
- **Check constraints**: Amount > 0, valid transaction types

### Indexes
```
idx_wallets_user - Fast lookup by user_id
idx_wallets_currency - Fast lookup by currency
idx_wallet_tx_user - Fast transaction history lookup
idx_wallet_tx_created - Ordered transaction queries
idx_wallet_tx_type - Filter by transaction type
```

### Scalability
- View-based queries avoid N+1 problems
- Indexes on high-query columns
- Partitioning ready for wallet_transactions (by user_id or created_at)

## Testing

### Test Wallet Creation
```javascript
const user = await wisegcashAPI.getOrCreateUser('test@example.com', 'Test User')
const wallets = await wisegcashAPI.getWallets(user.id)
console.log(wallets) // Should include PHP and USD wallets
```

### Test Add Funds
```javascript
const txnId = await wisegcashAPI.addFunds(userId, 'PHP', 1000)
const wallet = await wisegcashAPI.getWallet(userId, 'PHP')
console.log(wallet.balance) // Should be 1000
```

### Test Transactions
```javascript
const history = await wisegcashAPI.getWalletTransactions(userId)
console.log(history[0]) // Should show deposit transaction with balance_before/after
```

### Test Transfer
```javascript
await wisegcashAPI.sendMoney(
  sender_id, 
  'recipient@example.com', 
  'PHP', 
  'PHP', 
  500, 
  1.0 // exchange rate
)
// Should create transfer_out and transfer_in transactions
// Should create rake transaction for fee
```

## Monitoring & Maintenance

### Check Wallet Balances
```sql
SELECT * FROM user_wallets_summary WHERE user_id = 'user-uuid'
```

### Verify Transaction Integrity
```sql
-- Balance should equal sum of transactions
SELECT 
  w.id,
  w.balance,
  SUM(CASE WHEN t.type IN ('deposit', 'transfer_in', 'reward', 'tip') THEN t.amount ELSE -t.amount END) as calculated_balance
FROM wallets w
LEFT JOIN wallet_transactions t ON w.id = t.wallet_id
GROUP BY w.id
HAVING w.balance != SUM(CASE WHEN t.type IN ('deposit', 'transfer_in', 'reward', 'tip') THEN t.amount ELSE -t.amount END)
```

### View Transaction Volume
```sql
SELECT 
  DATE(created_at) as date,
  type,
  COUNT(*) as count,
  SUM(amount) as total
FROM wallet_transactions
GROUP BY DATE(created_at), type
ORDER BY date DESC
```

## Troubleshooting

### Issue: RPC function not found
**Solution**: Ensure you ran the full `wallet_schema.sql` file. The functions are defined at the end.

### Issue: Wallet creation still failing with 409
**Solution**: Run this to reset RLS policies:
```sql
DROP POLICY IF EXISTS "Users can insert own wallets" ON wallets;
CREATE POLICY "Users can insert own wallets" ON wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Issue: Transactions not showing
**Solution**: Check that `wallet_transactions` RLS policy allows SELECT:
```sql
CREATE POLICY "Users can view own transactions" ON wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);
```

## Rollback

If you need to revert to the old schema:

```sql
-- Disable constraints
ALTER TABLE wallets DISABLE TRIGGER ALL;
ALTER TABLE wallet_transactions DISABLE TRIGGER ALL;

-- Drop new tables
DROP TABLE wallet_transactions CASCADE;
DROP TABLE wallets CASCADE;
DROP TABLE currencies CASCADE;

-- Re-enable old tables if they still exist
ALTER TABLE old_wallets ENABLE TRIGGER ALL;
```

## Next Steps

1. ✅ Run `supabase/sql/wallet_schema.sql`
2. ✅ Update code (already done in `src/lib/wisegcashAPI.js`)
3. ✅ Test wallet creation and transactions
4. ✅ Monitor transaction integrity
5. 📊 Add reporting views as needed

## Support

For questions or issues:
- Check Supabase logs: Dashboard → Database → Logs
- Review RLS policies: Dashboard → Security → Policies
- Test RPC functions: SQL Editor → Test function calls

---

**PHP as Primary Currency** ✅

All new users get PHP wallet by default. Exchange rates for other currencies can be set in `currency_rates` table.
