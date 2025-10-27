#!/bin/bash

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  TripAdvisor Philippines Comprehensive Listings Fetcher    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check environment variables
if [ -z "$PROJECT_URL" ] && [ -z "$VITE_PROJECT_URL" ]; then
    echo "❌ Error: PROJECT_URL or VITE_PROJECT_URL not set"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -z "$VITE_SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_SERVICE_ROLE_KEY not set"
    exit 1
fi

if [ -z "$TRIPADVISOR" ] && [ -z "$VITE_TRIPADVISOR" ]; then
    echo "❌ Error: TRIPADVISOR or VITE_TRIPADVISOR not set"
    exit 1
fi

echo "✓ Environment variables loaded"
echo "✓ Running comprehensive fetcher..."
echo ""

node scripts/fetch-all-cities-listings.js

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Fetch Complete! Check database for results.              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
