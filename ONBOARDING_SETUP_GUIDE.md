# Onboarding & Address To-Do List Setup Guide

## Overview
This system creates an auto-detecting to-do list that tracks user onboarding progress, including address creation, profile completion, email verification, and currency preferences.

## Components Created

### 1. **OnboardingService** (`src/lib/onboardingService.js`)
- Auto-detects user address status from database
- Retrieves onboarding tasks and progress
- Updates task completion status
- Calculates onboarding progress percentage

### 2. **OnboardingChecklist** (`src/components/OnboardingChecklist.jsx`)
- Displays expandable to-do list with task progress
- Shows completion percentage with progress bar
- Auto-marks address task as complete when user has addresses
- Opens address modal when user clicks "Start" on address task
- Handles all 4 onboarding tasks:
  - ✅ Create Your First Address (essential)
  - ✅ Complete Your Profile (important)
  - ✅ Verify Your Email (important)
  - ✅ Set Your Preferred Currency (optional)

### 3. **AddressOnboardingModal** (`src/components/AddressOnboardingModal.jsx`)
- Step 1: Interactive map with click-to-place address marker
- Step 2: Address details form with validation
- Saves address to `user_addresses` table in database
- Auto-detects coordinates from map clicks
- Integrates with Leaflet map library

### 4. **Database Tables** (See `DATABASE_MIGRATIONS_ONBOARDING.sql`)

#### `user_addresses`
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to auth.users)
- address_name (VARCHAR)
- street_address (VARCHAR)
- barangay (VARCHAR)
- city (VARCHAR)
- province (VARCHAR)
- postal_code (VARCHAR)
- country (VARCHAR)
- latitude (DECIMAL)
- longitude (DECIMAL)
- is_default (BOOLEAN)
- created_at, updated_at (TIMESTAMP)
```

#### `user_onboarding_state`
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key, Unique)
- profile_complete (BOOLEAN)
- email_verified (BOOLEAN)
- currency_set (BOOLEAN)
- created_at, updated_at (TIMESTAMP)
```

#### `user_onboarding_progress`
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key)
- task_id (VARCHAR)
- completed (BOOLEAN)
- completed_at (TIMESTAMP)
- created_at, updated_at (TIMESTAMP)
- UNIQUE(user_id, task_id)
```

## Setup Instructions

### Step 1: Run Database Migrations
1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Open `DATABASE_MIGRATIONS_ONBOARDING.sql` in this project root
4. Copy and paste all SQL code into the SQL editor
5. Click **Run** button
6. Verify no errors occur

### Step 2: Verify Components Are Integrated
The following integrations have been made:

**HomePage.jsx**:
- ✅ OnboardingChecklist imported and displayed above Quick Stats
- ✅ AddressOnboardingModal added to component
- ✅ Modal state managed with `showAddressOnboardingModal`

### Step 3: Test the Feature
1. Log in as a test user
2. Go to **Home** page
3. You should see the onboarding checklist at the top
4. Click "Start" on "Create Your First Address"
5. Complete the 2-step address creation flow:
   - **Step 1**: Click on map to set location, coordinates auto-populate
   - **Step 2**: Fill in address details (street, barangay, city, etc.)
6. Click "Create Address" button
7. Check that:
   - Address is saved to database
   - Checklist updates to show address task as complete
   - Progress bar increases from 25% to 50%

## Auto-Detection Logic

### Address Detection
- System queries `user_addresses` table for the logged-in user
- If `COUNT(addresses) > 0`, address task is marked complete
- Happens automatically on component mount and after address creation

### Other Task Detection
The system checks:
- **Profile Complete**: Via `user_onboarding_state.profile_complete`
- **Email Verified**: Via `user_onboarding_state.email_verified`
- **Currency Set**: Via `user_onboarding_state.currency_set`

These can be updated by other parts of your app when users complete these actions.

## How To Use in Your App

### Access Onboarding Service
```javascript
import { onboardingService } from '../lib/onboardingService'

// Get all tasks with completion status
const tasks = await onboardingService.getOnboardingTasks(userId)

// Check if user has addresses
const hasAddresses = await onboardingService.hasUserAddresses(userId)

// Get progress
const progress = await onboardingService.getOnboardingProgress(userId)
// Returns: { completed: 1, total: 4, percentage: 25 }

// Mark task complete
await onboardingService.updateTaskCompletion(userId, 'create-address', true)
```

### Update Task Completion from Other Components
When users complete actions in your app, update their onboarding state:

```javascript
// In Profile component
await onboardingService.updateTaskCompletion(userId, 'complete-profile', true)

// In Email Verification component
await onboardingService.updateTaskCompletion(userId, 'verify-email', true)

// In Settings (Currency selector)
await onboardingService.updateTaskCompletion(userId, 'set-currency', true)
```

## Database Queries

### Get User Addresses
```sql
SELECT * FROM user_addresses WHERE user_id = 'user-uuid';
```

### Check Address Count
```sql
SELECT COUNT(*) FROM user_addresses WHERE user_id = 'user-uuid';
```

### Get Onboarding Progress
```sql
SELECT 
  user_id,
  SUM(CASE WHEN completed THEN 1 ELSE 0 END) as completed,
  COUNT(*) as total,
  ROUND(100.0 * SUM(CASE WHEN completed THEN 1 ELSE 0 END) / COUNT(*)) as percentage
FROM user_onboarding_progress
WHERE user_id = 'user-uuid'
GROUP BY user_id;
```

## Incentivization Features

The to-do list encourages participation by:

1. **Visual Progress** - Shows percentage completion with progress bar
2. **Task Categorization** - "Essential" vs "Important" vs "Optional" labels
3. **Completion Feedback** - Green checkmarks and "All completed!" message
4. **Gamification** - Milestone-based design encourages finishing tasks
5. **Integrated Actions** - "Start" buttons directly open relevant modals/pages

## Troubleshooting

### Issue: "user_addresses table doesn't exist"
**Solution**: Run the database migrations from Step 1

### Issue: "Can't insert addresses - permission denied"
**Solution**: Check RLS policies are enabled. Run migrations again to ensure RLS is set up correctly.

### Issue: "Map doesn't load in address modal"
**Solution**: Ensure `leaflet` and `react-leaflet` are installed:
```bash
npm install leaflet react-leaflet
```

### Issue: "Tasks won't update to completed"
**Solution**: 
1. Check user is logged in (userId exists)
2. Check network tab for API errors
3. Verify RLS policies allow user to insert into `user_onboarding_progress`

## Future Enhancements

- [ ] Add reward/incentive system (points, badges)
- [ ] Send email when all tasks completed
- [ ] Add task reminders
- [ ] Connect to loyalty program
- [ ] Track onboarding completion time
- [ ] A/B test task ordering
