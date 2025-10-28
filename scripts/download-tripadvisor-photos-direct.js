#!/usr/bin/env node

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

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

let stats = {
  total: 0,
  processed: 0,
  downloaded: 0,
  uploaded: 0,
  failed: 0
};

let beeKeyIndex = 0;

function getNextBeeKey() {
  const key = SCRAPINGBEE_KEYS[beeKeyIndex % SCRAPINGBEE_KEYS.length];
  beeKeyIndex++;
  return key;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchViaScrapingBee(url) {
  try {
    const beeKey = getNextBeeKey();
    const beeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${beeKey}&url=${encodeURIComponent(url)}&render_javascript=true&premium_proxy=true`;

    const response = await fetch(beeUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 60000
    });

    if (!response.ok) {
      console.log(`  ⚠️  ScrapingBee ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.log(`  ⚠️  Fetch error: ${error.message?.substring(0, 60)}`);
    return null;
  }
}

function extractPhotoUrls(html) {
  if (!html) return [];
  const urls = [];

  const patterns = [
    /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[a-zA-Z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/gi,
    /https:\/\/media-cdn\.tripadvisor\.com\/media\/photo-[a-zA-Z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/gi,
    /https:\/\/[a-z0-9\-]*\.tacdn\.com[^"\s<>]*\.jpg/gi,
    /https:\/\/[a-z0-9\-]*\.tripadvisor\.com\.ph[^"\s<>]*\.(jpg|jpeg|png|webp)/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let url = match[0];
      if (url && !urls.includes(url) && urls.length < 20 && url.includes('http')) {
        urls.push(url);
      }
    }
  }

  return urls;
}

async function downloadImage(url, timeout = 30000) {
  try {
    const response = await fetch(url, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return null;
    }

    const buffer = await response.buffer();
    return buffer && buffer.length > 0 ? buffer : null;
  } catch (error) {
    return null;
  }
}

function getFileExtension(url) {
  if (url.includes('.jpg') || url.includes('.jpeg')) return 'jpg';
  if (url.includes('.png')) return 'png';
  if (url.includes('.webp')) return 'webp';
  return 'jpg';
}

async function uploadToSupabase(listingId, imageBuffer, index, extension) {
  try {
    const timestamp = Date.now();
    const fileName = `listing-${listingId}-photo-${index}-${timestamp}.${extension}`;
    const storagePath = `listings/${listingId}/${fileName}`;

    const contentType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';

    const { error } = await supabase.storage
      .from('nearby_listings')
      .upload(storagePath, imageBuffer, {
        contentType,
        upsert: false
      });

    if (error) {
      console.log(`  ❌ Upload failed: ${error.message?.substring(0, 50)}`);
      return null;
    }

    return storagePath;
  } catch (error) {
    console.log(`  ❌ Upload error: ${error.message?.substring(0, 50)}`);
    return null;
  }
}

async function processListing(listing) {
  stats.processed++;
  
  console.log(`\n[${stats.processed}/${stats.total}] 📍 ${listing.name?.substring(0, 50)} (${listing.city})`);

  if (!listing.web_url) {
    console.log(`  ❌ No web_url`);
    stats.failed++;
    return;
  }

  console.log(`  🌐 Fetching via ScrapingBee...`);
  const html = await fetchViaScrapingBee(listing.web_url);

  if (!html) {
    stats.failed++;
    return;
  }

  const photoUrls = extractPhotoUrls(html);
  if (photoUrls.length === 0) {
    console.log(`  ❌ No photos found`);
    stats.failed++;
    return;
  }

  console.log(`  📸 Found ${photoUrls.length} photos, downloading...`);

  const storedPaths = [];
  let successCount = 0;

  for (let i = 0; i < Math.min(photoUrls.length, 20); i++) {
    const photoUrl = photoUrls[i];

    const imageBuffer = await downloadImage(photoUrl);
    if (!imageBuffer) {
      console.log(`    ⚠️  Failed to download photo ${i + 1}`);
      continue;
    }

    const extension = getFileExtension(photoUrl);
    const storagePath = await uploadToSupabase(listing.id, imageBuffer, i + 1, extension);

    if (storagePath) {
      storedPaths.push(storagePath);
      successCount++;
      console.log(`    ✅ Uploaded photo ${i + 1}`);
    }

    await sleep(500);
  }

  if (storedPaths.length > 0) {
    try {
      const { error } = await supabase
        .from('nearby_listings')
        .update({
          stored_image_paths: storedPaths,
          image_downloaded_at: new Date().toISOString()
        })
        .eq('id', listing.id);

      if (!error) {
        stats.downloaded += storedPaths.length;
        stats.uploaded++;
        console.log(`  ✅ Stored ${successCount} photos`);
      }
    } catch (error) {
      console.log(`  ❌ DB update failed`);
    }
  } else {
    stats.failed++;
  }

  await sleep(2000);
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🖼️  DOWNLOAD TRIPADVISOR PHOTOS DIRECTLY');
  console.log('='.repeat(80));
  console.log('\nFetching from tripadvisor.com.ph using ScrapingBee\n');

  const limit = parseInt(process.env.LIMIT || '10', 10);

  try {
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, name, city, web_url')
      .not('web_url', 'is', null)
      .order('id', { ascending: true })
      .limit(limit);

    if (error) throw error;

    if (!listings?.length) {
      console.log('✅ No listings to process');
      return;
    }

    stats.total = listings.length;
    console.log(`Found ${stats.total} listings to process\n`);
    console.log('='.repeat(80) + '\n');

    for (const listing of listings) {
      await processListing(listing);
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL REPORT');
    console.log('='.repeat(80));
    console.log(`\n  Total listings: ${stats.total}`);
    console.log(`  ✅ Successfully processed: ${stats.uploaded}`);
    console.log(`  ❌ Failed: ${stats.failed}`);
    console.log(`  📸 Total photos downloaded: ${stats.downloaded}`);
    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
