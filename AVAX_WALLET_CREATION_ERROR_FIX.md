# AVAX Wallet Creation Error - Root Cause & Fix

## Error Message

```
✗ Failed to create AVAX wallet: Wallet creation failed: value too long for type character varying(3)
```

PostgreSQL error code: **22001** (string_data_right_truncation)

## Root Cause

Multiple database tables have `VARCHAR(3)` columns to store currency codes. These columns were designed for **ISO 4217 currency codes** like:
- `PHP` (3 characters)
- `USD` (3 characters)
- `EUR` (3 characters)

However, **cryptocurrencies have varying lengths:**
- ✓ Works (3 chars): SOL, SUI, TON, UNI, WLD
- ✗ Fails (4+ chars): **AVAX**, USDT, USDC, DOGE, LINK, HBAR, PEPE, SHIB, AAVE, XAUT, ENA, HYPE, LITECOIN

When trying to insert/update any table with a currency code longer than 3 characters, PostgreSQL rejects it with the "value too long for type character varying(3)" error.

## Affected Tables

| Table | Column | Issue |
|-------|--------|-------|
| `payments` | `currency` | VARCHAR(3) |
| `payment_intents` | `currency` | VARCHAR(3) |
| `invoices` | `currency` | VARCHAR(3) |
| `deposits` | `currency` | VARCHAR(3) |
| `payment_links` | `currency` | VARCHAR(3) |
| `escrow_payments` | `currency` | VARCHAR(3) |
| `ride_requests` | `currency` | VARCHAR(3) |
| `commitments` | `currency` | VARCHAR(3) |
| `orders` | `currency` | VARCHAR(3) |
| `product_orders` | `currency` | VARCHAR(3) |
| `shop_products` | `currency` | VARCHAR(3) |
| `industrial_products` | `currency` | VARCHAR(3) |
| `shop_customer_addresses` | `preferred_currency` | VARCHAR(3) |
| `alibaba_products` | `original_currency` | VARCHAR(3) |
| `payment_gateways` | `default_settlement_currency` | VARCHAR(3) |

## Solution

Apply migration `0111_expand_currency_code_varchar_limits.sql` which:

1. **Changes all VARCHAR(3) columns to VARCHAR(16)** to match the currency code column size
2. **Adds comments** documenting that these columns now support both fiat and crypto codes
3. **Creates indexes** for faster currency lookups
4. **Maintains backward compatibility** - all existing 3-character codes still work

### The Fix

```sql
-- Example: payments table
ALTER TABLE public.payments
  ALTER COLUMN currency TYPE VARCHAR(16);

-- Repeat for all affected tables...
```

## Implementation Steps

### Step 1: Apply the Migration

Go to **Supabase Dashboard** → **SQL Editor**:

1. Click **"New Query"**
2. Copy the entire contents of:
   ```
   supabase/migrations/0111_expand_currency_code_varchar_limits.sql
   ```
3. Paste and **Run** the query

**Expected Result:**
```
ALTER TABLE
```
(Multiple ALTER TABLE commands execute successfully)

### Step 2: Test the Fix

Try creating an AVAX wallet again:

1. Go to **Wallet** page
2. Click **"Add More Currencies"**
3. Search for **AVAX**
4. Click **Add**

**Expected Result:** ✅ Wallet created successfully

### Step 3: Verify with Query

Run this SQL to confirm:

```sql
-- Check that AVAX wallets can be created
SELECT currency, COUNT(*) FROM payments 
WHERE currency = 'AVAX' GROUP BY currency;

SELECT currency, COUNT(*) FROM deposits 
WHERE currency = 'AVAX' GROUP BY currency;

-- Should not error and may return 0 rows (no transactions yet) or N rows (existing)
```

## Why This Wasn't Caught Earlier

1. **Initial design assumption**: The system was designed for fiat currencies only
2. **Cryptocurrency support added later**: As more crypto wallets were added, they weren't tested with payment tables
3. **Lazy reference**: The VARCHAR(3) limit was enforced at the database level, not the application level
4. **Mixed column types**: The `wallets` table uses `VARCHAR(16)` for `currency_code`, but payment tables used `VARCHAR(3)`

## Cryptocurrencies Affected

These are now supported but were failing before this fix:

**4-Character Codes:**
- AVAX (Avalanche)
- USDT (Tether USD)
- USDC (USD Coin)
- BUSD (Binance USD)
- DOGE (Dogecoin)
- LINK (Chainlink)
- HBAR (Hedera)
- PEPE (Pepe)
- SHIB (Shiba Inu)
- AAVE (Aave)
- XAUT (Tether Gold)
- HYPE (Hyperliquid)

**Longer Codes:**
- LITECOIN (8 characters)
- (others in 5-7 range)

**3-Character Codes (Already Worked):**
- BTC, ETH, XRP, ADA, SOL, DOT, SOL, SUI, TON, UNI, WLD

## Prevention for Future

To prevent this issue with new currencies:

1. **Add currency to `currencies` table with type='crypto'**
2. **Use VARCHAR(16) for all new currency columns** in new migrations
3. **Run verification script** before deploying:
   ```bash
   node scripts/verify-wallet-types.js
   ```

## Related Migrations

- `0110_fix_wallet_types_crypto.sql` - Fixes wallet type classification
- `0111_expand_currency_code_varchar_limits.sql` - Fixes VARCHAR(3) limits (THIS FILE)

## Testing Checklist

- [ ] Migration 0111 applied successfully
- [ ] AVAX wallet created without error
- [ ] USDT wallet created without error
- [ ] USDC wallet created without error
- [ ] Wallets appear in correct Cryptocurrency section
- [ ] No errors in browser console
- [ ] Verification script passes

## Rollback (If Needed)

To revert the changes:

```sql
-- Change back to VARCHAR(3)
ALTER TABLE public.payments ALTER COLUMN currency TYPE VARCHAR(3);
-- Repeat for other tables...
```

However, this will prevent 4+ character cryptocurrency codes from being used.

## FAQ

**Q: Will this affect existing data?**
A: No. VARCHAR(3) data is a subset of VARCHAR(16), so existing 3-character codes remain valid and unchanged.

**Q: Is this safe to run?**
A: Yes. This is a safe type expansion with no data loss. The operation is instantaneous on most databases.

**Q: Can I run this multiple times?**
A: Yes. Running the same ALTER TABLE ... TYPE VARCHAR(16) multiple times is idempotent and safe.

**Q: What about other systems using these columns?**
A: They continue to work normally. 3-character codes still work, and longer codes now work too.

**Q: Why not use a larger VARCHAR limit?**
A: VARCHAR(16) matches the `currencies.code` column size and is sufficient for all current and future currency codes.

## Performance Impact

**Negligible.** Type changes from VARCHAR(3) to VARCHAR(16):
- Don't require data migration
- Don't require index rebuilds
- Are instantaneous on the database
- Don't affect query performance

## Summary

| Aspect | Details |
|--------|---------|
| **Problem** | VARCHAR(3) columns can't store 4+ character crypto codes |
| **Affected Tables** | 15+ tables in payments, deposits, orders systems |
| **Solution** | ALTER columns from VARCHAR(3) to VARCHAR(16) |
| **Migration** | 0111_expand_currency_code_varchar_limits.sql |
| **Time to Fix** | ~30 seconds (migration execution) |
| **Risk Level** | Very Low (safe type expansion) |
| **Data Impact** | None (no data changes) |

---

**Status:** Ready for implementation ✓

**Next Step:** Apply migration 0111 to Supabase database
