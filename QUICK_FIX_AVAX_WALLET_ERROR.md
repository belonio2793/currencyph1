# 🚀 Quick Fix: AVAX Wallet Creation Error

## The Error
```
✗ Failed to create AVAX wallet: Wallet creation failed: value too long for type character varying(3)
```

## Why It Happens
Database columns storing currency codes were limited to 3 characters:
- ✓ Works: `PHP` (3 chars), `USD` (3 chars)
- ✗ Fails: `AVAX` (4 chars), `USDT`, `USDC`, `DOGE`, etc.

## The Fix (2 Steps)

### Step 1️⃣: Apply Migration 0110 (Wallet Type Fix)

1. Open **Supabase Dashboard** → **SQL Editor**
2. Click **"New Query"**
3. Copy entire file: `supabase/migrations/0110_fix_wallet_types_crypto.sql`
4. Paste and **Run** ▶️

Expected: Green checkmark ✓

---

### Step 2️⃣: Apply Migration 0111 (VARCHAR Limit Fix)

1. Click **"New Query"** again
2. Copy entire file: `supabase/migrations/0111_expand_currency_code_varchar_limits.sql`
3. Paste and **Run** ▶️

Expected: Green checkmark ✓

---

## Verify It Works

### Option A: Run Script (Recommended)
```bash
node scripts/verify-wallet-types.js
```

Expected:
```
✅ All checks passed! Wallet types appear to be correct.
```

---

### Option B: Test Manually

1. Go to **Wallet** page
2. Click **"Add More Currencies"**
3. Search for **AVAX**
4. Click **Add**
5. Should see ✅ **Success!**

---

## What These Migrations Do

| Migration | Fix | Impact |
|-----------|-----|--------|
| **0110** | Ensures all cryptocurrencies are marked as type='crypto' | Fixes wrong categorization |
| **0111** | Expands currency columns from VARCHAR(3) to VARCHAR(16) | Fixes 4+ char crypto codes |

---

## Cryptocurrencies That Will Now Work

After applying both migrations, these will work:

```
AVAX, USDT, USDC, DOGE, LINK, HBAR, PEPE, SHIB, 
AAVE, XAUT, ENA, HYPE, LITECOIN, + many more
```

---

## That's It! 🎉

No code changes needed. Migrations handle everything.

---

## Troubleshooting

**Still getting error?**
1. ✅ Did you apply BOTH migrations (0110 AND 0111)?
2. ✅ Did you wait for Supabase to process them?
3. ✅ Did you refresh your browser?
4. ✅ Check migration status in Supabase "Migrations" tab

**Wallet still under "Fiat"?**
1. Run: `node scripts/verify-wallet-types.js`
2. Check database: `SELECT * FROM currencies WHERE code = 'AVAX';`
3. Should show: `type = 'crypto'`

---

## Questions?

Refer to:
- **Detailed guide:** `CRYPTO_WALLET_FIX_COMPLETE.md`
- **Type classification:** `WALLET_TYPE_FIX_GUIDE.md`
- **AVAX error details:** `AVAX_WALLET_CREATION_ERROR_FIX.md`

---

**Status:** Ready to apply ✅

**Time to fix:** ~2 minutes
