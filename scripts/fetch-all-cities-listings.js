#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const TRIPADVISOR_KEY = process.env.TRIPADVISOR || process.env.VITE_TRIPADVISOR;

if (!SUPABASE_URL || !SUPABASE_KEY || !TRIPADVISOR_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PHILIPPINE_CITIES = [
  'Abuyog', 'Alaminos', 'Alcala', 'Angeles', 'Antipolo', 'Aroroy', 'Bacolod', 'Bacoor', 'Bago', 'Bais',
  'Balanga', 'Baliuag', 'Bangued', 'Bansalan', 'Bantayan', 'Bataan', 'Batac', 'Batangas City', 'Bayambang', 'Bayawan',
  'Baybay', 'Bayugan', 'Biñan', 'Bislig', 'Bocaue', 'Bogo', 'Boracay', 'Borongan', 'Butuan', 'Cabadbaran',
  'Cabanatuan', 'Cabuyao', 'Cadiz', 'Cagayan de Oro', 'Calamba', 'Calapan', 'Calbayog', 'Caloocan', 'Camiling', 'Canlaon',
  'Caoayan', 'Capiz', 'Caraga', 'Carmona', 'Catbalogan', 'Cauayan', 'Cavite City', 'Cebu City', 'Cotabato City', 'Dagupan',
  'Danao', 'Dapitan', 'Daraga', 'Dasmariñas', 'Davao City', 'Davao del Norte', 'Davao del Sur', 'Davao Oriental', 'Dipolog', 'Dumaguete',
  'General Santos', 'General Trias', 'Gingoog', 'Guihulngan', 'Himamaylan', 'Ilagan', 'Iligan', 'Iloilo City', 'Imus', 'Isabela',
  'Isulan', 'Kabankalan', 'Kidapawan', 'Koronadal', 'La Carlota', 'Laoag', 'Lapu-Lapu', 'Las Piñas', 'Laoang', 'Legazpi',
  'Ligao', 'Limay', 'Lucena', 'Maasin', 'Mabalacat', 'Malabon', 'Malaybalay', 'Malolos', 'Mandaluyong', 'Mandaue',
  'Manila', 'Marawi', 'Marilao', 'Masbate City', 'Mati', 'Meycauayan', 'Muntinlupa', 'Naga', 'Navotas', 'Olongapo',
  'Ormoc', 'Oroquieta', 'Ozamiz', 'Pagadian', 'Palo', 'Parañaque', 'Pasay', 'Pasig', 'Passi', 'Puerto Princesa',
  'Quezon City', 'Roxas', 'Sagay', 'Samal', 'San Carlos', 'San Fernando', 'San Jose', 'San Jose del Monte',
  'San Juan', 'San Pablo', 'San Pedro', 'Santiago', 'Silay', 'Sipalay', 'Sorsogon City', 'Surigao City', 'Tabaco', 'Tabuk',
  'Tacurong', 'Tagaytay', 'Tagbilaran', 'Taguig', 'Tacloban', 'Talisay', 'Tanjay', 'Tarlac City', 'Tayabas',
  'Toledo', 'Trece Martires', 'Tuguegarao', 'Urdaneta', 'Valencia', 'Valenzuela', 'Victorias', 'Vigan', 'Virac', 'Zamboanga City',
  'Baguio', 'Bohol', 'Coron', 'El Nido', 'Makati', 'Palawan', 'Siargao'
];

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

function extractHours(hours) {
  const result = {};
  if (!hours) return result;
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  if (Array.isArray(hours)) {
    for (const h of hours) {
      const day = days[h.day] || 'Unknown';
      result[day] = {
        open: h.open_time || 'N/A',
        close: h.close_time || 'N/A',
        closed: h.closed === true
      };
    }
  }
  
  return result;
}

function extractAmenities(location) {
  const items = [];
  
  if (!location.amenities || !Array.isArray(location.amenities)) {
    return items;
  }
  
  for (const amenity of location.amenities) {
    if (typeof amenity === 'string') {
      items.push({ name: amenity, available: true });
    } else {
      items.push({ name: amenity.name || String(amenity), available: amenity.available !== false });
    }
  }
  
  return items;
}

function extractAwards(location) {
  const list = [];
  
  if (!location.awards || !Array.isArray(location.awards)) {
    return list;
  }
  
  for (const award of location.awards) {
    if (typeof award === 'string') {
      list.push({ name: award });
    } else {
      list.push({ name: award.name, year: award.year });
    }
  }
  
  return list;
}

function buildHighlights(location, category) {
  const highlights = [];
  
  if (location.description) highlights.push('Detailed info');
  if (location.photo_count && location.photo_count > 0) highlights.push(`${location.photo_count} photos`);
  if (location.amenities && location.amenities.length) highlights.push(`${location.amenities.length} amenities`);
  if (location.awards && location.awards.length) highlights.push('Award winner');
  if (location.rating && location.rating >= 4.5) highlights.push('Highly rated');
  if (location.num_reviews || location.review_count) highlights.push('Verified reviews');
  
  return highlights.slice(0, 12);
}

async function fetchListingDetails(locationId, cityName, category, apiKey) {
  try {
    const url = `https://api.tripadvisor.com/api/private/2.1/locations/${locationId}?key=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`  ⚠️ Failed to fetch details for ${locationId}: ${response.status}`);
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
    const hours = extractHours(location.hours);
    const amenities = extractAmenities(location);
    const awards = extractAwards(location);
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
      web_url: location.web_url || `https://www.tripadvisor.com/Tourism-g${location.location_id}-Reviews.html`,
      website: location.website || null,
      phone_number: location.phone || null,
      description: location.description || `${location.name} in ${cityName}`,
      highlights: highlights,
      best_for: ['Visit'],
      hours_of_operation: hours,
      amenities: amenities,
      accessibility_info: {
        wheelchair_accessible: false,
        pet_friendly: false,
        elevator: false,
        accessible_parking: false,
        accessible_restroom: false
      },
      nearby_attractions: [],
      awards: awards,
      price_level: location.price_level || null,
      price_range: location.price_level === 1 ? '$' : location.price_level === 2 ? '$$' : location.price_level === 3 ? '$$$' : location.price_level === 4 ? '$$$$' : null,
      duration: category === 'attractions' ? '2-4 hours' : '1-2 hours',
      visibility_score: location.rating ? (location.rating / 5) * 100 : 0,
      ranking_in_city: location.ranking || null,
      ranking_in_category: null,
      photo_count: location.photo_count || photos.length,
      photo_urls: photos,
      image_urls: photos.slice(0, 10),
      image_url: photos[0] || null,
      primary_image_url: photos[0] || null,
      featured_image_url: photos[0] || null,
      stored_image_path: null,
      image_downloaded_at: null,
      review_details: reviews,
      verified: true,
      last_verified_at: timestamp,
      updated_at: timestamp,
      fetch_status: 'success',
      raw: {
        city: cityName,
        country: 'Philippines',
        category: category,
        api_response: location
      }
    };
    
    console.log(`  ✓ ${listing.name}`);
    return listing;
  } catch (error) {
    console.warn(`  ✗ Error fetching details for ${locationId}:`, error.message);
    return null;
  }
}

