# 🌍 TripAdvisor Philippines Population Guide

Complete guide to populate your database with 2,500-3,500 Philippine listings from TripAdvisor.

## ⚡ Quick Start (3 Options)

### Option 1: Web UI (Easiest - No Terminal)
```
1. Click "Admin" button in the app
2. Click "Full TripAdvisor API" tab
3. Click "Start Full Population"
4. Watch progress bar (10-30 minutes)
5. See success message
```

### Option 2: NPM Command
```bash
npm run populate-all
```

### Option 3: Bash Script (Recommended for Automation)
```bash
./scripts/populate-all-listings.sh
```

---

## 📊 What You'll Get

| Metric | Count |
|--------|-------|
| **Cities** | 120+ |
| **Categories** | 9 |
| **Total Operations** | 1,080+ |
| **Expected Listings** | 2,500-3,500 |
| **Estimated Time** | 10-30 minutes |

### Cities Included
- Metro Manila (14 cities)
- NCR nearby (37 municipalities)
- Tagalog Region (26 cities)
- Visayas Region (18 cities)
- Mindanao Region (18 cities)
- Palawan Region (10 cities)

### Categories Included
- Attractions
- Museums
- Historical Sites
- Parks
- Beaches
- Hotels
- Restaurants
- Churches
- Things to Do

---

## 🚀 Using the Bash Script

### Basic Usage
```bash
./scripts/populate-all-listings.sh
```

### With Environment Variables
```bash
export VITE_PROJECT_URL="https://your-project.supabase.co"
export VITE_SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
./scripts/populate-all-listings.sh
```

### Features
- ✅ Environment validation
- ✅ Dependency checking
- ✅ Real-time progress bar
- ✅ Resume capability (if interrupted, run again to continue)
- ✅ State tracking and recovery
- ✅ Detailed logging to `/tmp/tripadvisor-population.log`
- ✅ Color-coded output
- ✅ Fallback to mock data if API unavailable

### Output Example
```
╔════════════════════════════════════════════════════════════╗
║  TripAdvisor Philippines Comprehensive Population Script    ║
║  Version 2.0 - Enhanced with Resume & Mock Data Support    ║
╚════════════════════════════════════════════════════════════╝

[INFO] TripAdvisor Philippines Population Script Started
[INFO] Log file: /tmp/tripadvisor-population.log
[INFO] State file: /tmp/tripadvisor-population-state.json

[INFO] Cities to process: 120
[INFO] Categories per city: 9
[INFO] Total operations: 1,080
[INFO] TripAdvisor API: disabled (using mock data)

[20.5%] [██████░░░░░░░░░░░░░░░░░░░░░░] Manila - attractions
[21.0%] [██████░░░░░░░░░░░░░░░░░░░░░░] Manila - museums
...
```

---

## 🔧 Configuration

### Environment Variables Required
```bash
VITE_PROJECT_URL              # Your Supabase project URL
VITE_SUPABASE_SERVICE_ROLE_KEY # Your service role key (admin access)
```

### Optional
```bash
VITE_TRIPADVISOR    # TripAdvisor API key (if not set, uses mock data)
ENABLE_SCRAPING     # Set to 'true' to enable web scraping (experimental)
```

### How to Set Environment Variables

#### Option A: In `.env` file
```bash
VITE_PROJECT_URL=https://your-project.supabase.co
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_TRIPADVISOR=your-api-key
```

#### Option B: Export in terminal
```bash
export VITE_PROJECT_URL="https://your-project.supabase.co"
export VITE_SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
./scripts/populate-all-listings.sh
```

#### Option C: Platform setting (Builder.io)
Use DevServerControl to set environment variables.

---

## 📈 Understanding the Process

### Step 1: Data Collection (5-10 minutes)
- Queries TripAdvisor API for each city × category combination
- Makes 1,080 requests (120 cities × 9 categories)
- Rate-limited at 300ms per request
- Deduplicates listings automatically
- Falls back to mock data if API unavailable

