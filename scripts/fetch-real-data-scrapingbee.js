import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

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

let keyIndex = 0;
let stats = {
  total: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  photosFound: 0
};

function getNextKey() {
  const key = SCRAPINGBEE_KEYS[keyIndex % SCRAPINGBEE_KEYS.length];
  keyIndex++;
  return key;
}

// Extract tripadvisor_id from HTML
function extractTripadvisorId(html) {
  if (!html) return null;
  
  const patterns = [
    /\/[a-zA-Z_]+-[a-zA-Z0-9_]+-d(\d+)-/g,
    /-d(\d{6,10})-/g,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Extract photo URLs from HTML
function extractPhotoUrls(html) {
  if (!html) return [];
  
  const urls = [];
  const photoPatterns = [
    /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[a-z]\/[^"\s<>]+/gi,
    /https:\/\/media-cdn\.tripadvisor\.com\/media\/photo-[a-z]\/[^"\s<>]+/gi,
    /https:\/\/[a-z0-9-]*\.tacdn\.com[^"\s<>]*\.jpg/gi,
  ];

  for (const pattern of photoPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[0];
      // Clean up URL
      const cleanUrl = url.split('"')[0].split("'")[0].split(' ')[0];
      if (!urls.includes(cleanUrl) && urls.length < 20 && cleanUrl.endsWith('.jpg')) {
        urls.push(cleanUrl);
      }
    }
  }

  return urls;
}

// Fetch listing via ScrapingBee with POST
async function fetchViaScrapingBee(name, city) {
  try {
    const key = getNextKey();
    const query = `${name} ${city}`;
    const searchUrl = `https://www.tripadvisor.com.ph/Search?q=${encodeURIComponent(query)}`;

    console.log(`  🔍 Searching: ${query}`);
    console.log(`  🐝 Key: ${key.substring(0, 8)}...`);

    // Use POST request with proper payload
    const response = await fetch('https://app.scrapingbee.com/api/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: key,
        url: searchUrl,
        render_javascript: true,
        wait_for: '.result__title',
        timeout: 45000
      })
    });

    if (!response.ok) {
      console.log(`  ❌ Status ${response.status}`);
      const text = await response.text();
      console.log(`  📝 ${text.substring(0, 100)}`);
      return null;
    }

    const data = await response.json();
    
    // ScrapingBee returns HTML in 'body' field
    const html = data.body || '';
    
    if (!html || html.length < 100) {
      console.log(`  ❌ Empty response`);
      return null;
    }

    // Extract data
    const tripadvisorId = extractTripadvisorId(html);
    const photoUrls = extractPhotoUrls(html);

    if (tripadvisorId) {
      console.log(`  ✓ Found ID: ${tripadvisorId}`);
    } else {
      console.log(`  ⚠️  No ID found`);
    }
    
    if (photoUrls.length > 0) {
      console.log(`  📸 Found ${photoUrls.length} photos`);
    }

    return {
      tripadvisorId,
      photoUrls
    };
  } catch (error) {
    console.log(`  ⚠️  Error: ${error.message.substring(0, 80)}`);
    return null;
  }
}

// Update listing in database
async function updateListing(id, tripadvisorId, photoUrls) {
  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        tripadvisor_id: tripadvisorId,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
        photo_count: photoUrls.length,
        updated_at: new Date().toISOString(),
        verified: true,
        fetch_status: 'success',
        last_verified_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.log(`  ❌ DB: ${error.message.substring(0, 60)}`);
    return false;
  }
}

// Process listing
async function processListing(listing) {
  stats.total++;
  
  console.log(`\n📍 ${listing.name.substring(0, 45)}`);

  // Skip if already complete
  if (listing.tripadvisor_id && listing.photo_urls?.length > 0) {
    stats.skipped++;
    return;
  }

  // Fetch via ScrapingBee
  const result = await fetchViaScrapingBee(listing.name, listing.city || 'Philippines');

  if (!result?.tripadvisorId) {
    stats.failed++;
    console.log(`  ❌ Failed`);
    return;
  }

  // Update database
  const success = await updateListing(listing.id, result.tripadvisorId, result.photoUrls);

  if (success) {
    stats.success++;
    stats.photosFound += result.photoUrls.length;
    console.log(`  ✅ Updated`);
  } else {
    stats.failed++;
  }

  // Rate limiting: 3-5 seconds
  const delay = Math.floor(Math.random() * 2000) + 3000;
  await new Promise(resolve => setTimeout(resolve, delay));
}

// Main
async function main() {
  console.log('\n🚀 ScrapingBee Real TripAdvisor Data Fetcher\n');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  try {
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('*')
      .or('tripadvisor_id.is.null,photo_urls.is.null')
      .limit(30);

    if (error) throw error;
    if (!listings?.length) {
      console.log('✅ All listings complete!');
      return;
    }

    console.log(`Found ${listings.length} listings\n`);

    for (const listing of listings) {
      await processListing(listing);
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n✅ Success: ${stats.success}`);
    console.log(`❌ Failed: ${stats.failed}`);
    console.log(`📸 Photos found: ${stats.photosFound}\n`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
