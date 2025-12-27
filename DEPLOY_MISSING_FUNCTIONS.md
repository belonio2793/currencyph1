# Deploy Missing Supabase Functions

## Error
```
Error calculating wallet valuation: Could not find the function public.get_total_wallet_valuation_in_fiat(p_target_currency, p_user_id) in the schema cache
```

## Solution

The Supabase RPC function `get_total_wallet_valuation_in_fiat` hasn't been deployed to your database yet.

### Steps to Fix

#### Step 1: Go to Supabase Dashboard
1. Visit https://supabase.com/dashboard
2. Select your project (`corcofbmafdxehvlbesx`)
3. Go to **SQL Editor** in the left sidebar

#### Step 2: Run Deployment Script
1. Click **New Query**
2. Copy and paste the entire content from: `supabase/deploy-missing-functions.sql`
3. Click **Run** or press `Ctrl+Enter`

**Expected Result:**
You should see messages like:
```
✓ Function get_total_wallet_valuation_in_fiat created successfully
✓ Permissions granted to authenticated users
✓ You may now refresh your application
```

#### Step 3: Test the Fix
1. Go back to your application
2. Open a private/incognito window to clear cache
3. Navigate to the Wallets section or homepage
4. Check the browser console (F12 > Console tab)
5. The error should be gone and total wallet holdings should display

### If Still Not Working

#### Option A: Check if `get_exchange_rate_safe` exists
Run this query in Supabase SQL Editor:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%exchange_rate_safe%';
```

Should return: `get_exchange_rate_safe`

If it doesn't exist, you need to run migration `0207_diagnose_and_fix_inverted_rates.sql` first:
1. Go to Supabase SQL Editor
2. Run the queries from `supabase/migrations/0207_diagnose_and_fix_inverted_rates.sql`
3. Then run the deployment script above

#### Option B: Check if `wallets` table exists
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'wallets' 
AND table_schema = 'public';
```

Should return columns like: `id`, `user_id`, `currency_code`, `balance`, `currency_type`

#### Option C: Check function permissions
```sql
SELECT * FROM information_schema.role_routine_grants 
WHERE routine_name = 'get_total_wallet_valuation_in_fiat';
```

Should show permissions for `authenticated` and `service_role`

### What This Function Does

The `get_total_wallet_valuation_in_fiat` function:
- Takes your user ID and a target currency (e.g., PHP, USD)
- Looks at all your wallets
- Converts each wallet balance to the target currency using exchange rates
- Returns the total in that currency

**Example:** If you have:
- 10,000 PHP in PHP wallet
- 0.5 BTC in Bitcoin wallet
- The function converts BTC to PHP and gives you the total

### Files Involved
- **Migration file:** `supabase/migrations/0208_calculate_fiat_wallet_valuation.sql`
- **Deployment script:** `supabase/deploy-missing-functions.sql`
- **Used by:** `src/components/Navbar.jsx` (line 80-83)

### Support
If you continue to have issues:
1. Check the Supabase dashboard's "Database" > "Logs" tab for errors
2. Verify your project has the `wallets` and `pairs` tables
3. Make sure you're logged in as the project owner (to have permissions to create functions)
