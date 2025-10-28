#!/usr/bin/env python3
"""
sync-tripadvisor-real-data.py

Complete pipeline:
1. Fetch existing nearby_listings from Supabase
2. For each listing, search TripAdvisor.com.ph using place + city
3. Extract real data from the actual TripAdvisor listing page
4. Update nearby_listings table with verified accurate data
5. Checkpoint progress and handle errors gracefully

Run with:
    python scripts/sync-tripadvisor-real-data.py
    python scripts/sync-tripadvisor-real-data.py --limit 10  # test mode
    python scripts/sync-tripadvisor-real-data.py --resume    # continue from checkpoint
"""

import os
import sys
import json
import time
import argparse
import re
from typing import List, Dict, Optional
from datetime import datetime
from pathlib import Path

import requests
from supabase import create_client, Client
from bs4 import BeautifulSoup

# Configuration
BATCH_SIZE = 50
REQUEST_DELAY = 1.0  # seconds between requests (be respectful)
CHECKPOINT_FILE = "tripadvisor_sync_checkpoint.json"
BACKUP_FILE = "nearby_listings_backup.json"
ERRORS_FILE = "tripadvisor_sync_errors.json"

TRIPADVISOR_SEARCH_URL = "https://www.tripadvisor.com.ph/Search?q="
TRIPADVISOR_BASE = "https://www.tripadvisor.com.ph"

# User-Agent to avoid blocking
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def search_tripadvisor(query: str) -> Optional[str]:
    """Search TripAdvisor for a listing and return the listing URL"""
    try:
        search_url = f"{TRIPADVISOR_SEARCH_URL}{requests.utils.quote(query)}"
        response = requests.get(search_url, headers=HEADERS, timeout=10)
        
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find first search result link
        # TripAdvisor search results contain links to listings
        result_link = soup.find('a', attrs={'data-test-target': 'search-result-title'})
        
        if result_link and result_link.get('href'):
            listing_path = result_link['href']
            if listing_path.startswith('http'):
                return listing_path
            else:
                return f"{TRIPADVISOR_BASE}{listing_path}"
        
        return None
        
    except Exception as e:
        print(f"  ❌ Search error: {e}", file=sys.stderr)
        return None


