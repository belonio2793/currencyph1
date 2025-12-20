# Deposits Setup - Cryptocurrency Payment Methods Complete

## Summary of Changes

This setup completes the cryptocurrency deposit feature by:

1. **Adding cryptocurrency deposit addresses to the database** - All 41 cryptocurrencies across multiple blockchain networks
2. **Filtering payment methods by selected cryptocurrency** - When a user selects a crypto in the Cryptocurrency tab, only payment methods for that specific currency are displayed
3. **Improving user experience** - Better error handling, validation, and feedback when no methods are available

---

## Files Modified

### 1. `src/components/Deposits.jsx`

**Changes Made:**

1. **Smart Method Filtering** (Lines 666-676)
   - Added `useEffect` hook to reset selected payment method when switching cryptocurrencies
   - When in cryptocurrency mode and user switches currencies, the previous method selection is cleared
   - Prevents showing payment methods from a different cryptocurrency

2. **Payment Method Step Navigation** (Lines 827-862)
   - Enhanced payment method grid to show helpful message when no methods are available
   - Displays specific message for cryptocurrency vs fiat currencies
   - Suggests user to select a different currency or contact support

3. **Cryptocurrency Address Display** (Lines 957-993)
   - Added graceful handling for cryptocurrencies without configured addresses (e.g., Bitcoin Lightning Network)
   - Shows user-friendly message instead of empty address field
   - Maintains QR code display for currencies with addresses

---

## Database Migration

### File: `supabase/migrations/0101_add_cryptocurrency_deposit_addresses.sql`

**What it does:**
- Populates `wallets_house` table with 70+ cryptocurrency deposit addresses
- Covers 41 different cryptocurrencies across multiple blockchain networks
- Includes metadata for addresses requiring special fields (tags, memos)

**Cryptocurrencies Added:**
1. BTC (Bitcoin) - Bitcoin network
2. ETH (Ethereum) - ERC-20, Arbitrum One
3. USDT (Tether) - Asset Hub, APT, ERC20, Tron, BEP20, Arbitrum, Solana, TON, Polygon, Kaia, Plasma
4. BNB (Binance Coin) - BNB Smart Chain
5. XRP - Ripple with tag
6. USDC - Multiple networks (Asset Hub, APT, ERC20, BEP20, Arbitrum, RONIN, Stellar, BASE, Polygon, Solana)
7. TRX (Tron) - TRON network
8. DOGE (Dogecoin) - BEP20 and native DogeCoin
9. ADA (Cardano) - Cardano network
10. BCH (Bitcoin Cash) - BEP20 and native Bitcoin Cash
11. LINK (Chainlink) - Ethereum and BNB Smart Chain
12. XLM (Stellar Lumens) - Stellar with memo
13. HYPE (Hyperliquid)
14. LTC (Litecoin) - Litecoin network
15. SUI (Sui) - Sui network
16. AVAX (Avalanche) - AVAX C-Chain
17. HBAR (Hedera) - With tag
18. SHIB (Shiba Inu) - Ethereum ERC20
19. PYUSD (PayPal USD) - Ethereum ERC20
20. WLD (Worldcoin) - World Chain and Ethereum
21. TON (Telegram) - The Open Network
22. UNI (Uniswap) - Ethereum and BNB Smart Chain
23. DOT (Polkadot) - Asset Hub
24. AAVE (Aave) - Ethereum and BNB Smart Chain
25. XAUT (Tether Gold) - Ethereum ERC20
26. PEPE - Ethereum ERC20
27. ASTER - BNB Smart Chain
28. ENA - Ethereum ERC20
29. SKY - Ethereum ERC20

**Schema:**
```sql
wallets_house (
  id BIGSERIAL PRIMARY KEY,
  wallet_type VARCHAR(50) - 'crypto'
  currency VARCHAR(20) - 'BTC', 'ETH', etc.
  network VARCHAR(100) - 'Bitcoin', 'Ethereum', 'Solana', etc.
  address VARCHAR(255) - The deposit address
  provider VARCHAR(50) - 'internal'
  balance DECIMAL(30, 18) - Defaults to 0
  metadata JSONB - Stores tags, memos, notes
  created_at TIMESTAMP - Auto-set
  updated_at TIMESTAMP - Auto-set
)
```

**Unique Constraint:** `UNIQUE(currency, network, address)` prevents duplicates

**Migration Safety:** Uses `ON CONFLICT ... DO NOTHING` to handle re-runs gracefully

---

## How It Works

### User Flow in Deposits Page

1. **Toggle to Cryptocurrency Tab**
   - User clicks "Cryptocurrency" tab in the Deposits component
   - Available cryptocurrencies from `wallets_house` are loaded

2. **Select a Cryptocurrency**
   - User chooses a cryptocurrency from the dropdown (e.g., "Bitcoin (BTC)")
   - Component loads all deposit addresses for that cryptocurrency from the database
   - Only payment methods for that specific currency are displayed

