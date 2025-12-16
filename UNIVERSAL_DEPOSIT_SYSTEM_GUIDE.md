# Universal Deposit System - Complete Implementation Guide

## Overview

A comprehensive, production-ready global deposit system that accepts multiple payment methods (fiat, cryptocurrency, mobile payments) and automatically credits user wallets. The system supports 15+ payment methods across all major regions worldwide.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   UniversalDeposit Component (UI)               │
│              - Payment method selection                         │
│              - Amount input with validation                     │
│              - Confirmation workflow                            │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP POST
                         ↓
         ┌───────────────────────────────┐
         │  process-deposit Edge Function│
         │  - Route by payment method    │
         │  - Call payment providers     │
         │  - Store deposit record       │
         └───────────────┬───────────────┘
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
   ┌─────────┐   ┌────────────┐   ┌──────────┐
   │ Stripe  │   │ GCash      │   │ Crypto   │
   │ PayMaya │   │ Instapay   │   │ Wise     │
   │ Remitly │   │ Bank Xfer  │   │ PayPal   │
   └────┬────┘   └─────┬──────┘   └────┬─────┘
        │              │               │
        └──────────────┼───────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │  Webhook Callbacks (Async)         │
    │  deposit-webhook Edge Function     │
    │  - Payment confirmation            │
    │  - Status updates                  │
    │  - Balance crediting               │
    └──────────────────┼──────────────────┘
                       │
         ┌─────────────┴──────────────┐
         ↓                            ↓
    ┌──────────────┐        ┌───────────────────┐
    │   deposits   │        │  Wallet Functions │
    │   table      │        │  - Credit balance │
    │              │        │  - Record tx      │
    └──────────────┘        │  - Validate      │
                            │  - Check limits  │
                            └───────────────────┘
