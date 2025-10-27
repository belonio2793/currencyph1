#!/usr/bin/env bash
set -euo pipefail

# run-nearby-sync.sh
# Orchestrates setting up storage, fetching listings for all PH cities, and importing photos.

echo "=== Nearby Listings Full Sync ==="

# Required env vars
: "${PROJECT_URL:?PROJECT_URL is not set}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is not set}"
: "${TRIPADVISOR:?TRIPADVISOR is not set}"

export VITE_PROJECT_URL="$PROJECT_URL"
export VITE_SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
export VITE_TRIPADVISOR="$TRIPADVISOR"

# Helper to run node scripts with clear logging
run_node() {
  echo "\n--- Running: $* ---"
  node "$@"
  local rc=$?
  if [ $rc -ne 0 ]; then
    echo "Error running: $* (exit $rc)" >&2
    exit $rc
  fi
}

# 1) Ensure storage bucket and DB image columns exist
run_node scripts/setup-image-storage.js

# 2) Fetch listings across all Philippine cities and upsert to nearby_listings
# Use the comprehensive fetcher for maximum fields — adjust script name if you prefer a different variant
if command -v node >/dev/null 2>&1; then
  run_node scripts/fetch-all-cities-listings.js
else
  echo "Node.js not found. Install Node 16+ to proceed." >&2
  exit 2
fi

# 3) Import/download photos and upload to Supabase storage
run_node scripts/import-photos.js

echo "\n✅ Full sync complete. Verify listings in Supabase and visit /nearby to preview." 

echo "If you prefer invoking the Supabase Edge Function instead (no local Node needed), use this curl (replace placeholders):"
cat <<'CURL'

curl -X POST "${PROJECT_URL}/functions/v1/scrape-nearby-listings-comprehensive" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY:-REPLACE_WITH_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"limit":30}' | jq .

CURL

exit 0
