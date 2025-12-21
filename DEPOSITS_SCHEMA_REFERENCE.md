# Deposits Table - Complete Schema Reference

## Overview
The enhanced deposits table is now a self-contained, comprehensive record of every deposit transaction with complete audit trail, currency information, and rate tracking.

## Core Deposit Fields

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Unique deposit identifier |
| `user_id` | UUID | User who made the deposit |
| `wallet_id` | UUID | Target wallet for the deposit |
| `amount` | NUMERIC(36,8) | Original deposit amount |
| `status` | VARCHAR | pending / processing / approved / rejected / completed / failed / cancelled |
| `created_at` | TIMESTAMPTZ | When deposit was initiated |
| `updated_at` | TIMESTAMPTZ | When deposit record was last modified |

## Source Currency Information (WHAT WAS DEPOSITED FROM)

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `original_currency` | VARCHAR(16) | Code of deposited currency | 'BTC', 'USD', 'ETH' |
| `original_currency_name` | VARCHAR(100) | Human-readable name | 'Bitcoin', 'US Dollar', 'Ethereum' |
| `original_currency_symbol` | VARCHAR(10) | Symbol representation | '₿', '$', 'Ξ' |

## Target Currency Information (WALLET CURRENCY)

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `currency_code` | VARCHAR(16) | Target wallet currency | 'PHP', 'USD' |
| `currency_name` | VARCHAR(100) | Human-readable target currency | 'Philippine Peso' |
| `currency_symbol` | VARCHAR(10) | Target currency symbol | '₱' |

## Amount and Received Information

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `received_amount` | NUMERIC(36,8) | Amount credited to wallet | 51504872.77 |
| `conversion_fee` | NUMERIC(18,8) | Fee deducted during conversion | 1000.00 |
| `conversion_fee_currency` | VARCHAR(16) | Currency of the fee | 'PHP' |
| `net_received_amount` | NUMERIC(36,8) | Amount after fees | 51503872.77 |

## Exchange Rate Tracking (TIME-BASED)

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `exchange_rate` | NUMERIC(18,8) | Conversion rate used | 5150487.27 |
| `exchange_rate_at_time` | NUMERIC(18,8) | Rate at exact moment of conversion | 5150487.27 |
| `time_based_rate` | NUMERIC(18,8) | Historical rate (snapshot) | 5150487.27 |
| `rate_source` | VARCHAR(50) | Where rate came from | 'coingecko', 'coinbase', 'internal_api' |
| `rate_fetched_at` | TIMESTAMPTZ | When rate was fetched | 2025-12-21 10:30:45 UTC |

## Processing Timeline

| Field | Type | Purpose |
|-------|------|---------|
| `processed_at` | TIMESTAMPTZ | When deposit was processed/approved |
| `processing_time_ms` | INTEGER | Time from initiation to completion (milliseconds) |
| `webhook_received_at` | TIMESTAMPTZ | When external webhook/confirmation arrived |
| `confirmation_received_at` | TIMESTAMPTZ | When user confirmation was received |
| `verified_at` | TIMESTAMPTZ | When identity/payment was verified |
| `completed_at` | TIMESTAMPTZ | When deposit fully completed |

## Verification and Source Tracking

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `verification_method` | VARCHAR(50) | How it was verified | 'didit', 'manual', 'auto', 'phone_otp' |
| `initiator_ip_address` | INET | IP address that initiated deposit | 192.168.1.1 |
| `initiator_user_agent` | TEXT | Browser/device info | 'Mozilla/5.0 Chrome/120...' |

## Reference and Tracking Numbers

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `reference_number` | VARCHAR(100) | User-provided reference | '12345678' (GCash ref) |
| `internal_reference` | VARCHAR(100) | Our internal tracking ID | 'DEP-2025-12-21-001' |
| `gateway_reference` | VARCHAR(255) | Payment gateway reference | 'stripe_pi_123456' |
| `blockchain_tx_hash` | VARCHAR(255) | Blockchain transaction hash | '0x123abc...' |
| `phone_number` | TEXT | Phone for GCash/mobile payments | '+639123456789' |
| `external_tx_id` | TEXT | External transaction identifier |  |
| `transaction_id` | UUID | Links to wallet_transactions ledger | UUID reference |

## Method Information

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `deposit_method` | TEXT | How user deposited | 'gcash', 'btc', 'eth', 'solana', 'bank_transfer' |
| `payment_address` | TEXT | Wallet address for crypto |  |
| `payment_reference` | TEXT | Reference for payment |  |
| `description` | TEXT | Human description of deposit | 'Deposit from BTC (≈ 51,504,872.77 PHP at 5150487.27)' |

## Comprehensive Data Storage

| Field | Type | Purpose |
|-------|------|---------|
| `notes` | TEXT (JSON) | Original metadata from deposit creation |
| `metadata` | JSONB | Additional custom metadata |
| `transaction_details` | JSONB | **Complete transaction snapshot** - all key data in one place |
| `audit_log` | JSONB | **Array of all events** - status changes, rate updates, etc. |
| `error_details` | JSONB | Any error information if deposit failed |

## What's in transaction_details JSONB?

