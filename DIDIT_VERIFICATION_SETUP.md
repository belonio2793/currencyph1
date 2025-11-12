# DIDIT Identity Verification Integration Guide

This guide explains how the DIDIT identity verification system works and how to complete the setup.

## Overview

The DIDIT integration enables secure, government-backed identity verification for users in the P2P lending marketplace. The system uses DIDIT's API to create verification sessions and capture verified identity data.

## Architecture

### Components

1. **Frontend Modal** (`src/components/DiditVerificationModal.jsx`)
   - Shows DIDIT verification iframe to users
   - Polls for status changes every second
   - Handles session initialization and status updates
   - Supports both API-generated and pre-configured session URLs

2. **Edge Functions** (in `supabase/functions/`)
   - `didit-create-session`: Creates new verification sessions via DIDIT API
   - `didit-check-status`: Checks session status and extracts metadata
   - `didit-webhook`: Handles webhook callbacks from DIDIT with verification results

3. **Database** (`supabase/migrations/015_add_didit_verification.sql`)
   - `user_verifications` table stores verification data
   - `didit_decision` JSONB column stores extracted metadata
   - RPC function `update_verification_from_didit` handles updates

4. **Services** (`src/lib/`)
   - `diditDirectService.js`: Main client service for verification operations
   - `diditService.js`: Legacy service (for reference)

## Setup Instructions

### 1. Environment Variables

These variables are already configured:

```
DIDIT_APP_ID=e884d47b-33bb-412a-a571-c4ed2b716ace
DIDIT_API_KEY=UjUxKvHnFXL1wBvZpL5XLlQhAe0GXqsheFU9k1Clrxo
DIDIT_WORKFLOW_ID=839aad82-01d3-48e2-8f26-9677d3e0e255
DIDIT_WEBHOOK_SECRET=dZJcUZQm3y2kweH4S74KIr7MTfGu5yjmvJgp2qfhyq8
```

The Vite-prefixed versions (`VITE_DIDIT_*`) are for client-side use in the browser.

#### Optional Configuration

To use a pre-configured default session URL instead of creating sessions dynamically:

```
VITE_DIDIT_DEFAULT_SESSION_URL=https://verify.didit.me/session/0YcwjP8Jj41H
```

### 2. Webhook Configuration in DIDIT Dashboard

1. Log in to DIDIT dashboard
2. Navigate to **Settings** → **Webhooks**
3. Configure webhook URL: `https://[YOUR_DOMAIN]/functions/v1/didit-webhook`
4. Set webhook secret: The value from `DIDIT_WEBHOOK_SECRET` env variable
5. Subscribe to events: Select "Verification Completed" events
6. Save and test the webhook

### 3. Database Migration

The database schema is already set up via migrations. The `user_verifications` table includes:

```sql
-- DIDIT-specific columns
didit_workflow_id VARCHAR(255)
didit_session_id VARCHAR(255)
didit_session_url VARCHAR(500)
didit_decision JSONB -- Contains extracted identity data
didit_verified_at TIMESTAMPTZ
document_type VARCHAR(100) -- passport, national_id, driver_license
is_public BOOLEAN DEFAULT FALSE
verification_method VARCHAR(50) DEFAULT 'didit'
```

## Usage Flow

### User Initiates Verification

1. User clicks "Start Verification" in Profile Settings
2. Modal opens and calls `createVerificationSession(userId)`
3. Edge function creates session via DIDIT API
4. Session URL and ID stored in database

### Modal Displays Verification

1. iframe loads with DIDIT verification UI
2. User completes identity verification process
3. DIDIT iframe signals completion
4. Modal polls `didit-check-status` every second

### Status Updates

When verification completes, the status can be:

- **Approved**: Identity successfully verified
- **Declined**: Verification failed or rejected
- **Expired**: Session expired without completion
- **Pending**: Still in progress

### Metadata Extraction

