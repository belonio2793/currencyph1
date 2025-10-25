# DOG Token Setup Instructions

## Step 1: View the SQL Setup Script

Run this command to see the SQL that needs to be executed:

```bash
bash scripts/setup-supabase.sh
```

This will display the SQL schema that creates all necessary tables.

## Step 2: Execute SQL in Supabase Dashboard

1. Go to https://dfhanacsmsvvkpunurnp.supabase.co
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the SQL output from the bash script above
5. Paste into the SQL editor
6. Click **Run**

The script will create:
- `currency.symbol` - Token symbol registry
- `users` - User accounts and DOG balances
- `deposits` - Transaction ledger
- `withdrawal_requests` - Withdrawal tracking
- Indexes for performance
- Row Level Security policies
- Public stats view

## Step 3: Start Development Server

```bash
yarn dev
```

Visit http://localhost:3000

## Features

✅ **Simple Monotone Design** - Black and white UI
✅ **DOG Token Balance** - Real-time balance display
✅ **Deposit Input** - Type amount and deposit
✅ **Transaction History** - Complete ledger of all deposits
✅ **Supabase Integration** - Real-time updates via subscriptions
✅ **RLS Security** - Row-level security on all tables
✅ **Test User** - Auto-creates test user on first load

## Environment Variables

Your `.env.local` is already configured with:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## What's Different from Currency.ph

- **Removed**: GCash, Maya, bank cards, crypto conversions, projects, voting
- **Simplified**: No multi-currency, no complex balance calculations
- **Added**: Simple deposit input, transaction history
- **Design**: Monotone (black/white/gray) instead of colorful
- **Focus**: Pure balance management for DOG tokens

## Database Schema

### users
```
id (UUID) - Primary key
email - User email
wallet_address - Optional wallet
dog_balance - Current DOG balance
region_code - Region code
created_at, updated_at
```

### deposits
```
id (BIGSERIAL) - Primary key
user_id (UUID) - Foreign key to users
amount - Deposit amount
deposit_type - Type of deposit
status - completed/pending
created_at, updated_at
```

### currency.symbol
```
id (BIGSERIAL) - Primary key
symbol - 'DOG'
name - 'DOG Token'
description - Description
created_at, updated_at
```

## Testing

1. Enter an amount in the input field
2. Click "Deposit"
3. See balance update in real-time
4. Check transaction history

## Real-time Updates

Balance updates automatically when:
- You add a deposit
- Someone else adds a deposit (via subscription)
- Data changes in Supabase

## Support

Check the `.env.local` file contains valid Supabase credentials:
```
VITE_SUPABASE_URL=https://dfhanacsmsvvkpunurnp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

If you get Supabase connection errors, verify these are correct.
