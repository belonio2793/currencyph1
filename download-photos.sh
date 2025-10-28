#!/bin/bash

set -e

# Configuration
LIMIT=${1:-10}

echo "🖼️  Downloading TripAdvisor photos to Supabase storage"
echo "Limit: $LIMIT listings"
echo ""

export LIMIT="$LIMIT"
export NODE_ENV="production"

node scripts/download-tripadvisor-photos-direct.js
