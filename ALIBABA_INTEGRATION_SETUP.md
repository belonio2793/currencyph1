# Alibaba Integration Setup Guide

This guide explains how to set up and use the Alibaba product sync integration for the industry business marketplace.

## Overview

The Alibaba integration system provides:
- **Automated syncing** of Alibaba products into the industrial marketplace
- **Data transformation** from Alibaba's schema to local database format
- **Queue-based processing** for reliable product imports
- **Configuration management** for filtering and controlling imports
- **Status monitoring** and sync history tracking

## Architecture

The system consists of:

1. **Database Tables** (`supabase/migrations/alibaba_integration_setup.sql`):
   - `alibaba_sync_log` - Track sync operations
   - `alibaba_product_mapping` - Link imported products to original Alibaba data
   - `alibaba_sync_queue` - Queue products for processing
   - `alibaba_config` - Store sync settings

2. **Edge Functions**:
   - `alibaba-sync` - Main sync orchestration and API
   - `process-alibaba-sync` - Queue processor (runs every 5 minutes)

3. **Client Service** (`src/lib/alibabaSync.js`):
   - Trigger syncs from the UI
   - Monitor sync status
   - Manage configuration

4. **Data Transformer** (`src/lib/alibabaDataTransformer.js`):
   - Transform Alibaba product data to local format
   - Handle currency conversion
   - Extract metadata and certifications

## Setup Steps

### 1. Database Migration

The migration file has been created at `supabase/migrations/alibaba_integration_setup.sql`. This will:
- Create required tables
- Set up indexes for performance
- Enable Row Level Security (RLS)
- Configure default settings

The migration runs automatically when you deploy to Supabase.

### 2. Configure Alibaba API Credentials

Set these environment variables:

```env
# In your .env file or via DevServerControl
VITE_ALIBABA_APP_ID=your_app_id_here
VITE_ALIBABA_API_KEY=your_api_key_here
VITE_ALIBABA_API_SIGNATURE=your_signature_here
```

To set via DevServerControl (recommended for secrets):
```bash
# Use the DevServerControl tool to set these securely
set_env_variable("VITE_ALIBABA_APP_ID", "your_value")
set_env_variable("VITE_ALIBABA_API_KEY", "your_value")
set_env_variable("VITE_ALIBABA_API_SIGNATURE", "your_value")
```

### 3. Initialize Configuration

Initialize the Alibaba configuration:

```javascript
import { updateAlibabaConfig } from './src/lib/alibabaSync'

await updateAlibabaConfig({
  app_id: process.env.VITE_ALIBABA_APP_ID,
  sync_enabled: true,
  sync_frequency_minutes: 60,
  auto_sync_on_startup: true,
  import_images: true,
  import_certifications: true,
  max_products_per_sync: 1000
})
```

## Usage

### Trigger a Full Sync

```javascript
import { triggerFullAlibabaSync } from './src/lib/alibabaSync'

try {
  const result = await triggerFullAlibabaSync()
  console.log('Full sync started:', result)
} catch (error) {
  console.error('Sync failed:', error)
}
```

### Trigger an Incremental Sync

```javascript
import { triggerIncrementalAlibabaSync } from './src/lib/alibabaSync'

const result = await triggerIncrementalAlibabaSync()
```

### Manually Sync Specific Products

```javascript
import { triggerManualAlibabaSync } from './src/lib/alibabaSync'

const alibabaIds = ['product-id-1', 'product-id-2']
const result = await triggerManualAlibabaSync(alibabaIds)
```

### Monitor Sync Status

```javascript
import { getAlibabaSyncStatus, getAlibabaSyncLogs } from './src/lib/alibabaSync'

const status = await getAlibabaSyncStatus()
console.log('Queue status:', status.queueStatus)
console.log('Recent syncs:', status.recentSyncs)

const logs = await getAlibabaSyncLogs(10)
logs.forEach(log => {
  console.log(`${log.sync_type}: ${log.status} - ${log.products_imported} imported`)
})
```

### Get Configuration

```javascript
import { getAlibabaConfig } from './src/lib/alibabaSync'

const config = await getAlibabaConfig()
console.log('Sync enabled:', config.sync_enabled)
console.log('Last full sync:', config.last_full_sync)
```

### Update Configuration

```javascript
import { updateAlibabaConfig } from './src/lib/alibabaSync'

await updateAlibabaConfig({
  sync_enabled: false,
  max_products_per_sync: 500
})
```

## Cron Jobs

Cron jobs are configured in `supabase/config.toml`:

```toml
[[functions]]
slug = "process-alibaba-sync"

[functions.scheduling]
# Run every 5 minutes to process queued items
cron = "*/5 * * * *"
```

This means:
- Every 5 minutes, the queue processor runs
- Up to 10 pending items are processed per run
- Failed items are retried up to 3 times
- Items exceeding max retries are marked as failed

## Database Schema

### alibaba_sync_log
Tracks each sync operation:
```sql
id                -- Unique sync log ID
sync_type         -- 'full', 'incremental', or 'manual'
status            -- 'in_progress', 'completed', or 'failed'
products_imported -- Count of products imported
products_updated  -- Count of products updated
products_failed   -- Count of failed imports
error_message     -- Error details if failed
metadata          -- Additional sync information
created_at        -- When sync started
```

