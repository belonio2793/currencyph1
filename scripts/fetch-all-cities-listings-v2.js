#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const TRIPADVISOR_KEY = process.env.TRIPADVISOR || process.env.VITE_TRIPADVISOR;

if (!SUPABASE_URL || !SUPABASE_KEY || !TRIPADVISOR_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Known city IDs from TripAdvisor for major Philippine cities
const KNOWN_CITIES = {
  'Manila': { id: '298573', country: 'Philippines' },
  'Cebu City': { id: '298447', country: 'Philippines' },
  'Davao City': { id: '295426', country: 'Philippines' },
  'Quezon City': { id: '315645', country: 'Philippines' },
  'Makati': { id: '315641', country: 'Philippines' },
  'Boracay': { id: '296720', country: 'Philippines' },
  'Iloilo City': { id: '296898', country: 'Philippines' },
  'Cagayan de Oro': { id: '295434', country: 'Philippines' },
  'Bacolod': { id: '298352', country: 'Philippines' },
  'Puerto Princesa': { id: '295421', country: 'Philippines' },
  'Baguio': { id: '295411', country: 'Philippines' },
  'Dumaguete': { id: '295436', country: 'Philippines' },
  'Vigan': { id: '296945', country: 'Philippines' },
  'Coron': { id: '296722', country: 'Philippines' },
  'El Nido': { id: '296721', country: 'Philippines' },
  'Siargao': { id: '296735', country: 'Philippines' },
  'Calapan': { id: '296834', country: 'Philippines' },
  'Tagbilaran': { id: '295425', country: 'Philippines' },
  'Zamboanga City': { id: '295437', country: 'Philippines' },
  'Olongapo': { id: '315650', country: 'Philippines' },
  'Subic Bay': { id: '296752', country: 'Philippines' },
  'Pampanga': { id: '315657', country: 'Philippines' },
  'Laguna': { id: '315662', country: 'Philippines' },
  'Cavite': { id: '315658', country: 'Philippines' },
  'Taguig': { id: '315644', country: 'Philippines' },
};

const CATEGORIES = ['attractions', 'restaurants', 'hotels'];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateSlug(name, id) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base}-${String(id).slice(-4)}`.substring(0, 150);
}

function extractPhotos(location) {
  const urls = [];
  
  if (location.photos && Array.isArray(location.photos)) {
    for (const photo of location.photos.slice(0, 20)) {
      const url = photo?.photo?.images?.large?.url || 
                  photo?.photo?.images?.medium?.url ||
                  photo?.photo?.images?.small?.url;
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    }
  }
  
  return urls;
}

function extractReviews(location) {
  const reviews = [];
  
  if (!location.reviews || !Array.isArray(location.reviews)) {
    return reviews;
  }
  
  for (const review of location.reviews.slice(0, 15)) {
    reviews.push({
      author: review.reviewer?.username || 'Reviewer',
      rating: review.rating || location.rating || 0,
      comment: review.text || review.title || '',
      date: review.review_datetime_utc || new Date().toISOString(),
      verified: !!review.is_traveler_reviewed,
      helpful_count: review.helpful_votes || 0
    });
  }
  
  return reviews;
}

function buildHighlights(location, category) {
  const highlights = [];
  
  if (location.description) highlights.push('Detailed info');
  if (location.photo_count && location.photo_count > 0) highlights.push(`${location.photo_count} photos`);
  if (location.rating && location.rating >= 4.5) highlights.push('Highly rated');
  if (location.num_reviews || location.review_count) highlights.push('Verified reviews');
  
  return highlights.slice(0, 5);
}

async function fetchListingDetails(locationId, cityName, category, apiKey) {
  try {
    const url = `https://api.tripadvisor.com/api/private/2.1/locations/${locationId}?key=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const location = await response.json();
    
    if (!location || !location.name) {
      return null;
    }
    
    const id = String(location.location_id || locationId);
    const timestamp = new Date().toISOString();
    const photos = extractPhotos(location);
    const reviews = extractReviews(location);
    const highlights = buildHighlights(location, category);
    
    const listing = {
      tripadvisor_id: id,
      name: location.name,
      slug: generateSlug(location.name, id),
      address: location.address_obj?.address_string || cityName,
      latitude: location.latitude || null,
      longitude: location.longitude || null,
      lat: location.latitude || null,
      lng: location.longitude || null,
      rating: location.rating ? parseFloat(location.rating) : null,
      review_count: location.num_reviews || location.review_count || 0,
      category: category,
      location_type: category === 'attractions' ? 'Attraction' : category === 'hotels' ? 'Hotel' : 'Restaurant',
      city: cityName,
      country: 'Philippines',
      source: 'tripadvisor_api',
      web_url: location.web_url || `https://www.tripadvisor.com/Tourism`,
      website: location.website || null,
      phone_number: location.phone || null,
      description: location.description || `${location.name} in ${cityName}`,
      highlights: highlights,
      best_for: ['Visit'],
      hours_of_operation: {},
      amenities: [],
      accessibility_info: {
        wheelchair_accessible: false,
        pet_friendly: false,
        elevator: false,
        accessible_parking: false,
        accessible_restroom: false
      },
      nearby_attractions: [],
      awards: [],
      price_level: location.price_level || null,
      price_range: location.price_level === 1 ? '$' : location.price_level === 2 ? '$$' : location.price_level === 3 ? '$$$' : location.price_level === 4 ? '$$$$' : null,
      duration: category === 'attractions' ? '2-4 hours' : '1-2 hours',
      visibility_score: location.rating ? (location.rating / 5) * 100 : 0,
      ranking_in_city: location.ranking || null,
      photo_count: location.photo_count || photos.length,
      photo_urls: photos,
      image_urls: photos.slice(0, 10),
      image_url: photos[0] || null,
      primary_image_url: photos[0] || null,
      featured_image_url: photos[0] || null,
      review_details: reviews,
      verified: true,
      last_verified_at: timestamp,
      updated_at: timestamp,
      fetch_status: 'success',
      raw: {
        city: cityName,
        country: 'Philippines',
        category: category,
      }
    };
    
    console.log(`  ✓ ${listing.name}`);
    return listing;
  } catch (error) {
    return null;
  }
}