```

## Components Created

### 1. **Deposit Service Library** (`src/lib/depositService.js`)
Client-side SDK for deposit management.

**Key Classes:**
- `DepositService` - Main service class

**Key Methods:**
- `initialize(userId)` - Set up service with user context
- `getAvailableMethods(country, currency)` - Get region-specific payment methods
- `initiateDeposit(amount, currency, method, details)` - Start deposit process
- `getDepositStatus(depositId)` - Check deposit progress
- `getDepositHistory(limit, offset)` - Get user's deposit records
- `validateDeposit(amount, currency, method)` - Verify against limits
- `cancelDeposit(depositId)` - Cancel pending deposits

**Supported Payment Methods:**
- Stripe (credit/debit card)
- GCash (mobile payment, PH)
- PayMaya (mobile wallet, PH)
- InstaPay (instant transfer, PH)
- Coins.ph (crypto gateway)
- Cryptocurrency Direct (all major chains)
- Bank Transfer (international)
- Wise (low-cost transfer)
- Remitly (remittance)
- PayPal
- Wallet Balance (internal transfer)

### 2. **Process Deposit Edge Function** (`supabase/functions/process-deposit/index.ts`)
Backend processor for all deposit types.

**Endpoints:**
- POST `/functions/v1/process-deposit`

**Handles:**
- Stripe payment intents creation
- GCash QR code generation
- PayMaya checkout creation
- Cryptocurrency wallet address generation
- Bank transfer details compilation
- Wise quote creation

**Returns:**
- `depositId` - Unique deposit identifier
- `paymentReference` - Human-readable reference
- `redirectUrl` - Payment page URL (if applicable)
- `qrCode` - QR code for mobile payments
- `bankDetails` - Account details for transfers

### 3. **Deposit Webhook Handler** (`supabase/functions/deposit-webhook/index.ts`)
Processes payment confirmations asynchronously.

**Webhook Handlers:**
- **Stripe**: Handles `payment_intent.succeeded` and `payment_intent.payment_failed`
- **GCash**: Processes transaction completion/failure notifications
- **PayMaya**: Handles checkout completion events
- **Wise**: Processes transfer outcome events

**On Confirmation:**
1. Verify webhook signature
2. Find matching deposit record
3. Update deposit status to "completed"
4. Credit user wallet balance
5. Record transaction in audit trail
6. Send confirmation notification

### 4. **UniversalDeposit React Component** (`src/components/UniversalDeposit.jsx`)
Complete UI for deposit workflow.

**Features:**
- Step-by-step wizard (method → amount → confirm → processing)
- Region-based method availability
- Real-time validation
- QR code display for mobile payments
- Bank details with copy functionality
- Error handling and user feedback
- Mobile-responsive design

**Workflow:**
1. **Method Selection** - Browse available payment methods
2. **Amount Input** - Enter deposit amount with validation
3. **Confirmation** - Review details before proceeding
4. **Processing** - Display success, payment details, or redirect

### 5. **Database Functions** (`supabase/migrations/999_create_deposit_functions.sql`)
PostgreSQL functions for atomic balance operations.

**Key Functions:**

#### `record_deposit_transaction()`
Atomically record deposit and credit balance.
- Locks wallet row (prevent race conditions)
- Updates wallet balance
- Records transaction in audit trail
- Returns new balance

#### `verify_and_credit_deposit()`
Verify and process a pending deposit.
- Validates deposit exists
- Prevents duplicate processing
- Calls `record_deposit_transaction()`
- Returns success/error

#### `process_pending_deposits()`
Batch process confirmed deposits.
- Handles 100 deposits per run
- Safe for scheduled jobs
- Returns statistics

#### `get_deposit_status_with_balance()`
Get detailed deposit info with current balance.

#### `get_user_deposit_summary()`
Get summary of user's deposits by method/status.

#### `validate_deposit_limits()`
Check daily/monthly deposit limits.
- Daily limit: $50,000
- Monthly limit: $500,000
- Customizable per user

#### `refund_deposit()`
Reverse a deposit and restore balance.
- Only works on completed deposits
- Records refund transaction
- Updates deposit status

## Setup Instructions

### 1. Environment Variables

Add to `.env.local`:

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# GCash
GCASH_API_KEY=...
GCASH_WEBHOOK_SECRET=...

# PayMaya
PAYMAYA_API_KEY=...
PAYMAYA_WEBHOOK_SECRET=...

# Wise
WISE_API_KEY=...
WISE_WEBHOOK_SECRET=...

# Webhook URLs
VITE_WEBHOOK_BASE_URL=https://your-domain.com
```

### 2. Deploy Supabase Functions

```bash
# Deploy process-deposit function
supabase functions deploy process-deposit

# Deploy deposit-webhook function
supabase functions deploy deposit-webhook
```

### 3. Apply Database Migration

```bash
# Run migration to create functions
supabase db push

# Or manually run SQL:
psql postgresql://... < supabase/migrations/999_create_deposit_functions.sql
```

### 4. Configure Webhooks

For each payment provider, set webhook URL:

```
Stripe: https://your-domain.com/functions/v1/deposit-webhook?provider=stripe
GCash: https://your-domain.com/functions/v1/deposit-webhook?provider=gcash
PayMaya: https://your-domain.com/functions/v1/deposit-webhook?provider=paymaya
Wise: https://your-domain.com/functions/v1/deposit-webhook?provider=wise
```

### 5. Create Supabase Context (if not exists)

Ensure you have `SupabaseContext` set up in your app:

```jsx
// src/context/SupabaseContext.jsx
import { createContext, useContext } from 'react'
import { createClient } from '@supabase/supabase-js'

const SupabaseContext = createContext()

export function SupabaseProvider({ children }) {
  const supabase = createClient(
    import.meta.env.VITE_PROJECT_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )

  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  )
}

export function useSupabaseContext() {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabaseContext must be used within SupabaseProvider')
  }
  return context
}
```

## Usage Example

### In Your App

