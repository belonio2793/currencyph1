#!/bin/bash

# Download and store TripAdvisor photos to Supabase storage
# 
# Usage:
#   ./download-tripadvisor-photos.sh                    # First 10 listings
#   ./download-tripadvisor-photos.sh 50 100             # 50 listings per batch, limit 100 total
#   ./download-tripadvisor-photos.sh 20 500 0           # 20 per batch, 500 limit, start at 0

set -e

BATCH=${1:-10}
LIMIT=${2:-999999}
START=${3:-0}

echo "======================================================"
echo "  Download & Store TripAdvisor Photos"
echo "======================================================"
echo ""
echo "Configuration:"
echo "  Batch size: $BATCH"
echo "  Limit: $LIMIT"
echo "  Start offset: $START"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found"
  exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo ""

# Check if script exists
if [ ! -f "scripts/download-and-store-photos.js" ]; then
  echo "❌ Script not found: scripts/download-and-store-photos.js"
  exit 1
fi

echo "Starting download process..."
echo ""

# Run the Node.js script
node scripts/download-and-store-photos.js --batch=$BATCH --limit=$LIMIT --start=$START

echo ""
echo "✓ Download process completed"
echo ""
echo "Check your database to verify photos were stored:"
echo "  SELECT id, name, photo_count FROM nearby_listings"
echo "  WHERE photo_urls IS NOT NULL ORDER BY updated_at DESC;"
echo ""
