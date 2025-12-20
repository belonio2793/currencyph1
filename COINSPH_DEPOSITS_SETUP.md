# Coins.ph Cryptocurrency Deposits Setup

This guide explains how to sync all Coins.ph cryptocurrency deposit addresses to the `wallets_house` table and integrate them with the deposits page.

## Overview

The system now automatically pulls all cryptocurrency deposit addresses from your Coins.ph account and makes them available for users to deposit directly to your platform's wallets.

**Flow:**
1. Fetch all available cryptocurrencies from Coins.ph API
2. Get deposit addresses for each cryptocurrency
3. Store them in the `wallets_house` table with `provider='coins.ph'`
4. Display them in the deposits page when users select a cryptocurrency

## Prerequisites

You need to have set up the Coins.ph API credentials:

```bash
COINS_PH_API_KEY=your_api_key
COINS_PH_API_SECRET=your_api_secret
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

These should be in your environment variables (`.env` file or deployment config).

## Step 1: Run the Sync Script

Run the script to fetch all Coins.ph cryptocurrency addresses and populate the `wallets_house` table:

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your_key \
COINS_PH_API_KEY=your_coins_ph_key \
COINS_PH_API_SECRET=your_coins_ph_secret \
node scripts/sync-coinsph-addresses.js
```

**Output:**
```
🔄 Syncing Coins.ph cryptocurrency addresses to wallets_house...

📥 Fetching all coins information from Coins.ph...
✅ Found 20 coins

📍 Processing BTC...
✅ Created new BTC wallet at 1A1z7agoat...

📍 Processing ETH...
✅ Created new ETH wallet at 0x1234...

...

==================================================

✨ Sync Complete!
✅ Synced: 20
❌ Failed: 0
📊 Total: 20
```

## Step 2: Verify Addresses in Database

Check that the addresses were synced correctly:

```sql
SELECT id, currency, address, provider, network, synced_at
FROM wallets_house
WHERE provider = 'coins.ph' AND wallet_type = 'crypto'
ORDER BY currency;
```

Expected output:
```
| id   | currency | address           | provider  | network | synced_at           |
|------|----------|-------------------|-----------|---------|---------------------|
| ...  | BTC      | 1A1z7agoat...    | coins.ph  | bitcoin | 2024-01-15T10:30... |
| ...  | ETH      | 0x1234...        | coins.ph  | ethereum| 2024-01-15T10:30... |
| ...  | SOL      | Cb cWb97K...    | coins.ph  | solana  | 2024-01-15T10:30... |
```

## Step 3: Test the Deposits Page

1. Go to the deposits page
2. Toggle to "Cryptocurrency" mode
3. You should see buttons for each cryptocurrency (BTC, ETH, SOL, etc.)
4. Select one and the address should be displayed with copy functionality

## How It Works

### Frontend Flow

1. **Load Initial Data**: When the deposits page loads, it:
   - Fetches user wallets from `wallets` table
   - Fetches cryptocurrency addresses from `wallets_house` (provider='coins.ph')
   - Stores them in `cryptoAddresses` state

2. **Display Methods**: For each cryptocurrency in `wallets_house`:
   - Creates a deposit method button with the cryptocurrency name
   - Shows instructions for depositing

3. **Show Address**: When user selects a crypto method:
   - Displays the address from `wallets_house`
   - Shows the network and provider information
   - Provides copy functionality

### Backend Updates

**New API Methods** (in `src/lib/coinsPhApi.js`):

```javascript
// Get all coins' information
await coinsPhApi.getAllCoinsInformation()

// Get deposit address for a coin
await coinsPhApi.getDepositAddress('BTC')

// Get deposit history
await coinsPhApi.getDepositHistory('BTC')

// Initiate withdrawal
await coinsPhApi.withdraw('BTC', ...)
```

## Database Schema

The `wallets_house` table stores cryptocurrency information:

```sql
CREATE TABLE wallets_house (
  id uuid PRIMARY KEY,
  wallet_type text NOT NULL, -- 'crypto' or 'fiat'
  currency varchar(16) NOT NULL, -- 'BTC', 'ETH', etc.
  network text, -- 'bitcoin', 'ethereum', etc.
  address text, -- the deposit address
  provider text DEFAULT 'coins.ph', -- provider name
  balance numeric(36,8), -- current balance
  metadata jsonb, -- additional data (synced_at, etc.)
  synced_at timestamptz, -- last sync time
  updated_at timestamptz
);
```

## Maintenance

### Resync Addresses

If you need to update all addresses (e.g., if Coins.ph changes something):

```bash
# The script will update existing records or create new ones
node scripts/sync-coinsph-addresses.js
```

### Manual Sync

To add a specific currency manually:

```javascript
const { data, error } = await supabase
  .from('wallets_house')
  .upsert({
    wallet_type: 'crypto',
    currency: 'BTC',
    network: 'bitcoin',
    address: '1A1z7agoat...',
    provider: 'coins.ph',
    balance: 0,
    metadata: {
      synced_from: 'coins.ph_api',
      synced_at: new Date().toISOString()
    }
  })
  .select()
```

## Troubleshooting

### Script Fails with 401 Unauthorized

- Check that your `COINS_PH_API_KEY` and `COINS_PH_API_SECRET` are correct
- Make sure your IP is whitelisted in Coins.ph API settings

### No Addresses Appear in Deposits Page

1. Check that `wallets_house` has records with `provider='coins.ph'`:
   ```sql
   SELECT COUNT(*) FROM wallets_house WHERE provider='coins.ph';
   ```

2. Check browser console for errors in loading crypto addresses

3. Verify that you're in "Cryptocurrency" mode on the deposits page

### Addresses Not Updating

The script only syncs when you run it manually. To set up automatic daily syncing:

```bash
# Create a cron job
0 2 * * * SUPABASE_URL=... node /path/to/scripts/sync-coinsph-addresses.js
```

## User Deposit Flow

When a user deposits:

1. User selects cryptocurrency (e.g., Bitcoin)
2. User sees your Bitcoin address from `wallets_house`
3. User transfers to that address
4. Transaction appears in user's account after blockchain confirmation
5. Balance automatically updates from `wallets_house` balance

## API Integration Points

- **Coins.ph Proxy**: `supabase/functions/coinsph-proxy/index.ts`
  - Handles HMAC-SHA256 signing
  - Routes requests to Coins.ph API
  - Manages authentication

- **CoinsPhApi Client**: `src/lib/coinsPhApi.js`
  - High-level API wrapper
  - Provides methods for all Coins.ph endpoints
  - Handles errors and response parsing

- **Deposits Component**: `src/components/Deposits.jsx`
  - Displays deposit options
  - Shows user's wallets
  - Provides address copying

## Security Notes

- API keys are stored in environment variables, never exposed in client code
- All Coins.ph API calls are signed with HMAC-SHA256
- Addresses are public information; sharing them is safe
- Ensure IP whitelisting is configured in Coins.ph settings
