# Universal Deposit System - Quick Start (5 Minutes)

## 1. Add Environment Variables

Add to `.env.local` (one payment provider minimum):

```bash
# Stripe (for card deposits)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# GCash (for Philippines)
GCASH_API_KEY=xxx
GCASH_WEBHOOK_SECRET=xxx

# Cryptocurrency
VITE_THIRDWEB_CLIENT_ID=xxx

# Webhook base URL
VITE_WEBHOOK_BASE_URL=https://localhost:3000
```

## 2. Deploy Functions (1 minute)

```bash
# Deploy the two main functions
supabase functions deploy process-deposit
supabase functions deploy deposit-webhook

# Verify they're running
curl https://your-project.supabase.co/functions/v1/process-deposit -X OPTIONS
```

## 3. Apply Database Migration (1 minute)

```bash
# Apply the migration
supabase db push

# Or run manually in Supabase Dashboard > SQL Editor:
\i supabase/migrations/999_create_deposit_functions.sql
```

## 4. Add to Your App (2 minutes)

### Option A: Modal Dialog (Recommended)

```jsx
import { useState } from 'react'
import UniversalDeposit from './components/UniversalDeposit'

export function MyWallet() {
  const [showDeposit, setShowDeposit] = useState(false)

  return (
    <>
      <button onClick={() => setShowDeposit(true)}>Add Funds</button>
      
      {showDeposit && (
        <UniversalDeposit
          onClose={() => setShowDeposit(false)}
          onSuccess={() => {
            setShowDeposit(false)
            window.location.reload() // Refresh balance
          }}
        />
      )}
    </>
  )
}
```

### Option B: Programmatic Control

```jsx
import { useSupabaseContext } from './context/SupabaseContext'
import DepositService from './lib/depositService'

export function QuickDeposit() {
  const { supabase } = useSupabaseContext()

  const handleDeposit = async () => {
    const user = (await supabase.auth.getUser()).data.user
    const service = new DepositService(supabase)
    await service.initialize(user.id)

    const result = await service.initiateDeposit(
      100, // amount
      'USD', // currency
      'stripe', // method
      {}
    )

    console.log('Deposit started:', result.depositId)
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl
    }
  }

  return <button onClick={handleDeposit}>Quick Deposit</button>
}
```

## 5. Test It

```bash
# 1. Start dev server
npm run dev

# 2. Open app in browser
# 3. Click "Add Funds" button
# 4. Select payment method (Stripe, GCash, etc.)
# 5. Enter amount
# 6. Proceed to payment

# For Stripe, use test card: 4242 4242 4242 4242
# For crypto: send test amount to provided address
```

## Supported Payment Methods (Pick One to Start)

| Method | Region | Min | Max | Fee | Time | Setup |
|--------|--------|-----|-----|-----|------|-------|
| **Stripe** | Global | $1 | $100k | 2.9%+$0.30 | 1-3 days | Easy |
| **GCash** | Philippines | ₱100 | ₱50k | Free | Instant | Medium |
| **Crypto** | Global | 0.001 | $1M | Network | Varies | Easy |
| **Bank Transfer** | Global | $100 | $1M | $5-30 | 1-5 days | Hard |
| **PayMaya** | Philippines | ₱100 | ₱50k | Free | Instant | Medium |

**Easiest to start**: **Stripe** or **Cryptocurrency** (no webhook setup needed initially)

## Common Tasks

### Get Available Payment Methods for User

```javascript
const service = new DepositService(supabase)
await service.initialize(userId)

const { methods, region } = service.getAvailableMethods('US', 'USD')
methods.forEach(m => {
  console.log(`${m.icon} ${m.name} - ${m.fees}`)
})
```

### Check Deposit Status

```javascript
const deposit = await service.getDepositStatus(depositId)
console.log(`Status: ${deposit.status}`) // pending, processing, completed, failed
console.log(`Amount: ${deposit.amount} ${deposit.currency_code}`)
```

