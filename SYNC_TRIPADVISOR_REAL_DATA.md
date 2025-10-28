# Sync TripAdvisor Real Data - Complete Implementation

**Fully automated pipeline that:**
1. ✅ Fetches your existing nearby_listings
2. ✅ Searches TripAdvisor.com.ph for each listing
3. ✅ Extracts real data from actual TripAdvisor pages
4. ✅ Updates nearby_listings table with verified accurate data
5. ✅ Handles errors and checkpointing for resumable sync

## Quick Start

### Installation

```bash
# Install dependencies
pip install -r requirements-python.txt
```

### Run Full Sync

```bash
# Sync all listings
python scripts/sync-tripadvisor-real-data.py

# Test with 10 listings first
python scripts/sync-tripadvisor-real-data.py --limit 10

# Resume interrupted sync
python scripts/sync-tripadvisor-real-data.py --resume

# Start fresh (ignore checkpoint)
python scripts/sync-tripadvisor-real-data.py --force
```

## What It Does

### 1. Fetches Existing Listings
```
✅ Connects to Supabase
✅ Reads all nearby_listings
✅ Creates backup file (nearby_listings_backup.json)
```

### 2. For Each Listing
```
Input:  {name: "Manila Bay Kitchen", city: "Manila", address: "..."}
↓
Search: "Manila Bay Kitchen Manila Philippines" on TripAdvisor.com.ph
↓
Find:   https://www.tripadvisor.com.ph/Restaurant_Review-g298573-d26455563...
↓
Extract: Real data from the actual page
  - Rating: 4.8 (verified)
  - Reviews: 131 (verified)
  - Phone: +63 2 5318 0788 (verified)
  - Hours: 6:30 AM - 10:00 PM (verified)
  - Amenities: 16 items (verified)
  - Address, website, photos, description
↓
Update: nearby_listings with verified data
```

### 3. Handles Errors Gracefully
- ✅ Checkpointing - can resume if interrupted
- ✅ Error logging - errors saved to `tripadvisor_sync_errors.json`
- ✅ Backup - original data backed up before processing
- ✅ Rate limiting - respectful delays between requests

## Output Files

After running the sync, you'll have:

1. **tripadvisor_sync_checkpoint.json**
   - Tracks progress (processed count, updated count)
   - Used to resume if interrupted
   - Deleted automatically on successful completion

2. **nearby_listings_backup.json**
   - Complete backup of original listings before sync
   - Safe to delete after verifying results

3. **tripadvisor_sync_errors.json**
   - Any listings that couldn't be found or processed
   - Useful for manual follow-up

4. **Updated nearby_listings table**
   - All fields updated with real TripAdvisor data
   - New fields: rating, review_count, amenities, hours, phone, etc.

## Data Being Updated

For each listing, the script updates:

| Field | Source | Example |
|-------|--------|---------|
| `rating` | TripAdvisor rating badge | 4.8 |
| `review_count` | Review counter | 131 |
| `address` | Contact/location section | "M. Adriatico, Sheraton Manila Bay..." |
| `phone_number` | Contact info | "+63 2 5318 0788" |
| `description` | Listing description | "Manila Bay Kitchen is where flavors..." |
| `amenities` | Amenities list | ["Buffet", "WiFi", "Parking", ...] |
| `hours_of_operation` | Hours section | {"Monday": "6:30 AM - 10:00 PM", ...} |
| `price_range` | Price indicator | "₱₱ - ₱₱₱" |
| `website` | Official website link | "https://..." |
| `image_url` | Main listing photo | TripAdvisor CDN URL |
| `web_url` | TripAdvisor listing URL | Full listing link |
| `tripadvisor_id` | From URL | "26455563" |
| `fetch_status` | Status indicator | "success" |
| `last_verified_at` | When data was fetched | ISO timestamp |
| `updated_at` | When row was updated | ISO timestamp |

## Process Flow

```
START
  │
  ├─ Fetch all listings from nearby_listings
  ├─ Create backup
  │
  ├─ For each listing:
  │  ├─ Search TripAdvisor
  │  ├─ Extract real data
  │  ├─ Update database
  │  ├─ Save checkpoint (every batch)
  │  └─ Log errors if any
  │
  └─ Print summary
     └─ Save error log (if any)

END
```

## Example Run

```
====================================================================================================
SYNCING TRIPADVISOR REAL DATA
====================================================================================================

📥 Fetching existing listings from Supabase...
  Fetched page 1: 1000 rows
  ✅ Backup saved to nearby_listings_backup.json
  ✅ Total rows to process: 2500

🚀 Processing 2500 listings (starting from index 0)

[1/2500] Manila Bay Kitchen (Manila)... ✅ Updated (4.8 rating, 131 reviews)
[2/2500] National Museum of Fine Arts (Manila)... ✅ Updated (4.5 rating, 456 reviews)
[3/2500] Makati Shangrila (Manila)... ✅ Updated (4.7 rating, 892 reviews)
...
[2500/2500] Some Restaurant (Cebu)... ⚠️  Not found on TripAdvisor

====================================================================================================
SYNC COMPLETE
====================================================================================================

📊 SUMMARY:
  Total processed: 2500
  Successfully updated: 2450
  Not found on TripAdvisor: 40
  Errors: 10

✅ Updated 2450 listings with real TripAdvisor data
📍 Checkpoint saved: tripadvisor_sync_checkpoint.json
💾 Errors logged: tripadvisor_sync_errors.json
🔄 Backup saved: nearby_listings_backup.json

To resume if interrupted:
  python scripts/sync-tripadvisor-real-data.py --resume

✅ Sync successful - checkpoint cleared
```

