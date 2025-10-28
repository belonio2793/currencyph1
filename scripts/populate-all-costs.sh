#!/bin/bash

# populate-all-costs.sh
# Automatically populates avg_cost for all listings by running the quick-populate-costs script repeatedly

set -e

echo "🚀 Starting automated cost population..."
echo ""

# Load environment if available
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

ITERATION=0
MAX_ITERATIONS=100

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  echo "🔄 Iteration $ITERATION..."
  
  OUTPUT=$(node scripts/quick-populate-costs.js 2>&1)
  echo "$OUTPUT"
  
  # Check if done
  if echo "$OUTPUT" | grep -q "All listings have costs"; then
    echo ""
    echo "✅ All listings successfully populated with estimated costs!"
    break
  fi
  
  # Small delay between iterations
  sleep 1
done

if [ $ITERATION -ge $MAX_ITERATIONS ]; then
  echo ""
  echo "⚠️  Reached maximum iterations ($MAX_ITERATIONS). Run again to continue."
else
  echo ""
  echo "🎉 Cost population complete!"
fi
