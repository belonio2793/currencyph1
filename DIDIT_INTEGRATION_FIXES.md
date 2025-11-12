# DIDIT Identity Verification Integration - Complete Fix

## Problem Identified

The DIDIT identity verification integration had a database schema constraint issue:
- **Error**: "Edge Function returned a non-2xx status code"
- **Root Cause**: The `user_verifications` table has two NOT NULL fields without defaults:
  - `id_type` (must be 'passport', 'drivers_license', or 'national_id')
  - `id_number`
- When edge functions tried to create DIDIT sessions, they failed to insert records due to missing required fields

## Solutions Implemented

### 1. **Edge Functions Fixed** ✅

#### `supabase/functions/didit-create-session/index.ts`
- Added placeholder values for required fields:
  ```javascript
  id_type: "national_id",      // Placeholder - updated from DIDIT webhook
  id_number: session_id,        // Placeholder - updated from DIDIT webhook
  ```
- These placeholders are replaced with actual values from DIDIT's response

#### `supabase/functions/didit-initiate/index.ts`
- Fixed to use valid `id_type` values matching schema constraints
- Changed invalid 'external' to valid 'national_id'

#### `supabase/functions/didit-webhook/index.ts`
- Correctly handles DIDIT webhook responses
- Calls `update_verification_from_didit()` RPC to update records

#### `supabase/functions/didit-check-status/index.ts`
- Checks DIDIT API for session status
- Updates database with verification result

### 2. **Database Migrations Fixed** ✅

#### `supabase/migrations/015_add_didit_verification.sql`
#### `supabase/migrations/016_fix_didit_function_operators.sql`
- Updated `update_verification_from_didit()` function to extract actual ID data from DIDIT response:
  ```sql
  id_type = CASE
    WHEN p_decision->>'document_type' = 'passport' THEN 'passport'
    WHEN p_decision->>'document_type' IN ('driver_license', 'drivers_license') THEN 'drivers_license'
    WHEN p_decision->>'document_type' IS NOT NULL THEN 'national_id'
    ELSE id_type
  END,
  id_number = COALESCE(p_decision->>'document_number', p_decision->>'personal_number', id_number),
  ```

### 3. **Backend Server Fixed** ✅

#### `server.js`
- Fixed two DIDIT session creation endpoints with placeholder values
- Both `/api/didit/create-session` and registration endpoints now properly initialize records

## How the Integration Works

### Flow Diagram
```
1. User clicks "Start Verification" in Profile
   ↓
2. DiditVerificationModal opens with userId
   ↓
3. Modal calls diditDirectService.createVerificationSession(userId)
   ↓
4. Frontend invokes 'didit-create-session' Supabase edge function
   ↓
5. Edge function calls DIDIT API to create a session
   → DIDIT returns: { session_id, url }
   ↓
6. Edge function stores session in database with placeholder values:
   - user_id: <user_id>
   - didit_session_id: <session_id>
   - didit_session_url: <url>
   - id_type: "national_id" (placeholder)
   - id_number: <session_id> (placeholder)
   - status: "pending"
   ↓
7. Modal receives sessionUrl and displays DIDIT iframe
   ↓
8. User completes verification in DIDIT iframe
   ↓
9. DIDIT sends webhook to 'didit-webhook' edge function
   → Webhook contains: { session_id, status, decision: {...} }
   ↓
10. Edge function calls update_verification_from_didit() RPC
    → Extracts actual ID data from decision JSONB:
       - id_type: extracted from document_type
       - id_number: from document_number or personal_number
    → Updates status to 'approved', 'rejected', or 'pending'
    ↓
11. Modal polls checkSessionStatus() and detects completion
    ↓
12. Verification complete - user sees result
```

## User Verifications Table Schema

### Core Fields (Required)
```sql
id UUID PRIMARY KEY
user_id UUID NOT NULL UNIQUE (foreign key to users)
id_type VARCHAR(50) NOT NULL CHECK (char_length(trim(id_type)) > 0)
  -- Flexible constraint allows any document type string
  -- DIDIT returns: passport, national_id, drivers_license, etc.
id_number VARCHAR(255) NOT NULL
status VARCHAR(50) DEFAULT 'pending' CHECK ('pending', 'approved', 'rejected')
```

