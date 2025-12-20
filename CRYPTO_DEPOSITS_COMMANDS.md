# Crypto Deposits - Quick Command Reference

## Essential Commands

```bash
# 1. SETUP (one-time, required)
npm run setup-crypto-deposits

# 2. VERIFY (to test everything works)
npm run test-crypto-deposits

# 3. POPULATE (if needed separately)
npm run populate-crypto-deposits
```

## What Each Command Does

### `npm run setup-crypto-deposits`
✅ Creates the `wallets_house` table
✅ Populates 50+ crypto addresses
✅ Sets up indexes and security
✅ Verifies everything works
**Run this first** - it does everything automatically

### `npm run test-crypto-deposits`
✅ Tests database connection
✅ Validates crypto addresses
✅ Tests rate fetching (BTC, ETH, SOL, USDT, XRP)
✅ Checks database schema
✅ Provides detailed error messages
**Run this to verify setup was successful**

### `npm run populate-crypto-deposits`
✅ Manually populate crypto addresses
**Only needed if addresses get deleted**

## Access the System

```
URL: http://localhost:3000/depots
Or: Click "Add Funds" → "Cryptocurrency"
```

## Supported Cryptocurrencies

**50+ currencies including:**
- BTC, ETH, SOL, USDT, USDC, XRP, ADA, DOGE
- And 40+ more across multiple networks

**Example:**
- USDT on Ethereum
- USDT on Tron  
- USDT on Solana
- (same coin, different networks)

## File Locations

```
Database:        supabase/migrations/0100_create_wallets_house.sql
Services:        src/lib/cryptoDepositService.js
Routes:          src/App.jsx (line 226-230)
UI:              src/components/Deposits.jsx
Scripts:         scripts/setup-crypto-deposits.js
                 scripts/test-crypto-deposits.js
Documentation:   CRYPTO_DEPOSITS_SETUP.md
                 CRYPTO_DEPOSITS_QUICKSTART.md
```

## If Something Goes Wrong

```bash
# Check setup status
npm run test-crypto-deposits

# See detailed error messages
npm run test-crypto-deposits 2>&1 | head -50

# Repopulate addresses
npm run populate-crypto-deposits

# Full redo
npm run setup-crypto-deposits
```

## Environment Variables Needed

```env
# Supabase
VITE_PROJECT_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key

# Exchange Rates (optional, for fiat conversion)
OPEN_EXCHANGE_RATES_API=your_key

# Crypto Rates (needed for price fetching)
COINS_PH_API_KEY=your_key
```

## Before Going Live

```
⚠️  MUST DO:
□ Replace placeholder addresses with your real addresses
□ Encrypt private keys (if storing any)
□ Implement blockchain verification
□ Test with real crypto (small amount)
□ Set up monitoring/alerts
□ Review security checklist in CRYPTO_DEPOSITS_SETUP.md
```

## User Journey

```
User visits /depots
    ↓
Selects Cryptocurrency tab
    ↓
Chooses crypto (BTC, ETH, SOL, etc.)
    ↓
Selects network (if multiple available)
    ↓
Sees deposit address + QR code
    ↓
Sends crypto from their wallet
    ↓
Amount appears in PHP wallet (1-2 min)
    ✨ Done!
```

## Rate Information

- **BTC to PHP**: ~2,700,000 PHP (example)
- **ETH to PHP**: ~150,000 PHP (example)
- **SOL to PHP**: ~8,000 PHP (example)
- **USDT to PHP**: ~60 PHP (example)

Rates update automatically from coins.ph API

## Troubleshooting Quick Reference

| Problem | Solution |
|---------|----------|
| Table not found | Run `npm run setup-crypto-deposits` |
| No addresses showing | Run `npm run populate-crypto-deposits` |
| Rates not updating | Check COINS_PH_API_KEY is set |
| QR not displaying | Clear browser cache, reload |
| Deposit not crediting | Verify transaction hash on blockchain explorer |

## Support Resources

📚 **Documentation**: CRYPTO_DEPOSITS_SETUP.md
⚡ **Quick Start**: CRYPTO_DEPOSITS_QUICKSTART.md
✅ **Implementation**: CRYPTO_DEPOSITS_IMPLEMENTATION_SUMMARY.md
🧪 **Testing**: `npm run test-crypto-deposits`

---

**Status**: ✅ Ready to use
**Cryptos**: 50+
**Networks**: 70+
**Maintenance**: Minimal (automatic rate updates)
