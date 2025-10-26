// Use built-in fetch (Node 18+) or node-fetch
let fetch;
try {
  // Node 18+ has built-in fetch
  fetch = globalThis.fetch;
} catch (e) {
  try {
    // Fallback to node-fetch if available
    const module = await import('node-fetch');
    fetch = module.default;
  } catch (e2) {
    console.error('Error: fetch not available. Requires Node 18+ or node-fetch package');
    process.exit(1);
  }
}

const TRIP_KEY = process.env.VITE_TRIPADVISOR || process.env.TRIPADVISOR;

if (!TRIP_KEY) {
  console.error('ERROR: VITE_TRIPADVISOR or TRIPADVISOR env var not set');
  console.error('Set it: export VITE_TRIPADVISOR=your_api_key');
  process.exit(1);
}

console.log('✓ TripAdvisor API Key found');

const CATEGORIES = [
  'hotels',
  'restaurants',
  'attractions',
  'things-to-do'
];

async function testAPI(query) {
  const params = new URLSearchParams();
  params.append('query', query);
  params.append('limit', '20');

  const url = `https://api.tripadvisor.com/api/partner/2.0/search?${params.toString()}`;
  
  console.log(`\n📡 Fetching: ${url}`);
  
  try {
    const res = await fetch(url, {
      headers: {
        'X-TripAdvisor-API-Key': TRIP_KEY,
        'Accept': 'application/json'
      }
    });

    console.log(`Status: ${res.status}`);

    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ Error ${res.status}: ${text}`);
      return null;
    }

    const json = await res.json();
    
    console.log(`Response structure:`, Object.keys(json));
    
    const items = json.data || json.results || [];
    console.log(`✓ Found ${items.length} results`);

    if (items.length > 0) {
      console.log('\nFirst 3 results:');
      items.slice(0, 3).forEach((item, idx) => {
        console.log(`\n  ${idx + 1}. ${item.name}`);
        console.log(`     Rating: ${item.rating || 'N/A'}`);
        console.log(`     Category: ${item.subcategory || item.category?.name || 'N/A'}`);
        console.log(`     Address: ${item.address || 'N/A'}`);
        console.log(`     ID: ${item.location_id || item.id || 'N/A'}`);
      });
    }

    return items;
  } catch (err) {
    console.error(`❌ Fetch failed: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('========================================');
  console.log('TripAdvisor API Test - Manila Categories');
  console.log('========================================');

  let totalFound = 0;

  for (const category of CATEGORIES) {
    const query = `${category} in Manila Philippines`;
    console.log(`\n--- Testing: "${query}" ---`);
    
    const results = await testAPI(query);
    if (results) {
      totalFound += results.length;
    }

    // Rate limiting
    console.log('⏳ Waiting 2 seconds before next request...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n========================================`);
  console.log(`Total results found: ${totalFound}`);
  console.log('========================================');

  if (totalFound === 0) {
    console.log('\n⚠️  No results found. Possible issues:');
    console.log('  1. Invalid API key');
    console.log('  2. API quota exceeded');
    console.log('  3. TripAdvisor API endpoint changed');
  } else {
    console.log('\n✓ API is working! You can now populate the database.');
  }
}

main().catch(console.error);
