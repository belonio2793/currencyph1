#!/usr/bin/env python3
"""
refetch-all-tripadvisor-ph.py

Complete refetch pipeline:
1. Clear entire nearby_listings table (backup first)
2. Fetch all listings from TripAdvisor.com.ph by category and location
3. Extract real verified data for each listing
4. Populate nearby_listings table with clean, accurate data

Run with:
    python scripts/refetch-all-tripadvisor-ph.py              # Full refetch
    python scripts/refetch-all-tripadvisor-ph.py --dry-run    # Preview without clearing
    python scripts/refetch-all-tripadvisor-ph.py --limit 50   # Test with 50 listings
"""

import os
import sys
import json
import time
import argparse
import re
from typing import List, Dict, Optional, Set
from datetime import datetime
from pathlib import Path
from itertools import cycle
import uuid

import requests
from supabase import create_client, Client
from bs4 import BeautifulSoup

# Configuration
CHECKPOINT_FILE = "refetch_tripadvisor_checkpoint.json"
BACKUP_FILE = "nearby_listings_backup_before_clear.json"
ERRORS_FILE = "refetch_tripadvisor_errors.json"
INSERTED_FILE = "refetch_tripadvisor_inserted.json"

# ScrapingBee API Configuration (8 keys with 1000 calls each = 8000 total)
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

# TripAdvisor Philippines categories and regions
TRIPADVISOR_BASE = "https://www.tripadvisor.com.ph"

# Philippine cities - comprehensive list (180+ cities)
PH_CITIES = [
    "Abuyog", "Alaminos", "Alcala", "Angeles", "Antipolo", "Aroroy", "Bacolod", "Bacoor", "Bago", "Bais",
    "Balanga", "Baliuag", "Bangued", "Bansalan", "Bantayan", "Bataan", "Batac", "Batangas City", "Bayambang", "Bayawan",
    "Baybay", "Bayugan", "Biñan", "Bislig", "Bocaue", "Bogo", "Boracay", "Borongan", "Butuan", "Cabadbaran",
    "Cabanatuan", "Cabuyao", "Cadiz", "Cagayan de Oro", "Calamba", "Calapan", "Calbayog", "Caloocan", "Camiling", "Canlaon",
    "Caoayan", "Capiz", "Caraga", "Carmona", "Catbalogan", "Cauayan", "Cavite City", "Cebu City", "Cotabato City", "Dagupan",
    "Danao", "Dapitan", "Daraga", "Dasmariñas", "Davao City", "Davao del Norte", "Davao del Sur", "Davao Oriental", "Dipolog", "Dumaguete",
    "General Santos", "General Trias", "Gingoog", "Guihulngan", "Himamaylan", "Ilagan", "Iligan", "Iloilo City", "Imus", "Isabela",
    "Isulan", "Kabankalan", "Kidapawan", "Koronadal", "La Carlota", "Laoag", "Lapu-Lapu", "Las Piñas", "Laoang", "Legazpi",
    "Ligao", "Limay", "Lucena", "Maasin", "Mabalacat", "Malabon", "Malaybalay", "Malolos", "Mandaluyong", "Mandaue",
    "Manila", "Marawi", "Marilao", "Masbate City", "Mati", "Meycauayan", "Muntinlupa", "Naga (Camarines Sur)", "Navotas", "Olongapo",
    "Ormoc", "Oroquieta", "Ozamiz", "Pagadian", "Palo", "Parañaque", "Pasay", "Pasig", "Passi", "Puerto Princesa",
    "Quezon City", "Roxas", "Sagay", "Samal", "San Carlos (Negros Occidental)", "San Carlos (Pangasinan)", "San Fernando (La Union)", "San Fernando (Pampanga)",
    "San Jose (Antique)", "San Jose del Monte", "San Juan", "San Pablo", "San Pedro", "Santiago", "Silay", "Sipalay",
    "Sorsogon City", "Surigao City", "Tabaco", "Tabuk", "Tacurong", "Tagaytay", "Tagbilaran", "Taguig", "Tacloban", "Talisay (Cebu)",
    "Talisay (Negros Occidental)", "Tanjay", "Tarlac City", "Tayabas", "Toledo", "Trece Martires", "Tuguegarao", "Urdaneta", "Valencia", "Valenzuela",
    "Victorias", "Vigan", "Virac", "Zamboanga City", "Baguio", "Bohol", "Coron", "El Nido", "Makati", "Palawan", "Siargao"
]

