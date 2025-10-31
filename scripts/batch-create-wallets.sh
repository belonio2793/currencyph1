#!/bin/bash

# Batch Create Wallets - Bash Wrapper
# Creates real onchain wallets for all chains and syncs to wallets_house
#
# Usage:
#   ./scripts/batch-create-wallets.sh              # Create all wallets (crypto + ThirdWeb)
#   ./scripts/batch-create-wallets.sh --thirdweb   # ThirdWeb only
#   npm run batch-create-wallets                   # Via npm
#   npm run batch-create-wallets-thirdweb          # Via npm (ThirdWeb only)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Batch Create Real Onchain Wallets${NC}"
echo -e "${BLUE}━━��━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check required environment variables
if [ -z "$SUPABASE_URL" ] && [ -z "$PROJECT_URL" ]; then
  echo -e "${RED}❌ Error: SUPABASE_URL or PROJECT_URL environment variable not set${NC}"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set${NC}"
  exit 1
fi

if [ -z "$WALLET_ENCRYPTION_KEY" ]; then
  echo -e "${YELLOW}⚠️  Warning: WALLET_ENCRYPTION_KEY not set. Private keys will not be encrypted.${NC}"
  echo ""
fi

# Check if crypto libraries are installed
echo -e "${BLUE}📦 Checking dependencies...${NC}"
if ! npm list @noble/secp256k1 &>/dev/null; then
  echo -e "${YELLOW}⚠️  @noble/secp256k1 not installed${NC}"
  echo -e "${BLUE}   Installing: npm install @noble/secp256k1 @noble/hashes @noble/ed25519 bs58${NC}"
  echo ""
  npm install @noble/secp256k1 @noble/hashes @noble/ed25519 bs58
  echo ""
fi

# Run the script
echo -e "${BLUE}🚀 Starting batch wallet creation...${NC}"
echo ""

if [ "$1" = "--thirdweb" ] || [ "$1" = "--thirdweb-only" ]; then
  node scripts/batch-create-wallets.js --thirdweb-only
else
  node scripts/batch-create-wallets.js "$@"
fi

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ Batch wallet creation completed successfully!${NC}"
else
  echo -e "${RED}❌ Batch wallet creation failed with exit code $EXIT_CODE${NC}"
fi

exit $EXIT_CODE
