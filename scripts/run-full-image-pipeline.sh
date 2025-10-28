#!/usr/bin/env bash
set -euo pipefail

# Master pipeline to populate TripAdvisor images for nearby_listings
# Steps performed (local runner):
# 1. (Manual) Ensure DB columns exist (see SQL below) - run once in Supabase SQL editor
# 2. Option A: Call Supabase Edge Function to scrape TripAdvisor listings (if deployed)
# 3. Run Grok (X) + ScrapingBee image finder to update nearby_listings.image_url and photo_urls
# 4. Run fetch-and-store-images.js to download and upload images to Supabase storage
# 5. Verify results for sample listings

# Required env vars:
#  VITE_PROJECT_URL or PROJECT_URL
#  VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY
#  X_API_KEY (Grok/X) - recommended
#  SCRAPING_BEE - optional fallback
#  TRIPADVISOR - optional partner key

# SQL to run once (Supabase SQL editor):
# ALTER TABLE nearby_listings ADD COLUMN IF NOT EXISTS featured_image_url TEXT;
# ALTER TABLE nearby_listings ADD COLUMN IF NOT EXISTS preview_image_url TEXT;
# ALTER TABLE nearby_listings ADD COLUMN IF NOT EXISTS photo_urls JSONB;

################################################################################
# CLI options
BATCH=200
START=0
CALL_EDGE=true
EDGE_URL=${EDGE_URL:-""}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --batch) BATCH="$2"; shift 2;;
    --start) START="$2"; shift 2;;
    --no-edge) CALL_EDGE=false; shift;;
    --edge-url) EDGE_URL="$2"; shift 2;;
    -h|--help)
      echo "Usage: $0 [--batch N] [--start N] [--no-edge] [--edge-url URL]"
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

# check env
: "${VITE_PROJECT_URL:?set VITE_PROJECT_URL or PROJECT_URL}" || true
: "${VITE_SUPABASE_SERVICE_ROLE_KEY:?set VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY}" || true

# 0. Install deps
if [[ ! -d node_modules ]]; then
  echo "Installing npm deps..."
  npm install --no-audit --no-fund
fi

# 1. Optionally call Edge Function to scrape listings (if deployed)
if [[ "$CALL_EDGE" == true ]]; then
  if [[ -n "$EDGE_URL" ]]; then
    echo "Calling Edge Function at $EDGE_URL to scrape listings (this may take long)"
    curl -sS -X POST "$EDGE_URL" -H "Authorization: Bearer $VITE_SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{}' | jq -r '.' || true
  else
    echo "No EDGE_URL provided. Skipping Edge Function call. To call deployed function pass --edge-url <url>"
  fi
fi

# 2. Run Grok/Scraping image finder to populate image_url/photo_urls
echo "Running Grok/Scraping image finder (grok-image-fetcher.js)"
X_API_KEY=${X_API_KEY:-${XAI:-}} SCRAPING_BEE=${SCRAPING_BEE:-} \
  VITE_PROJECT_URL=${VITE_PROJECT_URL} VITE_SUPABASE_SERVICE_ROLE_KEY=${VITE_SUPABASE_SERVICE_ROLE_KEY} \
  node scripts/grok-image-fetcher.js --batch ${BATCH} --start ${START}

# 3. Run image downloader & Supabase upload
echo "Running fetch-and-store-images.js to download TripAdvisor images and upload to Supabase storage"
VITE_PROJECT_URL=${VITE_PROJECT_URL} VITE_SUPABASE_SERVICE_ROLE_KEY=${VITE_SUPABASE_SERVICE_ROLE_KEY} TRIPADVISOR=${TRIPADVISOR:-} \
  node scripts/fetch-and-store-images.js

# 4. Sample verification
echo "Sample verification: show abe-restaurant"
node scripts/show-listing-by-slug.js abe-restaurant || true

echo "Full pipeline completed (some steps may be asynchronous or long-running)."
