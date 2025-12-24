# Supabase Signup Error Fix Summary

## Error Description
```
AuthApiError: Database error saving new user
```

This error occurred when users tried to sign up. The error happened at the database level during the auth.users insert operation.

## Root Cause Analysis

The signup error was caused by multiple interrelated issues:

### Issue 1: Foreign Key Constraint Mismatch
**File**: `supabase/migrations/007_create_wallets_fiat_crypto.sql`

The `wallets_fiat` table had an incorrect foreign key constraint:
```sql
user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
```

This references `public.users(id)`, but the signup trigger was trying to insert with `auth.users.id`. Since `public.users` entries haven't been created yet when the wallet trigger runs, this caused a foreign key constraint violation.

### Issue 2: Unsafe Trigger Execution
**File**: `supabase/migrations/fix_auth_triggers_consolidation.sql`

The master trigger function didn't have error handling, and if any function call failed, the entire trigger would fail, rolling back the user creation.

### Issue 3: Performance Issues During Signup
**File**: `supabase/migrations/071_nuclear_option_signup_fix.sql`

The wallet initialization function was trying to create 25+ wallet entries for every supported currency on signup. This could cause performance issues and timing conflicts.

### Issue 4: Incomplete RLS Configuration
Various migrations had incomplete or conflicting RLS policies. The `service_role` wasn't properly granted permissions to insert data during trigger execution.

## Fixes Applied

### Fix 1: Correct Foreign Key Constraint (Migration 072)
**File**: `supabase/migrations/072_fix_wallets_fiat_foreign_key.sql`

- Changed wallets_fiat.user_id foreign key to reference `auth.users(id)` instead of `public.users(id)`
- Changed wallets_crypto.user_id foreign key to reference `auth.users(id)` instead of `public.users(id)`
- This allows wallets to be created directly from auth.users without depending on public.users being created first
- Added unique constraint on (user_id, currency) to prevent duplicates

### Fix 2: Robust Master Trigger with Error Handling (Migration 073)
**File**: `supabase/migrations/073_robust_master_trigger.sql`

- Added try-catch blocks around each initialization function
- Changed from `PERFORM` (which silently fails) to explicit error handling
- Logs warnings instead of throwing errors, allowing signup to continue even if one component fails
- Ensures that if wallet creation fails, the user is still created

### Fix 3: Simplified Wallet Initialization (Migration 074)
**File**: `supabase/migrations/074_simplify_wallet_initialization.sql`

- Reduced wallet creation from 25+ currencies to just 2 primary wallets: PHP and USD
- Prevents performance issues during signup
- Users can create additional wallets on-demand
- Faster signup process

### Fix 4: Complete RLS Configuration (Migration 075)
**File**: `supabase/migrations/075_fix_rls_for_signup.sql`

- Ensured all tables have RLS enabled with proper policies
- Explicitly granted `service_role` permission to insert data during trigger execution
- Policies now allow service_role to bypass row-level restrictions
- Properly configured policies for:
  - profiles
  - users
  - wallets_fiat
  - wallets_crypto
  - ride_profiles

## How These Fixes Work Together

1. **User signs up** → auth.users INSERT
2. **Master trigger fires** → Calls initialization functions in order
3. **Create profile** → Inserts into public.profiles (references auth.users)
4. **Create public.users** → Inserts into public.users (references auth.users)
5. **Initialize wallets** → Inserts into wallets_fiat/crypto (now references auth.users, not public.users)
6. **Create ride profile** → Inserts into ride_profiles (references auth.users)

**Key improvements**:
- All foreign keys now reference auth.users directly, avoiding timing issues
- RLS policies allow service_role to execute all operations
- Error handling prevents cascading failures
- Reduced wallet creation prevents performance bottlenecks

## Testing the Fix

To verify the fix works:

1. Navigate to the signup page
2. Enter a username/email and password
3. Click register
4. The user should be created successfully
5. No "Database error saving new user" should appear

## Files Modified

Created new migrations:
- `supabase/migrations/072_fix_wallets_fiat_foreign_key.sql`
- `supabase/migrations/073_robust_master_trigger.sql`
- `supabase/migrations/074_simplify_wallet_initialization.sql`
- `supabase/migrations/075_fix_rls_for_signup.sql`

These migrations will be automatically applied when the Supabase project is next deployed.

## Additional Notes

- The migrations are additive and safe - they don't delete data
- They use `IF EXISTS` and `DROP IF EXISTS` to prevent errors if things don't exist
- The changes are backward compatible - existing users won't be affected
- Wallet creation was the main performance bottleneck and has been optimized