async function fetchCityListings(cityName, cityId, category, apiKey) {
  try {
    const url = `https://api.tripadvisor.com/api/private/2.1/locations?location_id=${cityId}&category=${category}&key=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`  ⚠️ Listings request failed for ${cityName}/${category}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const items = data.data || [];
    
    if (!Array.isArray(items) || items.length === 0) {
      console.log(`  ℹ️ No listings found for ${cityName} in ${category}`);
      return [];
    }
    
    const results = [];
    
    for (const item of items.slice(0, 30)) {
      const locationId = String(item.location_id || '');
      if (!locationId) continue;
      
      const listing = await fetchListingDetails(locationId, cityName, category, apiKey);
      if (listing) {
        results.push(listing);
      }
      
      await sleep(200);
    }
    
    return results;
  } catch (error) {
    console.log(`  ✗ Error fetching listings for ${cityName}/${category}:`, error.message);
    return [];
  }
}

async function upsertListings(listings) {
  if (!listings || listings.length === 0) {
    return 0;
  }
  
  let count = 0;
  const batchSize = 20;
  
  for (let i = 0; i < listings.length; i += batchSize) {
    const batch = listings.slice(i, i + batchSize);
    
    try {
      const { error } = await supabase
        .from('nearby_listings')
        .upsert(batch, { onConflict: 'tripadvisor_id' });
      
      if (error) {
        console.error(`  ✗ Upsert error:`, error.message);
      } else {
        count += batch.length;
      }
    } catch (error) {
      console.error(`  ✗ Exception during upsert:`, error.message);
    }
    
    await sleep(100);
  }
  
  return count;
}

async function main() {
  console.log('\n🚀 TripAdvisor Philippines Fetcher (v2 - Known Cities)');
  console.log('========================================================\n');
  
  let totalScraped = 0;
  let totalUpserted = 0;
  const startTime = Date.now();
  const cities = Object.entries(KNOWN_CITIES);
  
  for (let cityIndex = 0; cityIndex < cities.length; cityIndex++) {
    const [cityName, { id: cityId }] = cities[cityIndex];
    const progress = `[${cityIndex + 1}/${cities.length}]`;
    
    console.log(`\n${progress} Fetching ${cityName}...`);
    
    const cityListings = [];
    
    for (const category of CATEGORIES) {
      console.log(`  📍 Category: ${category}`);
      const listings = await fetchCityListings(cityName, cityId, category, TRIPADVISOR_KEY);
      
      if (listings.length > 0) {
        cityListings.push(...listings);
        console.log(`     Found ${listings.length} listings`);
      }
      
      await sleep(500);
    }
    
    if (cityListings.length > 0) {
      console.log(`\n  💾 Saving ${cityListings.length} listings for ${cityName}...`);
      const saved = await upsertListings(cityListings);
      totalScraped += cityListings.length;
      totalUpserted += saved;
      console.log(`     ✓ Saved ${saved}/${cityListings.length}`);
    }
    
    await sleep(1000);
  }
  
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log('\n\n📊 Final Summary');
  console.log('================');
  console.log(`Cities Processed: ${cities.length}`);
  console.log(`Total Scraped:    ${totalScraped}`);
  console.log(`Total Upserted:   ${totalUpserted}`);
  console.log(`Duration:         ${duration} minutes`);
  console.log(`Timestamp:        ${new Date().toISOString()}`);
  console.log('\n✅ Complete!\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
