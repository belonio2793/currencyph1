# User Settings Persistence Fix

## Problem
User settings (Quick Access card order/visibility, auto-scroll preference) were only being saved to the browser's localStorage. When users logged out and signed back in from a different device or browser, their settings were lost.

## Solution
Implemented database synchronization for all user preferences with automatic fallback to localStorage for offline functionality.

### What Was Changed

#### 1. **New Database Migration**
- **File**: `supabase/migrations/022_create_user_preferences.sql`
- Creates a new `user_preferences` table with the following fields:
  - `user_id`: Foreign key to auth.users
  - `auto_scroll_enabled`: Boolean preference for auto-scroll feature
  - `quick_access_card_order`: Array of card keys in user's preferred order
  - `quick_access_visibility`: JSONB object tracking which cards are visible
  - `other_preferences`: JSONB for future extensibility
  - Includes RLS (Row Level Security) policies for user privacy
  - Automatic timestamp management with triggers

#### 2. **Updated Preferences Manager**
- **File**: `src/lib/preferencesManager.js`
- **New async methods**:
  - `loadUserPreferences(userId)`: Loads all user preferences from database, creates defaults if none exist
  - `syncQuickAccessToDB()`: Syncs quick access settings to database
  - `loadQuickAccessFromDB()`: Loads quick access settings from database
- **Updated methods**: All preference-setting methods now sync to database asynchronously while maintaining localStorage for immediate UI response
- **Fallback logic**: If database sync fails, preferences are still saved to localStorage

#### 3. **Updated Quick Access Manager**
- **File**: `src/lib/quickAccessManager.js`
- **New async methods**:
  - `loadCardOrderFromDB()`: Loads card order from database with localStorage fallback
  - `loadCardVisibilityFromDB()`: Loads card visibility from database with localStorage fallback
  - `getEnabledCardsInOrder()`: Now async, loads from database
  - `getEnabledCardsInOrderSync()`: Synchronous version for backward compatibility
  - `reorderCards()`, `toggleCardVisibility()`, `resetToDefaultOrder()`: Now async and sync to database
- All card ordering/visibility changes now persist to the database

#### 4. **Updated Profile Component**
- **File**: `src/components/Profile.jsx`
- **New function**: `loadPreferencesFromDatabase()` runs on login and loads all user preferences from database
- **Updated**: `handleSaveQuickAccessPreferences()` now awaits database sync
- Settings are loaded from database on component mount, syncing localStorage with database values

#### 5. **Updated Draggable Cards Component**
- **File**: `src/components/DraggableQuickAccessCards.jsx`
- Card reordering now awaits the async database sync
- Provides better error handling and data consistency

## How It Works

### User Login Flow
1. User logs in
2. Profile component mounts
3. `loadPreferencesFromDatabase()` is called
4. If user record exists in `user_preferences` table:
   - Database settings are loaded
   - localStorage is updated with database values
   - UI is updated with those preferences
5. If no record exists:
   - Default preferences are created
   - Stored in both database and localStorage
6. For guest users, preferences still use localStorage only

### Settings Update Flow
1. User changes a setting (e.g., reorders Quick Access cards, toggles auto-scroll)
2. Setting is immediately saved to localStorage for instant UI response
3. Asynchronously, the setting is synced to the database
4. If sync fails, localStorage still has the setting (offline support)
5. On next login, the setting is loaded from database (persistent across devices)

## Backward Compatibility
- The system gracefully falls back to localStorage if database operations fail
- Guest users continue to use localStorage-only storage
- Existing localStorage data is migrated on first sync with new database entries
- All original localStorage keys remain in place for quick access

## Required Actions

### 1. Deploy Migration
The new migration file needs to be deployed to your Supabase database:
```bash
# If using Supabase CLI
supabase db push

# Or manually run the SQL in supabase/migrations/022_create_user_preferences.sql
# through the Supabase dashboard SQL editor
```

### 2. Rebuild Application
After deploying the migration:
```bash
npm run build
# or
npm run dev
```

### 3. Test the Fix
1. Log in as a user
2. Change Quick Access card order/visibility and auto-scroll setting
3. Sign out
4. Log back in
5. Verify settings are restored exactly as you set them

### 4. Multi-Device Test
1. Log in on Device A and configure settings
2. Log in on Device B with the same account
3. Verify Device B shows the same settings configured on Device A
4. Change a setting on Device B
5. Return to Device A and refresh
6. Verify the change from Device B is visible on Device A

## Database Schema

```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_scroll_enabled BOOLEAN DEFAULT true,
  quick_access_card_order TEXT[] DEFAULT ARRAY['deposit', 'nearby', 'receipts', 'messages', 'p2p', 'poker', 'networkBalances', 'myBusiness'],
  quick_access_visibility JSONB DEFAULT '{"receipts": true, "deposit": true, "nearby": true, "messages": false, "p2p": false, "poker": false, "networkBalances": false, "myBusiness": false}',
  other_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

## Security
- All preferences are stored per-user in the database
- RLS (Row Level Security) policies ensure users can only access their own preferences
- Policies prevent unauthorized access or modification
- Sensitive data is not stored in preferences (only UI preferences)

## Future Enhancements
The `other_preferences` JSONB field provides room for additional user preferences without schema changes:
- Theme preferences (dark/light mode)
- Display preferences (sidebar position, card view vs list view)
- Filter/sort defaults
- Custom layouts

Simply add to the JSONB and update the managers to handle the new keys.

## Troubleshooting

### Settings Still Not Persisting
1. Verify the migration was successfully deployed to Supabase
2. Check browser console for any error messages
3. Verify RLS policies are enabled on the `user_preferences` table
4. Ensure user is logged in with a valid auth account (not guest)

### Database Sync Errors
The system logs detailed errors to the browser console. Check:
- `src/lib/preferencesManager.js` for preference sync issues
- `src/lib/quickAccessManager.js` for quick access card issues
- Verify network connectivity to Supabase

### Performance
Database operations are non-blocking and don't affect UI responsiveness:
- Settings load asynchronously on component mount
- UI updates from localStorage immediately
- Database sync happens in the background
- All operations have proper error handling

## Files Modified
- `supabase/migrations/022_create_user_preferences.sql` (new)
- `src/lib/preferencesManager.js`
- `src/lib/quickAccessManager.js`
- `src/components/Profile.jsx`
- `src/components/DraggableQuickAccessCards.jsx`

## Testing Notes
The changes are backward compatible and don't break existing functionality:
- Guest accounts continue to work with localStorage
- All localStorage operations remain as fallbacks
- No changes to API endpoints or data structure used by the app
- Incremental testing can be done without affecting other features
