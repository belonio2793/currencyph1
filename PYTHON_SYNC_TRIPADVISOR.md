# Python TripAdvisor Sync Script

An alternative to the Node.js `sync-tripadvisor-locally.js` script, written in Python for flexibility and cross-platform compatibility.

## Setup

### 1. Install Python Dependencies

```bash
# Install required packages
pip install -r requirements-python.txt
```

Or install individually:
```bash
pip install supabase requests python-dotenv
```

### 2. Ensure Environment Variables are Set

The script reads from environment variables. Make sure these are available:
- `VITE_PROJECT_URL` or `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `VITE_TRIPADVISOR` or `TRIPADVISOR` - Your TripAdvisor API key

These are already configured in your `.env` file or can be set via your shell.

## Usage

### Test with 10 listings in Manila first

```bash
python scripts/sync-tripadvisor.py --city=Manila --limit=10
```

### Sync all categories for a specific city

```bash
# Cebu
python scripts/sync-tripadvisor.py --city=Cebu

# Davao
python scripts/sync-tripadvisor.py --city=Davao
```

### Sync a specific category for all cities

```bash
python scripts/sync-tripadvisor.py --category=attractions
```

### Sync specific city and category

```bash
python scripts/sync-tripadvisor.py --city=Manila --category=attractions
```

### Sync all data (all cities and categories)

```bash
python scripts/sync-tripadvisor.py
```

### With custom limit

```bash
python scripts/sync-tripadvisor.py --city=Manila --limit=50
```

## Command-Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--city` | Sync only a specific city (optional, defaults to all) | `--city=Manila` |
| `--category` | Sync only a specific category (optional, defaults to all) | `--category=attractions` |
| `--limit` | Results per query (default: 30, max: 30) | `--limit=20` |
| `--resume` | Resume from last checkpoint (planned feature) | `--resume` |

## Features

✅ **Deduplication**: Automatically removes duplicate listings by `tripadvisor_id`  
✅ **Batch Upsert**: Inserts/updates listings in chunks of 50 for efficiency  
✅ **Progress Tracking**: Shows real-time progress with counts  
✅ **Error Handling**: Gracefully handles API errors and continues processing  
✅ **Rate Limiting**: Built-in delays between API calls to respect rate limits  

## Available Cities (180+ Philippine Cities)

Abuyog, Alaminos, Alcala, Angeles, Antipolo, Aroroy, Bacolod, Bacoor, Baguio, Bago, Bais, Balanga, Baliuag, Bangued, Bansalan, Bantayan, Bataan, Batac, Batangas City, Bayambang, Bayawan, Baybay, Bayugan, Biñan, Bislig, Bocaue, Bogo, Boracay, Borongan, Bohol, Butuan, Cabadbaran, Cabanatuan, Cabuyao, Cadiz, Cagayan de Oro, Calamba, Calapan, Calbayog, Caloocan, Camiling, Canlaon, Caoayan, Capiz, Caraga, Carmona, Catbalogan, Cauayan, Cavite City, Cebu City, Coron, Cotabato City, Dagupan, Danao, Dapitan, Daraga, Dasmariñas, Davao City, Davao del Norte, Davao del Sur, Davao Oriental, Dipolog, Dumaguete, El Nido, General Santos, General Trias, Gingoog, Guihulngan, Himamaylan, Ilagan, Iligan, Iloilo City, Imus, Isabela, Isulan, Kabankalan, Kidapawan, Koronadal, La Carlota, Laoag, Lapu-Lapu, Las Piñas, Laoang, Legazpi, Ligao, Limay, Lucena, Maasin, Mabalacat, Malabon, Makati, Malaybalay, Malolos, Mandaluyong, Mandaue, Manila, Marawi, Marilao, Masbate City, Mati, Meycauayan, Muntinlupa, Naga (Camarines Sur), Navotas, Olongapo, Ormoc, Oroquieta, Ozamiz, Pagadian, Palo, Palawan, Parañaque, Pasay, Pasig, Passi, Puerto Princesa, Quezon City, Roxas, Sagay, Samal, San Carlos (Negros Occidental), San Carlos (Pangasinan), San Fernando (La Union), San Fernando (Pampanga), San Jose (Antique), San Jose del Monte, San Juan, San Pablo, San Pedro, Santiago, Siargao, Silay, Sipalay, Sorsogon City, Surigao City, Tabaco, Tabuk, Tacloban, Tacurong, Tagaytay, Tagbilaran, Taguig, Talisay (Cebu), Talisay (Negros Occidental), Tanjay, Tarlac City, Tayabas, Toledo, Trece Martires, Tuguegarao, Urdaneta, Valencia, Valenzuela, Victorias, Vigan, Virac, Zamboanga City

## Available Categories

attractions, museums, parks, beaches, hotels, restaurants, churches, shopping, nightlife

## Runtime Expectations

With 180+ cities and 9 categories, syncing **all data** means:
- **1,620+ API queries** (180 cities × 9 categories)
- **~8-10 minutes** of runtime with rate limiting
- **5,000-10,000+ listings** expected from TripAdvisor API

### Recommended Approach:

1. **Start small**: Test with a single city or category first
2. **Scale up**: Sync by category across all cities
3. **Then go full**: Run complete sync for updates

```bash
# Test with 10 items
python scripts/sync-tripadvisor.py --city=Manila --limit=10

# Then one category at a time
python scripts/sync-tripadvisor.py --category=attractions

# Finally, full sync (takes ~10 minutes)
python scripts/sync-tripadvisor.py
```

## Sample Workflow

```bash
# 1. Test with 10 items in Manila
python scripts/sync-tripadvisor.py --city=Manila --limit=10

# 2. If successful, sync all attractions
python scripts/sync-tripadvisor.py --category=attractions

# 3. Then sync restaurants
python scripts/sync-tripadvisor.py --category=restaurants

# 4. Finally, sync everything (takes longer)
python scripts/sync-tripadvisor.py
```

## Output

```
📍 Starting sync for 1 cities × 9 categories
Total queries: 9

[1/9] Fetching attractions in Manila Philippines... ✓ 30 items
[2/9] Fetching museums in Manila Philippines... ✓ 25 items
...

📊 Results:

  Total fetched: 200
  Successful queries: 8
  Failed queries: 1
  Unique listings: 195

💾 Upserting to database...
  ✓ Upserted 50 listings (50/195 total)
  ✓ Upserted 50 listings (100/195 total)
  ✓ Upserted 50 listings (150/195 total)
  ✓ Upserted 45 listings (195/195 total)

✅ Sync complete! Upserted 195 listings.
```

## Troubleshooting

### "Missing Supabase environment variables"
- Ensure `VITE_PROJECT_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Check your `.env` file or shell environment

### "Missing TripAdvisor API key"
- Set `VITE_TRIPADVISOR` or `TRIPADVISOR` environment variable
- Value should be: `48FA28618E1349CCA99296F27323E7B9`

### "ModuleNotFoundError: No module named 'supabase'"
- Run `pip install -r requirements-python.txt`
- Make sure you're using the same Python environment

### API returns 403 or 401
- Verify your TripAdvisor API key is correct
- Check if API quota is exceeded (TripAdvisor has rate limits)

## Differences from Node.js Version

The Python script is functionally identical to `sync-tripadvisor-locally.js` with these minor differences:

- Uses `python-dotenv` for `.env` loading
- Command syntax: `python scripts/sync-tripadvisor.py` instead of `npm run sync-tripadvisor`
- Same environment variables and Supabase upsert logic
- Native Python packages (no npm/yarn required)
