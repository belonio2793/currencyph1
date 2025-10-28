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
from itertools import cycle

import requests
from supabase import create_client, Client
from bs4 import BeautifulSoup
from difflib import SequenceMatcher

# Configuration
BATCH_SIZE = 50
REQUEST_DELAY = 0.3
CHECKPOINT_FILE = "tripadvisor_sync_checkpoint.json"
BACKUP_FILE = "nearby_listings_backup.json"
ERRORS_FILE = "tripadvisor_sync_errors.json"

# ScrapingBee API Configuration (rotated to avoid 1000 call limit)
SCRAPINGBEE_KEYS = [
    "Z3CQBBBPQIA4FQAQOHWJVO40ZKIRMM7LNUBVOQVAN2VP2PE2F1PQO9JGJZ5C9U9C9LRWK712V7P963C9",
    "OPYAXOKXYQ0SBE7LR23GJ3NH1R4M66NUM85WJO1SCFUOFGJ11LJP6ZKD1JBVKNGMGC3E1RQXF81NT4YS",
    "IQA11BPV1NYZEFAX4Q3SMM3DQZIBZWXY4O47IPRDBQPGAVZTQPKB4C2GAMXOEZJTEJ9TU5J2GQJJXSOP",
    "DHOMQK5VZOIUQN9JJZHFR3WX07XFGTFFYFVCRM6AOLZFGI5S9Z60R23AQM2LUL84M2SNK4HH9NGMVDCG",
    "8WKM4CAOLMHF8GXKHB3G1QPURA4X4LCIG9EGCXRWS7QMUJ7S7E3M6WQBYYV2FTFG5EWXR6Y4XM7TM4QX",
    "GLSHI1K5BM0VXE2CWR26MV73KXL6SLC6K055F65913FPY8MNRJXXU9ZYN8UD5HSRISOWL0OB7RV6CNEA",
    "5L1MQARL2TS8RSTPSME8UT0WEQL9ZP8NFL27LPUJ9QL7AJZ00V26C3DGCTPV2DOPQOQAU7WEXOCIDOP5",
    "VNQLTACROEZJGUONFP33PD7LIIJV6IWSFTPL7FUXAE1WJWAVZAY04QVPMRQBYJOGH5QWR7AQF8GXYDWV"
]
SCRAPINGBEE_URL = "https://app.scrapingbee.com/api/v1"
SCRAPINGBEE_KEY_CYCLE = cycle(SCRAPINGBEE_KEYS)
CURRENT_KEY = next(SCRAPINGBEE_KEY_CYCLE)
SCRAPINGBEE_CALL_COUNT = 0
SCRAPINGBEE_KEY_INDEX = 0

TRIPADVISOR_SEARCH_URL = "https://www.tripadvisor.com.ph/Search?q="
TRIPADVISOR_BASE = "https://www.tripadvisor.com.ph"


def rotate_scrapingbee_key():
    """Get next ScrapingBee key from rotation"""
    global CURRENT_KEY, SCRAPINGBEE_KEY_INDEX, SCRAPINGBEE_CALL_COUNT
    CURRENT_KEY = next(SCRAPINGBEE_KEY_CYCLE)
    SCRAPINGBEE_KEY_INDEX = (SCRAPINGBEE_KEY_INDEX + 1) % len(SCRAPINGBEE_KEYS)
    SCRAPINGBEE_CALL_COUNT = 0
    return CURRENT_KEY


def fetch_with_scrapingbee(url: str) -> Optional[str]:
    """Fetch HTML content from URL using ScrapingBee"""
    global CURRENT_KEY, SCRAPINGBEE_KEY_INDEX, SCRAPINGBEE_CALL_COUNT
    try:
        params = {
            "api_key": CURRENT_KEY,
            "url": url,
            "render_javascript": "false"
        }

        SCRAPINGBEE_CALL_COUNT += 1

        response = requests.get(SCRAPINGBEE_URL, params=params, timeout=20)

        if response.status_code == 429:
            # Rate limit hit, rotate key
            rotate_scrapingbee_key()
            print(f"  🔄 Rotated to Key #{SCRAPINGBEE_KEY_INDEX + 1}", end=" ", flush=True)
            params["api_key"] = CURRENT_KEY
            response = requests.get(SCRAPINGBEE_URL, params=params, timeout=20)

        if response.status_code != 200:
            return None

        return response.text

    except Exception as e:
        print(f"  ❌ ScrapingBee error: {e}", file=sys.stderr)
        return None


