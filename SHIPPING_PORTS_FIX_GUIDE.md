# 🔧 How to Fix "Failed to load shipping ports" Error

## The Problem
The `shipping_ports` table doesn't exist in your Supabase database yet. The migration file was created but never actually executed.

## The Solution (3 Steps)

### Step 1: Open Supabase Dashboard
1. Go to https://app.supabase.com
2. Select your project
3. Click **"SQL Editor"** in the left sidebar

### Step 2: Run the Setup Script
1. Click **"New Query"** button (top right)
2. Open the file `SHIPPING_PORTS_SETUP.sql` in this project
3. Copy **all the SQL code** from that file
4. Paste it into the Supabase SQL Editor
5. Click the **"Run"** button (or press Ctrl+Enter)

### Step 3: Verify
After running, you should see:
- ✅ A message showing "Total Ports: 5"
- ✅ Sample data displayed from one port
- ✅ No errors

## What the Script Does
- ✅ Creates `shipping_ports` table with all required columns
- ✅ Sets up Row-Level Security (RLS) with public read access
- ✅ Creates indexes for fast queries
- ✅ Adds update timestamp automation
- ✅ Populates 5 sample Philippine ports

## After Setup

Your app should now:
1. ✅ Load shipping ports successfully
2. ✅ Display them on the map
3. ✅ Show the Public Shipping Ports tab
4. ✅ Allow searching and filtering

## Still Getting Errors?

If you still see errors after running the script:

1. **Check table exists:**
   ```sql
   SELECT * FROM shipping_ports LIMIT 1;
   ```

2. **Check RLS policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename='shipping_ports';
   ```

3. **Check data:**
   ```sql
   SELECT COUNT(*) FROM shipping_ports;
   ```

If the table exists but you're still getting 403 errors, the RLS policies may be too restrictive. Contact support if this happens.

## Need Help?

Look at the browser console (F12 → Console tab) for detailed error messages. They should now show:
- Actual error status code (403 = permission, 404 = table not found)
- Clear error message instead of `[object Object]`

---

**Time to set up:** ~1 minute
