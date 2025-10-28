#!/usr/bin/env python3

import os
import sys
import json
import time
import argparse
import random
import string
from typing import List, Dict, Optional
from datetime import datetime
import requests
from supabase import create_client, Client

PHILIPPINES_CITIES = [
    "Abuyog",
    "Alaminos",
    "Alcala",
    "Angeles",
    "Antipolo",
    "Aroroy",
    "Bacolod",
    "Bacoor",
    "Bago",
    "Bais",
    "Balanga",
    "Baliuag",
    "Bangued",
    "Bansalan",
    "Bantayan",
    "Bataan",
    "Batac",
    "Batangas City",
    "Bayambang",
    "Bayawan",
    "Baybay",
    "Bayugan",
    "Biñan",
    "Bislig",
    "Bocaue",
    "Bogo",
    "Boracay",
    "Borongan",
    "Butuan",
    "Cabadbaran",
    "Cabanatuan",
    "Cabuyao",
    "Cadiz",
    "Cagayan de Oro",
    "Calamba",
    "Calapan",
    "Calbayog",
    "Caloocan",
    "Camiling",
    "Canlaon",
    "Caoayan",
    "Capiz",
    "Caraga",
    "Carmona",
    "Catbalogan",
    "Cauayan",
    "Cavite City",
    "Cebu City",
    "Cotabato City",
    "Dagupan",
    "Danao",
    "Dapitan",
    "Daraga",
    "Dasmariñas",
    "Davao City",
    "Davao del Norte",
    "Davao del Sur",
    "Davao Oriental",
    "Dipolog",
    "Dumaguete",
    "General Santos",
    "General Trias",
    "Gingoog",
    "Guihulngan",
    "Himamaylan",
    "Ilagan",
    "Iligan",
    "Iloilo City",
    "Imus",
    "Isabela",
    "Isulan",
    "Kabankalan",
    "Kidapawan",
    "Koronadal",
    "La Carlota",
    "Laoag",
    "Lapu-Lapu",
    "Las Piñas",
    "Laoang",
    "Legazpi",
    "Ligao",
    "Limay",
    "Lucena",
    "Maasin",
    "Mabalacat",
    "Malabon",
    "Malaybalay",
    "Malolos",
    "Mandaluyong",
    "Mandaue",
    "Manila",
    "Marawi",
    "Marilao",
    "Masbate City",
    "Mati",
    "Meycauayan",
    "Muntinlupa",
    "Naga (Camarines Sur)",
    "Navotas",
    "Olongapo",
    "Ormoc",
    "Oroquieta",
    "Ozamiz",
    "Pagadian",
    "Palo",
    "Parañaque",
    "Pasay",
    "Pasig",
    "Passi",
    "Puerto Princesa",
    "Quezon City",
    "Roxas",
    "Sagay",
    "Samal",
    "San Carlos (Negros Occidental)",
    "San Carlos (Pangasinan)",
    "San Fernando (La Union)",
    "San Fernando (Pampanga)",
    "San Jose (Antique)",
    "San Jose del Monte",
    "San Juan",
    "San Pablo",
    "San Pedro",
    "Santiago",
    "Silay",
    "Sipalay",
    "Sorsogon City",
    "Surigao City",
    "Tabaco",
    "Tabuk",
    "Tacurong",
    "Tagaytay",
    "Tagbilaran",
    "Taguig",
    "Tacloban",
    "Talisay (Cebu)",
    "Talisay (Negros Occidental)",
    "Tanjay",
    "Tarlac City",
    "Tayabas",
    "Toledo",
    "Trece Martires",
    "Tuguegarao",
    "Urdaneta",
    "Valencia",
    "Valenzuela",
    "Victorias",
    "Vigan",
    "Virac",
    "Zamboanga City",
    "Baguio",
    "Bohol",
    "Coron",
    "El Nido",
    "Makati",
    "Palawan",
    "Siargao"
]

