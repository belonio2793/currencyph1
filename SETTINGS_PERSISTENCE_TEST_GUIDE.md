# Settings Persistence - Quick Test Guide

## What Was Fixed
Settings (Quick Access cards, auto-scroll preference) are **now stored in the database** instead of just localStorage. This means:
- ✅ Settings persist across different devices
- ✅ Settings persist after logout/login
- ✅ Multiple devices show the same settings
- ✅ Changes sync across devices in real-time (on next login)

## Before Deploying

### Step 1: Deploy the Migration
Run this command to deploy the database migration:
```bash
# If using Supabase CLI
supabase db push

# Or manually: Go to Supabase Dashboard → SQL Editor → Paste the contents of:
# supabase/migrations/022_create_user_preferences.sql
```

### Step 2: Rebuild the App
```bash
npm run build
# or for development
npm run dev
```

## Testing Checklist

### Test 1: Single Device Persistence
- [ ] Open the app and log in
- [ ] Go to Profile → Customize Quick Access
- [ ] Reorder the cards by dragging them
- [ ] Toggle one card's visibility (hide/show a card)
- [ ] Toggle auto-scroll preference
- [ ] Click "Save" or "Close" 
- [ ] Refresh the page
- [ ] Verify: All settings are still there ✓

### Test 2: Logout/Login Persistence
- [ ] With settings from Test 1, click "Sign Out"
- [ ] Log back in with the same account
- [ ] Go back to Profile
- [ ] Verify: All settings are restored ✓

### Test 3: Multi-Device Sync
- [ ] On Device A: Log in and set a specific Quick Access order (e.g., Deposit first)
- [ ] On Device B: Log in with the same account
- [ ] Verify: Device B shows the same order as Device A ✓
- [ ] On Device B: Change a setting (e.g., hide a card)
- [ ] Verify: Change is saved to database
- [ ] On Device A: Log out and log back in
- [ ] Verify: Device A now shows the changes from Device B ✓

### Test 4: Offline Fallback
- [ ] Turn off internet connection (or use DevTools to simulate offline)
- [ ] Log in and change some settings
- [ ] Verify: Settings are saved to localStorage locally ✓
- [ ] Restore internet connection
- [ ] Settings sync to database automatically ✓

### Test 5: Guest Account (Should Still Work)
- [ ] Log in as a guest (no account)
- [ ] Change Quick Access settings
- [ ] Refresh the page
- [ ] Verify: Settings are still there (using localStorage) ✓
- [ ] Note: Guest settings won't sync to database or persist after clearing browser data

## What to Look For

### Success Indicators in Browser Console
Open DevTools (F12) → Console and look for:
- No red error messages related to preferences
- Possible info logs: "Loading user preferences from DB" (optional debug logs)

### Database Status
Check Supabase Dashboard → Database → `user_preferences` table:
- Should exist after migration
- Should have entries for your logged-in account
- Each entry should have your user_id and preference settings

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Settings don't persist after logout/login | Check migration was deployed to Supabase |
| Error messages in console about preferences | Check RLS policies are enabled on user_preferences table |
| Settings work on one device but not another | Verify both devices are using the same account |
| Settings persist locally but not across devices | Wait a moment for database sync, then log in again on other device |

## Performance Notes
- Settings load async in background (doesn't block UI)
- First load on new account will create default preferences (~100ms)
- Subsequent loads are instant from localStorage, DB updates in background
- Card drag-reordering is saved immediately to DB

## Rollback (If Needed)
If you need to rollback:
1. Delete the migration file: `supabase/migrations/022_create_user_preferences.sql`
2. Revert the code changes from Git
3. The app will continue to work using only localStorage

## Files Changed
- ✅ `supabase/migrations/022_create_user_preferences.sql` (new)
- ✅ `src/lib/preferencesManager.js` (updated)
- ✅ `src/lib/quickAccessManager.js` (updated)
- ✅ `src/components/Profile.jsx` (updated)
- ✅ `src/components/DraggableQuickAccessCards.jsx` (updated)

## Questions?
If you encounter any issues during testing, check:
1. Browser console for error messages
2. Supabase logs for database errors
3. Network tab to verify API calls succeed
4. That the migration was fully deployed to Supabase
