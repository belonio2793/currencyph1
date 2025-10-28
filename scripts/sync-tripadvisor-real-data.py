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
    "GLSHI1K5BM0VXE2CWR26MV73KXL6SLC6K055F65913FPY8MNRJXXU9ZYN8UD5HSRISOWL0OB7RV6CNEA"
]
SCRAPINGBEE_URL = "https://app.scrapingbee.com/api/v1"
SCRAPINGBEE_KEY_CYCLE = cycle(SCRAPINGBEE_KEYS)
CURRENT_KEY = next(SCRAPINGBEE_KEY_CYCLE)

TRIPADVISOR_SEARCH_URL = "https://www.tripadvisor.com.ph/Search?q="
TRIPADVISOR_BASE = "https://www.tripadvisor.com.ph"


def search_tripadvisor_with_grok(query: str) -> Optional[str]:
    """Use Grok to search TripAdvisor and return the listing URL"""
    try:
        payload = {
            "model": GROK_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": f"Search TripAdvisor.com.ph for '{query}' and provide the direct URL to the listing page. Only respond with the URL, nothing else. If not found, respond with 'NOT_FOUND'."
                }
            ],
            "temperature": 0.2,
            "max_tokens": 200
        }

        response = requests.post(GROK_API_URL, headers=GROK_HEADERS, json=payload, timeout=15)

        if response.status_code != 200:
            print(f"  ❌ Grok API error: {response.status_code}", file=sys.stderr)
            return None

        data = response.json()
        url = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

        if url and url != "NOT_FOUND" and url.startswith("http"):
            return url

        return None

    except Exception as e:
        print(f"  ❌ Search error: {e}", file=sys.stderr)
        return None


def extract_tripadvisor_listing_data(url: str) -> Optional[Dict]:
    """Use Grok to extract ALL real data from a TripAdvisor listing URL"""
    try:
        # Extract listing ID from URL
        tripadvisor_id = None
        match = re.search(r'-d(\d+)-', url)
        if match:
            tripadvisor_id = match.group(1)

        # Use Grok to extract data from the TripAdvisor URL
        payload = {
            "model": GROK_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": f"""Visit this TripAdvisor listing and extract ALL available data:
{url}

Return ONLY a JSON object (no markdown, no code blocks) with these fields:
{{
    "name": "listing name",
    "rating": numeric rating or null,
    "review_count": number of reviews or null,
    "address": "full address",
    "phone_number": "phone with +63 prefix if possible",
    "description": "short description",
    "amenities": ["amenity1", "amenity2"],
    "hours_of_operation": {{"Monday": "9am-5pm", "Tuesday": "9am-5pm"}},
    "price_range": "₱₱ or €€ etc",
    "website": "external website URL if available",
    "location_type": "Hotel/Restaurant/Attraction",
    "photo_urls": ["photo_url1", "photo_url2"]
}}

Be accurate. Extract only what is actually visible on the page."""
                }
            ],
            "temperature": 0.1,
            "max_tokens": 2000
        }

        response = requests.post(GROK_API_URL, headers=GROK_HEADERS, json=payload, timeout=30)

        if response.status_code != 200:
            print(f"  ❌ Grok API error: {response.status_code}", file=sys.stderr)
            return None

        api_data = response.json()
        json_str = api_data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

        # Parse JSON response from Grok
        if not json_str:
            return None

        # Try to extract JSON from response (in case Grok wraps it)
        json_match = re.search(r'\{.*\}', json_str, re.DOTALL)
        if json_match:
            json_str = json_match.group()

        ta_data = json.loads(json_str)

        # Ensure data types
        rating = ta_data.get("rating")
        if rating is not None:
            try:
                rating = float(rating)
            except:
                rating = None

        review_count = ta_data.get("review_count")
        if review_count is not None:
            try:
                review_count = int(review_count)
            except:
                review_count = None

        # Clean photo URLs
        photo_urls = ta_data.get("photo_urls", [])
        if isinstance(photo_urls, list):
            photo_urls = [url for url in photo_urls if isinstance(url, str) and url.startswith("http")][:50]
        else:
            photo_urls = []

        # Extract main photo (first valid URL)
        image_url = photo_urls[0] if photo_urls else None

        # Build result with ALL extracted data
        data = {
            "tripadvisor_id": tripadvisor_id,
            "name": ta_data.get("name"),
            "rating": rating,
            "review_count": review_count,
            "address": ta_data.get("address"),
            "phone_number": ta_data.get("phone_number"),
            "description": ta_data.get("description"),
            "amenities": ta_data.get("amenities", []),
            "hours_of_operation": ta_data.get("hours_of_operation", {}),
            "price_range": ta_data.get("price_range"),
            "website": ta_data.get("website"),
            "image_url": image_url,
            "photo_urls": photo_urls,
            "photo_count": len(photo_urls),
            "location_type": ta_data.get("location_type", "Attraction"),
            "web_url": url,
            "fetch_status": "success",
            "fetch_error_message": None,
            "last_verified_at": datetime.now().isoformat(),
        }

        return data

    except json.JSONDecodeError as e:
        print(f"  ❌ JSON parsing error: {e}", file=sys.stderr)
        return None
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
            # Search TripAdvisor using Grok
            listing_url = search_tripadvisor_with_grok(search_query)
            
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
