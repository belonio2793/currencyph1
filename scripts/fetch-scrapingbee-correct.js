import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import querystring from 'querystring';

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
  
  // Look for patterns like -d123456-
  const match = html.match(/-d(\d{6,10})-/);
  if (match) return match[1];
  
  // Also try to extract from URLs
  const urlMatch = html.match(/\/[a-z_]+-[a-z_]+-d(\d+)-/i);
  if (urlMatch) return urlMatch[1];
  
  return null;
}

// Extract photo URLs from HTML
function extractPhotoUrls(html) {
  if (!html) return [];
  
  const urls = new Set();
  
  // Common TripAdvisor photo URL patterns
  const patterns = [
    /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[a-z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/gi,
    /https:\/\/media-cdn\.tripadvisor\.com\/media\/photo-[a-z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.(jpg|jpeg)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[0];
      if (urls.size < 15) {
        urls.add(url);
      }
    }
  }

  return Array.from(urls);
}

// Fetch via ScrapingBee - GET with query params
async function fetchViaScrapingBee(name, city) {
  try {
    const key = getNextKey();
    const query = `${name} ${city}`;
    const targetUrl = `https://www.tripadvisor.com.ph/Search?q=${encodeURIComponent(query)}`;

    console.log(`  🐝 ScrapingBee key #${keyIndex}`);

    // Build URL with query parameters (correct format)
    const params = {
      api_key: key,
      url: targetUrl,
      render_javascript: 'true',
      wait_for: '.result__title'
    };

    const queryStr = new URLSearchParams(params).toString();
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?${queryStr}`;

    const response = await fetch(scrapingBeeUrl, {
      timeout: 50000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.log(`  ❌ Status ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    if (!html || html.length < 500) {
      console.log(`  ⚠️  Empty response`);
      return null;
    }

    const tripadvisorId = extractTripadvisorId(html);
    const photoUrls = extractPhotoUrls(html);

    if (tripadvisorId) {
      console.log(`  ✓ ID: ${tripadvisorId}`);
    }
    if (photoUrls.length > 0) {
      console.log(`  📸 Photos: ${photoUrls.length}`);
    }

    return { tripadvisorId, photoUrls };
  } catch (error) {
    console.log(`  ⚠️  ${error.message.substring(0, 60)}`);
    return null;
  }
}

// Update database
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
        fetch_status: 'success'
      })
      .eq('id', id);

    return !error;
  } catch (error) {
    return false;
  }
}

// Process listing
async function processListing(listing) {
  stats.total++;
  
  console.log(`\n📍 ${listing.name.substring(0, 40)}`);

  if (listing.tripadvisor_id && listing.photo_urls?.length > 0) {
    return;
  }

  const result = await fetchViaScrapingBee(listing.name, listing.city || '');

  if (!result?.tripadvisorId) {
    stats.failed++;
    console.log(`  ❌ Failed`);
    return;
  }

  const success = await updateListing(listing.id, result.tripadvisorId, result.photoUrls);

  if (success) {
    stats.success++;
    stats.photosFound += result.photoUrls.length;
    console.log(`  ✅ Updated`);
  } else {
    stats.failed++;
  }

  // Rate limit: 3-5 seconds
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 3000));
}

// Main
async function main() {
  console.log('\n🚀 ScrapingBee Real Data Fetcher (Correct API)\n');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase');
    process.exit(1);
  }

  try {
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('*')
      .or('tripadvisor_id.is.null,photo_urls.is.null')
      .limit(20);

    if (error) throw error;
    if (!listings?.length) {
      console.log('✅ All complete!');
      return;
    }

    console.log(`Found ${listings.length} listings\n`);

    for (const listing of listings) {
      await processListing(listing);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ ${stats.success} | ❌ ${stats.failed} | 📸 ${stats.photosFound} photos\n`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
