# Edge Functions Integration

## Overview

The `ensure_user_wallets` edge function has been integrated into the frontend to automatically create a PHP wallet for users when they log in.

## Integration Points

### 1. App.jsx (Main App Initialization)
**File:** `src/App.jsx`

When a user authenticates (logs in):
- The `ensureUserPhpWallet()` function is called from `walletFunctions.js`
- This invokes the `ensure_user_wallets` edge function
- A PHP wallet is created if it doesn't exist
- Happens automatically on every login

```javascript
ensureUserPhpWallet(session.user.id).catch(err => {
  console.debug('Could not ensure PHP wallet:', err)
})
```

### 2. Wallet Component
**File:** `src/components/Wallet.jsx`

When the wallets page loads:
- The edge function is called to ensure the user has a PHP wallet
- This provides a double-check that the wallet exists
- Falls back gracefully if the function fails

```javascript
const { data, error } = await supabase.functions.invoke('ensure_user_wallets', {
  body: { user_id: userId }
})
```

### 3. Wallet Functions Library
**File:** `src/lib/walletFunctions.js`

Provides utility functions for wallet operations:
- `ensureUserPhpWallet(userId)` - Ensures user has a PHP wallet
- `createWalletForCurrency(userId, currencyCode)` - Creates wallet for any currency
- `addWalletFunds(userId, currencyCode, amount)` - Adds funds to a wallet
- `getUserWallets(userId)` - Fetches all user wallets

### 4. Wallet Service
**File:** `src/lib/walletService.js`

Updated to use the edge function:
- `ensurePhpWallet(userId)` now calls the edge function
- Has fallback to local creation if function fails
- Maintains backward compatibility

## Edge Function Endpoint

**URL:** `https://corcofbmafdxehvlbesx.supabase.co/functions/v1/ensure_user_wallets`

**Method:** POST

**Request:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "PHP wallet created successfully",
  "wallet_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

## How It Works

1. **User Logs In**
   - App detects authentication state change
   - `ensureUserPhpWallet()` is called

2. **Edge Function Executes**
   - Checks if user has a PHP wallet
   - If exists: returns wallet ID
   - If not: creates new wallet with 0 balance

3. **Wallet Page**
   - When user navigates to /wallets
   - Another ensure call double-checks wallet exists
   - Displays all user wallets grouped by type (Fiat/Crypto)

4. **Error Handling**
   - If edge function fails, gracefully continues
   - Frontend still shows currency list
   - User can manually create wallets

## Testing

To test the integration:

1. **Create a new user account**
   - Go to login/register
   - Create new account with email

2. **Verify PHP wallet was created**
   - Log in
   - Navigate to /wallets
   - Should see PHP wallet with 0 balance

3. **Check Supabase**
   - Go to Supabase SQL Editor
   - Run: `SELECT * FROM wallets WHERE user_id = 'YOUR_USER_ID' AND currency_code = 'PHP'`
   - Should see 1 row

## Troubleshooting

**PHP wallet not created:**
- Check browser console for errors
- Verify edge function is deployed in Supabase
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set in Supabase Function environment

**Edge function returns error:**
- Verify the function endpoint URL is correct
- Check Supabase Function logs
- Ensure `currencies` table has 'PHP' entry (should have been seeded)

## Future Enhancements

- [ ] Create wallets for other currencies automatically
- [ ] Add webhook to create wallets on user signup (in auth trigger)
- [ ] Add UI to create additional wallets for any currency
- [ ] Add wallet deletion functionality
- [ ] Add wallet statistics/analytics

## Files Modified

1. `src/App.jsx` - Added import and edge function call on auth
2. `src/components/Wallet.jsx` - Updated to use edge function
3. `src/lib/walletService.js` - Updated ensurePhpWallet to use edge function
4. `src/lib/walletFunctions.js` - New utility library for wallet operations (NEW)
5. `supabase/functions/ensure-user-wallets/` - Edge function implementation (NEW)