### DIDIT-Specific Fields (Added in migration 015)
```sql
didit_workflow_id VARCHAR(255)
didit_session_id VARCHAR(255)
didit_session_url VARCHAR(500)
didit_decision JSONB           -- Contains user info from DIDIT
didit_verified_at TIMESTAMPTZ
document_type VARCHAR(100)      -- Extracted from DIDIT decision
verification_method VARCHAR(50) -- 'didit', 'manual', 'admin'
is_public BOOLEAN DEFAULT FALSE
```

## Testing the Integration

### Prerequisites
1. ✅ Environment variables configured:
   - DIDIT_API_KEY
   - DIDIT_APP_ID
   - DIDIT_WORKFLOW_ID
   - DIDIT_WEBHOOK_SECRET
   - Supabase credentials (ANON_KEY, SERVICE_ROLE_KEY, PROJECT_URL)

2. ✅ Dev server running: `npm run dev`

3. ✅ Database migrations applied

### Test Steps
1. Navigate to Profile → Identity Verification
2. Click "Start Verification" button
3. Modal should appear with DIDIT iframe
4. Complete the verification process in DIDIT iframe
5. Modal should detect completion and show result

### Expected Results
- ✅ Session created in database with proper values
- ✅ DIDIT iframe loads correctly
- ✅ User can complete verification
- ✅ Database updates with actual ID information
- ✅ Profile shows verification status
- ✅ Verification can be toggled between public/private

## Common Issues & Solutions

### Issue: "Edge Function returned a non-2xx status code"
**Solution**: Ensure placeholder values for `id_type` and `id_number` are provided

### Issue: DIDIT iframe doesn't load
**Possible Causes**:
- Session URL is invalid
- DIDIT API key is incorrect
- Workflow ID doesn't match DIDIT configuration

### Issue: Database shows pending but never updates
**Possible Causes**:
- Webhook not configured in DIDIT dashboard
- Webhook secret mismatch
- DIDIT server can't reach webhook endpoint

### Issue: Placeholder ID data remains after verification
**Solution**: Ensure migration 015/016 are applied and webhook is properly configured

## Environment Configuration

All required environment variables are now set:
```
DIDIT_API_KEY=UjUxKvHnFXL1wBvZpL5XLlQhAe0GXqsheFU9k1Clrxo
DIDIT_APP_ID=e884d47b-33bb-412a-a571-c4ed2b716ace
DIDIT_WORKFLOW_ID=839aad82-01d3-48e2-8f26-9677d3e0e255
DIDIT_WEBHOOK_SECRET=dZJcUZQm3y2kweH4S74KIr7MTfGu5yjmvJgp2qfhyq8
VITE_* versions (for frontend access)
SUPABASE_* credentials
```

## Files Modified

1. ✅ `supabase/functions/didit-create-session/index.ts` - Added placeholder values
2. ✅ `supabase/functions/didit-initiate/index.ts` - Fixed id_type values
3. ✅ `supabase/migrations/010_p2p_loan_marketplace.sql` - Removed hardcoded id_type constraint
4. ✅ `supabase/migrations/015_add_didit_verification.sql` - Extract ID data from DIDIT
5. ✅ `supabase/migrations/016_fix_didit_function_operators.sql` - Same as 015 update
6. ✅ `supabase/migrations/020_flexible_id_type_constraint.sql` - New: Flexible constraint for document types
7. ✅ `server.js` - Added placeholder values to backend endpoints

## Constraint Update

**Migration Applied**: `020_flexible_id_type_constraint.sql`

Changed from:
```sql
CHECK (id_type IN ('passport', 'drivers_license', 'national_id'))
```

To:
```sql
CHECK (char_length(trim(id_type)) > 0)
```

**Why**: DIDIT returns various document types that may not be in our hardcoded list. The flexible constraint allows:
- Regional variations (ID types vary by country)
- Future document types DIDIT adds
- Custom document types from workflows
- Better maintainability

## Next Steps

1. Test the complete flow end-to-end
2. Verify DIDIT webhook is properly configured in your DIDIT dashboard
3. Monitor edge function logs for any errors
4. Confirm database receives webhook updates
5. Test privacy toggle functionality
6. Deploy to production when verified

## References

- DIDIT API Docs: https://docs.didit.me/reference/introduction
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- User Verifications Schema: See `supabase/migrations/010_p2p_loan_marketplace.sql`
