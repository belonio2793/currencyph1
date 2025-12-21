# Quick Crypto Deposits Setup

## 3-Minute Setup

### Step 1: Apply Migration
```bash
# Open Supabase SQL Editor and run:
supabase/migrations/0108_cryptocurrency_deposits_clean.sql
```

### Step 2: Verify
```sql
SELECT COUNT(*) FROM wallets_house WHERE wallet_type = 'crypto';
-- Expected: 54 rows
```

### Step 3: Use in Code
```javascript
import { CRYPTOCURRENCY_DEPOSITS } from '@/data/cryptoDeposits'
import CryptoDepositsSync from '@/lib/cryptoDepositsSync'

// Display all cryptocurrencies
CRYPTOCURRENCY_DEPOSITS.forEach(d => {
  console.log(`${d.currency} (${d.network}): ${d.address}`)
})

// Get networks for a currency
const networks = CryptoDepositsSync.getNetworksForCurrency('Bitcoin (BTC)')

// Get specific address
const btc = CryptoDepositsSync.getDepositAddress('Bitcoin (BTC)', 'Bitcoin')
```

---

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/0108_cryptocurrency_deposits_clean.sql` | Database migration - 54 entries |
| `src/data/cryptoDeposits.js` | Frontend configuration data |
| `src/lib/cryptoDepositsSync.js` | Sync service & helpers |
| `CRYPTOCURRENCY_DEPOSITS_FINAL_SETUP.md` | Complete guide |

---

## Data: 54 Entries

- Bitcoin (BTC): Bitcoin
- Ethereum: ERC-20, Arbitrum One
- Tether (USDT): 11 networks
- USDC: 10 networks  
- XRP, SOL, TRX, DOGE, ADA, BCH, LINK, XLM, HYPE, LITECOIN
- Sui, AVAX, HBAR, SHIB, PYUSD, WLD, TON, UNI, DOT, AAVE
- XAUT, PEPE, ASTER, ENA, SKY, Binance Coin

---

## Common Operations

### Get all currencies
```javascript
const currencies = CryptoDepositsSync.getAllCurrencies()
// ['Bitcoin (BTC)', 'Ethereum', 'Tether (USDT)', ...]
```

### Get networks for currency
```javascript
const networks = CryptoDepositsSync.getNetworksForCurrency('USDT')
// [{ network: 'Asset Hub (Polkadot)', address: '12xM7g...' }, ...]
```

### Get specific deposit
```javascript
const deposit = await CryptoDepositsSync.getDepositAddress('XRP (XRP)', 'Ripple')
// { currency: 'XRP (XRP)', network: 'Ripple', address: 'rpWJm...', metadata: { tag: '2135060125' } }
```

### Format for display
```javascript
const formatted = CryptoDepositsSync.formatDeposit(deposit)
// { currency, network, address, displayAddress, metadata, canCopy, hasTag, hasMemo }
```

### Verify sync
```javascript
const status = await CryptoDepositsSync.verifySync()
if (status.inSync) {
  console.log('Database matches frontend data')
}
```

---

## Metadata (Tags/Memos)

5 entries have special metadata:

| Currency | Network | Metadata |
|----------|---------|----------|
| XRP (XRP) | Ripple | tag: "2135060125" |
| XLM | Stellar | memo: "475001388" |
| USDT | The Open Network | tag: "641022568" |
| TON | The Open Network | tag: "641022568" |
| HBAR | Hedera Hashgraph | tag: "2102701194" |

---

## In Components

```javascript
// In Deposits.jsx
import { CRYPTOCURRENCY_DEPOSITS } from '@/data/cryptoDeposits'
import CryptoDepositsSync from '@/lib/cryptoDepositsSync'

// Display dropdown of currencies
const currencies = [...new Set(CRYPTOCURRENCY_DEPOSITS.map(d => d.currency))]

// When user selects a currency, show networks
const networks = CryptoDepositsSync.getNetworksForCurrency(selectedCurrency)

// When user selects network, show address
const deposit = CRYPTOCURRENCY_DEPOSITS.find(
  d => d.currency === selectedCurrency && d.network === selectedNetwork
)
console.log(deposit.address)
if (deposit.metadata?.tag) {
  console.log(`Include tag: ${deposit.metadata.tag}`)
}
```

---

## Done! ✅

All 54 crypto deposits are:
- ✅ In database (migration 0108)
- ✅ In frontend (src/data/cryptoDeposits.js)
- ✅ Synced (src/lib/cryptoDepositsSync.js)
- ✅ Ready to use in /deposits page