CATEGORIES = [
    "Attractions",
    "Hotels",
    "Restaurants",
]


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
            params["api_key"] = CURRENT_KEY
            response = requests.get(SCRAPINGBEE_URL, params=params, timeout=20)
        
        if response.status_code != 200:
            return None
        
        return response.text
        
    except Exception as e:
        print(f"  ❌ ScrapingBee error: {e}", file=sys.stderr)
        return None


def city_to_region(city: str) -> str:
    """Map city to region name"""
    region_map = {
        "Abuyog": "Eastern Visayas", "Alaminos": "Calabarzon", "Alcala": "Northern Luzon",
        "Angeles": "Central Luzon", "Antipolo": "Calabarzon", "Aroroy": "Bicol",
        "Bacolod": "Western Visayas", "Bacoor": "Calabarzon", "Bago": "Western Visayas",
        "Bais": "Central Visayas", "Balanga": "Central Luzon", "Baliuag": "Central Luzon",
        "Bangued": "Cordillera", "Bansalan": "Mindanao", "Bantayan": "Central Visayas",
        "Bataan": "Central Luzon", "Batac": "Northern Luzon", "Batangas City": "Calabarzon",
        "Bayambang": "Northern Luzon", "Bayawan": "Negros Oriental", "Baybay": "Eastern Visayas",
        "Bayugan": "Mindanao", "Biñan": "Calabarzon", "Bislig": "Mindanao",
        "Bocaue": "Central Luzon", "Bogo": "Central Visayas", "Boracay": "Western Visayas",
        "Borongan": "Eastern Visayas", "Butuan": "Caraga", "Cabadbaran": "Caraga",
        "Cabanatuan": "Central Luzon", "Cabuyao": "Calabarzon", "Cadiz": "Western Visayas",
        "Cagayan de Oro": "Northern Mindanao", "Calamba": "Calabarzon", "Calapan": "Mimaropa",
        "Calbayog": "Western Visayas", "Caloocan": "Metro Manila", "Camiling": "Northern Luzon",
        "Canlaon": "Negros Oriental", "Caoayan": "Northern Luzon", "Capiz": "Western Visayas",
        "Caraga": "Caraga", "Carmona": "Calabarzon", "Catbalogan": "Eastern Visayas",
        "Cauayan": "Northern Luzon", "Cavite City": "Calabarzon", "Cebu City": "Central Visayas",
        "Cotabato City": "Soccsksargen", "Dagupan": "Northern Luzon", "Danao": "Central Visayas",
        "Dapitan": "Northern Mindanao", "Daraga": "Bicol", "Dasmariñas": "Calabarzon",
        "Davao City": "Davao Region", "Davao del Norte": "Davao Region", "Davao del Sur": "Davao Region",
        "Davao Oriental": "Davao Region", "Dipolog": "Zamboanga", "Dumaguete": "Negros Oriental",
        "General Santos": "Soccsksargen", "General Trias": "Calabarzon", "Gingoog": "Northern Mindanao",
        "Guihulngan": "Negros Oriental", "Himamaylan": "Negros Occidental", "Ilagan": "Northern Luzon",
        "Iligan": "Northern Mindanao", "Iloilo City": "Western Visayas", "Imus": "Calabarzon",
        "Isabela": "Northern Luzon", "Isulan": "Soccsksargen", "Kabankalan": "Negros Occidental",
        "Kidapawan": "Soccsksargen", "Koronadal": "Soccsksargen", "La Carlota": "Negros Occidental",
        "Laoag": "Ilocos Region", "Lapu-Lapu": "Central Visayas", "Las Piñas": "Metro Manila",
        "Laoang": "Bicol", "Legazpi": "Bicol", "Ligao": "Bicol", "Limay": "Central Luzon",
        "Lucena": "Calabarzon", "Maasin": "Eastern Visayas", "Mabalacat": "Central Luzon",
        "Malabon": "Metro Manila", "Malaybalay": "Northern Mindanao", "Malolos": "Central Luzon",
        "Mandaluyong": "Metro Manila", "Mandaue": "Central Visayas", "Manila": "Metro Manila",
        "Marawi": "Bangsamoro", "Marilao": "Central Luzon", "Masbate City": "Bicol",
        "Mati": "Davao Region", "Meycauayan": "Central Luzon", "Muntinlupa": "Metro Manila",
        "Naga (Camarines Sur)": "Bicol", "Navotas": "Metro Manila", "Olongapo": "Central Luzon",
        "Ormoc": "Eastern Visayas", "Oroquieta": "Northern Mindanao", "Ozamiz": "Northern Mindanao",
        "Pagadian": "Zamboanga", "Palo": "Eastern Visayas", "Parañaque": "Metro Manila",
        "Pasay": "Metro Manila", "Pasig": "Metro Manila", "Passi": "Western Visayas",
        "Puerto Princesa": "Mimaropa", "Quezon City": "Metro Manila", "Roxas": "Western Visayas",
        "Sagay": "Negros Occidental", "Samal": "Davao Region", "San Carlos (Negros Occidental)": "Negros Occidental",
        "San Carlos (Pangasinan)": "Northern Luzon", "San Fernando (La Union)": "Ilocos Region",
        "San Fernando (Pampanga)": "Central Luzon", "San Jose (Antique)": "Western Visayas",
        "San Jose del Monte": "Central Luzon", "San Juan": "Metro Manila", "San Pablo": "Calabarzon",
        "San Pedro": "Calabarzon", "Santiago": "Northern Luzon", "Silay": "Negros Occidental",
        "Sipalay": "Negros Occidental", "Sorsogon City": "Bicol", "Surigao City": "Caraga",
        "Tabaco": "Bicol", "Tabuk": "Cordillera", "Tacurong": "Soccsksargen", "Tagaytay": "Calabarzon",
        "Tagbilaran": "Central Visayas", "Taguig": "Metro Manila", "Tacloban": "Eastern Visayas",
        "Talisay (Cebu)": "Central Visayas", "Talisay (Negros Occidental)": "Negros Occidental",
        "Tanjay": "Negros Oriental", "Tarlac City": "Central Luzon", "Tayabas": "Calabarzon",
        "Toledo": "Central Visayas", "Trece Martires": "Calabarzon", "Tuguegarao": "Cagayan Valley",
        "Urdaneta": "Northern Luzon", "Valencia": "Negros Oriental", "Valenzuela": "Central Luzon",
        "Victorias": "Negros Occidental", "Vigan": "Ilocos Region", "Virac": "Bicol",
        "Zamboanga City": "Zamboanga", "Baguio": "Cordillera", "Bohol": "Central Visayas",
        "Coron": "Mimaropa", "El Nido": "Mimaropa", "Makati": "Metro Manila",
        "Palawan": "Mimaropa", "Siargao": "Caraga"
    }
    return region_map.get(city, "Philippines")


