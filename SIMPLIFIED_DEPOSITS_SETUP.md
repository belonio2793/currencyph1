# Simplified Deposits System - Setup & Usage Guide

## Overview

The deposits system has been simplified to a clean, straightforward workflow:

1. **User enters amount and currency** - Choose how much to deposit and in which currency
2. **Transaction created as pending** - Deposit record is inserted into database with status `pending`
3. **User selects payment method** - Choose between GCash or Solana
4. **Payment instructions displayed** - User receives clear step-by-step instructions
5. **Admin approval workflow** - SQL manager can update status to `approved` or `rejected`
6. **Wallet crediting** - When approved, wallet is automatically credited with the funds
7. **Wallet management** - Users can select existing wallets or create new ones inline

## Files Changed/Created

### Component
- `src/components/Deposits.jsx` - Complete rewrite with simplified flow

### Database Migrations
- `supabase/migrations/021_add_deposit_statuses.sql` - Adds 'approved' and 'rejected' statuses
- `supabase/functions/process-deposit-approval/index.ts` - Edge function to handle approval and crediting
- `supabase/functions/process-deposit-approval/deno.json` - Configuration for the function

## Setup Instructions

### 1. Apply Database Migration

Run the migration to add the new deposit statuses:

```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Paste the contents of supabase/migrations/021_add_deposit_statuses.sql
# 3. Run
```

### 2. Deploy Edge Function

Deploy the deposit approval handler:

```bash
supabase functions deploy process-deposit-approval
```

### 3. Access the Deposits Page

Users can access deposits at: `/deposit` route (using the sidebar navigation)

## How It Works

### User Flow

1. **Amount & Currency Entry**
   - User enters the amount they want to deposit
   - Selects the target currency (PHP, USD, EUR, etc.)
   - Selects which wallet to deposit funds into
   - Option to create a new wallet inline without disruption

2. **Payment Method Selection**
   - User chooses GCash or Solana
   - Preview of deposit summary shown

3. **Payment Instructions**
   - Clear step-by-step instructions for the selected method
   - For Solana: QR code and address displayed for easy scanning/copying
   - For GCash: Merchant details and payment instructions
   - Important warnings about the method

4. **Pending Status**
   - Deposit record created in `deposits` table with status `pending`
   - User can track recent deposits in the list below

### Admin/Manager Workflow

**Via SQL (Recommended for security)**

```sql
-- Approve a deposit
UPDATE deposits 
SET status = 'approved'
WHERE id = 'deposit-uuid-here'
  AND status = 'pending';

-- Reject a deposit
UPDATE deposits 
SET status = 'rejected'
WHERE id = 'deposit-uuid-here'
  AND status = 'pending';
```

**Via Edge Function (API)**

```bash
curl -X POST https://your-project.supabase.co/functions/v1/process-deposit-approval \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "depositId": "uuid",
    "status": "approved",
    "notes": "Payment verified"
  }'
```

### Automatic Wallet Crediting

When a deposit status is changed to `approved`:

1. The `process-deposit-approval` edge function is manually invoked (or can be triggered via webhook)
2. Wallet balance is increased by the deposit amount
3. A `wallet_transactions` record is created for audit trail
4. `completed_at` timestamp is recorded

## Database Schema

### Deposits Table Status Flow

```
pending → approved → completed (wallet credited)
       → rejected  → failed (deposit denied)
```

**Deposit Status Values:**
- `pending` - Initial state, awaiting user payment and admin approval
- `approved` - Admin approved, wallet ready to be credited
- `rejected` - Admin rejected the deposit
- `processing` - Payment being processed
- `completed` - Deposit completed, wallet credited
- `failed` - Deposit failed (payment issue, etc.)
- `cancelled` - User cancelled the deposit

### Key Columns

```sql
deposits (
  id UUID PRIMARY KEY,
  user_id UUID,              -- Which user
  wallet_id UUID,            -- Which wallet to credit
  amount NUMERIC,            -- How much
  currency_code VARCHAR(16), -- In which currency
  deposit_method TEXT,       -- 'solana', 'gcash', etc.
  status TEXT,               -- Current state
  payment_reference TEXT,    -- Provider's reference
  external_tx_id TEXT,       -- Blockchain/provider TX ID
  description TEXT,          -- Human readable description
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
```

## Features

### Wallet Management
- **View existing wallets** - Shows all user's wallets with balances
- **Create new wallet** - Modal to create wallet for any currency without disrupting flow
- **Currency selection** - Dropdown of all active currencies

### User Experience
- **Multi-step form** - Clean step-by-step flow (amount → method → confirmation)
- **QR code for Solana** - Easy scanning for crypto payments
- **Copy to clipboard** - One-click address copying
- **Recent deposits list** - Track all deposit attempts and their statuses
- **Status badges** - Color-coded status indicators (pending, approved, rejected, etc.)

## Testing

### Manual Test Flow

1. **Create a user account** and log in
2. **Navigate to Deposits** page from sidebar
3. **Test Amount Entry:**
   - Enter amount: 1000
   - Select currency: PHP
   - Verify wallet selection works
   - Create test wallet if needed

4. **Test Method Selection:**
   - Select Solana method
   - Review displayed address and instructions
   - Go back and select GCash method
   - Review GCash instructions

5. **Test Deposit Creation:**
   - Fill in amount and select wallet
   - Choose a method
   - Click to proceed
   - Verify deposit appears in "Recent Deposits" with `pending` status

6. **Test Admin Approval:**
   - As admin, go to Supabase Dashboard
   - Find the deposit in the `deposits` table
   - Update status to `approved`
   - Verify wallet balance increases
   - Verify wallet_transactions record created

## API Reference

### POST /functions/v1/process-deposit-approval

**Request Body:**
```json
{
  "depositId": "UUID",
  "status": "approved" | "rejected",
  "notes": "Optional notes"
}
```

**Response:**
```json
{
  "success": true,
  "deposit": { /* updated deposit record */ },
  "message": "Deposit approved and wallet credited"
}
```

## Security Considerations

1. **RLS Policies** - Users can only view/insert their own deposits
2. **Status Immutability** - Deposit core fields are immutable once created
3. **Service Role Required** - Wallet crediting uses service role for security
4. **Audit Trail** - All changes recorded in wallet_transactions
5. **SQL Manager Access** - Use service role or special auth role for admin operations

## Troubleshooting

### Deposit not showing in list
- Verify user is logged in
- Check browser console for errors
- Ensure wallets are loaded

### Wallet creation fails
- Verify currency code is valid
- Check user has permissions to create wallets
- Ensure user_id matches authenticated user

### Wallet not credited after approval
- Verify deposit status is exactly 'approved'
- Check that process-deposit-approval function was called
- Review edge function logs in Supabase dashboard
- Ensure wallet_id is valid and exists

## Future Enhancements

- Add webhook integration for automatic payment confirmation
- Support for more payment methods (Stripe, PayMaya, etc.)
- Batch approval interface for managers
- Email notifications for status changes
- Analytics and reporting dashboard