### Step 2: Deduplication (<1 minute)
- Removes duplicate listings using tripadvisor_id
- Keeps unique listings only
- Result: 2,500-3,500 unique records

### Step 3: Database Insert (5-15 minutes)
- Inserts listings in batches of 50
- Uses UPSERT to update existing records
- Shows real-time progress
- Validates each batch

### Step 4: Completion
- Displays summary statistics
- Cleans up temporary files
- Provides next steps

---

## ✅ Verification

### Count All Listings
```sql
SELECT COUNT(*) FROM nearby_listings;
-- Should show: 2,500-3,500
```

### Check by Category
```sql
SELECT DISTINCT category FROM nearby_listings;
-- Should show all 9 categories
```

### Check by City
```sql
SELECT COUNT(*) as count, raw->>'city' as city
FROM nearby_listings
GROUP BY raw->>'city'
ORDER BY count DESC
LIMIT 10;
```

### Check Quality
```sql
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN rating > 0 THEN 1 END) as with_ratings,
  AVG(rating) as avg_rating,
  MIN(rating) as min_rating,
  MAX(rating) as max_rating
FROM nearby_listings;
```

---

## 🐛 Troubleshooting

### Problem: "Missing required environment variables"
**Solution:**
```bash
export VITE_PROJECT_URL="https://your-project.supabase.co"
export VITE_SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
./scripts/populate-all-listings.sh
```

### Problem: "node: command not found"
**Solution:** Install Node.js from https://nodejs.org/

### Problem: "Permission denied"
**Solution:**
```bash
chmod +x scripts/populate-all-listings.sh
./scripts/populate-all-listings.sh
```

### Problem: Script is very slow
**This is normal!** 
- 1,080 API requests × 300ms rate limit = 5-10 minutes minimum
- Network delays can add more time
- Database inserts add 5-15 minutes
- Total expected time: 10-30 minutes

**Monitor progress:**
```bash
tail -f /tmp/tripadvisor-population.log
```

### Problem: Script was interrupted/crashed
**Solution:** Run again - it has resume capability!
```bash
./scripts/populate-all-listings.sh
```
The script will resume from where it left off using the state file.

### Problem: No listings inserted
**Possible causes:**
1. Database permissions issue
2. `nearby_listings` table doesn't exist
3. Service role key is invalid

**Check:**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM nearby_listings;"

# Or in Supabase console
SELECT * FROM nearby_listings LIMIT 1;
```

### Problem: 0 (zero) listings
- This is fine! It means mock data is being used
- TripAdvisor API might be unavailable
- Script will generate realistic mock data based on city + category

---

## 🔄 Running Multiple Times

### Safe to Re-run
The script uses UPSERT, so running it multiple times is safe:
- ✅ Won't create duplicates
- ✅ Will update existing records with fresh data
- ✅ Safe for scheduling with cron jobs

### Cron Job Example
```bash
# Populate every week at 2 AM on Sunday
0 2 * * 0 /path/to/scripts/populate-all-listings.sh >> /var/log/tripadvisor-population.log 2>&1
```

---

## 📝 Log Files

### Main Log
```
/tmp/tripadvisor-population.log
```

### State File (for resume capability)
```
/tmp/tripadvisor-population-state.json
```

### View Logs
```bash
# Real-time monitoring
tail -f /tmp/tripadvisor-population.log

# Full log
cat /tmp/tripadvisor-population.log

# Search for errors
grep ERROR /tmp/tripadvisor-population.log