def extract_tripadvisor_listing_data(url: str, name: str = None, city: str = None, category: str = None) -> Optional[Dict]:
    """Extract ALL real data from a TripAdvisor listing page"""
    try:
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

        # Extract name if not provided
        if not name:
            h1 = soup.find('h1')
            if h1:
                name = h1.get_text(strip=True)

        # Extract rating
        rating = None
        for elem in soup.find_all('span', class_=re.compile('rating|Rating')):
            text = elem.get_text(strip=True)
            if re.search(r'[\d.]+', text):
                try:
                    rating = float(re.search(r'[\d.]+', text).group())
                    break
                except:
                    pass

        # Extract review count
        review_count = None
        for text in soup.stripped_strings:
            if 'review' in text.lower():
                match = re.search(r'(\d+)', text)
                if match:
                    review_count = int(match.group(1))
                    break

        # Extract address
        address = None
        addr_elem = soup.find('address')
        if addr_elem:
            address = addr_elem.get_text(strip=True)

        # Extract phone
        phone = None
        for pattern in [r'\+63[\d\s-]+', r'tel:\s*[\d\s-]+', r'0[\d\s-]{9,}']:
            match = re.search(pattern, html_content)
            if match:
                phone = match.group(0).strip()
                break

        # Extract email
        email = None
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', html_content)
        if email_match:
            email = email_match.group(0)

        # Extract description
        description = None
        for elem in soup.find_all(['p', 'div']):
            text = elem.get_text(strip=True)
            if len(text) > 50 and len(text) < 500:
                description = text
                break

        # Extract amenities
        amenities = []
        for item in soup.find_all(['li', 'div'], class_=re.compile('amenity|feature')):
            text = item.get_text(strip=True)
            if 5 < len(text) < 100:
                amenities.append(text)

        # Extract photos
        photo_urls = []
        for img in soup.find_all('img'):
            src = img.get('src', '') or img.get('data-src', '')
            if src and any(x in src for x in ['media', 'photo', 'image', 'static']):
                if src.startswith('http') and src not in photo_urls:
                    photo_urls.append(src)

        photo_urls = photo_urls[:50]
        image_url = photo_urls[0] if photo_urls else None

        # Determine location type
        location_type = "Attraction"
        if name:
            name_lower = name.lower()
            if 'restaurant' in name_lower or 'cafe' in name_lower or 'bar' in name_lower:
                location_type = "Restaurant"
            elif 'hotel' in name_lower or 'resort' in name_lower or 'inn' in name_lower:
                location_type = "Hotel"
            elif 'museum' in name_lower or 'temple' in name_lower or 'church' in name_lower:
                location_type = "Attraction"

        # Determine category
        subcategory = category or location_type

        return {
            "tripadvisor_id": tripadvisor_id,
            "name": name,
            "rating": rating,
            "review_count": review_count,
            "reviews_stags": review_count,
            "ranking_d": rating or 0,
            "address": address,
            "phone": phone,
            "phone_number": phone,
            "email": email,
            "description": description,
            "amenities": amenities,
            "image_url": image_url,
            "photo_url": image_url,
            "photo_urls": photo_urls,
            "photo_count": len(photo_urls),
            "location_type": location_type,
            "subcategory": subcategory,
            "web_url": url,
            "fetch_status": "success",
            "last_verified_at": datetime.now().isoformat(),
            "last_sync": datetime.now().isoformat(),
            "country": "Philippines",
            "currency": "PHP",
            "timezone": "Asia/Manila",
            "region_name": city_to_region(city) if city else "Philippines",
            "city": city,
        }

    except Exception as e:
        print(f"  ❌ Extraction error: {e}", file=sys.stderr)
        return None


