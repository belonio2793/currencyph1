#!/usr/bin/env bash
# Test script to invoke create-wallet-pairs Supabase Edge Function
# Usage: SUPABASE_SERVICE_ROLE_KEY=... bash scripts/test-create-wallet-pairs.sh

set -euo pipefail
PROJECT_URL="https://corcofbmafdxehvlbesx.supabase.co"
FN_PATH="/functions/v1/create-wallet-pairs"

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set. Export it and rerun."
  exit 1
fi

payload='{"chain_id":137,"create_house":true}'

resp_file=$(mktemp)
http_code=$(curl -s -o "$resp_file" -w "%{http_code}" -X POST "${PROJECT_URL}${FN_PATH}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -d "$payload")

echo "HTTP_STATUS: $http_code"
echo "RESPONSE_BODY:" 
cat "$resp_file"
rm -f "$resp_file"
