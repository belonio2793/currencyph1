import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const X_API_KEY = process.env.X_API_KEY;

const SCRAPINGBEE_KEYS = [
  "Z3CQBBBPQIA4FQAQOHWJVO40ZKIRMM7LNUBVOQVAN2VP2PE2F1PQO9JGJZ5C9U9C9LRWK712V7P963C9",
  "OPYAXOKXYQ0SBE7LR23GJ3NH1R4M66NUM85WJO1SCFUOFGJ11LJP6ZKD1JBVKNGMGC3E1RQXF81NT4YS",
  "IQA11BPV1NYZEFAX4Q3SMM3DQZIBZWXY4O47IPRDBQPGAVZTQPKB4C2GAMXOEZJTEJ9TU5J2GQJJXSOP",
  "DHOMQK5VZOIUQN9JJZHFR3WX07XFGTFFYFVCRM6AOLZFGI5S9Z60R23AQM2LUL84M2SNK4HH9NGMVDCG",
  "8WKM4CAOLMHF8GXKHB3G1QPURA4X4LCIG9EGCXRWS7QMUJ7S7E3M6WQBYYV2FTFG5EWXR6Y4XM7TM4QX",
  "GLSHI1K5BM0VXE2CWR26MV73KXL6SLC6K055F65913FPY8MNRJXXU9ZYN8UD5HSRISOWL0OB7RV6CNEA",
  "5L1MQARL2TS8RSTPSME8UT0WEQL9ZP8NFL27LPUJ9QL7AJZ00V26C3DGCTPV2DOPQOQAU7WEXOCIDOP5",
  "VNQLTACROEZJGUONFP33PD7LIIJV6IWSFTPL7FUXAE1WJWAVZAY04QVPMRQBYJOGH5QWR7AQF8GXYDWV",
  "HV4MDSWYYK0VDXUGXBIMJIH22SKLNBJRB3DTRRU74NDI9XN4PBGYPAZKLCNR63KTHV36ST9GKPOWSXV3",
  "QI18L08TQXMJWP0V0ITR8E6GEJO4XBK21QXPAFUMD0E3L2K5RKUPEQ69UB4R4SQAZ2TC25ZJNVA4BS1Z",
  "UP4OPUE7QS3MZ7XX0YRBY5ODQMRBM4VP5O515GZ63DFP5GRXS9MHHN9Y6BBABZPTEOSC66D0ZKBJCBSE",
  "0ZEIRY3FTVISR347EDP2I3VW74HAODNCM11LZFL01HM5VB3O3YPADHT1VPHWUFHSM7LZHZ3AOQ0VB28R"
];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentKeyIndex = 0;
let stats = {
  total: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  updated: 0
};

// Rotate through ScrapingBee keys
function getNextBeeKey() {
  const key = SCRAPINGBEE_KEYS[currentKeyIndex % SCRAPINGBEE_KEYS.length];
  currentKeyIndex++;
  return key;
}

