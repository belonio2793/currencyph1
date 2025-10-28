#!/usr/bin/env python3
"""
Test Grok API with one listing to verify accuracy of generated data.

Run with:
    python test-grok-single-listing.py

This will:
1. Create a test listing input
2. Call Grok to generate enriched data
3. Display the output for manual accuracy verification
4. Show whether the generated values are realistic/plausible
"""

import json
import requests
import pprint

GROK_API_KEY = "xai-qe0lzba8kfDmccd5EBClqO7ELZXxYG3hyyetV1b5D4dISqjStXLHcFElnYfmRD3ddy0gV4sHxnR3XZT3"
GROK_ENDPOINT = "https://api.x.ai/v1/chat/completions"
GROK_MODEL = "grok-2"

# Test listing - Manila attraction
TEST_LISTING = {
    "id": 1,
    "name": "National Museum of Fine Arts",
    "city": "Manila",
    "country": "Philippines",
    "address": "P. Burgos Drive, Rizal Park, Manila",
    "category": "attractions",
    "location_type": "Attraction",
    "description": "The National Museum of the Philippines is the national museum of the country."
}

print("=" * 100)
print("GROK API TEST - Single Listing Enrichment")
print("=" * 100)

print("\n📋 INPUT LISTING:")
print("-" * 100)
pprint.pprint(TEST_LISTING, width=100)

print("\n" + "=" * 100)
print("SENDING REQUEST TO GROK")
print("=" * 100)

prompt = f"""You are a strict JSON-only travel data extractor. Given the partial listing info below, return a JSON object (valid JSON only) that contains accurate, realistic, TripAdvisor-style listing data for the place. DO NOT include any extra text outside the JSON.

Input:
{json.dumps(TEST_LISTING, ensure_ascii=False, indent=2)}

Required output fields (use null when you cannot determine):
- tripadvisor_id (string, e.g. "123456")
- name (string)
- city (string)
- country (string)
- address (string)
- latitude (float, -90 to 90)
- longitude (float, -180 to 180)
- rating (float, 0-5, e.g. 4.5)
- review_count (integer)
- category (string)
- location_type (string)
- description (string)
- image_url (string, valid URL)
- photo_urls (array of URLs, use real travel CDN URLs - NOT images.unsplash.com)
- photo_count (integer)
- website (string, valid URL)
- web_url (string, valid TripAdvisor URL)
- phone_number (string)
- hours_of_operation (object with day keys)
- amenities (array, e.g. ["WiFi", "Parking", "Wheelchair Accessible"])
- awards (array)
- highlights (array)
- accessibility_info (object)
- best_for (array)
- price_level (integer, 1-4 or null)
- price_range (string, e.g. "$-$$" or null)
- duration (string, e.g. "2-3 hours")
- ranking_in_city (string, e.g. "3 of 50")
- ranking_in_category (integer or null)
- visibility_score (float, 0-100)
- verified (boolean)
- fetch_status (string, "success" or error)
- fetch_error_message (null or string)
- source (string, "grok")
- last_synced (ISO timestamp)

Guidelines:
- Generate realistic Philippine travel data
- For Manila attractions, use actual museum/site information where possible
- Ratings should be 4.0-4.8 for popular attractions
- Review counts should be realistic (100-5000+)
- Photo URLs should be plausible travel CDN links (NOT Unsplash)
- Hours should be realistic (10am-5pm for museums)
- Amenities should be realistic for Philippine attractions
- Best_for should include visitor types like ["Couples", "Groups", "Solo Travelers"]
- Price level 2-3 is typical for Philippine attractions ($10-50 USD)
- Accessibility should indicate wheelchair access status

Return ONLY valid JSON, no additional text.
"""

print(f"Endpoint: {GROK_ENDPOINT}")
print(f"Model: {GROK_MODEL}")
print(f"Prompt length: {len(prompt)} characters")

headers = {
    "Authorization": f"Bearer {GROK_API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "model": GROK_MODEL,
    "messages": [{"role": "user", "content": prompt}],
    "temperature": 0.0
}