```json
{
  "original_amount": 10.00,
  "original_currency": "BTC",
  "original_currency_name": "Bitcoin",
  "original_currency_symbol": "₿",
  
  "received_amount": 51504872.77,
  "net_received_amount": 51503872.77,
  "received_currency": "PHP",
  "received_currency_name": "Philippine Peso",
  "received_currency_symbol": "₱",
  
  "exchange_rate": 5150487.277,
  "exchange_rate_at_time": 5150487.277,
  "time_based_rate": 5150487.277,
  "rate_source": "coingecko",
  "rate_fetched_at": "2025-12-21T10:30:45Z",
  
  "conversion_fee": 1000.00,
  "conversion_fee_currency": "PHP",
  "conversion_rate_percentage": 515048.73,
  
  "deposit_method": "btc",
  "deposit_type": "cryptocurrency",
  "network": "bitcoin",
  "verification_method": "manual",
  
  "reference_number": "DEP-12345",
  "internal_reference": "DEP-2025-12-21-001",
  "gateway_reference": "stripe_pi_123456",
  "blockchain_tx_hash": "0x123abc...",
  
  "transaction_id": "uuid-here",
  "external_tx_id": "ext-12345",
  
  "created_at": "2025-12-21T10:00:00Z",
  "processed_at": "2025-12-21T10:05:00Z",
  "webhook_received_at": "2025-12-21T10:02:00Z",
  "confirmation_received_at": "2025-12-21T10:03:00Z",
  "verified_at": "2025-12-21T10:04:00Z",
  "approved_at": "2025-12-21T10:05:00Z",
  "completed_at": "2025-12-21T10:05:30Z",
  
  "status": "completed",
  "processing_time_ms": 5300,
  
  "initiator_ip_address": "192.168.1.1",
  "initiator_user_agent": "Mozilla/5.0..."
}
```

## What's in audit_log JSONB?

```json
[
  {
    "timestamp": "2025-12-21T10:00:00Z",
    "event": "deposit_created",
    "previous_status": null,
    "new_status": "pending",
    "exchange_rate_used": 5150487.277,
    "received_amount": 51504872.77
  },
  {
    "timestamp": "2025-12-21T10:05:00Z",
    "event": "status_transition_to_approved",
    "previous_status": "pending",
    "new_status": "approved",
    "exchange_rate_used": 5150487.277,
    "received_amount": 51504872.77
  },
  {
    "timestamp": "2025-12-21T10:05:30Z",
    "event": "status_transition_to_completed",
    "previous_status": "approved",
    "new_status": "completed",
    "exchange_rate_used": 5150487.277,
    "received_amount": 51504872.77
  }
]
```

## Key Indexes for Performance

```sql
CREATE INDEX idx_deposits_time_based_rate ON deposits(rate_fetched_at DESC);
CREATE INDEX idx_deposits_original_currency ON deposits(original_currency);
CREATE INDEX idx_deposits_processed ON deposits(processed_at DESC);
CREATE INDEX idx_deposits_blockchain_tx ON deposits(blockchain_tx_hash);
CREATE INDEX idx_deposits_user ON deposits(user_id);
CREATE INDEX idx_deposits_wallet ON deposits(wallet_id);
CREATE INDEX idx_deposits_method ON deposits(deposit_method);
CREATE INDEX idx_deposits_status ON deposits(status);
CREATE INDEX idx_deposits_created ON deposits(created_at DESC);
CREATE INDEX idx_deposits_user_status ON deposits(user_id, status);
```

## Deposits with Details View

The `deposits_with_details` view joins all this information with wallet data:

```sql
SELECT 
  d.id, d.user_id, d.wallet_id,
  d.amount, d.original_currency, d.original_currency_name, d.original_currency_symbol,
  d.received_amount, d.net_received_amount,
  d.currency_code, d.currency_name, d.currency_symbol,
  d.exchange_rate, d.exchange_rate_at_time, d.time_based_rate,
  d.rate_source, d.rate_fetched_at,
  d.deposit_method, d.reference_number,
  d.status, d.created_at, d.completed_at,
  d.processing_time_ms,
  w.balance as wallet_balance,
  w.account_number,
  u.email as user_email,
  d.transaction_details, d.audit_log
FROM deposits d
JOIN wallets w ON d.wallet_id = w.id
LEFT JOIN users u ON d.user_id = u.id;
```

## Example Queries

### Get all completed deposits for a user with full details
```sql
SELECT 
  id, amount, original_currency, received_amount, 
  currency_code, exchange_rate_at_time, processing_time_ms,
  created_at, completed_at, status
FROM deposits_with_details
WHERE user_id = 'user-uuid'
  AND status = 'completed'
ORDER BY completed_at DESC;
```

### Get recent crypto deposits with rates
```sql
SELECT 
  deposit_method, amount, original_currency,
  received_amount, exchange_rate_at_time,
  rate_source, rate_fetched_at,
  processing_time_ms
FROM deposits
WHERE original_currency IN ('BTC', 'ETH', 'SOL')
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Audit trail for a specific deposit
```sql
SELECT 
  id, created_at, status,
  exchange_rate_at_time, received_amount,
  audit_log,
  transaction_details
FROM deposits
WHERE id = 'deposit-uuid';
```

## Data Integrity

### Immutability
- Once a deposit is marked `completed`, critical fields cannot be modified
- All changes are logged in `audit_log`

### Atomic Crediting
- When status transitions to `approved`/`completed`, wallet is credited atomically
- Transaction is recorded in `wallet_transactions` with reference back to deposit
- `transaction_id` field links the two records

### Historical Rates
- `exchange_rate_at_time` captures the exact rate used
- Never changes after deposit is processed
- Allows historical auditing of what rate was used

## Migration Instructions

Apply the migration:
```bash
# The migration file is at:
supabase/migrations/104_enhance_deposits_with_transaction_details.sql

# Run via Supabase CLI:
supabase migration up
```

Verify the changes:
```sql
-- Check columns exist
\d deposits

-- Check view exists
SELECT * FROM information_schema.views WHERE table_name = 'deposits_with_details';

-- Check indexes
SELECT * FROM pg_indexes WHERE tablename = 'deposits';
```