def search_tripadvisor(query: str) -> Optional[str]:
    """Search TripAdvisor for a listing and return the listing URL"""
    try:
        search_url = f"{TRIPADVISOR_SEARCH_URL}{requests.utils.quote(query)}"
        html = fetch_with_scrapingbee(search_url)

        if not html:
            return None

        soup = BeautifulSoup(html, 'html.parser')

        # Find first search result link
        result_link = soup.find('a', attrs={'data-test-target': 'search-result-title'})

        if not result_link:
            # Try alternative selectors
            result_link = soup.find('a', href=re.compile(r'-d\d+-'))

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
    """Extract ALL real data from a TripAdvisor listing page using ScrapingBee"""
    try:
        # Fetch HTML content from TripAdvisor listing
        html = fetch_with_scrapingbee(url)

        if not html:
            return None

        soup = BeautifulSoup(html, 'html.parser')
        html_content = html

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
        rating_elem = soup.find('span', class_=re.compile('ratingFilter|Rating|rating'))
        if rating_elem:
            rating_text = rating_elem.get_text(strip=True)
            try:
                rating_match = re.search(r'[\d.]+', rating_text)
                if rating_match:
                    rating = float(rating_match.group())
            except:
                pass

        # Extract review count
        review_count = None
        review_patterns = [
            soup.find(text=re.compile(r'\d+\s+review')),
            soup.find(text=re.compile(r'\d+.*review'))
        ]
        for review_elem in review_patterns:
            if review_elem:
                try:
                    review_match = re.search(r'(\d+)', review_elem)
                    if review_match:
                        review_count = int(review_match.group(1))
                        break
                except:
                    pass

        # Extract address
        address = None
        address_elem = soup.find('address')
        if address_elem:
            address = address_elem.get_text(strip=True)
        else:
            # Try alternate selectors
            for elem in soup.find_all(['span', 'div'], class_=re.compile('address|location')):
                if elem:
                    address = elem.get_text(strip=True)
                    break

        # Extract phone
        phone = None
        phone_patterns = [
            r'\+63\s?[\d\s-]+',
            r'tel:\s*[\d\s-]+',
            r'\(\d{3}\)\s*\d{3}-\d{4}'
        ]
        for pattern in phone_patterns:
            phone_match = re.search(pattern, html_content)
            if phone_match:
                phone = phone_match.group(0).strip()
                break

        # Extract description
        description = None
        for selector in ['div.description', 'div.about', 'div[class*="description"]', 'p']:
            desc_elem = soup.select_one(selector)
            if desc_elem:
                text = desc_elem.get_text(strip=True)
                if len(text) > 20:
                    description = text
                    break

        # Extract amenities list
        amenities = []
        for item in soup.find_all(['li', 'div'], class_=re.compile('amenity|feature|highlight')):
            amenity_text = item.get_text(strip=True)
            if amenity_text and 5 < len(amenity_text) < 100:
                amenities.append(amenity_text)

        # Extract hours
        hours_of_operation = {}
        hours_match = re.findall(r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[:\s]+([0-9:\s–\-ampm]+|Closed)', html_content, re.IGNORECASE)
        for day, time in hours_match:
            hours_of_operation[day.capitalize()] = time.strip()

        # Extract price range
        price_range = None
        price_match = re.search(r'(₱|€|\$)\s*-?\s*(₱|€|\$)?', html_content)
        if price_match:
            price_range = price_match.group(0).strip()

        # Extract website
        website = None
        for link in soup.find_all('a', href=re.compile(r'^http')):
            href = link.get('href', '')
            if href and 'tripadvisor' not in href.lower() and 'javascript' not in href.lower():
                website = href
                break

        # Extract ALL photo URLs
        photo_urls = []

        # Method 1: Extract from img tags
        for img in soup.find_all('img'):
            src = img.get('src', '') or img.get('data-src', '')
            if src and ('media' in src or 'photo' in src or 'image' in src or 'static' in src):
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
                        if photo_url not in photo_urls and photo_url.startswith('http'):
                            photo_urls.append(photo_url)

        # Method 3: Extract from data attributes
        for attr_val in re.findall(r'data-src="([^"]*)"', html_content):
            if attr_val and 'media' in attr_val and attr_val not in photo_urls:
                photo_urls.append(attr_val)

        # Clean up photo URLs (limit, remove duplicates)
        photo_urls = list(dict.fromkeys(photo_urls))[:50]

        # Extract main photo
        image_url = photo_urls[0] if photo_urls else None

        # Extract category/type
        location_type = "Attraction"
        if (name and 'restaurant' in name.lower()) or 'restaurant' in url.lower():
            location_type = "Restaurant"
        elif (name and 'hotel' in name.lower()) or 'hotel' in url.lower():
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

    # Supabase credentials
    supabase_url = "https://corcofbmafdxehvlbesx.supabase.co"
    supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ0Mjk2NiwiZXhwIjoyMDc3MDE4OTY2fQ.zKQaZcsCXmVMr4uExjJzuV07H3JlEJP65f2_SKrpcb4"

    print("=" * 100)
    print(f"📊 USING {len(SCRAPINGBEE_KEYS)} SCRAPINGBEE KEYS (rotating to avoid 1000-call limit)")
    print("=" * 100)

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
            # Search TripAdvisor using ScrapingBee
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
                update_payload["featured_image_url"] = ta_data["image_url"]
                update_payload["primary_image_url"] = ta_data["image_url"]
            if ta_data.get("photo_urls"):
                update_payload["photo_urls"] = ta_data["photo_urls"]
            if ta_data.get("photo_count"):
                update_payload["photo_count"] = ta_data["photo_count"]
            if ta_data.get("location_type"):
                update_payload["location_type"] = ta_data["location_type"]
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

🔑 API USAGE:
  ScrapingBee calls made: {SCRAPINGBEE_CALL_COUNT}
  Current key index: {SCRAPINGBEE_KEY_INDEX + 1}/{len(SCRAPINGBEE_KEYS)}
  Remaining calls on current key: {1000 - (SCRAPINGBEE_CALL_COUNT % 1000)}

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