CATEGORIES = [
    "attractions", "museums", "parks", "beaches", "hotels",
    "restaurants", "churches", "shopping", "nightlife"
]


def create_slug(name: str, tripadvisor_id: str) -> str:
    """Create a unique slug from name and TripAdvisor ID"""
    base_slug = (
        name.lower()
        .strip()
        .replace(" ", "-")
    )
    # Remove special characters
    base_slug = "".join(c if c.isalnum() or c == "-" else "" for c in base_slug)
    base_slug = "-".join(filter(None, base_slug.split("-")))
    
    id_suffix = str(tripadvisor_id)[-6:].lower()
    if base_slug:
        return f"{base_slug}-{id_suffix}"
    else:
        return f"listing-{id_suffix}"


def fetch_tripadvisor_data(query: str, api_key: str, limit: int = 30, city: str = None) -> List[Dict]:
    """Fetch data from TripAdvisor API and populate all nearby_listings columns"""
    params = {
        "query": query,
        "limit": limit
    }

    url = "https://api.tripadvisor.com/api/partner/2.0/locations/search"

    try:
        response = requests.get(
            url,
            params=params,
            headers={
                "X-TripAdvisor-API-Key": api_key,
                "Accept": "application/json",
            },
            timeout=10
        )

        if response.status_code != 200:
            print(f"  ⚠️  API returned {response.status_code} for: {query}", file=sys.stderr)
            return []

        data = response.json()
        items = data.get("data", data.get("results", []))

        listings = []
        for item in items:
            # Extract address components
            address = ""
            api_city = city
            api_country = "Philippines"

            if isinstance(item.get("address_obj"), dict):
                addr_obj = item["address_obj"]
                parts = [
                    addr_obj.get("street1", ""),
                    addr_obj.get("city", ""),
                    addr_obj.get("country", "")
                ]
                address = ", ".join(filter(None, parts))
                if addr_obj.get("city"):
                    api_city = addr_obj.get("city")
                if addr_obj.get("country"):
                    api_country = addr_obj.get("country")
            else:
                address = item.get("address", item.get("address_string", ""))

            # Extract basic info
            name = item.get("name", item.get("title", ""))
            location_type = item.get("type", item.get("location_type", ""))
            if not location_type:
                category_obj = item.get("category", {})
                if isinstance(category_obj, dict):
                    location_type = category_obj.get("name", "Attraction")
                else:
                    location_type = item.get("subcategory", "Attraction")

            # Generate TripAdvisor ID
            tripadvisor_id = str(item.get("location_id", f"php_{''.join(random.choices(string.ascii_lowercase + string.digits, k=8))}"))

            # Create slug
            slug = create_slug(name, tripadvisor_id)

            # Extract photo URLs and count
            photo_urls = []
            image_url = None

            if isinstance(item.get("photo"), dict):
                images = item["photo"].get("images", {})
                if isinstance(images, dict):
                    large = images.get("large", {})
                    if isinstance(large, dict):
                        image_url = large.get("url")

            if not image_url:
                image_url = item.get("image_url")

            # Extract all photo URLs if available
            if isinstance(item.get("photos"), list):
                photo_urls = [p.get("url") for p in item.get("photos", []) if isinstance(p, dict) and p.get("url")][:20]

            # Extract rating and review details
            rating = None
            if item.get("rating"):
                try:
                    rating = float(item["rating"])
                except (ValueError, TypeError):
                    rating = None

            review_count = item.get("review_count", item.get("num_reviews"))
            if review_count is not None:
                try:
                    review_count = int(review_count)
                except (ValueError, TypeError):
                    review_count = None

            # Extract amenities, highlights, awards
            amenities = []
            if isinstance(item.get("amenities"), list):
                amenities = item.get("amenities", [])

            awards = []
            if isinstance(item.get("awards"), list):
                awards = item.get("awards", [])

            highlights = []
            if isinstance(item.get("highlights"), list):
                highlights = item.get("highlights", [])

            # Extract accessibility info
            accessibility_info = {}
            if isinstance(item.get("accessibility_info"), dict):
                accessibility_info = item.get("accessibility_info", {})

            # Extract hours of operation
            hours_of_operation = {}
            if isinstance(item.get("hours_of_operation"), dict):
                hours_of_operation = item.get("hours_of_operation", {})

            # Extract nearby attractions
            nearby_attractions = []
            if isinstance(item.get("nearby_attractions"), list):
                nearby_attractions = item.get("nearby_attractions", [])

            # Extract best_for categories
            best_for = []
            if isinstance(item.get("best_for"), list):
                best_for = item.get("best_for", [])

            # Extract price information
            price_level = None
            price_range = None
            if item.get("price_level"):
                try:
                    price_level = int(item["price_level"])
                except (ValueError, TypeError):
                    price_level = None

            if item.get("price_range"):
                price_range = item.get("price_range")

            # Extract duration
            duration = item.get("duration")

            # Extract ranking information
            ranking_in_city = item.get("ranking_in_city")
            ranking_in_category = None
            if item.get("ranking_in_category"):
                try:
                    ranking_in_category = int(item["ranking_in_category"])
                except (ValueError, TypeError):
                    ranking_in_category = None

            # Calculate visibility score (0-100) based on available data
            visibility_score = 0.0
            if rating:
                visibility_score += (rating / 5.0) * 40  # Rating worth 40 points
            if review_count:
                visibility_score += min((review_count / 1000.0) * 40, 40)  # Review count worth up to 40 points
            if image_url:
                visibility_score += 10  # Has image worth 10 points
            if item.get("verified"):
                visibility_score += 10  # Verified worth 10 points

            now = datetime.now().isoformat()

            # Build complete listing with all columns
            listing = {
                # Core identification
                "tripadvisor_id": tripadvisor_id,
                "slug": slug,
                "source": "tripadvisor",

                # Basic information
                "name": name,
                "address": address or None,
                "city": api_city,
                "country": api_country,
                "location_type": location_type,
                "category": item.get("subcategory", location_type),
                "description": item.get("description", item.get("about")),

                # Geographic data
                "latitude": item.get("latitude", item.get("lat")),
                "longitude": item.get("longitude", item.get("lon")),
                "lat": item.get("latitude", item.get("lat")),
                "lng": item.get("longitude", item.get("lon")),

                # Rating & review data
                "rating": rating,
                "review_count": review_count,
                "review_details": item.get("review_details", []) if isinstance(item.get("review_details"), list) else [],

                # Images & media
                "image_url": image_url,
                "featured_image_url": image_url,  # Use same as image_url if not provided
                "primary_image_url": image_url,   # Use same as image_url if not provided
                "photo_urls": photo_urls,
                "photo_count": item.get("photo_count", item.get("num_photos")),

                # Contact & website
                "website": item.get("website", item.get("web_url")),
                "web_url": item.get("web_url", f"https://www.tripadvisor.com/Attraction_Review-g298573-d{item.get('location_id', '0')}"),
                "phone_number": item.get("phone", item.get("phone_number")),

                # Details & features
                "highlights": highlights,
                "amenities": amenities,
                "awards": awards,
                "hours_of_operation": hours_of_operation,
                "accessibility_info": accessibility_info,
                "nearby_attractions": nearby_attractions,
                "best_for": best_for,

                # Pricing & duration
                "price_level": price_level,
                "price_range": price_range,
                "duration": duration,

                # Rankings & visibility
                "ranking_in_city": ranking_in_city,
                "ranking_in_category": ranking_in_category,
                "visibility_score": round(visibility_score, 2),
                "verified": bool(item.get("verified", True)),

                # Data status
                "fetch_status": "success",
                "fetch_error_message": None,
                "last_verified_at": now,
                "updated_at": now,

                # Raw data
                "raw": item
            }

            listings.append(listing)

        return listings

    except requests.RequestException as e:
        print(f"  ❌ Error fetching {query}: {e}", file=sys.stderr)
        return []


