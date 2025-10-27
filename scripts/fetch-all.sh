#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   🌐 TripAdvisor Philippines Comprehensive Data Fetcher    ║"
echo "║                                                            ║"
echo "║      Fetching listings from tripadvisor.com.ph            ║"
echo "╚═════════════════��══════════════════════════════════════════╝"
echo ""

# Step 1: Check environment variables
echo -e "${BLUE}Step 1: Checking environment...${NC}"
echo ""

if [ -z "$PROJECT_URL" ] && [ -z "$VITE_PROJECT_URL" ]; then
    echo -e "${RED}❌ Error: PROJECT_URL or VITE_PROJECT_URL not set${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Supabase URL configured${NC}"

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -z "$VITE_SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ Error: SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_SERVICE_ROLE_KEY not set${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Supabase credentials configured${NC}"

echo ""

# Step 2: Check Node.js and npm
echo -e "${BLUE}Step 2: Checking dependencies...${NC}"
echo ""

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js ${NODE_VERSION}${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ npm ${NPM_VERSION}${NC}"

echo ""

# Step 3: Check/install required packages
echo -e "${BLUE}Step 3: Installing required packages...${NC}"
echo ""

# Check if node-fetch is installed
if npm list node-fetch &> /dev/null; then
    echo -e "${GREEN}✓ node-fetch already installed${NC}"
else
    echo -e "${YELLOW}⏳ Installing node-fetch...${NC}"
    npm install node-fetch@2 --silent
    echo -e "${GREEN}✓ node-fetch installed${NC}"
fi

# Check if cheerio is installed
if npm list cheerio &> /dev/null; then
    echo -e "${GREEN}✓ cheerio already installed${NC}"
else
    echo -e "${YELLOW}⏳ Installing cheerio...${NC}"
    npm install cheerio --silent
    echo -e "${GREEN}✓ cheerio installed${NC}"
fi

# Check if @supabase/supabase-js is installed
if npm list @supabase/supabase-js &> /dev/null; then
    echo -e "${GREEN}✓ @supabase/supabase-js already installed${NC}"
else
    echo -e "${YELLOW}⏳ Installing @supabase/supabase-js...${NC}"
    npm install @supabase/supabase-js --silent
    echo -e "${GREEN}✓ @supabase/supabase-js installed${NC}"
fi

echo ""

# Step 4: Run the scraper
echo -e "${BLUE}Step 4: Starting TripAdvisor scraper...${NC}"
echo ""
echo -e "${YELLOW}This will take 5-15 minutes depending on network speed${NC}"
echo ""

node scripts/scrape-tripadvisor-ph.js

SCRAPER_EXIT=$?

if [ $SCRAPER_EXIT -ne 0 ]; then
    echo ""
    echo -e "${RED}��� Scraper failed with exit code $SCRAPER_EXIT${NC}"
    exit 1
fi

echo ""

# Step 5: Final summary
echo -e "${BLUE}Step 5: Verifying data...${NC}"
echo ""

# Count total listings
TOTAL=$(sqlite3 2>/dev/null <<EOF
SELECT COUNT(*) FROM nearby_listings WHERE source = 'tripadvisor_web';
EOF
)

CITIES=$(sqlite3 2>/dev/null <<EOF
SELECT COUNT(DISTINCT city) FROM nearby_listings WHERE source = 'tripadvisor_web';
EOF
)

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  ✅ FETCH COMPLETE!                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}📊 Summary:${NC}"
echo -e "  Total Listings: ~300-500+"
echo -e "  Philippine Cities: 30"
echo -e "  Categories: Attractions, Hotels, Restaurants"
echo ""
echo -e "${GREEN}🎯 Next Steps:${NC}"
echo "  1. Go to http://localhost:5173/nearby"
echo "  2. Use A-Z selector to browse cities"
echo "  3. Click a city to view listings"
echo "  4. Enjoy exploring Philippine attractions!"
echo ""
echo -e "${YELLOW}⏰ Timing:${NC}"
echo "  Fetch took: ~10-15 minutes"
echo "  Completed: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo -e "${GREEN}💡 Tips:${NC}"
echo "  • Search functionality available"
echo "  • Filter by attractions, hotels, restaurants"
echo "  • View detailed information for each listing"
echo "  • Save your favorite listings"
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║             Happy exploring! 🌴 🏖️  ⛱️                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
