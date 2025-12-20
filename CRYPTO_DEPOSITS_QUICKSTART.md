# Crypto Deposits - Quick Start Guide

## 30-Second Setup

```bash
# 1. Create the database table (via Supabase Dashboard SQL Editor)
# Copy: supabase/migrations/0100_create_wallets_house.sql

# 2. Run setup script
npm run setup-crypto-deposits

# or
node scripts/setup-crypto-deposits.js

# 3. Done! Visit /depots to see it in action
```

## What Gets Created

✅ **Database Table**: `wallets_house` with 50+ cryptocurrency deposit addresses
✅ **API Route**: `/depots` for accessing the deposit page
✅ **Services**: Crypto rate fetching, PHP conversion, balance crediting
✅ **QR Codes**: Automatic generation for easy sharing

## Supported Cryptos

**50+ cryptocurrencies across multiple networks:**

```
Bitcoin Networks:
  • BTC (Bitcoin)
  • LTC (Litecoin)
  • BCH (Bitcoin Cash)
  • DOGE (Dogecoin)

Ethereum Networks:
  • ETH (Ethereum)
  • USDT, USDC, LINK, UNI, AAVE (ERC-20 tokens)
  • Plus 20+ other ERC-20 tokens on multiple chains

Other Major Blockchains:
  • SOL (Solana)
  • XRP (Ripple)
  • ADA (Cardano)
  • DOT (Polkadot)
  • TON (The Open Network)
  • And many more...

Layer 2 Networks:
  • Arbitrum, Polygon, Base, Optimism
  • Tron, BNB Chain, Avalanche
```

## File Reference

| File | Purpose |
|------|---------|
| `scripts/setup-crypto-deposits.js` | One-command setup |
| `scripts/populate-crypto-deposit-addresses.js` | Populate addresses manually |
| `src/lib/cryptoDepositService.js` | Crypto deposit logic |
| `src/lib/cryptoRatesService.js` | Real-time rates |
| `src/lib/qrCodeGenerator.js` | QR code generation |
| `supabase/migrations/0100_create_wallets_house.sql` | Database schema |
| `CRYPTO_DEPOSITS_SETUP.md` | Full documentation |

## User Experience

### For End Users

1. User clicks "Add Funds" → "Cryptocurrency"
2. Selects cryptocurrency (BTC, ETH, SOL, etc.)
3. Selects network (Bitcoin, Ethereum, Solana, etc.)
4. Copies address or scans QR code
5. Sends crypto from their wallet
6. Amount appears in their PHP wallet within 1-2 minutes ✨

### For Admins

- All deposits tracked in `deposits` table
- Real-time rates from coins.ph API
- Automatic PHP credit calculation
- Full audit trail available

## Key Features

✨ **Real-Time Rates**: Converts crypto to PHP using live market prices
✨ **Multi-Network**: Same coin different networks (USDT on Ethereum, Tron, Solana, etc.)
✨ **QR Codes**: One-click QR generation for addresses
✨ **Auto-Credit**: Deposits automatically appear in user's PHP wallet
✨ **History**: Users can view all their crypto deposits
✨ **Security**: Row-level security on all data

## Important Security Notes

⚠️ **BEFORE GOING LIVE**:

1. **Replace Placeholder Addresses**
   ```javascript
   // Current addresses are EXAMPLES
   // Replace with YOUR ACTUAL addresses before production
   ```

2. **Encrypt Private Keys**
   ```javascript
   // Don't store unencrypted private keys in the database
   // Use encryption at rest and in transit
   ```

3. **Verify Transactions**
   - Implement blockchain verification
   - Confirm multiple block confirmations
   - Use reputable blockchain APIs

4. **Rate Caching**
   - Don't call rate API on every deposit
   - Cache rates for 1-5 minutes
   - Handle API failures gracefully

## Troubleshooting

```bash
# Verify setup worked
node scripts/setup-crypto-deposits.js

# Should output:
# ✓ Table exists
# ✓ Found X crypto deposit addresses
# ✓ BTC: Bitcoin
# ✓ ETH: Ethereum, Arbitrum One
# ... etc
```

## What's Included in /depots

- ✅ Cryptocurrency selection dropdown
- ✅ Network selection for each crypto
- ✅ Real-time rate display
- ✅ QR code generation
- ✅ Address copy-to-clipboard
- ✅ Deposit history table
- ✅ Real-time PHP conversion
- ✅ Mobile-responsive design

## API Endpoints Used

```javascript
// These APIs are called automatically:

// 1. coins.ph API - for crypto rates
await coinsPhApi.getPrice('BTCPHP')

// 2. Open Exchange Rates API - for fiat conversion
fetch(`https://openexchangerates.org/api/latest.json?...`)

// 3. Supabase - for database operations
supabase.from('wallets_house').select(...)
```

## Environment Variables

These should be set in your `.env`:

```env
# Supabase
VITE_PROJECT_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Exchange Rates
OPEN_EXCHANGE_RATES_API=your_api_key

# Coins.ph (for crypto prices)
COINS_PH_API_KEY=your_api_key
```

## Next Steps

1. ✅ Run setup: `npm run setup-crypto-deposits`
2. ✅ Test deposit at `/depots`
3. ✅ Replace placeholder addresses with real ones
4. ✅ Implement blockchain verification
5. ✅ Set up monitoring/alerts
6. ✅ Add admin dashboard for deposits
7. ✅ Go live! 🚀

## Need Help?

See `CRYPTO_DEPOSITS_SETUP.md` for full documentation.
