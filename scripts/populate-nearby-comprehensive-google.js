#!/usr/bin/env node

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CUSTOM_SEARCH_API = process.env.GOOGLE_CUSTOM_SEARCH_API;
const CX = process.env.CX;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

if (!GOOGLE_CUSTOM_SEARCH_API || !CX) {
  console.error('❌ Missing Google Custom Search credentials (GOOGLE_CUSTOM_SEARCH_API, CX)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PHIL_CITIES = [
  'Abuyog', 'Alaminos', 'Alcala', 'Angeles', 'Antipolo', 'Aroroy', 'Bacolod',
  'Bacoor', 'Bago', 'Bais', 'Balanga', 'Baliuag', 'Bangued', 'Bansalan',
  'Bantayan', 'Bataan', 'Batac', 'Batangas City', 'Bayambang', 'Bayawan',
  'Baybay', 'Bayugan', 'Biñan', 'Bislig', 'Bocaue', 'Bogo', 'Boracay',
  'Borongan', 'Butuan', 'Cabadbaran', 'Cabanatuan', 'Cabuyao', 'Cadiz',
  'Cagayan de Oro', 'Calamba', 'Calapan', 'Calbayog', 'Caloocan', 'Camiling',
  'Canlaon', 'Caoayan', 'Capiz', 'Caraga', 'Carmona', 'Catbalogan', 'Cauayan',
  'Cavite City', 'Cebu City', 'Cotabato City', 'Dagupan', 'Danao', 'Dapitan',
  'Daraga', 'Dasmariñas', 'Davao City', 'Davao del Norte', 'Davao del Sur',
  'Davao Oriental', 'Dipolog', 'Dumaguete', 'General Santos', 'General Trias',
  'Gingoog', 'Guihulngan', 'Himamaylan', 'Ilagan', 'Iligan', 'Iloilo City',
  'Imus', 'Isabela', 'Isulan', 'Kabankalan', 'Kidapawan', 'Koronadal',
  'La Carlota', 'Laoag', 'Lapu-Lapu', 'Las Piñas', 'Laoang', 'Legazpi',
  'Ligao', 'Limay', 'Lucena', 'Maasin', 'Mabalacat', 'Malabon', 'Malaybalay',
  'Malolos', 'Mandaluyong', 'Mandaue', 'Manila', 'Marawi', 'Marilao',
  'Masbate City', 'Mati', 'Meycauayan', 'Muntinlupa', 'Naga (Camarines Sur)',
  'Navotas', 'Olongapo', 'Ormoc', 'Oroquieta', 'Ozamiz', 'Pagadian', 'Palo',
  'Parañaque', 'Pasay', 'Pasig', 'Passi', 'Puerto Princesa', 'Quezon City',
  'Roxas', 'Sagay', 'Samal', 'San Carlos (Negros Occidental)',
  'San Carlos (Pangasinan)', 'San Fernando (La Union)', 'San Fernando (Pampanga)',
  'San Jose (Antique)', 'San Jose del Monte', 'San Juan', 'San Pablo', 'San Pedro',
  'Santiago', 'Silay', 'Sipalay', 'Sorsogon City', 'Surigao City', 'Tabaco',
  'Tabuk', 'Tacurong', 'Tagaytay', 'Tagbilaran', 'Taguig', 'Tacloban',
  'Talisay (Cebu)', 'Talisay (Negros Occidental)', 'Tanjay', 'Tarlac City',
  'Tayabas', 'Toledo', 'Trece Martires', 'Tuguegarao', 'Urdaneta', 'Valencia',
  'Valenzuela', 'Victorias', 'Vigan', 'Virac', 'Zamboanga City', 'Baguio',
  'Bohol', 'Coron', 'El Nido', 'Makati', 'Palawan', 'Siargao'
];

const CATEGORIES = ['restaurants', 'hotels', 'attractions'];

let stats = {
  searched: 0,
  total: 0,
  created: 0,
  failed: 0,
  skipped: 0,
  searchesPerformed: 0
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractTripadvisorId(url) {
  if (!url) return null;
  const patterns = [
    /-d(\d+)(?:[.-]|$)/,
    /location\/(\d+)/,
    /\/d(\d{6,10})(?:[\-_]|$)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

function parsePriceLevel(priceStr) {
  if (!priceStr) return null;
  const count = (priceStr.match(/\$/g) || []).length;
  return count > 0 && count <= 4 ? count : null;
}

function categoryToLocationType(category) {
  const map = {
    'restaurants': 'Restaurant',
    'hotels': 'Hotel',
    'attractions': 'Attraction'
  };
  return map[category] || 'Attraction';
}

function inferCategory(name, snippet, categoryHint) {
  const full = `${name} ${snippet || ''}`.toLowerCase();

  if (categoryHint === 'restaurants') {
    if (full.includes('cafe') || full.includes('coffee')) return 'Cafe';
    if (full.includes('bar') || full.includes('nightclub')) return 'Bar';
    if (full.includes('fast food')) return 'Fast Food';
    if (full.includes('dessert') || full.includes('bakery')) return 'Bakery';
    if (full.includes('seafood')) return 'Seafood';
    if (full.includes('asian') || full.includes('korean')) return 'Asian';
    if (full.includes('pizza') || full.includes('italian')) return 'Italian';
    return 'Restaurant';
  }

  if (categoryHint === 'hotels') {
    if (full.includes('resort')) return 'Resort';
    if (full.includes('guesthouse') || full.includes('hostel')) return 'Guesthouse';
    if (full.includes('motel')) return 'Motel';
    if (full.includes('villa')) return 'Villa';
    if (full.includes('aparthotel')) return 'Aparthotel';
    return 'Hotel';
  }

  if (categoryHint === 'attractions') {
    if (full.includes('beach') || full.includes('island')) return 'Beach';
    if (full.includes('museum')) return 'Museum';
    if (full.includes('park')) return 'Park';
    if (full.includes('church') || full.includes('temple') || full.includes('shrine')) return 'Historical Site';
    if (full.includes('diving') || full.includes('water') || full.includes('snorkeling')) return 'Water Sport';
    if (full.includes('tour') || full.includes('guide') || full.includes('trek')) return 'Tour';
    if (full.includes('waterfall')) return 'Waterfall';
    if (full.includes('mountain')) return 'Mountain';
    return 'Attraction';
  }

  return 'Attraction';
}

function extractRatingFromSnippet(snippet) {
  if (!snippet) return null;
  
  const patterns = [
    /(\d+\.?\d*)\s*\/\s*5/,
    /Rating:\s*(\d+\.?\d*)/,
    /(\d+\.?\d*)\s+out of\s+5/
  ];
  
  for (const pattern of patterns) {
    const match = snippet.match(pattern);
    if (match && match[1]) {
      const rating = parseFloat(match[1]);
      return rating >= 0 && rating <= 5 ? rating : null;
    }
  }
  return null;
}

function extractReviewCount(snippet) {
  if (!snippet) return null;
  
  const patterns = [
    /(\d+(?:,\d{3})*)\s+reviews?/i,
    /(\d+(?:,\d{3})*)\s+ratings?/i
  ];
  
  for (const pattern of patterns) {
    const match = snippet.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
  }
  return null;
}

function createListingFromGoogleResult(result, city, category) {
  try {
    const url = result.link || '';
    const title = result.title || '';
    const snippet = result.snippet || '';
    
    if (!url.includes('tripadvisor')) return null;

    const tripadvisor_id = extractTripadvisorId(url);
    if (!tripadvisor_id) return null;

    const name = title
      .replace(/\s*[-–]\s*TripAdvisor.*$/i, '')
      .replace(/\s*\(\d+\s*reviews?\s*\).*$/i, '')
      .trim();

    if (!name || name.length < 2) return null;

    const location_type = categoryToLocationType(category);
    const inferred_category = inferCategory(name, snippet, category);

    const listing = {
      tripadvisor_id,
      name,
      slug: `${generateSlug(name)}-${tripadvisor_id}`,
      city,
      country: 'Philippines',
      web_url: url,
      source: 'google_custom_search',
      location_type,
      category: inferred_category,
      fetch_status: 'pending',
      verified: false,
      description: snippet.substring(0, 500),
      rating: extractRatingFromSnippet(snippet),
      review_count: extractReviewCount(snippet),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return listing;
  } catch (error) {
    return null;
  }
}

async function googleCustomSearch(query) {
  try {
    const searchUrl = new URL('https://www.googleapis.com/customsearch/v1');
    searchUrl.searchParams.append('key', GOOGLE_CUSTOM_SEARCH_API);
    searchUrl.searchParams.append('cx', CX);
    searchUrl.searchParams.append('q', query);
    searchUrl.searchParams.append('num', '10');

    const response = await fetch(searchUrl.toString());
    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`  ⚠️  Rate limited by Google (429)`);
      } else {
        console.warn(`  ⚠️  Google API ${response.status}`);
      }
      return [];
    }

    const data = await response.json();
    return (data.items || []).filter(item => 
      item.link && (item.link.includes('tripadvisor.com.ph') || item.link.includes('tripadvisor.com'))
    );
  } catch (error) {
    console.warn(`  ⚠️  Search error: ${error.message?.substring(0, 60)}`);
    return [];
  }
}

async function checkIfListingExists(tripadvisor_id) {
  try {
    const { data } = await supabase
      .from('nearby_listings')
      .select('id, tripadvisor_id')
      .eq('tripadvisor_id', tripadvisor_id)
      .single();

    return data !== null;
  } catch (error) {
    return false;
  }
}

async function upsertListing(listing) {
  try {
    const exists = await checkIfListingExists(listing.tripadvisor_id);
    if (exists) {
      stats.skipped++;
      return false;
    }

    const { error } = await supabase
      .from('nearby_listings')
      .insert({
        ...listing,
        rating: listing.rating ? Math.min(5, Math.max(0, listing.rating)) : null,
        review_count: listing.review_count ? Math.max(0, listing.review_count) : null
      });

    if (error) {
      console.warn(`    ❌ Insert failed: ${error.message?.substring(0, 60)}`);
      stats.failed++;
      return false;
    }

    stats.created++;
    stats.total++;
    return true;
  } catch (error) {
    console.warn(`    ❌ Error: ${error.message?.substring(0, 60)}`);
    stats.failed++;
    return false;
  }
}

async function processCity(city, category) {
  console.log(`\n🔍 Searching: ${category} in ${city}...`);
  
  const queries = [
    `${category} in ${city} Philippines site:tripadvisor.com.ph`,
    `best ${category} ${city} tripadvisor philippines`,
    `top ${category} ${city} tripadvisor.com.ph`
  ];

  let added = 0;
  const processedIds = new Set();

  for (const query of queries) {
    if (added >= 5) break;

    console.log(`  Query: "${query}"`);
    const results = await googleCustomSearch(query);
    stats.searchesPerformed++;

    for (const result of results) {
      if (added >= 5) break;

      const listing = createListingFromGoogleResult(result, city, category);
      if (!listing) continue;

      if (processedIds.has(listing.tripadvisor_id)) continue;
      processedIds.add(listing.tripadvisor_id);

      const success = await upsertListing(listing);
      if (success) {
        console.log(`    ✓ ${listing.name} (${listing.location_type})`);
        if (listing.rating) {
          console.log(`      Rating: ${listing.rating}/5 | Reviews: ${listing.review_count || 'N/A'}`);
        }
        added++;
      }
    }

    await sleep(1000);
  }

  return added;
}

async function cityHasListings(city) {
  try {
    const { count } = await supabase
      .from('nearby_listings')
      .select('id', { count: 'exact', head: true })
      .eq('city', city);
    return (count || 0) > 0;
  } catch {
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 COMPREHENSIVE POPULATE NEARBY_LISTINGS VIA GOOGLE CUSTOM SEARCH');
  console.log('='.repeat(80));

  console.log(`\n📊 Configuration:`);
  console.log(`  Cities to search: ${PHIL_CITIES.length} (comprehensive Philippines coverage)`);
  console.log(`  Categories: ${CATEGORIES.join(', ')}`);
  console.log(`  Expected searches: ${PHIL_CITIES.length * CATEGORIES.length}`);
  console.log(`  Target per city/category: 5 listings`);
  console.log(`  Estimated total: ${PHIL_CITIES.length * CATEGORIES.length * 5} potential listings`);

  const startTime = Date.now();

  let cityCount = 0;
  for (const city of PHIL_CITIES) {
    cityCount++;
    console.log(`\n[${cityCount}/${PHIL_CITIES.length}] Processing ${city}...`);
    
    for (const category of CATEGORIES) {
      await processCity(city, category);
      await sleep(500);
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

  console.log('\n' + '='.repeat(80));
  console.log('📈 SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total Listings Added: ${stats.total}`);
  console.log(`  Successfully Created: ${stats.created}`);
  console.log(`  Skipped (Already Existed): ${stats.skipped}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Total Searches Performed: ${stats.searchesPerformed}`);
  console.log(`  Duration: ${duration} minutes`);
  console.log('='.repeat(80));

  if (stats.created > 0) {
    console.log('\n✅ Successfully populated nearby_listings table!');
    console.log(`\nNext steps:`);
    console.log(`  1. Visit /nearby page to see new listings`);
    console.log(`  2. To enrich with more data (photos, details, reviews):`);
    console.log(`     npm run populate-nearby-real-tripadvisor`);
    console.log(`  3. To fill missing photos:`);
    console.log(`     npm run fill-photos`);
  } else {
    console.log('\n⚠️  No new listings were added. They may already exist in the database.');
  }

  console.log('\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
