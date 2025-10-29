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

// Philippine cities to search
const PHIL_CITIES = [
  'Manila', 'Cebu City', 'Davao City', 'Quezon City', 'Makati',
  'Caloocan', 'Las Piñas', 'Parañaque', 'Pasig', 'Taguig',
  'Valenzuela', 'Malabon', 'Navotas', 'Muntinlupa', 'Pasay',
  'Bacolod', 'Iloilo City', 'Cagayan de Oro', 'Zamboanga City', 'General Santos',
  'Butuan', 'Dumaguete', 'Tacloban', 'Cabanatuan', 'Dagupan',
  'Baguio', 'Boracay', 'Palawan', 'Siargao', 'El Nido',
  'Coron', 'Calapan', 'Puerto Princesa', 'Lucena', 'Goa',
  'Tagaytay', 'Antipolo', 'Cavite City', 'Imus', 'Kawit',
  'Batangas City', 'Laoag', 'Vigan', 'Urdaneta', 'Pangasinan',
  'Cabadbaran', 'Iligan', 'Marawi', 'Cotabato City', 'Kidapawan'
];

const CATEGORIES = ['restaurants', 'hotels', 'attractions'];

let stats = {
  total: 0,
  created: 0,
  updated: 0,
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
    /-d(\d+)-/,
    /location\/(\d+)/,
    /-d(\d{6,10})(?:[\-_]|$)/,
    /\/d(\d+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

function parseListingFromGoogle(result, city, category) {
  try {
    const url = result.link || '';
    const title = result.title || '';
    const snippet = result.snippet || '';
    
    if (!url.includes('tripadvisor')) return null;

    const tripadvisor_id = extractTripadvisorId(url);
    if (!tripadvisor_id) return null;

    // Extract name from title (remove TripAdvisor text)
    const name = title
      .replace(/\s*[-–]\s*TripAdvisor.*$/i, '')
      .replace(/\s*\(\d+\s*reviews\)\s*/i, '')
      .trim();

    if (!name || name.length < 2) return null;

    const listing = {
      tripadvisor_id,
      name,
      city,
      country: 'Philippines',
      web_url: url,
      source: 'google_custom_search',
      fetch_status: 'pending',
      location_type: categoryToLocationType(category),
      category: inferCategory(name, snippet, category)
    };

    // Extract basic info from snippet
    if (snippet) {
      if (snippet.includes('Rating:')) {
        const ratingMatch = snippet.match(/Rating:\s*([\d.]+)/);
        if (ratingMatch) {
          listing.rating = parseFloat(ratingMatch[1]);
        }
      }
      listing.description = snippet.substring(0, 500);
    }

    return listing;
  } catch (error) {
    console.error(`Error parsing listing: ${error.message}`);
    return null;
  }
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
  const snippetLower = (snippet || '').toLowerCase();
  const nameLower = (name || '').toLowerCase();
  const full = `${name} ${snippet}`.toLowerCase();

  if (categoryHint === 'restaurants') {
    if (full.includes('cafe') || full.includes('coffee')) return 'Cafe';
    if (full.includes('bar') || full.includes('nightclub')) return 'Bar';
    if (full.includes('fast food')) return 'Fast Food';
    if (full.includes('dessert') || full.includes('bakery')) return 'Bakery';
    if (full.includes('seafood')) return 'Seafood';
    if (full.includes('asian')) return 'Asian';
    if (full.includes('pizza')) return 'Pizza';
    return 'Restaurant';
  }

  if (categoryHint === 'hotels') {
    if (full.includes('resort')) return 'Resort';
    if (full.includes('guesthouse') || full.includes('hostel')) return 'Guesthouse';
    if (full.includes('motel')) return 'Motel';
    if (full.includes('villa')) return 'Villa';
    return 'Hotel';
  }

  if (categoryHint === 'attractions') {
    if (full.includes('beach') || full.includes('island')) return 'Beach';
    if (full.includes('museum')) return 'Museum';
    if (full.includes('park')) return 'Park';
    if (full.includes('church') || full.includes('temple')) return 'Historical Site';
    if (full.includes('diving') || full.includes('water')) return 'Water Sport';
    if (full.includes('tour') || full.includes('guide')) return 'Tour';
    return 'Attraction';
  }

  return 'Attraction';
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
      console.warn(`  ⚠️  Google Search API ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (data.items || []).filter(item => 
      item.link && item.link.includes('tripadvisor.com')
    );
  } catch (error) {
    console.warn(`  ⚠️  Search error: ${error.message}`);
    return [];
  }
}

async function upsertListing(listing) {
  try {
    const { data, error } = await supabase
      .from('nearby_listings')
      .upsert(
        {
          ...listing,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'tripadvisor_id' }
      )
      .select();

    if (error) {
      console.warn(`    ✗ Upsert failed: ${error.message}`);
      stats.failed++;
      return false;
    }

    if (data && data.length > 0) {
      const isNew = data[0].created_at === data[0].updated_at;
      if (isNew) {
        stats.created++;
      } else {
        stats.updated++;
      }
    }
    return true;
  } catch (error) {
    console.warn(`    ✗ Error: ${error.message}`);
    stats.failed++;
    return false;
  }
}

async function processCity(city, category) {
  console.log(`\n🔍 Searching: ${category} in ${city}...`);
  
  const queries = [
    `${category} ${city} site:tripadvisor.com.ph`,
    `best ${category} in ${city} tripadvisor`,
    `${city} ${category} tripadvisor philippines`
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

      const listing = parseListingFromGoogle(result, city, category);
      if (!listing) continue;

      if (processedIds.has(listing.tripadvisor_id)) continue;
      processedIds.add(listing.tripadvisor_id);

      const success = await upsertListing(listing);
      if (success) {
        console.log(`  ✓ ${listing.name} (${listing.location_type})`);
        added++;
      }
    }

    // Rate limiting
    await sleep(1000);
  }

  return added;
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 POPULATE NEARBY_LISTINGS VIA GOOGLE CUSTOM SEARCH');
  console.log('='.repeat(70));

  console.log(`\n📊 Configuration:`);
  console.log(`  Cities: ${PHIL_CITIES.length}`);
  console.log(`  Categories: ${CATEGORIES.join(', ')}`);
  console.log(`  Expected searches: ${PHIL_CITIES.length * CATEGORIES.length}`);

  const startTime = Date.now();

  for (const city of PHIL_CITIES) {
    for (const category of CATEGORIES) {
      const added = await processCity(city, category);
      stats.total += added;

      // Rate limiting between requests
      await sleep(500);
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

  console.log('\n' + '='.repeat(70));
  console.log('📈 SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Total Added: ${stats.total}`);
  console.log(`  Created: ${stats.created}`);
  console.log(`  Updated: ${stats.updated}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`  Searches Performed: ${stats.searchesPerformed}`);
  console.log(`  Duration: ${duration} minutes`);
  console.log('='.repeat(70));
  console.log('\n✅ Population complete!\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
