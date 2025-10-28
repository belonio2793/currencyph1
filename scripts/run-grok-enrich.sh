#!/bin/bash

# Simple script to run Grok CSV enrichment
# Usage: ./scripts/run-grok-enrich.sh

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}🚀 Grok CSV Enrichment${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check if X_API_KEY is set
if [ -z "$X_API_KEY" ]; then
    echo -e "${RED}❌ X_API_KEY not set${NC}"
    echo ""
    echo "Set your Grok API key:"
    echo "  export X_API_KEY='xai-qe0lzba8kfDmccd5EBClqO7ELZXxYG3hyyetV1b5D4dISqjStXLHcFElnYfmRD3ddy0gV4sHxnR3XZT3'"
    echo ""
    echo "Or run with:"
    echo "  X_API_KEY='xai-...' ./scripts/run-grok-enrich.sh"
    exit 1
fi

# Check if CSV file exists
if [ ! -f "nearby-listings.csv" ]; then
    echo -e "${RED}❌ nearby-listings.csv not found${NC}"
    echo "   Create the file in the project root"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Check environment
echo -e "${BLUE}Checking environment...${NC}"
echo -e "${GREEN}✅ X_API_KEY${NC} is set"
echo -e "${GREEN}✅ nearby-listings.csv${NC} exists"
echo -e "${GREEN}✅ node_modules${NC} ready"
echo ""

# Run the script
echo -e "${BLUE}Starting enrichment...${NC}"
echo ""

node scripts/grok-enrich-csv-listings.js

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Enrichment completed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Check Supabase dashboard for updated listings"
    echo "  2. Verify data quality in the nearby_listings table"
    echo "  3. Test your app with the new data"
else
    echo ""
    echo -e "${RED}❌ Enrichment completed with errors${NC}"
    echo "   Check the output above for details"
fi

exit $exit_code
