#!/bin/bash

# Grok CSV Enrichment - Execute Now
# Run with: bash run-grok-now.sh

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${GREEN}  Grok AI CSV Enrichment for TripAdvisor${BLUE}  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Validate API Key
if [ -z "$X_API_KEY" ]; then
    echo -e "${RED}❌ Error: X_API_KEY environment variable not set${NC}"
    echo ""
    echo "Set it and retry:"
    echo ""
    echo -e "${YELLOW}export X_API_KEY='xai-qe0lzba8kfDmccd5EBClqO7ELZXxYG3hyyetV1b5D4dISqjStXLHcFElnYfmRD3ddy0gV4sHxnR3XZT3'${NC}"
    echo "bash run-grok-now.sh"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ X_API_KEY${NC} found"

# Step 2: Validate CSV exists
if [ ! -f "nearby-listings.csv" ]; then
    echo -e "${RED}❌ Error: nearby-listings.csv not found${NC}"
    echo ""
    echo "The CSV file should be in the project root:"
    echo "  ./nearby-listings.csv"
    echo ""
    exit 1
fi

LISTING_COUNT=$(tail -n +2 nearby-listings.csv | wc -l | tr -d ' ')
echo -e "${GREEN}✅ nearby-listings.csv${NC} found (${LISTING_COUNT} listings)"

# Step 3: Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js${NC} ${NODE_VERSION}"

# Step 4: Check dependencies
if [ ! -d "node_modules" ]; then
    echo ""
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install > /dev/null 2>&1
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Dependencies${NC} ready"
fi

echo ""
echo -e "${BLUE}─────────────────────────────────────────${NC}"
echo -e "${YELLOW}Starting Grok enrichment...${NC}"
echo -e "${BLUE}─────────────────────────────────────────${NC}"
echo ""

# Step 5: Run the enrichment
node scripts/grok-enrich-csv-listings.js

EXIT_CODE=$?

echo ""
echo -e "${BLUE}─────────────────────────────────────────${NC}"

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ SUCCESS${NC} - Enrichment completed!"
    echo ""
    echo "📊 Data updated in Supabase"
    echo "🔍 Check: nearby_listings table in your dashboard"
    echo ""
else
    echo -e "${RED}❌ Error occurred during enrichment${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check X_API_KEY is valid"
    echo "  2. Verify CSV format is correct"
    echo "  3. Check Supabase credentials in environment"
    echo ""
fi

echo -e "${BLUE}─────────────────────────────────────────${NC}"

exit $EXIT_CODE
