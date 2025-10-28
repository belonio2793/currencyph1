#!/bin/bash

# run-grok-costs.sh
# Runs the grok-avg-costs.js script to populate estimated costs for all listings
# Usage: ./scripts/run-grok-costs.sh [--batch SIZE] [--start OFFSET]

set -e

# Load environment variables from .env if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check required env vars
if [ -z "$X_API_KEY" ]; then
  echo "ERROR: X_API_KEY environment variable is not set"
  exit 1
fi

if [ -z "$PROJECT_URL" ] && [ -z "$VITE_PROJECT_URL" ]; then
  echo "ERROR: PROJECT_URL or VITE_PROJECT_URL environment variable is not set"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -z "$VITE_SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_SERVICE_ROLE_KEY environment variable is not set"
  exit 1
fi

# Parse command line arguments
BATCH=100
START=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --batch)
      BATCH="$2"
      shift 2
      ;;
    --start)
      START="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--batch SIZE] [--start OFFSET]"
      exit 1
      ;;
  esac
done

echo "🚀 Starting Grok cost estimation process..."
echo "   Batch size: $BATCH"
echo "   Starting from offset: $START"
echo ""

# Run the Node.js script
node scripts/grok-avg-costs.js --batch=$BATCH --start=$START

echo ""
echo "✅ Grok cost estimation complete!"