# Count progress
grep progress /tmp/tripadvisor-population.log | tail -1
```

---

## 🎯 Use Cases

### Initial Setup
```bash
# Populate database once
./scripts/populate-all-listings.sh
```

### Regular Updates
```bash
# Schedule to run weekly
crontab -e
# Add: 0 2 * * 0 /path/to/scripts/populate-all-listings.sh
```

### Development Testing
```bash
# Run in development to test
npm run populate-all
```

### CI/CD Pipeline
```bash
# In your deployment script
./scripts/populate-all-listings.sh || exit 1
echo "Listings populated successfully"
```

---

## 📊 Performance Tips

### Speed Up Data Collection
1. **Provide TripAdvisor API key** (instead of using mock data)
2. **Use a faster internet connection**
3. **Run during off-peak hours**

### Speed Up Database Inserts
1. **Increase batch size** (edit BATCH_SIZE in script)
2. **Reduce rate limiting** (edit RATE_LIMIT_MS in script)
3. **Use a closer database region**

### Monitor Performance
```bash
# Watch progress
watch 'tail -5 /tmp/tripadvisor-population.log'

# Check database size
SELECT pg_size_pretty(pg_total_relation_size('nearby_listings'));
```

---

## 🔗 Related Commands

```bash
# Populate listings
npm run populate-all
./scripts/populate-all-listings.sh

# Import photos
npm run import-photos

# Scrape manually
npm run scrape-tripadvisor

# View in admin UI
# Click "Admin" button in app

# Check Supabase dashboard
# https://supabase.com/dashboard
```

---

## 🆘 Need Help?

1. **Check the log file:**
   ```bash
   cat /tmp/tripadvisor-population.log
   ```

2. **Check state file:**
   ```bash
   cat /tmp/tripadvisor-population-state.json
   ```

3. **Verify database connection:**
   ```bash
   echo $VITE_PROJECT_URL
   echo $VITE_SUPABASE_SERVICE_ROLE_KEY
   ```

4. **Test with verbose output:**
   ```bash
   bash -x scripts/populate-all-listings.sh 2>&1 | tee debug.log
   ```

---

## 📚 File Structure

```
scripts/
├── populate-all-listings.sh      (Main bash script)
├── populate-all-listings.js      (Node.js implementation)
├── import-photos.js              (Photo import)
├── scrape_tripadvisor.js         (Web scraper)
└── README.md                      (Script documentation)
```

---

## 🎓 How It Works (Technical)

### Data Flow
```
[Script Start]
    ↓
[Validate Environment]
    ↓
[Create Population Script]
    ↓
[For each City × Category]
  ├─ Query TripAdvisor API
  ├─ Fallback to Mock Data
  └─ Deduplicate
    ↓
[Collect 2,500-3,500 Listings]
    ↓
[Insert in Batches of 50]
    ↓
[UPSERT to Database]
    ↓
[Success Message + Stats]
```

### Database Schema
```sql
CREATE TABLE nearby_listings (
  id BIGINT PRIMARY KEY,
  tripadvisor_id TEXT UNIQUE,
  name TEXT,
  address TEXT,
  latitude FLOAT,
  longitude FLOAT,
  rating FLOAT,
  category TEXT,
  reviewCount INT,
  raw JSONB,
  updated_at TIMESTAMP
);
```

---

## ✨ Features

- ✅ Comprehensive city coverage (120+ cities)
- ✅ Multiple categories (9 total)
- ✅ Real-time progress tracking
- ✅ Resume capability if interrupted
- ✅ Automatic deduplication
- ✅ TripAdvisor API integration
- ✅ Mock data fallback
- ✅ Database error handling
- ✅ Logging and monitoring
- ✅ Batch processing
- ✅ Rate limiting
- ✅ Color-coded output
- ✅ Cron-friendly
- ✅ CI/CD ready

---

## 📝 Version History

### v2.0 (Current)
- Enhanced with resume capability
- Improved logging and progress tracking
- State persistence for interruption recovery
- Better error handling
- Comprehensive documentation

### v1.0 (Legacy)
- Basic population functionality
- Limited city coverage
- No resume capability

---

## 📞 Support

- **Documentation:** See this file and related guides
- **Logs:** Check `/tmp/tripadvisor-population.log`
- **Database:** Check Supabase dashboard
- **Issues:** Review troubleshooting section above

---

**Ready to populate? Run:**
```bash
./scripts/populate-all-listings.sh
```

**Or use npm:**
```bash
npm run populate-all
```

Happy listing! 🎉