def upsert_listings(supabase: Client, listings: List[Dict]) -> int:
    """Upsert listings to Supabase"""
    if not listings:
        return 0
    
    chunk_size = 50
    upserted_count = 0
    
    for i in range(0, len(listings), chunk_size):
        chunk = listings[i:i + chunk_size]
        
        try:
            # Supabase upsert
            response = supabase.table("nearby_listings").upsert(
                chunk,
                {"onConflict": "tripadvisor_id"}
            ).execute()
            
            upserted_count += len(chunk)
            print(f"  ✓ Upserted {len(chunk)} listings ({upserted_count}/{len(listings)} total)")
            
        except Exception as e:
            print(f"  ❌ Error upserting chunk {i // chunk_size + 1}: {e}", file=sys.stderr)
        
        time.sleep(0.1)
    
    return upserted_count


def main():
    parser = argparse.ArgumentParser(description="Sync TripAdvisor listings to Supabase")
    parser.add_argument("--city", type=str, help="Specific city to sync (if not provided, syncs all)")
    parser.add_argument("--limit", type=int, default=30, help="Limit results per query (default: 30)")
    parser.add_argument("--category", type=str, help="Specific category to sync (if not provided, syncs all)")
    parser.add_argument("--resume", action="store_true", help="Resume from last checkpoint (not yet implemented)")
    
    args = parser.parse_args()
    
    # Load environment variables
    supabase_url = os.getenv("VITE_PROJECT_URL") or os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    tripadvisor_key = os.getenv("VITE_TRIPADVISOR") or os.getenv("TRIPADVISOR")
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase environment variables", file=sys.stderr)
        sys.exit(1)
    
    if not tripadvisor_key:
        print("❌ Missing TripAdvisor API key", file=sys.stderr)
        sys.exit(1)
    
    # Initialize Supabase client
    supabase = create_client(supabase_url, supabase_key)
    
    # Determine cities and categories to sync
    cities = [args.city] if args.city else PHILIPPINES_CITIES
    categories = [args.category] if args.category else CATEGORIES
    
    total_queries = len(cities) * len(categories)
    print(f"📍 Starting sync for {len(cities)} cities × {len(categories)} categories")
    print(f"Total queries: {total_queries}\n")
    
    all_listings = []
    total_fetched = 0
    success_count = 0
    error_count = 0
    query_count = 0
    
    # Fetch data
    for city in cities:
        for category in categories:
            query_count += 1
            query = f"{category} in {city} Philippines"
            print(f"[{query_count}/{total_queries}] Fetching {query}... ", end="", flush=True)

            try:
                listings = fetch_tripadvisor_data(query, tripadvisor_key, args.limit, city)
                
                if listings:
                    all_listings.extend(listings)
                    total_fetched += len(listings)
                    success_count += 1
                    print(f"✓ {len(listings)} items")
                else:
                    print("(no results)")
                
                time.sleep(0.3)
                
            except Exception as e:
                error_count += 1
                print(f"✗ Error: {e}", file=sys.stderr)
    
    # Print summary
    print(f"\n📊 Results:\n")
    print(f"  Total fetched: {total_fetched}")
    print(f"  Successful queries: {success_count}")
    print(f"  Failed queries: {error_count}")
    
    # Deduplicate listings by tripadvisor_id
    unique_map = {}
    for listing in all_listings:
        tid = listing["tripadvisor_id"]
        if tid not in unique_map:
            unique_map[tid] = listing
    
    unique_listings = list(unique_map.values())
    print(f"  Unique listings: {len(unique_listings)}")
    
    # Upsert to database
    if unique_listings:
        print(f"\n💾 Upserting to database...")
        upserted_count = upsert_listings(supabase, unique_listings)
        print(f"\n✅ Sync complete! Upserted {upserted_count} listings.\n")
    else:
        print(f"\n⚠️  No listings found. Check TripAdvisor API key.\n")


if __name__ == "__main__":
    main()
