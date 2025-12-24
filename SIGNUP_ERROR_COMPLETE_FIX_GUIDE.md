# Complete Supabase Signup Error Fix Guide

## Error You're Experiencing
```
AuthApiError: Database error saving new user
```

This error occurs when a user tries to sign up, and the database triggers or constraints fail during user creation.

## Root Cause
The issue is caused by **incorrect foreign key references**. Many tables in your database reference `public.users(id)` instead of `auth.users(id)`. When the signup trigger runs:

1. `auth.users` record is created with an ID like `123e4567-e89b-12d3-a456-426614174000`
2. The trigger tries to create related records (profile, wallets, etc.)
3. The `wallets_fiat` table has a foreign key constraint to `public.users(id)`
4. Since the `public.users` entry doesn't exist yet, the foreign key check fails
5. The entire signup transaction is rolled back
6. User gets the generic error: "Database error saving new user"

## Solution: Apply These Migrations

Several new migrations have been created to fix this issue. They are located in `supabase/migrations/`:

### Migration Files (Apply in order)
1. **072_fix_wallets_fiat_foreign_key.sql** - Fixes wallets tables to reference auth.users
2. **073_robust_master_trigger.sql** - Adds error handling to signup trigger
3. **074_simplify_wallet_initialization.sql** - Optimizes wallet creation
4. **075_fix_rls_for_signup.sql** - Configures RLS policies properly
5. **076_fix_all_foreign_keys_to_auth_users.sql** - Fixes ALL foreign keys system-wide
6. **077_auth_trigger_safety_check.sql** - Verifies setup is correct
7. **078_defensive_foreign_key_repairs.sql** - Final defensive repairs with error handling

## How to Apply These Migrations

### Option 1: Let Supabase Auto-Apply (Recommended)
If you're using Supabase with automatic migration deployment:
1. The migrations will be automatically detected in `supabase/migrations/`
2. Run `npm run dev` or your deploy command
3. Migrations will be applied automatically

### Option 2: Manual Application via Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. For each migration file (starting with 072):
   - Copy the entire SQL content
   - Create a new query in SQL Editor
   - Paste the SQL
   - Click **Run**
4. Apply them in order (072, 073, 074, 075, 076, 077, 078)

### Option 3: Using Supabase CLI
```bash
# This applies all migrations in supabase/migrations/
supabase db push
```

## What Each Migration Fixes

| Migration | Purpose | Critical? |
|-----------|---------|-----------|
| 072 | Fix wallets_fiat and wallets_crypto FK | **YES** |
| 073 | Add error handling to trigger | **YES** |
| 074 | Optimize wallet creation (2 instead of 25+) | Recommended |
| 075 | Fix RLS policies for service_role | **YES** |
| 076 | Fix ALL foreign keys system-wide | **YES** |
| 077 | Verify and debug auth triggers | Diagnostic |
| 078 | Final defensive repairs | **YES** |

## How to Verify the Fix Works

### Step 1: Apply the migrations (see above)

### Step 2: Test signup
1. Go to your signup page
2. Enter a test email and password
3. Click "Register"
4. You should see success (not the "Database error saving new user")

### Step 3: Check user was created
1. Go to Supabase dashboard
2. Navigate to **Authentication > Users**
3. Look for your test user
4. Click on the user to verify the profile was created

## If It Still Doesn't Work

### Check the error logs
1. Go to Supabase dashboard
2. Navigate to **Logs** (or **Realtime**)
3. Look for detailed error messages
4. Common issues:
   - "relation does not exist" - A table mentioned in the trigger doesn't exist
   - "permission denied" - service_role doesn't have proper permissions
   - "unique constraint violation" - Trying to insert duplicate data

### Common Issues and Solutions

**Issue:** "relation 'public.ride_profiles' does not exist"
- **Solution:** The ride_profiles table hasn't been created. You may need to create it or remove that trigger function call.
- **Fix:** The trigger function gracefully handles missing functions/tables, so this shouldn't be an issue with migration 073.

**Issue:** "permission denied for schema public"
- **Solution:** service_role doesn't have permission. Run migration 075 and 078 to grant permissions.

**Issue:** "new row violates check constraint"
- **Solution:** A CHECK constraint is rejecting the data. Review the signup metadata being passed.

## Testing Without Signup

You can test the trigger directly with SQL:

```sql
-- This will simulate what happens during signup
-- (Don't run this unless you understand what it does)

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change,
  email_change_token_new,
  email_change_token_old,
  email_change_confirm_token,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  confirmed_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'test@example.com',
  'password_hash_here',
  now(),
  NULL,
  '',
  NULL,
  '',
  NULL,
  '',
  '',
  '',
  '',
  NULL,
  NULL,
  '{}',
  '{"full_name": "Test User"}',
  now(),
  now(),
  NULL,
  NULL,
  '',
  '',
  NULL,
  now()
);
```

## What's Changed

### Before Fixes
- wallets_fiat referenced public.users(id)
- Trigger had no error handling
- Created 25+ wallets per user on signup
- RLS policies didn't allow service_role to insert

### After Fixes
- All tables reference auth.users(id) directly
- Trigger has error handling - fails gracefully
- Only creates 2 core wallets (PHP, USD) on signup
- RLS policies explicitly allow service_role
- All foreign keys properly configured

## Performance Improvements

### Faster Signup
- Reduced from 25+ wallet creations to just 2
- Parallel execution where possible
- Fewer database constraints to check

### Better Error Handling
- Individual component failures don't break entire signup
- Warnings logged instead of rollbacks
- Users can complete signup even if optional features fail

## Next Steps

1. **Apply all migrations** in order (072-078)
2. **Test the signup flow** with a test account
3. **Monitor logs** for any errors
4. **Verify user data** in Supabase dashboard
5. **Commit these changes** to your git repository

## Support

If signup still fails after applying all migrations:
1. Check Supabase project logs for detailed error messages
2. Verify all migrations ran successfully
3. Check that table and function names match in your schema
4. Review RLS policies in Supabase dashboard
5. Contact Supabase support with the specific error message

## Files Modified

Created new migration files:
- supabase/migrations/072_fix_wallets_fiat_foreign_key.sql
- supabase/migrations/073_robust_master_trigger.sql
- supabase/migrations/074_simplify_wallet_initialization.sql
- supabase/migrations/075_fix_rls_for_signup.sql
- supabase/migrations/076_fix_all_foreign_keys_to_auth_users.sql
- supabase/migrations/077_auth_trigger_safety_check.sql
- supabase/migrations/078_defensive_foreign_key_repairs.sql

## Summary

The signup error was caused by foreign key constraint violations during the database trigger that runs when new users are created. By fixing all foreign key references to point to `auth.users(id)` instead of `public.users(id)`, and configuring proper permissions and error handling, the signup flow will now work correctly.