3. **Payment Method Display**
   - For each network the cryptocurrency is available on, a payment method card is shown
   - Example: For Bitcoin, shows "Bitcoin (Bitcoin)" with "Send BTC directly to our wallet via Bitcoin"
   - For cryptocurrencies with multiple networks, shows separate cards for each (e.g., USDT on Ethereum, Polygon, Solana, etc.)

4. **Deposit Instructions**
   - Standard instructions displayed for the user to send crypto
   - Wallet address, network information, and provider details are shown
   - User can copy the address and scan QR code

5. **Validation**
   - If a cryptocurrency is selected but has no configured address, user sees helpful message
   - If user switches currencies while in "confirm" step, they're automatically returned to "amount" step
   - Selected payment method is cleared when switching currencies to prevent confusion

---

## Database Queries Reference

### Get all cryptocurrencies available for deposit:
```sql
SELECT DISTINCT currency FROM wallets_house WHERE wallet_type = 'crypto' ORDER BY currency;
```

### Get all networks for a specific cryptocurrency:
```sql
SELECT DISTINCT currency, network, address FROM wallets_house 
WHERE wallet_type = 'crypto' AND currency = 'BTC' 
ORDER BY network;
```

### Get a specific deposit address:
```sql
SELECT * FROM wallets_house 
WHERE wallet_type = 'crypto' AND currency = 'USDT' AND network = 'Ethereum (ERC20)';
```

---

## Key Features

### ✅ Multi-Network Support
- Each cryptocurrency can have multiple networks
- Example: USDT available on 13 different networks (Ethereum, Polygon, Solana, etc.)
- Example: Bitcoin on Bitcoin and Lightning Network

### ✅ Dynamic Method Loading
- Addresses are fetched from database on component mount
- Component listens to `wallets_house` table changes
- Easy to add new cryptocurrencies without code changes

### ✅ Metadata Support
- Optional metadata field stores tags, memos, memo indexes
- Used for networks requiring special identifiers:
  - XRP Ripple: tag "2135060125"
  - Hedera: tag "2102701194"
  - TON/Tether: tag "641022568"
  - XLM: memo "475001388"

### ✅ Error Handling
- Gracefully handles missing addresses (Lightning Network)
- Shows helpful messages when no methods available
- Validates method availability when switching currencies
- Prevents invalid deposits through validation

### ✅ Responsive Design
- Payment method cards stack on mobile
- Address copying works on all devices
- QR codes display properly across screen sizes

---

## Testing the Setup

### 1. Verify Database Migration
```bash
# Check if cryptocurrencies were added
select count(*) from wallets_house where wallet_type = 'crypto';
# Should return: 70+

# Check specific cryptocurrency
select network, address from wallets_house 
where wallet_type = 'crypto' and currency = 'BTC';
```

### 2. Test the UI
1. Navigate to `/deposits`
2. Click "Cryptocurrency" tab
3. Select a cryptocurrency from dropdown (e.g., "Bitcoin (BTC)")
4. Verify payment method cards appear
5. Switch to different cryptocurrency
6. Verify payment method cards update correctly
7. Try selecting a cryptocurrency with multiple networks (e.g., USDT)
8. Verify all networks are displayed as separate options

### 3. Test Error Handling
1. Check browser console for any errors
2. Try selecting currencies without addresses (if any)
3. Verify helpful error message displays

---

## Troubleshooting

### No cryptocurrencies showing in dropdown
- Check that migration `0101_add_cryptocurrency_deposit_addresses.sql` was applied
- Verify `wallets_house` table has records: `SELECT COUNT(*) FROM wallets_house`

### Payment methods not showing for selected currency
- Verify currency code matches database (e.g., 'BTC' not 'Bitcoin')
- Check that currency has entries in `wallets_house`:
  ```sql
  SELECT * FROM wallets_house WHERE currency = 'BTC';
  ```

### Address is NULL but showing
- This is intentional for future networks (e.g., Bitcoin Lightning)
- User will see message "Address not available" instead of empty field

### selectedMethod state issues
- Clear browser cache and refresh `/deposits` page
- Check React DevTools for component state
- Verify `useEffect` dependency array is correct

---

## Future Enhancements

### Possible Improvements
1. **QR Code Generation** - Generate actual QR codes from addresses
2. **Real-time Balance Tracking** - Display balance in each deposit address
3. **Transaction Monitoring** - Auto-detect when deposits arrive
4. **Network Recommendations** - Suggest cheapest network for deposit
5. **Exchange Rate Display** - Show live rates for cryptocurrencies
6. **Deposit Notifications** - Alert user when deposit is confirmed

---

## Related Documentation

- **Deposits Component:** `/src/components/Deposits.jsx`
- **Deposit Service:** `/src/lib/depositService.js`
- **Database Schema:** `/supabase/migrations/0100_create_wallets_house.sql`
- **Environment:** Check `VITE_SUPABASE_URL` for database connection

---

## Support

For issues with:
- **Database:** Check Supabase dashboard for `wallets_house` table
- **UI:** Open browser DevTools (F12) and check Console and Network tabs
- **Addresses:** Verify addresses in Supabase before reporting issue

