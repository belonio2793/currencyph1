#!/bin/bash

# Grok CSV Enrichment Script Runner
# This script enriches nearby_listings from TripAdvisor using Grok API

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 TripAdvisor Listings Enrichment with Grok API${NC}"
echo "=================================================="

# Check required environment variables
if [ -z "$X_API_KEY" ]; then
    echo -e "${RED}❌ X_API_KEY not set${NC}"
    echo "Set your Grok API key:"
    echo "  export X_API_KEY='xai-...'"
    exit 1
fi

if [ -z "$PROJECT_URL" ] && [ -z "$VITE_PROJECT_URL" ]; then
    echo -e "${RED}❌ Supabase PROJECT_URL not set${NC}"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -z "$VITE_SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ Supabase SERVICE_ROLE_KEY not set${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All credentials found${NC}"
echo ""

# Run the enrichment script
echo "Starting enrichment process..."
echo ""

node scripts/grok-enrich-csv-listings.js

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✅ Enrichment completed successfully!${NC}"
else
    echo -e "${RED}❌ Enrichment completed with errors${NC}"
fi

exit $exit_code
