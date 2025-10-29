#!/usr/bin/env node

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const X_API_KEY = process.env.X_API_KEY || process.env.GROK_API_KEY;

// ScrapingBee keys from existing scripts
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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials (PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

if (!X_API_KEY) {
  console.error('❌ Missing X_API_KEY for Grok');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let stats = {
  total: 0,
  updated: 0,
  failed: 0,
  skipped: 0,
  totalPhotos: 0
};


function extractTripadvisorIdFromUrl(url) {
  if (!url) return null;
  const patterns = [
    /-d(\d+)-/,
    /location\/(\d+)/,
    /-d(\d{6,10})(?:[\-_]|$)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

function extractPhotoUrls(html) {
  if (!html) return [];
  const urls = [];
  
  const patterns = [
    /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[a-zA-Z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/gi,
    /https:\/\/media-cdn\.tripadvisor\.com\/media\/photo-[a-zA-Z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/gi,
    /https:\/\/[a-z0-9\-]*\.tacdn\.com[^"\s<>]*\.jpg/gi,
    /https:\/\/[a-z0-9\-]*\.tripadvisor\.com\.ph[^"\s<>]*\.(jpg|jpeg|png|webp)/gi,
    /"url":"(https:\/\/[^"]*tripadvisor[^"]*\.jpg)"/gi,
    /src="(https:\/\/[^"]*tacdn[^"]*\.jpg)"/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let url = match[0];
      if (url.includes('"')) {
        url = match[1] || url;
      }
      if (url && !urls.includes(url) && urls.length < 20 && url.includes('http')) {
        urls.push(url);
      }
    }
  }

  return urls;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function grokFindUrl(name, city, category) {
  try {
    const query = `Find the exact TripAdvisor Philippines listing URL (tripadvisor.com.ph) for: "${name}" in ${city || 'Philippines'}${category ? ` (${category})` : ''}. Return ONLY the URL, nothing else.`;
    
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [{ role: 'user', content: query }],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.log(`  ⚠️  Grok API ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();
    
    if (content.includes('tripadvisor.com.ph') || content.includes('tripadvisor.com')) {
      const urlMatch = content.match(/https?:\/\/[^\s]+tripadvisor[^\s]*/);
      return urlMatch ? urlMatch[0].split(/[\s"'<>]/).filter(Boolean)[0] : null;
    }

    return null;
  } catch (error) {
    console.log(`  ⚠️  Grok error: ${error.message?.substring(0, 60)}`);
    return null;
  }
}

async function fetchViaScrapingBee(url) {
  try {
    const beeKey = getNextBeeKey();
    const beeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${beeKey}&url=${encodeURIComponent(url)}&render_javascript=true&wait_for=.attractions-review-list-parts-ReviewCount&premium_proxy=true`;

    requestCount++;
    const response = await fetch(beeUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 50000
    });

    if (!response.ok) {
      console.log(`  ⚠️  ScrapingBee ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.log(`  ⚠️  ScrapingBee error: ${error.message?.substring(0, 60)}`);
    return null;
  }
}

async function processListing(listing) {
  stats.total++;
  
  console.log(`\n[${stats.total}] 📍 ${listing.name?.substring(0, 50)} (${listing.city || 'Unknown'})`);

  if (listing.tripadvisor_id && listing.photo_urls?.length > 0) {
    stats.skipped++;
    console.log(`  ✅ Already complete - skipping`);
    return;
  }

  console.log(`  🔍 Searching for real TripAdvisor listing...`);
  const taUrl = await grokFindUrl(listing.name, listing.city, listing.category);

  if (!taUrl) {
    stats.failed++;
    console.log(`  ❌ Could not find TripAdvisor URL`);
    await sleep(2000);
    return;
  }

  console.log(`  ✓ Found URL: ${taUrl.substring(0, 60)}...`);
  
  const tripId = extractTripadvisorIdFromUrl(taUrl);
  if (!tripId) {
    console.log(`  ⚠️  Could not extract ID from URL`);
  } else {
    console.log(`  ✓ Extracted ID: ${tripId}`);
  }

  console.log(`  📄 Fetching page via ScrapingBee...`);
  await sleep(1000);
  
  const html = await fetchViaScrapingBee(taUrl);
  
  let photoUrls = [];
  if (html) {
    photoUrls = extractPhotoUrls(html);
    console.log(`  📸 Found ${photoUrls.length} photo URLs`);
  } else {
    console.log(`  ⚠️  Could not fetch page`);
  }

  if (!tripId && photoUrls.length === 0) {
    stats.failed++;
    console.log(`  ❌ No data extracted`);
    await sleep(2000);
    return;
  }

  const updateData = {
    updated_at: new Date().toISOString(),
    verified: true,
    fetch_status: 'success'
  };

  if (tripId) {
    updateData.tripadvisor_id = tripId;
    updateData.web_url = taUrl;
  }

  if (photoUrls.length > 0) {
    updateData.photo_urls = photoUrls;
    updateData.photo_count = photoUrls.length;
  }

  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update(updateData)
      .eq('id', listing.id);

    if (error) {
      stats.failed++;
      console.log(`  ❌ DB error: ${error.message?.substring(0, 60)}`);
    } else {
      stats.updated++;
      if (photoUrls.length > 0) {
        stats.totalPhotos += photoUrls.length;
      }
      console.log(`  ✅ Updated successfully`);
    }
  } catch (error) {
    stats.failed++;
    console.log(`  ❌ Error: ${error.message?.substring(0, 60)}`);
  }

  const delayMs = 3000 + Math.floor(Math.random() * 3000);
  await sleep(delayMs);
}

async function fetchListingsToProcess(limit = 50) {
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('id, name, city, category, tripadvisor_id, photo_urls, photo_count')
    .or('tripadvisor_id.is.null,photo_urls.is.null')
    .order('city', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 REAL TRIPADVISOR DATA POPULATOR FOR NEARBY_LISTINGS');
  console.log('='.repeat(80));
  console.log('\nUsing hybrid approach:');
  console.log('  1. Grok (X AI) to find accurate TripAdvisor listing URLs');
  console.log('  2. ScrapingBee to fetch live listing pages');
  console.log('  3. Intelligent extraction of IDs and photo URLs');
  console.log('\nTarget: tripadvisor.com.ph (Real Philippine TripAdvisor data)\n');

  const limit = parseInt(process.env.LIMIT || '30', 10);
  
  console.log(`Fetching up to ${limit} listings needing enrichment...`);
  const listings = await fetchListingsToProcess(limit);

  if (!listings.length) {
    console.log('\n✅ All nearby_listings are complete! No more work needed.\n');
    return;
  }

  console.log(`Found ${listings.length} listings to enrich\n`);
  console.log('='.repeat(80) + '\n');

  for (const listing of listings) {
    await processListing(listing);
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPLETION REPORT');
  console.log('='.repeat(80));
  console.log(`\n  Total processed: ${stats.total}`);
  console.log(`  ✅ Successfully updated: ${stats.updated}`);
  console.log(`  ⏭️  Already complete: ${stats.skipped}`);
  console.log(`  ❌ Failed: ${stats.failed}`);
  console.log(`  📸 Total photos extracted: ${stats.totalPhotos}`);
  console.log(`  🔄 ScrapingBee requests: ${requestCount}`);
  console.log('\n' + '='.repeat(80) + '\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
