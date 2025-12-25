# Auth.users → Public.users → Public.profiles Sync Setup

## Overview

This setup ensures that whenever a user is created in `auth.users`, they are automatically populated in both `public.users` and `public.profiles`. You now have all three tables at your disposal.

## Files Created

### 1. **Migration File** (Recommended - Use this first)
📁 `supabase/migrations/0119_sync_auth_users_to_public_with_backfill.sql`

**What it does:**
- Creates/updates table schemas
- Sets up automatic triggers for new user creation
- Includes RLS policies
- Performs backfill of existing auth.users
- Sets up cross-table sync (profiles ↔ users)

**How to use:**
- This file will be automatically applied when you deploy
- Or manually run it in Supabase SQL Editor

### 2. **Standalone Backfill Script** (Optional - For testing/manual runs)
📁 `supabase/sql/backfill_auth_to_public.sql`

**What it does:**
- Independently syncs all existing auth.users to public tables
- Can be run anytime without migrations
- Provides progress logging
- Verifies completion with detailed reports

**How to use:**
```sql
-- Copy the entire file and paste into Supabase SQL Editor
-- Run it like any other SQL query
```

## How It Works

### **Automatic Flow (New Users)**
```
1. User signs up → auth.users INSERT triggered
         ↓
2. trigger: on_auth_user_created_sync_all fires
         ↓
3. Automatically creates public.users row
         ↓
4. Automatically creates public.profiles row
         ↓
5. User now exists in all 3 tables
```

### **Profile Updates Flow**
```
1. User updates profile → public.profiles UPDATE
         ↓
2. trigger: on_profile_update_sync_to_users fires
         ↓
3. Syncs changes to public.users
         ↓
4. All tables stay in sync
```

### **Backfill Flow (Existing Users)**
```
1. Run migration OR backfill script
         ↓
2. Iterates all auth.users
         ↓
3. For each user:
   - Extracts email, full_name, region from metadata
   - Creates public.users row
   - Creates public.profiles row
         ↓
4. Handles duplicates gracefully (ON CONFLICT DO UPDATE)
```

## Table Relationships

```
auth.users (source of truth from Supabase Auth)
    ↓
public.users (main user table - contains email, full_name, region_code, etc.)
    ↓
public.profiles (detailed profile - username, bio, phone, etc.)
```

### **Column Mapping**

| auth.users | → | public.users | → | public.profiles |
|-----------|---|-------------|---|-----------------|
| id | | auth_id | | user_id |
| email | | email | | |
| raw_user_meta_data.full_name | | full_name | | full_name |
| raw_user_meta_data.region_code | | region_code | | |
| | | | | username, bio, phone, picture |

## Usage Examples

### **Query users across all tables**
```sql
SELECT 
  au.id,
  au.email,
  pu.full_name,
  pu.region_code,
  pp.username,
  pp.bio
FROM auth.users au
LEFT JOIN public.users pu ON pu.auth_id = au.id
LEFT JOIN public.profiles pp ON pp.user_id = au.id;
```

### **Update a profile and auto-sync to users table**
```sql
UPDATE public.profiles
SET bio = 'Updated bio', username = 'newusername'
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';

-- public.users is automatically updated via trigger
```

### **Check sync status**
```sql
-- Find any orphaned records
SELECT au.id, au.email
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.auth_id = au.id)
   OR NOT EXISTS (SELECT 1 FROM public.profiles pp WHERE pp.user_id = au.id);

-- Should return: (no rows) if everything is synced
```

## Deployment Steps

### **Option A: Automatic (Recommended)**
1. Push code changes to your repository
2. Supabase will automatically run migration `0119_sync_auth_users_to_public_with_backfill.sql`
3. Done! All existing and new users are synced

### **Option B: Manual SQL**
1. Go to Supabase Dashboard → SQL Editor
2. Open `supabase/migrations/0119_sync_auth_users_to_public_with_backfill.sql`
3. Copy entire content
4. Paste into SQL Editor
5. Click "Run"
6. (Optional) Run `supabase/sql/backfill_auth_to_public.sql` for additional verification

## Verification After Deployment

### **1. Check counts match**
```sql
SELECT 'auth.users' as source, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'public.users', COUNT(*) FROM public.users
UNION ALL
SELECT 'public.profiles', COUNT(*) FROM public.profiles;
```
Expected: All three should have same count

### **2. Check for unsynced users**
```sql
SELECT COUNT(*) as unsynced FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.auth_id = au.id);
```
Expected: `0` unsynced users

### **3. Test automatic sync with new user**
```sql
-- Sign up a new user through the app or API
-- Then verify all 3 tables have the user
SELECT au.id FROM auth.users au
WHERE EXISTS (SELECT 1 FROM public.users pu WHERE pu.auth_id = au.id)
  AND EXISTS (SELECT 1 FROM public.profiles pp WHERE pp.user_id = au.id)
LIMIT 1;
```
Expected: Should return the new user's ID

## Troubleshooting

### **Issue: Users in auth.users but not in public.users**
```sql
-- Manually run backfill
-- Copy contents of supabase/sql/backfill_auth_to_public.sql
-- Run in SQL Editor
```

### **Issue: Trigger not working for new users**
```sql
-- Check if trigger exists
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created_sync_all';

-- Check for errors in trigger function
-- Verify RLS policies allow service_role to insert
```

### **Issue: Profile updates not syncing to users table**
```sql
-- Check second trigger
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_profile_update_sync_to_users';

-- Verify function
SELECT * FROM pg_proc WHERE proname = 'sync_profile_to_users';
```

## What Gets Synced

### **From auth.users → public.users (Automatic)**
- `id` → `auth_id`
- `email` → `email`
- `raw_user_meta_data.full_name` → `full_name`
- `raw_user_meta_data.region_code` → `region_code`
- `created_at` → `created_at`

### **From public.profiles → public.users (Automatic)**
- `username`
- `full_name` (overwrites)
- `phone_number`
- `profile_picture_url`
- `bio`

## Best Practices

1. **Always use public.users for queries** - it's the central user table
2. **Use public.profiles for detailed profile info** - username, bio, etc.
3. **Don't manually insert into public.users or public.profiles** - let triggers do it
4. **Keep auth.users clean** - it's the source of truth
5. **Use metadata in signup** - full_name and region_code are extracted from metadata

## Support

If you encounter issues:
1. Check migration `0119_sync_auth_users_to_public_with_backfill.sql` is applied
2. Run verification queries above
3. Review trigger function logic in migration
4. Check RLS policies aren't blocking inserts
