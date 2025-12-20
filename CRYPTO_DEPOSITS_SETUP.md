# Cryptocurrency Deposits System Setup Guide

This document describes how to set up and use the cryptocurrency deposit system for the Currency.ph application.

## Overview

The crypto deposit system allows users to transfer cryptocurrencies to specified wallet addresses and have their account automatically credited in Philippine Peso (PHP) based on real-time exchange rates.

## Features

- **Multi-Currency Support**: BTC, ETH, SOL, USDT, USDC, and 50+ other cryptocurrencies
- **Multi-Network Support**: Same cryptocurrency can have different addresses on different blockchains (e.g., USDT on Ethereum, Tron, Solana, etc.)
- **Real-Time Rate Conversion**: Automatic conversion of crypto deposits to PHP using live market rates
- **QR Code Display**: Easy QR code generation for quick address sharing
- **Deposit History**: Track all crypto deposits with conversion rates
- **Automatic Balance Crediting**: Deposits are credited to user's PHP wallet

## Setup Steps

### 1. Create Database Table

The `wallets_house` table stores all cryptocurrency deposit addresses. Run the migration:

```bash
# Option A: Using Supabase Dashboard
1. Go to your Supabase Dashboard
2. Open SQL Editor
3. Create a new query
4. Copy the contents from: supabase/migrations/0100_create_wallets_house.sql
5. Run the query

# Option B: Using the setup script
node scripts/setup-crypto-deposits.js
```

### 2. Populate Crypto Deposit Addresses

The system comes with pre-configured deposit addresses for major cryptocurrencies across multiple networks.

```bash
# Populate addresses using the setup script
npm run setup-crypto-deposits

# Or manually using the populate script
node scripts/populate-crypto-deposit-addresses.js
```

**Important**: The addresses in the system are placeholder examples. In production, you MUST replace these with actual addresses you control:

```javascript
// Example of how to update addresses in the database:
const { data, error } = await supabase
  .from('wallets_house')
  .update({
    address: 'YOUR_ACTUAL_ADDRESS_HERE',
    provider: 'your_provider'
  })
  .eq('currency', 'BTC')
  .eq('network', 'Bitcoin')
```

### 3. Configure Environment Variables

Ensure these environment variables are set in your `.env` file:

```env
VITE_PROJECT_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
OPEN_EXCHANGE_RATES_API=your_open_exchange_rates_api_key
COINS_PH_API_KEY=your_coins_ph_api_key
```

### 4. Verify Setup

```bash
# Check that addresses are properly populated
node scripts/setup-crypto-deposits.js

# This will output:
# ✓ Table exists
# ✓ Populated X crypto deposit addresses
# ✓ Found X crypto deposit addresses:
#   BTC: Bitcoin
#   ETH: Ethereum, Arbitrum One
#   SOL: Solana
#   ... etc
```

## Usage

### For Users

1. **Visit Deposit Page**: Navigate to `/depots` or click "Add Funds" → "Cryptocurrency"

2. **Select Cryptocurrency**: Choose from 50+ supported cryptocurrencies (BTC, ETH, SOL, USDT, etc.)

3. **Choose Network**: Select which blockchain to send to
   - Some cryptos have multiple networks (e.g., USDT can be sent via Ethereum, Tron, Solana)
   - Each network has a different deposit address

4. **Send Cryptocurrency**: 
   - Copy the address or scan the QR code
   - Send the exact amount from your wallet
   - Save the transaction hash for your records

5. **Automatic Crediting**: 
   - Deposits are credited to your PHP wallet within 1-2 minutes
   - Amount is converted using real-time market rates
   - You'll see the converted PHP amount in your wallet

### For Developers

#### Get Available Crypto Addresses

```javascript
import { getCryptoDepositAddresses } from './lib/cryptoDepositService'

// Get all crypto addresses
const addresses = await getCryptoDepositAddresses(supabase)

// Get addresses for specific crypto
const ethAddresses = await getCryptoDepositAddresses(supabase, 'ETH')
```

#### Convert Crypto to PHP

```javascript
import { convertCryptoToPHP } from './lib/cryptoDepositService'

// Convert 0.5 BTC to PHP
const phpAmount = await convertCryptoToPHP(0.5, 'BTC')
console.log(`0.5 BTC = ${phpAmount} PHP`)
```

#### Credit User's Wallet

```javascript
import { creditCryptoDeposit } from './lib/cryptoDepositService'

const result = await creditCryptoDeposit(
  supabase,
  userId,
  'BTC',
  0.5,
  '15Z9UvjeLc5zQ1uhemyCeobvpz7Wg2UaYu',
  'Bitcoin',
  'tx_hash_here'
)

console.log(`Credited ${result.phpAmount} PHP to user`)
```

## Database Schema

### wallets_house Table