### Get User's Deposit History

```javascript
const deposits = await service.getDepositHistory(limit = 10)
deposits.forEach(d => {
  console.log(`${d.created_at}: ${d.amount} ${d.currency_code} via ${d.deposit_method}`)
})
```

### Validate Deposit Limits

```javascript
const validation = await service.validateDeposit(1000, 'USD', 'stripe')
console.log(`Valid: ${validation.valid}`)
console.log(`Daily: ${validation.daily_used}/${validation.daily_limit}`)
console.log(`Monthly: ${validation.monthly_used}/${validation.monthly_limit}`)
```

### Cancel a Pending Deposit

```javascript
const updated = await service.cancelDeposit(depositId)
console.log(`Cancelled: ${updated.status}`)
```

### Process a Completed Deposit (Admin)

```javascript
// Call database function directly (service_role only)
const { data, error } = await supabase.rpc(
  'verify_and_credit_deposit',
  { p_deposit_id: depositId }
)
if (data.success) {
  console.log(`Credited! New balance: ${data.new_balance}`)
}
```

## Webhook Setup (Only for async methods like Stripe)

1. Get your webhook URL:
```
https://your-project.supabase.co/functions/v1/deposit-webhook?provider=stripe
```

2. Add to payment provider dashboard:
   - **Stripe**: Dashboard > Webhooks > Add endpoint
   - **GCash**: Settings > Webhooks
   - **PayMaya**: API Settings > Webhooks
   - **Wise**: Settings > Webhooks

3. Copy webhook secret to `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxx
GCASH_WEBHOOK_SECRET=xxxx
```

## Troubleshooting

### "Supabase context not found"
- Ensure `SupabaseProvider` wraps your app in `main.jsx`:
```jsx
import { SupabaseProvider } from './context/SupabaseContext'

ReactDOM.render(
  <SupabaseProvider>
    <App />
  </SupabaseProvider>,
  document.getElementById('root')
)
```

### "Deposit method not available in my region"
- Check `PAYMENT_REGIONS` in `src/lib/depositService.js`
- Add your country to the region config
- Redeploy `process-deposit` function

### "Balance not updating after payment"
1. Check `deposits` table: `SELECT * FROM deposits WHERE id = '...'`
2. Verify webhook was called: Check Supabase Function logs
3. Manually trigger: `SELECT * FROM verify_and_credit_deposit('deposit-id')`

### "Payment provider API key error"
- Verify key is in `.env.local`
- Check for typos in variable name
- Ensure key is for correct environment (test vs. live)
- Restart dev server after adding env vars

## Next Steps

1. ✅ Test with one payment method
2. Add additional payment methods
3. Configure webhooks for async methods
4. Customize deposit limits: Edit `validate_deposit_limits()` function
5. Add email notifications on deposit success
6. Set up analytics dashboard
7. Add fraud detection rules
8. Implement multi-currency conversion

## Files Overview

| File | Purpose |
|------|---------|
| `src/lib/depositService.js` | Client SDK - use this in your components |
| `src/components/UniversalDeposit.jsx` | Ready-to-use UI component |
| `src/components/UniversalDeposit.css` | Component styling |
| `supabase/functions/process-deposit/` | Backend processor |
| `supabase/functions/deposit-webhook/` | Webhook handler |
| `supabase/migrations/999_create_deposit_functions.sql` | Database setup |
| `UNIVERSAL_DEPOSIT_SYSTEM_GUIDE.md` | Full documentation |

## Support

- **General Questions**: See `UNIVERSAL_DEPOSIT_SYSTEM_GUIDE.md`
- **Payment Provider Issues**: Contact their support
- **Webhook Problems**: Check Supabase Function logs
- **Database Issues**: Check Supabase SQL Editor for errors

---

**You're all set!** 🚀 Click "Add Funds" in your app and try it out.