```jsx
import { useState } from 'react'
import UniversalDeposit from './components/UniversalDeposit'

export function WalletPage() {
  const [showDeposit, setShowDeposit] = useState(false)

  return (
    <div>
      <button onClick={() => setShowDeposit(true)}>
        Add Funds
      </button>

      {showDeposit && (
        <UniversalDeposit
          onSuccess={() => {
            setShowDeposit(false)
            // Refresh wallet balance
          }}
          onClose={() => setShowDeposit(false)}
        />
      )}
    </div>
  )
}
```

### Programmatic Usage

```jsx
import DepositService from './lib/depositService'
import { useSupabaseContext } from './context/SupabaseContext'

function MyComponent() {
  const { supabase } = useSupabaseContext()

  const handleDeposit = async () => {
    const service = new DepositService(supabase)
    await service.initialize(userId)

    // Get available methods
    const { methods, region } = service.getAvailableMethods('US', 'USD')

    // Initiate deposit
    const result = await service.initiateDeposit(
      100, // amount
      'USD', // currency
      'stripe', // method
      { /* method details */ }
    )

    console.log('Deposit created:', result.depositId)
  }

  return <button onClick={handleDeposit}>Deposit</button>
}
```

## Payment Method Configuration

### Stripe (Cards)
- **Min**: $1
- **Max**: $99,999
- **Fee**: 2.9% + $0.30
- **Time**: 1-3 days
- **Webhook**: Automatic

### GCash (Philippines Mobile)
- **Min**: ₱100
- **Max**: ₱50,000
- **Fee**: None
- **Time**: Instant
- **Features**: QR code, SMS notification

### PayMaya (Philippines)
- **Min**: ₱100
- **Max**: ₱50,000
- **Fee**: None
- **Time**: Instant

### InstaPay (Philippines Banks)
- **Min**: ₱100
- **Max**: ₱100,000
- **Fee**: ₱5-10
- **Time**: Instant

### Cryptocurrency Direct
- **Min**: 0.001 (per token)
- **Max**: 999,999
- **Fee**: Network fee only
- **Time**: Varies by chain
- **Chains**: Ethereum, Solana, Polygon, Arbitrum, Bitcoin, etc.

### Bank Transfer (International)
- **Min**: $100
- **Max**: $999,999
- **Fee**: $5-30 (bank dependent)
- **Time**: 1-5 days
- **Manual confirmation needed

### Wise (TransferWise)
- **Min**: $100
- **Max**: $999,999
- **Fee**: 0.41% or less
- **Time**: 1-3 days

## Database Schema

### Deposits Table

```sql
deposits {
  id: UUID PRIMARY KEY
  user_id: UUID (FK users)
  wallet_id: UUID (FK wallets)
  amount: NUMERIC(36,8)
  currency_code: VARCHAR(16)
  deposit_method: TEXT
  status: TEXT (pending|processing|completed|failed|cancelled|refunded)
  payment_reference: TEXT
  external_tx_id: TEXT (unique per method)
  transaction_id: UUID (FK wallet_transactions)
  phone_number: TEXT
  payment_address: TEXT
  qr_code_data: TEXT
  description: TEXT
  notes: TEXT
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
  completed_at: TIMESTAMPTZ
}
```

### Indexes
- `user_id, status` (fast status queries)
- `created_at DESC` (recent deposits)
- `external_tx_id` (webhook lookups)
- `deposit_method` (analytics)

## Security Considerations

1. **Webhook Signature Verification** - All webhooks should verify provider signature
2. **Rate Limiting** - Implement rate limiting on deposit endpoints
3. **Amount Validation** - Always validate amounts server-side
4. **API Keys** - Store in environment variables, never commit
5. **HTTPS Only** - Enforce TLS for all API calls
6. **RLS Policies** - Users can only access their own deposits
7. **Audit Trail** - All transactions recorded in wallet_transactions
8. **Immutability** - Completed deposits cannot be modified

## Troubleshooting

### Deposit Not Confirming
1. Check webhook logs in Supabase
2. Verify provider API key is correct
3. Ensure webhook URL is accessible
4. Check deposit status: `SELECT * FROM deposits WHERE id = '...'`