```sql
CREATE TABLE wallets_house (
  id BIGSERIAL PRIMARY KEY,
  wallet_type VARCHAR(50) NOT NULL DEFAULT 'crypto',
  currency VARCHAR(20) NOT NULL,        -- 'BTC', 'ETH', 'SOL', etc.
  network VARCHAR(100) NOT NULL,        -- 'Bitcoin', 'Ethereum', 'Solana', etc.
  address VARCHAR(255) NOT NULL,        -- Deposit address
  provider VARCHAR(50) NOT NULL,        -- 'internal', 'coins.ph', etc.
  balance DECIMAL(30, 18) DEFAULT 0,    -- Balance in address
  metadata JSONB DEFAULT '{}',          -- Extra data (memo, tag, etc.)
  private_key TEXT,                     -- Optional encrypted private key
  thirdweb_wallet_id VARCHAR(255),      -- Optional Thirdweb reference
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(currency, network, address)
);
```

### deposits Table (Extended)

The existing `deposits` table is used to track all deposits:

```sql
-- New fields for crypto deposits:
transaction_hash VARCHAR(255),          -- Blockchain transaction hash
metadata JSONB DEFAULT '{}'             -- Stores deposit_address, network, etc.
```

## Supported Cryptocurrencies

The system supports these cryptocurrencies:

- **Major**: BTC, ETH, USDT, USDC, BNB, SOL, XRP, ADA
- **Layer 2**: Polygon, Arbitrum, Optimism, Base
- **DeFi**: AAVE, UNI, LINK, ASTER, SKY, ENA
- **Stablecoins**: USDT, USDC, PYUSD, BUSD
- **Privacy**: XMR, ZEC
- **Memes**: DOGE, SHIB, PEPE
- **Others**: LTC, BCH, DOT, XLM, HBAR, TON, etc.

Each cryptocurrency can support multiple networks.

## Security Considerations

⚠️ **Important Security Notes**:

1. **Never Expose Private Keys**: Private keys should be encrypted at rest and only accessible by authorized services

2. **Address Verification**: Always verify deposit addresses through:
   - QR codes (resistant to typos)
   - Multiple sources
   - Test deposits first

3. **Transaction Verification**: 
   - Always verify transactions on the blockchain
   - Don't trust unconfirmed transactions
   - Wait for sufficient block confirmations (6+ for BTC, 12+ for ETH)

4. **Rate Accuracy**:
   - Use reliable rate APIs (coins.ph, CoinGecko, CoinMarketCap)
   - Implement rate caching to avoid API rate limits
   - Consider rate staleness (refresh every 1-5 minutes)

5. **Database Security**:
   - Enable RLS (Row Level Security) on all tables
   - Audit all balance updates
   - Keep transaction logs immutable

## Troubleshooting

### Deposit not showing up?

1. **Verify on blockchain**: Check the address and transaction hash on the blockchain explorer
   - Bitcoin: https://www.blockchain.com/
   - Ethereum: https://etherscan.io/
   - Solana: https://solscan.io/

2. **Check network**: Ensure the transaction is on the correct blockchain

3. **Verify address**: Ensure you sent to the correct address (compare QR code with displayed address)

4. **Wait for confirmations**: Some deposits require block confirmations before crediting

### Rate not updating?

1. Check that `COINS_PH_API_KEY` is properly configured
2. Verify API quota hasn't been exceeded
3. Check application logs for API errors
4. Manual refresh: Clear browser cache and reload

### Address not loading?

1. Verify `wallets_house` table exists in database
2. Check that addresses were populated: `node scripts/setup-crypto-deposits.js`
3. Verify Supabase authentication is working
4. Check browser console for errors

## API Integration

### coins.ph API Integration

The system uses coins.ph for real-time rates:

```javascript
import { coinsPhApi } from './lib/coinsPhApi'

// Get current price
const price = await coinsPhApi.getPrice('BTCPHP')
console.log(`BTC price: ${price.price} PHP`)

// Get 24h stats
const stats = await coinsPhApi.get24hStats('BTCPHP')
console.log(`24h change: ${stats.percentChange}%`)
```

### Open Exchange Rates API

For fiat currency conversions:

```javascript
const apiKey = process.env.OPEN_EXCHANGE_RATES_API
const response = await fetch(
  `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=PHP&symbols=USD`
)
const rates = await response.json()
```

## File Structure

```
src/
  lib/
    cryptoDepositService.js          # Main service
    cryptoRatesService.js            # Rate fetching
    qrCodeGenerator.js               # QR code utilities
  components/
    Deposits.jsx                     # Deposit UI component

scripts/
  setup-crypto-deposits.js           # Setup script
  populate-crypto-deposit-addresses.js  # Address population

supabase/
  migrations/
    0100_create_wallets_house.sql   # Database schema
```

## Next Steps

1. ✅ Replace placeholder addresses with your actual addresses
2. ✅ Set up proper encryption for private keys
3. ✅ Implement blockchain transaction verification
4. ✅ Add rate update caching strategy
5. ✅ Set up monitoring and alerts
6. ✅ Create admin dashboard for deposit management
7. ✅ Implement fee collection (if needed)
8. ✅ Add KYC/AML compliance checks

## Support

For issues or questions:
- Check the troubleshooting section above
- Review application logs
- Contact support with transaction hash and timestamp