When DIDIT completes verification, the `decision` object is stored in `didit_decision` JSONB column. This includes:

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "full_name": "John Doe",
  "date_of_birth": "1990-01-01",
  "age": 34,
  "gender": "M",
  "address": "123 Main St",
  "document_type": "passport",
  "document_number": "AB123456",
  "personal_number": "1990-01-01-1234",
  "expiration_date": "2030-01-01",
  "date_of_issue": "2020-01-01",
  "issuing_state": "CA",
  "issuing_state_name": "California",
  "portrait_image": "data:image/jpeg;base64,...",
  "front_image": "data:image/jpeg;base64,...",
  "back_image": "data:image/jpeg;base64,...",
  "front_video": "data:video/mp4;base64,...",
  "back_video": "data:video/mp4;base64,...",
  "full_front_image": "data:image/jpeg;base64,...",
  "full_back_image": "data:image/jpeg;base64,...",
  "full_body_image": "data:image/jpeg;base64,..."
}
```

## API Reference

### Edge Functions

#### `didit-create-session` (POST)

Creates a new DIDIT verification session.

**Request:**
```javascript
const { data, error } = await supabase.functions.invoke('didit-create-session', {
  method: 'POST',
  body: JSON.stringify({ userId: 'user-uuid' }),
})
```

**Response:**
```json
{
  "success": true,
  "sessionUrl": "https://verify.didit.me/session/xyz123",
  "sessionId": "xyz123",
  "data": { /* verification record */ }
}
```

#### `didit-check-status` (POST)

Checks the status of a verification session and extracts metadata.

**Request:**
```javascript
const { data, error } = await supabase.functions.invoke('didit-check-status', {
  method: 'POST',
  body: JSON.stringify({ sessionId: 'xyz123' }),
})
```

**Response:**
```json
{
  "status": "Approved|Declined|Expired|Pending",
  "decision": { /* metadata */ },
  "session_id": "xyz123"
}
```

#### `didit-webhook` (POST)

Receives verification completion notifications from DIDIT.

**DIDIT sends:**
```json
{
  "session_id": "xyz123",
  "status": "Approved",
  "decision": { /* metadata */ },
  "workflow_id": "...",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Headers:**
- `x-signature`: HMAC-SHA256(body + secret)

### Client Service

#### `diditDirectService.createVerificationSession(userId)`

```javascript
import { diditDirectService } from '../lib/diditDirectService'

const result = await diditDirectService.createVerificationSession(userId)
// {
//   success: true,
//   sessionUrl: "https://verify.didit.me/session/xyz123",
//   sessionId: "xyz123",
//   data: { /* verification record */ }
// }
```

#### `diditDirectService.getVerificationStatus(userId)`

```javascript
const status = await diditDirectService.getVerificationStatus(userId)
// {
//   id: "...",
//   user_id: "...",
//   status: "pending|approved|rejected",
//   didit_session_id: "xyz123",
//   didit_session_url: "...",
//   didit_decision: { /* metadata */ },
//   didit_verified_at: "2024-01-01T00:00:00Z",
//   document_type: "passport",
//   is_public: false,
//   ...
// }
```

#### `diditDirectService.checkSessionStatus(sessionId)`

```javascript
const status = await diditDirectService.checkSessionStatus(sessionId)
// {
//   status: "Approved|Declined|Expired|Pending",
//   decision: { /* metadata */ },
//   session_id: "xyz123"
// }
```

#### `diditDirectService.registerExternalSession(userId, sessionUrl)`

Registers a pre-configured session URL (fallback when API fails):

```javascript
const result = await diditDirectService.registerExternalSession(
  userId,
  'https://verify.didit.me/session/0YcwjP8Jj41H'
)
// { success: true, data: { /* verification record */ } }
```

#### `diditDirectService.makeVerificationPublic(userId)`

```javascript
await diditDirectService.makeVerificationPublic(userId)
```

#### `diditDirectService.makeVerificationPrivate(userId)`

```javascript
await diditDirectService.makeVerificationPrivate(userId)
```

## Integration Points

### Profile Component

The identity verification section is in `src/components/Profile.jsx`:

- Line 591-644: Identity Verification card
- Shows verification status
- "Start Verification" button opens modal
- "Make Public/Private" toggle for visibility

### Database Schema

Key tables:

- `user_verifications`: Main verification records
- `lender_profiles`: Links to lending stats (synced via trigger)
- `users_public_profile` view: Public-facing profile data

### RLS Policies

- Users can view/update their own verification
- Community managers can view all verifications
- Only approved verifications are publicly visible

## Troubleshooting

### Session Creation Fails

1. Check environment variables are set correctly
2. Verify DIDIT API key is valid
3. Check DIDIT workflow ID exists in DIDIT dashboard
4. Ensure edge functions are deployed

### Webhook Not Updating Database

1. Verify webhook URL is correct in DIDIT dashboard
2. Check webhook secret matches `DIDIT_WEBHOOK_SECRET`
3. Look at Supabase function logs: `supabase functions list` and view logs
4. Verify RPC function `update_verification_from_didit` exists

### Modal Not Showing Iframe

1. Verify session URL is valid
2. Check browser console for iframe errors
3. DIDIT might require specific domain configuration
4. Check CORS settings if using custom domain

### Status Not Updating in Real-time

1. Check if webhook is configured (immediate updates)
2. Modal polls every second as fallback
3. Check network requests in browser dev tools
4. Verify database has correct session ID

## Security Considerations

1. **Decision Data**: DIDIT personal information is stored in `didit_decision` JSONB column
   - Consider encrypting this column in production
   - Set appropriate RLS policies

2. **Session URLs**: Should be ephemeral and time-limited
   - DIDIT sessions expire automatically
   - Verify expiration logic

3. **Webhook Signatures**: Always verify DIDIT webhook signatures
   - Implemented in `didit-webhook` function
   - Uses HMAC-SHA256 with `DIDIT_WEBHOOK_SECRET`

4. **RLS Policies**: Restrict verification data access
   - Only users can see their own verification
   - Community managers can view pending verifications
   - Public profiles only show approved verifications

## Monitoring

### Check Verification Status

```sql
SELECT user_id, status, document_type, didit_verified_at, is_public
FROM user_verifications
WHERE status = 'approved'
ORDER BY didit_verified_at DESC;
```

### Check Pending Verifications

```sql
SELECT user_id, status, submitted_at, didit_session_id
FROM user_verifications
WHERE status = 'pending'
ORDER BY submitted_at DESC;
```

### Verify Webhook Payload Structure

```sql
SELECT user_id, didit_decision->>'first_name' as first_name,
       didit_decision->>'document_type' as document_type,
       didit_decision->>'expiration_date' as expiration_date
FROM user_verifications
WHERE didit_decision IS NOT NULL
LIMIT 10;
```

## Related Documentation

- DIDIT API: https://docs.didit.me
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Identity Verification Pattern: P2P Lending marketplace requirements

## Support

For issues with:
- **DIDIT API**: Contact DIDIT support
- **Edge functions**: Check Supabase dashboard logs
- **Database**: Review migration files and RLS policies
- **Frontend**: Check browser console and network tab
