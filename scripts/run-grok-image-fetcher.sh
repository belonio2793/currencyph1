#!/usr/bin/env bash
set -euo pipefail

# Run grok-image-fetcher with sensible defaults
# Usage:
#   ./scripts/run-grok-image-fetcher.sh --batch 100 --start 0
# Environment variables (must be set):
#   VITE_PROJECT_URL or PROJECT_URL
#   VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY
#   X_API_KEY (Grok/X) - optional but recommended
#   SCRAPING_BEE - optional fallback

BATCH=100
START=0
NODE_CMD=node
NPM_CMD=npm

# parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --batch) BATCH="$2"; shift 2;;
    --start) START="$2"; shift 2;;
    --node) NODE_CMD="$2"; shift 2;;
    --npm) NPM_CMD="$2"; shift 2;;
    -h|--help)
      echo "Usage: $0 [--batch N] [--start N] [--node /path/to/node] [--npm /path/to/npm]"
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

if ! command -v "$NODE_CMD" >/dev/null 2>&1; then
  echo "Node not found at $NODE_CMD; please install Node.js or pass --node path"
  exit 1
fi

if ! command -v "$NPM_CMD" >/dev/null 2>&1; then
  echo "npm not found at $NPM_CMD; please install npm or pass --npm path"
  exit 1
fi

# Install deps if node_modules missing
if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  $NPM_CMD install --no-audit --no-fund
fi

# Ensure required env vars
if [[ -z "${VITE_PROJECT_URL:-}${PROJECT_URL:-}" ]]; then
  echo "ERROR: set VITE_PROJECT_URL or PROJECT_URL to your Supabase URL"
  exit 1
fi
if [[ -z "${VITE_SUPABASE_SERVICE_ROLE_KEY:-}${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "ERROR: set VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY to your service role key"
  exit 1
fi

export BATCH
export START

echo "Starting grok-image-fetcher with batch=$BATCH start=$START"
$NODE_CMD scripts/grok-image-fetcher.js --batch "$BATCH" --start "$START"

echo "Finished"
