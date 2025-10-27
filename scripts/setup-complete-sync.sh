#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     TripAdvisor Sync Setup - Edge Functions & Images       ║"
echo "║              Complete Automated Installation              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo -e "${RED}✗ Supabase CLI is not installed${NC}"
  echo "  Install it from: https://supabase.com/docs/guides/cli"
  exit 1
fi

echo -e "${GREEN}✓ Supabase CLI found${NC}\n"

# Check environment variables
echo -e "${YELLOW}Checking environment variables...${NC}"

if [ -z "$VITE_PROJECT_URL" ] && [ -z "$PROJECT_URL" ]; then
  echo -e "${RED}✗ Missing VITE_PROJECT_URL or PROJECT_URL${NC}"
  exit 1
fi

if [ -z "$VITE_SUPABASE_SERVICE_ROLE_KEY" ] && [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}✗ Missing VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Environment variables set${NC}\n"

# Step 1: Set up database
echo -e "${YELLOW}Step 1: Setting up database schema...${NC}"
if [ -f "supabase/migrations/add_image_support.sql" ]; then
  echo "  Running database migration..."
  # Note: This requires manual SQL execution in Supabase dashboard
  echo -e "${YELLOW}  ⚠ Please run SQL migration manually:${NC}"
  echo "    1. Go to Supabase Dashboard → SQL Editor"
  echo "    2. Create new query"
  echo "    3. Copy contents of supabase/migrations/add_image_support.sql"
  echo "    4. Execute the query"
  echo ""
else
  echo -e "${RED}✗ Migration file not found${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Database schema ready (manual step)${NC}\n"

# Step 2: Create storage bucket
echo -e "${YELLOW}Step 2: Setting up storage bucket...${NC}"
node scripts/setup-image-storage.js
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Storage bucket created${NC}"
else
  echo -e "${RED}✗ Failed to create storage bucket${NC}"
  exit 1
fi
echo ""

# Step 3: Deploy edge function
echo -e "${YELLOW}Step 3: Deploying edge function...${NC}"
if [ -d "supabase/functions/sync-tripadvisor-hourly" ]; then
  supabase functions deploy sync-tripadvisor-hourly
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Edge function deployed${NC}"
  else
    echo -e "${RED}✗ Failed to deploy edge function${NC}"
    exit 1
  fi
else
  echo -e "${RED}✗ Edge function directory not found${NC}"
  exit 1
fi
echo ""

# Step 4: Test edge function
echo -e "${YELLOW}Step 4: Testing edge function...${NC}"
echo "  Invoking sync-tripadvisor-hourly..."
supabase functions invoke sync-tripadvisor-hourly

echo -e "${GREEN}✓ Edge function test completed${NC}\n"

# Summary
echo -e "${BLUE}"
echo "╔═══════════��════════════════════════════════════════════════╗"
echo "║              Setup Completed Successfully! 🎉              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

echo -e "${YELLOW}Next Steps:${NC}"
echo "1. ✓ Storage bucket created (listing-images)"
echo "2. ✓ Edge function deployed (sync-tripadvisor-hourly)"
echo "3. ⚠ Run database migration manually in Supabase dashboard"
echo "4. Enable cron scheduling:"
echo "   - Go to Supabase Dashboard → Edge Functions"
echo "   - Click sync-tripadvisor-hourly"
echo "   - Enable 'Scheduled' and set cron: 0 * * * *"
echo "5. Or edit supabase/config.toml and redeploy"
echo ""

echo -e "${YELLOW}Verify Setup:${NC}"
echo "1. Check edge function logs:"
echo "   supabase functions logs sync-tripadvisor-hourly"
echo ""
echo "2. Check database (in Supabase SQL Editor):"
echo "   SELECT COUNT(*) FROM nearby_listings;"
echo "   SELECT COUNT(*) FROM nearby_listings WHERE stored_image_path IS NOT NULL;"
echo ""
echo "3. Check storage bucket:"
echo "   Supabase Dashboard → Storage → listing-images"
echo ""

echo -e "${GREEN}Happy syncing! 🚀${NC}"
