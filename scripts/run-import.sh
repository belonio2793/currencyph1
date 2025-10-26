#!/bin/bash

# TripAdvisor Photo Import - Quick Start Script
# This script runs the Node.js photo import with proper error handling

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  TripAdvisor Photo Import${NC}"
echo -e "${BLUE}================================${NC}\n"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js is not installed${NC}"
  echo "Please install Node.js from https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js ${NODE_VERSION} found${NC}\n"

# Check environment variables
echo "Checking environment variables..."

if [ -z "${VITE_PROJECT_URL:-}" ] && [ -z "${PROJECT_URL:-}" ]; then
  echo -e "${RED}✗ Missing VITE_PROJECT_URL or PROJECT_URL${NC}"
  exit 1
fi

if [ -z "${VITE_SUPABASE_SERVICE_ROLE_KEY:-}" ] && [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo -e "${RED}✗ Missing VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY${NC}"
  exit 1
fi

PROJECT_URL="${VITE_PROJECT_URL:-${PROJECT_URL}}"
SERVICE_ROLE_KEY="${VITE_SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY}}"
TRIPADVISOR_KEY="${VITE_TRIPADVISOR:-${TRIPADVISOR:-}}"

echo -e "${GREEN}✓ Project URL: ${PROJECT_URL}${NC}"
echo -e "${GREEN}✓ Service Role Key: ${SERVICE_ROLE_KEY:0:20}...${NC}"

if [ -n "$TRIPADVISOR_KEY" ]; then
  echo -e "${GREEN}✓ TripAdvisor API Key: ${TRIPADVISOR_KEY:0:20}...${NC}\n"
else
  echo -e "${YELLOW}! TripAdvisor API Key not set - will use web scraping (slower)${NC}\n"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install --silent
  echo -e "${GREEN}✓ Dependencies installed${NC}\n"
else
  echo -e "${GREEN}✓ Dependencies already installed${NC}\n"
fi

# Run the import script
echo -e "${BLUE}Starting photo import...${NC}\n"

# Make sure the script is executable and has proper env vars
export VITE_PROJECT_URL="$PROJECT_URL"
export VITE_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
if [ -n "$TRIPADVISOR_KEY" ]; then
  export VITE_TRIPADVISOR="$TRIPADVISOR_KEY"
fi

node scripts/import-photos.js

RESULT=$?

echo ""

if [ $RESULT -eq 0 ]; then
  echo -e "${GREEN}================================${NC}"
  echo -e "${GREEN}✓ Import completed successfully!${NC}"
  echo -e "${GREEN}================================${NC}"
else
  echo -e "${RED}================================${NC}"
  echo -e "${RED}✗ Import failed with error code $RESULT${NC}"
  echo -e "${RED}================================${NC}"
  exit 1
fi