// Call Grok API to identify TripAdvisor ID and photos
async function grokEnrich(name, address, city, category) {
  try {
    const prompt = `You are a TripAdvisor expert. Find the EXACT TripAdvisor ID and photo URLs for this listing:

Name: ${name}
Address: ${address}
City: ${city}
Category: ${category}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "tripadvisor_id": "the-exact-id-only-format",
  "photo_urls": ["url1", "url2", "url3"],
  "web_url": "https://www.tripadvisor.com.ph/...",
  "confidence": 0-1
}

If you cannot find accurate data, return null for fields.`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      console.log(`  ⚠️  Grok API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return result.confidence > 0.5 ? result : null;
    }
    return null;
  } catch (error) {
    console.log(`  ⚠️  Grok error: ${error.message}`);
    return null;
  }
}

// ScrapingBee fallback to scrape TripAdvisor
async function scrapingBeeEnrich(name, address, city) {
  try {
    const searchUrl = `https://www.tripadvisor.com.ph/Search?q=${encodeURIComponent(name + ' ' + city)}`;
    const beeKey = getNextBeeKey();

    const response = await fetch('https://api.scrapingbee.com/api/v1/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: beeKey,
        url: searchUrl,
        render_javascript: true,
        wait_for: '[data-testid="result"]',
        timeout: 30000
      })
    });

    if (!response.ok) {
      console.log(`  ⚠️  ScrapingBee error: ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    // Extract TripAdvisor ID from HTML
    const idMatch = html.match(/\/(\d+-[a-zA-Z0-9_-]+)/);
    if (idMatch) {
      return {
        tripadvisor_id: idMatch[1],
        photo_urls: []
      };
    }
    return null;
  } catch (error) {
    console.log(`  ⚠️  ScrapingBee error: ${error.message}`);
    return null;
  }
}

// Fetch photo URLs from TripAdvisor using Grok
async function fetchPhotosWithGrok(tripadvisor_id, name) {
  try {
    const prompt = `Get the top 10 photo URLs from this TripAdvisor listing:
ID: ${tripadvisor_id}
Name: ${name}

Return ONLY a JSON array of URLs from tripadvisor/images or media.tacdn.com:
["url1", "url2", "url3"]

If you cannot find photos, return empty array [].`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!response.ok) return [];

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    
    const urlMatch = content.match(/\[[\s\S]*?\]/);
    if (urlMatch) {
      const urls = JSON.parse(urlMatch[0]);
      return Array.isArray(urls) ? urls.filter(u => typeof u === 'string' && u.startsWith('http')) : [];
    }
    return [];
  } catch (error) {
    console.log(`  ⚠️  Photo fetch error: ${error.message}`);
    return [];
  }
}

// Update listing in database
async function updateListing(id, updates) {
  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        verified: true,
        fetch_status: 'success'
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.log(`  ❌ DB update error: ${error.message}`);
    return false;
  }
}

// Main enrichment function
async function enrichListing(listing) {
  console.log(`\n📍 Processing: ${listing.name} (${listing.city})`);
  
  stats.total++;

  // Skip if already has tripadvisor_id
  if (listing.tripadvisor_id && listing.photo_urls?.length > 0) {
    stats.skipped++;
    console.log(`  ✅ Already enriched - SKIPPED`);
    return;
  }

  let enrichedData = null;

  // Step 1: Try Grok first
  console.log(`  🤖 Trying Grok...`);
  enrichedData = await grokEnrich(
    listing.name,
    listing.address || '',
    listing.city || '',
    listing.category || listing.location_type || ''
  );

  // Step 2: Fallback to ScrapingBee
  if (!enrichedData?.tripadvisor_id) {
    console.log(`  🐝 Falling back to ScrapingBee...`);
    enrichedData = await scrapingBeeEnrich(listing.name, listing.address || '', listing.city || '');
  }

  if (!enrichedData?.tripadvisor_id) {
    stats.failed++;
    console.log(`  ❌ Could not find TripAdvisor ID`);
    return;
  }

  console.log(`  ✓ Found ID: ${enrichedData.tripadvisor_id}`);

  // Step 3: Fetch photos if we have the ID
  let photoUrls = enrichedData.photo_urls || [];
  if (enrichedData.tripadvisor_id && photoUrls.length === 0) {
    console.log(`  📸 Fetching photos...`);
    photoUrls = await fetchPhotosWithGrok(enrichedData.tripadvisor_id, listing.name);
  }

  // Step 4: Update database
  const updates = {
    tripadvisor_id: enrichedData.tripadvisor_id,
    web_url: enrichedData.web_url || `https://www.tripadvisor.com.ph/${enrichedData.tripadvisor_id}`
  };

  if (photoUrls.length > 0) {
    updates.photo_urls = photoUrls;
    updates.photo_count = photoUrls.length;
  }

  const success = await updateListing(listing.id, updates);
  if (success) {
    stats.success++;
    stats.updated++;
    console.log(`  ✅ Updated: ID + ${photoUrls.length} photos`);
  } else {
    stats.failed++;
  }

  // Rate limiting
  await new Promise(resolve => setTimeout(resolve, 500));
}

// Main execution
async function main() {
  console.log('🚀 Starting TripAdvisor Data Filler (Grok + ScrapingBee)...\n');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  if (!X_API_KEY) {
    console.error('❌ Missing X_API_KEY (Grok)');
    process.exit(1);
  }

  try {
    // Fetch listings needing enrichment
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('*')
      .or('tripadvisor_id.is.null,photo_urls.is.null')
      .order('updated_at', { ascending: true })
      .limit(100);

    if (error) throw error;
    if (!listings?.length) {
      console.log('✅ All listings are already enriched!');
      return;
    }

    console.log(`Found ${listings.length} listings to enrich\n`);

    // Process each listing
    for (const listing of listings) {
      await enrichListing(listing);
    }

    // Report
    console.log('\n' + '='.repeat(50));
    console.log('📊 FINAL REPORT');
    console.log('='.repeat(50));
    console.log(`✅ Total processed: ${stats.total}`);
    console.log(`✓ Successfully enriched: ${stats.success}`);
    console.log(`⚠️ Skipped (already done): ${stats.skipped}`);
    console.log(`❌ Failed: ${stats.failed}`);
    console.log(`📝 Total updated: ${stats.updated}`);
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
