#!/usr/bin/env node

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
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

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

let beeKeyIndex = 0;
let stats = {
  total: 0,
  urlsFound: 0,
  photosDownloaded: 0,
  photosUploaded: 0,
  failed: 0
};

function getNextBeeKey() {
  const key = SCRAPINGBEE_KEYS[beeKeyIndex % SCRAPINGBEE_KEYS.length];
  beeKeyIndex++;
  return key;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function grokFindUrl(name, city) {
  if (!X_API_KEY) return null;
  
  try {
    const prompt = `Find the EXACT TripAdvisor Philippines listing URL for: "${name}" in ${city}. Return ONLY the URL, nothing else.`;
    
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
        max_tokens: 300
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();
    
    if (content.includes('tripadvisor')) {
      const urlMatch = content.match(/https?:\/\/[^\s]+tripadvisor[^\s]*/);
      return urlMatch ? urlMatch[0].split(/[\s"'<>]/).filter(Boolean)[0] : null;
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function fetchPhotoUrlsViaScrapingBee(taUrl) {
  try {
    const beeKey = getNextBeeKey();
    const beeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${beeKey}&url=${encodeURIComponent(taUrl)}&render_javascript=true&premium_proxy=true&wait_for=.attractions-review-list-parts-ReviewCount`;

    const response = await fetch(beeUrl, {
      timeout: 60000
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}`, html: null };
    }

    const html = await response.text();
    return { error: null, html };
  } catch (error) {
    return { error: error.message, html: null };
  }
}

function extractPhotoUrls(html) {
  if (!html) return [];
  const urls = [];

  const patterns = [
    /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[a-zA-Z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/gi,
    /https:\/\/media-cdn\.tripadvisor\.com\/media\/photo-[a-zA-Z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/gi,
    /https:\/\/[a-z0-9\-]*\.tacdn\.com[^"\s<>]*\.jpg/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let url = match[0];
      if (url && !urls.includes(url) && urls.length < 20) {
        urls.push(url);
      }
    }
  }

  return urls;
}

async function downloadImage(url) {
  try {
    const response = await fetch(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!response.ok) return null;

    const buffer = await response.buffer();
    return buffer && buffer.length > 0 ? buffer : null;
  } catch (error) {
    return null;
  }
}

async function uploadToSupabase(listingId, imageBuffer, index) {
  try {
    const timestamp = Date.now();
    const storagePath = `listings/${listingId}/${timestamp}-photo-${index}.jpg`;

    const { error } = await supabase.storage
      .from('nearby_listings')
      .upload(storagePath, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    return error ? null : storagePath;
  } catch (error) {
    return null;
  }
}

async function processListing(listing, index, total) {
  console.log(`\n[${index}/${total}] 📍 ${listing.name?.substring(0, 40)} (${listing.city})`);

  let taUrl = listing.web_url;

  if (!taUrl) {
    console.log(`  🔍 Finding TripAdvisor URL via Grok...`);
    taUrl = await grokFindUrl(listing.name, listing.city);
    
    if (!taUrl) {
      console.log(`  ❌ Could not find URL`);
      stats.failed++;
      return;
    }
    console.log(`  ✓ Found: ${taUrl.substring(0, 60)}...`);
  } else {
    console.log(`  ✓ Using existing URL`);
  }

  stats.urlsFound++;

  console.log(`  📄 Fetching photos via ScrapingBee...`);
  await sleep(1000);

  const { error, html } = await fetchPhotoUrlsViaScrapingBee(taUrl);

  if (error || !html) {
    console.log(`  ❌ Failed to fetch: ${error}`);
    stats.failed++;
    return;
  }

  const photoUrls = extractPhotoUrls(html);
  if (photoUrls.length === 0) {
    console.log(`  ⚠️  No photos found in HTML`);
    return;
  }

  console.log(`  🖼️  Found ${photoUrls.length} photos, downloading...`);

  const storedPaths = [];
  let downloadedCount = 0;

  for (let i = 0; i < Math.min(photoUrls.length, 15); i++) {
    const photoUrl = photoUrls[i];

    const imageBuffer = await downloadImage(photoUrl);
    if (!imageBuffer) {
      console.log(`    ⚠️  Skipped photo ${i + 1}`);
      continue;
    }

    const storagePath = await uploadToSupabase(listing.id, imageBuffer, i + 1);
    if (storagePath) {
      storedPaths.push(storagePath);
      downloadedCount++;
      console.log(`    ✅ Photo ${i + 1} uploaded`);
    }

    await sleep(300);
  }

  if (storedPaths.length > 0) {
    try {
      const { error: updateError } = await supabase
        .from('nearby_listings')
        .update({
          stored_image_paths: storedPaths,
          image_downloaded_at: new Date().toISOString(),
          web_url: taUrl
        })
        .eq('id', listing.id);

      if (!updateError) {
        stats.photosDownloaded += photoUrls.length;
        stats.photosUploaded += storedPaths.length;
        console.log(`  ✅ ${downloadedCount} photos stored in DB`);
      }
    } catch (error) {
      console.log(`  ⚠️  DB update failed`);
    }
  }

  await sleep(2000);
}

async function main() {
  console.log('\n' + '='.repeat(85));
  console.log('🚀 COMPLETE PHOTO DOWNLOAD PIPELINE');
  console.log('='.repeat(85));
  console.log('\nStep 1: Find TripAdvisor URLs (if missing)');
  console.log('Step 2: Fetch listing pages via ScrapingBee');
  console.log('Step 3: Extract photo URLs');
  console.log('Step 4: Download actual image files');
  console.log('Step 5: Store in Supabase bucket\n');

  const limit = parseInt(process.env.LIMIT || '10', 10);

  try {
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, name, city, web_url')
      .order('id', { ascending: true })
      .limit(limit);

    if (error) throw error;

    if (!listings?.length) {
      console.log('✅ No listings found');
      return;
    }

    stats.total = listings.length;
    console.log(`Found ${stats.total} listings\n`);
    console.log('='.repeat(85) + '\n');

    for (let i = 0; i < listings.length; i++) {
      await processListing(listings[i], i + 1, listings.length);
    }

    console.log('\n' + '='.repeat(85));
    console.log('📊 FINAL REPORT');
    console.log('='.repeat(85));
    console.log(`\n  Total processed: ${stats.total}`);
    console.log(`  ✓ URLs found: ${stats.urlsFound}`);
    console.log(`  📸 Photos downloaded: ${stats.photosDownloaded}`);
    console.log(`  ✅ Photos uploaded: ${stats.photosUploaded}`);
    console.log(`  ❌ Failed: ${stats.failed}`);
    console.log(`\n  Photos per listing: ${(stats.photosDownloaded / stats.urlsFound).toFixed(1)} avg`);
    console.log('\n' + '='.repeat(85) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
