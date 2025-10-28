# Test Grok Accuracy - Single Listing Test

Since TripAdvisor API returns 404, let's test Grok instead to see if it can generate accurate listing data.

## Run the Test

```bash
python test-grok-single-listing.py
```

This will:
1. Send one test listing (National Museum of Fine Arts, Manila) to Grok
2. Request enriched JSON with all 47 columns
3. Display the output for manual verification
4. Check validity of generated data
5. Score accuracy percentage

## What to Check Manually After Running

### 1. **Location Accuracy** ✅
Check these values against reality:
- **Name**: Should match "National Museum of Fine Arts"
- **City**: Should be "Manila"
- **Country**: Should be "Philippines"
- **Address**: Should be valid Rizal Park area address
- **Coordinates**: Should be ~(14.574, 120.975) [Manila coordinates]

**Verify with**: Google Maps search "National Museum of Fine Arts Manila"

### 2. **Rating & Reviews** ⭐
- **Rating**: Should be 4.0-4.8 (popular museum)
- **Review Count**: Should be 500-2000+ (established attraction)

**Verify with**: TripAdvisor search or Google reviews for the museum

### 3. **Operating Hours** 🕐
Should look like:
```json
{
  "Monday": {"open": "10:00", "close": "17:00", "closed": false},
  "Tuesday": {"open": "10:00", "close": "17:00", "closed": false},
  ...
}
```

**Verify with**: Museum website or Google "National Museum of Fine Arts hours"

### 4. **Images & Photos** 📸
- **image_url**: Should be valid URL (NOT images.unsplash.com)
- **photo_urls**: Should be array of real travel photo URLs
- **photo_count**: Should be 50-200+ for museum

**Verify**: Try opening the image_url in a browser - should load

### 5. **Contact Information** 📞
- **phone_number**: Should look like Philippine number (e.g., +63 2...)
- **website**: Should be valid museum URL

**Verify with**: Official museum contact info

### 6. **Amenities & Features** 🏷️
Should include realistic options like:
- "Wheelchair Accessible"
- "Parking"
- "Restrooms"
- "Gift Shop"
- "Audio Guide"

**Verify with**: Museum website amenities listing

### 7. **Pricing** 💰
- **price_level**: 1-4 scale (1=$, 2=$$, 3=$$$, 4=$$$$)
- **price_range**: Should match price_level
- **duration**: Should be "2-3 hours" for museum visit

**Verify with**: Museum admission prices and website

### 8. **Best For** 🎯
Should include visitor types like:
- "Couples"
- "Families"
- "Solo Travelers"
- "Groups"
- "Art Lovers"

**Verify**: Matches typical museum visitors

## Expected Accuracy Metrics

| Metric | Expected | Acceptable |
|--------|----------|-----------|
| JSON validity | 100% | 100% |
| Field completeness | 100% | 95%+ |
| Location accuracy | ±0.1° | ±1° |
| Rating plausibility | 4.0-4.8 | 3.5-5.0 |
| Review count | 500-2000 | 100-5000 |
| Hours format | Valid JSON | Valid JSON |
| Image URLs | Real CDN | Real CDN |
| No Unsplash | 100% | 100% |

## Interpreting Results

### ✅ Good Results (Use Grok)
```
Status: 200 OK
Accuracy: 85%+ 
All fields populated with realistic values
Image URLs are real (not Unsplash)
Coordinates fall within Manila bounds
```

### ⚠️ Mixed Results (Use with caution)
```
Status: 200 OK
Accuracy: 70-85%
Some fields hallucinated or unrealistic
May have some Unsplash images
Coordinates slightly off
```

### ❌ Poor Results (Need different approach)
```
Status: 200 OK
Accuracy: < 70%
Many hallucinated values
Contains Unsplash images
Coordinates completely wrong
```

## Manual Verification Checklist

After running the test, manually verify:

- [ ] **Name matches** "National Museum of Fine Arts"
- [ ] **City is** "Manila, Philippines"
- [ ] **Coordinates** are within Manila bounds (~14-15N, ~120-121E)
- [ ] **Rating** is between 3.5-5.0 (realistic)
- [ ] **Review count** is at least 100 (established place)
- [ ] **Hours** follow 24-hour format and look realistic
- [ ] **Image URL** opens in browser without Unsplash
- [ ] **Photo URLs** are valid CDN URLs
- [ ] **Phone** looks like Philippine number
- [ ] **Website** is plausible museum URL
- [ ] **Amenities** include wheelchair access, parking, etc.
- [ ] **Price level** matches admission fees ($-$$)
- [ ] **Best for** includes realistic visitor types
- [ ] **Accessibility info** present
- [ ] **Fetch status** is "success"

## If Accuracy is Good (85%+)

Then proceed with:
```bash
# Use Grok to enrich existing or new listings
python scripts/hybrid_tripadvisor_grok_sync.py --use-grok

# Or use your existing Grok script
python grok_replace_all_nearby_listings.py --limit 100
```

## If Accuracy is Poor (< 70%)

Options:
1. Try different prompt/model settings
2. Use Grok only for specific fields (hours, amenities)
3. Combine with manual data entry
4. Look for alternative data sources

## Sample Output Inspection

When the script runs, you'll see output like:

```json
{
  "name": "National Museum of Fine Arts",
  "city": "Manila",
  "country": "Philippines",
  "address": "P. Burgos Drive, Rizal Park, Manila 1000",
  "latitude": 14.5740,
  "longitude": 120.9754,
  "rating": 4.5,
  "review_count": 1200,
  "hours_of_operation": {
    "Monday": {"open": "10:00", "close": "17:00", "closed": false},
    ...
  },
  "image_url": "https://media.tacdn.com/media/...",
  "photo_urls": [...],
  "phone_number": "+63 2 5254-5000",
  "website": "https://www.nationalmuseum.ph",
  "amenities": ["Wheelchair Accessible", "Parking", "Restrooms"],
  "best_for": ["Couples", "Families", "Groups"],
  ...
}
```

Save this output and compare with:
- Google Maps for location/hours
- TripAdvisor for rating/reviews
- Official museum website for contact/amenities

## Files Generated

After running the test:
- `grok_test_output.json` - Full JSON output from Grok for inspection
- Console output with accuracy score

## Next Steps

1. **Run**: `python test-grok-single-listing.py`
2. **Check**: Manual verification against real museum info
3. **Score**: Review accuracy percentage shown
4. **Decide**: 
   - If 85%+ accuracy → Use Grok for full sync
   - If 70-85% → Use with manual review
   - If < 70% → Find alternative approach

---

**This test will show us if Grok can reliably generate travel listing data.**