### Balance Not Updated
1. Verify function executed: `SELECT * FROM wallet_transactions WHERE reference_id = '...'`
2. Check wallet exists: `SELECT * FROM wallets WHERE id = '...'`
3. Review function error logs
4. Run: `SELECT verify_and_credit_deposit('deposit_id')`

### Payment Provider Errors
1. Verify API credentials are correct
2. Check provider's API status page
3. Review provider webhook logs
4. Test with provider's sandbox/test mode first

## Monitoring

### Key Metrics
- Deposit conversion rate (initiated → completed)
- Average processing time per method
- Failed deposits by reason
- User deposit patterns by region/method
- Revenue by payment method

### Database Queries

**Daily deposits:**
```sql
SELECT deposit_method, COUNT(*), SUM(amount)
FROM deposits
WHERE status = 'completed'
  AND created_at::date = TODAY()
GROUP BY deposit_method
```

**Pending deposits:**
```sql
SELECT id, user_id, amount, created_at
FROM deposits
WHERE status IN ('pending', 'processing')
  AND created_at < NOW() - INTERVAL '1 hour'
```

**Failed deposits:**
```sql
SELECT *, AGE(NOW(), created_at) as age
FROM deposits
WHERE status = 'failed'
ORDER BY created_at DESC
```

## Advanced Features

### Custom Deposit Methods

Add a new payment method:

1. Update `DEPOSIT_METHODS` in `depositService.js`
2. Add method details in `getMethodDetails()`
3. Create processor in `process-deposit/index.ts`
4. Add webhook handler in `deposit-webhook/index.ts`
5. Update region availability in `PAYMENT_REGIONS`

### Recurring Deposits

Create scheduled deposits via cron:

```sql
-- Create deposits_schedule table
CREATE TABLE deposits_schedule (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  amount NUMERIC,
  currency TEXT,
  method TEXT,
  frequency TEXT, -- daily, weekly, monthly
  next_deposit_at TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT true
);

-- Run via Edge Function on schedule
SELECT * FROM deposits_schedule
WHERE enabled AND next_deposit_at <= NOW()
```

### Multi-Currency Conversion

Use exchange rate API for automatic conversion:

```javascript
const rate = await getExchangeRate('USD', 'PHP')
const phpAmount = usdAmount * rate
```

## Performance Optimization

1. **Index deposits table** on frequently queried columns
2. **Archive old deposits** to separate table after 1 year
3. **Cache method availability** per region
4. **Batch webhook processing** for high volume
5. **Use connection pooling** for database

## Testing

### Unit Tests

```javascript
// Test deposit validation
const validation = await service.validateDeposit(100, 'USD', 'stripe')
expect(validation.valid).toBe(true)

// Test method selection
const methods = service.getAvailableMethods('PH', 'PHP')
expect(methods.some(m => m.id === 'gcash')).toBe(true)
```

### Integration Tests

```javascript
// Test full deposit flow
const result = await service.initiateDeposit(100, 'USD', 'stripe', {})
expect(result.success).toBe(true)
expect(result.depositId).toBeDefined()

// Test webhook processing
await processWebhook(stripeEvent)
const deposit = await service.getDepositStatus(depositId)
expect(deposit.status).toBe('completed')
```

## Migration from Existing System

If migrating from another payment system:

1. Create `deposits` table with existing data
2. Populate `wallets` table
3. Create corresponding `wallet_transactions` records
4. Run `validate_deposit_limits()` to set proper limits
5. Test with small deposits before full migration

## Support & Documentation

- Stripe: https://stripe.com/docs
- GCash: https://developers.gcash.com
- PayMaya: https://help.paymaya.com/api
- Coins.ph: https://coins.ph/api
- Wise: https://wise.com/api

## License

This deposit system is part of the Currency.PH application.

---

**Last Updated**: December 2025
**Version**: 1.0.0
**Status**: Production Ready
