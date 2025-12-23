# Quick Rates Reference - TL;DR

## 🎯 The Issue (Fixed)
- `/rates` table wasn't functioning → Actually called `public.pairs`
- 14 invalid rates (zero values) → **REMOVED**
- 1,000 valid rates remain → **ALL WORKING**

---

## 📊 Status Now
```
✅ 1,000 valid rate pairs
✅ 546 crypto + 454 fiat
✅ No data corruption
✅ PHP, USD, BTC, ETH all working
```

---

## 🚀 How to Query Rates

### Quick SQL (Copypaste Ready)
```sql
-- Get ALL rates
SELECT from_currency, to_currency, rate FROM public.pairs;

-- Get PHP → USD rate
SELECT rate FROM public.pairs 
WHERE from_currency = 'PHP' AND to_currency = 'USD';

-- Get all PHP conversions
SELECT to_currency, rate FROM public.pairs 
WHERE from_currency = 'PHP' ORDER BY to_currency;

-- Get Bitcoin rates
SELECT to_currency, rate FROM public.pairs 
WHERE from_currency = 'BTC' ORDER BY to_currency LIMIT 10;
```

### Easy Commands
```bash
# Check everything
node scripts/check-all-rates-status.js

# Query PHP → USD
node scripts/query-rates.js get PHP USD

# Get all PHP rates
node scripts/query-rates.js for PHP

# Get all Bitcoin rates
node scripts/query-rates.js for BTC

# Get all rates
node scripts/query-rates.js all
```

### JavaScript
```javascript
import { supabase } from './lib/supabaseClient'

// Get one rate
const { data } = await supabase
  .from('pairs')
  .select('rate')
  .eq('from_currency', 'PHP')
  .eq('to_currency', 'USD')
  .single()
console.log(data.rate) // 0.0175

// Get all rates for PHP
const { data: rates } = await supabase
  .from('pairs')
  .select('to_currency, rate')
  .eq('from_currency', 'PHP')
rates.forEach(r => console.log(`PHP/${r.to_currency}: ${r.rate}`))

// Get all rates (1,000+)
const { data: allRates } = await supabase
  .from('pairs')
  .select('*')
```

---

## 📂 Files You Can Use

| File | Purpose |
|------|---------|
| `scripts/check-all-rates-status.js` | Full system status check |
| `scripts/query-rates.js` | Easy CLI queries |
| `scripts/pull-all-rates-from-pairs.sql` | 10+ SQL examples |
| `RATES_TABLE_QUERY_GUIDE.md` | Complete guide (detailed) |
| `RATES_FIX_SUMMARY.md` | What was fixed |

---

## 🔧 What Was Done

1. ✅ Identified table (`public.pairs` not `public.rates`)
2. ✅ Found 14 invalid rates (zero values)
3. ✅ Deleted all invalid data
4. ✅ Verified 1,000 valid rates remain
5. ✅ Created tools to query rates easily
6. ✅ Created documentation

---

## 📝 Example Outputs

### Single Rate Query
```
node scripts/query-rates.js get PHP USD
✅ 1 PHP = 0.0175 USD
   Updated: 2025-12-22T10:32:13.993Z
```

### All Rates for Currency
```
node scripts/query-rates.js for PHP
✅ Found 408 rates
  • 1 PHP = 0.011 0G
  • 1 PHP = 0.076 1INCH
  • 1 PHP = 0.023 ADA
  ... (408 total)
```

### Full Status
```
node scripts/check-all-rates-status.js
✅ 1,000 rate pairs
✅ 546 crypto + 454 fiat
✅ No invalid rates
✅ Last update: 2025-12-22T14:24:53.818Z
```

---

## 🆘 Common Tasks

**I need to convert PHP to USD:**
```bash
node scripts/query-rates.js get PHP USD
```

**I need all exchange rates:**
```bash
node scripts/check-all-rates-status.js
```

**I need rates for a specific currency:**
```bash
node scripts/query-rates.js for BTC
node scripts/query-rates.js for EUR
```

**I need to export all rates as JSON:**
```sql
SELECT json_agg(row_to_json(t))
FROM (SELECT * FROM public.pairs ORDER BY from_currency) t;
```

---

## 💡 Key Facts

- **Table:** `public.pairs` (unified fiat + crypto rates)
- **Rows:** 1,000 valid exchange rate pairs
- **Updated:** Automatically every hour (via edge function)
- **Indexed:** Fast lookups on from_currency + to_currency
- **Sources:** ExConvert API (primary), OpenExchangeRates (fallback)

---

## ✅ Done!

All rates are now clean, queryable, and working correctly.

**Next Step:** Use the scripts or SQL queries above to pull rates as needed.

---

*For detailed info, see: `RATES_TABLE_QUERY_GUIDE.md`*