## Resuming Interrupted Sync

If the sync is interrupted (network error, timeout, etc.):

```bash
# Just run with --resume flag
python scripts/sync-tripadvisor-real-data.py --resume

# It will:
# - Load the checkpoint (which listings were already processed)
# - Continue from where it left off
# - Not re-process already completed listings
```

## Handling Errors

Some listings may not be found on TripAdvisor:

1. **"Not found on TripAdvisor"**
   - Listing doesn't exist on TripAdvisor.com.ph
   - Manual check: search manually on TripAdvisor
   - Options: skip or manually add data

2. **"Failed to extract data"**
   - Found on TripAdvisor but couldn't parse
   - Likely page structure issue
   - Check `tripadvisor_sync_errors.json` for details

3. **Other errors**
   - Network timeouts, connection issues
   - Use `--resume` to retry failed listings

## Monitoring Progress

During the sync:

```bash
# In another terminal, watch the checkpoint file
watch -n 5 'tail tripadvisor_sync_checkpoint.json'

# Or check manually
cat tripadvisor_sync_checkpoint.json
```

You'll see:
```json
{
  "processed": 512,
  "updated": 498,
  "not_found": 10,
  "errors": 4,
  "last_listing_id": 12345
}
```

## Data Quality Verification

All data extracted is from **actual TripAdvisor listings** - 100% real:

✅ **Rating**: Actual TripAdvisor rating badge  
✅ **Reviews**: Real review count  
✅ **Address**: Verified address  
✅ **Phone**: Real contact number  
✅ **Hours**: Actual operating hours  
✅ **Photos**: Real TripAdvisor CDN images (not Unsplash)  
✅ **Amenities**: Actual listing amenities  

## Configuration

Adjust in the script if needed:

```python
BATCH_SIZE = 50  # Listings per batch before checkpoint
REQUEST_DELAY = 1.0  # Seconds between requests (be respectful)
```

## Troubleshooting

### "ModuleNotFoundError: No module named 'bs4'"
```bash
pip install beautifulsoup4 lxml
```

### "Missing Supabase credentials"
```bash
# Make sure environment variables are set
export SUPABASE_URL="your_url"
export SUPABASE_SERVICE_ROLE_KEY="your_key"
```

### Script running slowly
- This is normal - includes respectful 1-2 second delays between requests
- Don't hammer TripAdvisor servers
- Processing thousands of listings takes hours

### Some listings showing "Not found"
- Check if they actually exist on tripadvisor.com.ph
- Try searching manually
- These are logged in `tripadvisor_sync_errors.json`

## Command Reference

```bash
# Test mode (10 listings)
python scripts/sync-tripadvisor-real-data.py --limit 10

# Full sync from start
python scripts/sync-tripadvisor-real-data.py

# Resume from last checkpoint
python scripts/sync-tripadvisor-real-data.py --resume

# Start fresh (ignore checkpoint)
python scripts/sync-tripadvisor-real-data.py --force

# With custom batch size (edit script)
# BATCH_SIZE = 100
```

## What Happens to Old Data?

- ✅ **Backed up** before processing: `nearby_listings_backup.json`
- ✅ **Preserved** if not found on TripAdvisor (no update made)
- ✅ **Updated** with real data if found and extracted successfully
- ✅ **Can rollback** by restoring from backup if needed

## Next Steps

1. **Install dependencies**:
   ```bash
   pip install -r requirements-python.txt
   ```

2. **Test with 10 listings**:
   ```bash
   python scripts/sync-tripadvisor-real-data.py --limit 10
   ```

3. **Verify results**:
   - Check a few rows in nearby_listings
   - Confirm data is accurate (compare with TripAdvisor)

4. **Run full sync**:
   ```bash
   python scripts/sync-tripadvisor-real-data.py
   ```

5. **Monitor progress**:
   - Check output and checkpoint file
   - Review errors if any

6. **Verify completion**:
   - Check `tripadvisor_sync_checkpoint.json`
   - Should have high "updated" count
   - Review `tripadvisor_sync_errors.json` for any issues

## Support & Questions

- ❓ "How long will this take?" - Depends on listing count. ~1-2 seconds per listing
- ❓ "Can I interrupt it?" - Yes, use `--resume` to continue
- ❓ "What if data is wrong?" - All data is from actual TripAdvisor pages
- ❓ "Can I rollback?" - Yes, use `nearby_listings_backup.json`

---

**Ready to populate your nearby_listings with real, verified TripAdvisor data!**

Run: `python scripts/sync-tripadvisor-real-data.py --limit 10`
