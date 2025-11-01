# Network Balances Setup & Usage Guide

## Overview
The Network Balances feature reconciles every transaction and balance between users and house accounts. It automatically runs every 24 hours via an edge function, and can be manually triggered via a Node.js script.

## Database Schema

### `network_balances` Table
Stores reconciliation results for each entity (user or house) per currency.

**Key Columns:**
- `entity_type` - 'user' or 'house'
- `entity_id` - UUID of the user (NULL for house)
- `currency_code` - Currency (PHP, BTC, USD, etc.)
- `wallet_balance` - Actual balance in wallet
- `computed_balance` - Balance computed from transactions
- `balance_difference` - Difference between wallet and computed
- `status` - 'reconciled' or 'discrepancy'
- `reconciliation_date` - When reconciliation occurred

**Indexes:**
- Entity lookup: `(entity_type, entity_id)`
- Currency lookup: `(currency_code)`
- Date lookup: `(reconciliation_date DESC)`
- Status lookup: `(status)`
- User-specific: `(entity_id)` where entity_type = 'user'

**Views:**
- `network_balances_latest` - Most recent balance per entity per currency
- `network_balances_summary` - Aggregated summary by entity type and currency

## Edge Function

### Deployment
The edge function is deployed at: `https://corcofbmafdxehvlbesx.supabase.co/functions/v1/reconcile-balances`

### API Parameters
```
GET /reconcile-balances?type=<type>&userId=<userId>

Parameters:
  type    - 'all' (default) | 'user' | 'house'
  userId  - Required if type='user'
```

### Response Format
```json
{
  "timestamp": "2025-01-15T12:00:00.000Z",
  "type": "all",
  "data": [
    {
      "userId": "uuid",
      "currenciesProcessed": ["PHP", "BTC"],
      "success": true
    },
    {
      "entity": "house",
      "currenciesProcessed": ["PHP"],
      "success": true
    }
  ]
}
```

## Node.js Script Usage

### Installation
Dependencies are already included in `package.json`:
- `@supabase/supabase-js`
- `node-fetch`

### Available Commands

#### 1. Reconcile All (Default)
Reconciles house balances and all users.
```bash
npm run reconcile-balances
# or
node scripts/reconcile-and-display.js
```

#### 2. Reconcile House Only
```bash
npm run reconcile-house
# or
node scripts/reconcile-and-display.js --type=house
```

#### 3. Reconcile Specific User
```bash
node scripts/reconcile-and-display.js --type=user --userId=<user-uuid>
```

#### 4. Display Balances Without Reconciliation
```bash
npm run display-balances
# or
node scripts/reconcile-and-display.js --no-reconcile
```

### Script Output

The script provides:
1. **Reconciliation Status** - Logs the edge function response
2. **Summary** - Total records, reconciled count, discrepancies, entities, currencies
3. **Detailed Table** - Shows all balance records with:
   - Entity type and ID
   - Currency
   - Wallet vs Computed balance
   - Difference amount
   - Status (✅ Reconciled or ⚠️ Discrepancy)
   - Transaction count
   - Last updated timestamp

4. **By Entity Type** - Aggregated balances per entity
5. **By Currency** - Aggregated balances per currency with reconciliation percentage

### Example Output
```
🔄 Network Balance Reconciliation & Display

Options: type=all, reconcile=true

⏳ Running reconciliation...
✅ Reconciliation completed successfully

📊 Fetching Network Balances...
✅ Found 15 network balance records

📈 Summary:
   Total Records: 15
   Reconciled: 14
   Discrepancies: 1
   Entities: 8
   Currencies: 3

📋 Detailed Balances:
(Table of all records)

👥 By Entity Type:
(Summary by entity)

💱 By Currency:
(Summary by currency)
```

## UI Components

### NetworkBalances Component
Located in `src/components/NetworkBalances.jsx`

**Features:**
- Dropdown menu with 7 table options
- Detailed metadata for each table
- Summary cards showing:
  - Reconciled records count
  - Discrepancy count
  - Total wallets
  - Active loans
  - Transaction count
- Expandable table sections for each data type
- Schema overview documentation

**Table Options:**
1. **Network Balances** - Reconciled balances with status
2. **Wallets** - Multi-currency wallet balances
3. **Loans** - Loan requests and tracking
4. **Wallet Transactions** - Transaction audit trail
5. **Loan Payments** - Individual payment records
6. **Currencies** - Supported currencies
7. **User Profile** - User account information

## Scheduled Reconciliation

### Setting Up Daily Reconciliation
To run reconciliation automatically every 24 hours, use Supabase's edge function scheduler or external cron service:

**Option 1: Via Supabase Dashboard**
- Go to Edge Functions
- Select `reconcile-balances`
- Enable scheduling
- Set cron expression: `0 0 * * *` (daily at midnight UTC)

**Option 2: Via External Cron Service (Zapier, etc.)**
```bash
curl -X GET \
  "https://corcofbmafdxehvlbesx.supabase.co/functions/v1/reconcile-balances?type=all" \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

## Reconciliation Logic

### For User Balances
1. Fetches all wallet_transactions for the user
2. Computes balance by summing transactions (debits negative, credits positive)
3. Compares computed balance to actual wallet balance
4. Records discrepancy if difference > 0.01 (floating-point tolerance)
5. Upserts record to network_balances table

### For House Balances
1. Sums all user wallet balances by currency
2. Compares to house wallet balances
3. Records any discrepancies
4. Upserts record to network_balances table

### Status Rules
- **reconciled**: Math.abs(difference) < 0.01
- **discrepancy**: Otherwise

## Troubleshooting

### No Records Found
- Ensure `wallet_transactions` table has data
- Check that `wallets` table exists and has user wallets
- Verify `currencies` table is populated

### Discrepancies Detected
- Check `wallet_transactions` for any manual edits or data issues
- Verify transaction types are correctly classified (debit vs credit)
- Review `balance_difference` value in network_balances

### Edge Function Errors
- Check Supabase dashboard function logs
- Verify environment variables are set correctly
- Ensure service role key has database write permissions

## SQL Commands for Manual Query

### View Latest Balances
```sql
SELECT * FROM network_balances_latest
WHERE entity_id = '<user-uuid>' OR entity_type = 'house'
ORDER BY reconciliation_date DESC;
```

### View All Discrepancies
```sql
SELECT * FROM network_balances
WHERE status = 'discrepancy'
ORDER BY reconciliation_date DESC;
```

### View Summary by Currency
```sql
SELECT * FROM network_balances_summary
ORDER BY entity_type, currency_code;
```

### Get Total Balances by Currency
```sql
SELECT
  currency_code,
  SUM(wallet_balance) as total_wallet,
  SUM(computed_balance) as total_computed,
  SUM(balance_difference) as total_difference,
  COUNT(*) as record_count
FROM network_balances
WHERE status = 'reconciled'
GROUP BY currency_code;
```

## Next Steps

1. ✅ Database migration applied
2. ✅ Edge function deployed
3. ✅ UI component created
4. ✅ Node.js script ready
5. ⏳ Set up scheduled reconciliation (via Supabase or cron service)
6. ⏳ Monitor discrepancies daily

## Support

For issues or questions:
- Check the error message in the Node.js script output
- Review edge function logs in Supabase dashboard
- Query `network_balances` table directly for debugging
