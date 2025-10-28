#!/bin/bash

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LIMIT=${1:-30}
LOG_FILE="/tmp/populate-nearby-$(date +%s).log"
BATCH_SIZE=${BATCH_SIZE:-30}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🌴 POPULATE NEARBY LISTINGS - REAL TRIPADVISOR DATA       ║${NC}"
echo -e "${BLUE}╚══════════════��═════════════════════════════════════════════╝${NC}"
echo ""

# Validate environment variables
echo -e "${YELLOW}🔍 Validating environment...${NC}"

if [ -z "$VITE_PROJECT_URL" ] && [ -z "$PROJECT_URL" ]; then
  echo -e "${RED}❌ Missing VITE_PROJECT_URL or PROJECT_URL${NC}"
  exit 1
fi

if [ -z "$VITE_SUPABASE_SERVICE_ROLE_KEY" ] && [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}❌ Missing VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY${NC}"
  exit 1
fi

if [ -z "$X_API_KEY" ] && [ -z "$GROK_API_KEY" ]; then
  echo -e "${RED}❌ Missing X_API_KEY or GROK_API_KEY for Grok AI${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Environment validated${NC}"
echo -e "${GREEN}✅ Supabase configured${NC}"
echo -e "${GREEN}✅ Grok API available${NC}"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js is not installed or not in PATH${NC}"
  exit 1
fi

echo -e "${BLUE}📊 Configuration${NC}"
echo "  Limit: $LIMIT listings"
echo "  Batch size: $BATCH_SIZE"
echo "  Log file: $LOG_FILE"
echo ""

# Check if script exists
SCRIPT_FILE="scripts/populate-nearby-real-tripadvisor.js"
if [ ! -f "$SCRIPT_FILE" ]; then
  echo -e "${RED}❌ Script not found: $SCRIPT_FILE${NC}"
  exit 1
fi

echo -e "${BLUE}🚀 Starting population...${NC}"
echo ""

# Export environment variables
export LIMIT="$LIMIT"
export NODE_ENV="production"
export VITE_PROJECT_URL="${VITE_PROJECT_URL:-$PROJECT_URL}"
export VITE_SUPABASE_SERVICE_ROLE_KEY="${VITE_SUPABASE_SERVICE_ROLE_KEY:-$SUPABASE_SERVICE_ROLE_KEY}"
export X_API_KEY="${X_API_KEY:-$GROK_API_KEY}"

# Run the Node.js script with output to both console and log file
node "$SCRIPT_FILE" 2>&1 | tee "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ Population complete!${NC}"
  echo -e "${BLUE}📋 Full log saved to: $LOG_FILE${NC}"
  echo ""
  echo -e "${YELLOW}Next steps:${NC}"
  echo "  1. Check status: npm run verify-nearby"
  echo "  2. Run more: LIMIT=50 $0 50"
  echo "  3. View log: cat $LOG_FILE"
else
  echo -e "${RED}❌ Population failed with exit code $EXIT_CODE${NC}"
  echo -e "${BLUE}📋 Check log for details: $LOG_FILE${NC}"
fi

echo ""
exit $EXIT_CODE
