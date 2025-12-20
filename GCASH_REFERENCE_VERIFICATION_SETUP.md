# GCash Reference Number Verification

## Overview

The GCash payment method now requires users to provide their transaction reference number to confirm deposits before they're approved and credited to their wallets.

## What Changed

### 1. Database
- Added `reference_number` column to `deposits` table
- Created indexes for faster lookups and GCash-specific queries
- Migration file: `supabase/migrations/103_add_reference_number_to_deposits.sql`

### 2. Components

#### Deposits.jsx
- Added GCash QR code image display when GCash is selected as payment method
- Added reference number input field in the confirmation step
- Updated deposit creation to include reference_number for GCash transactions
- Modified button logic: "Confirm Deposit" now properly calls `handleInitiateDeposit`
- Added reference number display in the recent deposits table

#### GCashDepositVerification.jsx
- New component to display pending GCash deposits
- Allows users to enter/update their GCash reference number
- Verifies reference number and approves deposits automatically

### 3. Services

#### gcashService.js
- `verifyDepositByReference(depositId, referenceNumber)` - Calls the edge function to verify and approve
- `getPendingGCashDeposits(userId)` - Retrieves pending GCash deposits for a user
- `getDepositById(depositId)` - Gets a specific deposit
- `canApproveDeposit(deposit)` - Checks if a deposit can be approved
- `getApprovalStatus(deposit)` - Gets the approval status message

### 4. Supabase Edge Function

#### verify-gcash-deposit
- URL: `/functions/v1/verify-gcash-deposit`
- Method: POST
- Input: `{ depositId, referenceNumber }`
- Output: `{ success, deposit, message }`

**Functionality:**
1. Verifies that the deposit exists and is a GCash deposit
2. Confirms the reference number matches what the user provided
3. Changes status from 'pending' to 'approved'
4. Updates the wallet balance with the deposited amount
5. Sets completion timestamp

## GCash Payment Flow

### User Steps:
1. **Amount Entry**: User enters deposit amount and selects GCash as payment method
2. **Confirmation**: User sees the GCash QR code and merchant details
3. **Payment**: User scans QR code or manually enters merchant details in their GCash app
4. **Reference**: User enters their GCash transaction reference number in the app
5. **Verification**: System verifies the reference and approves the deposit
6. **Completion**: Funds are credited to the user's wallet within seconds

### Status Flow:
```
Pending (awaiting reference) → Approved (verified) → Credited to wallet
```

## Usage Examples

### Frontend - Display verification component in deposits page:
```jsx
import GCashDepositVerification from './components/GCashDepositVerification'

// In your component:
<GCashDepositVerification 
  userId={userId}
  onDepositApproved={(deposit) => {
    console.log('Deposit approved:', deposit)
    // Refresh balance or show success message
  }}
/>
```

### Frontend - Verify a deposit programmatically:
```jsx
import gcashService from './lib/gcashService'

const result = await gcashService.verifyDepositByReference(
  depositId,
  referenceNumber
)

console.log('Approved:', result.deposit)
```

### Admin - Check pending GCash deposits:
```jsx
const pendingDeposits = await gcashService.getPendingGCashDeposits(userId)

pendingDeposits.forEach(deposit => {
  console.log(`${deposit.amount} ${deposit.currency_code} - Ref: ${deposit.reference_number}`)
})
```

## Security Considerations

1. **Reference Number Validation**: System validates that the reference number matches what was recorded
2. **Status Immutability**: Completed deposits cannot be modified (enforced by trigger)
3. **Row-Level Security**: Users can only see/update their own deposits
4. **Wallet Balance**: Only updated after successful verification
5. **Single Approval**: Each deposit can only be approved once

## Testing

### Test GCash Deposit:
1. Go to /deposits page
2. Select GCash as payment method
3. Enter any amount (e.g., 500 PHP)
4. Scan the QR code or note the merchant details
5. Enter reference number (e.g., GCR123456789)
6. Click "Confirm Deposit"
7. Deposit status changes to 'approved' and wallet balance updates

### Admin Verification (via Edge Function):
```bash
curl -X POST http://localhost:54321/functions/v1/verify-gcash-deposit \
  -H "Content-Type: application/json" \
  -d '{
    "depositId": "deposit-uuid-here",
    "referenceNumber": "GCR123456789"
  }'
```

## Database Queries

### Find pending GCash deposits:
```sql
SELECT * FROM deposits
WHERE deposit_method = 'gcash'
  AND status = 'pending'
  AND reference_number IS NOT NULL
ORDER BY created_at DESC;
```

### Get deposit with verification details:
```sql
SELECT id, user_id, amount, currency_code, reference_number, status, created_at
FROM deposits
WHERE id = 'deposit-id'
  AND deposit_method = 'gcash';
```

## Notes

- The QR code image is sourced from the provided URL
- Reference numbers are displayed in the deposits table for admin review
- The system automatically updates wallet balances upon successful verification
- Timestamps track when deposits were created and completed