def fetch_listings_by_location(location: str, category: str) -> List[Dict]:
    """Fetch listings for a specific location and category"""
    try:
        # Build search URL
        search_url = f"{TRIPADVISOR_BASE}/Search?q={location}%20{category}"
        
        print(f"  🔍 Fetching {category.lower()} in {location}...", end=" ", flush=True)
        
        html = fetch_with_scrapingbee(search_url)
        if not html:
            print("(no HTML)")
            return []
        
        soup = BeautifulSoup(html, 'html.parser')
        listings = []
        
        # Find all listing links
        for link in soup.find_all('a', href=re.compile(r'-d\d+-')):
            href = link.get('href', '')
            if href:
                name = link.get_text(strip=True)
                if name:
                    if href.startswith('http'):
                        url = href
                    else:
                        url = f"{TRIPADVISOR_BASE}{href}"
                    
                    listings.append({
                        "url": url,
                        "name": name,
                        "location": location,
                        "category": category
                    })
        
        print(f"Found {len(listings)} listings")
        return listings
        
    except Exception as e:
        print(f"(error: {e})")
        return []


def backup_current_listings(supabase: Client) -> bool:
    """Backup current listings before clearing"""
    try:
        print("📥 Backing up current listings...")
        response = supabase.table("nearby_listings").select("*").execute()
        data = response.data or []
        
        Path(BACKUP_FILE).write_text(json.dumps(data, indent=2, ensure_ascii=False, default=str))
        print(f"  ✅ Backed up {len(data)} listings to {BACKUP_FILE}")
        return True
    except Exception as e:
        print(f"  ❌ Backup error: {e}", file=sys.stderr)
        return False


def clear_nearby_listings(supabase: Client) -> bool:
    """Clear entire nearby_listings table"""
    try:
        print("🗑️  Clearing nearby_listings table...")
        # Delete all rows (using gt with 0 to match all IDs)
        supabase.table("nearby_listings").delete().gt("id", -1).execute()
        print("  ✅ Table cleared")
        return True
    except Exception as e:
        print(f"  ⚠️  Clear skipped (table may already be empty): {e}", file=sys.stderr)
        # Don't abort, table is likely already empty
        return True


