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
  
  // Look for TripAdvisor URL patterns in the HTML
  const patterns = [
    /Attraction_Review-[a-z0-9]+-d(\d+)-/gi,
    /Hotel_Review-[a-z0-9]+-d(\d+)-/gi,
    /Restaurant_Review-[a-z0-9]+-d(\d+)-/gi,
    /-d(\d{6,10})-/gi,
    /\/d(\d{6,10})[/-]/gi
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      // Extract the number
      const numMatch = match[0].match(/d(\d+)/);
      if (numMatch && numMatch[1]) {
        return numMatch[1];
      }
    }
  }
  
  return null;
}

// Extract photo URLs from HTML
function extractPhotoUrls(html) {
  if (!html) return [];
  
  const urls = [];
  
  // Match TripAdvisor CDN URLs
  const photoPatterns = [
    /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[a-z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/gi,
    /https:\/\/media-cdn\.tripadvisor\.com\/media\/photo-[a-z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/gi,
    /https:\/\/[a-z0-9-]*\.tacdn\.com[^"\s<>]*\.jpg/gi,
    /https:\/\/[a-z0-9-]*\.tripadvisor\.com[^"\s<>]*\.(jpg|jpeg|png)/gi
  ];

  for (const pattern of photoPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[0];
      if (!urls.includes(url) && urls.length < 20) {
        urls.push(url);
      }
    }
  }

  return urls;
}

// Fetch listing via ScrapingBee
async function fetchViaScrapingBee(name, city, address) {
  try {
    const key = getNextKey();
    
    // Build search query
    const query = `${name} ${city} Philippines`;
    const searchUrl = `https://www.tripadvisor.com.ph/Search?q=${encodeURIComponent(query)}`;

    console.log(`  🔍 Searching: ${query}`);
    console.log(`  🐝 Using ScrapingBee key #${keyIndex}`);

    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${key}&url=${encodeURIComponent(searchUrl)}&render_javascript=true&wait_for=.result__title`;

    const response = await fetch(scrapingBeeUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 45000
    });

    if (!response.ok) {
      console.log(`  ❌ Status ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    // Extract data
    const tripadvisorId = extractTripadvisorId(html);
    const photoUrls = extractPhotoUrls(html);

    if (tripadvisorId) {
      console.log(`  ✓ Found ID: ${tripadvisorId}`);
    }
    if (photoUrls.length > 0) {
      console.log(`  📸 Found ${photoUrls.length} photos`);
    }

    return {
      tripadvisorId,
      photoUrls,
      html: html.substring(0, 1000) // Keep for debugging
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
    console.log(`  ❌ DB error: ${error.message.substring(0, 80)}`);
    return false;
  }
}

// Process listing
async function processListing(listing) {
  stats.total++;
  
  console.log(`\n📍 ${listing.name.substring(0, 50)} (${listing.city})`);

  // Skip if already complete
  if (listing.tripadvisor_id && listing.photo_urls?.length > 0) {
    stats.skipped++;
    console.log(`  ✅ Already complete - skipped`);
    return;
  }

  // Fetch via ScrapingBee
  const result = await fetchViaScrapingBee(
    listing.name,
    listing.city || 'Philippines',
    listing.address || ''
  );

  if (!result?.tripadvisorId) {
    stats.failed++;
    console.log(`  ❌ Could not fetch data`);
    return;
  }

  // Update database
  const success = await updateListing(
    listing.id,
    result.tripadvisorId,
    result.photoUrls
  );

  if (success) {
    stats.success++;
    stats.photosFound += result.photoUrls.length;
    console.log(`  ✅ Updated successfully`);
  } else {
    stats.failed++;
  }

  // Rate limiting: 3-5 seconds between requests
  const delay = Math.floor(Math.random() * 2000) + 3000;
  await new Promise(resolve => setTimeout(resolve, delay));
}

// Main
async function main() {
  console.log('\n🚀 ScrapingBee TripAdvisor Real Data Fetcher\n');
  console.log('='.repeat(90) + '\n');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  try {
    // Fetch listings needing enrichment
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('*')
      .or('tripadvisor_id.is.null,photo_urls.is.null')
      .order('city', { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!listings?.length) {
      console.log('✅ All listings are enriched!');
      return;
    }

    console.log(`Found ${listings.length} listings to enrich\n`);
    console.log('Starting real TripAdvisor data fetch...\n');

    // Process each listing
    for (const listing of listings) {
      await processListing(listing);
    }

    // Report
    console.log('\n' + '='.repeat(90));
    console.log('\n📊 FETCH COMPLETE\n');
    console.log(`  Total processed: ${stats.total}`);
    console.log(`  ✅ Successfully fetched: ${stats.success}`);
    console.log(`  ⚠️  Skipped (already done): ${stats.skipped}`);
    console.log(`  ❌ Failed: ${stats.failed}`);
    console.log(`  📸 Total photos found: ${stats.photosFound}`);
    console.log('\n' + '='.repeat(90) + '\n');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
