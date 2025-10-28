#!/bin/bash

export LIMIT=${1:-15}
export NODE_ENV=production

echo "Starting real TripAdvisor data population..."
echo "Limit: $LIMIT listings"
echo ""

node scripts/populate-nearby-real-tripadvisor.js
