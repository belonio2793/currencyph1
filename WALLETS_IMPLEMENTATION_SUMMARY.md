# Wallets Page Implementation Summary

## Overview

The wallets page has been completely redesigned to show all available currencies (fiat and crypto) with a manual "Create Wallet" button for each currency. Wallets are only created when explicitly requested by the user.

## Changes Made

### 1. Database Schema Fix (`supabase/sql/fix-wallets-schema.sql`)

**Problem:** The original wallets table had a foreign key constraint to `auth.users` which doesn't work across schemas in Supabase.

**Solution:**
- Removed FK constraint on `user_id` (still stored as UUID, but not constrained)
- Kept FK constraint on `currency_code` → `currencies` table
- Added RLS (Row Level Security) policies so users can only access their own wallets
- Recreated the `user_wallets_summary` view for easy joins with currency data

**To apply:** Run in Supabase SQL Editor:
```bash
-- Copy the contents of supabase/sql/fix-wallets-schema.sql
-- Paste in Supabase SQL Editor and execute
```

### 2. Wallet Component Rewrite (`src/components/Wallet.jsx`)

**Old behavior:**
- Tried to auto-create PHP wallet on mount
- Complex filtering and preference management
- Mixed placeholders with real wallets

**New behavior:**
- Shows ALL currencies (fiat and crypto) divided into sections
- Simple "Create Wallet" button for currencies without wallets
- Shows wallet balance and details for currencies with wallets
- Filter by: Type (Fiat/Crypto), Search by name/code
- Manual wallet creation only - no auto-generation

**UI Features:**
- Grid layout: 1 column (mobile) → 4 columns (desktop)
- Clear visual separation: Fiat (blue button) vs Crypto (orange button)
- Search bar to find currencies by code or name
- Creates wallet with matching user_id UUID on button click
- Shows success/error messages with auto-clear

### 3. Removed Auto-Generation (`src/App.jsx`)

**What was removed:**
- `ensureUserPhpWallet()` call on authentication
- Automatic wallet creation on login
- Edge function invocation for PHP wallet setup

**Why:** Per requirements, wallets should only be created when user explicitly clicks "Create Wallet"

## How It Works Now

### 1. User Logs In
- App loads, user is authenticated
- No wallets are created automatically

### 2. User Visits `/wallets`
- All 156+ currencies are fetched from `currencies` table
- User's existing wallets are fetched from `wallets` table
- Currencies are displayed in a grid:
  - Has wallet → Shows balance, "View Details" button
  - No wallet → Shows "Create Wallet" button

### 3. User Creates Wallet
- User clicks "Create Wallet" button for a currency
- Database insert: new row in `wallets` table with:
  - `user_id` (from authenticated session)
  - `currency_code` (the selected currency)
  - `balance: 0`
  - `total_deposited: 0`
  - `total_withdrawn: 0`
  - `is_active: true`
- UI refreshes and shows wallet details

### 4. User Views Wallet Details
- Click "View Details" on a wallet
- Opens `WalletDetailPanel` with:
  - Full wallet information
  - Balance details
  - Account number (if available)
  - Transaction history

## Database Structure

### `wallets` table
```sql
- id (UUID, PK)
- user_id (UUID, not FK constrained)
- currency_code (VARCHAR, FK → currencies.code)
- balance (DECIMAL)
- total_deposited (DECIMAL)
- total_withdrawn (DECIMAL)
- is_active (BOOLEAN)
- account_number (VARCHAR, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

UNIQUE(user_id, currency_code) -- user can't have 2 wallets for same currency
```

### `currencies` table
```sql
- code (VARCHAR, PK) -- 'PHP', 'USD', 'BTC', etc.
- name (VARCHAR) -- 'Philippine Peso', 'Bitcoin', etc.
- type (VARCHAR) -- 'fiat' or 'crypto'
- symbol (VARCHAR) -- '₱', '$', '₿', etc.
- decimals (INTEGER)
- is_default (BOOLEAN)
- active (BOOLEAN)
```

## RLS Policies

Users can only access their own wallets:

```sql
-- SELECT: Only see your own wallets
WHERE auth.uid() = user_id

-- INSERT: Only create wallets for yourself
WITH CHECK (auth.uid() = user_id)

-- UPDATE: Only update your own wallets
WHERE auth.uid() = user_id AND WITH CHECK (auth.uid() = user_id)
```

## API Endpoints Used

### Fetch all currencies
```javascript
supabase
  .from('currencies')
  .select('*')
  .eq('active', true)
  .order('type')
  .order('code')
```

### Fetch user's wallets
```javascript
supabase
  .from('wallets')
  .select('*')
  .eq('user_id', userId)
  .eq('is_active', true)
```

### Create wallet
```javascript
supabase
  .from('wallets')
  .insert([{
    user_id: userId,
    currency_code: currencyCode,
    balance: 0,
    total_deposited: 0,
    total_withdrawn: 0,
    is_active: true
  }])
  .select()
  .single()
```

## Testing the Implementation

### 1. Check Database is Ready
In Supabase SQL Editor:
```sql
SELECT COUNT(*) as total_currencies FROM currencies WHERE active = true;
-- Should return a number > 0

SELECT * FROM currencies LIMIT 5;
-- Should show currencies with code, name, type, symbol
```

### 2. Create Test User
- Sign up a new account or use existing account

### 3. Test Wallets Page
- Navigate to `/wallets`
- Should see grid of all currencies
- Each currency has either:
  - "Create Wallet" button (no wallet yet)
  - Balance display + "View Details" button (wallet exists)

### 4. Create a Wallet
- Click "Create Wallet" for any currency
- Should see loading state
- Should see success message
- Page should refresh
- Wallet should now show balance section

### 5. Verify Database
In Supabase, check `wallets` table:
```sql
SELECT w.*, c.name, c.type 
FROM wallets w
JOIN currencies c ON w.currency_code = c.code
WHERE w.user_id = 'YOUR_USER_ID'
ORDER BY c.type, c.code;
```

## Files Modified

1. **supabase/sql/fix-wallets-schema.sql** (NEW)
   - Schema fixes and RLS policies

2. **src/components/Wallet.jsx** (REWRITTEN)
   - Complete redesign
   - Shows all currencies
   - Manual wallet creation

3. **src/App.jsx** (MODIFIED)
   - Removed auto-wallet generation
   - Removed wallet function imports

## Migration Checklist

- [ ] Run SQL fix script in Supabase SQL Editor
- [ ] Verify currencies table has 156+ entries
- [ ] Test creating wallet as new user
- [ ] Test currency filtering (Fiat/Crypto)
- [ ] Test search functionality
- [ ] Verify database constraints work
- [ ] Check RLS policies are working (can only see own wallets)

## Known Limitations

- Wallet deletion is not implemented (can be added later)
- No wallet renaming feature
- Account numbers are read-only
- No withdrawal/transfer between wallets (can be added)

## Future Enhancements

- [ ] Add "Delete Wallet" button
- [ ] Add transfer between wallets
- [ ] Add exchange rates for balance conversion
- [ ] Add wallet statistics/analytics
- [ ] Add wallet export (CSV/PDF)
- [ ] Add transaction history per wallet
- [ ] Add wallet notifications/alerts
- [ ] Add recurring deposits/withdrawals
