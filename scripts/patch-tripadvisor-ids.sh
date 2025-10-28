#!/usr/bin/env bash
set -euo pipefail

# Patch real TripAdvisor location IDs into nearby_listings using TripAdvisor API
# Usage: ./scripts/patch-tripadvisor-ids.sh --batch=100 --start=0

PROJECT_URL=${VITE_PROJECT_URL:-${PROJECT_URL:-}}
SERVICE_ROLE_KEY=${VITE_SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-${SERVICE_ROLE_KEY:-}}}
TRIP_KEY=${TRIPADVISOR:-${VITE_TRIPADVISOR:-${TRIPADVISOR_API_KEY:-}}}

BATCH=100
START=0

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --batch) BATCH="$2"; shift 2;;
    --start) START="$2"; shift 2;;
    --help) echo "Usage: $0 [--batch N] [--start OFFSET]"; exit 0;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

if [[ -z "$PROJECT_URL" || -z "$SERVICE_ROLE_KEY" ]]; then
  echo "ERROR: PROJECT_URL and SERVICE_ROLE_KEY (service role key) must be set in env"
  exit 1
fi
if [[ -z "$TRIP_KEY" ]]; then
  echo "WARN: TRIPADVISOR key not set; script will still try but TripAdvisor API calls will fail"
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl required"
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq required"
  exit 1
fi

echo "Project: $PROJECT_URL"
echo "Batch size: $BATCH  start offset: $START"

offset=$START
updated_total=0
processed_total=0

while true; do
  echo "\nFetching batch (limit=$BATCH offset=$offset)..."
  # Fetch a batch of listings; include raw field to help mapping
  resp=$(curl -s -G "$PROJECT_URL/rest/v1/nearby_listings" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    --data-urlencode "select=id,tripadvisor_id,name,city,raw" \
    --data-urlencode "limit=$BATCH" \
    --data-urlencode "offset=$offset")

  count=$(echo "$resp" | jq 'length')
  if [[ "$count" -eq 0 ]]; then
    echo "No more rows returned; exiting"
    break
  fi

  for i in $(seq 0 $((count-1))); do
    processed_total=$((processed_total+1))
    row=$(echo "$resp" | jq -r ".[$i]")
    id=$(echo "$row" | jq -r '.id')
    trip=$(echo "$row" | jq -r '.tripadvisor_id // empty')
    name=$(echo "$row" | jq -r '.name // empty')
    city=$(echo "$row" | jq -r '.city // empty')

    # skip rows that already have numeric TripAdvisor ID
    if [[ -n "$trip" && "$trip" =~ ^[0-9]+$ ]]; then
      echo "[$id] Skipping, already numeric TripAdvisor ID: $trip"
      continue
    fi

    if [[ -z "$name" ]]; then
      echo "[$id] Skipping, no name"
      continue
    fi

    query="$name"
    if [[ -n "$city" ]]; then query="$query $city"; fi

    echo "[$id] Searching TripAdvisor for: $query"

    found=null

    if [[ -n "$TRIP_KEY" ]]; then
      # Try content API first
      url="https://api.content.tripadvisor.com/v2/location/search?query=$(printf "%s" "$query" | jq -s -R -r @uri)&key=$TRIP_KEY"
      api_resp=$(curl -sS --max-time 10 "$url" || true)
      # try parse
      if echo "$api_resp" | jq -e '.data[0].location_id // empty' >/dev/null 2>&1; then
        found=$(echo "$api_resp" | jq -r '.data[0].location_id')
      else
        # Try partner public API (header style)
        purl="https://api.tripadvisor.com/api/partner/2.0/locations/search?query=$(printf "%s" "$query" | jq -s -R -r @uri)&limit=5"
        p_resp=$(curl -sS -H "X-TripAdvisor-API-Key: $TRIP_KEY" --max-time 10 "$purl" || true)
        if echo "$p_resp" | jq -e '.data[0].location_id // empty' >/dev/null 2>&1; then
          found=$(echo "$p_resp" | jq -r '.data[0].location_id')
        fi
      fi
    fi

    # Fallback: try to read raw.web_url or raw fields that include location_id
    if [[ "$found" == "null" || -z "$found" ]]; then
      raw_location=$(echo "$row" | jq -r '.raw.location_id // .raw.locationId // empty')
      if [[ -n "$raw_location" && "$raw_location" =~ ^[0-9]+$ ]]; then
        found="$raw_location"
      else
        # try to parse web_url in raw
        web=$(echo "$row" | jq -r '.raw.web_url // .raw.webUrl // .raw.url // empty')
        if [[ -n "$web" ]]; then
          if [[ "$web" =~ -d([0-9]+)- ]]; then
            found="${BASH_REMATCH[1]}"
          fi
        fi
      fi
    fi

    if [[ "$found" == "null" || -z "$found" ]]; then
      echo "[$id] No TripAdvisor ID found for: $name"
      # don't overwrite with placeholder; continue
      continue
    fi

    echo "[$id] Found TripAdvisor ID: $found — patching DB..."
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    patch_resp=$(curl -s -w "\n%{http_code}" -X PATCH "$PROJECT_URL/rest/v1/nearby_listings?id=eq.$id" \
      -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
      -H "apikey: $SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=representation" \
      -d "{\"tripadvisor_id\": \"$found\", \"updated_at\": \"$now\"}")

    # check status code
    http_code=$(echo "$patch_resp" | tail -n1)
    body=$(echo "$patch_resp" | sed '$d')
    if [[ "$http_code" == "200" || "$http_code" == "204" ]]; then
      echo "[$id] Updated successfully (tripadvisor_id=$found)"
      updated_total=$((updated_total+1))
    else
      echo "[$id] Failed to update (HTTP $http_code): $body"
    fi

    # throttle between items
    sleep 0.5
  done

  offset=$((offset + BATCH))
  echo "Batch processed. Total processed: $processed_total, total updated: $updated_total"
  # small pause between batches
  sleep 1

  # if fewer than batch returned, we're at end
  if [[ "$count" -lt "$BATCH" ]]; then
    echo "Reached end of rows"
    break
  fi

done

echo "\nFinished. Processed: $processed_total Updated: $updated_total"
