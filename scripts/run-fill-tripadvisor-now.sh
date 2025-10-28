#!/bin/bash

set -e

echo "🚀 TripAdvisor Data Filler - Last Resort Solution"
echo "=================================================="
echo ""
echo "This script will:"
echo "  1. Use Grok (X AI) to identify accurate TripAdvisor IDs"
echo "  2. Fall back to ScrapingBee if Grok fails"
echo "  3. Fetch photo gallery URLs for each listing"
echo "  4. Update nearby_listings table with accurate data"
echo ""
echo "⏳ Starting in 3 seconds (Ctrl+C to cancel)..."
sleep 3

# Check environment variables
if [ -z "$X_API_KEY" ]; then
  echo "❌ Error: X_API_KEY not found in environment"
  exit 1
fi

if [ -z "$PROJECT_URL" ] && [ -z "$VITE_PROJECT_URL" ]; then
  echo "❌ Error: Supabase URL not found"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -z "$VITE_SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: Supabase key not found"
  exit 1
fi

echo "✓ All required environment variables found"
echo ""
echo "Starting enrichment process..."
echo ""

# Run the Node script
node scripts/fill-tripadvisor-data-final.js

echo ""
echo "✅ Process complete! Check results above."