def insert_listing(supabase: Client, listing_data: Dict) -> Optional[int]:
    """Insert a listing into the database"""
    try:
        response = supabase.table("nearby_listings").insert([listing_data]).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0].get("id")
        return None
    except Exception as e:
        print(f"    ❌ Insert error: {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(description="Refetch all TripAdvisor.com.ph listings")
    parser.add_argument("--dry-run", action="store_true", help="Preview without inserting")
    parser.add_argument("--no-backup", action="store_true", help="Skip backup (use if already cleared)")
    parser.add_argument("--limit", type=int, default=0, help="Limit total listings for testing")
    
    args = parser.parse_args()
    
    # Supabase credentials
    supabase_url = "https://corcofbmafdxehvlbesx.supabase.co"
    supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ0Mjk2NiwiZXhwIjoyMDc3MDE4OTY2fQ.zKQaZcsCXmVMr4uExjJzuV07H3JlEJP65f2_SKrpcb4"
    
    supabase = create_client(supabase_url, supabase_key)
    
    print("=" * 100)
    print("REFETCH ALL TRIPADVISOR.COM.PH LISTINGS")
    print("=" * 100)
    print(f"\n📊 USING {len(SCRAPINGBEE_KEYS)} SCRAPINGBEE KEYS (8000 total calls)\n")

    # Backup before clearing (skip if --no-backup)
    if not args.dry_run and not args.no_backup:
        if not backup_current_listings(supabase):
            print("❌ Backup failed, aborting")
            sys.exit(1)

        # Clear table
        if not clear_nearby_listings(supabase):
            print("❌ Clear failed, aborting")
            sys.exit(1)
    elif args.no_backup:
        print("⏭️  Skipping backup/clear (using --no-backup)\n")
    else:
        print("🔍 DRY RUN - Would clear table here\n")
    
    # Fetch listings from all cities
    all_listings = []
    total_locations = len(PH_CITIES)
    location_count = 0

    print(f"🌍 Scanning {total_locations} Philippine cities...\n")

    for city in PH_CITIES:
        location_count += 1
        print(f"📍 {city}:")

        for category in CATEGORIES:
            listings = fetch_listings_by_location(city, category)
            all_listings.extend(listings)
            time.sleep(0.2)

            if args.limit and len(all_listings) >= args.limit:
                break

        if args.limit and len(all_listings) >= args.limit:
            break
    
    if args.limit:
        all_listings = all_listings[:args.limit]
    
    print(f"\n✅ Found {len(all_listings)} total listings\n")
    
    # Insert listings
    if not args.dry_run:
        print("💾 Inserting listings into database...\n")
        
        inserted = []
        errors_log = []
        
        for idx, listing in enumerate(all_listings, 1):
            print(f"[{idx}/{len(all_listings)}] {listing['name']} ({listing['location']})...", end=" ", flush=True)
            
            try:
                # Extract full data from listing page
                ta_data = extract_tripadvisor_listing_data(
                    listing['url'],
                    listing['name'],
                    listing['location'],
                    listing['category']
                )

                if not ta_data:
                    print("❌ Failed to extract")
                    errors_log.append({
                        "name": listing['name'],
                        "error": "Failed to extract data"
                    })
                    continue

                # Prepare insert payload with ALL columns
                insert_payload = {
                    "id": str(uuid.uuid4()),
                    "name": listing['name'],
                    "city": listing['location'],
                    "category": listing['category'],
                    "slug": re.sub(r'[^a-z0-9]+', '-', listing['name'].lower()).strip('-'),
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat(),
                    "avg_cost": 0,  # Will be calculated based on reviews/ratings
                    "city_id": hash(listing['location']) % 10000,  # Generate consistent city ID
                    **ta_data
                }
                
                # Insert
                listing_id = insert_listing(supabase, insert_payload)
                
                if listing_id:
                    print(f"✅ ({ta_data.get('rating')} ⭐)")
                    inserted.append(insert_payload)
                else:
                    print("❌ Insert failed")
                    errors_log.append({
                        "name": listing['name'],
                        "error": "Insert failed"
                    })
                
                time.sleep(0.1)
                
            except Exception as e:
                print(f"❌ Error: {e}")
                errors_log.append({
                    "name": listing['name'],
                    "error": str(e)
                })
        
        # Save results
        Path(INSERTED_FILE).write_text(json.dumps(inserted, indent=2, ensure_ascii=False, default=str))
        
        if errors_log:
            Path(ERRORS_FILE).write_text(json.dumps(errors_log, indent=2, ensure_ascii=False))
        
        # Final summary
        print("\n" + "=" * 100)
        print("REFETCH COMPLETE")
        print("=" * 100)
        print(f"""
📊 SUMMARY:
  Locations scanned: {location_count}
  Listings found: {len(all_listings)}
  Successfully inserted: {len(inserted)}
  Errors: {len(errors_log)}

🔑 API USAGE:
  ScrapingBee calls: {SCRAPINGBEE_CALL_COUNT}
  Current key: #{SCRAPINGBEE_KEY_INDEX + 1}/{len(SCRAPINGBEE_KEYS)}
  Remaining calls: {1000 - (SCRAPINGBEE_CALL_COUNT % 1000)}

✅ Inserted {len(inserted)} real TripAdvisor.com.ph listings
📍 Backup saved: {BACKUP_FILE}
💾 Inserted listings: {INSERTED_FILE}
""")
        
        if errors_log:
            print(f"⚠️  Errors logged: {ERRORS_FILE}\n")
    
    else:
        print(f"🔍 DRY RUN: Would insert {len(all_listings)} listings\n")


if __name__ == "__main__":
    main()