async function fetchCityListings(cityName, category, apiKey) {
  try {
    // Search for city + category
    const searchUrl = `https://api.tripadvisor.com/api/private/2.1/locations/search?query=${encodeURIComponent(cityName + ' Philippines')}&key=${apiKey}`;
    
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      console.log(`  ⚠️ Search failed for ${cityName} (${category}): ${searchResponse.status}`);
      return [];
    }
    
    const searchData = await searchResponse.json();
    const locations = searchData.data || [];
    
    if (!Array.isArray(locations) || locations.length === 0) {
      console.log(`  ℹ️ No locations found for ${cityName} (${category})`);
      return [];
    }
    
    const cityId = locations[0]?.location_id;
    if (!cityId) {
      return [];
    }
    
    // Fetch listings for city in category
    const listingsUrl = `https://api.tripadvisor.com/api/private/2.1/locations?location_id=${cityId}&category=${category}&key=${apiKey}`;
    const listingsResponse = await fetch(listingsUrl);
    
    if (!listingsResponse.ok) {
      console.log(`  ⚠️ Listings request failed for ${cityName}/${category}: ${listingsResponse.status}`);
      return [];
    }
    
    const listingsData = await listingsResponse.json();
    const items = listingsData.data || [];
    
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
  console.log('\n🚀 TripAdvisor Philippines Comprehensive Fetcher');
  console.log('================================================\n');
  
  let totalScraped = 0;
  let totalUpserted = 0;
  const startTime = Date.now();
  
  for (let cityIndex = 0; cityIndex < PHILIPPINE_CITIES.length; cityIndex++) {
    const city = PHILIPPINE_CITIES[cityIndex];
    const progress = `[${cityIndex + 1}/${PHILIPPINE_CITIES.length}]`;
    
    console.log(`\n${progress} Fetching ${city}...`);
    
    const cityListings = [];
    
    for (const category of CATEGORIES) {
      console.log(`  📍 Category: ${category}`);
      const listings = await fetchCityListings(city, category, TRIPADVISOR_KEY);
      
      if (listings.length > 0) {
        cityListings.push(...listings);
        console.log(`     Found ${listings.length} listings`);
      }
      
      await sleep(500);
    }
    
    if (cityListings.length > 0) {
      console.log(`\n  💾 Saving ${cityListings.length} listings for ${city}...`);
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
  console.log(`Total Scraped:  ${totalScraped}`);
  console.log(`Total Upserted: ${totalUpserted}`);
  console.log(`Duration:       ${duration} minutes`);
  console.log(`Timestamp:      ${new Date().toISOString()}`);
  console.log('\n✅ Complete!\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