def extract_tripadvisor_listing_data(url: str) -> Optional[Dict]:
    """Extract ALL real data from a TripAdvisor listing page including all photos"""
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)

        if response.status_code != 200:
            return None

        soup = BeautifulSoup(response.content, 'html.parser')
        html_content = response.text

        # Extract listing ID from URL
        tripadvisor_id = None
        match = re.search(r'-d(\d+)-', url)
        if match:
            tripadvisor_id = match.group(1)

        # Extract name (usually in h1)
        name = None
        h1 = soup.find('h1')
        if h1:
            name = h1.get_text(strip=True)

        # Extract rating
        rating = None
        rating_elem = soup.find('span', class_=re.compile('ratingFilter|Rating'))
        if rating_elem:
            rating_text = rating_elem.get_text(strip=True)
            try:
                rating = float(re.search(r'[\d.]+', rating_text).group())
            except:
                pass

        # Extract review count
        review_count = None
        review_elem = soup.find(text=re.compile(r'\d+\s+review'))
        if review_elem:
            try:
                review_count = int(re.search(r'\d+', review_elem).group())
            except:
                pass

        # Extract address
        address = None
        address_elem = soup.find('address')
        if address_elem:
            address = address_elem.get_text(strip=True)

        # Extract phone
        phone = None
        phone_match = re.search(r'(?:\+63|tel:)[\s\d-]+', html_content)
        if phone_match:
            phone = phone_match.group(0).strip()

        # Extract description
        description = None
        desc_elem = soup.find('div', class_=re.compile('description|about'))
        if desc_elem:
            description = desc_elem.get_text(strip=True)

        # Extract amenities list
        amenities = []
        for item in soup.find_all(re.compile('li|div'), class_=re.compile('amenity')):
            amenity_text = item.get_text(strip=True)
            if amenity_text and len(amenity_text) < 100:
                amenities.append(amenity_text)

        # Extract hours
        hours_of_operation = {}
        hours_match = re.findall(r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[:\s]+([0-9:\s–\-]+|Closed)', html_content)
        for day, time in hours_match:
            hours_of_operation[day] = time.strip()

        # Extract price range
        price_range = None
        price_match = re.search(r'(₱|€|\$)+\s*–?\s*(₱|€|\$)*', html_content)
        if price_match:
            price_range = price_match.group(0).strip()

        # Extract website
        website = None
        for link in soup.find_all('a', href=re.compile(r'^http')):
            href = link.get('href', '')
            if href and 'tripadvisor' not in href and 'javascript' not in href:
                website = href
                break

        # Extract ALL photo URLs (comprehensive extraction)
        photo_urls = []

        # Method 1: Extract from img tags
        for img in soup.find_all('img'):
            src = img.get('src', '') or img.get('data-src', '')
            if src and ('media' in src or 'photo' in src or 'image' in src):
                if src not in photo_urls and src.startswith('http'):
                    photo_urls.append(src)

        # Method 2: Extract from picture/source tags
        for picture in soup.find_all('picture'):
            for source in picture.find_all('source'):
                srcset = source.get('srcset', '')
                for url_part in srcset.split(','):
                    url_match = re.search(r'(https?://[^\s]+)', url_part.strip())
                    if url_match:
                        photo_url = url_match.group(1).split()[0]
                        if photo_url not in photo_urls:
                            photo_urls.append(photo_url)

        # Method 3: Extract from data attributes and JSON
        for attr_val in re.findall(r'data-src="([^"]*)"', html_content):
            if attr_val and 'media' in attr_val and attr_val not in photo_urls:
                photo_urls.append(attr_val)

        # Method 4: Extract from JSON in script tags
        for script in soup.find_all('script', type='application/json'):
            try:
                data = json.loads(script.string)
                if isinstance(data, dict):
                    for value in data.values():
                        if isinstance(value, str) and value.startswith('http') and 'photo' in value:
                            if value not in photo_urls:
                                photo_urls.append(value)
            except:
                pass

        # Clean up photo URLs (limit to reasonable size, remove duplicates)
        photo_urls = list(dict.fromkeys(photo_urls))[:50]  # Keep unique, limit to 50

        # Extract main photo (first valid URL)
        image_url = photo_urls[0] if photo_urls else None

        # Extract category/type
        location_type = "Attraction"
        if 'restaurant' in url.lower() or 'restaurant' in name.lower():
            location_type = "Restaurant"
        elif 'hotel' in url.lower() or 'hotel' in name.lower():
            location_type = "Hotel"
        elif 'attraction' in url.lower():
            location_type = "Attraction"

        # Build result with ALL extracted data
        data = {
            "tripadvisor_id": tripadvisor_id,
            "name": name,
            "rating": rating,
            "review_count": review_count,
            "address": address,
            "phone_number": phone,
            "description": description,
            "amenities": amenities,
            "hours_of_operation": hours_of_operation,
            "price_range": price_range,
            "website": website,
            "image_url": image_url,
            "photo_urls": photo_urls,
            "photo_count": len(photo_urls),
            "location_type": location_type,
            "web_url": url,
            "fetch_status": "success",
            "fetch_error_message": None,
            "last_verified_at": datetime.now().isoformat(),
        }

        return data

    except Exception as e:
        print(f"  ❌ Extraction error: {e}", file=sys.stderr)
        return None


def fetch_existing_listings(supabase: Client, limit: int = 0) -> List[Dict]:
    """Fetch all existing listings from nearby_listings table"""
    try:
        print("📥 Fetching existing listings from Supabase...")
        
        rows = []
        page = 0
        page_size = 1000
        
        while True:
            response = supabase.table("nearby_listings").select("*").range(
                page * page_size, (page + 1) * page_size - 1
            ).execute()
            
            data = response.data or []
            
            if not data:
                break
            
            rows.extend(data)
            print(f"  Fetched page {page + 1}: {len(data)} rows")
            
            if len(data) < page_size:
                break
            
            page += 1
        
        # Backup before processing
        backup_path = Path(BACKUP_FILE)
        backup_path.write_text(json.dumps(rows, indent=2, ensure_ascii=False, default=str))
        print(f"  ✅ Backup saved to {BACKUP_FILE}")
        
        if limit > 0:
            rows = rows[:limit]
            print(f"  ⚠️  Limited to {limit} rows for testing")
        
        print(f"  ✅ Total rows to process: {len(rows)}\n")
        
        return rows
        
    except Exception as e:
        print(f"❌ Error fetching listings: {e}", file=sys.stderr)
        return []


def load_checkpoint() -> Dict:
    """Load checkpoint to resume interrupted sync"""
    checkpoint_path = Path(CHECKPOINT_FILE)
    
    if checkpoint_path.exists():
        try:
            data = json.loads(checkpoint_path.read_text())
            print(f"📍 Loaded checkpoint: processed {data.get('processed', 0)} listings")
            return data
        except:
            pass
    
    return {
        "processed": 0,
        "updated": 0,
        "not_found": 0,
        "errors": 0,
        "last_listing_id": None
    }


def save_checkpoint(checkpoint: Dict):
    """Save checkpoint"""
    Path(CHECKPOINT_FILE).write_text(json.dumps(checkpoint, indent=2))


def update_listing_in_db(supabase: Client, listing_id: int, updates: Dict) -> bool:
    """Update a single listing in database"""
    try:
        # Only update if we have meaningful data
        if not updates.get("tripadvisor_id"):
            return False
        
        update_payload = {
            "id": listing_id,
            **updates
        }
        
        supabase.table("nearby_listings").upsert(
            [update_payload],
            {"onConflict": "id"}
        ).execute()
        
        return True
        
    except Exception as e:
        print(f"    ❌ Database update error: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description="Sync TripAdvisor real data to nearby_listings")
    parser.add_argument("--limit", type=int, default=0, help="Limit rows for testing")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    parser.add_argument("--force", action="store_true", help="Skip checkpoint and start fresh")
    
    args = parser.parse_args()
    
    # Load environment
    supabase_url = os.getenv("VITE_PROJECT_URL") or os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase credentials", file=sys.stderr)
        sys.exit(1)
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Load existing listings
    listings = fetch_existing_listings(supabase, args.limit)
    
    if not listings:
        print("❌ No listings to process", file=sys.stderr)
        sys.exit(1)
    
    # Load checkpoint
    checkpoint = load_checkpoint() if args.resume and not args.force else {
        "processed": 0,
        "updated": 0,
        "not_found": 0,
        "errors": 0,
        "last_listing_id": None
    }
    
    start_idx = checkpoint.get("processed", 0)
    errors_log = []
    
    print("=" * 100)
    print("SYNCING TRIPADVISOR REAL DATA")
    print("=" * 100)
    print(f"\n🚀 Processing {len(listings)} listings (starting from index {start_idx})\n")
    
    for idx, listing in enumerate(listings):
        if idx < start_idx:
            continue
        
        listing_id = listing.get("id")
        name = listing.get("name", "Unknown")
        city = listing.get("city", "Unknown")
        address = listing.get("address", "")
        
        # Build search query
        search_query = f"{name} {city} Philippines"
        
        print(f"[{idx + 1}/{len(listings)}] {name} ({city})...", end=" ", flush=True)
        
        try:
            # Search TripAdvisor
            listing_url = search_tripadvisor(search_query)
            
            if not listing_url:
                print("⚠️  Not found on TripAdvisor")
                checkpoint["not_found"] += 1
                errors_log.append({
                    "id": listing_id,
                    "name": name,
                    "city": city,
                    "error": "Not found on TripAdvisor",
                    "query": search_query
                })
                checkpoint["processed"] += 1
                save_checkpoint(checkpoint)
                time.sleep(REQUEST_DELAY)
                continue
            
            # Extract real data
            ta_data = extract_tripadvisor_listing_data(listing_url)
            
            if not ta_data:
                print("❌ Failed to extract data")
                checkpoint["errors"] += 1
                errors_log.append({
                    "id": listing_id,
                    "name": name,
                    "city": city,
                    "error": "Failed to extract data",
                    "url": listing_url
                })
                checkpoint["processed"] += 1
                save_checkpoint(checkpoint)
                time.sleep(REQUEST_DELAY)
                continue
            
            # Prepare update payload (only update fields we found)
            update_payload = {
                "id": listing_id,
                "fetch_status": "success",
                "last_verified_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "web_url": listing_url
            }
            
            # Add fields that were found
            if ta_data.get("rating"):
                update_payload["rating"] = ta_data["rating"]
            if ta_data.get("review_count"):
                update_payload["review_count"] = ta_data["review_count"]
            if ta_data.get("address"):
                update_payload["address"] = ta_data["address"]
            if ta_data.get("phone_number"):
                update_payload["phone_number"] = ta_data["phone_number"]
            if ta_data.get("description"):
                update_payload["description"] = ta_data["description"]
            if ta_data.get("amenities"):
                update_payload["amenities"] = ta_data["amenities"]
            if ta_data.get("hours_of_operation"):
                update_payload["hours_of_operation"] = ta_data["hours_of_operation"]
            if ta_data.get("price_range"):
                update_payload["price_range"] = ta_data["price_range"]
            if ta_data.get("website"):
                update_payload["website"] = ta_data["website"]
            if ta_data.get("image_url"):
                update_payload["image_url"] = ta_data["image_url"]
            if ta_data.get("tripadvisor_id"):
                update_payload["tripadvisor_id"] = ta_data["tripadvisor_id"]
            
            # Update database
            if update_listing_in_db(supabase, listing_id, update_payload):
                print(f"✅ Updated ({ta_data.get('rating')} rating, {ta_data.get('review_count')} reviews)")
                checkpoint["updated"] += 1
            else:
                print("⚠️  No data to update")
            
            checkpoint["processed"] += 1
            checkpoint["last_listing_id"] = listing_id
            save_checkpoint(checkpoint)
            
            # Respectful delay
            time.sleep(REQUEST_DELAY)
            
        except Exception as e:
            print(f"❌ Error: {e}", file=sys.stderr)
            checkpoint["errors"] += 1
            checkpoint["processed"] += 1
            errors_log.append({
                "id": listing_id,
                "name": name,
                "city": city,
                "error": str(e)
            })
            save_checkpoint(checkpoint)
            time.sleep(REQUEST_DELAY)
            continue
    
    # Save errors
    if errors_log:
        Path(ERRORS_FILE).write_text(json.dumps(errors_log, indent=2, ensure_ascii=False))
        print(f"\n⚠️  Errors saved to {ERRORS_FILE}")
    
    # Final summary
    print("\n" + "=" * 100)
    print("SYNC COMPLETE")
    print("=" * 100)
    print(f"""
📊 SUMMARY:
  Total processed: {checkpoint['processed']}
  Successfully updated: {checkpoint['updated']}
  Not found on TripAdvisor: {checkpoint['not_found']}
  Errors: {checkpoint['errors']}

✅ Updated {checkpoint['updated']} listings with real TripAdvisor data
📍 Checkpoint saved: {CHECKPOINT_FILE}
💾 Errors logged: {ERRORS_FILE}
🔄 Backup saved: {BACKUP_FILE}

To resume if interrupted:
  python scripts/sync-tripadvisor-real-data.py --resume
""")
    
    # Clear checkpoint on success
    if checkpoint['errors'] == 0:
        Path(CHECKPOINT_FILE).unlink(missing_ok=True)
        print("✅ Sync successful - checkpoint cleared")


if __name__ == "__main__":
    main()