### alibaba_sync_queue
Queue for products to be synced:
```sql
id                   -- Unique queue item ID
status               -- 'pending', 'processing', 'completed', or 'failed'
sync_type            -- Type of sync
alibaba_product_id   -- Alibaba product ID to sync
attempt_count        -- Number of retry attempts
max_attempts         -- Maximum retry attempts (default: 3)
last_error           -- Error from last attempt
scheduled_for        -- When to process
metadata             -- Business and seller information
```

### alibaba_product_mapping
Links imported products to source data:
```sql
id                        -- Unique mapping ID
industrial_product_id     -- Local product ID (FK to industrial_products)
alibaba_product_id        -- Original Alibaba product ID
alibaba_supplier_id       -- Alibaba supplier ID
supplier_name             -- Supplier name
supplier_url              -- Supplier profile URL
original_price            -- Original USD price
original_currency         -- Original currency code
alibaba_raw_data          -- Raw Alibaba product data (JSON)
last_synced_at            -- Last sync timestamp
```

### alibaba_config
System configuration:
```sql
id                        -- Unique config ID
app_id                    -- Alibaba app ID
sync_enabled              -- Enable/disable syncing
sync_frequency_minutes    -- How often to sync (default: 60)
auto_sync_on_startup      -- Auto-sync when system starts
filter_by_category        -- Enable category filtering
allowed_categories        -- Array of allowed categories
min_price                 -- Minimum product price filter (PHP)
max_price                 -- Maximum product price filter (PHP)
import_images             -- Import product images
import_certifications     -- Import product certifications
max_products_per_sync     -- Products per sync (default: 1000)
last_full_sync            -- Timestamp of last full sync
last_incremental_sync     -- Timestamp of last incremental sync
is_active                 -- Is this config active
```

## API Endpoints

### alibaba-sync Function

All endpoints use POST to `invoke('alibaba-sync')`:

#### Trigger Sync
```json
{
  "action": "sync",
  "syncType": "full" | "incremental",
  "businessId": "optional"
}
```

#### Manual Sync
```json
{
  "action": "manual",
  "alibabaProductIds": ["id1", "id2"],
  "businessId": "optional"
}
```

#### Queue Sync
```json
{
  "action": "queue-sync",
  "alibabaProductIds": ["id1", "id2"]
}
```

#### Get Status
```json
{
  "action": "get-status"
}
```

#### Trigger Full Sync
```json
{
  "action": "trigger-full",
  "businessId": "optional"
}
```

## Data Transformation

The `AlibabaDataTransformer` class handles conversion:

**Alibaba fields** → **Local fields**:
- `productName` → `name`
- `productDescription` → `description`
- `price` (USD) → `price` (PHP, with exchange rate)
- `category` → `category` (mapped)
- `images` → `image_urls`, `primary_image_url`
- `supplierRating` → `rating`
- `specifications` → `metadata.specifications`

**Currency Conversion**:
- Default exchange rate: 56 PHP per USD
- Can be customized during transform

**Category Mapping**:
- Automatic mapping of Alibaba categories to local categories
- Support for custom mappings

## Error Handling

The system includes:
- **Automatic retries**: Failed items retry up to 3 times
- **Error logging**: All errors stored in queue items
- **Sync logs**: Complete error messages in sync logs
- **Dead letter handling**: Max retries moves to failed status

## Monitoring

### Check Queue Status
```javascript
const queueStatus = await getAlibabaSyncQueueStatus()
console.log(`Pending: ${queueStatus.pending}`)
console.log(`Processing: ${queueStatus.processing}`)
console.log(`Completed: ${queueStatus.completed}`)
console.log(`Failed: ${queueStatus.failed}`)
```

### Subscribe to Real-time Updates
```javascript
import { subscribeToAlibabaSyncLogs } from './src/lib/alibabaSync'

const unsubscribe = subscribeToAlibabaSyncLogs((payload) => {
  console.log('Sync log update:', payload)
})

// Later: unsubscribe()
```

## Troubleshooting

### Sync Not Running
- Check `sync_enabled` in `alibaba_config`
- Verify Alibaba API credentials are set
- Check edge function logs in Supabase

### Queue Items Stuck
- Check `last_error` field in queue items
- Verify business/seller IDs exist
- Look at sync logs for details

### API Credentials Not Found
Set environment variables using:
```bash
VITE_ALIBABA_APP_ID=your_id
VITE_ALIBABA_API_KEY=your_key
VITE_ALIBABA_API_SIGNATURE=your_signature
```

### Currency Conversion Issues
Update exchange rate when initializing transformer:
```javascript
AlibabaDataTransformer.transformProduct(product, businessId, sellerId, 55)
// Using 55 PHP per USD instead of default 56
```

## Security Considerations

1. **API Credentials**: Stored in environment variables, not database
2. **RLS Policies**: Enabled on all tables
3. **Data Isolation**: Products linked to businesses for multi-tenancy
4. **Audit Trail**: All syncs logged with timestamps

## Performance Optimization

- **Batch processing**: Up to 1000 products per sync
- **Queue limits**: 10 items processed per cron run (keeps duration < 60s)
- **Indexes**: Optimized for status and timestamp queries
- **Caching**: Config cached in memory during sync

## Next Steps

1. **Get Alibaba API access**:
   - Visit https://open.alibaba.com
   - Create an application
   - Get App ID, API Key, and Signature

2. **Test the integration**:
   - Set environment variables
   - Initialize configuration
   - Trigger a manual sync with test products

3. **Monitor in production**:
   - Set up alerts for failed syncs
   - Monitor queue depth
   - Review sync logs regularly

4. **Customize as needed**:
   - Adjust sync frequency
   - Configure product filters
   - Add custom category mappings
