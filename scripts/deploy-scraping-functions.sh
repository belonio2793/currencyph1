#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Nearby Listings Scraping Functions${NC}"
echo -e "${BLUE}Deployment & Testing Script${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}✗ Supabase CLI not found${NC}"
    echo "Install it from: https://supabase.com/docs/guides/cli/getting-started"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI found${NC}\n"

# Menu
echo -e "${YELLOW}What would you like to do?${NC}"
echo "1. Deploy scrape-nearby-listings function"
echo "2. Deploy scrape-nearby-listings-advanced function"
echo "3. Deploy both functions"
echo "4. Test scrape-nearby-listings (limited scope)"
echo "5. Test scrape-nearby-listings (full scope)"
echo "6. View function logs"
echo "7. Check database statistics"
echo "8. Exit"
echo ""
read -p "Choose option (1-8): " choice

case $choice in
    1)
        echo -e "${BLUE}Deploying scrape-nearby-listings...${NC}"
        supabase functions deploy scrape-nearby-listings
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Function deployed successfully${NC}"
        else
            echo -e "${RED}✗ Deployment failed${NC}"
        fi
        ;;
    2)
        echo -e "${BLUE}Deploying scrape-nearby-listings-advanced...${NC}"
        supabase functions deploy scrape-nearby-listings-advanced
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Function deployed successfully${NC}"
        else
            echo -e "${RED}✗ Deployment failed${NC}"
        fi
        ;;
    3)
        echo -e "${BLUE}Deploying both functions...${NC}"
        supabase functions deploy scrape-nearby-listings
        supabase functions deploy scrape-nearby-listings-advanced
        echo -e "${GREEN}✓ Both functions deployed${NC}"
        ;;
    4)
        echo -e "${BLUE}Testing scrape-nearby-listings (limited)...${NC}"
        echo "This will process: 3 cities × 3 categories × 5 listings = 45 total"
        
        # Get Supabase URL and key from environment or prompt
        if [ -z "$SUPABASE_URL" ]; then
            read -p "Enter your Supabase URL: " SUPABASE_URL
        fi
        
        if [ -z "$SUPABASE_ANON_KEY" ]; then
            read -p "Enter your Supabase Anon Key: " SUPABASE_ANON_KEY
        fi
        
        curl -X POST \
            "$SUPABASE_URL/functions/v1/scrape-nearby-listings" \
            -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
            -H "Content-Type: application/json" \
            -d '{
                "cityLimit": 3,
                "categoryLimit": 3,
                "listingsPerCity": 5
            }' | jq .
        ;;
    5)
        echo -e "${BLUE}Testing scrape-nearby-listings (full)...${NC}"
        echo "This will process: 64 cities × 11 categories × 5 listings = 3,520 total"
        echo -e "${YELLOW}This may take 15-20 minutes...${NC}\n"
        
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" != "y" ]; then
            echo "Cancelled"
            exit 0
        fi
        
        if [ -z "$SUPABASE_URL" ]; then
            read -p "Enter your Supabase URL: " SUPABASE_URL
        fi
        
        if [ -z "$SUPABASE_ANON_KEY" ]; then
            read -p "Enter your Supabase Anon Key: " SUPABASE_ANON_KEY
        fi
        
        curl -X POST \
            "$SUPABASE_URL/functions/v1/scrape-nearby-listings" \
            -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
            -H "Content-Type: application/json" \
            -d '{}' | jq .
        ;;
    6)
        echo -e "${BLUE}Viewing function logs...${NC}"
        echo "Opening Supabase dashboard..."
        echo ""
        echo "To view logs:"
        echo "1. Go to https://app.supabase.com"
        echo "2. Select your project"
        echo "3. Go to Edge Functions"
        echo "4. Click 'scrape-nearby-listings'"
        echo "5. Click 'Logs' tab"
        ;;
    7)
        echo -e "${BLUE}Database Statistics${NC}"
        echo ""
        echo "Note: You need to connect to your Supabase database to run these queries"
        echo ""
        echo "SQL Queries to check:"
        echo ""
        echo "-- Total listings by source"
        echo "SELECT source, COUNT(*) as count, AVG(rating) as avg_rating"
        echo "FROM nearby_listings"
        echo "GROUP BY source;"
        echo ""
        echo "-- Latest scrapes"
        echo "SELECT name, category, rating, source, updated_at"
        echo "FROM nearby_listings"
        echo "WHERE source IN ('web_scraper', 'advanced_scraper')"
        echo "ORDER BY updated_at DESC"
        echo "LIMIT 20;"
        echo ""
        echo "-- Summary stats"
        echo "SELECT"
        echo "  COUNT(*) as total_listings,"
        echo "  COUNT(DISTINCT city) as cities,"
        echo "  COUNT(DISTINCT category) as categories,"
        echo "  ROUND(AVG(rating)::numeric, 1) as avg_rating,"
        echo "  COUNT(CASE WHEN rating IS NOT NULL THEN 1 END) as rated_count"
        echo "FROM nearby_listings;"
        ;;
    8)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
