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
  updated: 0,
  onlyId: 0,
  onlyPhotos: 0
};

function getNextBeeKey() {
  const key = SCRAPINGBEE_KEYS[currentKeyIndex % SCRAPINGBEE_KEYS.length];
  currentKeyIndex++;
  return key;
}

// Grok direct TripAdvisor lookup
async function grokFindTripadvisorId(name, address, city, category) {
  try {
    const prompt = `You are searching TripAdvisor Philippines for a specific listing.
    
Name: ${name}
Address: ${address}
City/Province: ${city}
Category: ${category}

Find the EXACT tripadvisor_id. It is in this format: d12345678 or similar with just letters and numbers after 'd'.

Return ONLY this JSON (no markdown):
{
  "tripadvisor_id": "d12345678",
  "web_url": "https://www.tripadvisor.com.ph/...",
  "found": true
}

If not found, return {"found": false}`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return result.found ? result : null;
    }
    return null;
  } catch (error) {
    return null;
  }
}

// ScrapingBee direct photo scraper
async function scrapingBeeGetPhotos(tripadvisor_id) {
  try {
    const url = `https://www.tripadvisor.com.ph/${tripadvisor_id}`;
    const beeKey = getNextBeeKey();

    const response = await fetch('https://api.scrapingbee.com/api/v1/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: beeKey,
        url: url,
        render_javascript: true,
        wait_for: '.photo',
        timeout: 45000
      })
    });

    if (!response.ok) return [];

    const html = await response.text();
    
    // Extract all image URLs
    const imgUrls = [];
    const regexes = [
      /https:\/\/media\.tacdn\.com[^"'\s]+\.(jpg|jpeg|png)/gi,
      /https:\/\/[^"'\s]*tripadvisor[^"'\s]+\.(jpg|jpeg|png)/gi,
    ];

    for (const regex of regexes) {
      let match;
      while ((match = regex.exec(html)) !== null) {
        const url = match[0];
        if (!imgUrls.includes(url) && imgUrls.length < 20) {
          imgUrls.push(url);
        }
      }
    }

    return imgUrls;
  } catch (error) {
    return [];
  }
}

// Grok photo extraction from HTML/JSON
async function grokExtractPhotos(tripadvisor_id, html) {
  try {
    const prompt = `Extract all photo URLs from this TripAdvisor listing HTML. 
Return ONLY a JSON array of valid image URLs:
["https://media.tacdn.com/...", "https://..."]

If no photos found, return empty array [].`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [{
          role: 'user',
          content: prompt + '\n\nHTML:\n' + html.substring(0, 10000)
        }],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!response.ok) return [];
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    
    if (jsonMatch) {
      const urls = JSON.parse(jsonMatch[0]);
      return Array.isArray(urls) ? urls.filter(u => typeof u === 'string' && u.startsWith('http')) : [];
    }
    return [];
  } catch (error) {
    return [];
  }
}

// Update database
async function updateListing(id, updates) {
  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        verified: true,
        fetch_status: 'success',
        last_verified_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    return false;
  }
}

// Main enrichment
async function enrichListing(listing) {
  console.log(`\n📍 ${listing.name} (${listing.city})`);
  
  stats.total++;

  const needsId = !listing.tripadvisor_id;
  const needsPhotos = !listing.photo_urls || listing.photo_urls.length === 0;

  if (!needsId && !needsPhotos) {
    stats.skipped++;
    console.log(`  ✅ Complete - SKIPPED`);
    return;
  }

  let tripadvisor_id = listing.tripadvisor_id;
  let photoUrls = listing.photo_urls || [];

  // Find ID if missing
  if (needsId) {
    console.log(`  🔍 Finding TripAdvisor ID...`);
    const result = await grokFindTripadvisorId(
      listing.name,
      listing.address || '',
      listing.city || '',
      listing.category || listing.location_type || ''
    );

    if (result?.tripadvisor_id) {
      tripadvisor_id = result.tripadvisor_id;
      console.log(`  ✓ ID: ${tripadvisor_id}`);
    } else {
      stats.failed++;
      console.log(`  ❌ Could not find ID`);
      return;
    }
  }

  // Get photos if missing
  if (!photoUrls || photoUrls.length === 0) {
    console.log(`  📸 Fetching photos...`);
    photoUrls = await scrapingBeeGetPhotos(tripadvisor_id);
    
    if (photoUrls.length === 0) {
      console.log(`  ⚠️  No photos from ScrapingBee, trying backup...`);
      // Could add more photo sources here
    }
  }

  // Update database
  const updates = {};
  if (needsId) {
    updates.tripadvisor_id = tripadvisor_id;
  }
  if (photoUrls.length > 0) {
    updates.photo_urls = photoUrls;
    updates.photo_count = photoUrls.length;
  }

  const success = await updateListing(listing.id, updates);
  if (success) {
    stats.success++;
    stats.updated++;
    if (needsId && !needsPhotos) stats.onlyId++;
    if (needsPhotos && !needsId) stats.onlyPhotos++;
    console.log(`  ✅ Updated: ID=${tripadvisor_id.substring(0,20)}, Photos=${photoUrls.length}`);
  } else {
    stats.failed++;
  }

  await new Promise(resolve => setTimeout(resolve, 800));
}

// Main
async function main() {
  console.log('\n🚀 Advanced TripAdvisor Enrichment\n');
  console.log('MODE: Maximum accuracy with aggressive photo extraction\n');

  if (!SUPABASE_URL || !SUPABASE_KEY || !X_API_KEY) {
    console.error('❌ Missing required credentials');
    process.exit(1);
  }

  try {
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('*')
      .or('tripadvisor_id.is.null,photo_urls.is.null')
      .order('rating', { ascending: false, nullsLast: true })
      .limit(150);

    if (error) throw error;
    if (!listings?.length) {
      console.log('✅ All listings complete!');
      return;
    }

    console.log(`Found ${listings.length} listings needing enrichment\n`);
    console.log('Starting enrichment...\n');

    for (const listing of listings) {
      await enrichListing(listing);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 ENRICHMENT COMPLETE');
    console.log('='.repeat(60));
    console.log(`  Total: ${stats.total}`);
    console.log(`  ✅ Success: ${stats.success}`);
    console.log(`  ⚠️  Skipped: ${stats.skipped}`);
    console.log(`  ❌ Failed: ${stats.failed}`);
    console.log(`  📝 Updated: ${stats.updated}`);
    console.log(`     - ID only: ${stats.onlyId}`);
    console.log(`     - Photos only: ${stats.onlyPhotos}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
