#!/bin/bash

# Backup all photos from photo_urls to Supabase storage bucket
# Usage: ./backup-photos-to-supabase.sh

set -e

# Configuration
PROJECT_URL="${VITE_PROJECT_URL:-https://corcofbmafdxehvlbesx.supabase.co}"
SERVICE_ROLE_KEY="${VITE_SUPABASE_SERVICE_ROLE_KEY:-}"
BUCKET_NAME="nearby_listings"
TEMP_DIR="/tmp/photo_backup"
MAX_CONCURRENT=5

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing VITE_SUPABASE_SERVICE_ROLE_KEY environment variable"
  exit 1
fi

# Create temp directory
mkdir -p "$TEMP_DIR"

echo "======================================================"
echo "  Backup Photos to Supabase Storage"
echo "======================================================"
echo ""
echo "Configuration:"
echo "  Project URL: $PROJECT_URL"
echo "  Bucket: $BUCKET_NAME"
echo "  Temp directory: $TEMP_DIR"
echo ""

# Function to download a single image
download_image() {
  local url="$1"
  local filename="$2"
  local filepath="$TEMP_DIR/$filename"
  
  # Skip if already downloaded
  if [ -f "$filepath" ]; then
    echo "  ✓ Already cached: $filename"
    return 0
  fi
  
  # Download with retry
  if curl -s -L -f -A "Mozilla/5.0" --max-time 30 "$url" -o "$filepath" 2>/dev/null; then
    echo "  ✓ Downloaded: $filename"
    return 0
  else
    echo "  ✗ Failed to download: $url"
    return 1
  fi
}

# Function to upload image to Supabase
upload_image() {
  local filepath="$1"
  local bucket_path="$2"
  
  if [ ! -f "$filepath" ]; then
    return 1
  fi
  
  # Get file size
  local file_size=$(stat -f%z "$filepath" 2>/dev/null || stat -c%s "$filepath" 2>/dev/null)
  
  # Detect content type
  local content_type="image/jpeg"
  if [[ "$filepath" == *.png ]]; then
    content_type="image/png"
  elif [[ "$filepath" == *.webp ]]; then
    content_type="image/webp"
  elif [[ "$filepath" == *.gif ]]; then
    content_type="image/gif"
  fi
  
  # Upload to Supabase storage
  local response=$(curl -s -X POST \
    "${PROJECT_URL}/storage/v1/object/${BUCKET_NAME}/${bucket_path}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: ${content_type}" \
    --data-binary @"$filepath" 2>/dev/null)
  
  # Check if upload was successful (Supabase returns the path on success)
  if echo "$response" | grep -q "\"name\""; then
    echo "  ✓ Uploaded to storage: ${bucket_path}"
    return 0
  else
    echo "  ✗ Upload failed for: ${bucket_path}"
    return 1
  fi
}

# Fetch all listings with photo_urls using Supabase API
echo "Fetching listings with photos..."
echo ""

listings=$(curl -s -X GET \
  "${PROJECT_URL}/rest/v1/nearby_listings?photo_urls=not.is.null&select=id,name,photo_urls" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json")

# Check if we got valid data
if ! echo "$listings" | grep -q "id"; then
  echo "❌ Failed to fetch listings or no listings with photos found"
  exit 1
fi

# Count listings
listing_count=$(echo "$listings" | grep -o '"id"' | wc -l)
echo "Found $listing_count listings with photos"
echo ""

# Process each listing
total_photos=0
downloaded=0
uploaded=0
failed=0

# Use jq to parse if available, otherwise use grep
if command -v jq &> /dev/null; then
  echo "$listings" | jq -c '.[] | {id: .id, name: .name, photo_urls: .photo_urls}' | while read -r listing; do
    listing_id=$(echo "$listing" | jq -r '.id')
    listing_name=$(echo "$listing" | jq -r '.name')
    photo_urls=$(echo "$listing" | jq -r '.photo_urls | if type == "array" then . else [.] end | .[]')
    
    echo "[ID: $listing_id] $listing_name"
    
    photo_index=0
    while IFS= read -r url; do
      [ -z "$url" ] && continue
      
      photo_index=$((photo_index + 1))
      total_photos=$((total_photos + 1))
      
      # Extract filename from URL
      filename=$(echo "$url" | sed 's/.*\///' | sed 's/?.*//' | cut -c1-200)
      [ -z "$filename" ] && filename="photo_${listing_id}_${photo_index}.jpg"
      
      # Download
      if download_image "$url" "$filename"; then
        downloaded=$((downloaded + 1))
        
        # Upload to Supabase
        bucket_path="listings/${listing_id}/${filename}"
        if upload_image "$TEMP_DIR/$filename" "$bucket_path"; then
          uploaded=$((uploaded + 1))
        else
          failed=$((failed + 1))
        fi
      else
        failed=$((failed + 1))
      fi
    done <<< "$photo_urls"
  done
else
  # Fallback parsing without jq
  echo "Processing listings..."
  
  while IFS= read -r line; do
    if echo "$line" | grep -q '"id"'; then
      listing_id=$(echo "$line" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
      listing_name=$(echo "$line" | grep -o '"name":"[^"]*"' | head -1 | sed 's/"name":"\|"//g')
      
      echo "[ID: $listing_id] $listing_name"
      
      # Extract photo URLs from the line
      photo_urls=$(echo "$line" | grep -o '"[https][^"]*tripadvisor[^"]*"' | sed 's/"//g')
      
      photo_index=0
      while IFS= read -r url; do
        [ -z "$url" ] && continue
        
        photo_index=$((photo_index + 1))
        total_photos=$((total_photos + 1))
        
        filename=$(echo "$url" | sed 's/.*\///' | sed 's/?.*//' | cut -c1-200)
        [ -z "$filename" ] && filename="photo_${listing_id}_${photo_index}.jpg"
        
        if download_image "$url" "$filename"; then
          downloaded=$((downloaded + 1))
          
          bucket_path="listings/${listing_id}/${filename}"
          if upload_image "$TEMP_DIR/$filename" "$bucket_path"; then
            uploaded=$((uploaded + 1))
          else
            failed=$((failed + 1))
          fi
        else
          failed=$((failed + 1))
        fi
      done <<< "$photo_urls"
    fi
  done <<< "$listings"
fi

echo ""
echo "======================================================"
echo "  Summary"
echo "======================================================"
echo "Total photos found: $total_photos"
echo "Downloaded: $downloaded"
echo "Uploaded to Supabase: $uploaded"
echo "Failed: $failed"
echo ""

# Cleanup
echo "Cleaning up temp files..."
rm -rf "$TEMP_DIR"

if [ $uploaded -gt 0 ]; then
  echo "✓ Successfully backed up $uploaded photos to Supabase storage!"
  echo ""
  echo "Photos are now stored in: ${BUCKET_NAME}/listings/{listing_id}/{filename}"
else
  echo "⚠️  No photos were uploaded. Check errors above."
  exit 1
fi