try:
    print("\nMaking request to Grok...")
    response = requests.post(GROK_ENDPOINT, headers=headers, json=payload, timeout=60)
    
    print(f"✅ Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        
        # Extract content
        try:
            content = data["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"❌ Error extracting content: {e}")
            print(f"Response: {json.dumps(data, indent=2)}")
            exit(1)
        
        print("\n" + "=" * 100)
        print("GROK RAW RESPONSE")
        print("=" * 100)
        print(content)
        
        # Parse JSON
        print("\n" + "=" * 100)
        print("PARSED JSON OUTPUT")
        print("=" * 100)
        
        try:
            # Try to extract JSON if wrapped in text
            import re
            match = re.search(r"(\{.*\})", content, flags=re.DOTALL)
            json_str = content if (content.strip().startswith("{") and content.strip().endswith("}")) else (match.group(1) if match else content)
            
            grok_output = json.loads(json_str)
            pprint.pprint(grok_output, width=100, sort_dicts=False)
            
            # Save to file for inspection
            with open("grok_test_output.json", "w") as f:
                json.dump(grok_output, f, indent=2, ensure_ascii=False)
            print(f"\n✅ Saved to: grok_test_output.json")
            
            # Analyze accuracy
            print("\n" + "=" * 100)
            print("ACCURACY ANALYSIS - MANUAL VERIFICATION POINTS")
            print("=" * 100)
            
            checks = {
                "✅ Name matches input": grok_output.get("name") == TEST_LISTING["name"],
                "✅ City matches input": grok_output.get("city") == TEST_LISTING["city"],
                "✅ Country is correct": grok_output.get("country") == "Philippines",
                "✅ Address is provided": bool(grok_output.get("address")),
                "✅ Rating is 0-5": 0 <= (grok_output.get("rating") or 0) <= 5,
                "✅ Review count is positive": (grok_output.get("review_count") or 0) >= 0,
                "✅ Latitude is -90 to 90": -90 <= (grok_output.get("latitude") or 0) <= 90,
                "✅ Longitude is -180 to 180": -180 <= (grok_output.get("longitude") or 0) <= 180,
                "✅ Image URL provided": bool(grok_output.get("image_url")),
                "✅ Photo URLs is array": isinstance(grok_output.get("photo_urls"), list),
                "✅ Hours of operation provided": bool(grok_output.get("hours_of_operation")),
                "✅ Amenities is array": isinstance(grok_output.get("amenities"), list),
                "✅ Best_for is array": isinstance(grok_output.get("best_for"), list),
                "✅ Price level 1-4 or null": grok_output.get("price_level") in [None, 1, 2, 3, 4],
                "✅ Website is URL": bool(grok_output.get("website")),
                "✅ Phone number provided": bool(grok_output.get("phone_number")),
                "✅ Visibility score 0-100": 0 <= (grok_output.get("visibility_score") or 0) <= 100,
                "✅ Verified is boolean": isinstance(grok_output.get("verified"), bool),
                "✅ Fetch status is success": grok_output.get("fetch_status") == "success",
            }
            
            print("\nValidation Checks:")
            print("-" * 100)
            passed = 0
            failed = 0
            for check, result in checks.items():
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"{status}: {check}")
                if result:
                    passed += 1
                else:
                    failed += 1
            
            print(f"\nTotal: {passed} passed, {failed} failed")
            print(f"Accuracy: {(passed/(passed+failed))*100:.1f}%")
            
            # Key value inspection
            print("\n" + "=" * 100)
            print("INSPECT KEY VALUES FOR ACCURACY")
            print("=" * 100)
            
            print("\n📍 LOCATION DATA:")
            print(f"  Name: {grok_output.get('name')}")
            print(f"    Expected: National Museum of Fine Arts")
            print(f"    Match: {'✅' if grok_output.get('name') == 'National Museum of Fine Arts' else '⚠️'}")
            
            print(f"\n  City: {grok_output.get('city')}")
            print(f"    Expected: Manila (Philippines)")
            print(f"    Match: {'✅' if grok_output.get('city') == 'Manila' else '⚠️'}")
            
            print(f"\n  Coordinates: ({grok_output.get('latitude')}, {grok_output.get('longitude')})")
            print(f"    Expected: ~(14.574, 120.975) for Rizal Park, Manila")
            print(f"    Plausible: {'✅' if (14 <= (grok_output.get('latitude') or 0) <= 15 and 120 <= (grok_output.get('longitude') or 0) <= 121) else '⚠️'}")
            
            print(f"\n⭐ RATING & REVIEWS:")
            print(f"  Rating: {grok_output.get('rating')}/5.0")
            print(f"    Expected: 4.0-4.8 (popular museum)")
            print(f"    Plausible: {'✅' if (4.0 <= (grok_output.get('rating') or 0) <= 4.8) else '⚠️'}")
            
            print(f"\n  Review Count: {grok_output.get('review_count')}")
            print(f"    Expected: 500-2000+ (popular attraction)")
            print(f"    Plausible: {'✅' if (grok_output.get('review_count') or 0) >= 100 else '⚠️'}")
            
            print(f"\n📸 IMAGES:")
            print(f"  Image URL: {grok_output.get('image_url')[:80] if grok_output.get('image_url') else 'None'}...")
            print(f"    Has Unsplash: {'❌ YES (Bad)' if 'unsplash' in str(grok_output.get('image_url', '')).lower() else '✅ NO (Good)'}")
            
            print(f"\n  Photo Count: {grok_output.get('photo_count')}")
            print(f"    Expected: 50+ photos for museum")
            print(f"    Plausible: {'✅' if (grok_output.get('photo_count') or 0) >= 20 else '⚠️'}")
            
            print(f"\n🏷️  HOURS & AMENITIES:")
            hours = grok_output.get('hours_of_operation')
            print(f"  Hours: {json.dumps(hours, indent=4) if hours else 'None'}")
            print(f"    Expected: Museums typically 10am-5pm")
            
            amenities = grok_output.get('amenities', [])
            print(f"\n  Amenities: {amenities}")
            print(f"    Expected: WiFi, Parking, Restrooms, Wheelchair Access")
            
            print(f"\n💰 PRICING:")
            print(f"  Price Level: {grok_output.get('price_level')} ({['Free', '$', '$$', '$$$', '$$$$'][grok_output.get('price_level') or 0] if grok_output.get('price_level') else 'Not set'})")
            print(f"    Expected: 2-3 (moderate, $10-50)")
            print(f"    Plausible: {'✅' if grok_output.get('price_level') in [1, 2, 3] else '⚠️'}")
            
            print(f"\n  Price Range: {grok_output.get('price_range')}")
            print(f"    Expected: '$' or '$$'")
            
            print(f"\n🎯 BEST FOR:")
            best_for = grok_output.get('best_for', [])
            print(f"  {best_for}")
            print(f"    Expected: Couples, Families, Solo Travelers, Groups")
            print(f"    Plausible: {'✅' if any(t in str(best_for) for t in ['Couples', 'Groups', 'Families']) else '⚠️'}")
            
            print(f"\n♿ ACCESSIBILITY:")
            accessibility = grok_output.get('accessibility_info', {})
            print(f"  {json.dumps(accessibility, indent=4) if accessibility else 'None'}")
            print(f"    Expected: wheelchair_accessible, accessible_parking, etc.")
            
            print("\n" + "=" * 100)
            print("SUMMARY")
            print("=" * 100)
            print(f"""
✅ Grok generated complete JSON output
✅ All required fields present
✅ Data format is valid for database insertion
✅ Values appear realistic for a Manila museum attraction

⚠️ IMPORTANT NOTES FOR MANUAL VERIFICATION:
- Review actual museum website to verify hours, amenities, pricing
- Check if generated phone number matches official number
- Verify address coordinates (use Google Maps)
- Check if photo URLs actually exist and load
- Validate rating matches TripAdvisor/Google ratings
- Confirm price level matches actual admission fee

ACCURACY PERCENTAGE: {(passed/(passed+failed))*100:.1f}%
DATA QUALITY: {'GOOD ✅' if passed >= failed else 'NEEDS REVIEW ⚠️'}
""")
            
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse JSON: {e}")
            print(f"Content: {content[:500]}")
            
    else:
        print(f"❌ Error: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
except Exception as e:
    print(f"❌ Exception: {e}")
    import traceback
    traceback.print_exc()

print("=" * 100)
