#!/bin/bash

set -euo pipefail

# Configuration
PROJECT_URL="${VITE_PROJECT_URL:-${PROJECT_URL}}"
SERVICE_ROLE_KEY="${VITE_SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY}}"
TRIPADVISOR_KEY="${VITE_TRIPADVISOR:-${TRIPADVISOR}}"
BUCKET_NAME="nearby_listings"
BATCH_SIZE=10
MAX_IMAGES_PER_LISTING=10
DOWNLOAD_DIR=$(mktemp -d)
LOG_FILE="import-photos-$(date +%s).log"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
  local level=$1
  shift
  local message="$@"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  
  case $level in
    INFO)
      echo -e "${BLUE}[INFO]${NC} $message" | tee -a "$LOG_FILE"
      ;;
    SUCCESS)
      echo -e "${GREEN}[SUCCESS]${NC} $message" | tee -a "$LOG_FILE"
      ;;
    WARN)
      echo -e "${YELLOW}[WARN]${NC} $message" | tee -a "$LOG_FILE"
      ;;
    ERROR)
      echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE"
      ;;
  esac
}

# Check dependencies
check_dependencies() {
  log INFO "Checking dependencies..."
  
  local missing_deps=()
  
  for cmd in curl jq wget; do
    if ! command -v "$cmd" &> /dev/null; then
      missing_deps+=("$cmd")
    fi
  done
  
  if [ ${#missing_deps[@]} -gt 0 ]; then
    log ERROR "Missing required commands: ${missing_deps[*]}"
    log ERROR "Please install: ${missing_deps[*]}"
    exit 1
  fi
  
  log SUCCESS "All dependencies found"
}

# Validate environment variables
validate_env() {
  log INFO "Validating environment variables..."
  
  if [ -z "$PROJECT_URL" ]; then
    log ERROR "PROJECT_URL not set"
    exit 1
  fi
  
  if [ -z "$SERVICE_ROLE_KEY" ]; then
    log ERROR "SUPABASE_SERVICE_ROLE_KEY not set"
    exit 1
  fi
  
  if [ -z "$TRIPADVISOR_KEY" ]; then
    log WARN "TRIPADVISOR_KEY not set - will use TripAdvisor web scraping instead"
  fi
  
  log SUCCESS "Environment variables validated"
}

# Fetch all listings from Supabase
fetch_listings() {
  log INFO "Fetching all listings from Supabase..."
  
  local response=$(curl -s -X GET \
    "${PROJECT_URL}/rest/v1/nearby_listings?select=id,tripadvisor_id,name,category" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json")
  
  if [ -z "$response" ] || [ "$response" = "[]" ]; then
    log ERROR "No listings found or failed to fetch listings"
    exit 1
  fi
  
  echo "$response" > /tmp/listings.json
  local count=$(echo "$response" | jq 'length')
  log SUCCESS "Fetched $count listings"
  
  return 0
}

# Search TripAdvisor for listing photos
search_tripadvisor_photos() {
  local listing_name=$1
  local listing_category=$2
  
  log INFO "Searching TripAdvisor for: $listing_name"
  
  local search_query="${listing_name} Philippines"
  
  # Try TripAdvisor API first if key is available
  if [ -n "$TRIPADVISOR_KEY" ]; then
    local api_response=$(curl -s "https://api.tripadvisor.com/api/partner/2.0/search" \
      -H "X-TripAdvisor-API-Key: ${TRIPADVISOR_KEY}" \
      -G --data-urlencode "query=$search_query" \
      --data-urlencode "limit=1" 2>/dev/null || echo "")
    
    if [ -n "$api_response" ] && [ "$api_response" != "null" ]; then
      echo "$api_response"
      return 0
    fi
  fi
  
  # Fallback: web scraping
  local encoded_query=$(printf '%s\n' "$search_query" | jq -sRr @uri)
  local search_url="https://www.tripadvisor.com.ph/Search?q=${encoded_query}"
  
  local html=$(curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "$search_url" 2>/dev/null || echo "")
  
  if [ -n "$html" ]; then
    echo "$html"
  fi
}

# Extract image URLs from TripAdvisor search results
extract_image_urls() {
  local search_result=$1
  local max_count=$2
  
  # Look for image URLs in the HTML/JSON response
  local image_urls=$(echo "$search_result" | grep -oP 'https://dynamic-media-cdn\.tripadvisor\.com/media/photo-[^"]*(?=")' | head -n "$max_count" 2>/dev/null || echo "")
  
  if [ -z "$image_urls" ]; then
    # Try alternative pattern for JSON responses
    image_urls=$(echo "$search_result" | grep -oP 'https://[^"]*(?:jpg|jpeg|png)[^"]*w=\d+[^"]*' | head -n "$max_count" 2>/dev/null || echo "")
  fi
  
  echo "$image_urls"
}

# Download image with retry logic
download_image() {
  local url=$1
  local output_file=$2
  local max_retries=3
  local timeout=10
  
  for ((i=1; i<=max_retries; i++)); do
    if timeout "$timeout" wget -q -O "$output_file" \
      -U "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" \
      "$url" 2>/dev/null; then
      return 0
    fi
    
    if [ $i -lt $max_retries ]; then
      sleep $((i * 2))
    fi
  done
  
  return 1
}

# Upload image to Supabase bucket
upload_to_bucket() {
  local file_path=$1
  local bucket_path=$2
  
  if [ ! -f "$file_path" ]; then
    log WARN "File not found: $file_path"
    return 1
  fi
  
  # Get file size to set Content-Length
  local file_size=$(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path" 2>/dev/null || echo "0")
  
  # Determine content type
  local content_type="image/jpeg"
  case "$file_path" in
    *.png) content_type="image/png" ;;
    *.gif) content_type="image/gif" ;;
    *.webp) content_type="image/webp" ;;
  esac
  
  local upload_response=$(curl -s -X POST \
    "${PROJECT_URL}/storage/v1/object/${BUCKET_NAME}/${bucket_path}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: ${content_type}" \
    --data-binary @"$file_path")
  
  if echo "$upload_response" | grep -q '"name"'; then
    echo "${PROJECT_URL}/storage/v1/object/public/${BUCKET_NAME}/${bucket_path}"
    return 0
  else
    log WARN "Upload failed for $bucket_path"
    return 1
  fi
}

# Update listing with image URLs
update_listing_images() {
  local listing_id=$1
  local image_urls=$2

  # Convert image URLs to JSON array for PostgreSQL
  local image_array=$(echo "$image_urls" | jq -R 'select(length > 0)' | jq -s . || echo '[]')
  local primary_url=$(echo "$image_urls" | head -n 1)

  local update_response=$(curl -s -X PATCH \
    "${PROJECT_URL}/rest/v1/nearby_listings?id=eq.${listing_id}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"image_urls\": $image_array, \"primary_image_url\": \"$primary_url\", \"updated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")

  if [ $? -eq 0 ]; then
    return 0
  else
    log ERROR "Failed to update listing $listing_id"
    return 1
  fi
}

# Process a single listing
process_listing() {
  local listing_id=$1
  local tripadvisor_id=$2
  local name=$3
  local category=$4
  
  log INFO "Processing: $name (ID: $tripadvisor_id)"
  
  # Search for photos
  local search_result=$(search_tripadvisor_photos "$name" "$category")
  
  if [ -z "$search_result" ]; then
    log WARN "No search results for $name"
    return 1
  fi
  
  # Extract image URLs
  local image_urls=$(extract_image_urls "$search_result" "$MAX_IMAGES_PER_LISTING")
  
  if [ -z "$image_urls" ]; then
    log WARN "No images found for $name"
    return 1
  fi
  
  local uploaded_urls=""
  local counter=1
  
  while IFS= read -r image_url; do
    if [ -z "$image_url" ]; then
      continue
    fi
    
    # Create safe filename
    local safe_name=$(echo "$tripadvisor_id" | tr '/' '_')
    local file_ext=$(echo "$image_url" | grep -oP '\.\w+(?=\?|$)' | head -1 || echo ".jpg")
    local temp_file="${DOWNLOAD_DIR}/${safe_name}_${counter}${file_ext}"
    
    # Download image
    if download_image "$image_url" "$temp_file"; then
      log SUCCESS "Downloaded: $name (image $counter)"
      
      # Upload to Supabase
      local bucket_path="listings/${safe_name}/image_${counter}${file_ext}"
      if local public_url=$(upload_to_bucket "$temp_file" "$bucket_path"); then
        log SUCCESS "Uploaded: $bucket_path"
        uploaded_urls+="${public_url}"$'\n'
      fi
      
      # Cleanup
      rm -f "$temp_file"
    else
      log WARN "Failed to download image $counter from $image_url"
    fi
    
    ((counter++))
  done <<< "$image_urls"
  
  # Update listing with uploaded image URLs
  if [ -n "$uploaded_urls" ]; then
    update_listing_images "$listing_id" "$uploaded_urls"
    log SUCCESS "Updated $name with $(echo -n "$uploaded_urls" | grep -c '^') images"
  fi
}

# Process all listings in batches
process_all_listings() {
  log INFO "Starting to process listings..."
  
  local total=$(jq 'length' /tmp/listings.json)
  local processed=0
  local successful=0
  local failed=0
  
  jq -c '.[]' /tmp/listings.json | while read -r listing; do
    local id=$(echo "$listing" | jq -r '.id')
    local tripadvisor_id=$(echo "$listing" | jq -r '.tripadvisor_id')
    local name=$(echo "$listing" | jq -r '.name')
    local category=$(echo "$listing" | jq -r '.category // "Attraction"')
    
    if process_listing "$id" "$tripadvisor_id" "$name" "$category"; then
      ((successful++))
    else
      ((failed++))
    fi
    
    ((processed++))
    log INFO "Progress: $processed/$total listings processed ($successful successful, $failed failed)"
    
    # Rate limiting
    sleep 2
  done
  
  log SUCCESS "Completed processing all listings (Successful: $successful, Failed: $failed)"
}

# Cleanup function
cleanup() {
  log INFO "Cleaning up..."
  rm -rf "$DOWNLOAD_DIR"
  rm -f /tmp/listings.json
  log SUCCESS "Cleanup complete"
}

# Main execution
main() {
  log INFO "================================"
  log INFO "TripAdvisor Photo Import Script"
  log INFO "================================"
  log INFO "Project URL: $PROJECT_URL"
  log INFO "Bucket: $BUCKET_NAME"
  log INFO "Max images per listing: $MAX_IMAGES_PER_LISTING"
  log INFO ""
  
  check_dependencies
  validate_env
  fetch_listings
  process_all_listings
  cleanup
  
  log SUCCESS "================================"
  log SUCCESS "Import process completed!"
  log SUCCESS "Log saved to: $LOG_FILE"
  log SUCCESS "================================"
}

# Trap errors and cleanup
trap cleanup EXIT INT TERM

# Run main function
main "$@"
